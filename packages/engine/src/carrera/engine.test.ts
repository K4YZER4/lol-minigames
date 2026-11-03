import { describe, expect, it } from "vitest";
import { createCarrera, carreraAnswer, carreraTick } from "./engine";
import { createRng } from "../core/rng";
const champions = { Ahri: { id: "Ahri", name: "Ahri", imageUrl: "" }, Garen: { id: "Garen", name: "Garen", imageUrl: "" } };
const clues = [{ clueId: "a", championId: "Ahri", kind: "spell" as const, imageUrl: "" }];
const init = () => createCarrera({ playerIds: ["p1", "p2"], settings: { clueSeconds: 5, rounds: 1 }, champions, clues, now: 0, rng: createRng(1) });
describe("carrera engine", () => {
  it("keeps target private and awards first correct answer", () => { const state = init(); const result = carreraAnswer(state, "p1", state.targetId, { now: 1, rng: createRng(2), clues }); expect(result.state.phase).toBe("REVEAL"); expect(result.state.winnerId).toBe("p1"); });
  it("reveals after the clue timer and then finishes", () => { const state = init(); const reveal = carreraTick(state, { now: 5_001, rng: createRng(2), clues }); expect(reveal.state.phase).toBe("REVEAL"); const done = carreraTick(reveal.state, { now: 11_002, rng: createRng(2), clues }); expect(done.state.phase).toBe("FINISHED"); });
});
