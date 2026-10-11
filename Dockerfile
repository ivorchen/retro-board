# Multi-stage production image for the Retro Board Next.js app.
# node:sqlite is a Node core module — no build tools needed in any stage.

FROM node:24-alpine AS base

# --- deps: install exactly the locked dependency tree -------------------------
FROM base AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.34.6 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# --- builder: compile the standalone Next.js server --------------------------
FROM base AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.34.6 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# --- runner: minimal production image ----------------------------------------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Migrations run at startup via server/db/migrate.ts, which reads
# db/migrations/*.sql relative to the working directory — ship them too.
COPY --from=builder /app/db/migrations ./db/migrations

# Writable directory for the SQLite file (mounted as a volume).
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
