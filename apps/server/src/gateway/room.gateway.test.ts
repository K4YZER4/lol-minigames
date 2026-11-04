import { describe, expect, it, vi } from "vitest";
import type { Socket } from "socket.io";
import { RoomGateway } from "./room.gateway";
import type { RoomService } from "../rooms/room.service";
import type { BroadcastService } from "./broadcast.service";
import type { RateLimiter } from "../ports";

describe("pertenencia de un socket a una sala", () => {
  it("rechaza crear/entrar en otra sala sin salir antes", async () => {
    const rooms = {
      createRoom: vi.fn().mockResolvedValue({ ok: true, roomId: "r1", playerId: "p1", roomCode: "ROOM01", token: "a".repeat(64) }),
      joinRoom: vi.fn(),
      refresh: vi.fn(),
    };
    const gateway = new RoomGateway(
      rooms as unknown as RoomService, {} as BroadcastService, {} as RateLimiter,
    );
    const socket = {
      id: "s1", connected: true, data: { ip: "127.0.0.1" }, join: vi.fn(),
    } as unknown as Socket;

    expect((await gateway.onCreate(socket, { nickname: "Ana" })).ok).toBe(true);
    expect((await gateway.onJoin(socket, { code: "ABC234", token: "a".repeat(64) })).ok).toBe(false);
    expect((await gateway.onCreate(socket, { nickname: "Ana" })).ok).toBe(false);
    expect(rooms.createRoom).toHaveBeenCalledTimes(1);
    expect(rooms.joinRoom).not.toHaveBeenCalled();
    expect(rooms.createRoom).toHaveBeenCalledWith("Ana", undefined, "s1", "127.0.0.1");
  });

  it("permite repetir la entrada automática a la misma sala creada", async () => {
    const token = "a".repeat(64);
    const rooms = {
      createRoom: vi.fn().mockResolvedValue({ ok: true, roomId: "r1", playerId: "p1", roomCode: "ABC234", token }),
      joinRoom: vi.fn(),
      refresh: vi.fn(),
    };
    const gateway = new RoomGateway(
      rooms as unknown as RoomService, {} as BroadcastService, {} as RateLimiter,
    );
    const socket = {
      id: "s1", connected: true, data: { ip: "127.0.0.1" }, join: vi.fn(),
    } as unknown as Socket;

    expect((await gateway.onCreate(socket, { nickname: "Ana" })).ok).toBe(true);
    const ack = await gateway.onJoin(socket, { code: "ABC234", token });

    expect(ack).toEqual({ ok: true, playerId: "p1", token, roomCode: "ABC234", roomId: "r1" });
    expect(rooms.joinRoom).not.toHaveBeenCalled();
    expect(rooms.refresh).toHaveBeenCalledWith("r1");
  });

  it("rechaza peticiones concurrentes de creación en el mismo socket", async () => {
    let finish!: (value: { ok: true; roomId: string; playerId: string }) => void;
    const rooms = {
      createRoom: vi.fn().mockImplementation(() => new Promise((resolve) => { finish = resolve; })),
      refresh: vi.fn(),
    };
    const gateway = new RoomGateway(rooms as unknown as RoomService, {} as BroadcastService, {} as RateLimiter);
    const socket = { id: "s1", connected: true, data: { ip: "127.0.0.1" }, join: vi.fn() } as unknown as Socket;

    const first = gateway.onCreate(socket, { nickname: "Ana" });
    expect((await gateway.onCreate(socket, { nickname: "Ana" })).ok).toBe(false);
    finish({ ok: true, roomId: "r1", playerId: "p1" });
    expect((await first).ok).toBe(true);
    expect(rooms.createRoom).toHaveBeenCalledTimes(1);
  });

  it("limpia el índice si el socket se desconecta durante la creación", async () => {
    let finish!: (value: { ok: true; roomId: string; playerId: string }) => void;
    const rooms = {
      createRoom: vi.fn().mockImplementation(() => new Promise((resolve) => { finish = resolve; })),
      disconnectSocket: vi.fn(), refresh: vi.fn(),
    };
    const gateway = new RoomGateway(rooms as unknown as RoomService, {} as BroadcastService, {} as RateLimiter);
    const socket = { id: "s1", connected: true, data: { ip: "127.0.0.1" }, join: vi.fn() } as unknown as Socket;
    const pending = gateway.onCreate(socket, { nickname: "Ana" });
    socket.connected = false;
    finish({ ok: true, roomId: "r1", playerId: "p1" });
    await pending;
    expect(rooms.disconnectSocket).toHaveBeenCalledWith("s1");
    expect(socket.join).not.toHaveBeenCalled();
  });
});
