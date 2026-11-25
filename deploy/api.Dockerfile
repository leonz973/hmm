# HMM API 镜像：npm workspaces monorepo，只产出 @hmm/api
# 构建上下文必须是仓库根目录（compose 里已配 context: ..）

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --ignore-scripts --no-audit --no-fund

FROM deps AS build
WORKDIR /app
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @hmm/shared \
 && npx prisma generate --schema apps/api/prisma/schema.prisma \
 && npm run build -w @hmm/api

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000
# node_modules 带上产物里已生成的 Prisma Client
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY package.json ./
COPY apps/api/package.json apps/api/
COPY deploy/api-entrypoint.sh /usr/local/bin/api-entrypoint.sh
RUN chmod +x /usr/local/bin/api-entrypoint.sh && mkdir -p /data/storage
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/api-entrypoint.sh"]
