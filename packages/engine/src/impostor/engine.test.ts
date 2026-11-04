import { describe, expect, it } from "vitest";
import {
  createImpostor,
  impostorAck,
  impostorClue,
  impostorPrivateView,
  impostorPublicView,
  impostorTick,
  impostorVote,
  type ChampionInfo,
  type ImpostorSettings,
  type ImpostorState,
} from "./engine";
import { createRng } from "../core/rng";

const champions: Record<string, ChampionInfo> = {
  Yasuo: { id: "Yasuo", name: "Yasuo", imageUrl: "yasuo.png" },
  Yone: { id: "Yone", name: "Yone", imageUrl: "yone.png" },
  Ahri: { id: "Ahri", name: "Ahri", imageUrl: "ahri.png" },
  Lux: { id: "Lux", name: "Lux", imageUrl: "lux.png" },
};

const pairs = [{ championId: "Yasuo", partnerId: "Yone" }];

const settings: ImpostorSettings = {
  assignmentSeconds: 15,
  clueSeconds: 20,
  discussionSeconds: 60,
  voteSeconds: 30,
};

function make(playerIds: string[], seed = 1, now = 1_000) {
  const rng = createRng(seed);
  const state = createImpostor({ playerIds, settings, pairs, champions, now, rng });
  return { state, rng };
}

function ctx(now: number, rng = createRng(9)) {
  return { now, rng, pairs, champions };
}

function startClues(state: ImpostorState, now = 2_000) {
  let current = state;
  for (const id of state.order) {
    current = impostorAck(current, id, ctx(now)).state;
  }
  return current;
}

/** Salta todas las pistas por timeout y la discusión, hasta llegar a la votación. */
function toVoting(state: ImpostorState, startNow = 3_000) {
  let current = state;
  let now = startNow;
  for (let i = 0; i < current.order.length; i++) {
    current = impostorTick({ ...current, phaseEndsAt: 0 }, ctx(now++)).state;
  }
  current = impostorTick({ ...current, phaseEndsAt: 0 }, ctx(now++)).state;
  return current;
}

