# syntax=docker/dockerfile:1.7

# La misma versión de Node se usa en el builder y en el runtime.
ARG NODE_VERSION=24.16.0

FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app

# Manifiestos primero: si no cambian, Docker reutiliza la capa de npm ci.
COPY package.json package-lock.json ./
COPY packages/protocol/package.json packages/protocol/
COPY packages/engine/package.json packages/engine/
COPY packages/content/package.json packages/content/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci

# Código y validación de tipos del servidor.
COPY tsconfig.base.json ./
COPY packages/protocol packages/protocol
COPY packages/engine packages/engine
COPY packages/content packages/content
COPY apps/server apps/server
# Regenera el catálogo (incluye avatares) con la versión actual de Riot.
RUN npm run content
RUN npm run typecheck -w @lolgames/server

FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

# Solo dependencias de producción del servidor (tsx ya es dependency).
COPY package.json package-lock.json ./
COPY packages/protocol/package.json packages/protocol/
COPY packages/engine/package.json packages/engine/
COPY packages/content/package.json packages/content/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --workspace @lolgames/server --include-workspace-root \
  && npm cache clean --force

# Código y configuración que necesita tsx en tiempo de ejecución.
COPY --chown=node:node tsconfig.base.json ./
COPY --chown=node:node --from=builder /app/packages ./packages
COPY --chown=node:node apps/server ./apps/server

USER node
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" >/dev/null || exit 1

CMD ["./node_modules/.bin/tsx", "--tsconfig", "apps/server/tsconfig.json", "apps/server/src/main.ts"]
