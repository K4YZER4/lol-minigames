import type { Result, Rng } from "../core/rng";
import { raceScore } from "../core/race-score";

export type CarreraEmojisClue = { clueId: string; championId: string; emojis: string[] };
export type CarreraEmojisSettings = { clueSeconds: number; rounds: number };
export type CarreraEmojisState = {
  phase: "CLUES" | "REVEAL" | "FINISHED";
  settings: CarreraEmojisSettings;
  players: string[];
  round: number;
  targetId: string;
  champions: Record<string, { id: string; name: string; imageUrl: string }>;
  clues: CarreraEmojisClue;
  clueIndex: number;
  answers: Record<string, string>;
  winnerId: string | null;
  scores: Record<string, number>;
  phaseEndsAt: number;
};
export type CarreraEmojisInit = { playerIds: string[]; settings: CarreraEmojisSettings; champions: Record<string, { id: string; name: string; imageUrl: string }>; clues: CarreraEmojisClue[]; now: number; rng: Rng; scores?: Record<string, number> };
export type CarreraEmojisContext = { now: number; rng: Rng; clues: CarreraEmojisClue[] };
const fail = (code: string, message: string) => ({ code, message });

function choose(init: CarreraEmojisInit, now: number, round: number): CarreraEmojisState {
  const available = [...new Set(init.clues.map((clue) => clue.championId))].filter((id) => init.champions[id]);
  if (available.length === 0) throw new Error("No hay campeones con conjuntos de emojis válidos");
  const targetId = init.rng.pick(available);
  const options = init.clues.filter((clue) => clue.championId === targetId && clue.emojis.length === 4);
  if (options.length === 0) throw new Error("El campeón elegido no tiene cuatro emojis válidos");
  const clue = init.rng.pick(options);
  const scores = { ...(init.scores ?? {}) };
  for (const playerId of init.playerIds) scores[playerId] ??= 0;
  return { phase: "CLUES", settings: init.settings, players: [...init.playerIds], round, targetId, champions: init.champions, clues: clue, clueIndex: 0, answers: {}, winnerId: null, scores, phaseEndsAt: now + init.settings.clueSeconds * 1000 };
}

export function createCarreraEmojis(init: CarreraEmojisInit): CarreraEmojisState { return choose(init, init.now, 0); }

export function carreraEmojisAnswer(state: CarreraEmojisState, playerId: string, championId: string, ctx: CarreraEmojisContext): Result<CarreraEmojisState> {
  if (state.phase !== "CLUES") return { state, effects: [], reject: fail("WRONG_PHASE", "La ronda ya terminó") };
  if (!state.players.includes(playerId)) return { state, effects: [], reject: fail("NOT_IN_ROOM", "No estás en esta partida") };
  if (state.answers[playerId]) return { state, effects: [], reject: fail("ALREADY_ANSWERED", "Ya respondiste esta ronda") };
  if (!ctx.clues.some((clue) => clue.championId === championId)) return { state, effects: [], reject: fail("UNKNOWN_CHAMPION", "Ese campeón no existe") };
  const answers = { ...state.answers, [playerId]: championId };
  if (championId !== state.targetId) return { state: { ...state, answers }, effects: [{ type: "carrera-emojis:wrong", playerId }], reject: fail("WRONG_ANSWER", "No es ese campeón") };
  const earlier = Object.values(state.answers).filter((answer) => answer === state.targetId).length;
  const scores = { ...state.scores, [playerId]: (state.scores[playerId] ?? 0) + raceScore(state.clueIndex, earlier) };
  const allAnswered = Object.keys(answers).length === state.players.length;
  return { state: { ...state, answers, scores, winnerId: state.winnerId ?? playerId, phase: allAnswered ? "REVEAL" : "CLUES", phaseEndsAt: allAnswered ? ctx.now + 6_000 : state.phaseEndsAt }, effects: [{ type: "carrera-emojis:correct", playerId }] };
}

export function carreraEmojisTick(state: CarreraEmojisState, ctx: CarreraEmojisContext): Result<CarreraEmojisState> {
  if (ctx.now < state.phaseEndsAt) return { state, effects: [] };
  if (state.phase === "CLUES") {
    if (state.clueIndex < 3) return { state: { ...state, clueIndex: state.clueIndex + 1, phaseEndsAt: ctx.now + state.settings.clueSeconds * 1000 }, effects: [{ type: "carrera-emojis:new-clue", clueIndex: state.clueIndex + 1 }] };
    return { state: { ...state, phase: "REVEAL", phaseEndsAt: ctx.now + 6_000 }, effects: [{ type: "carrera-emojis:reveal" }] };
  }
  if (state.phase === "REVEAL" && state.round + 1 >= state.settings.rounds) return { state: { ...state, phase: "FINISHED", phaseEndsAt: ctx.now }, effects: [] };
  if (state.phase === "REVEAL") return { state: choose({ playerIds: state.players, settings: state.settings, champions: state.champions, clues: ctx.clues, now: ctx.now, rng: ctx.rng, scores: state.scores }, ctx.now, state.round + 1), effects: [] };
  return { state, effects: [] };
}

export function carreraEmojisPublicView(state: CarreraEmojisState) {
  return { mode: "carrera-emojis" as const, phase: state.phase, phaseEndsAt: state.phaseEndsAt, round: state.round, totalRounds: state.settings.rounds, clueIndex: state.clueIndex, clues: [{ clueId: state.clues.clueId, emojis: state.clues.emojis.slice(0, state.clueIndex + 1) }], winnerId: state.winnerId, target: state.phase === "REVEAL" || state.phase === "FINISHED" ? state.champions[state.targetId] ?? null : null, scores: state.scores };
}
export function carreraEmojisPrivateView(state: CarreraEmojisState, playerId: string) {
  const answer = state.answers[playerId] ?? null;
  return {
    mode: "carrera-emojis" as const,
    hasAnswered: Boolean(answer),
    answer,
    /** Solo para quien acertó: confirma el campeón sin revelarlo al resto. */
    revealedTarget: answer === state.targetId ? state.champions[state.targetId] ?? null : null,
  };
}
export function carreraEmojisResults(state: CarreraEmojisState) { return { scores: state.scores }; }
