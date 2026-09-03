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
npm run build          # tsc -b && vite build → 前端在 dist/client(worker 由部署时 wrangler 从源码打包)
npm run lint           # oxlint
npm test               # vitest run src/**/*.test.ts(words/engine/lesson/progress 纯逻辑单测,node 环境)
npm run db:local       # 本地 D1 应用 migrations/ 全部迁移(d1 migrations apply --local)
npm run deploy         # npm run build && wrangler deploy(生产 = 默认 env)
npm run deploy:preview # npm run build && wrangler deploy --env preview(独立 D1,冒烟用)
```

无浏览器端测试框架;`npm test` 覆盖词库数据完整性(words)、出题引擎(engine)、步序/完成判定/解锁(lesson)、结算/称号/合并(progress)。

### 部署与版本发布(Cloudflare Workers + Assets)

**环境映射**:生产 = **顶层默认 env**(worker 名 `jazz-life-tracker`,保持现自定义域名与 rollback 语义);预览 = `[env.preview]`(独立 D1 `jazz-life-tracker-preview`)。⚠️ wrangler 的 env 会派生独立 worker,故**禁止新增 `[env.production]`** —— 那会另起名 `jazz-life-tracker-production` 的 worker,脱离现域名与数据。

```bash
npm run deploy:preview # ① 预览冒烟:build + wrangler deploy --config wrangler.toml --env preview → 分配 *.workers.dev
npm run deploy         # ② 生产:build + wrangler deploy --config wrangler.toml(默认 env,读 wrangler.toml main 源码 + assets dist/client)
```

> ⚠️ 所有 wrangler 命令一律显式 `--config wrangler.toml`:否则 vite-plugin 构建产物 `dist/jazz_life_tracker/wrangler.json`(旧配置,`definedEnvironments` 为空)会劫持配置解析 → env.preview 被无视、DB 绑定回落到生产库。此即 CLAUDE.md「勿用 dist/jazz_life_tracker 做部署」的另一面。

**发布流水线(严格顺序)**:

1. 有表结构变更先升库:preview 先 `npx wrangler d1 migrations apply --config wrangler.toml jazz-life-tracker-preview --env preview --remote` 验无错,再生产 `npx wrangler d1 migrations apply --config wrangler.toml jazz-life-tracker --remote`。
2. 手写 `CHANGELOG.md`(新增/修复/变更各 ≤ 一行),提交。
3. `npm run deploy` → 浏览器打开生产域名冒烟(登录 → 读写进度)确认无错。
4. `npm version minor -m "chore(release): v%s"`(**0.1.0 起步**;bug=patch / 新能力=minor / 破坏性变更=1.0.0 起 major)。**部署或冒烟失败严禁 `npm version`**(防孤儿 tag)。
5. `git push origin main --tags`(备份)。

- **回滚 SOP**:代码/前端出错 → `wrangler rollback` 选上一正常部署(<10s,前后端同切)。**环境变量/绑定变更必须随 config 或 `--var` 一起 deploy 固化**,禁止 deploy 后登 Dashboard 手改(rollback 不恢复变量 → 旧代码读新变量白屏)。D1 数据坏 → **绝不回滚迁移文件**,hotfix 改代码适配或 SQL 修复。
- **认证令牌**:生产 `wrangler secret put ADMIN_TOKEN`(默认 env);预览环境独立 secret `wrangler secret put ADMIN_TOKEN --env preview`(可同串)。**本地** dev 从 `.dev.vars` 读(已 gitignore,默认 `jazz-local-dev-token`);未配置时登录 401「未配置访问令牌」。更换令牌使已存 cookie 失效。`wrangler.toml` 持 worker 入口、D1 binding、assets、database_id 与 preview env。

### 数据库迁移流程(规范模型)

- 真源 = `migrations/` 数字前缀迁移,统一经 `wrangler d1 migrations apply` 执行并记录 `d1_migrations`(apply 幂等,已记录文件不重跑)。`schema.sql` 已下线。
- `0001_init.sql` = **基线快照**(users + progress + user_settings 全量 `CREATE IF NOT EXISTS`,无 DROP):新环境一条命令建齐,旧库幂等对齐。此后表结构变更一律新增 `0002_xxx.sql` …,**不改 0001**;新字段须带 `DEFAULT`/可 `NULL`,保证万一回滚旧代码不崩。
- **顺序(不可逆,先升库后升代码)**:本地 `npm run db:local`;线上 preview → 生产(命令见上节)。
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
- `user_settings`:每 user 一行,`enable_pinyin`/`enable_hanzi`/`enable_english`(默认全 1)、`updated_at`

前端类型(`src/types.ts`):`WordUnit`(`{ id, emoji, pinyin, hanzi, english, category }`,`id` 1..100)、`WordProgress`(`{ wordId, completed: Record<SkillKey, boolean>, starsEarned, updatedAt }`)、`UserSettings`(`{ enablePinyin/enableHanzi/enableEnglish, updatedAt }`)、`Question`(判别联合 `listen-choice` / `choice` / `match`)、`SkillKey` 与 `KingdomKey`(同为 `'pinyin' | 'hanzi' | 'english'`,quiz 组件沿用后者命名)、`CategoryKey`(`shape/food/animal/nature/object`)。服务端 GET 返回的 progress/settings 行不含 `updatedAt`(worker 序列化时省略),前端以 `isValidWordProgress` 校验 progress 行。

### 前端(状态机单页 App.tsx)

- `src/App.tsx` — 屏状态机 `boot → login → map → lesson → done`(无路由库)。`boot` 先 `GET /api/me` 判登录态;登录成功后并行拉 `progress` + `settings`。进词 `startWord`;每技能步过 `handleStepPass` 立即结算该词单行并即时 `PUT /api/progress`(一行);全部技能完成进 `WordDone`;家长操作:退出、重置进度(`DELETE /api/progress`)、学习设置(`PUT /api/settings`)
- `src/components/login/` — 儿童版登录门 `LoginGate`
- `src/components/game/` — `WordMapView`(地图即主页:5 分类词格 + 目标词脉冲高亮 + 状态条 + 家长菜单)、`WordLesson`(技能步答题器:answering/feedback/reveal 三阶段,一步 2 题、错 1 次给第 2 次机会,再错重做整步)、`WordDone`(整词结算卡:技能步星尘块 + 整词加成块 + 动态祝贺标题 + 称号/星尘)、`SettingsPanel`(拼音/汉字/英语三模块开关,防全关);`quiz/` 下 `Choice`/`ListenChoice`/`MatchGame` 三种题型组件 + `speech.ts`(发音语言推导)
- `src/data/words.ts` — 100 词静态词库,5 分类各 20 词:`shape` 基础形状 1-20、`food` 食物 21-40、`animal` 动物 41-60、`nature` 自然界 61-80、`object` 交通与物品 81-100;`wordById` 查词,`CATEGORY_LABELS` 分类名
- `src/game/*` — **纯逻辑**(可单测,无 React):`engine.ts`(运行时出题:`textOf`/`speakOf`/`distractorsFor`/`makeChoice`/`makeListen`/`makeMatch`/`makeStepQuestions`)、`lesson.ts`(`SKILL_ORDER`/`enabledSkills`/`stepsFor`/`fullComplete`/`firstTargetId` 顺序解锁判定)、`progress.ts`(`emptyProgress`/`mergeProgress`/`settleWord` 每技能步首过 +30、整词首通 +20/`titleForStars` 称号档位)、`tts.ts`(SpeechSynthesis 封装,静音降级)、`sfx.ts`(Web Audio 合成短音)、`audio.ts`(声音总开关 localStorage)
- `src/components/ui/*` — Shadcn 风格基础组件(button 等),基于 `class-variance-authority` + `tailwind-merge`
- `src/types.ts` — 见上「数据模型」;`WordUnit` 等与 D1 行级列对应
- 数据流:`fetch('/api/...', { credentials: 'include' })`
- `src/game/*.test.ts` — vitest 单测(`words.test` 词库数据完整性、`engine.test` 出题、`lesson.test` 步序、`progress.test` 结算/合并/称号)

### 题型与发音约定(引擎生成,`src/game/engine.ts` + `quiz/speech.ts`)

- 每技能步 2 题:**首题恒 `choice`**(题干大图 = 该词 emoji,由 UI 层 `promptEmoji` 传入,选项不放图);次题按技能概率生成变体——拼音 50% `listen-choice`/50% `choice`,汉字 50% `match`/50% `choice`,英语 33/33/33 `listen-choice`/`match`/`choice`。题/选项 id 按 `{wordId}-{步序号}-{题型标记}-{技能}-{i}` 生成,一步内全局唯一。
- 干扰项 `distractorsFor`:同 category 优先,不足跨类兜底,并排除与目标词任何一门文本(拼音/汉字/英文)重复的词;选项数 `optionCountFor` = 词 id ≤ 20 给 3 项、> 20 给 4 项(即 2/3 干扰项)。`match` 左卡文字、右卡 emoji,配对经词引用对齐。
- **朗读真相 = 卡面对应词的汉字或英文**:`speakOf(word, skill)` 返回英文词(english)或汉字(其余技能)——拼音选项卡面显示拼音文本但**朗读其对应汉字**(zh-CN 直读汉字稳定),汉字题卡面与朗读均为汉字,英语题朗读英文词(en-US)。speech.ts 按此定语言:english → en-US,其余 → zh-CN。选项可点读;`listen-choice` 进题自动朗读 `promptSpeak`;`match` 不自动朗读(卡面带 speak 时渲染点读喇叭可点读)。

## 注意

- **改词库 / 加词**:只改 `src/data/words.ts`(加词遵循分类 id 段、`category` 归属、无重复文本)。发音文本由引擎按上节约定自动推导,**无需**在词条上存 `speak` 字段。
- **改奖励 / 解锁 / 称号 / 出题**:先看 `src/game/*` 纯逻辑与其测试(引擎可注入 `rng` 保证测试确定性),再动 UI。
- **主题 token**:天空糖果色系定义在 `src/index.css`,通用强调色 `accent`(橙)、完成/加成 `emerald`、错误 `red`、中性 `ink/surface/hairline`;拼音/汉字/英语王国色 token(`pinyin`/`hanzi`/`english`)仍在但当前 UI 未逐王国着色,改色/动效先看该文件。
- 表结构变更 = 新增数字前缀迁移文件(见上「数据库迁移流程」),不改 0001 基线;本地 `npm run db:local` 验,线上 preview → 生产 apply
- UI 文案为中文,新增文案保持中文
- 依赖精简、无路由库、无状态管理库 —— 新增功能保持同一简约风格
- 生命周期:关卡制旧代码(worker/game.ts、`LevelPlay`/`LevelResult`/`MapView`、`src/game/scoring.ts`/`state.ts`/`levels.ts`、`src/data/levels.ts`)已删除;quiz 三组件与 `speech.ts` 的类型签名残留关卡制 `kingdom: KingdomKey | 'mixed'` 与 speech.ts 的 `mixed` 分支注释,WordLesson 实际只传三技能,`mixed` 分支不会走到;遗留 ui 基础组件(badge/select/chart-tooltip 等)暂无引用,保留待儿童主题复用
