# HMM 部署（自有服务器 · 无域名也能跑）

目标形态：一台装了 Docker 的服务器，`docker compose up -d --build` 之后用 `http://服务器IP` 打开就能用。

## 0. 前置

- 服务器：Linux（Debian/Ubuntu 均可），已装 Docker + Docker Compose v2（`docker compose version` 有输出）
- 放行 80 端口（有域名再放行 443）
- 本机无需 Node、无需数据库：SQLite 与附件都在容器卷 `hmm_data` 里

## 1. 上传代码

```bash
# 在你电脑上：把仓库打包带走（首次）
git archive --format=tar.gz -o hmm.tar.gz HEAD
scp hmm.tar.gz user@服务器:/opt/hmm.tar.gz

# 服务器上
mkdir -p /opt/hmm && tar xzf /opt/hmm.tar.gz -C /opt/hmm && cd /opt/hmm
```

> 之后更新就走 `git pull`（或再传一次包），然后重跑第 3 步的 `up -d --build`。

## 2. 配环境变量

```bash
cp deploy/.env.example deploy/.env
# 至少改这三个：
#   DOMAIN=:80                        无域名就用 :80
#   JWT_SECRET=$(openssl rand -hex 32) 必须换成随机值
#   APP_URL=http://你的服务器IP
# 想收邮件提醒再填 SMTP_*（QQ/163 的「授权码」，不是登录密码）
```

## 3. 启动

```bash
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
docker compose -f deploy/docker-compose.yml ps
curl -s http://127.0.0.1/api/v1/health
```

打开 `http://服务器IP` → 注册账号 → 建资产。

## 4. 日常运维

```bash
# 看日志
docker compose -f deploy/docker-compose.yml logs -f api

# 备份（数据库 + 附件，保留 30 份）
sh deploy/backup.sh
# 建议加进 crontab：0 3 * * * cd /opt/hmm && sh deploy/backup.sh >> /var/log/hmm-backup.log 2>&1

# 恢复
docker compose -f deploy/docker-compose.yml down
docker run --rm -v hmm_data:/data -v /opt/hmm/deploy/backups:/backup alpine:3.20 \
  sh -c "cd /data && tar xzf /backup/hmm_2026-11-25_0300.tar.gz"
docker compose -f deploy/docker-compose.yml up -d
```

## 5. 有域名之后

1. 域名 A 记录指向服务器 IP
2. `deploy/.env` 里 `DOMAIN=hmm.example.com`、`APP_URL=https://hmm.example.com`
3. `up -d` 重启，Caddy 自动申请证书；HTTPS 通了之后 PWA「添加到主屏幕」才完整可用

## 常见问题

| 现象 | 原因 / 处理 |
| --- | --- |
| `please set JWT_SECRET` | 没配 `deploy/.env` 或没带 `--env-file` |
| 打开是 502 | api 还在启动（首次要跑 db push），等 30 秒；仍不行看 `logs api` |
| 邮件没发出去 | `SMTP_PASS` 用了登录密码；QQ 邮箱要用「授权码」，并在邮箱设置里开启 SMTP 服务 |
| 想换端口 | 改 `docker-compose.yml` 里 `web` 的 `ports: "8080:80"` |
