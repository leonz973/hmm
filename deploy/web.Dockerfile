# HMM Web 镜像：构建 Vite 静态站 + Caddy 反代 API
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build -w @hmm/shared && npm run build -w @hmm/web

FROM caddy:2-alpine
COPY --from=build /app/apps/web/dist /srv/www
COPY deploy/Caddyfile /etc/caddy/Caddyfile
EXPOSE 80 443
