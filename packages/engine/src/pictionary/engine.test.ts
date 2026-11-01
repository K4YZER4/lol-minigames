import { describe, expect, it } from "vitest";
import { createRng } from "../core/rng";
import {
  createPictionary,
  pictionaryGuess,
  pictionaryPrivateView,
  pictionaryStroke,
  type PictionaryChampion,
} from "./engine";

const champions: Record<string, PictionaryChampion> = {
  Ahri: { id: "Ahri", name: "Ahri", imageUrl: "ahri.png" },
  Lux: { id: "Lux", name: "Lux", imageUrl: "lux.png" },
};
const settings = { drawingSeconds: 90 };

describe("pictionary engine", () => {
  it("keeps the target private and accepts strokes only from the drawer", () => {
    const state = createPictionary({ playerIds: ["ana", "beto"], settings, champions, now: 1_000, rng: createRng(1) });
    const drawer = state.order[0]!;
    const other = state.order[1]!;
    expect(pictionaryPrivateView(state, drawer).target).not.toBeNull();
    expect(pictionaryPrivateView(state, other).target).toBeNull();
    expect(pictionaryStroke(state, other, [{ x: 0, y: 0 }, { x: 1, y: 1 }]).reject?.code).toBe("NOT_YOUR_TURN");
    expect(pictionaryStroke(state, drawer, [{ x: 0, y: 0 }, { x: 1, y: 1 }]).state.strokes).toHaveLength(1);
  });

  it("scores a correct guess and reveals the target", () => {
    const state = createPictionary({ playerIds: ["ana", "beto"], settings, champions, now: 1_000, rng: createRng(1) });
    const drawer = state.order[0]!;
    const guesser = state.order[1]!;
    const target = state.targetChampionId;
    const result = pictionaryGuess(state, guesser, target, { now: 2_000, rng: createRng(2), champions });
    expect(result.reject).toBeUndefined();
    expect(result.state.phase).toBe("REVEAL");
    expect(result.state.guesses).toContain(guesser);
    expect(pictionaryGuess(result.state, drawer, target, { now: 2_000, rng: createRng(2), champions }).reject?.code).toBe("WRONG_PHASE");
  });
});
