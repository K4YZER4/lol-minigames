import type { Result, Rng } from "../core/rng";
import { containsChampionName, normalizeText } from "../core/text";

export type DescripcionChampion = { id: string; name: string; imageUrl: string };
export type DescripcionSettings = { turnSeconds: number };
export type DescripcionState = {
  phase: "DESCRIPTION" | "REVEAL";
  settings: DescripcionSettings;
  order: string[];
  roundIndex: number;
  targetChampionId: string;
  champions: Record<string, DescripcionChampion>;
  clues: { playerId: string; text: string }[];
  guesses: { playerId: string; text: string; correct: boolean }[];
  scores: Record<string, number>;
  phaseEndsAt: number;
};
export type DescripcionContext = { now: number; rng: Rng; champions: Record<string, DescripcionChampion> };
export type DescripcionInit = { playerIds: string[]; settings: DescripcionSettings; champions: Record<string, DescripcionChampion>; now: number; rng: Rng };
const fail = (code: string, message: string) => ({ code, message });

function nextRound(state: DescripcionState, ctx: DescripcionContext): DescripcionState {
  return { ...state, phase: "DESCRIPTION", roundIndex: state.roundIndex + 1,
    targetChampionId: ctx.rng.pick(Object.keys(ctx.champions)), clues: [], guesses: [],
    scores: state.scores,
    phaseEndsAt: ctx.now + state.settings.turnSeconds * 1000 };
}
export function createDescripcion(init: DescripcionInit): DescripcionState {
  return { phase: "DESCRIPTION", settings: init.settings, order: [...init.playerIds], roundIndex: 0,
    targetChampionId: init.rng.pick(Object.keys(init.champions)), champions: init.champions,
    clues: [], guesses: [], scores: Object.fromEntries(init.playerIds.map((id) => [id, 0])), phaseEndsAt: init.now + init.settings.turnSeconds * 1000 };
}
function describer(state: DescripcionState) { return state.order[state.roundIndex % state.order.length]; }
export function descripcionClue(state: DescripcionState, playerId: string, text: string): Result<DescripcionState> {
  if (state.phase !== "DESCRIPTION") return { state, effects: [], reject: fail("WRONG_PHASE", "El turno ya terminó") };
  if (describer(state) !== playerId) return { state, effects: [], reject: fail("NOT_YOUR_TURN", "Solo quien describe puede dar pistas") };
  if (containsChampionName(text, state.champions[state.targetChampionId]!.name)) return { state, effects: [], reject: fail("NAME_IN_CLUE", "La pista no puede contener el nombre del objetivo") };
  return { state: { ...state, clues: [...state.clues, { playerId, text }] }, effects: [] };
}
export function descripcionGuess(state: DescripcionState, playerId: string, text: string, ctx: DescripcionContext): Result<DescripcionState> {
  if (state.phase !== "DESCRIPTION") return { state, effects: [], reject: fail("WRONG_PHASE", "El turno ya terminó") };
  if (describer(state) === playerId) return { state, effects: [], reject: fail("INVALID_TARGET", "Quien describe no puede adivinar") };
  if (state.guesses.some((guess) => guess.playerId === playerId)) return { state, effects: [], reject: fail("ALREADY_GUESSED", "Ya hiciste un intento") };
  const target = state.champions[state.targetChampionId]!;
  const correct = containsChampionName(text, target.name) || normalizeText(text) === normalizeText(target.id);
  const guesses = [...state.guesses, { playerId, text, correct }];
  if (!correct) return { state: { ...state, guesses }, effects: [], reject: fail("WRONG_ANSWER", "No es ese campeón") };
  const describerId = describer(state)!;
  return { state: { ...state, guesses, scores: { ...state.scores, [playerId]: (state.scores[playerId] ?? 0) + 2, [describerId]: (state.scores[describerId] ?? 0) + 1 }, phase: "REVEAL", phaseEndsAt: ctx.now + 4_000 }, effects: [{ type: "descripcion:correct", playerId }] };
}
export function descripcionTick(state: DescripcionState, ctx: DescripcionContext): Result<DescripcionState> {
  if (ctx.now < state.phaseEndsAt) return { state, effects: [] };
  if (state.phase === "DESCRIPTION") return { state: { ...state, phase: "REVEAL", phaseEndsAt: ctx.now + 4_000 }, effects: [] };
  if (state.roundIndex + 1 >= state.order.length) return { state: { ...state, phaseEndsAt: ctx.now }, effects: [] };
  return { state: nextRound(state, ctx), effects: [] };
}
export function descripcionPublicView(state: DescripcionState) {
  return { mode: "descripcion" as const, phase: state.phase, phaseEndsAt: state.phaseEndsAt,
    describerId: describer(state), roundIndex: state.roundIndex, totalRounds: state.order.length,
    clues: state.clues, guesses: state.guesses, target: state.phase === "REVEAL" ? state.champions[state.targetChampionId] ?? null : null };
}
export function descripcionPrivateView(state: DescripcionState, playerId: string) {
  const isDescriber = describer(state) === playerId;
  const target = state.champions[state.targetChampionId] ?? null;
  return { mode: "descripcion" as const, target: isDescriber ? target : null,
    forbiddenWords: isDescriber && target ? target.name.split(/\s+/).filter((word) => word.length > 2) : [], youAreDescriber: isDescriber };
}
export function descripcionResults(state: DescripcionState) { return { scores: state.scores }; }
