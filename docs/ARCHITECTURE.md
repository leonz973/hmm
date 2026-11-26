# HMM 系统架构设计 v1.0

> 依据 PRD v1.0 + DESIGN v1.0。技术栈（已确认）：Vue 3 + Vite PWA / NestJS + Prisma + **SQLite**（原定 PostgreSQL，实现期因本地零依赖改为 SQLite，见 §2 注）/ 附件暂用本地磁盘（预留 MinIO 接口）/ Docker Compose 自建。

## 1. 系统组成

```
                    ┌─────────────────────────────────────────┐
 浏览器/PWA ──HTTPS──▶ Caddy 反向代理（自动 HTTPS + 静态托管 web）  │
                    │   ├── /            → web 静态文件 (PWA)    │
                    │   └── /api, /ws    → api (NestJS)         │
                    │                                               │
                    │  api ──── SQLite（业务数据，权威源，单文件）     │
                    │   ├──── 本地磁盘（发票/图片附件，STORAGE_DIR）   │
                    │   └──── Redis（可选：队列/限流/会话黑名单）      │
                    └─────────────────────────────────────────┘
```

| 组件 | 选型 | 说明 |
| --- | --- | --- |
| Web 前端 | Vue 3 + Vite + TS + Naive UI + Pinia + vue-router | `vite-plugin-pwa`：可安装、离线只读缓存、Web Push |
| API 服务 | NestJS（模块化）+ Prisma ORM | REST `/api/v1`，JWT 认证，SSE 变更推送 |
| 数据库 | SQLite（Prisma provider sqlite） | 唯一权威数据源；本地 `file:./dev.db`，生产挂卷 `/data/hmm.db`；用 `prisma db push` 对齐表结构 |
| 附件存储 | 本地磁盘（预留 MinIO） | `STORAGE_DIR/attachments`，`Attachment` 表存元数据，接口按家庭隔离；换 MinIO 只改 AttachmentsService 的 put/get/remove |
| 反向代理 | Caddy 2 | 自动申请/续期 HTTPS 证书（只需域名指向服务器） |
| 邮件 | SMTP（Nodemailer） | 注册验证、找回密码、（V1）提醒摘要 |
| 定时任务 | @nestjs/schedule | 每日提醒计算、邀请码过期清理、备份触发 |
| 可选缓存 | Redis | MVP 可省；V1 后按需（推送队列、限流） |

## 2. Monorepo 结构（npm workspaces；pnpm 在本机 store 锁在 C 盘不可用）

```
HMM/
├── apps/
│   ├── web/                  # Vue3 SPA + PWA
│   │   └── src/{modules/{assets,warrants,expenses,bills,invoices,family,settings,dashboard},
│   │           shared/{api,components,composables,stores,utils}, router, pages}
│   └── api/                  # NestJS
│       └── src/{auth,users,households,assets,warranties,expenses,bills,invoices,
│               reminders,dashboard,upload,notifications,common}
├── packages/
│   └── shared/               # 前后端共享：DTO 类型、枚举、品类默认寿命数据、金额工具
├── deploy/
│   ├── docker-compose.yml    # caddy + api + postgres + minio
│   ├── Caddyfile
│   ├── .env.example
│   └── backup.sh             # pg_dump + mc mirror 定时备份
├── docs/                     # PRD / DESIGN / ARCHITECTURE
├── package.json（workspaces: apps/*, packages/*）
```

## 3. API 设计约定

