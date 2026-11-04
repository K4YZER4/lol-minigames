import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
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
export class MemorySessionRepository extends SessionRepository implements OnModuleInit, OnModuleDestroy {
  private readonly tokens = new Map<string, { playerId: string; expiresAt: number }>();
  private timer: NodeJS.Timeout | null = null;

  onModuleInit() {
    this.timer = setInterval(() => this.sweep(), 60 * 60_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private sweep() {
    const now = Date.now();
    for (const [token, session] of this.tokens) {
      if (session.expiresAt <= now) this.tokens.delete(token);
    }
  }

  async issue(playerId: string): Promise<string> {
    const token = randomBytes(32).toString("hex");
    this.tokens.set(token, { playerId, expiresAt: Date.now() + 24 * 60 * 60_000 });
    return token;
  }

  async resolve(token: string): Promise<string | null> {
    const session = this.tokens.get(token);
    if (!session) return null;
    if (session.expiresAt <= Date.now()) {
      this.tokens.delete(token);
      return null;
    }
    return session.playerId;
  }

  async revoke(token: string): Promise<void> {
    this.tokens.delete(token);
  }
}

@Injectable()
export class MemoryRateLimiter extends RateLimiter implements OnModuleInit, OnModuleDestroy {
  private readonly hits = new Map<string, { timestamps: number[]; windowMs: number }>();
  private timer: NodeJS.Timeout | null = null;

  onModuleInit() {
    this.timer = setInterval(() => this.sweep(), 60_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  sweep() {
    const now = Date.now();
    for (const [key, entry] of this.hits) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < entry.windowMs);
      if (!entry.timestamps.length) this.hits.delete(key);
    }
  }

  size(): number {
    return this.hits.size;
  }

  async hit(key: string, windowMs: number, max: number): Promise<boolean> {
    const now = Date.now();
    const recent = (this.hits.get(key)?.timestamps ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      this.hits.set(key, { timestamps: recent, windowMs });
      return false;
    }
    recent.push(now);
    this.hits.set(key, { timestamps: recent, windowMs });
    return true;
  }
}

@Injectable()
export class SystemClock extends Clock {
  now(): number {
    return Date.now();
  }
}
