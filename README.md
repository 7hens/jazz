# 魔法语言岛 v2 · 词库学习岛

面向儿童的拼音 / 汉字 / 英语学习游戏(自托管单机全栈)。孩子扮演「语言小魔法师」,在分类词库地图上按顺序解锁并学习 100 个实词:每词至多 3 个技能步(拼音 / 汉字 / 英语,可由家长开关裁剪),每步 2 题、每题 2 次作答机会;答对积星尘,星尘累计决定称号。MVP 闭环:单一访问令牌登录 → 单档案 → 每词一行进度存服务端 → 刷新不丢。

> **当前状态**:`v0.1.0`(词库学习岛一期)已发布(2026-09-04,见 [CHANGELOG.md](CHANGELOG.md));下一版(fun 趣味机制 + 前端架构重构)开发中,当前迭代与优先级见 [docs/PLAN.md](docs/PLAN.md)。
> **设计文档(权威)**:[docs/superpowers/specs/2026-09-03-word-island-v2-design.md](docs/superpowers/specs/2026-09-03-word-island-v2-design.md)
> **实施计划**:[docs/superpowers/plans/2026-09-03-word-island-implementation.md](docs/superpowers/plans/2026-09-03-word-island-implementation.md)
> **工程细节(命令 / 架构 / 数据模型 / 约定)**:[CLAUDE.md](CLAUDE.md)

## 已实现功能(一期)

- **100 词词库** —— [src/data/words.ts](src/data/words.ts),id 1..100 即解锁顺序,5 分类各 20 词(基础形状 / 食物 / 动物 / 自然界 / 交通与物品),`wordById` / `CATEGORY_LABELS` 供查词与分区标题;数据完整性由单测拦截(数量 / id 连续 / 文本唯一 / 分类基数 / 拼音笔误)。
- **运行时出题引擎** —— [src/game/engine.ts](src/game/engine.ts):每技能步 2 题串行,题型按技能随机组合 —— 拼音 choice / listen-choice、汉字 choice / match、英语 choice / listen-choice / match(填空题型未做,见 [PLAN 想法池](docs/PLAN.md))。干扰项同分类优先、不足跨类兜底、排除与目标词任一文本重复者;选项数按词 id(≤20 给 3 项,其余 4 项);选项 / 题干带全局唯一 id,供 React 复用 key。
- **学习单元步序与解锁**(纯逻辑,[src/game/lesson.ts](src/game/lesson.ts)):技能顺序 拼音→汉字→英语,`stepsFor` 按家长设置裁剪、全关时强制英语;词「全完成」= 启用技能全完成;解锁 = 自 1 起首个未完成词,全通则停在词 100 后。
- **奖励结算与称号**(纯逻辑,[src/game/progress.ts](src/game/progress.ts)):技能步首过 +30、整词首通加成 +20、重学不重复发放(只升不降);称号 8 档阈值(0/300/1000/2500/5000/8000/12000);前端内存态字段级合并(`completed` 取 OR、`stars_earned` 取 MAX)。
- **DB 行级进度** —— [migrations/0001_init.sql](migrations/0001_init.sql) 基线快照:`users`(单档案外键)+ `progress`(每 user × 每词一行,三技能完成位 + `stars_earned`)+ `user_settings`(三模块开关),全量 `IF NOT EXISTS` 幂等;旧 date 前缀迁移(含 `game_state` 建/拆)已移入 [migrations/archive/](migrations/archive/),后续结构变更一律新增数字前缀迁移。
- **后端 worker 路由** —— [worker/index.ts](worker/index.ts):`POST/GET /api/auth/login`、`GET /api/me`、`POST /api/auth/logout`(认证语义不变);`GET/PUT/DELETE /api/progress`(批量行级 upsert,`ON CONFLICT` 取 MAX 只升不降,word_id 1..100 + 单批 ≤200 校验)、`GET/PUT /api/settings`(upsert,防三模块全关 → 400)。旧整档 `/api/game` 与 `worker/game.ts` 已删除。
- **前端单页状态机** —— [src/App.tsx](src/App.tsx):`boot → login → map(主页) → lesson → done`,无路由库;每步通过即时 PUT 单词行,家长可重置进度 / 退出 / 开声音 / 进学习设置。
- **地图即主页** —— [src/components/game/WordMapView.tsx](src/components/game/WordMapView.tsx):5 分类词网格,词格状态 全完成 ✅ / 部分 🔄 / 目标词脉冲高亮 / 未解锁 🔒,顶部星尘 + 称号 + 声音开关 + 家长菜单,底部总进度。
- **词学习答题器** —— [src/components/game/WordLesson.tsx](src/components/game/WordLesson.tsx):沿用 2 次作答机会 + 反馈 + 亮答案;步内任一题两次均错 → 该步重做(重新随机出题防背答案);一步两题全过 → 结算该步并推进。`match` 为一次性通过。
- **整词结算卡** —— [src/components/game/WordDone.tsx](src/components/game/WordDone.tsx):各技能步 +30 块 + 整词 +20 块,按是否首达动态祝贺(「整词完成」/「这一步完成啦」),显称号晋级,[下一词] / [回地图]。
- **家长学习设置** —— [src/components/game/SettingsPanel.tsx](src/components/game/SettingsPanel.tsx):拼音 / 汉字 / 英语三开关,即时 PUT,气密防全关。
- **题型三组件 + 发音** —— choice 增加题干大图 `promptEmoji`(一期视觉来源 = 词 emoji);listen-choice 进题自动朗读;拼音选项卡面显示拼音文本、朗读其对应**汉字**(zh-CN 直读稳定),英语读英文词(en-US);无对应语音静音降级;音效用 Web Audio 合成。

