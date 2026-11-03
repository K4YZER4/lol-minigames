import type { Result, Rng } from "../core/rng";

export type CarreraClue = { clueId: string; championId: string; kind: "spell" | "passive"; imageUrl: string };
export type CarreraSettings = { clueSeconds: number; rounds: number };
export type CarreraState = {
  phase: "CLUES" | "REVEAL" | "FINISHED";
  settings: CarreraSettings;
  players: string[];
  round: number;
  targetId: string;
  champions: Record<string, { id: string; name: string; imageUrl: string }>;
  clues: CarreraClue[];
  clueIndex: number;
  answers: Record<string, string>;
  winnerId: string | null;
  phaseEndsAt: number;
};
export type CarreraInit = { playerIds: string[]; settings: CarreraSettings; champions: Record<string, { id: string; name: string; imageUrl: string }>; clues: CarreraClue[]; now: number; rng: Rng };
export type CarreraContext = { now: number; rng: Rng; clues: CarreraClue[] };
const fail = (code: string, message: string) => ({ code, message });

function choose(init: CarreraInit, now: number, round: number): CarreraState {
  const available = [...new Set(init.clues.map((clue) => clue.championId))].filter((id) => init.champions[id]);
  const targetId = init.rng.pick(available.length ? available : Object.keys(init.champions));
  const clues = init.clues.filter((clue) => clue.championId === targetId).slice(0, 4);
  return { phase: "CLUES", settings: init.settings, players: [...init.playerIds], round, targetId, champions: init.champions, clues, clueIndex: 0, answers: {}, winnerId: null, phaseEndsAt: now + init.settings.clueSeconds * 1000 };
}
export function createCarrera(init: CarreraInit): CarreraState { return choose(init, init.now, 0); }

export function carreraAnswer(state: CarreraState, playerId: string, championId: string, ctx: CarreraContext): Result<CarreraState> {
  if (state.phase !== "CLUES") return { state, effects: [], reject: fail("WRONG_PHASE", "La ronda ya terminó") };
  if (!state.players.includes(playerId)) return { state, effects: [], reject: fail("NOT_IN_ROOM", "No estás en esta partida") };
  if (state.answers[playerId]) return { state, effects: [], reject: fail("ALREADY_ANSWERED", "Ya respondiste esta ronda") };
  if (!ctx.clues.some((clue) => clue.championId === championId)) return { state, effects: [], reject: fail("UNKNOWN_CHAMPION", "Ese campeón no existe") };
  const answers = { ...state.answers, [playerId]: championId };
  if (championId !== state.targetId) return { state: { ...state, answers }, effects: [], reject: fail("WRONG_ANSWER", "No es ese campeón") };
  return { state: { ...state, answers, winnerId: playerId, phase: "REVEAL", phaseEndsAt: ctx.now + 6_000 }, effects: [{ type: "carrera:correct", playerId }] };
}

export function carreraTick(state: CarreraState, ctx: CarreraContext): Result<CarreraState> {
  if (ctx.now < state.phaseEndsAt) return { state, effects: [] };
  if (state.phase === "CLUES") {
    if (state.clueIndex + 1 < state.clues.length) return { state: { ...state, clueIndex: state.clueIndex + 1, phaseEndsAt: ctx.now + state.settings.clueSeconds * 1000 }, effects: [] };
    return { state: { ...state, phase: "REVEAL", phaseEndsAt: ctx.now + 6_000 }, effects: [] };
  }
  if (state.phase === "REVEAL" && state.round + 1 >= state.settings.rounds) return { state: { ...state, phase: "FINISHED", phaseEndsAt: ctx.now }, effects: [] };
  if (state.phase === "REVEAL") {
    const init = { playerIds: state.players, settings: state.settings, champions: state.champions, clues: ctx.clues, now: ctx.now, rng: ctx.rng };
    return { state: choose(init, ctx.now, state.round + 1), effects: [] };
  }
  return { state, effects: [] };
}

export function carreraPublicView(state: CarreraState, now: number) {
  return { mode: "carrera" as const, phase: state.phase, phaseEndsAt: state.phaseEndsAt, round: state.round, totalRounds: state.settings.rounds, clueIndex: state.clueIndex, clues: state.clues.slice(0, state.clueIndex + 1).map(({ clueId, kind, imageUrl }) => ({ clueId, kind, imageUrl })), winnerId: state.winnerId, target: state.phase === "REVEAL" || state.phase === "FINISHED" ? state.champions[state.targetId] ?? null : null, serverTime: now };
}
export function carreraPrivateView(state: CarreraState, playerId: string) { return { mode: "carrera" as const, hasAnswered: Boolean(state.answers[playerId]), answer: state.answers[playerId] ?? null }; }
export function carreraResults(state: CarreraState) { const scores: Record<string, number> = {}; for (const id of state.players) scores[id] = state.winnerId === id ? 1 : 0; return { scores }; }
