/**
 * Prueba de humo end-to-end contra un servidor real.
 *
 *   node scripts/e2e.mjs
 *
 * Cubre: creación/unión de sala, validaciones, arranque, una ronda de Bomba
 * (fallo, acierto, idempotencia, fuera de turno), reconexión con token,
 * traspaso de anfitrión y una partida completa de Impostor.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { io } from "socket.io-client";

const SERVER_URL = process.env.GAME_SERVER_URL ?? "http://localhost:3001";

const clues = JSON.parse(
  readFileSync(new URL("../packages/content/data/clues.json", import.meta.url), "utf8"),
);
const clueToChampion = new Map(clues.map((clue) => [clue.clueId, clue.championId]));

let checks = 0;
function check(condition, message) {
  assert.ok(condition, message);
  checks += 1;
  console.log(`  ok  ${message}`);
}

class Client {
  constructor(label) {
    this.label = label;
    this.room = null;
    this.priv = null;
    this.effects = [];
    this.id = null;
    this.token = null;
    this.waiters = new Set();
    this.privWaiters = new Set();
    this.socket = io(SERVER_URL, {
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
    });
    this.socket.on("room:state", (view) => {
      this.room = view;
      for (const waiter of [...this.waiters]) waiter(view);
    });
    this.socket.on("private:state", (view) => {
      this.priv = view;
      for (const waiter of [...this.privWaiters]) waiter(view);
    });
    this.socket.on("game:effect", (effect) => this.effects.push(effect));
  }

  open(timeout = 5000) {
    if (this.socket.connected) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`${this.label}: no se pudo conectar`)),
        timeout,
      );
      this.socket.once("connect", () => {
        clearTimeout(timer);
        resolve();
      });
      this.socket.once("connect_error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  emit(event, payload = {}) {
    return new Promise((resolve, reject) => {
      this.socket.timeout(8000).emit(event, payload, (error, ack) => {
        if (error) reject(new Error(`${this.label}: sin ack de ${event}`));
        else resolve(ack);
      });
    });
  }

  waitFor(predicate, label, timeout = 12000) {
    if (this.room && predicate(this.room)) return Promise.resolve(this.room);
    return new Promise((resolve, reject) => {
      const waiter = (view) => {
        if (!predicate(view)) return;
        clearTimeout(timer);
        this.waiters.delete(waiter);
        resolve(view);
      };
      const timer = setTimeout(() => {
        this.waiters.delete(waiter);
        reject(new Error(`${this.label}: timeout esperando ${label}`));
      }, timeout);
      this.waiters.add(waiter);
    });
  }

  waitForPrivate(predicate, label, timeout = 12000) {
    if (this.priv && predicate(this.priv)) return Promise.resolve(this.priv);
    return new Promise((resolve, reject) => {
      const waiter = (view) => {
        if (!predicate(view)) return;
        clearTimeout(timer);
        this.privWaiters.delete(waiter);
        resolve(view);
      };
      const timer = setTimeout(() => {
        this.privWaiters.delete(waiter);
        reject(new Error(`${this.label}: timeout esperando privado ${label}`));
      }, timeout);
      this.privWaiters.add(waiter);
    });
  }

  close() {
    this.socket.close();
  }
}

async function joinRoom(client, code, nickname) {
  await client.open();
  const ack = await client.emit("room:join", { code, nickname });
  assert.equal(ack.ok, true, `${nickname} no pudo entrar: ${ack.message ?? ""}`);
  client.id = ack.playerId;
  client.token = ack.token;
  return ack;
}

async function createRoom(client, nickname) {
  await client.open();
  const ack = await client.emit("room:create", { nickname });
  assert.equal(ack.ok, true, `no se pudo crear la sala: ${ack.message ?? ""}`);
  client.id = ack.playerId;
  client.token = ack.token;
  return ack.roomCode;
}

async function bombaFlow() {
  console.log("\n[1] Sala, lobby y Bomba");

  const ana = new Client("Ana");
  const beto = new Client("Beto");
  const caro = new Client("Caro");
  const all = [ana, beto, caro];
  const byId = (id) => all.find((client) => client.id === id);

  const code = await createRoom(ana, "Ana");
  check(/^[A-Z2-9]{6}$/.test(code), `código de sala válido (${code})`);

  await joinRoom(beto, code, "Beto");
  await joinRoom(caro, code, "Caro");

  const lobby = await ana.waitFor((room) => room.players.length === 3, "3 jugadores");
  check(lobby.hostId === ana.id, "el creador es anfitrión");
  check(lobby.phase === "LOBBY", "la sala arranca en LOBBY");

  // Apodo duplicado (mayúsculas incluidas).
  const dup = new Client("Dup");
  await dup.open();
  const dupAck = await dup.emit("room:join", { code, nickname: "ANA" });
  check(dupAck.ok === false && dupAck.code === "NAME_TAKEN", "apodo duplicado rechazado");
  dup.close();

  const notHost = await beto.emit("session:start");
  check(notHost.ok === false && notHost.code === "NOT_HOST", "un invitado no puede iniciar");

  const early = await ana.emit("session:start");
  check(
    early.ok === false && early.code === "INVALID",
    "no se inicia sin que todos estén listos",
  );

  for (const client of all) {
    const ack = await client.emit("room:ready", { ready: true });
    assert.equal(ack.ok, true);
  }
  await ana.waitFor((room) => room.players.every((p) => p.ready), "todos listos");
  check(true, "los tres jugadores quedan listos");

  const conf = await ana.emit("session:configure", {
    mode: "bomba",
    bomba: { lives: 2, minFuseMs: 5000, maxFuseMs: 5000, penaltyMs: 1000 },
  });
  check(conf.ok === true, "el anfitrión configura Bomba");
  await ana.waitFor(
    (room) => room.mode === "bomba" && room.settings.bomba.lives === 2,
    "configuración aplicada",
  );

  assert.equal((await ana.emit("session:start")).ok, true);
  const playing = await ana.waitFor(
    (room) => room.phase === "PLAYING" && room.game?.mode === "bomba",
    "Bomba iniciada",
  );
  check(true, "la partida de Bomba arranca");

  // Nada secreto puede viajar en la vista pública.
  const publicRaw = JSON.stringify(playing.game);
  check(!publicRaw.includes("answerChampionId"), "la respuesta no viaja al cliente");
  check(!publicRaw.includes("fuseEndsAt"), "el vencimiento exacto no viaja al cliente");

  const clue = playing.game.clue;
  assert.ok(clue, "hay pista");
  const answer = clueToChampion.get(clue.clueId);
  assert.ok(answer, "la pista tiene respuesta conocida");
  check(
    !decodeURIComponent(clue.imageUrl).includes(answer),
    "la URL de la pista no filtra el campeón",
  );
  check(
    !publicRaw.includes("championId"),
    "la vista pública no expone championId",
  );

  const active = byId(playing.game.activePlayerId);
  assert.ok(active, "hay jugador activo");
  await active.waitForPrivate(
    (view) => view?.mode === "bomba" && view.youAreActive,
    "estado privado del activo",
  );
  check(true, `el turno es de ${active.label}`);

  const wrong = answer === "Aatrox" ? "Ahri" : "Aatrox";
  const wrongAck = await active.emit("bomba:answer", {
    requestId: randomUUID(),
    championId: wrong,
  });
  check(
    wrongAck.ok === false && wrongAck.code === "WRONG_ANSWER",
    "respuesta incorrecta rechazada",
  );

  const other = all.find((client) => client.id !== active.id);
  const notTurn = await other.emit("bomba:answer", {
    requestId: randomUUID(),
    championId: answer,
  });
  check(
    notTurn.ok === false && notTurn.code === "NOT_YOUR_TURN",
    "nadie responde fuera de turno",
  );

  const requestId = randomUUID();
  const correct = await active.emit("bomba:answer", { requestId, championId: answer });
  check(correct.ok === true, "respuesta correcta aceptada");

  const replay = await active.emit("bomba:answer", { requestId, championId: answer });
  check(replay.ok === true, "reintento con el mismo requestId es idempotente");

  await ana.waitFor(
    (room) => room.game?.mode === "bomba" && room.game.activePlayerId !== active.id,
    "la bomba cambió de manos",
  );
  check(true, "la bomba pasa al siguiente jugador");

  // Reconexión con token.
  caro.socket.disconnect();
  await ana.waitFor(
    (room) => room.players.find((p) => p.playerId === caro.id)?.connected === false,
    "Caro desconectada",
  );
  caro.socket.connect();
  await caro.open();
  const rejoin = await caro.emit("room:join", { code, token: caro.token });
  check(rejoin.ok === true && rejoin.playerId === caro.id, "reconexión con token conserva identidad");
  await ana.waitFor(
    (room) => room.players.find((p) => p.playerId === caro.id)?.connected === true,
    "Caro de vuelta",
  );

  // Si el host pierde su socket, el control se transfiere inmediatamente.
  ana.socket.disconnect();
  await beto.waitFor(
    (room) => room.hostId === beto.id,
    "traspaso de anfitrión en tiempo real",
  );
  check(true, "el anfitrión pasa al jugador conectado en tiempo real");

  ana.socket.connect();
  await ana.open();
  const anaBack = await ana.emit("room:join", { code, token: ana.token });
  check(anaBack.ok === true, "el anfitrión anterior puede volver");
  await ana.waitFor((room) => room.hostId === beto.id, "host estable");
  check(true, "el anfitrión anterior vuelve sin recuperar el control");

  for (const client of all) client.close();
  return code;
}

async function impostorFlow() {
  console.log("\n[2] Impostor de punta a punta");

  const uno = new Client("Uno");
  const dos = new Client("Dos");
  const tres = new Client("Tres");
  const all = [uno, dos, tres];
  const byId = (id) => all.find((client) => client.id === id);

  const code = await createRoom(uno, "Uno");
  await joinRoom(dos, code, "Dos");
  await joinRoom(tres, code, "Tres");

  await uno.waitFor((room) => new Set(room.players.map((p) => p.avatar?.id)).size === 3, "avatares únicos");
  check(true, "cada jugador recibe un emote oficial distinto");

  for (const client of all) await client.emit("room:ready", { ready: true });
  await uno.waitFor((room) => room.players.every((p) => p.ready), "listos");

  const conf = await uno.emit("session:configure", {
    mode: "impostor",
    impostor: {
      assignmentSeconds: 5,
      clueSeconds: 10,
      discussionSeconds: 10,
      voteSeconds: 10,
    },
  });
  check(conf.ok === true, "el anfitrión configura Impostor");

  assert.equal((await uno.emit("session:start")).ok, true);
  await uno.waitFor(
    (room) => room.game?.mode === "impostor" && room.game.phase === "ASSIGNMENT",
    "reparto",
  );
  check(true, "fase de reparto iniciada");

  for (const client of all) {
    const priv = await client.waitForPrivate(
      (view) => view?.mode === "impostor" && view.champion !== null,
      `campeón de ${client.label}`,
    );
    check(
      typeof priv.champion.name === "string" && !("isImpostor" in priv),
      `${client.label} recibe solo su campeón`,
    );
    const ack = await client.emit("impostor:ack", { requestId: randomUUID() });
    assert.equal(ack.ok, true);
  }

  const cluesPhase = await uno.waitFor(
    (room) => room.game?.mode === "impostor" && room.game.phase === "CLUES",
    "ronda de pistas",
  );
  check(cluesPhase.game.clueOrder.length === 3, "el orden de pistas tiene 3 jugadores");
  const firstOrder = [...cluesPhase.game.clueOrder];

  // Primera pista: probar el filtro de nombre propio.
  const firstId = cluesPhase.game.clueOrder[0];
  const first = byId(firstId);
  const ownName = first.priv.champion.name;
  const leakAck = await first.emit("impostor:clue", {
    requestId: randomUUID(),
    text: `es ${ownName}`,
  });
  check(
    leakAck.ok === false && leakAck.code === "NAME_IN_CLUE",
    "el servidor rechaza pistas con el nombre propio",
  );

  for (let index = 0; index < 3; index += 1) {
    const room = await uno.waitFor(
      (view) =>
        view.game?.mode === "impostor" &&
        view.game.phase === "CLUES" &&
        view.game.clueIndex === index,
      `pista ${index + 1}`,
    );
    const playerId = room.game.clueOrder[index];
    const ack = await byId(playerId).emit("impostor:clue", {
      requestId: randomUUID(),
      text: `pista numero ${index + 1}`,
    });
    assert.equal(ack.ok, true, `pista ${index + 1} aceptada`);
  }
  check(true, "los tres jugadores envían su pista");

  const voting = await uno.waitFor(
    (room) => room.game?.mode === "impostor" && room.game.phase === "VOTING",
    "votación",
    20000,
  );
  check(true, "la discusión termina y arranca la votación");
  check(voting.game.clues.length === 3, "las pistas se conservan para la votación");

  const selfVote = await uno.emit("impostor:vote", {
    requestId: randomUUID(),
    targetId: uno.id,
  });
  check(
    selfVote.ok === false && selfVote.code === "INVALID_TARGET",
    "no se puede votar por uno mismo",
  );

  const order = voting.game.clueOrder;
  for (let index = 0; index < order.length; index += 1) {
    const voter = byId(order[index]);
    const target = order[(index + 1) % order.length];
    const ack = await voter.emit("impostor:vote", {
      requestId: randomUUID(),
      targetId: target,
    });
    assert.equal(ack.ok, true, `${voter.label} no pudo votar`);
  }
  check(true, "los tres votos quedan registrados");

  const revealRoom = await uno.waitFor(
    (room) => room.game?.mode === "impostor" && room.game.phase === "REVEAL",
    "revelación",
    20000,
  );
  const reveal = revealRoom.game.reveal;
  assert.ok(reveal, "hay revelación");
  check(Object.keys(reveal.assignment).length === 3, "se revelan los 3 campeones");
  check(reveal.impostorIds.length === 1, "hay exactamente un infiltrado");
  check(reveal.winners.length >= 1, "hay ganadores declarados");
  check(reveal.caught === false, "con empate de votos gana el infiltrado");

  const notHostReset = await dos.emit("session:reset");
  check(
    notHostReset.ok === false && notHostReset.code === "NOT_HOST",
    "solo el anfitrión puede volver al lobby",
  );

  const reset = await uno.emit("session:reset", { mode: "bomba" });
  check(reset.ok === true, "el anfitrión reinicia la sala");
  const lobbyAgain = await uno.waitFor((room) => room.phase === "LOBBY", "vuelta al lobby");
  check(lobbyAgain.game === null, "la partida anterior se limpia");
  check(lobbyAgain.players.every((p) => !p.ready), "todos vuelven a no listos");
  check(lobbyAgain.mode === "bomba", "se puede reiniciar cambiando el modo");

  const backToImpostor = await uno.emit("session:configure", { mode: "impostor" });
  assert.equal(backToImpostor.ok, true);
  for (const client of all) await client.emit("room:ready", { ready: true });
  await uno.waitFor((room) => room.players.every((p) => p.ready), "listos para segunda ronda");
  assert.equal((await uno.emit("session:start")).ok, true);
  await uno.waitFor((room) => room.game?.mode === "impostor" && room.game.phase === "ASSIGNMENT", "segundo reparto");
  for (const client of all) await client.emit("impostor:ack", { requestId: randomUUID() });
  const secondClues = await uno.waitFor((room) => room.game?.mode === "impostor" && room.game.phase === "CLUES", "segundo orden");
  check(secondClues.game.clueOrder.join(",") === [...firstOrder.slice(1), firstOrder[0]].join(","), "el primer hablante rota al final en la siguiente ronda");

  for (const client of all) client.close();
}

async function main() {
  console.log(`Probando ${SERVER_URL}`);
  await bombaFlow();
  await impostorFlow();
  console.log(`\nTodo verde: ${checks} comprobaciones.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nFALLÓ:", error.message);
    process.exit(1);
  });
