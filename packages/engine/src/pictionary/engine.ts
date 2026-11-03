import type { Result, Rng } from "../core/rng";

export type PictionaryChampion = { id: string; name: string; imageUrl: string };
export type PictionarySettings = { drawingSeconds: number; rounds: number };
export type Point = { x: number; y: number; color?: string; width?: number };
export type Fill = { x: number; y: number; color: string };

export type PictionaryState = {
  phase: "DRAWING" | "REVEAL";
  settings: PictionarySettings;
  order: string[];
  roundIndex: number;
  targetChampionId: string;
  champions: Record<string, PictionaryChampion>;
  strokes: Point[][];
  guesses: string[];
  phaseEndsAt: number;
  backgroundColor: string;
  fills: Fill[];
  history: ("stroke" | "fill")[];
  operations: ({ type: "stroke"; points: Point[] } | { type: "fill"; fill: Fill })[];
  scores: Record<string, number>;
};

export type PictionaryContext = { now: number; rng: Rng; champions: Record<string, PictionaryChampion> };

export type PictionaryInit = {
  playerIds: string[];
  settings: PictionarySettings;
  champions: Record<string, PictionaryChampion>;
  now: number;
  rng: Rng;
};

const fail = (code: string, message: string) => ({ code, message });

function nextRound(state: PictionaryState, ctx: PictionaryContext): PictionaryState {
  const nextIndex = state.roundIndex + 1;
  const target = ctx.rng.pick(Object.keys(ctx.champions));
  return {
    ...state,
    phase: "DRAWING",
    roundIndex: nextIndex,
    targetChampionId: target,
    strokes: [],
    guesses: [],
    phaseEndsAt: ctx.now + state.settings.drawingSeconds * 1000,
    backgroundColor: "#f0ecdd",
    fills: [],
    history: [],
    operations: [],
    scores: { ...state.scores },
  };
}

export function createPictionary(init: PictionaryInit): PictionaryState {
  const target = init.rng.pick(Object.keys(init.champions));
  return {
    phase: "DRAWING",
    settings: init.settings,
    order: [...init.playerIds],
    roundIndex: 0,
    targetChampionId: target,
    champions: init.champions,
    strokes: [],
    guesses: [],
    phaseEndsAt: init.now + init.settings.drawingSeconds * 1000,
    backgroundColor: "#f0ecdd",
    fills: [],
    history: [],
    operations: [],
    scores: Object.fromEntries(init.playerIds.map((id) => [id, 0])),
  };
}

export function pictionaryStroke(
  state: PictionaryState,
  playerId: string,
  points: Point[],
): Result<PictionaryState> {
  const drawer = state.order[state.roundIndex % state.order.length];
  if (state.phase !== "DRAWING") return { state, effects: [], reject: fail("WRONG_PHASE", "El dibujo ya terminó") };
  if (drawer !== playerId) return { state, effects: [], reject: fail("NOT_YOUR_TURN", "Solo quien dibuja puede trazar") };
  if (points.length < 2 || points.length > 40 || state.strokes.length >= 500) {
    return { state, effects: [], reject: fail("INVALID_STROKE", "Trazo inválido") };
  }
  return { state: { ...state, strokes: [...state.strokes, points], operations: [...state.operations, { type: "stroke", points }], history: [...state.history, "stroke"] }, effects: [] };
}

export function pictionaryClear(state: PictionaryState, playerId: string): Result<PictionaryState> {
  const drawer = state.order[state.roundIndex % state.order.length];
  if (state.phase !== "DRAWING") return { state, effects: [], reject: fail("WRONG_PHASE", "El dibujo ya terminó") };
  if (drawer !== playerId) return { state, effects: [], reject: fail("NOT_YOUR_TURN", "Solo quien dibuja puede borrar") };
  return { state: { ...state, strokes: [] }, effects: [] };
}

export function pictionaryUndo(state: PictionaryState, playerId: string): Result<PictionaryState> {
  const drawer = state.order[state.roundIndex % state.order.length];
  if (state.phase !== "DRAWING") return { state, effects: [], reject: fail("WRONG_PHASE", "El dibujo ya terminó") };
  if (drawer !== playerId) return { state, effects: [], reject: fail("NOT_YOUR_TURN", "Solo quien dibuja puede deshacer") };
  const last = state.history.at(-1);
  if (!last) return { state, effects: [] };
  return { state: { ...state, strokes: last === "stroke" ? state.strokes.slice(0, -1) : state.strokes, fills: last === "fill" ? state.fills.slice(0, -1) : state.fills, operations: state.operations.slice(0, -1), history: state.history.slice(0, -1) }, effects: [] };
}

