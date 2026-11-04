import type { Effect, Result, Rng } from "../core/rng";
import { containsChampionName } from "../core/text";

export type ChampionInfo = { id: string; name: string; imageUrl: string };

export type ImpostorPair = { championId: string; partnerId: string };

export type ImpostorSettings = {
  assignmentSeconds: number;
  clueSeconds: number;
  discussionSeconds: number;
  voteSeconds: number;
};

export type ImpostorPhase =
  | "ASSIGNMENT"
  | "CLUES"
  | "DISCUSSION"
  | "VOTING"
  | "REVEAL";

export type ImpostorReveal = {
  assignment: Record<string, ChampionInfo>;
  impostorIds: string[];
  caught: boolean;
  winners: string[];
  scores: Record<string, number>;
};

export type ImpostorInit = {
  playerIds: string[];
  settings: ImpostorSettings;
  pairs: ImpostorPair[];
  champions: Record<string, ChampionInfo>;
  now: number;
  rng: Rng;
};

export type ImpostorState = {
  phase: ImpostorPhase;
  settings: ImpostorSettings;
  order: string[];
  /** Secreto: campeón asignado a cada jugador. */
  assignment: Record<string, string>;
  /** Secreto: quiénes son los infiltrados. */
  impostorIds: string[];
  champions: Record<string, ChampionInfo>;
  clueIndex: number;
  clues: { playerId: string; text: string }[];
  /** Secreto: a quién votó cada uno. */
  votes: Record<string, string | null>;
  phaseEndsAt: number;
  acknowledged: string[];
  reveal: ImpostorReveal | null;
};

export type ImpostorContext = {
  now: number;
  rng: Rng;
  pairs: ImpostorPair[];
  champions: Record<string, ChampionInfo>;
};

function seconds(ms: number) {
  return ms;
}

function toDiscussion(
  state: ImpostorState,
  ctx: ImpostorContext,
  effects: Effect[],
): Result<ImpostorState> {
  return {
    state: {
      ...state,
      phase: "DISCUSSION",
      phaseEndsAt: ctx.now + seconds(state.settings.discussionSeconds * 1000),
    },
    effects,
  };
}

function tally(
  state: ImpostorState,
  ctx: ImpostorContext,
  effects: Effect[],
): Result<ImpostorState> {
  const counts = new Map<string, number>();
  for (const target of Object.values(state.votes)) {
    if (!target) continue;
    counts.set(target, (counts.get(target) ?? 0) + 1);
  }

  const entries = [...counts.entries()];
  const max = entries.reduce((acc, [, n]) => Math.max(acc, n), 0);
  const top = entries.filter(([, n]) => n === max && max > 0).map(([id]) => id);

  // Empate, sin votos o un top-voted que no es infiltrado: gana el infiltrado.
  const caught = top.length === 1 && state.impostorIds.includes(top[0]!);

  const winners = caught
    ? state.order.filter((id) => !state.impostorIds.includes(id))
    : [...state.impostorIds];

  const scores: Record<string, number> = {};
  for (const id of state.order) scores[id] = 0;

  if (caught) {
    for (const [voter, target] of Object.entries(state.votes)) {
      if (target && state.impostorIds.includes(target)) scores[voter] = 1000;
    }
  } else {
    for (const id of state.impostorIds) scores[id] = 1000;
  }

  const assignment: Record<string, ChampionInfo> = {};
  for (const id of state.order) {
    const championId = state.assignment[id];
    const info = championId ? ctx.champions[championId] : undefined;
    if (info) assignment[id] = info;
  }

  const reveal: ImpostorReveal = {
    assignment,
    impostorIds: [...state.impostorIds],
    caught,
    winners,
    scores,
  };

  effects.push({ type: "impostor:reveal", caught });

  return {
    state: { ...state, phase: "REVEAL", phaseEndsAt: ctx.now, reveal },
    effects,
  };
}

function advance(
  state: ImpostorState,
  ctx: ImpostorContext,
  effects: Effect[] = [],
): Result<ImpostorState> {
  switch (state.phase) {
    case "ASSIGNMENT":
      return {
        state: {
          ...state,
          phase: "CLUES",
          clueIndex: 0,
          phaseEndsAt: ctx.now + state.settings.clueSeconds * 1000,
        },
        effects,
      };
    case "CLUES": {
      if (state.clueIndex >= state.order.length) return toDiscussion(state, ctx, effects);
      const skipped = state.order[state.clueIndex]!;
      const clues = [...state.clues, { playerId: skipped, text: "(sin pista)" }];
      const clueIndex = state.clueIndex + 1;
      if (clueIndex >= state.order.length) {
        return toDiscussion({ ...state, clues, clueIndex }, ctx, effects);
      }
      return {
        state: {
          ...state,
          clues,
          clueIndex,
          phaseEndsAt: ctx.now + state.settings.clueSeconds * 1000,
        },
        effects,
      };
    }
    case "DISCUSSION":
      return {
        state: {
          ...state,
          phase: "VOTING",
          phaseEndsAt: ctx.now + state.settings.voteSeconds * 1000,
        },
        effects,
      };
    case "VOTING":
      return tally(state, ctx, effects);
    case "REVEAL":
      return { state, effects };
  }
}

