# 01 — Cómo funciona el socket

## La pregunta

¿Qué ocurre exactamente desde que un jugador pulsa "Entrar" hasta que todos los
navegadores de la sala muestran el nuevo estado? Y por qué se hizo con
Socket.IO, acks y eventos en lugar de HTTP.

Importa porque casi todos los bugs de este proyecto caen en una de tres
categorías:

1. el cliente cree algo que el servidor no confirmó,
2. el servidor emite estado a quien no debe,
3. dos operaciones de la misma sala se pisan.

Entender el transporte explica las tres.

---

## Mapa de archivos

```
apps/web/lib/socket.ts                    conexión única del navegador + request() con ack
apps/web/lib/session.ts                   token en sessionStorage (por pestaña)
apps/web/app/page.tsx                     room:create / room:join desde el inicio
apps/web/app/room/[code]/room-client.tsx  listeners + envío de acciones + render
apps/web/lib/useServerClock.ts            offset entre reloj del cliente y del servidor

packages/protocol/src/index.ts            nombres de eventos + esquemas zod + tipos de vista

apps/server/src/main.ts                   arranque Nest, CORS HTTP, puerto
apps/server/src/game.module.ts            providers: gateway, servicio, repos, clock
apps/server/src/gateway/room.gateway.ts   @SubscribeMessage: entrada de cada evento
apps/server/src/gateway/broadcast.service.ts  único punto que habla Socket.IO al emitir
apps/server/src/rooms/room.service.ts     orquestación: validar, mutar, guardar, difundir
apps/server/src/rooms/lock.ts             candado por sala (lectura-modificación-escritura)
apps/server/src/rooms/types.ts            Room, Player, IncomingAction
apps/server/src/adapters/memory.ts        repos en memoria, rate limit, reloj
apps/server/src/ports/index.ts            interfaces reemplazables

packages/engine/src/bomba/engine.ts       reglas puras, sin red y sin relojes
```

---

## Qué es un socket, en una frase

HTTP es pregunta-respuesta: el cliente abre, pregunta, el servidor contesta y se
cierra. Un socket es una conexión TCP que se queda abierta y por la que las dos
partes pueden enviarse mensajes en cualquier momento **sin que el otro los pida**.

Socket.IO añade sobre eso cuatro cosas que aquí se usan todo el tiempo:

| Pieza | Qué aporta | Dónde se ve |
| --- | --- | --- |
| `emit` + `on` | eventos con nombre y payload | `room:state`, `bomba:answer` |
| ack | respuesta directa a un `emit` concreto | `return ack` en `room.gateway.ts` |
| rooms | grupos de sockets a los que emitir de una vez | `client.join(roomId)` |
| reconexión | reintentos automáticos con backoff | `reconnectionDelay: 400` |

El handshake empieza como HTTP (`GET /socket.io/`) y termina en un upgrade a
WebSocket. `transports: ["websocket", "polling"]` en `apps/web/lib/socket.ts`
hace que el navegador prefiera WebSocket y pueda caer a long-polling si la red
lo bloquea.

---

## Flujo paso a paso: crear una sala

### 1. Entrada

`apps/web/app/page.tsx` llama:

```ts
request<JoinAck>("room:create", { nickname, avatarId })
```

`request()` en `apps/web/lib/socket.ts`:

- reutiliza un único socket por pestaña (variable `socket` a nivel de módulo),
- si el socket no está conectado, espera `connect`,
- emite con `client.timeout(8000).emit(...)` y resuelve con el ack,
- si no hay respuesta, **resuelve** `{ ok: false, code: "TIMEOUT" }` en vez de
  lanzar. El cliente siempre recibe la misma forma.

### 2. Validación

En `apps/server/src/gateway/room.gateway.ts`, `onCreate`:

```ts
const parsed = z.object({ nickname: NicknameSchema, avatarId: AvatarIdSchema.optional() })
  .safeParse(body);
if (!parsed.success) return reject("INVALID", issue(parsed.error));
```

Nada llega al dominio sin pasar por zod. `NicknameSchema` (en
`packages/protocol`) recorta, colapsa espacios, exige 2–16 caracteres y un
conjunto de caracteres permitido. El `return` de un `@SubscribeMessage` es el
ack que recibe ese socket.

### 3. Autorización

"Crear sala" no tiene autorización: cualquiera puede. Lo que sí hay es límite de
frecuencia por IP: 10 salas por minuto (`create:${ip}`). Unirse tiene 30 por
minuto. Las acciones de juego, 40 cada 10 s por jugador. Todo en
`apps/server/src/rooms/room.service.ts`.

### 4. Datos

`createRoom` genera:

