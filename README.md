# 魔法语言岛 v2 · 词库学习岛

面向儿童的拼音 / 汉字 / 英语学习游戏(自托管单机全栈)。孩子扮演「语言小魔法师」,在分类词库地图上按顺序解锁并学习 100 个实词:每词至多 3 个技能步(拼音 / 汉字 / 英语,可由家长开关裁剪),每步 2 题、每题 2 次作答机会;答对积星尘,星尘累计决定称号。MVP 闭环:单一访问令牌登录 → 单档案 → 每词一行进度存服务端 → 刷新不丢。

> **当前状态**:`v0.1.0`(词库学习岛一期)已发布(2026-09-04,见 [CHANGELOG.md](CHANGELOG.md));当前 main 已并入趣味系统(fun)+ 前端架构重构(3 层 feature-slice),全量单测 / lint / build 通过,待浏览器验收与部署(发布前置见 [docs/PLAN.md](docs/PLAN.md) `P0`)。
> **玩法设计(权威)**:[docs/superpowers/specs/2026-09-03-word-island-v2-design.md](docs/superpowers/specs/2026-09-03-word-island-v2-design.md)
> **趣味系统设计**:[docs/superpowers/specs/2026-09-04-fun-system-design.md](docs/superpowers/specs/2026-09-04-fun-system-design.md)
> **前端架构重构(权威,取代 `docs/ideas/2026-09-04-dev-architecture.md`)**:[docs/superpowers/specs/2026-09-04-dev-architecture-refactor-design.md](docs/superpowers/specs/2026-09-04-dev-architecture-refactor-design.md)
> **工程细节(命令 / 架构 / 数据模型 / 约定)**:[CLAUDE.md](CLAUDE.md)

## 已实现功能

- **100 词词库** —— [src/shared/words.ts](src/shared/words.ts):id 1..100 即解锁顺序,5 分类各 20 词(基础形状 / 食物 / 动物 / 自然界 / 交通与物品),`wordById` / `CATEGORY_LABELS` 供查词与分区标题;数据完整性由单测拦截(数量 / id 连续 / 文本唯一 / 分类基数 / 拼音笔误)。
- **运行时出题引擎** —— [src/features/question-engine/engine.ts](src/features/question-engine/engine.ts):每技能步 2 题串行,题型按技能随机组合 —— 拼音 choice / listen-choice、汉字 choice / match、英语 choice / listen-choice / match(填空题型未做,见 [PLAN 想法池](docs/PLAN.md))。干扰项同分类优先、不足跨类兜底、排除与目标词任一文本重复者;选项数按词 id(≤20 给 3 项,其余 4 项);选项 / 题干带全局唯一 id,供 React 复用 key。引擎可注入 `rng` 保证测试确定性。
- **步序 / 解锁 / 奖励 / 称号(纯逻辑)** —— 跨 feature 规则在 [src/shared/progress-rules.ts](src/shared/progress-rules.ts)(`SKILL_ORDER` / `enabledSkills` / `fullComplete` / `firstTargetId` / `titleForStars`),步序裁剪与结算在 [src/features/lesson/](src/features/lesson/):技能顺序 拼音→汉字→英语,`stepsFor` 全关时强制英语;词「全完成」= 启用技能全完成;技能步首过 +30、整词首通加成 +20、重学不重复发放(只升不降);称号 8 档阈值(0/300/1000/2500/5000/8000/12000)。
- **DB 行级进度** —— [migrations/0001_init.sql](migrations/0001_init.sql) 基线快照(`users` 单档案外键 + `progress` 每 user × 每词一行 + `user_settings` 三模块开关),[migrations/0002_fun.sql](migrations/0002_fun.sql) 增列趣味字段(`earned_achievements` / `consecutive_days` / `last_active_date`);后续结构变更一律新增数字前缀迁移,不改基线。
- **后端 worker 路由** —— [worker/index.ts](worker/index.ts):`POST/GET /api/auth/login`、`GET /api/me`、`POST /api/auth/logout`;`GET/PUT/DELETE /api/progress`(批量行级 upsert,`ON CONFLICT` 取 MAX 只升不降,word_id 1..100 + 单批 ≤200 校验)、`GET/PUT /api/settings`(upsert,防三模块全关 → 400)。
- **前端 3 层架构**(shared / features / app,无路由库):主页 [src/features/archipelago/HomeEntry.tsx](src/features/archipelago/HomeEntry.tsx)(地图 = 5 分类词格 + 目标词脉冲高亮 + 星尘/称号 + 家长菜单)、答题器 [src/features/lesson/LessonEntry.tsx](src/features/lesson/LessonEntry.tsx)(2 次作答机会 + 反馈 + 亮答案;步内任一题两次均错 → 该步重做;`match` 一次性通过;整词结算卡 + 首通祝贺 + 下一词)、学习设置 [src/features/settings/](src/features/settings/)(三开关即时 PUT,气密防全关)、登录门 [src/features/auth/](src/features/auth/);跨 feature 组装在 [src/app/](src/app/)。边界纪律由 [src/architecture.test.ts](src/architecture.test.ts) 强制(feature 间禁编译期互引、`useService` 仅页面入口与 app、服务注册唯一入口 `app/bootstrap.ts`)。
- **题型三组件 + 发音** —— [src/features/lesson/quiz/](src/features/lesson/quiz/) 下 `Choice` / `ListenChoice` / `MatchGame`:choice 题干大图 `promptEmoji`(视觉来源 = 词 emoji);listen-choice 进题自动朗读;拼音选项卡面显示拼音文本、朗读其对应**汉字**(zh-CN 直读稳定),英语读英文词(en-US);无对应语音静音降级;音效用 Web Audio 合成。
- **趣味系统** —— 连击加分与显示、整词庆祝彩带、成就弹出、幸运加成(10% 概率 +50)、灵灵陪伴(按完成词数换阶段),各有 feature(`combo` / `celebrate` / `achievements` / `lucky-bonus` / `lingling`)与 `user_settings` 趣味字段。

