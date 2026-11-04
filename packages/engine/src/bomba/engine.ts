import type { Effect, Result, Rng } from "../core/rng";

export type BombaSettings = {
  lives: number;
  minFuseMs: number;
  maxFuseMs: number;
  penaltyMs: number;
  minMarginMs: number;
};

export type BombaClue = {
  clueId: string;
  championId: string;
  kind: "spell" | "passive";
  imageUrl: string;
};

export type BombaPublicClue = {
  clueId: string;
  kind: "spell" | "passive";
  imageUrl: string;
};

export type BombaInit = {
  playerIds: string[];
  settings: BombaSettings;
  clues: BombaClue[];
  now: number;
  rng: Rng;
};

export type BombaState = {
  phase: "ACTIVE" | "FINISHED";
  settings: BombaSettings;
  order: string[];
  lives: Record<string, number>;
  activeIndex: number;
  clue: BombaPublicClue | null;
  /** Secreto: nunca se emite al cliente. */
  answerChampionId: string | null;
  fuseStartedAt: number;
  /** Secreto: el vencimiento exacto solo lo conoce el servidor. */
  fuseEndsAt: number;
  explosions: number;
  winners: string[];
  usedClueIds: string[];
};

export type BombaContext = {
  now: number;
  rng: Rng;
  clues: BombaClue[];
};

function aliveIds(state: BombaState): string[] {
  return state.order.filter((id) => (state.lives[id] ?? 0) > 0);
}

function nextAliveIndex(state: BombaState, fromIndex: number): number {
  for (let step = 1; step <= state.order.length; step++) {
    const index = (fromIndex + step) % state.order.length;
    const id = state.order[index]!;
    if ((state.lives[id] ?? 0) > 0) return index;
  }
  return fromIndex;
}

function drawClue(
  state: BombaState,
  ctx: BombaContext,
): Pick<BombaState, "clue" | "answerChampionId" | "usedClueIds"> {
  if (ctx.clues.length === 0) {
    return { clue: null, answerChampionId: null, usedClueIds: state.usedClueIds };
  }
  let pool = ctx.clues.filter((c) => !state.usedClueIds.includes(c.clueId));
  let used = state.usedClueIds;
  if (pool.length === 0) {
    pool = ctx.clues;
    used = [];
  }
  const picked = ctx.rng.pick(pool);
  return {
    clue: { clueId: picked.clueId, kind: picked.kind, imageUrl: picked.imageUrl },
    answerChampionId: picked.championId,
    usedClueIds: [...used, picked.clueId],
  };
}

function newFuse(
  settings: BombaSettings,
  ctx: BombaContext,
): { fuseStartedAt: number; fuseEndsAt: number } {
  const duration = ctx.rng.int(settings.minFuseMs, settings.maxFuseMs);
  return { fuseStartedAt: ctx.now, fuseEndsAt: ctx.now + duration };
}

export function createBomba(init: BombaInit): BombaState {
  const lives: Record<string, number> = {};
  for (const id of init.playerIds) lives[id] = init.settings.lives;

  const base: BombaState = {
    phase: "ACTIVE",
    settings: init.settings,
    order: [...init.playerIds],
    lives,
    activeIndex: 0,
    clue: null,
    answerChampionId: null,
    fuseStartedAt: init.now,
    fuseEndsAt: init.now,
    explosions: 0,
    winners: [],
    usedClueIds: [],
  };

  const ctx: BombaContext = { now: init.now, rng: init.rng, clues: init.clues };
  const drawn = drawClue(base, ctx);
  return { ...base, ...drawn, ...newFuse(init.settings, ctx) };
}

function explode(
  state: BombaState,
  ctx: BombaContext,
  effects: Effect[] = [],
): Result<BombaState> {
  const activeId = state.order[state.activeIndex]!;
  const remaining = (state.lives[activeId] ?? 0) - 1;
  const lives = { ...state.lives, [activeId]: Math.max(0, remaining) };
  const eliminated = remaining <= 0;
  const explosions = state.explosions + 1;

  effects.push({ type: "bomba:explosion", playerId: activeId, eliminated });

  const next: BombaState = { ...state, lives, explosions };
  const alive = aliveIds(next);

  if (alive.length <= 1) {
    return {
      state: { ...next, phase: "FINISHED", winners: alive },
      effects,
    };
  }

  const activeIndex = nextAliveIndex(next, next.activeIndex);
  const drawn = drawClue(next, ctx);
  return {
    state: {
      ...next,
      activeIndex,
      ...drawn,
      ...newFuse(next.settings, ctx),
    },
    effects,
  };
}

