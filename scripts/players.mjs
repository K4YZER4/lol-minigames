/**
 * Ayudante de pruebas manuales: mete N jugadores falsos en una sala y los deja
 * conectados. Uso: node scripts/players.mjs CODIGO Nombre1 Nombre2 ...
 */
import { io } from "socket.io-client";

const [code, ...names] = process.argv.slice(2);
if (!code || names.length === 0) {
  console.error("Uso: node scripts/players.mjs CODIGO Nombre1 Nombre2 ...");
  process.exit(1);
}

const SERVER_URL = process.env.GAME_SERVER_URL ?? "http://localhost:3001";

for (const name of names) {
  const socket = io(SERVER_URL, { transports: ["websocket"], forceNew: true });
  socket.on("connect", async () => {
    const ack = await new Promise((resolve) =>
      socket.timeout(5000).emit("room:join", { code, nickname: name }, (err, res) => resolve(err ?? res)),
    );
    if (!ack?.ok) {
      console.error(`${name}: ${ack?.message ?? "sin respuesta"}`);
      return;
    }
    await new Promise((resolve) => socket.timeout(5000).emit("room:ready", { ready: true }, resolve));
    console.log(`${name} dentro (${ack.playerId.slice(0, 8)}) y listo`);
  });
  socket.on("disconnect", () => console.log(`${name} desconectado`));
}

process.on("SIGINT", () => process.exit(0));
