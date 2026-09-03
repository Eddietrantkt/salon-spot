FROM node:24-bookworm-slim AS build

WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN pnpm install --frozen-lockfile
COPY apps/api apps/api
COPY apps/web apps/web
COPY packages/contracts packages/contracts
RUN pnpm --filter @salon-spot/contracts build \
  && pnpm --filter @salon-spot/api prisma:generate \
  && pnpm --filter @salon-spot/api build \
  && pnpm --filter @salon-spot/web build

# Migration deliberately retains the API workspace's Prisma CLI and engines.
# It is a one-shot image only; API and worker use the slimmer compiled runtime.
FROM build AS migration-runtime
WORKDIR /app/apps/api
ENV NODE_ENV=production

# API and worker intentionally share this exact compiled artifact.
FROM node:24-bookworm-slim AS api-runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/packages/contracts ./packages/contracts
COPY --from=build /app/package.json ./package.json

FROM nginx:1.27-alpine AS web-runtime
COPY infra/nginx.runtime.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