describe("impostor", () => {
  it("asigna un infiltrado con 4 jugadores y dos con 7", () => {
    expect(make(["p1", "p2", "p3", "p4"]).state.impostorIds).toHaveLength(1);
    expect(make(["p1", "p2", "p3", "p4", "p5", "p6", "p7"]).state.impostorIds).toHaveLength(2);
  });

  it("el infiltrado recibe el campeón relacionado y la mayoría el otro", () => {
    const { state } = make(["p1", "p2", "p3", "p4"]);
    const impostor = state.impostorIds[0]!;
    expect(state.assignment[impostor]).toBe("Yone");
    for (const id of state.order) {
      if (id !== impostor) expect(state.assignment[id]).toBe("Yasuo");
    }
  });

  it("la vista privada no revela que eres el infiltrado", () => {
    const { state } = make(["p1", "p2", "p3", "p4"]);
    const impostor = state.impostorIds[0]!;
    const view = impostorPrivateView(state, impostor) as Record<string, unknown>;
    expect(view).not.toHaveProperty("isImpostor");
    expect(view).not.toHaveProperty("impostorIds");
    expect(view.champion).toMatchObject({ id: "Yone" });
  });

  it("nunca entrega el campeón de otro jugador", () => {
    const { state } = make(["p1", "p2", "p3", "p4"]);
    const view = impostorPrivateView(state, "p1") as Record<string, unknown>;
    const json = JSON.stringify(view);
    for (const id of state.order) {
      if (id === "p1") continue;
      const own = state.assignment[id]!;
      const other = state.assignment["p1"]!;
      if (own !== other) expect(json).not.toContain(own);
    }
  });

  it("la vista pública no expone asignaciones ni votos", () => {
    const { state } = make(["p1", "p2", "p3", "p4"]);
    const view = impostorPublicView(state, 2_000) as Record<string, unknown>;
    expect(view).not.toHaveProperty("assignment");
    expect(view).not.toHaveProperty("votes");
    expect(view).not.toHaveProperty("impostorIds");
  });

  it("pasa a CLUES cuando todos confirman", () => {
    const { state } = make(["p1", "p2", "p3", "p4"]);
    const next = startClues(state);
    expect(next.phase).toBe("CLUES");
    expect(next.clueIndex).toBe(0);
  });

  it("respeta el orden de las pistas", () => {
    const { state } = make(["p1", "p2", "p3", "p4"]);
    const clues = startClues(state);
    const notFirst = clues.order[1]!;
    const rejected = impostorClue(clues, notFirst, "algo", ctx(3_000));
    expect(rejected.reject?.code).toBe("NOT_YOUR_TURN");
  });

  it("rechaza una pista que dice el nombre del campeón", () => {
    const { state } = make(["p1", "p2", "p3", "p4"]);
    const clues = startClues(state);
    const first = clues.order[0]!;
    const championId = clues.assignment[first]!;
    const name = champions[championId]!.name;
    const rejected = impostorClue(clues, first, `es como ${name}`, ctx(3_000));
    expect(rejected.reject?.code).toBe("NAME_IN_CLUE");
  });

  it("acepta una pista válida y avanza el turno", () => {
    const { state } = make(["p1", "p2", "p3", "p4"]);
    const clues = startClues(state);
    const first = clues.order[0]!;
    const result = impostorClue(clues, first, "espada y viento", ctx(3_000));
    expect(result.reject).toBeUndefined();
    expect(result.state.clueIndex).toBe(1);
    expect(result.state.clues).toHaveLength(1);
  });

  it("gana la tripulación si el más votado es el infiltrado", () => {
    const { state } = make(["p1", "p2", "p3", "p4"]);
    const impostor = state.impostorIds[0]!;
    let current = toVoting(startClues(state));
    expect(current.phase).toBe("VOTING");

    for (const id of current.order) {
      const target = id === impostor ? "p1" : impostor;
      current = impostorVote(current, id, target === id ? null : target, ctx(5_000)).state;
    }
    expect(current.phase).toBe("REVEAL");
    expect(current.reveal?.caught).toBe(true);
    expect(current.reveal?.winners).not.toContain(impostor);
    expect(current.reveal?.scores[current.order.find((id) => id !== impostor)!]).toBe(1000);
  });

  it("gana el infiltrado cuando hay empate", () => {
    const { state } = make(["p1", "p2", "p3", "p4"]);
    const impostor = state.impostorIds[0]!;
    let current = toVoting(startClues(state));

    current = impostorVote(current, "p1", "p2", ctx(5_000)).state;
    current = impostorVote(current, "p2", "p1", ctx(5_000)).state;
    current = impostorVote(current, "p3", null, ctx(5_000)).state;
    current = impostorVote(current, "p4", null, ctx(5_000)).state;

    expect(current.phase).toBe("REVEAL");
    expect(current.reveal?.caught).toBe(false);
    expect(current.reveal?.winners).toContain(impostor);
    expect(current.reveal?.scores[impostor]).toBe(1000);
  });

  it("gana el infiltrado si nadie vota", () => {
    const { state } = make(["p1", "p2", "p3", "p4"]);
    let current = toVoting(startClues(state));
    for (const id of current.order) {
      current = impostorVote(current, id, null, ctx(5_000)).state;
    }
    expect(current.reveal?.caught).toBe(false);
  });

  it("rechaza votar dos veces y votarse a sí mismo", () => {
    const { state } = make(["p1", "p2", "p3", "p4"]);
    let current = toVoting(startClues(state));

    expect(impostorVote(current, "p1", "p1", ctx(5_000)).reject?.code).toBe("INVALID_TARGET");
    current = impostorVote(current, "p1", "p2", ctx(5_000)).state;
    expect(impostorVote(current, "p1", "p3", ctx(5_000)).reject?.code).toBe("ALREADY_VOTED");
  });

  it("no acepta pistas fuera de fase", () => {
    const { state } = make(["p1", "p2", "p3", "p4"]);
    const result = impostorClue(state, "p1", "algo", ctx(2_000));
    expect(result.reject?.code).toBe("WRONG_PHASE");
  });
});
