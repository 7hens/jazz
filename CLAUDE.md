# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

「隐私生活记录仪」（jazz）— 自托管私人生活记录应用：三个 tab（体重 / 财务 / 运动），登录后查看。技术栈：

- **前端**: React 19 + TypeScript + Vite（端口 3000）+ Tailwind 4（`@tailwindcss/vite` 插件）+ Shadcn 风格组件 + recharts 图表
- **后端**: Cloudflare Pages Functions（`functions/` 目录文件式路由）
- **数据库**: Cloudflare D1（binding 为 `DB`）
- **认证**: HttpOnly + SameSite=Lax 会话 cookie（`jazz_session`），服务端校验

## 常用命令

```bash
npm install            # 安装依赖
npm run dev            # 仅前端开发服务器（:3000）；无后端也可用，见下方「本地开发回退」
npm run build          # tsc -b && vite build → dist/
npm run lint           # oxlint
npm run db:apply       # 将 schema.sql 应用到本地 D1
npm run db:migrate     # 执行 migrations/ 下迁移(表重建加入 income)
npm run pages:dev      # wrangler pages dev，全栈本地运行（:3000）
```

无测试框架。**单测/本地全栈**工作流：

```bash
npm run build          # pages:dev 需要先构建 dist/
npm run db:apply       # 先初始化本地 D1 表
npm run pages:dev      # 全栈（含 /api + D1）
```

### 部署（Cloudflare Pages）

```bash
npx wrangler d1 execute jazz-life-tracker --file=./schema.sql   # 远程建表
npx wrangler pages deploy dist
```

环境变量（生产）:`ADMIN_EMAIL`、`ADMIN_PASSWORD`，见 `.env.example`。默认账户 `admin@life.local` / `ChangeMe123!`。`wrangler.toml` 持有 D1 binding 与 `database_id`。

## 架构

### 后端（Pages Functions 文件式路由）

`functions/api/*.ts` 映射到 `/api/*`：

- `api/auth/login.ts` — POST 登录（校验密码，建 session，设 cookie）；**首次用 admin 邮箱登录会自动建用户**。GET 返回当前用户
- `api/auth/logout.ts` — POST 登出，删除 session 并清 cookie
- `api/records.ts` — GET 查询（按 `user_id` 过滤，最多 200 条）、POST 新增（按 type 校验必填字段）、DELETE 删除（按 id + user_id）
- `api/me.ts` — GET 返回当前用户
- `api/_lib/auth.ts` — 共享认证工具：密码 hash（`salt:hash`，SHA-256）、cookie 读写、`getAuthenticatedUser()`

**约定**：每个 `onRequest*` 处理器先调 `getAuthenticatedUser(request, env)`，未授权返回 401。所有查询按 `user_id` 绑定，实现用户隔离。手写 `jsonResponse` 辅助函数，无共享中间件。

### 数据模型（schema.sql）

单表 `records` + `users` + `sessions`：

- `records`：`type` ∈ `('expense','income','weight')`；支出/收入共用 `amount`/`category`，体重用 `weight`；`exercise_type`/`duration`/`calories` 列保留但不再写入
- `sessions`：id + user_id + expires_at（7 天过期），删除即登出
- 类型为 camelCase 的字段（如 `exerciseType`）在 SQL 中用 snake_case（`exercise_type`），靠显式别名或映射转换

### 前端（三 tab 单页 App.tsx）

- `src/App.tsx` — 登录门槛 + 持有 records 状态与 CRUD（保存/删除/刷新），按 `activeTab` 渲染三个受控 tab 组件
- `src/components/tabs/` — `WeightTab`（体重）、`FinanceTab`（财务）、`ExerciseTab`（运动）。体重/财务 tab 用 `useMemo` 前端聚合图表数据（趋势/月度收支/分类分布），服务端不聚合；运动 tab 为静态指导（`src/data/exercises.ts`），无数据记录
- `src/components/ui/*` — Shadcn 风格基础组件（card/button/label/input/badge），基于 `class-variance-authority` + `tailwind-merge`
- `src/types.ts` — `LifeRecord` / `RecordFormData` / `UserProfile`，与 D1 列对应
- 数据流：`fetch('/api/...', { credentials: 'include' })`

### 本地开发回退（重要）

`App.tsx` 中 `isLocalDevFallback()`：当 hostname 是 localhost 且 `/api` 请求失败时，自动回退到 **localStorage 模拟**（键 `jazz-life-tracker-dev-user` / `jazz-life-tracker-dev-records`，含种子示例数据）。因此 `npm run dev`（纯 Vite）无需后端即可跑通 UI；要测真实后端/D1 用 `pages:dev`。

涉及表结构变更的迁移需按 `npm run db:apply` → `npm run db:migrate` 顺序执行。

## 注意

- 修改 schema 后需重新执行 `npm run db:apply`（本地）与远程 `d1 execute`
- UI 文案为中文，新增文案保持中文
- 依赖精简、无路由库、无状态管理库、无测试框架 —— 新增功能保持同一简约风格
