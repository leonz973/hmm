# HMM · 家庭资产管家

记录家具、电器、耗材的**质保期**与**预计更换时间**，在到期前算出「这次大概要花多少钱」，
再叠上固定支出与账单，让家里的大额开销能提前几个月开始攒钱。

- **技术栈**：Vue 3 + Vite + TypeScript + Pinia（PWA）／ NestJS + Prisma + SQLite ／ Caddy + Docker Compose
- **数据模式**：未登录 = 本地模式（只存浏览器）；登录 = 云同步（多设备、家人共享同一个家）

## 现在能做什么

| 模块 | 能力 |
| --- | --- |
| 资产台账 | 名称/品类/房间/购买日期/价格/质保月/预计寿命/使用强度，自动算质保到期、换新日期、寿命进度、残值、换新预估金额 |
| 首页 | 本月固定支出、未来 12 个月预计更换、需要你决定的事、未来 12 个月现金流（换新 + 固定支出，给出「每月建议预留」） |
| 账目 | 固定支出（月/季/半年/年）、水电燃气账单（已缴/未缴/逾期）、发票（可关联资产、传 PDF/图片） |
| 到期日历 | 按月俯瞰固定支出扣款日 + 账单到期 + 资产质保/换新提醒 |
| 提醒 | 每天 06:00 扫一遍到期项，合并成一封邮件（未配 SMTP 时写 HTML 预览文件）；提前天数可调（默认质保 60 天、换新 90 天） |
| 家庭 | 8 位邀请码 72 小时有效，成员共享同一份数据；户主可改家庭名与提醒设置 |
| 备份 | 导出 JSON（全量）/ 资产 CSV（Excel 直接打开）/ 导入合并，一键清空 |

## 目录

```
apps/web        Vue 3 前端（6 个页面 + Pinia store + IndexedDB 附件缓存）
apps/api        NestJS 后端（auth / households / assets / fixed-expenses / bills / invoices / reminders / attachments）
packages/shared 前后端共用：金额换算、质保到期、换新日期、品类默认寿命
deploy          Dockerfile、Caddyfile、docker-compose.yml、备份脚本（见 deploy/README.md）
docs            DESIGN.md（设计令牌）、ARCHITECTURE.md（架构与接口）
PRD.md          产品需求文档
```

## 本地开发

```bash
# 1. 装依赖（本机 pnpm 不可用，用 npm workspaces）
npm install --ignore-scripts

# 2. 准备后端环境变量
cp apps/api/.env.example apps/api/.env      # 至少设 JWT_SECRET；数据库默认 file:./dev.db

# 3. 建库 + 生成 Prisma Client（在 apps/api 目录下执行，DATABASE_URL 在那里）
cd apps/api && npx prisma db push && cd ../..

# 4. 起服务（前端 5173，后端 3000，vite 已配 /api 代理）
npm run dev
```

前端：<http://127.0.0.1:5173> ／ 后端健康检查：<http://127.0.0.1:3000/api/v1/health>

### 想先看看有数据的样子

```bash
npm run seed:demo     # 建一个演示家庭：8 件资产 / 7 项固定支出 / 8 张账单 / 3 张发票
```

账号 `demo@hmm.local`，密码 `hmm12345`（仅本地演示用）。里面特意留了「小米电视质保 5 天后到期」「扫地机器人 5 天后换新」几条，登录后首页就能看到提醒与预留金额。

不登录也能用：不登录时是**本地模式**，数据只存在当前浏览器（localStorage + IndexedDB），适合先试试手感；登录后同一套界面切成云端，数据落在 `apps/api/dev.db`，附件落在 `apps/api/storage/attachments`。

```bash
npm run build        # shared → web → api 全量构建
npm run test         # 前端单测 + 页面挂载冒烟（vitest）
npm run typecheck
```

## 部署

见 [`deploy/README.md`](deploy/README.md)：一台装了 Docker 的服务器，
`docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build`，
无域名也能用 `http://服务器IP` 访问；有域名后 Caddy 自动签 HTTPS。

## 里程碑

| 阶段 | 内容 | 状态 |
| --- | --- | --- |
| M1 | 骨架、设计令牌、页面壳 | ✅ |
| M2 | 账号、家庭、云同步、资产台账 | ✅ |
| M3 | 到期计算与提醒引擎（邮件） | ✅ 代码完成，等 SMTP 授权码验证真实投递 |
| M4 | 固定支出、账单、发票、附件上云 | ✅ |
| M5 | 现金流预测、日历、导出备份 | ✅ |
| M6 | 生产部署（Docker Compose）、备份、监控 | 🚧 部署物已就绪，待服务器执行 |