- 前缀 `/api/v1`；资源复数：`/assets`、`/maintenance`、`/saving-goals`、`/insurance`、`/fixed-expenses`、`/utility-bills`、`/invoices`、`/reminders`。
- 认证：`Authorization: Bearer <accessToken>`（15min）+ `refreshToken`（30d，旋转刷新）；密码 argon2id 哈希。
- **家庭隔离**：所有业务查询必须带 `householdId`（来自当前会话选中的家庭，中间件注入 + Prisma 查询强制过滤）；跨家庭访问返回 404 不泄露存在性。
- 校验：入参 class-validator DTO；分页 `?page=&pageSize=`（默认 20，最大 100）；软删除 `deletedAt` 过滤在 Prisma 中间件统一处理。
- 变更推送：`GET /api/v1/events`（SSE，按家庭频道广播 `{entity, id, action, updatedBy, at}`）；客户端收到后按模块失效缓存重取。MVP 不做字段级合并，冲突提示策略见 PRD §9.1。
- 文件上传：`POST /api/v1/uploads/presign` → 客户端直传 MinIO（预签名 PUT，限类型 image/jpeg,png,webp,pdf / 限 10MB；前端先压缩长边至 2048px）→ 回传 objectKey 建立关联。读取走预签名 GET（私有桶，URL 15min 有效）。
- 错误规范：`{ code, message, details? }`；HTTP 语义正确（400 校验 / 401 未登录 / 403 无权 / 404 不存在 / 409 冲突 / 422 业务规则）。

## 4. 数据模型（Prisma 核心）

```
User            id, email(unique), passwordHash, displayName, emailVerifiedAt, createdAt
Household       id, name, ownerUserId, inviteCode(unique,带过期), createdAt, deletedAt
Membership      id, userId, householdId, role(owner|member), joinedAt   @@unique([userId,householdId])
Category        id, householdId?, parentId?, name, icon, defaultLifeMonths?,
                defaultWarrantyMonths?, isBuiltin          # 内置品类 householdId 空，全家庭只读
Location        id, householdId, name
Asset           id, householdId, name, categoryId, brand?, model?, sn?, purchaseDate?,
                price?, qty, locationId?, status(in_use|replaced|scrapped|donated|sold),
                usageLevel(low|mid|high)?, expectedReplacementDate?, estReplacementPrice?,
                createdBy, createdAt, updatedAt, deletedAt
Warranty        id, assetId, type(manufacturer|extended|seller), startDate, endDate,
                provider?, invoiceId?
FixedExpense    id, householdId, name, amount, cycle(month|quarter|half_year|year|custom_days),
                customDays?, firstDueDate, account?, autoPay, active, endDate?, deletedAt
ExpenseRecord   id, householdId, date, amount, note?, refType(fixed|utility|manual),
                refId?, createdBy
UtilityBill     id, householdId, type(water|electricity|gas|property), periodStart, periodEnd,
                amount, usage?, reading?, invoiceId?, deletedAt
Invoice         id, householdId, files Json[{objectKey,size,mime}], amount?, invoiceDate?,
                merchant?, invoiceNo?, note?, reimbursed?, createdBy, deletedAt
Attachment      id, householdId, objectKey, mime, size, width?, height?, entity, entityId
Reminder        id, householdId, type(warranty_expire|replacement|fixed_due|subscription),
                refId, fireDate, severity(info|warn|urgent), payload Json, readAt?,
                sentPushAt?, createdUpdatedAt
MaintenanceTask id, householdId, assetId, title, cycleDays, nextDate          # V1.x
BudgetGoal      id, householdId, assetId, targetAmount, targetDate, monthlyPlan # V1.x
AuditLog        id, householdId, userId, action, entity, entityId, detail Json, at
```

要点：
- 金额一律 `Decimal(12,2)` + 币种字段预留；日期用 `LocalDate`（无时区歧义），提醒计算用服务器本地时区（部署时配置 `TZ=Asia/Shanghai`）。
- `Reminder` 由每日定时任务从 Warranty/FixedExpense/Asset 推算生成（幂等：按 type+refId+fireDate 唯一），不随业务表冗余存日期。
- 品类默认寿命表作为种子数据放 `packages/shared`（前后端共用同一份，PRD FR-3.1）。

## 5. 关键流程

### 5.1 认证与组家
```
注册(邮箱+密码+验证码链接) → 登录(JWT) → 创建家庭(成为 owner, 生成内置品类+默认房间)
   或 输入邀请码加入(role=member) → 选择当前家庭 → 进入工作台
邀请: owner 生成邀请链接(7天有效/限10人) → 新用户注册后自动绑定 membership
```

### 5.2 提醒引擎（每日 06:00 cron）
```
扫描: 质保 endDate - 30/7/1 天 | 预计更换日 - 90 天 | 固定支出 nextDue - 3 天
生成/去重 Reminder → 站内提醒中心
推送: Web Push(VAPID) 给开启推送的成员; P0 失败兜底=站内红点
```

