# LoL Party — producto

Aplicación web para jugar minijuegos de temática League of Legends en salas
privadas con amigos. Sin cuentas, sin matchmaking público, sin ranking global.

Hoy se entregan **dos juegos completos**: **Bomba** e **Impostor**.

---

## 1. Alcance

### Incluido

- Crear sala y compartir un código de 6 caracteres.
- Unirse por código o por enlace directo (`/room/ABC234`).
- Lobby con apodo único, estado de "listo", configuración del anfitrión.
- **Bomba** de 3 a 12 jugadores.
- **Impostor** de 3 a 12 jugadores.
- Reconexión dentro de 30 s con la misma identidad.
- Traspaso automático de anfitrión.
- Estado en memoria, un solo proceso de backend.

### Fuera de alcance (hoy)

- Cuentas, tienda, ranking global, matchmaking público.
- Voz integrada o reconocimiento automático de voz.
- Modo fiesta, Pictionary, Dúo a ciegas, ¿Quién soy?, categoría de audio.
- Base de datos. Toda la persistencia pasa por interfaces reemplazables.

---

## 2. Reglas de Bomba

- 3–12 jugadores, 3 vidas por defecto.
- En cada turno el jugador activo ve **un ícono de habilidad** (Q/W/E/R o
  pasiva) y debe adivinar el campeón.
- La mecha se sortea al azar entre `minFuseMs` y `maxFuseMs` **en cada
  explosión**.
- **Acierto:** la bomba pasa al siguiente jugador **sin reiniciar la mecha**.
- **Fallo:** resta `penaltyMs` (1 s por defecto) a la mecha actual.
- Siempre quedan al menos `minMarginMs` (3 s) para pasar la bomba: el servidor
  nunca deja una mecha más corta que eso tras un fallo.
- **Explosión:** el jugador activo pierde una vida. Con 0 vidas queda como
  espectador.
- Si el jugador activo se desconecta, su turno se salta a los 3 s.
- Gana el último jugador con vidas.
- El cliente envía el `championId` canónico elegido de un autocompletado; nunca
  texto libre.

### Por qué la imagen de la pista es un proxy

Data Dragon sirve las pistas en URLs como `/spell/AatroxQ.png`: el nombre del
campeón está en la URL. Si se enviara tal cual, la respuesta viajaría al
navegador en el `src` de la imagen.

Por eso el servidor expone `GET /api/clues/:clueId/image` y reescribe el
`imageUrl` de cada pista a esa ruta opaca. El cliente solo conoce `c_0001`.

---

## 3. Reglas de Impostor

- 3–12 jugadores. **1 infiltrado** con 3–6 jugadores, **2** desde 7.
- A cada jugador se le asigna un campeón. Los tripulantes comparten el mismo
  (o uno muy parecido); el infiltrado recibe otro distinto y **no sabe que lo
  es**.
- Fases:

| Fase | Qué pasa | Duración |
| --- | --- | --- |
| `ASSIGNMENT` | Cada uno ve su campeón y confirma | 15 s |
| `CLUES` | Pistas en orden, una por jugador | 20 s por turno |
| `DISCUSSION` | Se repasan las pistas | 60 s |
| `VOTING` | Voto secreto, sin auto-voto, abstención permitida | 30 s |
| `REVEAL` | Se revelan campeones, infiltrados y ganadores | — |

- El servidor **rechaza** una pista que contenga el nombre del campeón propio.
- Puntaje: **+1** por cada voto correcto a un infiltrado; **+2** al infiltrado
  que sobrevive.
- Empate o sin mayoría: **gana el infiltrado**.
- La vista privada nunca incluye la etiqueta `isImpostor`: solo el campeón
  propio. Ni el infiltrado sabe que lo es.

---

## 4. Configuración cerrada

```ts
DEFAULT_BOMBA_SETTINGS = {
  lives: 3,
  minFuseMs: 10_000,
  maxFuseMs: 30_000,
  penaltyMs: 1_000,   // −1 s por fallo
  minMarginMs: 3_000, // margen mínimo tras fallar
};

DEFAULT_IMPOSTOR_SETTINGS = {
  assignmentSeconds: 15,
  clueSeconds: 20,
  discussionSeconds: 60,
  voteSeconds: 30,
};

MIN_PLAYERS = 3;
MAX_PLAYERS = 12;
NICKNAME_MAX = 16;
RECONNECT_GRACE_MS = 30_000;
```

Contenido generado desde Data Dragon **16.21.1**, locale `es_MX`: 173
campeones, 865 pistas, 173 pares (86 curados a mano).

El anfitrión puede ajustar vidas y mecha de Bomba desde el lobby.

---

## 5. Arquitectura

```
apps/web (Next.js 15, App Router)
   │  socket.io-client + fetch /api/champions
   ▼
apps/server (NestJS + Socket.IO, proceso persistente)
   │  gateway → RoomService (orquestación + lock por sala)
   ▼
packages/engine (TypeScript puro, sin red ni relojes)
   ▲
packages/protocol (zod + tipos + nombres de eventos)
packages/content (importador de Data Dragon, datos generados)
```

- **`packages/protocol`**: contrato único. Esquemas de entrada, códigos de
  rechazo, vistas públicas y privadas. Todo lo que llega del cliente se valida
  con zod.
- **`packages/engine`**: reglas puras. Recibe `now` y un `rng` sembrable; no
  conoce Socket.IO, ni HTTP, ni `Date.now()`. Por eso se puede testear con
  reloj falso y semilla fija.
