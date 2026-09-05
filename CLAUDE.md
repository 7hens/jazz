# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

「魔法语言岛」v2 — 词库学习岛 — 面向儿童的拼音/汉字/英语学习游戏(自托管单机全栈)。孩子扮演「语言小魔法师」,按 5 大主题分类收集 100 个词的星尘:每词按家长设定的启用模块跑「拼音/汉字/英语」技能步(每步 2 题、每题 2 次作答机会),技能步首过 +30 星尘、整词(启用技能全完成)首通 +20 加成,星尘累计决定称号(语言初学者→…→语言大法师)。MVP 闭环:登录后单档案进度按「每词一行」存服务端。技术栈:

- **前端**: React 19 + TypeScript + Vite(端口 3000)+ Tailwind 4(`@tailwindcss/vite` 插件)+ Shadcn 风格组件 + motion(动效)
- **后端**: Cloudflare Workers(`worker/` 目录,手写路由),通过 `@cloudflare/vite-plugin` 在 Vite dev server 内嵌 workerd 运行
- **数据库**: Cloudflare D1(binding 为 `DB`,本地 `--local` 存 SQLite 于 `.wrangler/state`)
- **认证**: 单一访问令牌(env `ADMIN_TOKEN`,必填)。首次登录输入令牌后存 HttpOnly + SameSite=Lax cookie(`jazz_token`),令牌永不过期,之后每请求由服务端直接比对 env token
- **发音**: 浏览器 `SpeechSynthesis`;朗读文本一律 zh-CN(汉字)或 en-US(英文),无对应语音时静音降级;音效用 Web Audio 合成

**二期 backlog**(一期明确不做,设计已留口):绘画题型(题干大图 `promptEmoji` 现仅 Choice 用)、填空题型、复习/错词重练排程、离线可用。

**真不做**(非目标):语音识别、汉字书写笔顺、多孩子档案、家长看板、商店/徽章/宠物/每日挑战、PWA、多人在线。

## 常用命令

```bash
npm install            # 安装依赖
npm run dev            # 全栈本地运行(:3000):Vite dev server + workerd 内跑 worker + 本地 D1
npm run dev:init       # 新环境一条命令:npm run db:local 后连跑 dev
npm run build          # tsc -b && vite build → 前端在 dist/client(worker 由部署时 wrangler 从源码打包)
npm run lint           # oxlint
npm test               # vitest run src/**/*.test.{ts,tsx}(jsdom):纯逻辑/服务 + Entry 组件 + architecture 边界
npm run db:local       # 本地 D1 应用 migrations/ 全部迁移(d1 migrations apply --local)
npm run deploy         # npm run build && wrangler deploy(生产 = 默认 env)
npm run deploy:preview # npm run build && wrangler deploy --env preview(独立 D1,冒烟用)
```

`npm test` 覆盖:词库数据完整性(words)、出题引擎(engine)、步序/解锁/结算/称号(lesson/progress)、各 feature 服务与组件、`architecture.test.ts`(shared/features/app 3 层边界与注册纪律,违反即红)。

**发布**:执行流水线(步骤/闸门/坑)走 `/release`(项目 skill);版本规范/铁律/事实在本文件「部署与版本发布」节。发布行为改动时,skill(可执行)与本节事实**两处同步**。

### 需求与版本管理(流转视图,详则见 `docs/ideas/2026-09-04-feature-management.md`)

- 想法 → `docs/IDEAS.md`(停车场,先入池不承诺);排期/拒绝 → 本文件「二期 backlog」/「真不做」(超 ~10 条或含拆解时拆出 `docs/BACKLOG.md`)。
- 立项详设(需求详档唯一位置)→ `docs/superpowers/specs/`;当前迭代执行 → `docs/superpowers/plans/` + `.superpowers/sdd/`(一次一个,完成即走 `/release`)。
- 提案/规范文档 → `docs/ideas/<YYYY-MM-DD>-<topic>.md`(日期前缀,命名与 specs 同构)。
- 历史 → 根 `CHANGELOG.md`(只追加)。发布命令/闸门一律指向 `/release`,本文件零重复。

### 部署与版本发布(Cloudflare Workers + Assets)

**流水线执行走 `/release`(项目 skill,含闸门/回滚分支/坑)。本文件只留事实与铁律,不重复步骤。**

