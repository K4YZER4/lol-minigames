import type { Room } from "../rooms/types";

export abstract class RoomRepository {
  abstract get(id: string): Promise<Room | null>;
  abstract getByCode(code: string): Promise<Room | null>;
  abstract save(room: Room): Promise<void>;
  abstract delete(id: string): Promise<void>;
  abstract listIds(): Promise<string[]>;
}

export abstract class SessionRepository {
  abstract issue(playerId: string): Promise<string>;
  abstract resolve(token: string): Promise<string | null>;
  abstract revoke(token: string): Promise<void>;
}

export abstract class RateLimiter {
  abstract hit(key: string, windowMs: number, max: number): Promise<boolean>;
}

export abstract class Clock {
  abstract now(): number;
}
