import { describe, expect, it, vi } from "vitest";
import { MemoryRateLimiter, MemorySessionRepository } from "./memory";

describe("MemoryRateLimiter", () => {
  it("limita dentro de la ventana y permite tras su expiración", async () => {
    vi.useFakeTimers();
    try {
      const limiter = new MemoryRateLimiter();
      expect(await limiter.hit("a", 1000, 1)).toBe(true);
      expect(await limiter.hit("a", 1000, 1)).toBe(false);
      vi.advanceTimersByTime(1000);
      expect(await limiter.hit("a", 1000, 1)).toBe(true);
    } finally { vi.useRealTimers(); }
  });

  it("elimina claves caducadas al barrer", async () => {
    vi.useFakeTimers();
    try {
      const limiter = new MemoryRateLimiter();
      await limiter.hit("a", 1000, 1);
      vi.advanceTimersByTime(1000);
      limiter.sweep();
      expect(limiter.size()).toBe(0);
    } finally { vi.useRealTimers(); }
  });
});

describe("MemorySessionRepository", () => {
  it("revoca tokens vencidos después de 24 horas", async () => {
    vi.useFakeTimers();
    try {
      const sessions = new MemorySessionRepository();
      const token = await sessions.issue("player");
      expect(await sessions.resolve(token)).toBe("player");
      vi.advanceTimersByTime(24 * 60 * 60_000);
      expect(await sessions.resolve(token)).toBeNull();
    } finally { vi.useRealTimers(); }
  });
});