- **环境映射**:生产 = 顶层默认 env(worker `jazz-life-tracker`,现域名/rollback 语义);预览 = `[env.preview]`(独立 D1 `jazz-life-tracker-preview`)。**禁止新增 `[env.production]`**(wrangler env 派生独立 worker → 脱域名/数据)。
- **命令**:`npm run deploy`(生产)/ `npm run deploy:preview`(预览)/ `npm run db:local`(本地迁移)。wrangler 一律显式 `--config wrangler.toml`,否则构建产物 `dist/jazz_life_tracker/wrangler.json` 劫持配置 → env 失效、DB 落生产库(详「生产运行模型」红线)。
- **版本语义**:bug=patch / 新能力=minor / 破坏性=1.0.0 起 major(`0.1.0` 起步)。判破坏性:删/重命名字段·表·API 路由、改字段类型不可自动转换 = major;新增表、新字段(带 `DEFAULT` 或可 `NULL`)、新增 API 路由 = 向下兼容 → minor。tag 仅在「部署成功 + 浏览器冒烟通过」后打:`npm version <level> -m "chore(release): v%s"` → `git push origin main --tags`。部署/冒烟失败**绝不 `npm version`**(孤儿 tag)。
- **回滚**:代码/前端错 → `wrangler rollback --config wrangler.toml`(<10s,前后端同切);env/绑定错 → 随 config 或 `--var` deploy 固化,禁 Dashboard 手改(rollback 不恢复变量);D1 数据坏 → 绝不回滚迁移文件,hotfix 改代码或 SQL 修复。分支细节走 `/release`。
- **认证令牌**:prod `ADMIN_TOKEN` 已是 secret,**勿覆盖**(同名覆盖 = 已存 cookie 全失效);preview 需独立 secret(`wrangler secret put ADMIN_TOKEN --config wrangler.toml --env preview`,随机值);本地 dev 读 `.dev.vars`(gitignore,默认 `jazz-local-dev-token`,未配则登录 401)。`wrangler.toml` 持 worker 入口、D1 binding、assets、database_id 与 preview env。

### 数据库迁移流程(规范模型)

- 真源 = `migrations/` 数字前缀迁移,统一经 `wrangler d1 migrations apply` 执行并记录 `d1_migrations`(apply 幂等,已记录文件不重跑)。`schema.sql` 已下线。
- `0001_init.sql` = **基线快照**(users + progress + user_settings 全量 `CREATE IF NOT EXISTS`,无 DROP):新环境一条命令建齐,旧库幂等对齐。此后表结构变更一律新增 `0002_xxx.sql` …,**不改 0001**;新字段须带 `DEFAULT`/可 `NULL`,保证万一回滚旧代码不崩。
- **顺序(不可逆,先升库后升代码)**:本地 `npm run db:local`;线上 preview → 生产 apply 仅在发布时做,命令与闸门见 `/release` 步骤 2。
- `migrations/archive/` = 旧 date 前缀迁移历史(game_state 建/拆、生活记录)已下线,不参与 apply,勿再加回。

## 架构

### 后端(Workers + 手写路由,`worker/` 目录)

`worker/index.ts` 是唯一 Worker 入口(`wrangler.toml` 的 `main`),`fetch` 内按 pathname + method 分发到 handler:

- `worker/index.ts` — entry + 路由表(`/api/auth/login` POST/GET、`/api/auth/logout` POST、`/api/me` GET、`/api/progress` GET/PUT/DELETE、`/api/settings` GET/PUT;未匹配的 `/api/*` 一律 JSON 404,其余非 API 请求走 `env.ASSETS.fetch`)
- `worker/auth.ts` — `handleLogin`(POST,constant-time 比对 `env.ADMIN_TOKEN`,通过后设 `jazz_token` cookie,返回唯一用户)、`handleLogout`(清 cookie)、`handleMe`
- `worker/progress.ts` — `handleGetProgress`(GET,读该 user 全部 progress 行)、`handlePutProgress`(PUT,body `{ progress: [...] }` 批量行级 upsert,`ON CONFLICT` 用 `MAX(...)` 只升不降;word_id 越界/单批 > 200 → 400)、`handleDeleteProgress`(DELETE,清空该 user 全部行)
- `worker/settings.ts` — `handleGetSettings`(GET,读该 user 单行;无行返回默认三开)、`handlePutSettings`(PUT,upsert;拒绝三模块全关 → 400「至少保留一个学习模块」)
- `worker/_lib/auth.ts` — 共享认证工具:`getAuthenticatedUser()`、cookie 读写、constant-time 比较 `safeEqual`、唯一用户读取/建行;`worker/_lib/http.ts` — `jsonResponse` 辅助

**约定**:每个 handler 先调 `getAuthenticatedUser(request, env)`,未授权返回 401。所有查询按 `user_id` 绑定,实现用户隔离。worker 只做行级读写(progress 每词一行、settings 每 user 一行),**不解析**词库业务语义;星尘只升不降、加成只在首次由 worker 的 `MAX` 合并保证(幂等)。路由无第三方库(无 itty-router 等),保持简约。

