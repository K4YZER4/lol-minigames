import type { Result, Rng } from "../core/rng";

export type UnicaChampion = { id: string; name: string; imageUrl: string; tags: string[] };
export type UnicaSettings = { answerSeconds: number };
export type UnicaState = {
  phase: "SUBMISSION" | "REVEAL";
  settings: UnicaSettings;
  order: string[];
  category: string;
  categoryTag: string;
  champions: Record<string, UnicaChampion>;
  answers: Record<string, string>;
  phaseEndsAt: number;
};
export type UnicaContext = { now: number; rng: Rng; champions: Record<string, UnicaChampion> };
export type UnicaInit = { playerIds: string[]; settings: UnicaSettings; champions: Record<string, UnicaChampion>; now: number; rng: Rng };

const CATEGORIES = [
  ["un luchador", "Fighter"],
  ["un mago", "Mage"],
  ["un asesino", "Assassin"],
  ["un tanque", "Tank"],
  ["un tirador", "Marksman"],
  ["un soporte", "Support"],
] as const;

export function createUnica(init: UnicaInit): UnicaState {
  const [category, categoryTag] = init.rng.pick(CATEGORIES);
  return { phase: "SUBMISSION", settings: init.settings, order: [...init.playerIds], category, categoryTag, champions: init.champions, answers: {}, phaseEndsAt: init.now + init.settings.answerSeconds * 1000 };
}

export function unicaSubmit(state: UnicaState, playerId: string, championId: string): Result<UnicaState> {
  if (state.phase !== "SUBMISSION") return { state, effects: [], reject: { code: "WRONG_PHASE", message: "La ronda ya terminó" } };
  if (state.answers[playerId]) return { state, effects: [], reject: { code: "ALREADY_GUESSED", message: "Ya enviaste tu respuesta" } };
  const champion = state.champions[championId];
  if (!champion) return { state, effects: [], reject: { code: "UNKNOWN_CHAMPION", message: "Ese campeón no existe" } };
  if (!champion.tags.includes(state.categoryTag)) return { state, effects: [], reject: { code: "INVALID_CATEGORY", message: "Ese campeón no pertenece a la categoría" } };
  return { state: { ...state, answers: { ...state.answers, [playerId]: championId } }, effects: [] };
}

export function unicaTick(state: UnicaState, ctx: UnicaContext): Result<UnicaState> {
  if (ctx.now < state.phaseEndsAt || state.phase === "REVEAL") return { state, effects: [] };
  return { state: { ...state, phase: "REVEAL", phaseEndsAt: ctx.now }, effects: [] };
}

export function unicaPublicView(state: UnicaState) {
  const counts = new Map<string, number>();
  for (const id of Object.values(state.answers)) counts.set(id, (counts.get(id) ?? 0) + 1);
  const answers = state.phase === "REVEAL" ? state.order.map((playerId) => {
    const championId = state.answers[playerId];
    return { playerId, champion: championId ? state.champions[championId] ?? null : null, duplicate: Boolean(championId && (counts.get(championId) ?? 0) > 1) };
  }) : [];
  return { mode: "unica" as const, phase: state.phase, phaseEndsAt: state.phaseEndsAt, category: state.category, submitted: Object.keys(state.answers), answers };
}

export function unicaPrivateView(state: UnicaState, playerId: string) {
  const championId = state.answers[playerId];
  return { mode: "unica" as const, yourAnswer: championId ? state.champions[championId] ?? null : null, hasSubmitted: Boolean(championId) };
}

export function unicaResults(state: UnicaState) {
  const counts = new Map<string, number>();
  for (const id of Object.values(state.answers)) counts.set(id, (counts.get(id) ?? 0) + 1);
  const scores: Record<string, number> = {};
  for (const playerId of state.order) {
    const answer = state.answers[playerId];
    scores[playerId] = answer && counts.get(answer) === 1 ? 1 : 0;
  }
  return { scores };
}