### 5.3 以旧换新（资产处置向导）
```
旧资产: status=replaced + replacedAt + 关联新资产id
新资产: 预填旧资产品类/位置/凭证(可沿用) + 新购买信息
质保/寿命/提醒: 按新资产重算; 旧提醒关闭
```

### 5.4 备份（每日 03:00）
```
backup.sh: pg_dump -Fc → deploy/backups/2026-11-23.dump (保留30份)
           mc mirror minio/hmm-attachments → deploy/backups/files/
恢复演练: 文档含 docker exec pg_restore 全步骤
```

## 6. 安全基线

- 传输 HTTPS（Caddy 自动）；CORS 白名单；Helmet 安全头；登录/注册/找回 限流 5 次/分钟/IP。
- JWT 密钥与 SMTP/MinIO/DB 凭据全部走环境变量（`.env`，不入库）；`.env.example` 提供模板。
- MinIO 私有桶 + 预签名短时效 URL；上传校验 MIME + 魔数 + 大小；图片服务端二次压缩/转 webp 可选（P1）。
- Prisma 全参数化查询；家庭隔离在 Service 层统一封装（`HouseholdScopedService`），禁止裸 `findMany` 漏 householdId。
- 审计日志记录：删除资产/发票、成员变更、导出、家庭解散。
- 依赖安全：`npm audit` 进 CI；镜像用官方 slim + 固定版本号。

## 7. 环境与部署

- `deploy/docker-compose.yml`：服务 caddy / api / web(静态由 caddy 直接挂载) / postgres16 / minio；volume：pgdata、minio-data、backups、caddy-config。
- 环境变量：`DOMAIN`、`POSTGRES_*`、`MINIO_ROOT_*`、`JWT_SECRET`、`SMTP_*`、`VAPID_KEY`、`TZ`。
- 升级：`git pull && docker compose build api && docker compose up -d`（Prisma migrate 在 api 启动前自动执行）；回滚=切回上一镜像 tag。
- 资源预估：家庭规模负载极低，2C4G 服务器即可流畅运行。

## 8. 测试策略

| 层 | 工具 | 范围 |
| --- | --- | --- |
| API 单测 | Vitest + 内存 PG（testcontainers） | 提醒推算、质保/寿命日期计算、家庭隔离、权限矩阵 |
| API E2E | Supertest | 注册→组家→邀请→录入资产→生成提醒→以旧换新 主链路 |
| Web 组件 | Vitest + Vue Test Utils | 金额格式化、日期工具、关键表单校验 |
| 手工验收 | 按 PRD 验收清单 | 移动端 375px、离线态、双端同步 |

## 9. 工程里程碑（对齐 PRD §11 MVP 范围）

| 阶段 | 交付物 | 验收标准 |
| --- | --- | --- |
| M1 骨架 | monorepo + compose 跑通 + CI | `docker compose up` 打开页面见壳；api health OK |
| M2 账号与家庭 | 注册/登录/验证邮件/邀请/切换家庭 | E2E：两账号不同家庭数据互不可见 |
| M3 资产与质保 | 品类/资产 CRUD + 质保 + 寿命推算 + 凭证上传 | 录入冰箱自动算出质保到期与更换日 |
| M4 固定支出+提醒 | 固定支出 CRUD + 提醒引擎 + 站内中心 + Web Push | 到期前能收到推送与红点 |
| M5 票据 + 首页 | 发票/水单存档检索 + Dashboard 聚合 + 导出 CSV/ZIP | 首页正确聚合当月支出与 30 天到期 |
| M6 打磨上线 | PWA 安装/离线/推送、深色模式、备份恢复演练、部署文档 | 按验收清单全过；手机可安装使用 |

## 10. 待部署前提（需用户确认）

1. 服务器与域名：是否已有可部署的服务器（2C4G 起）与一个域名（HTTPS 必需）？
2. 邮箱 SMTP：用哪家（如阿里云邮件推送/QQ 企业邮/Resend）？
3. 首个里程碑从 M1 骨架开始是否同意？