**dev 运行模型**:`@cloudflare/vite-plugin` 读 `wrangler.toml`(main/D1/assets),把 worker 跑在 Vite dev server 内的 workerd 环境。dev 下 `/api/*` 进 worker,其余请求由 Vite 接管(HMR)。D1 本地持久化与 `wrangler d1 --local` 共享 `.wrangler/state`。**没有 localStorage 回退模拟**,前后端始终同一套代码。

**生产运行模型**:`wrangler deploy --config wrangler.toml` 读 `wrangler.toml`——`main: ./worker/index.ts`(wrangler 现场打包源码)+ `assets: ./dist/client`(前端),非 `/api` 请求由 worker 内 `env.ASSETS.fetch` 提供静态资源。⚠️ 两条红线:① 不要用 vite-plugin 生成的 `dist/jazz_life_tracker/` 做部署目录:它对相对 assets 路径解析会回退到该目录自身,把 `.dev.vars` 等 worker 产物当静态资源上传(曾致本地 token 泄露);② 部署/迁移命令**必须显式 `--config wrangler.toml`**,否则 wrangler 会重定向到构建产物 `dist/jazz_life_tracker/wrangler.json`(陈旧、无 `[env.preview]`),导致 env 失效、DB 绑定回落到生产库。

### 数据模型(migrations/0001_init.sql)

表 `users` + `progress` + `user_settings`(`game_state`/`records` 已随关卡制下线):

- `users`:认证不校验密码/邮箱(列保留以免迁移),仅存默认用户单行作外键;登录时按需 `INSERT`(取现有单行,无则建默认)
- `progress`:每 user × 每词一行,`word_id` 1..100。列:`pinyin_completed`/`hanzi_completed`/`english_completed`(0/1)、`stars_earned`(只增不减,由 `MAX` 合并)、`updated_at`。主键 `(user_id, word_id)`,`idx_progress_user` 索引
- `user_settings`:每 user 一行,`enable_pinyin`/`enable_hanzi`/`enable_english`(默认全 1)+ `0002_fun.sql` 增列 `earned_achievements`/`consecutive_days`/`last_active_date`、`updated_at`

前端类型(`src/shared/types.ts`):`WordUnit`(`{ id, emoji, pinyin, hanzi, english, category }`,`id` 1..100)、`WordProgress`(`{ wordId, completed: Record<SkillKey, boolean>, starsEarned, updatedAt }`)、`UserSettings`(`enablePinyin/enableHanzi/enableEnglish` + 趣味字段 `earnedAchievements/consecutiveDays/lastActiveDate`、`updatedAt`)、`Question`(判别联合 `listen-choice` / `choice` / `match`)、`SkillKey` 与 `KingdomKey`(同为 `'pinyin' | 'hanzi' | 'english'`,quiz 组件沿用后者命名)、`CategoryKey`(`shape/food/animal/nature/object`)。服务接口类型在 `src/shared/services/*`,键名/映射在 `keys.ts`/`map.ts`。服务端 GET 返回的 progress/settings 行不含 `updatedAt`(worker 序列化时省略),前端以 `isValidWordProgress` 校验 progress 行。

### 前端(3 层:`shared/features/app`,`src/architecture.test.ts` 守边界)

**事实源**:本重构设计定稿 = `docs/superpowers/specs/2026-09-04-dev-architecture-refactor-design.md`(原始提案 `docs/ideas/2026-09-04-dev-architecture.md` 已被取代)。铁律(测试强制):

- `src/shared/` — 无上层依赖的契约与纯逻辑:`types.ts`、`words.ts`(100 词词库 + `CATEGORY_LABELS`/`WORDS`/`wordById`)、`progress-rules.ts`(`SKILL_ORDER`/`enabledSkills`/`fullComplete`/`firstTargetId`/`titleForStars`,lesson 与主页共用)、`services/*`、`registry.ts`、`useService.ts` + `useServiceSnapshot.ts`、`utils.ts`(`cn`)、`api-error.ts`/`load-state.ts`
- `src/features/<f>/` — 自包含模块,公共面 = 该目录 `index.ts`;feature 间**禁止编译期互引**。业务分区:`auth`(登录门)、`archipelago`(群岛主页 `HomeEntry`/`ArchipelagoView`)、`lesson`(答题/结算/称号:`LessonEntry` + `WordLesson`/`WordDone`/`ComboDisplay`/`quiz/` 三题型 + `lesson.ts`/`progress.ts`/`settlement.ts`/`praise.ts`)、`settings`(学习设置面板)、`question-engine`(运行时出题)、`progress`/`settings-state`/`vocabulary`/`api`/`audio`/`speech`/`combo`/`toast`/`celebrate`/`achievements`/`lucky-bonus`/`lingling`(服务工厂 + 必要组件)
- `src/app/` — composition root:`bootstrap.ts`(**唯一生产 `registry.register` 点**)、`App.tsx`(登录态驱动 + 页面状态路由 + 跨 feature 组装;答题/结算/奖励/持久化规则不落 app)、`useAppState.ts`(phase 状态机)、`useCompletedWords.ts`、`ErrorBoundary.tsx`。`src/main.tsx` = HTML 入口(`bootstrap()` + `ToastProvider` + `<App/>`)
- `src/components/ui/*` — 中性视觉基础件(button/card/input/label/badge/select/chart-tooltip,`cva` + `tailwind-merge`),非业务逻辑,features 可引;不参与 feature 边界

