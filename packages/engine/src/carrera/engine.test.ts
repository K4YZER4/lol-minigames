import { describe, expect, it } from "vitest";
import { createCarrera, carreraAnswer, carreraResults, carreraTick, carreraPrivateView, carreraPublicView } from "./engine";
import { createRng } from "../core/rng";

const champions = { Ahri: { id: "Ahri", name: "Ahri", imageUrl: "" }, Garen: { id: "Garen", name: "Garen", imageUrl: "" } };
const clues = [
  { clueId: "a1", championId: "Ahri", kind: "spell" as const, imageUrl: "" },
  { clueId: "a2", championId: "Ahri", kind: "spell" as const, imageUrl: "" },
];
const ctx = (now: number) => ({ now, rng: createRng(2), clues });
const init = (rounds = 1) => createCarrera({ playerIds: ["p1", "p2", "p3"], settings: { clueSeconds: 5, rounds }, champions, clues, now: 0, rng: createRng(1) });

describe("carrera engine", () => {
  it("permite acertar a todos sin revelar tras el primer acierto y otorga menos puntos después", () => {
    const state = init();
    const first = carreraAnswer(state, "p1", state.targetId, ctx(1)).state;
    expect(first.phase).toBe("CLUES");
    expect(carreraPrivateView(first, "p2").hasAnswered).toBe(false);
    expect(first.winnerId).toBe("p1");
    expect(carreraPublicView(first, 1).target).toBeNull();
    expect(carreraPrivateView(first, "p1").revealedTarget?.id).toBe(state.targetId);
    expect(carreraPrivateView(first, "p2").revealedTarget).toBeNull();
    expect(carreraResults(first).scores.p1).toBe(1000);
    const second = carreraAnswer(first, "p2", state.targetId, ctx(2)).state;
    expect(second.phase).toBe("CLUES");
    expect(carreraPrivateView(second, "p2").revealedTarget?.id).toBe(state.targetId);
    expect(carreraResults(second).scores.p2).toBeLessThan(carreraResults(second).scores.p1!);
    expect(carreraAnswer(second, "p1", state.targetId, ctx(3)).reject?.code).toBe("ALREADY_ANSWERED");
    const third = carreraAnswer(second, "p3", state.targetId, ctx(4)).state;
    expect(third.phase).toBe("REVEAL");
    expect(carreraPrivateView(third, "p3").revealedTarget?.id).toBe(state.targetId);
  });

  it("acumula puntuación entre rondas y reduce puntos con pistas posteriores", () => {
    const state = init(2);
    const laterClue = carreraTick(state, ctx(5_000)).state;
    const firstRound = carreraAnswer(laterClue, "p1", state.targetId, ctx(5_001)).state;
    expect(carreraResults(firstRound).scores.p1).toBeLessThan(1000);
    const revealed = carreraTick(firstRound, ctx(10_000)).state;
    const next = carreraTick(revealed, ctx(16_000)).state;
    expect(next.round).toBe(1);
    expect(carreraResults(next).scores.p1).toBe(carreraResults(firstRound).scores.p1);
    const another = carreraAnswer(next, "p2", next.targetId, ctx(16_001)).state;
    expect(carreraResults(another).scores.p2).toBe(1000);
  });

  it("revela al agotarse todas las pistas y termina después del tiempo de revelación", () => {
    const state = init();
    const second = carreraTick(state, ctx(5_000)).state;
    const reveal = carreraTick(second, ctx(10_000)).state;
    expect(reveal.phase).toBe("REVEAL");
    const done = carreraTick(reveal, ctx(16_000)).state;
    expect(done.phase).toBe("FINISHED");
  });
});
