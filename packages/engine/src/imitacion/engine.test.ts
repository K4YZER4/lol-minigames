import { describe, expect, it } from "vitest";
import { createRng } from "../core/rng";
import { createImitacion, imitacionResults, imitacionSubmit, imitacionVote, imitacionTick } from "./engine";

const clips = [{ clueId: "clip", championId: "Ahri", audioUrl: "/audio/clip" }];
const ctx = (now: number) => ({ now, rng: createRng(1) });

describe("puntuación de imitación", () => {
  it("convierte las estrellas de cada grabación a puntos comparables con Pictionary", () => {
    let state = createImitacion({ playerIds: ["p1", "p2", "p3"], settings: { recordingSeconds: 15, votingSeconds: 30 }, clips, now: 0, rng: createRng(1) });
    for (const id of state.players) state = imitacionSubmit(state, id, "audio", "audio/webm", ctx(1)).state;
    const p1 = state.recordings.p1!.recordingId;
    const p2 = state.recordings.p2!.recordingId;
    state = imitacionVote(state, "p1", p2, 3, ctx(2)).state;
    state = imitacionVote(state, "p2", p1, 5, ctx(3)).state;
    state = imitacionVote(state, "p3", p1, 5, ctx(4)).state;
    expect(imitacionResults(state).scores).toEqual({ p1: 1000, p2: 600, p3: 0 });
  });

  it("no regala puntos si nadie ha votado", () => {
    let state = createImitacion({ playerIds: ["p1", "p2"], settings: { recordingSeconds: 10, votingSeconds: 15 }, clips, now: 0, rng: createRng(1) });
    state = imitacionTick(state, ctx(10_000)).state;
    state = imitacionTick(state, ctx(25_000)).state;
    expect(imitacionResults(state).scores).toEqual({ p1: 0, p2: 0 });
    expect(state.winnerId).toBeNull();
  });
});