**取用纪律**:`useService()` 仅允许在 page feature 的 `<Name>Entry.tsx` 与 `app/` 组装 hooks 内调用;服务实例经 `registry` 注册后由 `useService(key)` 取、`useServiceSnapshot(service)` 订阅(`getSnapshot` 须返稳定引用)。跨 feature 的纯规则/词库放 shared,跨 feature 的组件在 app 组装传 props。数据流:`fetch('/api/...', { credentials: 'include' })`,封装在各 feature service。

### 题型与发音约定(引擎生成,`src/features/question-engine/engine.ts` + `src/features/lesson/quiz/speech.ts`)

- 每技能步 2 题:**首题恒 `choice`**(题干大图 = 该词 emoji,由 UI 层 `promptEmoji` 传入,选项不放图);次题按技能概率生成变体——拼音 50% `listen-choice`/50% `choice`,汉字 50% `match`/50% `choice`,英语 33/33/33 `listen-choice`/`match`/`choice`。题/选项 id 按 `{wordId}-{步序号}-{题型标记}-{技能}-{i}` 生成,一步内全局唯一。
- 干扰项 `distractorsFor`:同 category 优先,不足跨类兜底,并排除与目标词任何一门文本(拼音/汉字/英文)重复的词;选项数 `optionCountFor` = 词 id ≤ 20 给 3 项、> 20 给 4 项(即 2/3 干扰项)。`match` 左卡文字、右卡 emoji,配对经词引用对齐。
- **朗读真相 = 卡面对应词的汉字或英文**:`speakOf(word, skill)` 返回英文词(english)或汉字(其余技能)——拼音选项卡面显示拼音文本但**朗读其对应汉字**(zh-CN 直读汉字稳定),汉字题卡面与朗读均为汉字,英语题朗读英文词(en-US)。speech.ts 按此定语言:english → en-US,其余 → zh-CN。选项可点读;`listen-choice` 进题自动朗读 `promptSpeak`;`match` 不自动朗读(卡面带 speak 时渲染点读喇叭可点读)。

## 注意

- **改词库 / 加词**:只改 `src/shared/words.ts`(加词遵循分类 id 段、`category` 归属、无重复文本)。发音文本由引擎按上节约定自动推导,**无需**在词条上存 `speak` 字段。
- **改奖励 / 解锁 / 称号 / 出题**:先看对应纯逻辑与其测试再动 UI —— 跨 feature 规则在 `src/shared/progress-rules.ts`、词库在 `src/shared/words.ts`,出题引擎在 `src/features/question-engine/`,结算/称号消费在 `src/features/lesson/`(引擎可注入 `rng` 保证测试确定性)。改完跑 `npm test`(architecture 边界测试须绿)。
- **主题 token**:天空糖果色系定义在 `src/index.css`,通用强调色 `accent`(橙)、完成/加成 `emerald`、错误 `red`、中性 `ink/surface/hairline`;拼音/汉字/英语王国色 token(`pinyin`/`hanzi`/`english`)仍在但当前 UI 未逐王国着色,改色/动效先看该文件。
- 表结构变更 = 新增数字前缀迁移文件(见上「数据库迁移流程」),不改 0001 基线;本地 `npm run db:local` 验;线上 apply 走 `/release` 步骤 2
- UI 文案为中文,新增文案保持中文
- 依赖精简、无路由库、无状态管理库 —— 新增功能保持同一简约风格
- 生命周期:关卡制旧代码(worker/game.ts、`LevelPlay`/`LevelResult`/`MapView`、`src/game/*`、`src/components/game|login/`、`src/data/`)已删除/已迁 feature;quiz 三组件与 `quiz/speech.ts` 的类型签名残留关卡制 `kingdom: KingdomKey | 'mixed'` 与 `mixed` 分支注释,WordLesson 实际只传三技能,`mixed` 分支不会走到;`src/components/ui/` 中 button/card/input/label 已被 feature 复用,badge/select/chart-tooltip 暂无引用,保留待儿童主题复用
