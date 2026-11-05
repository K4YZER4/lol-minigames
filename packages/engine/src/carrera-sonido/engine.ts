import type { Result, Rng } from "../core/rng";
import { raceScore } from "../core/race-score";

export type CarreraSonidoClue = { clueId: string; championId: string; audioUrl: string; audioUrlEn?: string };
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
  if (available.length === 0) throw new Error("No hay campeones con cinco pistas de audio");
  const targetId = init.rng.pick(available);
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
  const allAnswered = Object.keys(answers).length === state.players.length;
  if (championId !== state.targetId) {
    return {
      state: {
        ...state,
        answers,
        phase: allAnswered ? "REVEAL" : state.phase,
        phaseEndsAt: allAnswered ? ctx.now + 6_000 : state.phaseEndsAt,
      },
      effects: [{ type: "carrera-sonido:wrong", playerId }],
      reject: fail("WRONG_ANSWER", "No es ese campeón"),
    };
  }
  const earlier = Object.values(state.answers).filter((answer) => answer === state.targetId).length;
  const scores = { ...state.scores, [playerId]: (state.scores[playerId] ?? 0) + raceScore(state.clueIndex, earlier) };
  return { state: { ...state, answers, scores, winnerId: state.winnerId ?? playerId, phase: allAnswered ? "REVEAL" : "CLUES", phaseEndsAt: allAnswered ? ctx.now + 6_000 : state.phaseEndsAt }, effects: [{ type: "carrera-sonido:correct", playerId }] };
}

export function carreraSonidoTick(state: CarreraSonidoState, ctx: CarreraSonidoContext): Result<CarreraSonidoState> {
  if (ctx.now < state.phaseEndsAt) return { state, effects: [] };
  if (state.phase === "CLUES") {
    if (state.clueIndex + 1 < state.clues.length) return { state: { ...state, clueIndex: state.clueIndex + 1, phaseEndsAt: ctx.now + state.settings.clueSeconds * 1000 }, effects: [] };
    return { state: { ...state, phase: "REVEAL", phaseEndsAt: ctx.now + 6_000 }, effects: [] };
  }
  if (state.phase === "REVEAL" && state.round + 1 >= state.settings.rounds) return { state: { ...state, phase: "FINISHED", phaseEndsAt: ctx.now }, effects: [] };
  if (state.phase === "REVEAL") return { state: choose({ playerIds: state.players, settings: state.settings, champions: state.champions, clues: ctx.clues, now: ctx.now, rng: ctx.rng, scores: state.scores }, ctx.now, state.round + 1), effects: [] };
  return { state, effects: [] };
}

export function carreraSonidoPublicView(state: CarreraSonidoState) {
  return { mode: "carrera-sonido" as const, phase: state.phase, phaseEndsAt: state.phaseEndsAt, round: state.round, totalRounds: state.settings.rounds, clueIndex: state.clueIndex, clues: state.clues.slice(0, state.clueIndex + 1).map(({ clueId, audioUrl, audioUrlEn }) => ({ clueId, audioUrl, audioUrlEn })), winnerId: state.winnerId, target: state.phase === "REVEAL" || state.phase === "FINISHED" ? state.champions[state.targetId] ?? null : null, scores: state.scores };
}
export function carreraSonidoPrivateView(state: CarreraSonidoState, playerId: string) {
  const answer = state.answers[playerId] ?? null;
  return {
    mode: "carrera-sonido" as const,
    hasAnswered: Boolean(answer),
    answer,
    /** Solo para quien acertó: confirma el campeón sin revelarlo al resto. */
    revealedTarget: answer === state.targetId ? state.champions[state.targetId] ?? null : null,
  };
}
export function carreraSonidoResults(state: CarreraSonidoState) { return { scores: state.scores }; }
