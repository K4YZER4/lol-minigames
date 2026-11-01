import { Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import type { Room } from "../rooms/types";
import { Clock, RateLimiter, RoomRepository, SessionRepository } from "../ports";

/**
 * Adaptadores en memoria. Toda la app depende de las clases abstractas de
 * `ports/`, así que reemplazar esto por Postgres + Redis no toca el motor.
 */
@Injectable()
export class MemoryRoomRepository extends RoomRepository {
  private readonly rooms = new Map<string, Room>();

  async get(id: string): Promise<Room | null> {
    return this.rooms.get(id) ?? null;
  }

  async getByCode(code: string): Promise<Room | null> {
    for (const room of this.rooms.values()) {
      if (room.code === code) return room;
    }
    return null;
  }

  async save(room: Room): Promise<void> {
    this.rooms.set(room.id, room);
  }

  async delete(id: string): Promise<void> {
    this.rooms.delete(id);
  }

  async listIds(): Promise<string[]> {
    return [...this.rooms.keys()];
  }
}

@Injectable()
export class MemorySessionRepository extends SessionRepository {
  private readonly tokens = new Map<string, string>();

  async issue(playerId: string): Promise<string> {
    const token = randomBytes(32).toString("hex");
    this.tokens.set(token, playerId);
    return token;
  }

  async resolve(token: string): Promise<string | null> {
    return this.tokens.get(token) ?? null;
  }

  async revoke(token: string): Promise<void> {
    this.tokens.delete(token);
  }
}

@Injectable()
export class MemoryRateLimiter extends RateLimiter {
  private readonly hits = new Map<string, number[]>();

  async hit(key: string, windowMs: number, max: number): Promise<boolean> {
    const now = Date.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}

@Injectable()
export class SystemClock extends Clock {
  now(): number {
    return Date.now();
  }
}
