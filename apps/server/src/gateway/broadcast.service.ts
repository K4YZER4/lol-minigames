import { Injectable } from "@nestjs/common";
import type { Server } from "socket.io";
import { ServerEvents } from "@lolgames/protocol";

/**
 * Único punto que conoce Socket.IO. El motor y el servicio de salas solo
 * hablan de "sala" y "jugador"; esto traduce a conexiones reales.
 */
@Injectable()
export class BroadcastService {
  private server: Server | null = null;
  private readonly sockets = new Map<string, string>();

  attach(server: Server) {
    this.server = server;
  }

  bind(playerId: string, socketId: string) {
    const previous = this.sockets.get(playerId);
    if (previous && previous !== socketId) {
      const old = this.server?.sockets.sockets.get(previous);
      old?.emit(ServerEvents.REJECTED, {
        ok: false,
        code: "SESSION_REPLACED",
        message: "Abriste la partida en otra pestaña",
      });
      old?.disconnect(true);
    }
    this.sockets.set(playerId, socketId);
  }

  unbind(playerId: string) {
    this.sockets.delete(playerId);
  }

  toRoom(roomId: string, event: string, payload: unknown) {
    this.server?.to(roomId).emit(event, payload);
  }

  toPlayer(playerId: string, event: string, payload: unknown) {
    const socketId = this.sockets.get(playerId);
    if (socketId) this.server?.to(socketId).emit(event, payload);
  }

  kick(playerId: string, code: string, message: string) {
    const socketId = this.sockets.get(playerId);
    if (!socketId) return;
    const socket = this.server?.sockets.sockets.get(socketId);
    socket?.emit(ServerEvents.REJECTED, { ok: false, code, message });
    socket?.disconnect(true);
  }
}
