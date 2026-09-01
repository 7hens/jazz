# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

「隐私生活记录仪」（jazz）— 自托管私人生活记录应用：三个 tab（体重 / 财务 / 运动），登录后查看。技术栈：

- **前端**: React 19 + TypeScript + Vite（端口 3000）+ Tailwind 4（`@tailwindcss/vite` 插件）+ Shadcn 风格组件 + recharts 图表
- **后端**: Cloudflare Workers（`worker/` 目录，手写路由），通过 `@cloudflare/vite-plugin` 在 Vite dev server 内嵌 workerd 运行
- **数据库**: Cloudflare D1（binding 为 `DB`，本地 `--local` 存 SQLite 于 `.wrangler/state`）
- **认证**: 单一访问令牌（env `ADMIN_TOKEN`，必填）。首次登录输入令牌后存 HttpOnly + SameSite=Lax cookie（`jazz_token`），令牌永不过期，之后每请求由服务端直接比对 env token

## 常用命令

```bash
npm install            # 安装依赖
npm run dev            # 全栈本地运行（:3000）：Vite dev server + workerd 内跑 worker + 本地 D1
npm run build          # tsc -b && vite build → dist/client（前端）+ dist/jazz_life_tracker（worker 产物）
npm run lint           # oxlint
npm run db:apply       # 将 schema.sql 应用到本地 D1
npm run db:migrate     # 循环执行 migrations/*.sql 下迁移
npm run deploy         # npm run build && wrangler deploy dist/jazz_life_tracker
```

无测试框架。dev 即全栈，`npm run dev` 一条命令即可：

```bash
npm run dev            # 前端 vite + worker(workerd) + 本地 D1，:3000
npm run db:apply       # 建表/改表后重放 schema 到本地 D1
```

### 部署（Cloudflare Workers + Assets）

```bash
npx wrangler d1 execute jazz-life-tracker --remote --file=./schema.sql   # 远程建表
npm run deploy         # build + wrangler deploy dist/jazz_life_tracker
```

环境变量（生产）:`ADMIN_TOKEN`（访问令牌，必填），在 Cloudflare **Workers** 控制台（`jazz-life-tracker` worker 的 Settings → Variables）设置，不再用 Pages 控制台。**本地** dev 从 `.dev.vars` 读取（已 gitignore，本地默认 `jazz-local-dev-token`）；未配置时登录返回 401「未配置访问令牌」。更换令牌会使所有已存 cookie 失效。`wrangler.toml` 持有 worker 入口、D1 binding、assets 配置与 `database_id`。

## 架构

### 后端（Workers + 手写路由，`worker/` 目录）

`worker/index.ts` 是唯一 Worker 入口（`wrangler.toml` 的 `main`），`fetch` 内按 pathname + method 分发到 handler：

- `worker/index.ts` — entry + 路由表（`/api/auth/login`、`/api/auth/logout`、`/api/me`、`/api/records`，其余路径走 `env.ASSETS.fetch`）
- `worker/auth.ts` — `handleLogin`（POST，constant-time 比对 `env.ADMIN_TOKEN`，通过后设 `jazz_token` cookie，upsert 默认用户行）、`handleLogout`（清 cookie）、`handleMe`
- `worker/records.ts` — GET 查询（按 `user_id` 过滤，最多 200 条）、POST 新增（按 type 校验必填字段）、DELETE 删除（按 id + user_id）
- `worker/_lib/auth.ts` — 共享认证工具：`getAuthenticatedUser()`、cookie 读写、constant-time 比较 `safeEqual`；`worker/_lib/http.ts` — `jsonResponse` 辅助

**约定**：每个 handler 先调 `getAuthenticatedUser(request, env)`，未授权返回 401。所有查询按 `user_id` 绑定，实现用户隔离。路由无第三方库（无 itty-router 等），保持简约。

**dev 运行模型**：`@cloudflare/vite-plugin` 读 `wrangler.toml`（main/D1/assets），把 worker 跑在 Vite dev server 内的 workerd 环境。dev 下 `/api/*` 进 worker，其余请求由 Vite 接管（HMR）。D1 本地持久化与 `wrangler d1 --local` 共享 `.wrangler/state`。**没有 localStorage 回退模拟**，前后端始终同一套代码。

**生产运行模型**：`vite build` 输出前端到 `dist/client/`、worker bundle 到 `dist/jazz_life_tracker/`（含生成的 `wrangler.json`，`assets` 指向 `../client`）。`wrangler deploy dist/jazz_life_tracker` 部署 worker + Assets，非 `/api` 请求由 worker 内 `env.ASSETS.fetch` 提供静态资源。

### 数据模型（schema.sql）

表 `records` + `users`（`sessions` 已随 token 认证移除）：

- `records`：`type` ∈ `('expense','income','weight')`；支出/收入共用 `amount`/`category`，体重用 `weight`；`exercise_type`/`duration`/`calories` 列保留但不再写入
- `users`：认证不再使用 email/password_hash（列保留以免迁移），仅存默认用户单行作 `records` 外键；登录时 `INSERT OR IGNORE` 保证存在
- 类型为 camelCase 的字段（如 `exerciseType`）在 SQL 中用 snake_case（`exercise_type`），靠显式别名或映射转换

### 前端（三 tab 单页 App.tsx）

- `src/App.tsx` — 登录门槛 + 持有 records 状态与 CRUD（保存/删除/刷新），按 `activeTab` 渲染三个受控 tab 组件
- `src/components/tabs/` — `WeightTab`（体重）、`FinanceTab`（财务）、`ExerciseTab`（运动）。体重/财务 tab 用 `useMemo` 前端聚合图表数据（趋势/月度收支/分类分布），服务端不聚合；运动 tab 为静态指导（`src/data/exercises.ts`），无数据记录
- `src/components/ui/*` — Shadcn 风格基础组件（card/button/label/input/badge），基于 `class-variance-authority` + `tailwind-merge`
- `src/types.ts` — `LifeRecord` / `RecordFormData` / `UserProfile`，与 D1 列对应
- 数据流：`fetch('/api/...', { credentials: 'include' })`

涉及表结构变更的迁移需按 `npm run db:apply` → `npm run db:migrate` 顺序执行。

## 注意

- 修改 schema 后需重新执行 `npm run db:apply`（本地）与远程 `d1 execute`
- UI 文案为中文，新增文案保持中文
- 依赖精简、无路由库、无状态管理库、无测试框架 —— 新增功能保持同一简约风格
