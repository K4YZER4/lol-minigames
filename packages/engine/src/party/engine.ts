import type { Result, Rng } from "../core/rng";

export type PartyChampion = { id: string; name: string; imageUrl: string; tags: string[] };
export type PartySettings = { category: "roles" | "audio"; turnSeconds: number; rounds: number };
export type PartyState = {
  phase: "GUESSING" | "REVEAL" | "FINISHED";
  settings: PartySettings;
  order: string[];
  round: number;
  activeIndex: number;
  targetId: string;
  champions: Record<string, PartyChampion>;
  guesses: Record<string, boolean>;
  scores: Record<string, number>;
  phaseEndsAt: number;
};
export type PartyInit = { playerIds: string[]; settings: PartySettings; champions: Record<string, PartyChampion>; now: number; rng: Rng };
export type PartyContext = { now: number; rng: Rng; champions: Record<string, PartyChampion> };

export function createParty(init: PartyInit): PartyState {
  const ids = Object.keys(init.champions);
  const targetId = init.rng.pick(ids);
  return { phase: "GUESSING", settings: init.settings, order: [...init.playerIds], round: 1, activeIndex: 0, targetId, champions: init.champions, guesses: {}, scores: {}, phaseEndsAt: init.now + init.settings.turnSeconds * 1000 };
}

export function partyGuess(state: PartyState, playerId: string, championId: string): Result<PartyState> {
  if (state.phase !== "GUESSING") return { state, effects: [], reject: { code: "WRONG_PHASE", message: "El turno ya terminó" } };
  if (state.order[state.activeIndex] === playerId) return { state, effects: [], reject: { code: "NOT_YOUR_TURN", message: "El jugador activo no puede adivinar" } };
  if (state.guesses[playerId] !== undefined) return { state, effects: [], reject: { code: "ALREADY_GUESSED", message: "Ya enviaste tu respuesta" } };
  if (!state.champions[championId]) return { state, effects: [], reject: { code: "UNKNOWN_CHAMPION", message: "Ese campeón no existe" } };
  const correct = championId === state.targetId;
  return { state: { ...state, guesses: { ...state.guesses, [playerId]: correct }, scores: { ...state.scores, [playerId]: (state.scores[playerId] ?? 0) + (correct ? 1 : 0) } }, effects: [] };
}

export function partyTick(state: PartyState, ctx: PartyContext): Result<PartyState> {
  if (state.phase !== "GUESSING" || ctx.now < state.phaseEndsAt) return { state, effects: [] };
  if (state.round >= state.settings.rounds) return { state: { ...state, phase: "FINISHED", phaseEndsAt: ctx.now }, effects: [] };
  const targetId = ctx.rng.pick(Object.keys(ctx.champions));
  return { state: { ...state, phase: "GUESSING", round: state.round + 1, activeIndex: (state.activeIndex + 1) % state.order.length, targetId, guesses: {}, phaseEndsAt: ctx.now + state.settings.turnSeconds * 1000 }, effects: [] };
}

export function partyPublicView(state: PartyState) {
  return { mode: "party" as const, phase: state.phase, phaseEndsAt: state.phaseEndsAt, category: state.settings.category, activePlayerId: state.order[state.activeIndex]!, round: state.round, totalRounds: state.settings.rounds, guesses: Object.entries(state.guesses).map(([playerId, correct]) => ({ playerId, correct })) };
}

export function partyPrivateView(state: PartyState, playerId: string) {
  return { mode: "party" as const, target: state.order[state.activeIndex] === playerId ? state.champions[state.targetId] ?? null : null, isActive: state.order[state.activeIndex] === playerId, hasGuessed: state.guesses[playerId] !== undefined };
}

export function partyResults(state: PartyState) {
  return { scores: state.scores };
}
