# LoL Party

Minijuegos de League of Legends para jugar con amigos en una sala privada.
Hoy: **Bomba** e **Impostor**, ambos completos.

Sin cuentas, sin ranking global, sin desconocidos. Se comparte un código de 6
caracteres y se juega.

## Arrancar

```bash
npm install
npm run content    # genera el catálogo desde Data Dragon 16.21.1
npm run dev        # servidor :3001 + web :3000
```

Abrí `http://localhost:3000` y creá una sala. Para probar solo, abrí la misma
sala en tres pestañas o navegadores con apodos distintos.

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor y web en paralelo |
| `npm run content` | Regenera `packages/content/data` |
| `npm test` | Reglas del motor (26 tests) |
| `npm run e2e` | Flujo real contra el servidor (43 comprobaciones) |
| `npm run typecheck` | TypeScript en los cuatro paquetes |
| `npm run build` | Build de producción de la web |

## Estructura

```
apps/web            Next.js 15 (App Router)
apps/server         NestJS + Socket.IO (proceso persistente)
packages/protocol   contrato: zod, eventos, vistas públicas y privadas
packages/engine     reglas puras, sin red ni relojes
packages/content    importador de Data Dragon + datos generados
scripts/            e2e, jugadores de prueba, arranque en desarrollo
docs/PRODUCTO.md    reglas, configuración cerrada y arquitectura
```

## Documentación

- [`docs/PRODUCTO.md`](docs/PRODUCTO.md): reglas exactas, decisiones cerradas,
  modelo de seguridad y flujo de conexiones/reconexión.
- [`docs/PRUEBAS-DEV.md`](docs/PRUEBAS-DEV.md): enlaces de prueba por modo para
  abrir una partida ya iniciada sin crear sala a mano.

## Aviso

League of Legends es propiedad de Riot Games. Este proyecto es de uso local
entre amigos; Riot no permite publicar juegos con su propiedad intelectual.
