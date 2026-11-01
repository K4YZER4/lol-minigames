import { describe, expect, it } from "vitest";
import { createRng } from "../core/rng";
import { createDescripcion, descripcionClue, descripcionGuess, descripcionPrivateView, descripcionResults, type DescripcionChampion } from "./engine";

const champions: Record<string, DescripcionChampion> = {
  Ahri: { id: "Ahri", name: "Ahri", imageUrl: "ahri.png" },
  "LeeSin": { id: "LeeSin", name: "Lee Sin", imageUrl: "lee.png" },
};
const settings = { turnSeconds: 60 };
const make = () => createDescripcion({ playerIds: ["ana", "beto", "cata"], settings, champions, now: 1_000, rng: createRng(1) });

describe("descripcion engine", () => {
  it("keeps the objective private and only the describer can clue", () => {
    const state = make();
    const describer = state.order[0]!;
    const other = state.order[1]!;
    expect(descripcionPrivateView(state, describer).target).not.toBeNull();
    expect(descripcionPrivateView(state, other).target).toBeNull();
    expect(descripcionClue(state, other, "Una pista").reject?.code).toBe("NOT_YOUR_TURN");
  });

  it("rejects the target name in a clue", () => {
    const state = make();
    const target = state.champions[state.targetChampionId]!.name;
    expect(descripcionClue(state, state.order[0]!, `Es ${target}`).reject?.code).toBe("NAME_IN_CLUE");
  });

  it("validates a guess on the server and scores describer plus guesser", () => {
    const state = make();
    const describer = state.order[0]!;
    const guesser = state.order[1]!;
    const target = state.champions[state.targetChampionId]!.name;
    const result = descripcionGuess(state, guesser, `Creo que es ${target.toUpperCase()}`, { now: 2_000, rng: createRng(2), champions });
    expect(result.reject).toBeUndefined();
    expect(result.state.phase).toBe("REVEAL");
    expect(descripcionResults(result.state).scores).toEqual({ ana: 1, beto: 2, cata: 0 });
    expect(descripcionGuess(result.state, describer, target, { now: 2_000, rng: createRng(2), champions }).reject?.code).toBe("WRONG_PHASE");
  });
});
