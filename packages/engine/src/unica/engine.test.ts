import { describe, expect, it } from "vitest";
import { createRng } from "../core/rng";
import { createUnica, unicaPrivateView, unicaSubmit, type UnicaChampion } from "./engine";

const champions: Record<string, UnicaChampion> = {
  Ahri: { id: "Ahri", name: "Ahri", imageUrl: "ahri.png", tags: ["Fighter", "Mage", "Assassin", "Tank", "Marksman", "Support"] },
  Lux: { id: "Lux", name: "Lux", imageUrl: "lux.png", tags: ["Fighter", "Mage", "Assassin", "Tank", "Marksman", "Support"] },
};

describe("respuesta única engine", () => {
  it("keeps answers private and rejects champions outside the category", () => {
    const state = createUnica({ playerIds: ["ana", "beto"], settings: { answerSeconds: 45 }, champions, now: 1_000, rng: createRng(1) });
    expect(unicaPrivateView(state, "ana").yourAnswer).toBeNull();
    const wrong = { id: "Garen", name: "Garen", imageUrl: "garen.png", tags: [] };
    const invalid = unicaSubmit({ ...state, champions: { ...champions, Garen: wrong } }, "ana", "Garen");
    expect(invalid.reject?.code).toBe("INVALID_CATEGORY");
  });

  it("allows one valid private answer per player", () => {
    const state = createUnica({ playerIds: ["ana", "beto"], settings: { answerSeconds: 45 }, champions, now: 1_000, rng: createRng(1) });
    const answer = unicaSubmit(state, "ana", "Ahri");
    expect(answer.reject).toBeUndefined();
    expect(unicaPrivateView(answer.state, "ana").yourAnswer?.id).toBe("Ahri");
    expect(unicaSubmit(answer.state, "ana", "Lux").reject?.code).toBe("ALREADY_GUESSED");
  });
});
