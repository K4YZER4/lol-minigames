import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Inject } from "@nestjs/common";
import type { Server, Socket } from "socket.io";
import { z } from "zod";
import {
  AnswerPayloadSchema,
  AvatarIdSchema,
  ClientEvents,
  CluePayloadSchema,
  PictionaryGuessPayloadSchema,
  PictionaryStrokePayloadSchema,
  PictionaryFillPayloadSchema,
  CarreraAnswerPayloadSchema,
  ImitacionSubmitPayloadSchema,
  ImitacionVotePayloadSchema,
  PartyGuessPayloadSchema,
  QuienSoyGuessPayloadSchema,
  NicknameSchema,
  RequestIdSchema,
  RoomCodeSchema,
  SettingsSchema,
  TokenSchema,
  VotePayloadSchema,
  type Reject,
  type RejectCode,
} from "@lolgames/protocol";
import { RoomService } from "../rooms/room.service";
import { BroadcastService } from "./broadcast.service";
import { RateLimiter } from "../ports";
import { allowedOrigins, clientIp, originAllowed, proxyHops } from "./security";

const PRODUCTION = process.env.NODE_ENV === "production";
const ALLOWED_ORIGINS = allowedOrigins(process.env.WEB_ORIGIN, PRODUCTION);
const PROXY_HOPS = proxyHops(process.env.TRUST_PROXY_HOPS);

const reject = (code: RejectCode, message: string): Reject => ({
  ok: false,
  code,
  message,
});

const issue = (error: z.ZodError): string =>
  error.issues[0]?.message ?? "Datos inválidos";

