import { describe, expect, it } from "vitest";
import { createCarrera, carreraAnswer, carreraTick, carreraEmojisAnswer, carreraEmojisTick, createRng, type CarreraEmojisState } from "@lolgames/engine";
import {
  DEFAULT_BOMBA_SETTINGS, DEFAULT_IMPOSTOR_SETTINGS, DEFAULT_PICTIONARY_SETTINGS,
  DEFAULT_QUIEN_SOY_SETTINGS, DEFAULT_CARRERA_SETTINGS, DEFAULT_CARRERA_SONIDO_SETTINGS,
  DEFAULT_CARRERA_EMOJIS_SETTINGS, DEFAULT_IMITACION_SETTINGS, DEFAULT_PARTY_SETTINGS,
} from "@lolgames/protocol";
import { RoomService } from "./room.service";
import type { Room } from "./types";
import { RoomRepository, SessionRepository, RateLimiter, Clock } from "../ports";
import { ContentService } from "../content/content.service";
import { BroadcastService } from "../gateway/broadcast.service";

const champions = { Ahri: { id: "Ahri", name: "Ahri", imageUrl: "" } };
const clues = [{ clueId: "a", championId: "Ahri", kind: "spell" as const, imageUrl: "" }];
const players = ["p1", "p2", "p3"].map((id, seq) => ({
  id, name: id, nameKey: id, avatar: { id: "avatar", imageUrl: "" }, seq,
  connected: true, ready: true, socketId: id, disconnectedAt: null, token: id, recentRequests: [],
}));

describe("marcador de la sala", () => {
  it("muestra el podio 5 segundos entre modos sin duplicar puntos", async () => {
    let now = 0;
    const emojiClues = [{ clueId: "e", championId: "Ahri", emojis: ["🦊", "✨", "💗", "🔥"] }];
    let savedRoom: Room | null = null;
    const repo = {
      get: async () => savedRoom,
      listIds: async () => ["r"],
      save: async (room: Room) => { savedRoom = room; },
    } as unknown as RoomRepository;
    const service = new RoomService(
      repo, {} as SessionRepository, { hit: async () => true } as unknown as RateLimiter,
      { now: () => now } as Clock,
      { championInfo: champions, clues, emojiClues } as unknown as ContentService,
      { toRoom: () => {}, toPlayer: () => {} } as unknown as BroadcastService,
    );
    const rng = createRng(1);
    const ctx = (time: number) => ({ now: time, rng, clues });
    let game = createCarrera({ playerIds: ["p1", "p2", "p3"], settings: { clueSeconds: 5, rounds: 1 }, champions, clues, now, rng });
    game = carreraAnswer(game, "p1", "Ahri", ctx(1)).state;
    game = carreraAnswer(game, "p2", "Ahri", ctx(2)).state;
    const room: Room = {
      id: "r", code: "ABC123", createdAt: 0, lastActivityAt: 0, hostId: "p1",
      players, mode: "carrera", phase: "PLAYING", stateVersion: 1, game, partyModes: ["carrera-emojis"], partyBreak: null, partyHistory: [],
      settings: {
        bomba: DEFAULT_BOMBA_SETTINGS, impostor: DEFAULT_IMPOSTOR_SETTINGS,
        pictionary: DEFAULT_PICTIONARY_SETTINGS, quienSoy: DEFAULT_QUIEN_SOY_SETTINGS,
        carrera: DEFAULT_CARRERA_SETTINGS, carreraSonido: DEFAULT_CARRERA_SONIDO_SETTINGS,
        carreraEmojis: { ...DEFAULT_CARRERA_EMOJIS_SETTINGS, rounds: 1 }, imitacion: DEFAULT_IMITACION_SETTINGS,
        party: DEFAULT_PARTY_SETTINGS,
      },
      scores: { p1: 200, p2: 0, p3: 0 }, impostorRoundOffset: 0,
    };
    savedRoom = room;
    service["playerIndex"].set("p1", "r");
    const view = service["buildRoomView"](room, now);
    expect(view.players.map((p) => p.score)).toEqual([1200, 900, 0]);
    expect(room.scores).toEqual({ p1: 200, p2: 0, p3: 0 });

    now = 5_000;
    game = carreraTick(game, ctx(now)).state;
    now = 11_000;
    room.game = carreraTick(game, ctx(now)).state;
    expect(service["syncPhase"](room)).toBe(true);
    expect(room.phase).toBe("PARTY_BREAK");
    expect(room.mode).toBe("party");
    expect(room.game).toBeNull();
    expect(room.partyBreak).toEqual({
      nextMode: "carrera-emojis",
      endsAt: 16_000,
      endedMode: "carrera",
      modeScores: { p1: 1000, p2: 900, p3: 0 },
      modeNumber: 1,
      totalModes: 2,
    });
    expect(room.scores).toEqual({ p1: 1200, p2: 900, p3: 0 });
    expect(room.partyHistory).toEqual([{ mode: "carrera", scores: { p1: 1000, p2: 900, p3: 0 } }]);
    const breakView = service["buildRoomView"](room, now);
    expect(breakView.players.map((p) => p.score)).toEqual([1200, 900, 0]);
    expect(breakView.partyBreak).toEqual({
      nextMode: "carrera-emojis",
      endsAt: 16_000,
      endedMode: "carrera",
      modeScores: { p1: 1000, p2: 900, p3: 0 },
      modeNumber: 1,
      totalModes: 2,
    });
    expect(service["syncPhase"](room)).toBe(false);
    expect(room.scores).toEqual({ p1: 1200, p2: 900, p3: 0 });
    expect((await service.action("p1", { kind: "carrera:answer", requestId: "during-break", championId: "Ahri" })).ok).toBe(false);
    now = 15_999;
    await service["tick"]();
    expect(room.phase).toBe("PARTY_BREAK");
    now = 16_000;
    await service["tick"]();
    expect(room.phase).toBe("PLAYING");
    expect(room.mode).toBe("carrera-emojis");
    expect(room.partyBreak).toBeNull();
    expect(room.scores).toEqual({ p1: 1200, p2: 900, p3: 0 });

    const emojiCtx = (time: number) => ({ now: time, rng, clues: emojiClues });
    let emojiGame = room.game as unknown as CarreraEmojisState;
    emojiGame = carreraEmojisAnswer(emojiGame, "p3", "Ahri", emojiCtx(16_001)).state;
    emojiGame = carreraEmojisAnswer(emojiGame, "p1", "Ahri", emojiCtx(16_002)).state;
    emojiGame = carreraEmojisAnswer(emojiGame, "p2", "Ahri", emojiCtx(16_003)).state;
    expect(emojiGame.phase).toBe("REVEAL");
    room.game = carreraEmojisTick(emojiGame, emojiCtx(22_003)).state;
    now = 22_003;
    expect(service["syncPhase"](room)).toBe(true);
    expect(room.mode).toBe("party");
    expect(room.phase).toBe("FINISHED");
    expect(room.partyBreak).toBeNull();
    expect(room.scores).toEqual({ p1: 2100, p2: 1700, p3: 1000 });
    expect(room.partyHistory).toEqual([
      { mode: "carrera", scores: { p1: 1000, p2: 900, p3: 0 } },
      { mode: "carrera-emojis", scores: { p1: 900, p2: 800, p3: 1000 } },
    ]);
    const finalView = service["buildRoomView"](room, now);
    expect(finalView.players.map((p) => p.score)).toEqual([2100, 1700, 1000]);
    expect(finalView.partyHistory).toEqual(room.partyHistory);
  });
});