### 前端架构备忘

`src/shared/`(契约 + 纯逻辑,无上层依赖)→ `src/features/<f>/`(自包含模块,公共面 = `index.ts`)→ `src/app/`(composition root:页面状态路由 + 跨 feature 组装)。中性视觉件 `src/components/ui/*` 供 features 复用。详见架构 spec 与 [CLAUDE.md](CLAUDE.md)。

### 质量状态

- 全量 `npm test`(vitest,jsdom)31 个测试文件 / 163 用例全绿,覆盖词库完整性、出题引擎、步序/解锁/结算/称号、各 feature 服务与组件、`architecture.test.ts` 3 层边界;`tsc -b`、`npm run lint`(oxlint)通过。
- 关卡制旧代码与单层组件(levels / MapView / WordMapView / WordLesson / WordDone / SettingsPanel 旧址 / `src/game/*` / `src/components/*` 旧布局)已删除或迁入 feature 目录,无残留引用。

## 待办与需求池

> 需求/任务/优先级/拒绝记录唯一入口:[`docs/PLAN.md`](docs/PLAN.md)(章节:当前迭代 `P0` / 想法池 `P1`·`P2` / 坚决不做)。流转 / 准入 / 估算 / 复盘 / 分支准则见 [`CLAUDE.md` 需求与版本管理](CLAUDE.md)。
> 原各版 README「留待收尾」「二期 backlog」「明确不做」列表已并 PLAN,本 README 不再重复列(重构迁入后发现的新 follow-up 亦入 PLAN `P1`/`P2`)。

## 快速上手

```bash
npm install            # 装依赖
npm run dev:init       # 新环境一条命令:本地 D1 迁移后连跑 dev(:3000)
npm run dev            # 全栈本地 :3000(Vite + workerd + 本地 D1)
npm test               # vitest 全量(jsdom;含 architecture 边界)
npm run lint           # oxlint
npm run build          # tsc -b && vite build → 前端 dist/client
npm run db:local       # 本地 D1 应用全部迁移(migrations apply --local)
npm run deploy         # build + wrangler deploy(生产 = 默认 env)
npm run deploy:preview # build + wrangler deploy --env preview(独立 D1 冒烟)
```

登录令牌:本地读 `.dev.vars`(`ADMIN_TOKEN`,默认 `jazz-local-dev-token`);生产用 `wrangler secret put ADMIN_TOKEN`(预览 env 需 `--env preview` 另设),**禁止** Cloudflare Dashboard 手改变量。部署 / 迁移 / 发布流水线 / 架构细节见 [CLAUDE.md](CLAUDE.md)。

## 技术栈

React 19 + TypeScript + Vite(:3000)+ Tailwind 4 + motion · Cloudflare Workers(手写路由,`worker/`)+ D1(行级表) · 单一访问令牌 HttpOnly cookie 认证 · 浏览器 SpeechSynthesis 发音 + Web Audio 音效。依赖精简:无路由库、无状态管理库;vitest(jsdom)覆盖纯逻辑 + 组件 + 架构边界。
