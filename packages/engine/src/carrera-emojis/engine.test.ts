import { describe, expect, it } from "vitest";
import { createRng } from "../core/rng";
import { carreraEmojisAnswer, carreraEmojisPrivateView, carreraEmojisPublicView, carreraEmojisResults, carreraEmojisTick, createCarreraEmojis } from "./engine";

const champions = { A: { id: "A", name: "A", imageUrl: "" }, B: { id: "B", name: "B", imageUrl: "" } };
const clues = [
  { clueId: "emoji-a-0", championId: "A", emojis: ["🦊", "💗", "✨", "🔥"] },
  { clueId: "emoji-a-1", championId: "A", emojis: ["🐾", "💘", "🌌", "🎯"] },
  { clueId: "emoji-b-0", championId: "B", emojis: ["🍄", "🏹", "🌿", "🧢"] },
];

describe("carrera de emojis", () => {
  it("reveals one emoji at a time and never exposes the answer id", () => {
    const state = createCarreraEmojis({ playerIds: ["p1", "p2"], settings: { clueSeconds: 5, rounds: 1 }, champions, clues, now: 0, rng: createRng(1) });
    const first = carreraEmojisPublicView(state);
    expect(first.clues[0]?.emojis).toHaveLength(1);
    expect(first.clues[0]).not.toHaveProperty("championId");
    const secondState = carreraEmojisTick(state, { now: 5_000, rng: createRng(2), clues }).state;
    expect(carreraEmojisPublicView(secondState).clues[0]?.emojis).toHaveLength(2);
  });
  it("mantiene la ronda abierta tras el primer acierto y conserva puntos de todos", () => {
    const state = createCarreraEmojis({ playerIds: ["p1", "p2"], settings: { clueSeconds: 5, rounds: 1 }, champions, clues, now: 0, rng: createRng(1) });
    const ctx = { now: 1, rng: createRng(2), clues };
    const first = carreraEmojisAnswer(state, "p1", state.targetId, ctx).state;
    expect(first.phase).toBe("CLUES");
    expect(carreraEmojisPublicView(first).target).toBeNull();
    expect(carreraEmojisResults(first).scores.p1).toBe(1000);
    expect(carreraEmojisPrivateView(first, "p1").revealedTarget?.id).toBe(state.targetId);
    expect(carreraEmojisPrivateView(first, "p2").revealedTarget).toBeNull();
    const second = carreraEmojisAnswer(first, "p2", state.targetId, { ...ctx, now: 2 }).state;
    expect(second.phase).toBe("REVEAL");
    expect(carreraEmojisResults(second).scores.p2).toBeLessThan(carreraEmojisResults(second).scores.p1!);
  });
  it("cierra la ronda cuando todos fallaron su única oportunidad", () => {
    const state = createCarreraEmojis({ playerIds: ["p1", "p2"], settings: { clueSeconds: 5, rounds: 1 }, champions, clues, now: 0, rng: createRng(1) });
    const wrong = state.targetId === "A" ? "B" : "A";
    const first = carreraEmojisAnswer(state, "p1", wrong, { now: 1, rng: createRng(2), clues });
    expect(first.state.phase).toBe("CLUES");
    const second = carreraEmojisAnswer(first.state, "p2", wrong, { now: 2, rng: createRng(2), clues });
    expect(second.state.phase).toBe("REVEAL");
    expect(carreraEmojisPublicView(second.state).target?.id).toBe(state.targetId);
  });

  it("acumula los puntos tras pasar a la siguiente ronda", () => {
    const ctx = (now: number) => ({ now, rng: createRng(2), clues });
    const state = createCarreraEmojis({ playerIds: ["p1", "p2"], settings: { clueSeconds: 5, rounds: 2 }, champions, clues, now: 0, rng: createRng(1) });
    const first = carreraEmojisAnswer(state, "p1", state.targetId, ctx(1)).state;
    let reveal = first;
    for (const time of [5_000, 10_000, 15_000, 20_000]) reveal = carreraEmojisTick(reveal, ctx(time)).state;
    const next = carreraEmojisTick(reveal, ctx(26_000)).state;
    expect(next.round).toBe(1);
    expect(next.scores.p1).toBe(1000);
    const second = carreraEmojisAnswer(next, "p2", next.targetId, ctx(26_001)).state;
    expect(second.scores.p2).toBe(1000);
  });
});
