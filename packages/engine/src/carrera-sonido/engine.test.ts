import { describe, expect, it } from "vitest";
import { createRng } from "../core/rng";
import { createCarreraSonido, carreraSonidoAnswer, carreraSonidoPrivateView, carreraSonidoPublicView, carreraSonidoResults, carreraSonidoTick } from "./engine";

const champions = { A: { id: "A", name: "A", imageUrl: "" }, B: { id: "B", name: "B", imageUrl: "" } };
const clues = [
  { clueId: "audio-a-1", championId: "A", audioUrl: "/api/audio-clues/audio-a-1" },
  { clueId: "audio-a-2", championId: "A", audioUrl: "/api/audio-clues/audio-a-2" },
];

describe("carrera de pistas: sonido", () => {
  it("reveals only opaque audio clues and lets others answer for decreasing points", () => {
    const state = createCarreraSonido({ playerIds: ["p1", "p2"], settings: { clueSeconds: 5, rounds: 1 }, champions, clues, now: 0, rng: createRng(1) });
    const target = state.targetId;
    const winner = carreraSonidoAnswer(state, "p1", target, { now: 1, rng: createRng(2), clues }).state;
    const publicView = carreraSonidoPublicView(winner);
    expect(publicView.clues[0]?.audioUrl).toContain("audio-a-1");
    expect(publicView.clues[0]).not.toHaveProperty("championId");
    expect(publicView.target).toBeNull();
    expect(winner.phase).toBe("CLUES");
    expect(winner.winnerId).toBe("p1");
    expect(carreraSonidoPrivateView(winner, "p1").revealedTarget?.id).toBe(target);
    expect(carreraSonidoPrivateView(winner, "p2").revealedTarget).toBeNull();
    expect(carreraSonidoResults(winner).scores.p1).toBe(1000);
    const second = carreraSonidoAnswer(winner, "p2", target, { now: 2, rng: createRng(2), clues }).state;
    expect(second.phase).toBe("REVEAL");
    expect(carreraSonidoResults(second).scores.p2).toBeLessThan(carreraSonidoResults(second).scores.p1!);
  });

  it("advances clues and finishes after the configured rounds", () => {
    const state = createCarreraSonido({ playerIds: ["p1", "p2"], settings: { clueSeconds: 5, rounds: 1 }, champions, clues, now: 0, rng: createRng(1) });
    const advanced = carreraSonidoTick(state, { now: 5_000, rng: createRng(2), clues }).state;
    expect(advanced.phase).toBe("CLUES");
    expect(advanced.clueIndex).toBe(1);
    const revealed = carreraSonidoTick(advanced, { now: 10_000, rng: createRng(2), clues }).state;
    expect(revealed.phase).toBe("REVEAL");
  });

  it("conserva puntos tras cambiar de ronda y premia más una pista temprana", () => {
    const ctx = (now: number) => ({ now, rng: createRng(2), clues });
    const state = createCarreraSonido({ playerIds: ["p1", "p2"], settings: { clueSeconds: 5, rounds: 2 }, champions, clues, now: 0, rng: createRng(1) });
    const later = carreraSonidoTick(state, ctx(5_000)).state;
    const scored = carreraSonidoAnswer(later, "p1", later.targetId, ctx(5_001)).state;
    expect(scored.scores.p1).toBe(800);
    const reveal = carreraSonidoTick(scored, ctx(10_000)).state;
    const next = carreraSonidoTick(reveal, ctx(16_000)).state;
    expect(next.scores.p1).toBe(800);
    const firstClue = carreraSonidoAnswer(next, "p2", next.targetId, ctx(16_001)).state;
    expect(firstClue.scores.p2).toBe(1000);
  });
});
