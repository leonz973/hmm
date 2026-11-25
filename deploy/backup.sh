#!/bin/sh
# HMM 每日备份：SQLite 数据库 + 附件目录（都在 hmm_data 这个卷里）
# 安装（服务器）：crontab -e → 0 3 * * * /path/to/deploy/backup.sh >> /var/log/hmm-backup.log 2>&1
set -eu

cd "$(dirname "$0")"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP="${KEEP:-30}"
VOLUME="${VOLUME:-hmm_data}"
STAMP=$(date +%F_%H%M)

mkdir -p "$BACKUP_DIR"

echo "[$(date -Iseconds)] 打包数据卷 ${VOLUME}…"
# 卷里是 hmm.db（SQLite）+ storage/（附件）；用 --rm 一次性容器，宿主机不用装 sqlite
docker run --rm \
  -v "${VOLUME}:/data:ro" \
  -v "$(pwd)/${BACKUP_DIR}:/backup" \
  alpine:3.20 \
  sh -c "cd /data && tar czf /backup/hmm_${STAMP}.tar.gz ."

echo "[$(date -Iseconds)] 清理超过 ${KEEP} 份的旧备份…"
ls -1t "$BACKUP_DIR"/hmm_*.tar.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f

echo "[$(date -Iseconds)] 完成：$BACKUP_DIR/hmm_${STAMP}.tar.gz"
