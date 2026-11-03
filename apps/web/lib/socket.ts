import { io, type Socket } from "socket.io-client";

export const SERVER_URL =
  process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? "http://localhost:3001";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SERVER_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 400,
      reconnectionDelayMax: 3000,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}

/**
 * Emite un evento y espera el ack del servidor.
 * Si el servidor no contesta, devuelve un rechazo con el mismo formato.
 */
export function request<T extends { ok: boolean }>(
  event: string,
  payload: unknown,
  timeoutMs = 8000,
): Promise<T> {
  const client = getSocket();
  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const timeout = () => ({
      ok: false,
      code: "TIMEOUT",
      message: "El servidor no respondió. Revisa que siga encendido e inténtalo otra vez.",
    } as unknown as T);

    const cleanup = () => {
      client.off("connect", onConnect);
      if (timer) clearTimeout(timer);
    };

    const finish = (response: T) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(response);
    };

    const emit = () => {
      client.timeout(timeoutMs).emit(event, payload, (error: Error | null, response: T) => {
        if (error) finish(timeout());
        else finish(response);
      });
    };

    const onConnect = () => emit();
    timer = setTimeout(() => finish(timeout()), timeoutMs);

    if (client.connected) emit();
    else client.once("connect", onConnect);
  });
}
