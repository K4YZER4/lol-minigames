import type { Result, Rng } from "../core/rng";

export type QuienSoyChampion = { id: string; name: string; imageUrl: string };
export type QuienSoySettings = { turnSeconds: number };

/**
 * Turno cerrado. El campeón solo se guarda para revelarlo cuando el turno
 * termina; mientras el jugador está activo nunca sale de aquí.
 */
export type QuienSoyTurnResult = {
  playerId: string;
  championId: string;
  solved: boolean;
  attempts: number;
};

export type QuienSoyState = {
  phase: "TURN" | "REVEAL";
  settings: QuienSoySettings;
  order: string[];
  activeIndex: number;
  /** Campeón secreto por jugador. Nunca se envía al propio jugador activo. */
  assignments: Record<string, string>;
  champions: Record<string, QuienSoyChampion>;
  /** Intentos fallidos del jugador activo. */
  attempts: string[];
  results: QuienSoyTurnResult[];
  phaseEndsAt: number;
};

export type QuienSoyInit = {
  playerIds: string[];
  settings: QuienSoySettings;
  champions: Record<string, QuienSoyChampion>;
  now: number;
  rng: Rng;
};

export type QuienSoyContext = { now: number; rng: Rng };

const fail = (code: string, message: string) => ({ code, message });

export function createQuienSoy(init: QuienSoyInit): QuienSoyState {
  const ids = Object.keys(init.champions);
  if (ids.length === 0) throw new Error("No hay campeones disponibles");

  const shuffled = init.rng.shuffle(ids);
  const assignments: Record<string, string> = {};
  init.playerIds.forEach((playerId, index) => {
    assignments[playerId] = shuffled[index % shuffled.length]!;
  });

  return {
    phase: "TURN",
    settings: init.settings,
    order: [...init.playerIds],
    activeIndex: 0,
    assignments,
    champions: init.champions,
    attempts: [],
    results: [],
    phaseEndsAt: init.now + init.settings.turnSeconds * 1000,
  };
}

function finishTurn(
  state: QuienSoyState,
  ctx: QuienSoyContext,
  solved: boolean,
): QuienSoyState {
  const active = state.order[state.activeIndex]!;
  const results = [
    ...state.results,
    {
      playerId: active,
      championId: state.assignments[active]!,
      solved,
      attempts: state.attempts.length,
    },
  ];

  if (state.activeIndex + 1 >= state.order.length) {
    return {
      ...state,
      phase: "REVEAL",
      results,
      attempts: [],
      phaseEndsAt: ctx.now,
    };
  }

  return {
    ...state,
    activeIndex: state.activeIndex + 1,
    results,
    attempts: [],
    phaseEndsAt: ctx.now + state.settings.turnSeconds * 1000,
  };
}

/**
 * Solo el jugador activo puede adivinar. Un acierto cierra el turno con +1;
 * un fallo no penaliza y permite seguir intentando hasta que acabe el tiempo.
 */
export function quienSoyGuess(
  state: QuienSoyState,
  playerId: string,
  championId: string,
  ctx: QuienSoyContext,
): Result<QuienSoyState> {
  if (state.phase !== "TURN") {
    return { state, effects: [], reject: fail("WRONG_PHASE", "La partida ya terminó") };
  }
  if (state.order[state.activeIndex] !== playerId) {
    return { state, effects: [], reject: fail("NOT_YOUR_TURN", "No es tu turno") };
  }
  if (!state.champions[championId]) {
    return { state, effects: [], reject: fail("UNKNOWN_CHAMPION", "Ese campeón no existe") };
  }

  if (state.assignments[playerId] === championId) {
    return { state: finishTurn(state, ctx, true), effects: [] };
  }

  const attempts = state.attempts.includes(championId)
    ? state.attempts
    : [...state.attempts, championId];
  return { state: { ...state, attempts }, effects: [] };
}

/** Al agotarse el tiempo el turno se cierra y el campeón se revela. */
export function quienSoyTick(state: QuienSoyState, ctx: QuienSoyContext): Result<QuienSoyState> {
  if (state.phase !== "TURN" || ctx.now < state.phaseEndsAt) {
    return { state, effects: [] };
  }
  return { state: finishTurn(state, ctx, false), effects: [] };
}

export function quienSoyPublicView(state: QuienSoyState) {
  return {
    mode: "quien-soy" as const,
    phase: state.phase,
    phaseEndsAt: state.phaseEndsAt,
    activePlayerId: state.order[state.activeIndex]!,
    order: state.order,
    turnIndex: state.results.length,
    totalTurns: state.order.length,
    attempts: state.attempts,
    revealed: state.results.map((result) => ({
      playerId: result.playerId,
      champion: state.champions[result.championId] ?? null,
      solved: result.solved,
      attempts: result.attempts,
    })),
  };
}

/**
 * El jugador activo nunca recibe su propio campeón: no está en `visible` y
 * `yourChampion` sigue en null hasta que su turno entra en `results`.
 */
export function quienSoyPrivateView(state: QuienSoyState, playerId: string) {
  const visible: Record<string, QuienSoyChampion> = {};
  for (const id of state.order) {
    if (id === playerId) continue;
    const champion = state.champions[state.assignments[id]!];
    if (champion) visible[id] = champion;
  }

  const own = state.results.find((result) => result.playerId === playerId);
  return {
    mode: "quien-soy" as const,
    visible,
    yourChampion: own ? state.champions[own.championId] ?? null : null,
    isActive: state.phase === "TURN" && state.order[state.activeIndex] === playerId,
    hasSolved: own?.solved ?? false,
  };
}

export function quienSoyResults(state: QuienSoyState) {
  const scores: Record<string, number> = {};
  for (const id of state.order) scores[id] = 0;
  for (const result of state.results) {
    if (result.solved) scores[result.playerId] = 1000;
  }
  return { scores };
}