export function pictionaryFill(state: PictionaryState, playerId: string, x: number, y: number, color: string): Result<PictionaryState> {
  const drawer = state.order[state.roundIndex % state.order.length];
  if (state.phase !== "DRAWING") return { state, effects: [], reject: fail("WRONG_PHASE", "El dibujo ya terminó") };
  if (drawer !== playerId) return { state, effects: [], reject: fail("NOT_YOUR_TURN", "Solo quien dibuja puede rellenar") };
  if (!/^#[0-9a-f]{6}$/i.test(color)) return { state, effects: [], reject: fail("INVALID_STROKE", "Color inválido") };
  const fill = { x, y, color };
  return { state: { ...state, fills: [...state.fills, fill], operations: [...state.operations, { type: "fill", fill }], history: [...state.history, "fill"] }, effects: [] };
}

export function pictionaryGuess(
  state: PictionaryState,
  playerId: string,
  championId: string,
  ctx: PictionaryContext,
): Result<PictionaryState> {
  const drawer = state.order[state.roundIndex % state.order.length];
  if (state.phase !== "DRAWING") return { state, effects: [], reject: fail("WRONG_PHASE", "La ronda ya terminó") };
  if (drawer === playerId) return { state, effects: [], reject: fail("INVALID_TARGET", "Quien dibuja no puede adivinar") };
  if (state.guesses.includes(playerId)) return { state, effects: [], reject: fail("ALREADY_GUESSED", "Ya hiciste un intento") };
  if (!state.champions[championId]) return { state, effects: [], reject: fail("UNKNOWN_CHAMPION", "Ese campeón no existe") };
  if (championId !== state.targetChampionId) {
    return { state: { ...state, guesses: [...state.guesses, playerId] }, effects: [], reject: { code: "WRONG_ANSWER", message: "No es ese campeón" } };
  }
  const rank = state.guesses.length;
  const base = Math.max(100, 800 - rank * 100);
  const remainingRatio = Math.max(0, Math.min(1, (state.phaseEndsAt - ctx.now) / (state.settings.drawingSeconds * 1000)));
  const score = Math.min(1000, base + Math.floor(200 * remainingRatio));
  const scores = { ...state.scores, [playerId]: (state.scores[playerId] ?? 0) + score };
  const guesses = [...state.guesses, playerId];
  const allGuessed = guesses.length >= state.order.length - 1;
  return {
    state: {
      ...state,
      phase: allGuessed ? "REVEAL" : "DRAWING",
      guesses,
      scores,
      phaseEndsAt: allGuessed ? ctx.now + 4_000 : state.phaseEndsAt,
    },
    effects: [{ type: "pictionary:correct", playerId }],
  };
}

export function pictionaryTick(state: PictionaryState, ctx: PictionaryContext): Result<PictionaryState> {
  if (ctx.now < state.phaseEndsAt) return { state, effects: [] };
  if (state.phase === "DRAWING") {
    return { state: { ...state, phase: "REVEAL", phaseEndsAt: ctx.now + 4_000 }, effects: [] };
  }
  if (state.roundIndex + 1 >= state.settings.rounds) {
    return { state: { ...state, phase: "REVEAL", phaseEndsAt: ctx.now }, effects: [] };
  }
  return { state: nextRound(state, ctx), effects: [] };
}

export function pictionaryPublicView(state: PictionaryState, now: number) {
  const target = state.phase === "REVEAL" ? state.champions[state.targetChampionId] ?? null : null;
  return {
    mode: "pictionary" as const,
    phase: state.phase,
    phaseEndsAt: state.phaseEndsAt,
    drawerId: state.order[state.roundIndex % state.order.length]!,
    roundIndex: state.roundIndex,
    totalRounds: state.settings.rounds,
    strokes: state.strokes,
    guesses: state.guesses,
    target,
    backgroundColor: state.backgroundColor,
    fills: state.fills,
    operations: state.operations,
    scores: state.scores,
    serverTime: now,
  };
}

export function pictionaryPrivateView(state: PictionaryState, playerId: string) {
  const drawer = state.order[state.roundIndex % state.order.length];
  return {
    mode: "pictionary" as const,
    target: drawer === playerId ? state.champions[state.targetChampionId] ?? null : null,
    youAreDrawer: drawer === playerId,
  };
}

export function pictionaryResults(state: PictionaryState) {
  const scores: Record<string, number> = { ...state.scores };
  const drawer = state.order[state.roundIndex % state.order.length];
  if (drawer && state.guesses.length > 0) scores[drawer] = (scores[drawer] ?? 0) + Math.max(100, Math.min(500, state.guesses.length * 100));
  return { scores };
}
