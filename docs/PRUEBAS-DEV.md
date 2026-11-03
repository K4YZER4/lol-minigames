# Pruebas rápidas (solo desarrollo)

Atajos para probar cualquier modo sin crear sala, unirse y marcar "listo" a mano
en varias pestañas.

> Estas rutas existen **solo con `NODE_ENV=development`**. En producción
> responden `404`.

## Requisitos

1. Servidor de juego encendido en `http://localhost:3001`.
2. Web encendida en `http://localhost:3000`.
3. Reiniciar el servidor una vez después de cambiar el endpoint.

```bash
npm run dev
```

## Enlaces directos

Abre cualquiera en el navegador:

| Modo | Enlace | Jugadores |
| --- | --- | --- |
| Todos | `http://localhost:3000/dev/test` | — |
| Bomba | `http://localhost:3000/dev/test/bomba` | 4 |
| Impostor | `http://localhost:3000/dev/test/impostor` | 5 |
| Pictionary | `http://localhost:3000/dev/test/pictionary` | 4 |
| ¿Quién soy? | `http://localhost:3000/dev/test/quien-soy` | 4 |
| Carrera de pistas | `http://localhost:3000/dev/test/carrera` | 4 |
| Carrera de pistas: Sonido | `http://localhost:3000/dev/test/carrera-sonido` | 4 |
| Imitación de voz | `http://localhost:3000/dev/test/imitacion` | 4 |
| Descripción | `http://localhost:3000/dev/test/descripcion` | 4 |
| Dúo a ciegas | `http://localhost:3000/dev/test/duo` | 4 |
| Party | `http://localhost:3000/dev/test/party` | 4 |

### Preview del filtro de audio

Este preview no crea una sala multiplayer; sirve para comprobar los cinco clips
limpios del catálogo local:

```text
http://localhost:3000/dev/test/audio
```

La distorsión queda desactivada temporalmente para garantizar que todas las
líneas sean audibles.

Cada enlace:

1. crea una sala nueva;
2. agrega jugadores automáticos;
3. los marca como listos;
4. selecciona el modo;
5. arranca la partida;
6. te redirige a la sala como anfitrión.

### Enlace de invitación

Dentro de la sala de prueba, el botón **Copiar enlace** copia una URL como:

```text
http://localhost:3000/room/ABC123
```

Al abrirla, la persona entra directamente a la pantalla de esa sala: solo
elige su icono, escribe su nombre y pulsa **Entrar**. No necesita escribir el
código manualmente.

### Cambiar la cantidad de jugadores

```text
http://localhost:3000/dev/test/pictionary?players=8
```

Rango permitido: **3 a 12**.

## Endpoint directo

Si prefieres el JSON en vez de la redirección:

```http
GET http://localhost:3001/api/dev/test-room?mode=pictionary&players=5
```

Para el modo sonoro:

```http
GET http://localhost:3001/api/dev/test-room?mode=carrera-sonido&players=4
```

El audio se sirve mediante `/api/audio-clues/:clueId`; el `clueId` es opaco y
no contiene el nombre del campeón.

Para probar imitación:

```http
GET http://localhost:3001/api/dev/test-room?mode=imitacion&players=4
```

Respuesta:

```json
{
  "ok": true,
  "mode": "pictionary",
  "players": 5,
  "roomCode": "ABCD23",
  "hostPath": "/room/ABCD23?devToken=...&devPlayerId=...&devNickname=Dev+Host",
  "hostUrl": "http://localhost:3000/room/ABCD23?devToken=...",
  "note": "Abre hostUrl para entrar como anfitrión..."
}
```

- `hostPath`: ruta relativa al origen de la web.
- `hostUrl`: URL absoluta asumiendo `localhost:3000`.

## Qué hace por dentro

El endpoint llama a `RoomService.createDevTestRoom`:

- crea la sala con el socket ficticio `dev-host-<uuid>`;
- une a los demás jugadores con `dev-player-<n>-<uuid>`;
- aplica `configure({ mode })`;
- marca a todos como listos;
- ejecuta `startSession`.

Al abrir `hostUrl`, el navegador entra con el token del anfitrión y reemplaza el
socket ficticio por el real. No hay jugadores fantasma enviando eventos.

## Solución de problemas

| Síntoma | Causa probable |
| --- | --- |
| `404` en `/dev/test/...` | La web corre en producción o el modo no existe |
| "El servidor respondió 404" | El servidor corre en producción |
| "No se pudo conectar" | El servidor de juego no está en `:3001` |
| La sala abre en el lobby | `startSession` falló; revisa los logs del servidor |
| "La partida ya empezó" | El token expiró o el servidor se reinició; vuelve a abrir el enlace |

Si el servidor se reinicia, las salas viven en memoria y desaparecen. Genera un
enlace nuevo.

## Seguridad

- Las rutas se bloquean cuando `NODE_ENV=production`.
- No hay autenticación adicional: cualquiera en tu red local puede usarlas.
- No expongas el servidor de desarrollo a internet.
- Los tokens que aparecen en la URL son de salas temporales en memoria.
