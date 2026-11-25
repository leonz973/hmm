#!/bin/sh
# 容器启动：SQLite 只需要把表结构对齐到最新 schema（没有迁移历史，用 db push 等价于「补齐表」）
set -e

echo "[entrypoint] 数据库：$DATABASE_URL"
npx prisma db push --schema apps/api/prisma/schema.prisma --skip-generate --accept-data-loss

echo "[entrypoint] 启动 API"
exec node apps/api/dist/main.js
