import { describe, expect, it } from "vitest";
import { createRng } from "../core/rng";
import { createQuienSoy, quienSoyAnswer, quienSoyGuess, quienSoyQuestion } from "./engine";

const champions = { A: { id: "A", name: "A", imageUrl: "" }, B: { id: "B", name: "B", imageUrl: "" } };
const make = () => createQuienSoy({ playerIds: ["one", "two", "three"], settings: { turnSeconds: 60 }, champions, now: 0, rng: createRng(2) });
describe("quien soy", () => {
  it("assigns identities privately and enforces turns", () => {
    const state = make();
    expect(Object.keys(state.identities)).toHaveLength(3);
    expect(quienSoyQuestion(state, "two", "¿Tiene alas?").reject?.code).toBe("NOT_YOUR_TURN");
    const asked = quienSoyQuestion(state, "one", " ¿Tiene alas? ").state;
    expect(asked.question?.text).toBe("¿Tiene alas?");
    expect(quienSoyAnswer(asked, "one", true).reject?.code).toBe("ALREADY_VOTED");
  });
  it("moves to the next player after a wrong guess and does not expose own identity", () => {
    const state = make();
    const own = state.identities.one;
    const wrong = own === "A" ? "B" : "A";
    const result = quienSoyGuess(state, "one", wrong, { now: 1, rng: createRng(3) });
    expect(result.state.activeIndex).toBe(1);
    expect(Object.keys(result.state.identities).length).toBe(3);
  });
});
