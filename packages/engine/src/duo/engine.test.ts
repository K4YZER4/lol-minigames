import { describe, expect, it } from "vitest";
import { createRng } from "../core/rng";
import { createDuo, duoPrivateView, duoResults, duoSubmit, duoTick } from "./engine";

const champions = { a: { id: "a", name: "A", imageUrl: "a" }, b: { id: "b", name: "B", imageUrl: "b" }, c: { id: "c", name: "C", imageUrl: "c" }, d: { id: "d", name: "D", imageUrl: "d" } };

describe("Dúo a ciegas", () => {
  it("oculta asignaciones y solo permite adivinar a la pareja", () => {
    const state = createDuo({ playerIds: ["p1", "p2", "p3", "p4"], settings: { guessSeconds: 60 }, champions, now: 0, rng: createRng(1) });
    const privateView = duoPrivateView(state, "p1");
    expect(privateView.ownChampion).not.toBeNull();
    expect(privateView.partnerId).not.toBeNull();
    const submitted = duoSubmit(state, "p1", privateView.ownChampion!.id).state;
    expect(submitted.guesses.p1).toBe(privateView.ownChampion!.id);
    expect(duoSubmit(submitted, "p1", "a").reject?.code).toBe("ALREADY_GUESSED");
  });

  it("revela al terminar y puntúa únicamente aciertos cruzados", () => {
    let state = createDuo({ playerIds: ["p1", "p2"], settings: { guessSeconds: 1 }, champions, now: 0, rng: createRng(2) });
    const pair = state.pairs[0]!;
    state = duoSubmit(state, pair[0], state.assignments[pair[1]]!).state;
    state = duoTick(state, { now: 1000, champions }).state;
    expect(state.phase).toBe("REVEAL");
    expect(duoResults(state).scores[pair[0]]).toBe(1);
    expect(duoPrivateView(state, pair[0]).ownChampion).not.toBeNull();
  });
});
