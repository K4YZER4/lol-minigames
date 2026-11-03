import { describe, expect, it } from "vitest";
import { createRng } from "../core/rng";
import { carreraEmojisPublicView, carreraEmojisTick, createCarreraEmojis } from "./engine";

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
});