export function bombaTick(state: BombaState, ctx: BombaContext): Result<BombaState> {
  if (state.phase !== "ACTIVE") return { state, effects: [] };
  if (ctx.now < state.fuseEndsAt) return { state, effects: [] };
  return explode(state, ctx);
}

export function bombaAnswer(
  state: BombaState,
  playerId: string,
  championId: string,
  ctx: BombaContext,
): Result<BombaState> {
  if (state.phase !== "ACTIVE") {
    return {
      state,
      effects: [],
      reject: { code: "WRONG_PHASE", message: "La partida ya terminó" },
    };
  }

  const activeId = state.order[state.activeIndex]!;
  if (activeId !== playerId) {
    return {
      state,
      effects: [],
      reject: { code: "NOT_YOUR_TURN", message: "No es tu turno" },
    };
  }

  // El vencimiento manda sobre cualquier respuesta: se resuelve primero.
  if (ctx.now >= state.fuseEndsAt) {
    const exploded = explode(state, ctx);
    return {
      ...exploded,
      reject: { code: "LATE", message: "La mecha ya había vencido" },
    };
  }

  if (championId !== state.answerChampionId) {
    const fuseEndsAt = state.fuseEndsAt - state.settings.penaltyMs;
    const effects: Effect[] = [{ type: "bomba:wrong", playerId }];
    if (fuseEndsAt <= ctx.now) {
      const exploded = explode({ ...state, fuseEndsAt }, ctx, effects);
      return {
        ...exploded,
        reject: { code: "WRONG_ANSWER", message: "Respuesta incorrecta" },
      };
    }
    return {
      state: { ...state, fuseEndsAt },
      effects,
      reject: { code: "WRONG_ANSWER", message: "Respuesta incorrecta" },
    };
  }

  const remaining = state.fuseEndsAt - ctx.now;
  const toppedUp = remaining < state.settings.minMarginMs;
  const fuseEndsAt = toppedUp ? ctx.now + state.settings.minMarginMs : state.fuseEndsAt;

  const next: BombaState = {
    ...state,
    activeIndex: nextAliveIndex(state, state.activeIndex),
    fuseEndsAt,
    fuseStartedAt: toppedUp ? ctx.now : state.fuseStartedAt,
  };

  return {
    state: { ...next, ...drawClue(next, ctx) },
    effects: [{ type: "bomba:correct", playerId }],
  };
}

/**
 * Salta el turno de un jugador que se desconectó.
 * La mecha sigue corriendo: solo cambia de manos.
 */
export function bombaSkip(
  state: BombaState,
  playerId: string,
  ctx: BombaContext,
): Result<BombaState> {
  if (state.phase !== "ACTIVE") return { state, effects: [] };
  if (state.order[state.activeIndex] !== playerId) return { state, effects: [] };
  if (ctx.now >= state.fuseEndsAt) return explode(state, ctx);

  const remaining = state.fuseEndsAt - ctx.now;
  const toppedUp = remaining < state.settings.minMarginMs;
  const next: BombaState = {
    ...state,
    activeIndex: nextAliveIndex(state, state.activeIndex),
    fuseEndsAt: toppedUp ? ctx.now + state.settings.minMarginMs : state.fuseEndsAt,
    fuseStartedAt: toppedUp ? ctx.now : state.fuseStartedAt,
  };

  return {
    state: { ...next, ...drawClue(next, ctx) },
    effects: [{ type: "bomba:skipped", playerId }],
  };
}

export function bombaHeat(
  state: BombaState,
  now: number,
): "cold" | "warm" | "hot" {
  const total = Math.max(1, state.fuseEndsAt - state.fuseStartedAt);
  const ratio = (state.fuseEndsAt - now) / total;
  if (ratio > 0.5) return "cold";
  if (ratio > 0.25) return "warm";
  return "hot";
}

export function bombaPublicView(state: BombaState, now: number) {
  return {
    mode: "bomba" as const,
    activePlayerId: state.phase === "FINISHED" ? null : state.order[state.activeIndex]!,
    clue: state.phase === "FINISHED" ? null : state.clue,
    heat: bombaHeat(state, now),
    explosions: state.explosions,
    finished: state.phase === "FINISHED",
  };
}

export function bombaPrivateView(state: BombaState, playerId: string) {
  const activeId = state.order[state.activeIndex];
  return {
    mode: "bomba" as const,
    youAreActive: state.phase === "ACTIVE" && activeId === playerId,
    clue: state.phase === "ACTIVE" && activeId === playerId ? state.clue : null,
  };
}

export function bombaResults(state: BombaState) {
  const scores: Record<string, number> = {};
  for (const id of state.order) scores[id] = state.winners.includes(id) ? 1000 : 0;
  return { winners: state.winners, scores };
}
