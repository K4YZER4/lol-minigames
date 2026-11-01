import type { Result, Rng } from "../core/rng";

export type DuoChampion = { id: string; name: string; imageUrl: string };
export type DuoSettings = { guessSeconds: number };
export type DuoState = {
  phase: "GUESSING" | "REVEAL";
  settings: DuoSettings;
  order: string[];
  pairs: [string, string][];
  champions: Record<string, DuoChampion>;
  assignments: Record<string, string>;
  guesses: Record<string, string>;
  phaseEndsAt: number;
};
export type DuoContext = { now: number; champions: Record<string, DuoChampion> };
export type DuoInit = { playerIds: string[]; settings: DuoSettings; champions: Record<string, DuoChampion>; now: number; rng: Rng };

export function createDuo(init: DuoInit): DuoState {
  const order = init.rng.shuffle(init.playerIds);
  const pairs: [string, string][] = [];
  for (let i = 0; i + 1 < order.length; i += 2) pairs.push([order[i]!, order[i + 1]!]);
  const championIds = init.rng.shuffle(Object.keys(init.champions));
  const assignments: Record<string, string> = {};
  order.forEach((playerId, index) => { if (championIds[index]) assignments[playerId] = championIds[index]!; });
  return { phase: "GUESSING", settings: init.settings, order, pairs, champions: init.champions, assignments, guesses: {}, phaseEndsAt: init.now + init.settings.guessSeconds * 1000 };
}

export function duoSubmit(state: DuoState, playerId: string, championId: string): Result<DuoState> {
  if (state.phase !== "GUESSING") return { state, effects: [], reject: { code: "WRONG_PHASE", message: "La fase de respuestas ya terminó" } };
  if (!state.pairs.some((pair) => pair.includes(playerId))) return { state, effects: [], reject: { code: "INVALID_TARGET", message: "Esta ronda no tiene pareja para ti" } };
  if (state.guesses[playerId]) return { state, effects: [], reject: { code: "ALREADY_GUESSED", message: "Ya enviaste tu respuesta" } };
  if (!state.champions[championId]) return { state, effects: [], reject: { code: "UNKNOWN_CHAMPION", message: "Ese campeón no existe" } };
  return { state: { ...state, guesses: { ...state.guesses, [playerId]: championId } }, effects: [] };
}

export function duoTick(state: DuoState, ctx: DuoContext): Result<DuoState> {
  if (state.phase === "REVEAL" || ctx.now < state.phaseEndsAt) return { state, effects: [] };
  return { state: { ...state, phase: "REVEAL", phaseEndsAt: ctx.now }, effects: [] };
}

export function duoPublicView(state: DuoState) {
  const pairs = state.pairs.map(([a, b]) => ({
    playerIds: [a, b] as [string, string],
    champions: state.phase === "REVEAL" ? { [a]: state.champions[state.assignments[a] ?? ""] ?? null, [b]: state.champions[state.assignments[b] ?? ""] ?? null } : {},
    guesses: state.phase === "REVEAL" ? { [a]: state.champions[state.guesses[a] ?? ""] ?? null, [b]: state.champions[state.guesses[b] ?? ""] ?? null } : {},
    correct: state.phase === "REVEAL" ? { [a]: state.guesses[a] === state.assignments[b], [b]: state.guesses[b] === state.assignments[a] } : null,
  }));
  return { mode: "duo" as const, phase: state.phase, phaseEndsAt: state.phaseEndsAt, pairs, submitted: Object.keys(state.guesses) };
}

export function duoPrivateView(state: DuoState, playerId: string) {
  const pair = state.pairs.find((item) => item.includes(playerId));
  return { mode: "duo" as const, ownChampion: state.champions[state.assignments[playerId] ?? ""] ?? null, partnerId: pair?.find((id) => id !== playerId) ?? null, hasSubmitted: Boolean(state.guesses[playerId]) };
}

export function duoResults(state: DuoState) {
  const scores: Record<string, number> = {};
  for (const [a, b] of state.pairs) { scores[a] = state.guesses[a] === state.assignments[b] ? 1 : 0; scores[b] = state.guesses[b] === state.assignments[a] ? 1 : 0; }
  return { scores };
}
