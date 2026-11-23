#!/bin/sh
# HMM 每日备份：Postgres 逻辑备份 + MinIO 附件镜像
# 安装（服务器）：crontab -e → 0 3 * * * /path/to/deploy/backup.sh >> /var/log/hmm-backup.log 2>&1
set -eu

cd "$(dirname "$0")"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP="${KEEP:-30}"
STAMP=$(date +%F_%H%M)

mkdir -p "$BACKUP_DIR/files"

echo "[$(date -Iseconds)] 备份数据库…"
docker compose exec -T postgres pg_dump -U "${POSTGRES_USER:-hmm}" -d "${POSTGRES_DB:-hmm}" -Fc \
  > "$BACKUP_DIR/db_${STAMP}.dump"

echo "[$(date -Iseconds)] 备份附件…"
docker compose run --rm --entrypoint sh minio -c \
  "mc alias set local http://minio:9000 \$MINIO_ROOT_USER \$MINIO_ROOT_PASSWORD >/dev/null && mc mirror --overwrite local/${MINIO_BUCKET:-hmm-attachments} /backup/files" \
  -v "$(pwd)/${BACKUP_DIR#./}/files:/backup/files" 2>/dev/null || echo "  (附件镜像跳过：需要 mc 镜像或网络)"

echo "[$(date -Iseconds)] 清理 ${KEEP} 份以上的旧备份…"
ls -1t "$BACKUP_DIR"/db_*.dump 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f

echo "[$(date -Iseconds)] 完成：$BACKUP_DIR/db_${STAMP}.dump"
echo "恢复示例：docker compose exec -T postgres pg_restore -U hmm -d hmm --clean --if-exists < backups/db_xxx.dump"
