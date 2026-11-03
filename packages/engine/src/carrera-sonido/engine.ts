import type { Result, Rng } from "../core/rng";

export type CarreraSonidoClue = { clueId: string; championId: string; audioUrl: string };
export type CarreraSonidoSettings = { clueSeconds: number; rounds: number };
export type CarreraSonidoState = {
  phase: "CLUES" | "REVEAL" | "FINISHED";
  settings: CarreraSonidoSettings;
  players: string[];
  round: number;
  targetId: string;
  champions: Record<string, { id: string; name: string; imageUrl: string }>;
  clues: CarreraSonidoClue[];
  clueIndex: number;
  answers: Record<string, string>;
  winnerId: string | null;
  scores: Record<string, number>;
  phaseEndsAt: number;
};
export type CarreraSonidoInit = { playerIds: string[]; settings: CarreraSonidoSettings; champions: Record<string, { id: string; name: string; imageUrl: string }>; clues: CarreraSonidoClue[]; now: number; rng: Rng; scores?: Record<string, number> };
export type CarreraSonidoContext = { now: number; rng: Rng; clues: CarreraSonidoClue[] };
const fail = (code: string, message: string) => ({ code, message });

function choose(init: CarreraSonidoInit, now: number, round: number): CarreraSonidoState {
  const available = [...new Set(init.clues.map((clue) => clue.championId))].filter((id) => init.champions[id]);
  const targetId = init.rng.pick(available.length ? available : Object.keys(init.champions));
  const clues = init.clues.filter((clue) => clue.championId === targetId).slice(0, 5);
  const scores = { ...(init.scores ?? {}) };
  for (const playerId of init.playerIds) scores[playerId] ??= 0;
  return { phase: "CLUES", settings: init.settings, players: [...init.playerIds], round, targetId, champions: init.champions, clues, clueIndex: 0, answers: {}, winnerId: null, scores, phaseEndsAt: now + init.settings.clueSeconds * 1000 };
}

export function createCarreraSonido(init: CarreraSonidoInit): CarreraSonidoState { return choose(init, init.now, 0); }

export function carreraSonidoAnswer(state: CarreraSonidoState, playerId: string, championId: string, ctx: CarreraSonidoContext): Result<CarreraSonidoState> {
  if (state.phase !== "CLUES") return { state, effects: [], reject: fail("WRONG_PHASE", "La ronda ya terminó") };
  if (!state.players.includes(playerId)) return { state, effects: [], reject: fail("NOT_IN_ROOM", "No estás en esta partida") };
  if (state.answers[playerId]) return { state, effects: [], reject: fail("ALREADY_ANSWERED", "Ya respondiste esta ronda") };
  if (!ctx.clues.some((clue) => clue.championId === championId)) return { state, effects: [], reject: fail("UNKNOWN_CHAMPION", "Ese campeón no existe") };
  const answers = { ...state.answers, [playerId]: championId };
  if (championId !== state.targetId) return { state: { ...state, answers }, effects: [], reject: fail("WRONG_ANSWER", "No es ese campeón") };
  const scores = { ...state.scores, [playerId]: (state.scores[playerId] ?? 0) + Math.max(1, state.clues.length - state.clueIndex) };
  return { state: { ...state, answers, scores, winnerId: playerId, phase: "REVEAL", phaseEndsAt: ctx.now + 2_000 }, effects: [{ type: "carrera-sonido:correct", playerId }] };
}

export function carreraSonidoTick(state: CarreraSonidoState, ctx: CarreraSonidoContext): Result<CarreraSonidoState> {
  if (ctx.now < state.phaseEndsAt) return { state, effects: [] };
  if (state.phase === "CLUES") {
    if (state.clueIndex + 1 < state.clues.length) return { state: { ...state, clueIndex: state.clueIndex + 1, phaseEndsAt: ctx.now + state.settings.clueSeconds * 1000 }, effects: [] };
    return { state: { ...state, phase: "REVEAL", phaseEndsAt: ctx.now + 2_000 }, effects: [] };
  }
  if (state.phase === "REVEAL" && state.round + 1 >= state.settings.rounds) return { state: { ...state, phase: "FINISHED", phaseEndsAt: ctx.now }, effects: [] };
  if (state.phase === "REVEAL") return { state: choose({ playerIds: state.players, settings: state.settings, champions: state.champions, clues: ctx.clues, now: ctx.now, rng: ctx.rng, scores: state.scores }, ctx.now, state.round + 1), effects: [] };
  return { state, effects: [] };
}

export function carreraSonidoPublicView(state: CarreraSonidoState) {
  return { mode: "carrera-sonido" as const, phase: state.phase, phaseEndsAt: state.phaseEndsAt, round: state.round, totalRounds: state.settings.rounds, clueIndex: state.clueIndex, clues: state.clues.slice(0, state.clueIndex + 1).map(({ clueId, audioUrl }) => ({ clueId, audioUrl })), winnerId: state.winnerId, target: state.phase === "REVEAL" || state.phase === "FINISHED" ? state.champions[state.targetId] ?? null : null, scores: state.scores };
}
export function carreraSonidoPrivateView(state: CarreraSonidoState, playerId: string) { return { mode: "carrera-sonido" as const, hasAnswered: Boolean(state.answers[playerId]), answer: state.answers[playerId] ?? null }; }
export function carreraSonidoResults(state: CarreraSonidoState) { return { scores: state.scores }; }
