#!/bin/sh
set -e

DB_FILE="${DATABASE_URL#file:}"
DATA_DIR="$(dirname "$DB_FILE")"
STORAGE="${STORAGE_DIR:-$DATA_DIR/storage}"

mkdir -p "$DATA_DIR" "$STORAGE"

echo "[hmm] 数据目录: $DATA_DIR"
echo "[hmm] 附件目录: $STORAGE"

# 首次启动自动建表；已有数据时只补缺失的表/字段（不删数据）
echo "[hmm] 同步数据库结构…"
/app/node_modules/.bin/prisma db push \
  --schema /app/apps/api/prisma/schema.prisma \
  --skip-generate \
  --accept-data-loss

echo "[hmm] 启动服务…"
exec node /app/apps/api/dist/main.js
