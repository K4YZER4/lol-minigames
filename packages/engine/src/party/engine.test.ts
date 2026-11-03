import { describe, expect, it } from "vitest";
import { createRng } from "../core/rng";
import { createParty, partyGuess, partyPrivateView, partyTick } from "./engine";

const champions = {
  A: { id: "A", name: "A", imageUrl: "", tags: ["Fighter"] },
  B: { id: "B", name: "B", imageUrl: "", tags: ["Mage"] },
};
const settings = { category: "roles" as const, turnSeconds: 20, rounds: 2 };

describe("party engine", () => {
  it("keeps the target private and rejects the active player", () => {
    const state = createParty({ playerIds: ["p1", "p2", "p3"], settings, champions, now: 0, rng: createRng(1) });
    expect(partyPrivateView(state, "p1").target).not.toBeNull();
    expect(partyPrivateView(state, "p2").target).toBeNull();
    expect(partyGuess(state, "p1", "A").reject?.code).toBe("NOT_YOUR_TURN");
  });

  it("scores a guess server-side and advances rounds only on the clock", () => {
    const state = { ...createParty({ playerIds: ["p1", "p2", "p3"], settings, champions, now: 0, rng: createRng(1) }), targetId: "A" };
    const guessed = partyGuess(state, "p2", "A");
    expect(guessed.state.guesses.p2).toBe(true);
    expect(partyTick(guessed.state, { now: 19_999, rng: createRng(2), champions }).state.round).toBe(1);
    expect(partyTick(guessed.state, { now: 20_000, rng: createRng(2), champions }).state.round).toBe(2);
  });
});