### 质量状态

- 纯逻辑单测 29 个全绿(`words` / `engine` / `lesson` / `progress`,`npm test`);`tsc -b`、`npm run lint`(oxlint)通过。
- 每任务独立 code review + opus 全分支终审,结论 ready-to-merge;终审发现项已清理或记录在案(见下)。
- 关卡制旧代码已彻底删除(levels.ts / MapView / LevelPlay / LevelResult / scoring / state / worker game.ts / `game_state` / `records` 及相关测试),无残留引用。

## 待办与需求池

> 需求/任务/优先级/拒绝记录唯一入口:[`docs/PLAN.md`](docs/PLAN.md)(章节:当前迭代 `P0` / 想法池 `P1`·`P2` / 坚决不做)。流转 / 准入 / 估算 / 复盘 / 分支准则见 [`CLAUDE.md` 需求与版本管理](CLAUDE.md)。
> 原 README「已实现但留待收尾」(浏览器验收 / 生产库建表 / 词库校对 / settings 重开语义缺口 / mergeProgress 清理)、「二期 backlog」(绘画模块 / 填空 / 复习排程 / 离线)、「明确不做」(非目标)列表已并 PLAN,README 不再重复列。

## 快速上手

```bash
npm install        # 装依赖
npm run dev        # 全栈本地 :3000(Vite + workerd + 本地 D1)
npm test           # 纯逻辑单测
npm run lint       # oxlint
npm run build      # tsc -b && vite build → 前端 dist/client
npm run db:local       # 本地 D1 应用全部迁移(migrations apply --local)
npm run deploy         # build + wrangler deploy(生产 = 默认 env)
npm run deploy:preview # build + wrangler deploy --env preview(独立 D1 冒烟)
```

登录令牌:本地读 `.dev.vars`(`ADMIN_TOKEN`,默认 `jazz-local-dev-token`);生产用 `wrangler secret put ADMIN_TOKEN`(预览 env 需 `--env preview` 另设),**禁止** Cloudflare Dashboard 手改变量。部署 / 迁移 / 发布流水线 / 架构细节见 [CLAUDE.md](CLAUDE.md)。

## 技术栈

React 19 + TypeScript + Vite(:3000)+ Tailwind 4 + motion · Cloudflare Workers(手写路由,`worker/`)+ D1(行级表) · 单一访问令牌 HttpOnly cookie 认证 · 浏览器 SpeechSynthesis 发音 + Web Audio 音效。依赖精简:无路由库、无状态管理库、无浏览器测试框架(vitest 仅覆盖 `src/game/*.test.ts` 纯逻辑)。