export function createImpostor(init: ImpostorInit): ImpostorState {
  const impostorCount = init.playerIds.length >= 7 ? 2 : 1;
  const shuffled = init.rng.shuffle(init.playerIds);
  const impostorIds = shuffled.slice(0, impostorCount);

  const pair = init.rng.pick(init.pairs);
  const majority = pair.championId;
  const minority = pair.partnerId;

  const assignment: Record<string, string> = {};
  for (const id of init.playerIds) {
    assignment[id] = impostorIds.includes(id) ? minority : majority;
  }

  return {
    phase: "ASSIGNMENT",
    settings: init.settings,
    order: [...init.playerIds],
    assignment,
    impostorIds,
    champions: init.champions,
    clueIndex: 0,
    clues: [],
    votes: {},
    phaseEndsAt: init.now + init.settings.assignmentSeconds * 1000,
    acknowledged: [],
    reveal: null,
  };
}

export function impostorTick(
  state: ImpostorState,
  ctx: ImpostorContext,
): Result<ImpostorState> {
  if (state.phase === "REVEAL") return { state, effects: [] };
  if (ctx.now < state.phaseEndsAt) return { state, effects: [] };
  return advance(state, ctx);
}

export function impostorAck(
  state: ImpostorState,
  playerId: string,
  ctx: ImpostorContext,
): Result<ImpostorState> {
  if (state.phase !== "ASSIGNMENT") {
    return {
      state,
      effects: [],
      reject: { code: "WRONG_PHASE", message: "La asignación ya cerró" },
    };
  }
  if (state.acknowledged.includes(playerId)) {
    return { state, effects: [] };
  }
  const acknowledged = [...state.acknowledged, playerId];
  const next = { ...state, acknowledged };
  if (acknowledged.length >= state.order.length) return advance(next, ctx);
  return { state: next, effects: [] };
}

export function impostorClue(
  state: ImpostorState,
  playerId: string,
  text: string,
  ctx: ImpostorContext,
): Result<ImpostorState> {
  if (state.phase !== "CLUES") {
    return {
      state,
      effects: [],
      reject: { code: "WRONG_PHASE", message: "No es momento de dar pistas" },
    };
  }
  if (state.order[state.clueIndex] !== playerId) {
    return {
      state,
      effects: [],
      reject: { code: "NOT_YOUR_TURN", message: "No es tu turno" },
    };
  }

  const championId = state.assignment[playerId];
  const champion = championId ? state.champions[championId] : undefined;
  if (champion && containsChampionName(text, champion.name)) {
    return {
      state,
      effects: [],
      reject: {
        code: "NAME_IN_CLUE",
        message: "No puedes decir el nombre de tu campeón",
      },
    };
  }

  const clues = [...state.clues, { playerId, text }];
  const clueIndex = state.clueIndex + 1;
  if (clueIndex >= state.order.length) {
    return toDiscussion({ ...state, clues, clueIndex }, ctx, []);
  }
  return {
    state: {
      ...state,
      clues,
      clueIndex,
      phaseEndsAt: ctx.now + state.settings.clueSeconds * 1000,
    },
    effects: [],
  };
}

export function impostorVote(
  state: ImpostorState,
  playerId: string,
  targetId: string | null,
  ctx: ImpostorContext,
): Result<ImpostorState> {
  if (state.phase !== "VOTING") {
    return {
      state,
      effects: [],
      reject: { code: "WRONG_PHASE", message: "La votación no está abierta" },
    };
  }
  if (Object.prototype.hasOwnProperty.call(state.votes, playerId)) {
    return {
      state,
      effects: [],
      reject: { code: "ALREADY_VOTED", message: "Ya votaste" },
    };
  }
  if (targetId !== null) {
    if (targetId === playerId || !state.order.includes(targetId)) {
      return {
        state,
        effects: [],
        reject: { code: "INVALID_TARGET", message: "Voto inválido" },
      };
    }
  }

  const votes = { ...state.votes, [playerId]: targetId };
  const next = { ...state, votes };

  if (Object.keys(votes).length >= state.order.length) return tally(next, ctx, []);
  return { state: next, effects: [] };
}

export function impostorPublicView(state: ImpostorState, now: number) {
  return {
    mode: "impostor" as const,
    phase: state.phase,
    phaseEndsAt: state.phaseEndsAt,
    clueOrder: [...state.order],
    clueIndex: state.clueIndex,
    clues: state.clues,
    votesSubmitted: Object.keys(state.votes),
    reveal: state.phase === "REVEAL" ? state.reveal : null,
  };
}

export function impostorPrivateView(state: ImpostorState, playerId: string) {
  const championId = state.assignment[playerId];
  return {
    mode: "impostor" as const,
    champion: championId ? (state.champions[championId] ?? null) : null,
    yourVote: Object.prototype.hasOwnProperty.call(state.votes, playerId)
      ? (state.votes[playerId] ?? null)
      : null,
    hasVoted: Object.prototype.hasOwnProperty.call(state.votes, playerId),
    mustSubmitClue:
      state.phase === "CLUES" && state.order[state.clueIndex] === playerId,
  };
}

export function impostorResults(state: ImpostorState) {
  if (!state.reveal) {
    return { winners: [], scores: {} as Record<string, number> };
  }
  return { winners: state.reveal.winners, scores: state.reveal.scores };
}