@WebSocketGateway({
  cors: { origin: ALLOWED_ORIGINS, credentials: false },
  allowRequest: (req: { headers: { origin?: string } }, callback: (error: string | null, success: boolean) => void) => {
    const allowed = originAllowed(req.headers.origin, ALLOWED_ORIGINS, PRODUCTION);
    callback(allowed ? null : "Origin no permitido", allowed);
  },
  maxHttpBufferSize: 100_000,
  pingInterval: 25_000,
  pingTimeout: 20_000,
  upgradeTimeout: 10_000,
})
export class RoomGateway implements OnGatewayInit, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;
  private readonly activeByIp = new Map<string, number>();

  constructor(
    @Inject(RoomService) private readonly rooms: RoomService,
    @Inject(BroadcastService) private readonly broadcast: BroadcastService,
    @Inject(RateLimiter) private readonly limiter: RateLimiter,
  ) {}

  afterInit(server: Server) {
    this.broadcast.attach(server);
    server.use(async (socket, next) => {
      const ip = clientIp(socket.handshake.address, socket.handshake.headers["x-forwarded-for"], PROXY_HOPS);
      try {
        if (!(await this.limiter.hit(`connect:${ip}`, 60_000, 30))) {
          return next(new Error("Demasiadas conexiones, espera un minuto"));
        }
        const active = this.activeByIp.get(ip) ?? 0;
        if (active >= 20) return next(new Error("Demasiadas conexiones simultáneas"));
        this.activeByIp.set(ip, active + 1);
        socket.data.ip = ip;
        socket.once("disconnect", () => {
          const remaining = (this.activeByIp.get(ip) ?? 1) - 1;
          if (remaining > 0) this.activeByIp.set(ip, remaining);
          else this.activeByIp.delete(ip);
        });
        next();
      } catch (error) {
        next(error instanceof Error ? error : new Error("Error de conexión"));
      }
    });
    server.on("connection", (socket) => {
      socket.use((packet, next) => {
        void this.limiter.hit(`event:${socket.id}`, 10_000, 100).then((allowed) => {
          if (allowed) return next();
          const ack = packet.at(-1);
          if (typeof ack === "function") ack(reject("RATE_LIMITED", "Vas demasiado rápido"));
        }).catch(() => socket.disconnect(true));
      });
    });
  }

  handleDisconnect(client: Socket) {
    void this.rooms.disconnectSocket(client.id);
  }

  /* ------------------------------ sesión ----------------------------- */

  @SubscribeMessage(ClientEvents.CREATE_ROOM)
  async onCreate(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    if (this.playerOf(client) || client.data.joining) return reject("INVALID", "Sal de la sala actual antes de crear otra");
    client.data.joining = true;
    try {
      const parsed = z.object({ nickname: NicknameSchema, avatarId: AvatarIdSchema.optional() }).safeParse(body);
      if (!parsed.success) return reject("INVALID", issue(parsed.error));

      const ack = await this.rooms.createRoom(
        parsed.data.nickname,
        parsed.data.avatarId,
        client.id,
        client.data.ip as string,
      );
      if (ack.ok) {
        if (client.connected) await this.attach(client, ack.roomId, ack.playerId, ack.roomCode, ack.token);
        else await this.rooms.disconnectSocket(client.id);
      }
      return ack;
    } finally {
      delete client.data.joining;
    }
  }

  @SubscribeMessage(ClientEvents.JOIN_ROOM)
  async onJoin(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    if (client.data.joining) return reject("INVALID", "Ya hay una entrada en curso");
    const parsed = z
      .object({
        code: RoomCodeSchema,
        nickname: NicknameSchema.optional(),
        token: TokenSchema.optional(),
        avatarId: AvatarIdSchema.optional(),
      })
      .safeParse(body);
    if (!parsed.success) return reject("INVALID", issue(parsed.error));
    if (!parsed.data.token && !parsed.data.nickname) {
      return reject("INVALID", "Necesitas un apodo para entrar");
    }

    const currentPlayerId = this.playerOf(client);
    if (currentPlayerId) {
      const sameRoom = client.data.roomCode === parsed.data.code;
      const sameToken = client.data.token === parsed.data.token;
      if (sameRoom && sameToken && client.data.roomId && client.data.token) {
        await this.rooms.refresh(client.data.roomId as string);
        return {
          ok: true,
          playerId: currentPlayerId,
          token: client.data.token as string,
          roomCode: parsed.data.code,
          roomId: client.data.roomId as string,
        };
      }
      return reject("INVALID", "Sal de la sala actual antes de entrar a otra");
    }

    client.data.joining = true;
    try {
      const ack = await this.rooms.joinRoom(
        parsed.data.code,
        parsed.data.nickname ?? null,
        parsed.data.token ?? null,
        parsed.data.avatarId,
        client.id,
        client.data.ip as string,
      );
      if (ack.ok) {
        if (client.connected) await this.attach(client, ack.roomId, ack.playerId, ack.roomCode, ack.token);
        else await this.rooms.disconnectSocket(client.id);
      }
      return ack;
    } finally {
      delete client.data.joining;
    }
  }

  @SubscribeMessage(ClientEvents.LEAVE_ROOM)
  async onLeave(@ConnectedSocket() client: Socket) {
    const playerId = this.playerOf(client);
    if (!playerId) return reject("NOT_IN_ROOM", "No estás en una sala");
    const ack = await this.rooms.leave(playerId);
    const roomId = client.data.roomId as string | undefined;
    if (roomId) await client.leave(roomId);
    delete client.data.playerId;
    delete client.data.roomId;
    delete client.data.roomCode;
    delete client.data.token;
    return ack;
  }

  @SubscribeMessage(ClientEvents.SET_READY)
  async onReady(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const playerId = this.playerOf(client);
    if (!playerId) return reject("NOT_IN_ROOM", "No estás en una sala");
    const parsed = z.object({ ready: z.boolean() }).safeParse(body);
    if (!parsed.success) return reject("INVALID", issue(parsed.error));
    return this.rooms.setReady(playerId, parsed.data.ready);
  }

  @SubscribeMessage(ClientEvents.CONFIGURE)
  async onConfigure(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const playerId = this.playerOf(client);
    if (!playerId) return reject("NOT_IN_ROOM", "No estás en una sala");
    const parsed = SettingsSchema.safeParse(body);
    if (!parsed.success) return reject("INVALID", issue(parsed.error));
    return this.rooms.configure(playerId, parsed.data);
  }

  @SubscribeMessage(ClientEvents.START)
  async onStart(@ConnectedSocket() client: Socket) {
    const playerId = this.playerOf(client);
    if (!playerId) return reject("NOT_IN_ROOM", "No estás en una sala");
    return this.rooms.startSession(playerId);
  }

  @SubscribeMessage(ClientEvents.RESET)
  async onReset(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const playerId = this.playerOf(client);
    if (!playerId) return reject("NOT_IN_ROOM", "No estás en una sala");
      const parsed = z.object({ mode: z.enum(["bomba", "impostor", "pictionary", "quien-soy", "carrera", "carrera-sonido", "carrera-emojis", "imitacion", "party"]).optional() }).safeParse(body ?? {});
    if (!parsed.success) return reject("INVALID", issue(parsed.error));
    return this.rooms.resetSession(playerId, parsed.data.mode);
  }

  /* ------------------------------ juego ------------------------------ */

  @SubscribeMessage(ClientEvents.BOMBA_ANSWER)
  async onAnswer(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const playerId = this.playerOf(client);
    if (!playerId) return reject("NOT_IN_ROOM", "No estás en una sala");
    const parsed = AnswerPayloadSchema.safeParse(body);
    if (!parsed.success) return reject("INVALID", issue(parsed.error));
    return this.rooms.action(playerId, {
      kind: "bomba:answer",
      requestId: parsed.data.requestId,
      championId: parsed.data.championId,
    });
  }

  @SubscribeMessage(ClientEvents.IMPOSTOR_ACK)
  async onImpostorAck(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const playerId = this.playerOf(client);
    if (!playerId) return reject("NOT_IN_ROOM", "No estás en una sala");
    const parsed = z.object({ requestId: RequestIdSchema }).safeParse(body);
    if (!parsed.success) return reject("INVALID", issue(parsed.error));
    return this.rooms.action(playerId, {
      kind: "impostor:ack",
      requestId: parsed.data.requestId,
    });
  }

  @SubscribeMessage(ClientEvents.IMPOSTOR_CLUE)
  async onImpostorClue(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const playerId = this.playerOf(client);
    if (!playerId) return reject("NOT_IN_ROOM", "No estás en una sala");
    const parsed = CluePayloadSchema.safeParse(body);
    if (!parsed.success) return reject("INVALID", issue(parsed.error));
    return this.rooms.action(playerId, {
      kind: "impostor:clue",
      requestId: parsed.data.requestId,
      text: parsed.data.text,
    });
  }

  @SubscribeMessage(ClientEvents.IMPOSTOR_VOTE)
  async onImpostorVote(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const playerId = this.playerOf(client);
    if (!playerId) return reject("NOT_IN_ROOM", "No estás en una sala");
    const parsed = VotePayloadSchema.safeParse(body);
    if (!parsed.success) return reject("INVALID", issue(parsed.error));
    return this.rooms.action(playerId, {
      kind: "impostor:vote",
      requestId: parsed.data.requestId,
      targetId: parsed.data.targetId,
    });
  }

  @SubscribeMessage(ClientEvents.IMPOSTOR_REPEAT)
  async onImpostorRepeat(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const playerId = this.playerOf(client);
    if (!playerId) return reject("NOT_IN_ROOM", "No estás en una sala");
    const parsed = z.object({ requestId: RequestIdSchema }).safeParse(body);
    if (!parsed.success) return reject("INVALID", issue(parsed.error));
    return this.rooms.action(playerId, { kind: "impostor:repeat", ...parsed.data });
  }

  @SubscribeMessage(ClientEvents.PICTIONARY_STROKE)
  async onPictionaryStroke(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const playerId = this.playerOf(client);
    if (!playerId) return reject("NOT_IN_ROOM", "No estás en una sala");
    const parsed = PictionaryStrokePayloadSchema.safeParse(body);
    if (!parsed.success) return reject("INVALID", issue(parsed.error));
    return this.rooms.action(playerId, { kind: "pictionary:stroke", ...parsed.data });
  }

  @SubscribeMessage(ClientEvents.PICTIONARY_GUESS)
  async onPictionaryGuess(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const playerId = this.playerOf(client);
    if (!playerId) return reject("NOT_IN_ROOM", "No estás en una sala");
    const parsed = PictionaryGuessPayloadSchema.safeParse(body);
    if (!parsed.success) return reject("INVALID", issue(parsed.error));
    return this.rooms.action(playerId, { kind: "pictionary:guess", ...parsed.data });
  }

  @SubscribeMessage(ClientEvents.PICTIONARY_CLEAR)
  async onPictionaryClear(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const playerId = this.playerOf(client);
    if (!playerId) return reject("NOT_IN_ROOM", "No estás en una sala");
    const parsed = z.object({ requestId: RequestIdSchema }).safeParse(body);
    if (!parsed.success) return reject("INVALID", issue(parsed.error));
    return this.rooms.action(playerId, { kind: "pictionary:clear", ...parsed.data });
  }

  @SubscribeMessage(ClientEvents.PICTIONARY_UNDO)
  async onPictionaryUndo(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const playerId = this.playerOf(client);
    if (!playerId) return reject("NOT_IN_ROOM", "No estás en una sala");
    const parsed = z.object({ requestId: RequestIdSchema }).safeParse(body);
    if (!parsed.success) return reject("INVALID", issue(parsed.error));
    return this.rooms.action(playerId, { kind: "pictionary:undo", ...parsed.data });
  }

  @SubscribeMessage(ClientEvents.PICTIONARY_FILL)
  async onPictionaryFill(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const playerId = this.playerOf(client);
    if (!playerId) return reject("NOT_IN_ROOM", "No estás en una sala");
    const parsed = PictionaryFillPayloadSchema.safeParse(body);
    if (!parsed.success) return reject("INVALID", issue(parsed.error));
    return this.rooms.action(playerId, { kind: "pictionary:fill", ...parsed.data });
  }

  @SubscribeMessage(ClientEvents.CARRERA_ANSWER)
  async onCarreraAnswer(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const playerId = this.playerOf(client);
    if (!playerId) return reject("NOT_IN_ROOM", "No estás en una sala");
    const parsed = CarreraAnswerPayloadSchema.safeParse(body);
    if (!parsed.success) return reject("INVALID", issue(parsed.error));
    return this.rooms.action(playerId, { kind: "carrera:answer", ...parsed.data });
  }

  @SubscribeMessage(ClientEvents.CARRERA_SONIDO_ANSWER)
  async onCarreraSonidoAnswer(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const playerId = this.playerOf(client);
    if (!playerId) return reject("NOT_IN_ROOM", "No estás en una sala");
    const parsed = CarreraAnswerPayloadSchema.safeParse(body);
    if (!parsed.success) return reject("INVALID", issue(parsed.error));
    return this.rooms.action(playerId, { kind: "carrera-sonido:answer", ...parsed.data });
  }

  @SubscribeMessage(ClientEvents.CARRERA_EMOJIS_ANSWER)
  async onCarreraEmojisAnswer(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const playerId = this.playerOf(client);
    if (!playerId) return reject("NOT_IN_ROOM", "No estás en una sala");
    const parsed = CarreraAnswerPayloadSchema.safeParse(body);
    if (!parsed.success) return reject("INVALID", issue(parsed.error));
    return this.rooms.action(playerId, { kind: "carrera-emojis:answer", ...parsed.data });
  }

  @SubscribeMessage(ClientEvents.IMITACION_SUBMIT)
  async onImitacionSubmit(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const playerId = this.playerOf(client);
    if (!playerId) return reject("NOT_IN_ROOM", "No estás en una sala");
    const parsed = ImitacionSubmitPayloadSchema.safeParse(body);
    if (!parsed.success) return reject("INVALID", issue(parsed.error));
    return this.rooms.action(playerId, { kind: "imitacion:submit", ...parsed.data });
  }

  @SubscribeMessage(ClientEvents.IMITACION_VOTE)
  async onImitacionVote(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const playerId = this.playerOf(client);
    if (!playerId) return reject("NOT_IN_ROOM", "No estás en una sala");
    const parsed = ImitacionVotePayloadSchema.safeParse(body);
    if (!parsed.success) return reject("INVALID", issue(parsed.error));
    return this.rooms.action(playerId, { kind: "imitacion:vote", ...parsed.data });
  }

  @SubscribeMessage(ClientEvents.PARTY_GUESS)
  async onPartyGuess(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const playerId = this.playerOf(client);
    if (!playerId) return reject("NOT_IN_ROOM", "No estás en una sala");
    const parsed = PartyGuessPayloadSchema.safeParse(body);
    if (!parsed.success) return reject("INVALID", issue(parsed.error));
    return this.rooms.action(playerId, { kind: "party:guess", ...parsed.data });
  }

  @SubscribeMessage(ClientEvents.QUIEN_SOY_GUESS)
  async onQuienSoyGuess(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const playerId = this.playerOf(client); if (!playerId) return reject("NOT_IN_ROOM", "No estás en una sala");
    const parsed = QuienSoyGuessPayloadSchema.safeParse(body); if (!parsed.success) return reject("INVALID", issue(parsed.error));
    return this.rooms.action(playerId, { kind: "quien-soy:guess", ...parsed.data });
  }

  /* ----------------------------- interno ----------------------------- */

  private playerOf(client: Socket): string | null {
    const playerId = client.data.playerId;
    return typeof playerId === "string" ? playerId : null;
  }

  private async attach(client: Socket, roomId: string, playerId: string, roomCode?: string, token?: string) {
    client.data.playerId = playerId;
    client.data.roomId = roomId;
    if (roomCode) client.data.roomCode = roomCode;
    if (token) client.data.token = token;
    await client.join(roomId);
    // La primera difusión ocurrió antes del join: reenviamos el snapshot.
    await this.rooms.refresh(roomId);
  }
}