- `room.id`: UUID interno (nunca se comparte),
- `room.code`: 6 caracteres de `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (sin letras
  que se confunden al dictar: no hay I, O, 0 ni 1),
- `player.id`: UUID,
- `player.token`: 32 bytes aleatorios en hex (64 caracteres), emitido por
  `SessionRepository`.

El token es la identidad. El `socket.id` es solo "por dónde me hablan ahora" y
cambia en cada reconexión.

### 5. Salida

Dos canales distintos, a propósito:

| Canal | Evento | Destinatario | Contenido |
| --- | --- | --- | --- |
| ack | — | solo el que emitió | `{ ok, playerId, token, roomCode, roomId }` |
| broadcast | `room:state` | toda la sala | vista pública |
| broadcast | `private:state` | un socket | vista privada de ese jugador |
| broadcast | `game:effect` | toda la sala | animaciones (`bomba:explosion`) |
| broadcast | `action:rejected` | un socket | expulsión o reemplazo de sesión |

`RoomService.publish()` es el único lugar que decide esto:

```ts
this.broadcast.toRoom(room.id, ServerEvents.STATE, this.buildRoomView(room, now));
for (const player of room.players) {
  if (!player.connected) continue;
  this.broadcast.toPlayer(player.id, ServerEvents.PRIVATE, this.buildPrivateView(room, player.id));
}
```

`broadcast.service.ts` mantiene un `Map<playerId, socketId>` para poder emitir a
un jugador aunque su socket haya cambiado.

### 6. El detalle del orden en `attach`

`joinRoom` hace `publish` dentro del candado, **antes** de que el socket entre al
room de Socket.IO. Por eso el gateway, después del ack, hace:

```ts
await client.join(roomId);   // ahora sí recibe los broadcasts de la sala
await this.rooms.refresh(roomId); // reenvía el snapshot que se perdió
```

Es un caso clásico: el estado se emitió cuando el socket todavía no estaba
suscrito. Sin el `refresh`, el recién llegado se queda mirando "Cargando sala…".

---

## Flujo de una acción: `bomba:answer`

```
BombaGame.onAnswer(championId)
  └─ act("bomba:answer", { requestId, championId })
       └─ request()  ──emit──▶  RoomGateway.onAnswer
                                  1. playerOf(client)      ¿hay sesión?  → NOT_IN_ROOM
                                  2. AnswerPayloadSchema   ¿payload válido? → INVALID
                                  3. rooms.action(playerId, action)
                                       a. rate limit 40/10 s
                                       b. withRoomLock(roomId)
                                       c. ¿requestId repetido? → OK sin aplicar
                                       d. engine.dispatch → nuevo estado + effects
                                       e. guardar, publish(room)
                                       f. emitir game:effect
                                  4. return OK  ──ack──▶  request()
```

Puntos que conviene retener:

- **El cliente no calcula nada.** Manda `championId`, no "acerté". El motor
  decide vidas, turnos y ganador.
- **El ack no renderiza.** La UI se actualiza con `room:state`; el ack solo sirve
  para saber si el servidor aceptó y para mostrar el error.
- **El servidor es el reloj.** `RoomService` corre un `setInterval` cada 250 ms
  (`TICK_MS`) y aplica vencimientos, saltos por desconexión y limpieza. En Bomba
  el cliente nunca recibe `fuseEndsAt`: solo `serverTime`, para estimar el reloj.
  Si el vencimiento dependiera del navegador, cualquiera podría pausar la mecha
  cerrando la pestaña.
- **`requestId` es idempotencia.** Si el ack se pierde y el cliente reintenta, el
  servidor no aplica dos veces la misma respuesta.

---

## Desconexión y reconexión

```
socket.close()
  └─ handleDisconnect(client)
       └─ rooms.disconnectSocket(client.id)
            - busca socketIndex[socketId] → { roomId, playerId }
            - si player.socketId !== socketId, ignora (socket viejo reemplazado)
            - connected = false, disconnectedAt = now, ready = false
            - electHost: pasa el anfitrión al conectado más antiguo
            - publish
