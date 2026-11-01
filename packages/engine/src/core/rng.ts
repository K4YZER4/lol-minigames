export type PlayerId = string;

export type Effect = { type: string } & Record<string, unknown>;

export type Reject = { code: string; message: string };

export type Result<S> = {
  state: S;
  effects: Effect[];
  reject?: Reject;
};

export interface Rng {
  next(): number;
  int(minInclusive: number, maxInclusive: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
}

/** PRNG determinista: los tests pueden fijar la semilla. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) =>
    min + Math.floor(next() * (max - min + 1));
  const pick = <T,>(items: readonly T[]): T => {
    if (items.length === 0) throw new Error("pick() sobre una lista vacía");
    return items[int(0, items.length - 1)]!;
  };
  const shuffle = <T,>(items: readonly T[]): T[] => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = int(0, i);
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
    }
    return copy;
  };
  return { next, int, pick, shuffle };
}

/** Reloj del sistema. Los tests usan un reloj manual. */
export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

export type Results = {
  winners: PlayerId[];
  scores: Record<PlayerId, number>;
};
