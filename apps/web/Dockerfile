# Build context is the MONOREPO ROOT, not apps/web: the web app depends on the
# @neutra/commons workspace, so apps/web alone is not a self-contained context.
#   docker build -f apps/web/Dockerfile -t neutra-web .
# Bun is used ONLY as the installer/script tool here; the runtime stays on
# Node 22 (spec D7, same ruling as the API in be7ce94).
FROM oven/bun:1.4.4-alpine AS builder
WORKDIR /app

# Manifests first for a cache-friendly install. --ignore-scripts skips the API
# workspace's prisma postinstall (the web build does not need a Prisma client).
COPY package.json bun.lock ./
COPY apps/web/package.json apps/web/package.json
COPY packages/commons/package.json packages/commons/package.json
RUN bun install --frozen-lockfile --ignore-scripts

# @neutra/commons resolves to its gitignored dist/**, so it must be built before
# the web app in a fresh context.
COPY packages/commons packages/commons
COPY apps/web apps/web
RUN bun run --cwd packages/commons build
RUN bun run --cwd apps/web build

# ---------- Runtime image ----------
FROM node:22-alpine
WORKDIR /app

# Bun's workspace node_modules contain relative symlinks into /app/node_modules
# and /app/packages/commons, so copy the whole layout verbatim. Node follows
# those symlinks; no bun runtime is needed in this stage.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/commons/node_modules ./packages/commons/node_modules
COPY --from=builder /app/packages/commons/dist ./packages/commons/dist
COPY --from=builder /app/packages/commons/package.json ./packages/commons/package.json
COPY --from=builder /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=builder /app/apps/web/dist ./apps/web/dist
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/scripts ./apps/web/scripts
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json

ENV NODE_ENV=production
ENV PORT=3001
# No hardcoded localhost: point at the composed API service. Override at runtime.
ENV BACKEND_API_URL=http://app:3000/api

EXPOSE 3001

WORKDIR /app/apps/web
CMD ["node", "scripts/serve-start.mjs"]
