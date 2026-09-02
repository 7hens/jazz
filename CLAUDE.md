# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

「魔法语言岛」— 面向儿童的拼音/汉字/英语闯关游戏(自托管单机全栈)。孩子扮演「语言小魔法师」,线性闯过新手村 10 关,以星级/星尘/exp/魔法师等级获得正反馈。MVP 闭环:登录后单档案进度存服务端。技术栈:

- **前端**: React 19 + TypeScript + Vite(端口 3000)+ Tailwind 4(`@tailwindcss/vite` 插件)+ Shadcn 风格组件 + motion(动效)
- **后端**: Cloudflare Workers(`worker/` 目录,手写路由),通过 `@cloudflare/vite-plugin` 在 Vite dev server 内嵌 workerd 运行
- **数据库**: Cloudflare D1(binding 为 `DB`,本地 `--local` 存 SQLite 于 `.wrangler/state`)
- **认证**: 单一访问令牌(env `ADMIN_TOKEN`,必填)。首次登录输入令牌后存 HttpOnly + SameSite=Lax cookie(`jazz_token`),令牌永不过期,之后每请求由服务端直接比对 env token
- **发音**: 浏览器 `SpeechSynthesis`(zh-CN / en-US),无中文语音时静音降级;音效用 Web Audio 合成

**明确不做**(MVP 范围外):商店/徽章/宠物/每日挑战、语音识别、汉字书写笔顺、BOSS 关、30/70 关扩展、多孩子档案、家长看板、PWA。

## 常用命令

```bash
npm install            # 安装依赖
npm run dev            # 全栈本地运行(:3000):Vite dev server + workerd 内跑 worker + 本地 D1
npm run build          # tsc -b && vite build → dist/client(前端)+ dist/jazz_life_tracker(worker 产物)
npm run lint           # oxlint
npm test               # vitest run src/game/*.test.ts 纯逻辑单测
npm run db:apply       # 将 schema.sql 应用到本地 D1(建表幂等来源)
npm run db:migrate     # 循环执行 migrations/*.sql 下迁移(本地)
npm run deploy         # npm run build && wrangler deploy dist/jazz_life_tracker
```

无浏览器端测试框架;`npm test` 覆盖计分/进度纯函数与题库数据完整性(vitest,node 环境)。

### 部署(Cloudflare Workers + Assets)

```bash
npx wrangler d1 execute jazz-life-tracker --remote --file=./schema.sql   # 远程建表
npm run deploy         # build + wrangler deploy dist/jazz_life_tracker
```

环境变量(生产):`ADMIN_TOKEN`(访问令牌,必填),在 Cloudflare **Workers** 控制台(`jazz-life-tracker` worker 的 Settings → Variables)设置,不再用 Pages 控制台。**本地** dev 从 `.dev.vars` 读取(已 gitignore,本地默认 `jazz-local-dev-token`);未配置时登录返回 401「未配置访问令牌」。更换令牌会使所有已存 cookie 失效。`wrangler.toml` 持有 worker 入口、D1 binding、assets 配置与 `database_id`。

### 数据库迁移流程(幂等)

- `schema.sql` 是**建表幂等来源**(全部 `CREATE TABLE IF NOT EXISTS`,**无 DROP**):新环境先 `npm run db:apply` 建出 `users` + `game_state` 两表。
- `migrations/*.sql` 是**变更历史**(可含 DROP,但必须可重复执行):`npm run db:migrate` 用 `for` 循环逐文件执行。当前唯一迁移 `2026-09-02-game-state.sql`(`DROP TABLE IF EXISTS records` + `CREATE TABLE IF NOT EXISTS game_state`)本身幂等,重跑 `db:migrate` 安全。
- 涉及表结构变更:按 `npm run db:apply` → `npm run db:migrate` 顺序执行;远程用 `d1 execute --remote --file=`.
- 旧的生活记录迁移(`2026-08-25-finance-types.sql`、`2026-09-01-token-auth.sql`)已随 `records` 表下线删除,勿再加回。

## 架构

### 后端(Workers + 手写路由,`worker/` 目录)

`worker/index.ts` 是唯一 Worker 入口(`wrangler.toml` 的 `main`),`fetch` 内按 pathname + method 分发到 handler:

- `worker/index.ts` — entry + 路由表(`/api/auth/login`、`/api/auth/logout`、`/api/me`、`/api/game`,其余路径走 `env.ASSETS.fetch`)
- `worker/auth.ts` — `handleLogin`(POST,constant-time 比对 `env.ADMIN_TOKEN`,通过后设 `jazz_token` cookie,upsert 默认用户行)、`handleLogout`(清 cookie)、`handleMe`
- `worker/game.ts` — `handleGetGame`(GET,读该 user 的 `game_state` 单行并 JSON.parse;无行返回 `{ state: null }`)、`handlePutGame`(PUT,body `{ state }` 整份覆盖 upsert;body 非对象或序列化后 > 64KB → 400)
- `worker/_lib/auth.ts` — 共享认证工具:`getAuthenticatedUser()`、cookie 读写、constant-time 比较 `safeEqual`、默认用户 upsert;`worker/_lib/http.ts` — `jsonResponse` 辅助

