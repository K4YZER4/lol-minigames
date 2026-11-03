import {
  Injectable,
  Inject,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { randomBytes, randomUUID } from "node:crypto";
import {
  DEFAULT_BOMBA_SETTINGS,
  DEFAULT_IMPOSTOR_SETTINGS,
  DEFAULT_PICTIONARY_SETTINGS,
  DEFAULT_QUIEN_SOY_SETTINGS,
  DEFAULT_CARRERA_SETTINGS,
  DEFAULT_DESCRIPCION_SETTINGS,
  DEFAULT_DUO_SETTINGS,
  DEFAULT_PARTY_SETTINGS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  RECONNECT_GRACE_MS,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  ServerEvents,
  type BombaSettings,
  type ImpostorSettings,
  type PictionarySettings,
  type QuienSoySettings,
  type CarreraSettings,
  type DescripcionSettings,
  type DuoSettings,
  type PartySettings,
  type JoinAck,
  type ModeId,
  type PlayerView,
  type PrivateView,
  type Reject,
  type RejectCode,
  type RoomView,
  type SettingsPatch,
  type SimpleAck,
} from "@lolgames/protocol";
import {
  bombaAnswer,
  bombaPrivateView,
  bombaPublicView,
  bombaResults,
  bombaSkip,
  bombaTick,
  createBomba,
  createImpostor,
  createRng,
  impostorAck,
  impostorClue,
  impostorPrivateView,
  impostorPublicView,
  impostorResults,
  impostorTick,
  impostorVote,
  createPictionary,
  pictionaryGuess,
  pictionaryClear,
  pictionaryUndo,
  pictionaryFill,
  pictionaryPrivateView,
  pictionaryPublicView,
  pictionaryResults,
  pictionaryStroke,
  pictionaryTick,
  createQuienSoy,
  quienSoyGuess,
  quienSoyPrivateView,
  quienSoyPublicView,
  quienSoyResults,
  quienSoyTick,
  createCarrera,
  carreraAnswer,
  carreraPrivateView,
  carreraPublicView,
  carreraResults,
  carreraTick,
  createDescripcion,
  descripcionClue,
  descripcionGuess,
  descripcionPrivateView,
  descripcionPublicView,
  descripcionResults,
  descripcionTick,
  createDuo,
  duoPrivateView,
  duoPublicView,
  duoResults,
  duoSubmit,
  duoTick,
  createParty,
  partyGuess,
  partyPrivateView,
  partyPublicView,
  partyResults,
  partyTick,
  nameKey,
  type BombaState,
  type Effect,
  type ImpostorState,
  type PictionaryState,
  type QuienSoyState,
  type CarreraState,
  type DescripcionState,
  type DuoState,
  type PartyState,
  type Result,
} from "@lolgames/engine";
import { Clock, RateLimiter, RoomRepository, SessionRepository } from "../ports";
import { BroadcastService } from "../gateway/broadcast.service";
import { ContentService } from "../content/content.service";
import { withRoomLock } from "./lock";
import type { GameState, IncomingAction, Player, Room } from "./types";

/** Tras este tiempo desconectado, el turno se salta (la mecha sigue). */
const SKIP_AFTER_MS = 3_000;
/** Una sala sin nadie conectado se borra pasado este tiempo. */
const ROOM_IDLE_MS = 5 * 60_000;
const REQUEST_HISTORY = 50;
const TICK_MS = 250;

const reject = (code: RejectCode, message: string): Reject => ({
  ok: false,
  code,
  message,
});
const OK: SimpleAck = { ok: true };

@Injectable()
export class RoomService implements OnModuleInit, OnModuleDestroy {
  private readonly rng = createRng((Date.now() ^ 0x9e3779b9) >>> 0);
  private readonly socketIndex = new Map<string, { roomId: string; playerId: string }>();
  private readonly playerIndex = new Map<string, string>();
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(RoomRepository) private readonly repo: RoomRepository,
    @Inject(SessionRepository) private readonly sessions: SessionRepository,
    @Inject(RateLimiter) private readonly limiter: RateLimiter,
    @Inject(Clock) private readonly clock: Clock,
    @Inject(ContentService) private readonly content: ContentService,
    @Inject(BroadcastService) private readonly broadcast: BroadcastService,
  ) {}

  async createDevTestRoom(mode: ModeId, count: number): Promise<{ roomCode: string; playerId: string; token: string; nickname: string }> {
    const suffix = randomUUID();
    const hostSocket = `dev-host-${suffix}`;
    const host = await this.createRoom("Dev Host", undefined, hostSocket, "127.0.0.1");
    if (!host.ok) throw new Error(host.message);
    const players = [host];
    for (let index = 1; index < count; index++) {
      const joined = await this.joinRoom(host.roomCode, `Dev Player ${index + 1}`, null, undefined, `dev-player-${index}-${suffix}`, "127.0.0.1");
      if (joined.ok) players.push(joined);
    }
    await this.configure(host.playerId, { mode });
    for (const player of players) await this.setReady(player.playerId, true);
    const started = await this.startSession(host.playerId);
    if (!started.ok) throw new Error(started.message);
    return { roomCode: host.roomCode, playerId: host.playerId, token: host.token, nickname: "Dev Host" };
  }

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.tick().catch((error) => console.error("[tick]", error));
    }, TICK_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /* ------------------------------------------------------------------ */
  /* Entrada a la sala                                                   */
  /* ------------------------------------------------------------------ */

  async createRoom(nickname: string, avatarId: string | undefined, socketId: string, ip: string): Promise<JoinAck> {
    if (!(await this.limiter.hit(`create:${ip}`, 60_000, 10))) {
      return reject("RATE_LIMITED", "Demasiadas salas seguidas, espera un minuto");
    }

    const now = this.clock.now();
    const player = this.makePlayer(nickname, socketId, 0, this.pickAvatar([], avatarId));
    player.token = await this.sessions.issue(player.id);

    const room: Room = {
      id: randomUUID(),
      code: await this.generateCode(),
      createdAt: now,
      lastActivityAt: now,
      players: [player],
      hostId: player.id,
      mode: "bomba",
      phase: "LOBBY",
      stateVersion: 1,
      game: null,
      settings: {
        bomba: { ...DEFAULT_BOMBA_SETTINGS },
        impostor: { ...DEFAULT_IMPOSTOR_SETTINGS },
        pictionary: { ...DEFAULT_PICTIONARY_SETTINGS },
        quienSoy: { ...DEFAULT_QUIEN_SOY_SETTINGS },
        carrera: { ...DEFAULT_CARRERA_SETTINGS },
        descripcion: { ...DEFAULT_DESCRIPCION_SETTINGS },
        duo: { ...DEFAULT_DUO_SETTINGS },
        party: { ...DEFAULT_PARTY_SETTINGS },
      },
      scores: { [player.id]: 0 },
      impostorRoundOffset: 0,
    };

    await this.repo.save(room);
    this.indexPlayer(room.id, player, socketId);
    this.broadcast.bind(player.id, socketId);

    return {
      ok: true,
      playerId: player.id,
      token: player.token,
      roomCode: room.code,
      roomId: room.id,
    };
  }

  async joinRoom(
    code: string,
    nickname: string | null,
    token: string | null,
    avatarId: string | undefined,
    socketId: string,
    ip: string,
  ): Promise<JoinAck> {
    if (!(await this.limiter.hit(`join:${ip}`, 60_000, 30))) {
      return reject("RATE_LIMITED", "Demasiados intentos, espera un momento");
    }

    const found = await this.repo.getByCode(code);
    if (!found) return reject("ROOM_NOT_FOUND", "Esa sala no existe o ya cerró");

    return withRoomLock(found.id, async () => {
      const room = await this.repo.get(found.id);
      if (!room) return reject("ROOM_NOT_FOUND", "Esa sala no existe o ya cerró");

      const now = this.clock.now();

      // 1. Reconexión: el token manda sobre el apodo.
      if (token) {
        const playerId = await this.sessions.resolve(token);
        const player = playerId ? room.players.find((p) => p.id === playerId) : undefined;
        if (player) {
          this.bindPlayer(room, player, socketId, now);
          room.lastActivityAt = now;
          room.stateVersion++;
          await this.repo.save(room);
          this.publish(room);
          return {
            ok: true,
            playerId: player.id,
            token: player.token,
            roomCode: room.code,
            roomId: room.id,
          };
        }
      }

      // 2. Entrada nueva.
      if (!nickname) return reject("INVALID", "Necesitas un apodo para entrar");
      if (room.phase !== "LOBBY") {
        return reject("ROOM_STARTED", "La partida ya empezó");
      }
      if (room.players.length >= MAX_PLAYERS) {
        return reject("ROOM_FULL", "La sala está llena");
      }

      const key = nameKey(nickname);
      if (room.players.some((p) => p.nameKey === key)) {
        return reject("NAME_TAKEN", "Ese apodo ya está en uso en esta sala");
      }

       const player = this.makePlayer(
         nickname,
         socketId,
         room.players.length,
         this.pickAvatar(room.players, avatarId),
       );
      player.token = await this.sessions.issue(player.id);
      room.players.push(player);
      room.scores[player.id] = 0;
      room.lastActivityAt = now;
      room.stateVersion++;
       this.electHost(room);
      this.indexPlayer(room.id, player, socketId);
      this.broadcast.bind(player.id, socketId);

      await this.repo.save(room);
      this.publish(room);

      return {
        ok: true,
        playerId: player.id,
        token: player.token,
        roomCode: room.code,
        roomId: room.id,
      };
    });
  }

  /* ------------------------------------------------------------------ */
  /* Lobby                                                               */
  /* ------------------------------------------------------------------ */

  async leave(playerId: string): Promise<SimpleAck> {
    const roomId = this.playerIndex.get(playerId);
    if (!roomId) return OK;

    return withRoomLock(roomId, async () => {
      const room = await this.repo.get(roomId);
      if (!room) return OK;
      const player = room.players.find((p) => p.id === playerId);
      if (!player) return OK;

      await this.sessions.revoke(player.token);
      this.unindexPlayer(player);

      if (room.phase === "LOBBY") {
        room.players = room.players.filter((p) => p.id !== playerId);
        delete room.scores[playerId];
      } else {
        player.connected = false;
        player.disconnectedAt = this.clock.now();
        player.socketId = null;
      }

      room.lastActivityAt = this.clock.now();
      room.stateVersion++;
       this.electHost(room, this.clock.now(), true);

      if (room.players.length === 0) {
        await this.repo.delete(room.id);
        return OK;
      }

      await this.repo.save(room);
      this.publish(room);
      return OK;
    });
  }

  /** Vuelve al lobby al terminar una partida. Solo el anfitrión. */
  async resetSession(playerId: string, nextMode?: ModeId): Promise<SimpleAck> {
    const roomId = this.playerIndex.get(playerId);
    if (!roomId) return reject("NOT_IN_ROOM", "No estás en una sala");

    return withRoomLock(roomId, async () => {
      const room = await this.repo.get(roomId);
      if (!room) return reject("NOT_IN_ROOM", "La sala ya no existe");
      if (room.hostId !== playerId) {
        return reject("NOT_HOST", "Solo el anfitrión puede empezar otra partida");
      }
      if (room.phase !== "FINISHED") {
        return reject("WRONG_PHASE", "La partida todavía está en curso");
      }

      const gone = room.players.filter((p) => !p.connected);
      room.players = room.players.filter((p) => p.connected);
      for (const player of gone) this.unindexPlayer(player);

      room.phase = "LOBBY";
      room.game = null;
      if (nextMode) room.mode = nextMode;
      room.scores = {};
      for (const player of room.players) {
        player.ready = false;
        player.recentRequests = [];
      }

      room.lastActivityAt = this.clock.now();
      room.stateVersion++;
      this.electHost(room);
      await this.repo.save(room);
      this.publish(room);
      return OK;
    });
  }

  async setReady(playerId: string, ready: boolean): Promise<SimpleAck> {
    const roomId = this.playerIndex.get(playerId);
    if (!roomId) return reject("NOT_IN_ROOM", "No estás en una sala");

    return withRoomLock(roomId, async () => {
      const room = await this.repo.get(roomId);
      const player = room?.players.find((p) => p.id === playerId);
      if (!room || !player) return reject("NOT_IN_ROOM", "No estás en esta sala");

      player.ready = ready;
      room.lastActivityAt = this.clock.now();
      room.stateVersion++;
      await this.repo.save(room);
      this.publish(room);
      return OK;
    });
  }

  async configure(playerId: string, patch: SettingsPatch): Promise<SimpleAck> {
    const roomId = this.playerIndex.get(playerId);
    if (!roomId) return reject("NOT_IN_ROOM", "No estás en una sala");

    return withRoomLock(roomId, async () => {
      const room = await this.repo.get(roomId);
      if (!room) return reject("NOT_IN_ROOM", "La sala ya no existe");
      if (room.hostId !== playerId) return reject("NOT_HOST", "Solo el anfitrión configura");
      if (room.phase !== "LOBBY") return reject("ROOM_STARTED", "La partida ya empezó");

      if (patch.mode) room.mode = patch.mode;

      if (patch.bomba) {
        const merged: BombaSettings = { ...room.settings.bomba, ...patch.bomba };
        if (merged.minFuseMs > merged.maxFuseMs) {
          return reject("INVALID", "La mecha mínima no puede superar a la máxima");
        }
        room.settings.bomba = merged;
      }

      if (patch.impostor) {
        const merged: ImpostorSettings = { ...room.settings.impostor, ...patch.impostor };
        room.settings.impostor = merged;
      }

      if (patch.pictionary) {
        room.settings.pictionary = { ...room.settings.pictionary, ...patch.pictionary };
      }
      if (patch.quienSoy) room.settings.quienSoy = { ...room.settings.quienSoy, ...patch.quienSoy };
      if (patch.carrera) room.settings.carrera = { ...room.settings.carrera, ...patch.carrera };
      if (patch.descripcion) room.settings.descripcion = { ...room.settings.descripcion, ...patch.descripcion };
      if (patch.duo) room.settings.duo = { ...room.settings.duo, ...patch.duo };
      if (patch.party) room.settings.party = { ...room.settings.party, ...patch.party };

      room.lastActivityAt = this.clock.now();
      room.stateVersion++;
      await this.repo.save(room);
      this.publish(room);
      return OK;
    });
  }

  async startSession(playerId: string): Promise<SimpleAck> {
    const roomId = this.playerIndex.get(playerId);
    if (!roomId) return reject("NOT_IN_ROOM", "No estás en una sala");

    return withRoomLock(roomId, async () => {
      const room = await this.repo.get(roomId);
      if (!room) return reject("NOT_IN_ROOM", "La sala ya no existe");
      if (room.hostId !== playerId) return reject("NOT_HOST", "Solo el anfitrión inicia");
      if (room.phase !== "LOBBY") return reject("ROOM_STARTED", "La partida ya empezó");

      const connected = room.players.filter((p) => p.connected);
      if (connected.length < MIN_PLAYERS) {
        return reject(
          "NOT_ENOUGH_PLAYERS",
          `Hacen falta al menos ${MIN_PLAYERS} jugadores conectados`,
        );
      }
      if (connected.some((p) => !p.ready)) {
        return reject("INVALID", "Todos deben marcarse como listos");
      }
      if (room.mode === "party" && room.settings.party.category === "audio") {
        return reject("INVALID_CATEGORY", "La categoría de audio requiere un proveedor de audio configurado");
      }

      const now = this.clock.now();
       const connectedIds = connected.map((p) => p.id);
       let ids = connectedIds;
       if (room.mode === "impostor" && connectedIds.length > 0) {
         const offset = room.impostorRoundOffset % connectedIds.length;
         ids = connectedIds.slice(offset).concat(connectedIds.slice(0, offset));
         room.impostorRoundOffset = (offset + 1) % connectedIds.length;
       }

      room.game =
        room.mode === "bomba"
          ? createBomba({
              playerIds: ids,
              settings: room.settings.bomba,
              clues: this.content.clues,
              now,
              rng: this.rng,
            })
          : room.mode === "impostor"
            ? createImpostor({
              playerIds: ids,
              settings: room.settings.impostor,
              pairs: this.content.pairs,
              champions: this.content.championInfo,
              now,
              rng: this.rng,
              })
            : room.mode === "pictionary"
              ? createPictionary({
                playerIds: ids,
                settings: room.settings.pictionary,
                champions: this.content.championInfo,
                now,
                rng: this.rng,
              })
                : room.mode === "quien-soy"
                ? createQuienSoy({
                 playerIds: ids,
                 settings: room.settings.quienSoy,
                 champions: this.content.championInfo,
                 now,
                 rng: this.rng,
                })
                : room.mode === "carrera"
                ? createCarrera({ playerIds: ids, settings: room.settings.carrera, champions: this.content.championInfo, clues: this.content.clues, now, rng: this.rng })
                : room.mode === "descripcion"
                ? createDescripcion({ playerIds: ids, settings: room.settings.descripcion, champions: this.content.championInfo, now, rng: this.rng })
                 : room.mode === "duo"
                   ? createDuo({ playerIds: ids, settings: room.settings.duo, champions: this.content.unicaChampionInfo, now, rng: this.rng })
                   : createParty({ playerIds: ids, settings: room.settings.party, champions: this.content.unicaChampionInfo, now, rng: this.rng });

      room.phase = "PLAYING";
      room.lastActivityAt = now;
      room.stateVersion++;
      await this.repo.save(room);
      this.publish(room);
      return OK;
    });
  }

  /* ------------------------------------------------------------------ */
  /* Acciones de juego                                                   */
  /* ------------------------------------------------------------------ */

  async action(playerId: string, action: IncomingAction): Promise<SimpleAck> {
    const roomId = this.playerIndex.get(playerId);
    if (!roomId) return reject("NOT_IN_ROOM", "No estás en una sala");

    if (!(await this.limiter.hit(`action:${playerId}`, 10_000, 40))) {
      return reject("RATE_LIMITED", "Vas demasiado rápido");
    }

    return withRoomLock(roomId, async () => {
      const room = await this.repo.get(roomId);
      if (!room) return reject("NOT_IN_ROOM", "La sala ya no existe");

      const player = room.players.find((p) => p.id === playerId);
      if (!player) return reject("NOT_IN_ROOM", "No estás en esta sala");

      // Idempotencia: un reintento con el mismo requestId no se aplica dos veces.
      if (player.recentRequests.includes(action.requestId)) return OK;
      player.recentRequests.push(action.requestId);
      if (player.recentRequests.length > REQUEST_HISTORY) player.recentRequests.shift();

      const result = this.dispatch(room, playerId, action);
      if (!result) return reject("INVALID", "Acción no reconocida");

      let changed = false;
      if (result.state !== room.game) {
        room.game = result.state;
        room.stateVersion++;
        changed = true;
      }
      if (this.syncPhase(room)) changed = true;

      room.lastActivityAt = this.clock.now();
      await this.repo.save(room);

      if (changed) this.publish(room);
      for (const effect of result.effects) {
        this.broadcast.toRoom(room.id, ServerEvents.EFFECT, effect);
      }

      if (result.reject) {
        return reject(result.reject.code as RejectCode, result.reject.message);
      }
      return OK;
    });
  }

  /* ------------------------------------------------------------------ */
  /* Desconexión                                                         */
  /* ------------------------------------------------------------------ */

  /** Reenvía el snapshot completo de una sala (lo usa el gateway tras un join). */
  async refresh(roomId: string): Promise<void> {
    const room = await this.repo.get(roomId);
    if (room) this.publish(room);
  }

  async disconnectSocket(socketId: string): Promise<void> {
    const ref = this.socketIndex.get(socketId);
    if (!ref) return;

    await withRoomLock(ref.roomId, async () => {
      const room = await this.repo.get(ref.roomId);
      this.socketIndex.delete(socketId);
      if (!room) return;

      const player = room.players.find((p) => p.id === ref.playerId);
      if (!player) return;

      // Otra pestaña ya tomó la identidad: esta desconexión es vieja.
      if (player.socketId !== socketId) return;

      player.connected = false;
      player.disconnectedAt = this.clock.now();
      player.socketId = null;
      player.ready = false;
      this.broadcast.unbind(player.id);
      // La desconexión del socket transfiere el control inmediatamente. Si el
      // antiguo host vuelve, se reconecta como jugador y no hace rebotar el rol.
      this.electHost(room, this.clock.now(), true);

      room.stateVersion++;
      await this.repo.save(room);
      this.publish(room);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Reloj del servidor                                                  */
  /* ------------------------------------------------------------------ */

  private async tick(): Promise<void> {
    const ids = await this.repo.listIds();
    const now = this.clock.now();

    for (const id of ids) {
      await withRoomLock(id, async () => {
        const room = await this.repo.get(id);
        if (!room) return;

         let changed = false;
         const effects: Effect[] = [];

         const previousHost = room.hostId;
         this.electHost(room, now);
         if (room.hostId !== previousHost) changed = true;

        if (room.phase === "LOBBY") {
          if (this.expireLobbyPlayers(room, now)) changed = true;
        } else if (room.phase === "PLAYING" && room.game) {
          if (room.mode === "bomba") {
            const skipped = this.skipStalledBomba(room, now);
            if (skipped) {
              room.game = skipped.state;
              room.stateVersion++;
              changed = true;
              effects.push(...skipped.effects);
            }
          }

          const result = this.tickEngine(room, now);
          if (result.state !== room.game) {
            room.game = result.state;
            room.stateVersion++;
            changed = true;
          }
          effects.push(...result.effects);
          if (this.syncPhase(room)) changed = true;
        }

        if (this.shouldReap(room, now)) {
          await this.repo.delete(room.id);
          return;
        }

        if (changed) {
          room.lastActivityAt = now;
          await this.repo.save(room);
          this.publish(room);
          for (const effect of effects) {
            this.broadcast.toRoom(room.id, ServerEvents.EFFECT, effect);
          }
        }
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Interno                                                             */
  /* ------------------------------------------------------------------ */

  private makePlayer(
    name: string,
    socketId: string,
    seq: number,
    avatar: { id: string; imageUrl: string },
  ): Player {
    return {
      id: randomUUID(),
      name,
      nameKey: nameKey(name),
      avatar,
      seq,
      connected: true,
      ready: false,
      socketId,
      disconnectedAt: null,
      token: "",
      recentRequests: [],
    };
  }

  private pickAvatar(players: Player[], requestedId?: string): { id: string; imageUrl: string } {
    const used = new Set(players.map((player) => player.avatar.id));
    const requested = this.content.avatars.find((avatar) => avatar.id === requestedId);
    if (requested && !used.has(requested.id)) return requested;
    return (
      this.content.avatars.find((avatar) => !used.has(avatar.id)) ??
      this.content.avatars[players.length % this.content.avatars.length]!
    );
  }

  private indexPlayer(roomId: string, player: Player, socketId: string) {
    this.socketIndex.set(socketId, { roomId, playerId: player.id });
    this.playerIndex.set(player.id, roomId);
  }

  private unindexPlayer(player: Player) {
    if (player.socketId) this.socketIndex.delete(player.socketId);
    this.playerIndex.delete(player.id);
    this.broadcast.unbind(player.id);
  }

  private bindPlayer(room: Room, player: Player, socketId: string, now: number) {
    if (player.socketId && player.socketId !== socketId) {
      this.socketIndex.delete(player.socketId);
    }
    player.socketId = socketId;
    player.connected = true;
    player.disconnectedAt = null;
    this.socketIndex.set(socketId, { roomId: room.id, playerId: player.id });
    this.playerIndex.set(player.id, room.id);
    this.broadcast.bind(player.id, socketId);
    this.electHost(room);
    void now;
  }

  /**
   * El host no rebota: si el actual sigue conectado, se queda.
   * Solo se transfiere al conectado más antiguo cuando hace falta.
   */
  private electHost(room: Room, now = this.clock.now(), force = false) {
    const current = room.players.find((p) => p.id === room.hostId);
    if (current?.connected) return;
    if (
      !force &&
      current?.disconnectedAt !== null &&
      current?.disconnectedAt !== undefined &&
      now - current.disconnectedAt < RECONNECT_GRACE_MS
    ) {
      return;
    }
    const next = room.players
      .filter((p) => p.connected)
      .sort((a, b) => a.seq - b.seq)[0];
    room.hostId = next?.id ?? null;
  }

  private async generateCode(): Promise<string> {
    for (let attempt = 0; attempt < 50; attempt++) {
      let code = "";
      const bytes = randomBytes(ROOM_CODE_LENGTH);
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        code += ROOM_CODE_ALPHABET[bytes[i]! % ROOM_CODE_ALPHABET.length];
      }
      if (!(await this.repo.getByCode(code))) return code;
    }
    throw new Error("No se pudo generar un código de sala libre");
  }

  private engineContext(now: number) {
    return {
      now,
      rng: this.rng,
      clues: this.content.clues,
      pairs: this.content.pairs,
      champions: this.content.unicaChampionInfo,
    };
  }

  private dispatch(
    room: Room,
    playerId: string,
    action: IncomingAction,
  ): Result<GameState> | null {
    if (!room.game) return null;
    const ctx = this.engineContext(this.clock.now());

    if (action.kind === "bomba:answer" && room.mode === "bomba") {
      if (!this.content.exists(action.championId)) {
        return {
          state: room.game,
          effects: [],
          reject: { code: "UNKNOWN_CHAMPION", message: "Ese campeón no existe" },
        };
      }
      return bombaAnswer(room.game as BombaState, playerId, action.championId, ctx);
    }

    if (room.mode === "pictionary") {
      switch (action.kind) {
        case "pictionary:stroke":
          return pictionaryStroke(room.game as PictionaryState, playerId, action.points);
        case "pictionary:guess":
          return pictionaryGuess(room.game as PictionaryState, playerId, action.championId, ctx);
        case "pictionary:clear":
          return pictionaryClear(room.game as PictionaryState, playerId);
        case "pictionary:undo":
          return pictionaryUndo(room.game as PictionaryState, playerId);
        case "pictionary:fill":
          return pictionaryFill(room.game as PictionaryState, playerId, action.x, action.y, action.color);
        default:
          return null;
      }
    }
    if (room.mode === "quien-soy") {
      const state = room.game as QuienSoyState;
      if (action.kind === "quien-soy:guess") return quienSoyGuess(state, playerId, action.championId, ctx);
      return null;
    }
    if (room.mode === "carrera") {
      if (action.kind === "carrera:answer") return carreraAnswer(room.game as CarreraState, playerId, action.championId, { now: this.clock.now(), rng: this.rng, clues: this.content.clues });
      return null;
    }
    if (room.mode === "descripcion") {
      if (action.kind === "descripcion:clue") return descripcionClue(room.game as DescripcionState, playerId, action.text);
      if (action.kind === "descripcion:guess") return descripcionGuess(room.game as DescripcionState, playerId, action.text, ctx);
      return null;
    }
    if (room.mode === "duo") {
      if (action.kind === "duo:submit") return duoSubmit(room.game as DuoState, playerId, action.championId);
      return null;
    }
    if (room.mode === "party") {
      if (action.kind === "party:guess") return partyGuess(room.game as PartyState, playerId, action.championId);
      return null;
    }
    if (room.mode !== "impostor") return null;
    const state = room.game as ImpostorState;

    switch (action.kind) {
      case "impostor:ack":
        return impostorAck(state, playerId, ctx);
      case "impostor:clue":
        return impostorClue(state, playerId, action.text, ctx);
      case "impostor:vote":
        return impostorVote(state, playerId, action.targetId, ctx);
      default:
        return null;
    }
    }

  private tickEngine(
    room: Room,
    now: number,
  ): Result<GameState> {
    const ctx = this.engineContext(now);
    if (room.mode === "bomba") return bombaTick(room.game as BombaState, ctx);
    if (room.mode === "impostor") return impostorTick(room.game as ImpostorState, ctx);
    if (room.mode === "pictionary") return pictionaryTick(room.game as PictionaryState, ctx);
    if (room.mode === "quien-soy") return quienSoyTick(room.game as QuienSoyState, ctx);
    if (room.mode === "carrera") return carreraTick(room.game as CarreraState, { now, rng: this.rng, clues: this.content.clues });
    if (room.mode === "descripcion") return descripcionTick(room.game as DescripcionState, { now, rng: this.rng, champions: this.content.championInfo });
     if (room.mode === "duo") return duoTick(room.game as DuoState, { now, champions: this.content.unicaChampionInfo });
     return partyTick(room.game as PartyState, { now, rng: this.rng, champions: this.content.unicaChampionInfo });
  }

  private skipStalledBomba(
    room: Room,
    now: number,
  ): Result<BombaState> | null {
    const state = room.game as BombaState;
    if (state.phase !== "ACTIVE") return null;
    const activeId = state.order[state.activeIndex];
    if (!activeId) return null;
    const player = room.players.find((p) => p.id === activeId);
    if (!player || player.connected || player.disconnectedAt === null) return null;
    if (now - player.disconnectedAt < SKIP_AFTER_MS) return null;
    return bombaSkip(state, activeId, this.engineContext(now));
  }

  private syncPhase(room: Room): boolean {
    if (!room.game) return false;
    const finished =
      room.mode === "bomba"
        ? (room.game as BombaState).phase === "FINISHED"
        : room.mode === "impostor"
          ? (room.game as ImpostorState).phase === "REVEAL"
          : room.mode === "pictionary"
            ? (room.game as PictionaryState).phase === "REVEAL" &&
              (room.game as PictionaryState).roundIndex + 1 >= (room.game as PictionaryState).settings.rounds
              : room.mode === "quien-soy"
                ? (room.game as QuienSoyState).phase === "REVEAL"
                   : room.mode === "carrera"
                     ? (room.game as CarreraState).phase === "FINISHED"
                      : room.mode === "descripcion"
                        ? (room.game as DescripcionState).phase === "REVEAL" &&
                          (room.game as DescripcionState).roundIndex + 1 >= (room.game as DescripcionState).order.length
                         : room.mode === "duo"
                           ? (room.game as DuoState).phase === "REVEAL"
                           : (room.game as PartyState).phase === "FINISHED";
    if (!finished || room.phase === "FINISHED") return false;

    room.phase = "FINISHED";
    const results =
      room.mode === "bomba"
        ? bombaResults(room.game as BombaState)
        : room.mode === "impostor"
          ? impostorResults(room.game as ImpostorState)
          : room.mode === "pictionary"
            ? pictionaryResults(room.game as PictionaryState)
            : room.mode === "quien-soy"
              ? quienSoyResults(room.game as QuienSoyState)
                 : room.mode === "carrera"
                   ? carreraResults(room.game as CarreraState)
                : room.mode === "descripcion"
                  ? descripcionResults(room.game as DescripcionState)
                   : room.mode === "duo"
                     ? duoResults(room.game as DuoState)
                     : partyResults(room.game as PartyState);
    for (const [id, score] of Object.entries(results.scores)) {
      room.scores[id] = (room.scores[id] ?? 0) + score;
    }
    return true;
  }

  private expireLobbyPlayers(room: Room, now: number): boolean {
    const expired = room.players.filter(
      (p) =>
        !p.connected &&
        p.disconnectedAt !== null &&
        now - p.disconnectedAt > RECONNECT_GRACE_MS,
    );
    if (expired.length === 0) return false;

    for (const player of expired) {
      void this.sessions.revoke(player.token);
      this.unindexPlayer(player);
      delete room.scores[player.id];
    }
    room.players = room.players.filter((p) => !expired.includes(p));
    room.stateVersion++;
    this.electHost(room);
    return true;
  }

  private shouldReap(room: Room, now: number): boolean {
    if (room.players.length === 0) return true;
    const anyoneConnected = room.players.some((p) => p.connected);
    return !anyoneConnected && now - room.lastActivityAt > ROOM_IDLE_MS;
  }

  /* ------------------------------------------------------------------ */
  /* Vistas                                                              */
  /* ------------------------------------------------------------------ */

  private publish(room: Room) {
    const now = this.clock.now();
    this.broadcast.toRoom(room.id, ServerEvents.STATE, this.buildRoomView(room, now));
    for (const player of room.players) {
      if (!player.connected) continue;
      this.broadcast.toPlayer(
        player.id,
        ServerEvents.PRIVATE,
        this.buildPrivateView(room, player.id),
      );
    }
  }

  private buildRoomView(room: Room, now: number): RoomView {
    const bomba = room.mode === "bomba" && room.game ? (room.game as BombaState) : null;

    const players: PlayerView[] = room.players.map((player) => ({
       playerId: player.id,
       name: player.name,
       avatar: player.avatar,
      connected: player.connected,
      ready: player.ready,
      isHost: room.hostId === player.id,
      lives: bomba ? (bomba.lives[player.id] ?? 0) : null,
      eliminated: bomba ? (bomba.lives[player.id] ?? 0) <= 0 : false,
      score: room.scores[player.id] ?? 0,
    }));

    let game: RoomView["game"] = null;
    if (room.game) {
      game =
        room.mode === "bomba"
          ? bombaPublicView(room.game as BombaState, now)
           : room.mode === "impostor"
             ? impostorPublicView(room.game as ImpostorState, now)
             : room.mode === "pictionary"
               ? pictionaryPublicView(room.game as PictionaryState, now)
                : room.mode === "quien-soy"
                     ? quienSoyPublicView(room.game as QuienSoyState)
                      : room.mode === "carrera"
                        ? carreraPublicView(room.game as CarreraState, now)
                        : room.mode === "descripcion"
                           ? descripcionPublicView(room.game as DescripcionState)
                           : room.mode === "duo"
                             ? duoPublicView(room.game as DuoState)
                             : partyPublicView(room.game as PartyState);
    }

    return {
      code: room.code,
      roomId: room.id,
      stateVersion: room.stateVersion,
      phase: room.phase,
      hostId: room.hostId,
      mode: room.mode,
      players,
      settings: room.settings,
      game,
      serverTime: now,
    };
  }

  private buildPrivateView(room: Room, playerId: string): PrivateView {
    if (!room.game) return null;
    if (room.mode === "bomba") {
      return bombaPrivateView(room.game as BombaState, playerId);
    }
    if (room.mode === "impostor") return impostorPrivateView(room.game as ImpostorState, playerId);
    if (room.mode === "pictionary") return pictionaryPrivateView(room.game as PictionaryState, playerId);
    if (room.mode === "quien-soy") return quienSoyPrivateView(room.game as QuienSoyState, playerId);
     if (room.mode === "carrera") return carreraPrivateView(room.game as CarreraState, playerId);
      if (room.mode === "descripcion") return descripcionPrivateView(room.game as DescripcionState, playerId);
      if (room.mode === "duo") return duoPrivateView(room.game as DuoState, playerId);
      return partyPrivateView(room.game as PartyState, playerId);
  }
}
