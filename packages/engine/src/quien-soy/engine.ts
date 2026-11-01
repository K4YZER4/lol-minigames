import type { Result, Rng } from "../core/rng";

export type QuienSoyChampion = { id: string; name: string; imageUrl: string };
export type QuienSoyState = {
  phase: "QUESTION" | "REVEAL";
  settings: { turnSeconds: number };
  order: string[];
  activeIndex: number;
  identities: Record<string, string>;
  champions: Record<string, QuienSoyChampion>;
  question: { text: string; askedBy: string } | null;
  answers: Record<string, boolean>;
  guessed: string[];
  solved: string[];
  phaseEndsAt: number;
};
export type QuienSoyInit = { playerIds: string[]; settings: { turnSeconds: number }; champions: Record<string, QuienSoyChampion>; now: number; rng: Rng };
export type QuienSoyContext = { now: number; rng: Rng };
const fail = (code: string, message: string) => ({ code, message });

export function createQuienSoy(init: QuienSoyInit): QuienSoyState {
  const ids = Object.keys(init.champions);
  const identities: Record<string, string> = {};
  for (const playerId of init.playerIds) identities[playerId] = init.rng.pick(ids);
  return { phase: "QUESTION", settings: init.settings, order: [...init.playerIds], activeIndex: 0, identities, champions: init.champions, question: null, answers: {}, guessed: [], solved: [], phaseEndsAt: init.now + init.settings.turnSeconds * 1000 };
}
export function quienSoyQuestion(state: QuienSoyState, playerId: string, text: string): Result<QuienSoyState> {
  const active = state.order[state.activeIndex];
  if (state.phase !== "QUESTION") return { state, effects: [], reject: fail("WRONG_PHASE", "La partida ya terminó") };
  if (active !== playerId) return { state, effects: [], reject: fail("NOT_YOUR_TURN", "No es tu turno") };
  if (!text.trim() || text.trim().length > 120) return { state, effects: [], reject: fail("INVALID_QUESTION", "La pregunta no es válida") };
  return { state: { ...state, question: { text: text.trim(), askedBy: playerId }, answers: {} }, effects: [] };
}
export function quienSoyAnswer(state: QuienSoyState, playerId: string, answer: boolean): Result<QuienSoyState> {
  const active = state.order[state.activeIndex];
  if (state.phase !== "QUESTION") return { state, effects: [], reject: fail("WRONG_PHASE", "La ronda ya terminó") };
  if (!state.question) return { state, effects: [], reject: fail("WRONG_PHASE", "Primero hay que hacer una pregunta") };
  if (playerId === active || state.answers[playerId] !== undefined) return { state, effects: [], reject: fail("ALREADY_VOTED", "Ya respondiste") };
  return { state: { ...state, answers: { ...state.answers, [playerId]: answer } }, effects: [] };
}
export function quienSoyGuess(state: QuienSoyState, playerId: string, championId: string, ctx: QuienSoyContext): Result<QuienSoyState> {
  const active = state.order[state.activeIndex];
  if (state.phase !== "QUESTION") return { state, effects: [], reject: fail("WRONG_PHASE", "La partida ya terminó") };
  if (active !== playerId) return { state, effects: [], reject: fail("NOT_YOUR_TURN", "No es tu turno") };
  if (!state.champions[championId]) return { state, effects: [], reject: fail("UNKNOWN_CHAMPION", "Ese campeón no existe") };
  const correct = state.identities[playerId] === championId;
  const guessed = [...state.guessed, playerId];
  const solved = correct ? [...state.solved, playerId] : state.solved;
  if (correct || guessed.length >= state.order.length) return { state: { ...state, phase: "REVEAL", guessed, solved, phaseEndsAt: ctx.now }, effects: [] };
  const next = (state.activeIndex + 1) % state.order.length;
  return { state: { ...state, activeIndex: next, question: null, answers: {}, guessed, solved, phaseEndsAt: ctx.now + state.settings.turnSeconds * 1000 }, effects: [] };
}
export function quienSoyTick(state: QuienSoyState, ctx: QuienSoyContext): Result<QuienSoyState> {
  if (state.phase === "REVEAL" || ctx.now < state.phaseEndsAt) return { state, effects: [] };
  const next = (state.activeIndex + 1) % state.order.length;
  if (next === 0 || state.guessed.includes(state.order[next]!)) return { state: { ...state, phase: "REVEAL", phaseEndsAt: ctx.now }, effects: [] };
  return { state: { ...state, activeIndex: next, question: null, answers: {}, phaseEndsAt: ctx.now + state.settings.turnSeconds * 1000 }, effects: [] };
}
export function quienSoyPublicView(state: QuienSoyState) {
  return { mode: "quien-soy" as const, phase: state.phase, phaseEndsAt: state.phaseEndsAt, activePlayerId: state.order[state.activeIndex]!, question: state.question, answers: Object.entries(state.answers).map(([playerId, answer]) => ({ playerId, answer })), guessed: state.guessed, identitiesRevealed: state.phase === "REVEAL" };
}
export function quienSoyPrivateView(state: QuienSoyState, playerId: string) {
  const identities: Record<string, QuienSoyChampion> = {};
  for (const id of state.order) if ((id !== playerId || state.phase === "REVEAL") && state.champions[state.identities[id]!]) identities[id] = state.champions[state.identities[id]!]!;
  return { mode: "quien-soy" as const, identities, yourIdentity: null, isActive: state.order[state.activeIndex] === playerId };
}
export function quienSoyResults(state: QuienSoyState) { const scores: Record<string, number> = {}; for (const id of state.order) scores[id] = state.solved.includes(id) ? 1 : 0; return { scores }; }