**约定**:每个 handler 先调 `getAuthenticatedUser(request, env)`,未授权返回 401。所有查询按 `user_id` 绑定,实现用户隔离。worker 只存取 `game_state` 整行 JSON,不解析内容(校验仅限 body 大小上限)。路由无第三方库(无 itty-router 等),保持简约。

**dev 运行模型**:`@cloudflare/vite-plugin` 读 `wrangler.toml`(main/D1/assets),把 worker 跑在 Vite dev server 内的 workerd 环境。dev 下 `/api/*` 进 worker,其余请求由 Vite 接管(HMR)。D1 本地持久化与 `wrangler d1 --local` 共享 `.wrangler/state`。**没有 localStorage 回退模拟**,前后端始终同一套代码。

**生产运行模型**:`vite build` 输出前端到 `dist/client/`、worker bundle 到 `dist/jazz_life_tracker/`(含生成的 `wrangler.json`,`assets` 指向 `../client`)。`wrangler deploy dist/jazz_life_tracker` 部署 worker + Assets,非 `/api` 请求由 worker 内 `env.ASSETS.fetch` 提供静态资源。

### 数据模型(schema.sql)

表 `users` + `game_state`(`records`/`sessions` 已随生活记录与 token 认证下线):

- `users`:认证不校验密码/邮箱(列保留以免迁移),仅存默认用户单行作 `game_state` 外键;登录时 `INSERT OR IGNORE` 保证存在
- `game_state`:每 user 一行,`state` 为整份 GameState JSON(`user_id TEXT PRIMARY KEY`)

GameState(前端 `src/types.ts`):`stars` 星尘(只按首通/最优星级发放一次)、`exp` 经验(每 300 升 1 级,等级不落库实时推导)、`unlocked` 已解锁最大关卡号(1..11)、`levels` 每关历史最优 `{stars, bestScore}`、`kingdom` 各王国累计已得星、`updatedAt`。

### 前端(状态机单页 App.tsx)

- `src/App.tsx` — 重写:屏状态机 `boot → login → map → play → result`(无路由库)。认证判断 + 拉取/保存进度(`GET/PUT /api/game`),登录成功、结算落库只在**通关(≥1★)时整份 PUT 上报**;play/result 切换由 props 回调驱动
- `src/components/login/` — 儿童版登录门 `LoginGate`(替代旧 `components/auth/LoginCard`)
- `src/components/game/` — `MapView`(新手村 10 节点 + 状态条 + 家长入口/重置)、`LevelPlay`(答题/反馈/亮答案三阶段)、`LevelResult`(星级/星尘/exp 结算);`quiz/` 下 `Choice`/`ListenChoice`/`MatchGame` 三种题型组件 + `speech.ts`(发音语言推导)
- `src/data/levels.ts` — 10 关定义与全部题目(静态 TS);关卡素材与发音约定见文件头注释
- `src/game/*` — **纯逻辑**(可单测,无 React):`scoring.ts`(`scoreAttempt`/`starsForRate`/`runLevel`)、`state.ts`(`emptyGameState`/`levelOfExp`/`applyResult` 合并最优与奖励发放)、`tts.ts`(SpeechSynthesis 封装,静音降级)、`sfx.ts`(Web Audio 合成短音)、`audio.ts`(声音总开关 localStorage)
- `src/components/ui/*` — Shadcn 风格基础组件(card/button/label/input/badge 等),基于 `class-variance-authority` + `tailwind-merge`
- `src/types.ts` — `GameState` / `Level` / `Question`(判别联合:listen-choice / choice / match) / `KingdomKey` / `UserProfile`,与 D1 列对应
- 数据流:`fetch('/api/...', { credentials: 'include' })`
- `src/game/*.test.ts` — vitest 单测(计分口径、进度合并、题库数据完整性)

## 注意

- **修改题库 / 关卡**:只改 `src/data/levels.ts`(含新增 `speak` 字段)。发音约定——拼音卡卡面显示拼音,`speak` 用**同音汉字**让 zh-CN 朗读;汉字卡直读汉字;英语卡 en-US 朗读词/字母。所有题/选项 id 全局唯一,前缀 `{关}-{关内题号}-{内容}`。
- **主题 token**:天空糖果色系定义在 `src/index.css`,拼音/汉字/英语王国各有专属强调色(`pinyin`/`hanzi`/`english`),改色/动效先看该文件。
- 修改 schema 后需重新执行 `npm run db:apply`(本地)与远程 `d1 execute`
- UI 文案为中文,新增文案保持中文
- 依赖精简、无路由库、无状态管理库 —— 新增功能保持同一简约风格
- 生命周期:`records` 相关旧代码(worker/records.ts、前端 tabs/dashboard、`src/data/exercises.ts`、`src/lib/date.ts`、`src/assets/hero.png`)已删除;遗留 ui 基础组件(badge/select/chart-tooltip 等)可能暂无引用,保留待儿童主题复用
