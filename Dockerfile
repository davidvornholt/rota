# syntax=docker/dockerfile:1

FROM docker.io/oven/bun:1.4.0-alpine AS deps
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/a11y-testing/package.json ./packages/a11y-testing/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/typescript-config/package.json ./packages/typescript-config/package.json
RUN bun install --frozen-lockfile

FROM docker.io/oven/bun:1.4.0-alpine AS builder
WORKDIR /app

COPY --from=deps /app ./
COPY . .
RUN bun run --cwd apps/web build

FROM docker.io/oven/bun:1.4.0-alpine AS prod-deps
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/a11y-testing/package.json ./packages/a11y-testing/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/typescript-config/package.json ./packages/typescript-config/package.json
RUN bun install --frozen-lockfile --production

FROM docker.io/oven/bun:1.4.0-alpine AS runner
WORKDIR /app/apps/web

ENV NODE_ENV=production
ENV PORT=3000

RUN apk add --no-cache curl \
  && addgroup -S app \
  && adduser -S app -G app

COPY --chown=app:app --from=prod-deps /app/node_modules /app/node_modules
COPY --chown=app:app --from=prod-deps /app/apps/web/node_modules ./node_modules
COPY --chown=app:app --from=prod-deps /app/packages/db/node_modules /app/packages/db/node_modules
COPY --chown=app:app --from=builder /app/apps/web/dist ./dist
COPY --chown=app:app --from=builder /app/apps/web/package.json ./package.json
COPY --chown=app:app --from=builder /app/apps/web/scripts ./scripts
COPY --chown=app:app --from=builder /app/packages/db /app/packages/db

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/api/healthz" >/dev/null || exit 1

USER app

CMD ["bun", "run", "start"]
