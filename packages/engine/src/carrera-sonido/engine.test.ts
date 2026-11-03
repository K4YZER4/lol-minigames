import { describe, expect, it } from "vitest";
import { createRng } from "../core/rng";
import { createCarreraSonido, carreraSonidoAnswer, carreraSonidoPublicView, carreraSonidoResults, carreraSonidoTick } from "./engine";

const champions = { A: { id: "A", name: "A", imageUrl: "" }, B: { id: "B", name: "B", imageUrl: "" } };
const clues = [
  { clueId: "audio-a-1", championId: "A", audioUrl: "/api/audio-clues/audio-a-1" },
  { clueId: "audio-a-2", championId: "A", audioUrl: "/api/audio-clues/audio-a-2" },
];

describe("carrera de pistas: sonido", () => {
  it("reveals only opaque audio clues and scores earlier answers higher", () => {
    const state = createCarreraSonido({ playerIds: ["p1", "p2"], settings: { clueSeconds: 5, rounds: 1 }, champions, clues, now: 0, rng: createRng(1) });
    const target = state.targetId;
    const winner = carreraSonidoAnswer(state, "p1", target, { now: 1, rng: createRng(2), clues }).state;
    const publicView = carreraSonidoPublicView(winner);
    expect(publicView.clues[0]?.audioUrl).toContain("audio-a-1");
    expect(publicView.clues[0]).not.toHaveProperty("championId");
    expect(carreraSonidoResults(winner).scores.p1).toBe(2);
  });

  it("advances clues and finishes after the configured rounds", () => {
    const state = createCarreraSonido({ playerIds: ["p1", "p2"], settings: { clueSeconds: 5, rounds: 1 }, champions, clues, now: 0, rng: createRng(1) });
    const advanced = carreraSonidoTick(state, { now: 5_000, rng: createRng(2), clues }).state;
    expect(advanced.phase).toBe("CLUES");
    expect(advanced.clueIndex).toBe(1);
    const revealed = carreraSonidoTick(advanced, { now: 10_000, rng: createRng(2), clues }).state;
    expect(revealed.phase).toBe("REVEAL");
  });
});