```

Al reconectar:

1. El cliente detecta `connect` (Socket.IO reintenta solo).
2. `RoomClient` lee el token de `sessionStorage` y vuelve a emitir `room:join`
   con `{ code, token, nickname }`.
3. `joinRoom` resuelve el token a `playerId`, hace `bindPlayer` con el nuevo
   `socketId`, y devuelve el mismo `playerId`.
4. El cliente guarda el ack, vuelve a escuchar y recibe el snapshot.

Consecuencias de diseño:

- **Doble pestaña:** `sessionStorage` es por pestaña, así que dos pestañas son dos
  jugadores. Si se duplica la pestaña, el token se copia; al segundo `bind`,
  `BroadcastService.bind` emite `SESSION_REPLACED` y desconecta el socket viejo.
- **Reinicio del servidor:** los tokens viven en memoria. Al volver, el token no
  resuelve, la sala tampoco existe y el cliente limpia la sesión y pide apodo.
- **Anfitrión:** es un rol, no un proceso. `electHost` lo pasa al conectado con
  menor `seq` y no lo devuelve cuando el anterior reconecta.

---

## Decisiones y alternativas descartadas

| Decisión | Alternativa descartada | Por qué |
| --- | --- | --- |
| Socket.IO | WebSocket puro | reconexión, acks, rooms y fallback vienen resueltos |
| Estado completo en cada `room:state` | diffs / parches | 12 jugadores como máximo; el snapshot es simple y no se desincroniza |
| Servidor autoritativo | validar en el cliente | el cliente es hostil por definición; reglas en `packages/engine` |
| Vista pública + privada | filtrar en el navegador | si el dato viaja, ya está filtrado; el infiltrado no puede leer su rol |
| Token opaco | confiar en `socket.id` | `socket.id` cambia en cada reconexión y no identifica a nadie |
| Candado por sala | confiar en el event loop | mañana el repositorio será async (Postgres) y habrá interleaving |
| Proxy de imagen | usar la URL de Data Dragon | `/spell/AatroxQ.png` lleva la respuesta en el nombre |
| Tick cada 250 ms | un `setTimeout` por fase | un solo lugar aplica todos los vencimientos y es fácil de testear |

---

## Errores frecuentes al tocar esto

1. **Actualizar la UI con el ack.** El ack puede llegar antes o después del
   broadcast y no trae el estado. Renderiza siempre desde `room:state`.
2. **Emitir desde el gateway.** El gateway traduce; `broadcast.service.ts` es el
   único que conoce Socket.IO. Si emites desde otro lado, el día que cambies de
   transporte hay que tocar diez archivos.
3. **Usar el código de sala como room de Socket.IO.** Se usa `room.id` (UUID). El
   código es público y cambia de semántica si algún día hay alias.
4. **Comparar `socket.id` con la identidad.** `socket.id` es la conexión, no el
   jugador. La comparación `player.socketId !== socketId` existe justamente para
   descartar desconexiones viejas.
5. **Poner timers en el cliente.** El navegador se suspende en segundo plano. Los
   vencimientos son del servidor; el cliente solo dibuja la cuenta atrás.
6. **Reusar `requestId` entre acciones distintas.** Debe ser único por intento;
   si lo repites, el servidor lo trata como reintento y responde `OK` sin aplicar.
7. **Probar con una sola pestaña.** Casi todo el comportamiento (host, turnos,
   broadcast, reconexión) necesita 2–3 pestañas o `node scripts/players.mjs`.

Para depurar: DevTools → Network → WS → `socket.io` → Messages. Ahí se ven los
frames `42["bomba:answer",{...}]` (evento) y `43[...]` (ack) en orden.

---

## Las APIs HTTP (breve)

Solo tres rutas, todas en `apps/server/src/catalog/catalog.controller.ts`:

| Ruta | Uso |
| --- | --- |
| `GET /api/champions` | catálogo id + nombre + imagen para el autocompletado |
| `GET /api/avatars` | emotes del lobby |
| `GET /api/clues/:clueId/image` | proxy de la imagen de la pista |

La tercera es la interesante. Data Dragon sirve la pista en una URL que contiene
el nombre del campeón. Si esa URL viajara en el `src` de un `<img>`, la respuesta
de Bomba estaría en el inspector del navegador. En su lugar, el servidor
reescribe `imageUrl` a `/api/clues/c_0001/image`, descarga la imagen real una vez
y la cachea (`IMAGE_CACHE_LIMIT = 600`). El precio es un `fetch` extra la primera
vez; el beneficio es que la pista no se filtra.

---

## Ejercicio

Sin cambiar el comportamiento:

1. Abre tres pestañas en la misma sala y una cuarta en DevTools → Network → WS.
2. Anota el orden de los frames al marcar "listo" en una pestaña.
3. Provoca una desconexión: DevTools → Network → Offline durante 5 s y vuelve.
4. Responde mirando los frames: ¿cuántos `room:join` salieron? ¿Cambió el
   `socket.id`? ¿Cambió el `playerId`?

Pista: el `playerId` está en el ack y el `socket.id` no se envía, pero se deduce
porque el servidor te sigue reconociendo.

---

## Preguntas de repaso

1. ¿Por qué el ack de `room:create` trae `token` y el `room:state` no?
2. ¿Qué pasaría si `publish` se llamara antes de `bindPlayer` en una reconexión?
3. ¿Por qué el candado es por `roomId` y no global?
4. ¿Qué ventaja concreta da que `packages/engine` reciba `now` y `rng` en vez de
   llamar a `Date.now()` y `Math.random()`?
5. Si `private:state` se emitiera con `to(roomId)`, ¿qué se filtraría y en qué
   juego se notaría primero?
6. ¿Por qué una acción rechazada por el motor igual se emite a la sala como
   `game:effect`? (Mira `action()` y decide si es intencional.)

---

## Deberías poder explicar

- La diferencia entre ack y broadcast, y cuándo usa cada uno la app.
- Por qué la identidad es el token y no `socket.id`.
- Qué hace `withRoomLock` y qué problema resuelve aunque hoy el estado sea en
  memoria.
- Cómo se evita que el cliente vea la respuesta de Bomba.
- Qué pasa exactamente al recargar la página, al perder la red y al reiniciar el
  servidor.

## Enlaces

- [`../PRODUCTO.md`](../PRODUCTO.md) — reglas, configuración y modelo de seguridad.
- [`../PRODUCTO.md#7-flujo-en-vivo-conexiones-y-reconexión`](../PRODUCTO.md#7-flujo-en-vivo-conexiones-y-reconexión)
