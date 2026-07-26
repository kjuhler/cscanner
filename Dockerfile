# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
# libc6-compat helps Next.js native deps on Alpine
RUN apk add --no-cache libc6-compat \
  && corepack enable \
  && corepack prepare pnpm@8.15.9 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
# Lockfile is v6 (pnpm 8). Do not use pnpm@latest (v9/v10).
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build \
  # Flatten @laihoe packages (pnpm symlinks → real files) for the runner image.
  # Avoids "cannot replace directory with file" when overlaying onto standalone.
  && mkdir -p /app/laihoe-flat \
  && cp -aL /app/node_modules/@laihoe/. /app/laihoe-flat/

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN apk add --no-cache libc6-compat \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Bundled analyze worker — runs demoparser off the HTTP process (avoids Cloudflare 502 while polling).
COPY --from=builder --chown=nextjs:nodejs /app/analyze-worker.cjs ./analyze-worker.cjs

# Replace any traced @laihoe stubs with the full native package tree (musl).
USER root
RUN rm -rf ./node_modules/@laihoe
COPY --from=builder --chown=nextjs:nodejs /app/laihoe-flat ./node_modules/@laihoe

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