- **`apps/server`**: transporte y orquestación. Traduce eventos a acciones,
  aplica el lock, persiste y difunde.
- **`apps/web`**: solo intenciones. No calcula puntajes, vidas, roles ni
  ganadores.

### Puertos reemplazables

`RoomRepository`, `SessionRepository`, `RateLimiter` y `Clock` son clases
abstractas usadas como tokens de inyección. Hoy hay implementaciones en
memoria; mañana se cambian por Postgres/Redis sin tocar la lógica.

---

## 6. Seguridad del modelo

| Riesgo | Mitigación |
| --- | --- |
| Cliente manda puntajes/vidas/roles | El servidor es autoritativo; el cliente solo envía intenciones |
| Ver el estado privado de otro | `private:state` se emite por socket individual |
| Suplantar identidad | Token de 32 bytes emitido por el servidor; `socket.id` no es identidad |
| Duplicar una acción por reintento | `requestId` idempotente (últimos 50 por jugador) |
| Abuso de eventos | Rate limit por jugador (40 acciones / 10 s) |
| Pistas que delatan la respuesta | Proxy de imagen + `championId` nunca en la vista pública |
| Nombre propio en la pista de Impostor | El servidor compara contra el campeón asignado |
| Cerrar el navegador del anfitrión | El host es un rol de la sala, no el proceso; se reasigna solo |

El modelo de amenaza es "amigos jugando", no internet hostil. Compartir el
enlace o el token no se puede impedir sin cuentas.

---

## 7. Flujo en vivo (conexiones y reconexión)

```
Jugador A                     Servidor                      Jugador B
   │  room:create ───────────────▶│                              │
   │◀── ack {playerId, token} ────│                              │
   │  join(canal de sala)         │                              │
   │◀── room:state + private ─────│                              │
   │                              │◀──────────── room:join ──────│
   │◀── room:state (2 jugadores) ─┼── ack {playerId, token} ────▶│
   │                              │                              │
   │  session:start (anfitrión) ─▶│  crea el juego               │
   │◀── room:state PLAYING ───────┼── room:state PLAYING ───────▶│
   │                              │                              │
   │  (se corta la red)           │  marca connected=false       │
   │                              │  reasigna anfitrión          │
   │                              │── room:state ───────────────▶│
   │  room:join {token} ─────────▶│  mismo playerId, nuevo socket│
   │◀── room:state (reconectado) ─┼── room:state ───────────────▶│
```

- **Canal de sala:** cada socket entra al room de Socket.IO con el `roomId`
  interno. El estado público se emite una sola vez por sala; el privado, socket
  por socket.
- **Identidad:** el token vive en `sessionStorage` por sala. Al reconectar se
  reenvía y el servidor rebindea el socket al mismo `playerId`.
- **Doble pestaña:** la segunda conexión con el mismo token expulsa a la
  primera con `SESSION_REPLACED`.
- **Anfitrión:** es el jugador conectado más antiguo (`seq`). Si se desconecta,
  se reasigna al siguiente. **No rebota** cuando el anterior vuelve.
- **Reloj:** el servidor corre un tick cada segundo, aplica vencimientos,
  saltos por desconexión y limpia salas vacías a los 5 minutos.
- **Lock:** todas las operaciones de una sala pasan por `withRoomLock`, así que
  leer-validar-mutar-guardar es atómico y se emite un solo broadcast por
  operación.

---

## 8. Cómo correr

Requisitos: Node 20+.

```bash
npm install
npm run content      # genera packages/content/data/*.json (173 campeones)
npm run dev          # servidor :3001 + web :3000
```

Abrí `http://localhost:3000`, creá una sala y compartí el código. Para probar
solo, abrí la sala en tres pestañas (o tres navegadores) con apodos distintos.

### Variables de entorno

| Variable | Default | Uso |
| --- | --- | --- |
| `PORT` | `3001` | Puerto del servidor |
| `WEB_ORIGIN` | `http://localhost:3000` | Orígenes CORS permitidos |
| `PUBLIC_BASE_URL` | `http://localhost:3001` | Base de las URLs de pistas |
| `NEXT_PUBLIC_GAME_SERVER_URL` | `http://localhost:3001` | Servidor que usa el navegador |

---

## 9. Pruebas

```bash
npm test        # reglas puras del motor (vitest)
npm run e2e     # flujo real contra el servidor levantado
npm run typecheck
```

Para probar la interfaz con varios jugadores sin abrir varias ventanas:

```bash
node scripts/players.mjs CODIGO Beto Caro
```

Mete dos jugadores falsos ya marcados como listos y los deja conectados.

El e2e cubre 43 comprobaciones: creación y unión de sala, apodo duplicado,
permisos de anfitrión, arranque, una ronda de Bomba (fallo, acierto,
idempotencia, fuera de turno), invariantes de seguridad, reconexión con token,
traspaso de anfitrión sin rebote, una partida completa de Impostor hasta la
revelación y la vuelta al lobby.

---

## 10. Deuda conocida

- Estado en memoria: reiniciar el servidor cierra las salas.
- Sin persistencia de partidas ni historial.
- Las pistas son solo íconos de habilidad; el modo audio quedó diferido.
- El e2e usa los datos locales de contenido para conocer la respuesta correcta.
- Riot prohíbe el uso de su propiedad intelectual en juegos publicados
  ("Legal Jibber Jabber"). Este proyecto es de uso local entre amigos.
