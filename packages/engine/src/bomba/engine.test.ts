import { describe, expect, it } from "vitest";
import {
  bombaAnswer,
  bombaPrivateView,
  bombaPublicView,
  bombaTick,
  createBomba,
  type BombaClue,
  type BombaSettings,
  type BombaState,
} from "./engine";
import { createRng } from "../core/rng";

const clues: BombaClue[] = [
  { clueId: "c1", championId: "Ahri", kind: "spell", imageUrl: "ahri.png" },
  { clueId: "c2", championId: "Lux", kind: "spell", imageUrl: "lux.png" },
  { clueId: "c3", championId: "Yasuo", kind: "spell", imageUrl: "yasuo.png" },
];

const settings: BombaSettings = {
  lives: 2,
  minFuseMs: 10_000,
  maxFuseMs: 30_000,
  penaltyMs: 1_000,
  minMarginMs: 3_000,
};

function make(now = 1_000, playerIds = ["p1", "p2", "p3"]) {
  const rng = createRng(42);
  const state = createBomba({ playerIds, settings, clues, now, rng });
  return { state, rng };
}

function ctx(now: number, rng = createRng(7)) {
  return { now, rng, clues };
}

describe("bomba", () => {
  it("inicia con vidas completas y una mecha dentro del rango", () => {
    const { state } = make();
    expect(state.lives).toEqual({ p1: 2, p2: 2, p3: 2 });
    expect(state.order).toEqual(["p1", "p2", "p3"]);
    expect(state.fuseEndsAt - state.fuseStartedAt).toBeGreaterThanOrEqual(10_000);
    expect(state.fuseEndsAt - state.fuseStartedAt).toBeLessThanOrEqual(30_000);
    expect(state.answerChampionId).not.toBeNull();
  });

  it("acertar pasa la bomba y no reinicia la mecha", () => {
    const { state, rng } = make();
    const result = bombaAnswer(state, "p1", state.answerChampionId!, ctx(2_000, rng));
    expect(result.reject).toBeUndefined();
    expect(result.state.order[result.state.activeIndex]).toBe("p2");
    expect(result.state.fuseEndsAt).toBe(state.fuseEndsAt);
    expect(result.state.answerChampionId).not.toBe(state.answerChampionId);
    expect(result.effects[0]?.type).toBe("bomba:correct");
  });

  it("fallar descuenta tiempo de la mecha", () => {
    const { state, rng } = make();
    const result = bombaAnswer(state, "p1", "Garen", ctx(2_000, rng));
    expect(result.reject?.code).toBe("WRONG_ANSWER");
    expect(result.state.fuseEndsAt).toBe(state.fuseEndsAt - 1_000);
    expect(result.state.order[result.state.activeIndex]).toBe("p1");
  });

  it("fallar con la mecha al límite hace explotar", () => {
    const { state, rng } = make();
    const near: BombaState = { ...state, fuseEndsAt: 2_500 };
    const result = bombaAnswer(near, "p1", "Garen", ctx(2_000, rng));
    expect(result.reject?.code).toBe("WRONG_ANSWER");
    expect(result.state.lives.p1).toBe(1);
    expect(result.state.explosions).toBe(1);
  });

  it("una respuesta tardía resuelve primero la explosión", () => {
    const { state, rng } = make();
    const result = bombaAnswer(state, "p1", state.answerChampionId!, ctx(state.fuseEndsAt + 1, rng));
    expect(result.reject?.code).toBe("LATE");
    expect(result.state.lives.p1).toBe(1);
    expect(result.state.explosions).toBe(1);
  });

  it("rechaza a quien no está en su turno", () => {
    const { state, rng } = make();
    const result = bombaAnswer(state, "p2", state.answerChampionId!, ctx(2_000, rng));
    expect(result.reject?.code).toBe("NOT_YOUR_TURN");
    expect(result.state).toBe(state);
  });

  it("garantiza el margen mínimo al pasar la bomba", () => {
    const { state, rng } = make();
    const tight: BombaState = { ...state, fuseEndsAt: 2_500 };
    const result = bombaAnswer(tight, "p1", tight.answerChampionId!, ctx(2_000, rng));
    expect(result.state.fuseEndsAt).toBe(2_000 + settings.minMarginMs);
  });

  it("al quedarse sin vidas el jugador sale del turno", () => {
    const { state, rng } = make();
    const oneLife: BombaState = { ...state, lives: { p1: 1, p2: 2, p3: 2 } };
    const exploded = bombaTick({ ...oneLife, fuseEndsAt: 1_500 }, ctx(2_000, rng));
    expect(exploded.state.lives.p1).toBe(0);
    expect(exploded.state.order[exploded.state.activeIndex]).toBe("p2");
    expect(exploded.effects[0]).toMatchObject({ type: "bomba:explosion", eliminated: true });
  });

  it("termina cuando queda un solo superviviente", () => {
    const rng = createRng(3);
    let state = createBomba({
      playerIds: ["p1", "p2", "p3"],
      settings: { ...settings, lives: 1 },
      clues,
      now: 1_000,
      rng,
    });
    state = bombaTick({ ...state, fuseEndsAt: 1_500 }, ctx(2_000, rng)).state;
    expect(state.phase).toBe("ACTIVE");
    state = bombaTick({ ...state, fuseEndsAt: 2_500 }, ctx(3_000, rng)).state;
    expect(state.phase).toBe("FINISHED");
    expect(state.winners).toHaveLength(1);
  });

  it("no hace nada antes del vencimiento", () => {
    const { state, rng } = make();
    const result = bombaTick(state, ctx(state.fuseEndsAt - 1, rng));
    expect(result.state).toBe(state);
    expect(result.effects).toHaveLength(0);
  });

  it("la vista pública no filtra la respuesta ni el vencimiento", () => {
    const { state } = make();
    const view = bombaPublicView(state, 2_000) as Record<string, unknown>;
    expect(view).not.toHaveProperty("answerChampionId");
    expect(view).not.toHaveProperty("fuseEndsAt");
    expect(view).not.toHaveProperty("lives");
    expect(JSON.stringify(view)).not.toContain(state.answerChampionId!);
  });

  it("la vista privada solo entrega la pista al jugador activo", () => {
    const { state } = make();
    const active = bombaPrivateView(state, "p1");
    const other = bombaPrivateView(state, "p2");
    expect(active.clue).not.toBeNull();
    expect(active.youAreActive).toBe(true);
    expect(other.clue).toBeNull();
    expect(other.youAreActive).toBe(false);
  });
});
