FROM node:24-slim AS base
RUN corepack enable
WORKDIR /app

# --- deps ---
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# --- build ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# --- production ---
FROM node:24-slim AS production
WORKDIR /app

COPY --from=build /app/.output ./.output
COPY --from=build /app/package.json ./package.json

# better-sqlite3 native binary lives in .output (bundled by Nitro).
# If it doesn't, install only the runtime dep:
# RUN npm install better-sqlite3 --omit=dev

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV DB_PATH=/app/data/app.db
ENV HOST=0.0.0.0
ENV PORT=3000
EXPOSE 3000

# Auto-run migrations + start server
CMD ["node", ".output/server/index.mjs"]
