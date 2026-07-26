# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
# libc6-compat helps Next.js native deps on Alpine
RUN apk add --no-cache libc6-compat \
  && corepack enable \
  && corepack prepare pnpm@8.15.9 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml .npmrc ./
# Lockfile is v6 (pnpm 8). Do not use pnpm@latest (v9/v10).
# Portainer/CI often injects NODE_ENV=production which would skip
# typescript and break `next build` — always install all deps here.
ENV NODE_ENV=
RUN pnpm install --frozen-lockfile --prod=false

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# analyze-worker.cjs is committed (built via `pnpm build:analyze-worker`) so
# Docker does not need esbuild at image-build time.
RUN pnpm build \
  # Collect EVERY @laihoe package (main + linux-*-musl natives) from pnpm's
  # virtual store. A plain copy of node_modules/@laihoe often misses the
  # platform binding that demoparser2 require()'s at runtime (esp. arm64).
  && mkdir -p /app/laihoe-flat \
  && for dir in /app/node_modules/.pnpm/@laihoe+*/node_modules/@laihoe/*; do \
       [ -e "$dir" ] || continue; \
       name="$(basename "$dir")"; \
       rm -rf "/app/laihoe-flat/$name"; \
       cp -aL "$dir" "/app/laihoe-flat/$name"; \
     done \
  && if [ -d /app/node_modules/@laihoe ]; then \
       cp -aL /app/node_modules/@laihoe/. /app/laihoe-flat/; \
     fi \
  && echo "laihoe packages in image:" \
  && ls -la /app/laihoe-flat \
  && test -d /app/laihoe-flat/demoparser2 \
  && ( test -d /app/laihoe-flat/demoparser2-linux-arm64-musl \
       || test -d /app/laihoe-flat/demoparser2-linux-x64-musl )

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV DATA_DIR=/data
ENV ANALYZE_WORKER_PATH=/app/analyze-worker.cjs

RUN apk add --no-cache libc6-compat \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs \
  && mkdir -p /data \
  && chown nextjs:nodejs /data

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Bundled analyze worker (BullMQ consumer + demoparser).
COPY --from=builder --chown=nextjs:nodejs /app/analyze-worker.cjs ./analyze-worker.cjs

# Replace any traced @laihoe stubs with the full native package tree (musl).
USER root
RUN rm -rf ./node_modules/@laihoe
COPY --from=builder --chown=nextjs:nodejs /app/laihoe-flat ./node_modules/@laihoe

USER nextjs
EXPOSE 3000
# Default CMD is the web process; compose overrides for worker.
CMD ["node", "server.js"]
