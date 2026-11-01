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
  UnicaSubmitPayloadSchema,
  CarreraAnswerPayloadSchema,
  DescripcionCluePayloadSchema,
  DescripcionGuessPayloadSchema,
  DuoSubmitPayloadSchema,
  PartyGuessPayloadSchema,
  QuienSoyQuestionPayloadSchema,
  QuienSoyAnswerPayloadSchema,
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

const ALLOWED_ORIGINS = (
  process.env.WEB_ORIGIN ?? "http://localhost:3000,http://127.0.0.1:3000"
).split(",");

const reject = (code: RejectCode, message: string): Reject => ({
  ok: false,
  code,
  message,
});

const issue = (error: z.ZodError): string =>
  error.issues[0]?.message ?? "Datos inválidos";

@WebSocketGateway({
  cors: { origin: ALLOWED_ORIGINS, credentials: false },
  maxHttpBufferSize: 100_000,
})
export class RoomGateway implements OnGatewayInit, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    @Inject(RoomService) private readonly rooms: RoomService,
    @Inject(BroadcastService) private readonly broadcast: BroadcastService,
  ) {}

  afterInit(server: Server) {
    this.broadcast.attach(server);
  }

  handleDisconnect(client: Socket) {
    void this.rooms.disconnectSocket(client.id);
  }

  /* ------------------------------ sesión ----------------------------- */

  @SubscribeMessage(ClientEvents.CREATE_ROOM)
  async onCreate(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const parsed = z.object({ nickname: NicknameSchema, avatarId: AvatarIdSchema.optional() }).safeParse(body);
    if (!parsed.success) return reject("INVALID", issue(parsed.error));

    const ack = await this.rooms.createRoom(
      parsed.data.nickname,
      parsed.data.avatarId,
      client.id,
      client.handshake.address,
    );
    if (ack.ok) await this.attach(client, ack.roomId, ack.playerId);
    return ack;
  }

  @SubscribeMessage(ClientEvents.JOIN_ROOM)
  async onJoin(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
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

    const ack = await this.rooms.joinRoom(
      parsed.data.code,
      parsed.data.nickname ?? null,
      parsed.data.token ?? null,
      parsed.data.avatarId,
      client.id,
      client.handshake.address,
    );
    if (ack.ok) await this.attach(client, ack.roomId, ack.playerId);
    return ack;
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
      const parsed = z.object({ mode: z.enum(["bomba", "impostor", "pictionary", "unica", "quien-soy", "carrera", "descripcion", "duo", "party"]).optional() }).safeParse(body ?? {});
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

  @SubscribeMessage(ClientEvents.UNICA_SUBMIT)
  async onUnicaSubmit(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const playerId = this.playerOf(client);
    if (!playerId) return reject("NOT_IN_ROOM", "No estás en una sala");
    const parsed = UnicaSubmitPayloadSchema.safeParse(body);
    if (!parsed.success) return reject("INVALID", issue(parsed.error));
    return this.rooms.action(playerId, { kind: "unica:submit", ...parsed.data });
  }

  @SubscribeMessage(ClientEvents.CARRERA_ANSWER)
  async onCarreraAnswer(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const playerId = this.playerOf(client);
    if (!playerId) return reject("NOT_IN_ROOM", "No estás en una sala");
    const parsed = CarreraAnswerPayloadSchema.safeParse(body);
    if (!parsed.success) return reject("INVALID", issue(parsed.error));
    return this.rooms.action(playerId, { kind: "carrera:answer", ...parsed.data });
  }

  @SubscribeMessage(ClientEvents.DESCRIPCION_CLUE)
  async onDescripcionClue(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const playerId = this.playerOf(client);
    if (!playerId) return reject("NOT_IN_ROOM", "No estás en una sala");
    const parsed = DescripcionCluePayloadSchema.safeParse(body);
    if (!parsed.success) return reject("INVALID", issue(parsed.error));
    return this.rooms.action(playerId, { kind: "descripcion:clue", ...parsed.data });
  }

  @SubscribeMessage(ClientEvents.DESCRIPCION_GUESS)
  async onDescripcionGuess(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const playerId = this.playerOf(client);
    if (!playerId) return reject("NOT_IN_ROOM", "No estás en una sala");
    const parsed = DescripcionGuessPayloadSchema.safeParse(body);
    if (!parsed.success) return reject("INVALID", issue(parsed.error));
    return this.rooms.action(playerId, { kind: "descripcion:guess", ...parsed.data });
  }

  @SubscribeMessage(ClientEvents.DUO_SUBMIT)
  async onDuoSubmit(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const playerId = this.playerOf(client);
    if (!playerId) return reject("NOT_IN_ROOM", "No estás en una sala");
    const parsed = DuoSubmitPayloadSchema.safeParse(body);
    if (!parsed.success) return reject("INVALID", issue(parsed.error));
    return this.rooms.action(playerId, { kind: "duo:submit", ...parsed.data });
  }

  @SubscribeMessage(ClientEvents.PARTY_GUESS)
  async onPartyGuess(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const playerId = this.playerOf(client);
    if (!playerId) return reject("NOT_IN_ROOM", "No estás en una sala");
    const parsed = PartyGuessPayloadSchema.safeParse(body);
    if (!parsed.success) return reject("INVALID", issue(parsed.error));
    return this.rooms.action(playerId, { kind: "party:guess", ...parsed.data });
  }

  @SubscribeMessage(ClientEvents.QUIEN_SOY_QUESTION)
  async onQuienSoyQuestion(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const playerId = this.playerOf(client); if (!playerId) return reject("NOT_IN_ROOM", "No estás en una sala");
    const parsed = QuienSoyQuestionPayloadSchema.safeParse(body); if (!parsed.success) return reject("INVALID", issue(parsed.error));
    return this.rooms.action(playerId, { kind: "quien-soy:question", ...parsed.data });
  }
  @SubscribeMessage(ClientEvents.QUIEN_SOY_ANSWER)
  async onQuienSoyAnswer(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const playerId = this.playerOf(client); if (!playerId) return reject("NOT_IN_ROOM", "No estás en una sala");
    const parsed = QuienSoyAnswerPayloadSchema.safeParse(body); if (!parsed.success) return reject("INVALID", issue(parsed.error));
    return this.rooms.action(playerId, { kind: "quien-soy:answer", ...parsed.data });
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

  private async attach(client: Socket, roomId: string, playerId: string) {
    client.data.playerId = playerId;
    client.data.roomId = roomId;
    await client.join(roomId);
    // La primera difusión ocurrió antes del join: reenviamos el snapshot.
    await this.rooms.refresh(roomId);
  }
}
