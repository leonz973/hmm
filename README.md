# HMM · 家庭资产管家

把家里的家具、电器、耗材记清楚，质保到期与更换时间提前提醒，换新要花多少钱提前算好；固定支出、账单水单、发票一站式存档。全家共用一个账号体系，多设备实时同步。

- **形态**：Web / PWA（手机可"添加到主屏幕"，像 App 一样用）
- **技术栈**：Vue 3 + Vite + Naive UI ／ NestJS + Prisma + PostgreSQL + MinIO ／ Docker Compose 自建
- **文档**：[PRD](PRD.md) · [设计规范](docs/DESIGN.md) · [架构设计](docs/ARCHITECTURE.md)

## 目录结构

```
apps/web        Vue 3 前端（PWA）
apps/api        NestJS 后端 + Prisma
packages/shared 前后端共享类型、金额工具、品类寿命种子表
deploy          Docker Compose / Caddy / 备份脚本
docs            设计、架构文档
```

## 本地开发

```bash
# 1. 安装依赖
pnpm install

# 2. 启动依赖服务（Postgres + MinIO，需要 Docker）
docker compose -f deploy/docker-compose.dev.yml up -d

# 3. 配置后端环境变量
cp apps/api/.env.example apps/api/.env
#    按需修改 DATABASE_URL / SMTP 等

# 4. 初始化数据库
pnpm --filter @hmm/api prisma:generate
pnpm --filter @hmm/api prisma:migrate

# 5. 同时启动前后端
pnpm dev
# 前端 http://localhost:5173  后端 http://localhost:3000/api/v1/health
```

当前进度处于 **M1 骨架**：目录结构、共享类型、设计令牌、页面外壳与演示数据已完成；账号与家庭、资产台账等业务模块按里程碑推进（见 [架构文档 §9](docs/ARCHITECTURE.md)）。

## 生产部署（自有服务器）

```bash
# 在服务器上
git clone <repo> /srv/hmm && cd /srv/hmm
cp deploy/.env.example deploy/.env   # 填写数据库密码、JWT_SECRET、SMTP
pnpm install && pnpm build           # 构建前端
cp -r apps/web/dist/* deploy/data/web/
docker compose -f deploy/docker-compose.yml up -d --build
```

- **有域名**：`deploy/.env` 里 `DOMAIN=hmm.example.com`，Caddy 自动申请 HTTPS。
- **暂无域名**：`DOMAIN=:80`，用 `http://服务器IP` 访问；浏览器推送与 PWA 安装需要 HTTPS，域名就绪后切换即可（其余功能不受影响）。
- **备份**：`deploy/backup.sh` 放入 crontab 每日执行，保留 30 份。

## 里程碑

| 阶段 | 内容 | 状态 |
| --- | --- | --- |
| M1 | monorepo 骨架 + 设计系统 + 页面外壳 | ✅ 进行中 |
| M2 | 账号、邮箱验证、家庭共享、邀请 | 待开始 |
| M3 | 资产台账、质保期、寿命预测、凭证上传 | 待开始 |
| M4 | 固定支出、提醒引擎、站内提醒 + 推送 | 待开始 |
| M5 | 发票/水单存档、首页聚合、导出 | 待开始 |
| M6 | PWA、深色模式、备份演练、上线 | 待开始 |
