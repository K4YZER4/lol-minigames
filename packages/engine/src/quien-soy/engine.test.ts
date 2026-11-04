import { describe, expect, it } from "vitest";
import { createRng } from "../core/rng";
import {
  createQuienSoy,
  quienSoyGuess,
  quienSoyPrivateView,
  quienSoyPublicView,
  quienSoyResults,
  quienSoyTick,
} from "./engine";

const champions = {
  A: { id: "A", name: "A", imageUrl: "" },
  B: { id: "B", name: "B", imageUrl: "" },
  C: { id: "C", name: "C", imageUrl: "" },
};

const make = () =>
  createQuienSoy({
    playerIds: ["one", "two", "three"],
    settings: { turnSeconds: 60 },
    champions,
    now: 0,
    rng: createRng(2),
  });

const wrongFor = (state: ReturnType<typeof make>, playerId: string) => {
  const own = state.assignments[playerId]!;
  return Object.keys(champions).find((id) => id !== own)!;
};

describe("quién soy (hedbanz)", () => {
  it("assigns a champion to every player without repeats", () => {
    const state = make();
    const assigned = Object.values(state.assignments);
    expect(assigned).toHaveLength(3);
    expect(new Set(assigned).size).toBe(3);
  });

  it("hides the active player's champion from that player but shows it to everyone else", () => {
    const state = make();
    const ownId = state.assignments.one!;

    const active = quienSoyPrivateView(state, "one");
    expect(active.isActive).toBe(true);
    expect(active.yourChampion).toBeNull();
    expect(active.visible.one).toBeUndefined();
    expect(Object.values(active.visible).map((c) => c.id)).not.toContain(ownId);

    const other = quienSoyPrivateView(state, "two");
    expect(other.visible.one?.id).toBe(ownId);

    const publicView = quienSoyPublicView(state);
    expect(JSON.stringify(publicView)).not.toContain(`"id":"${ownId}"`);
  });

  it("lets the active player keep trying after a wrong guess", () => {
    const state = make();
    const result = quienSoyGuess(state, "one", wrongFor(state, "one"), {
      now: 1,
      rng: createRng(3),
    });
    expect(result.reject).toBeUndefined();
    expect(result.state.activeIndex).toBe(0);
    expect(result.state.phase).toBe("TURN");
    expect(result.state.attempts).toHaveLength(1);
    expect(quienSoyPrivateView(result.state, "one").yourChampion).toBeNull();
  });

  it("closes the turn with a point on a correct guess and reveals the champion", () => {
    const state = make();
    const own = state.assignments.one!;
    const result = quienSoyGuess(state, "one", own, { now: 1, rng: createRng(3) });

    expect(result.state.activeIndex).toBe(1);
    expect(result.state.results).toHaveLength(1);
    expect(quienSoyResults(result.state).scores.one).toBe(1000);
    expect(quienSoyPrivateView(result.state, "one").yourChampion?.id).toBe(own);
    expect(quienSoyPublicView(result.state).revealed[0]?.champion?.id).toBe(own);
  });

  it("rejects guesses from players who are not active", () => {
    const state = make();
    const result = quienSoyGuess(state, "two", wrongFor(state, "two"), {
      now: 1,
      rng: createRng(3),
    });
    expect(result.reject?.code).toBe("NOT_YOUR_TURN");
  });

  it("closes the turn without points when time runs out", () => {
    const state = make();
    const result = quienSoyTick(state, { now: 60_000, rng: createRng(3) });
    expect(result.state.activeIndex).toBe(1);
    expect(quienSoyResults(result.state).scores.one).toBe(0);
    expect(result.state.results[0]?.solved).toBe(false);
  });

  it("finishes when everyone has played once", () => {
    let state = make();
    for (const playerId of ["one", "two", "three"]) {
      state = quienSoyGuess(state, playerId, state.assignments[playerId]!, {
        now: 1,
        rng: createRng(4),
      }).state;
    }
    expect(state.phase).toBe("REVEAL");
    expect(state.results).toHaveLength(3);
    expect(quienSoyResults(state).scores).toEqual({ one: 1000, two: 1000, three: 1000 });
  });
});
