# 魔法语言岛 v2 · 词库学习岛

面向儿童的拼音 / 汉字 / 英语学习游戏(自托管单机全栈)。孩子扮演「语言小魔法师」,在分类词库地图上按顺序解锁并学习 100 个实词:每词至多 3 个技能步(拼音 / 汉字 / 英语,可由家长开关裁剪),每步 2 题、每题 2 次作答机会;答对积星尘,星尘累计决定称号。MVP 闭环:单一访问令牌登录 → 单档案 → 每词一行进度存服务端 → 刷新不丢。

> **当前状态**:词库学习岛一期(玩法内核)已开发完成并终审通过,待人工浏览器验收与部署。
> **设计文档(权威)**:[docs/superpowers/specs/2026-09-03-word-island-v2-design.md](docs/superpowers/specs/2026-09-03-word-island-v2-design.md)
> **实施计划**:[docs/superpowers/plans/2026-09-03-word-island-implementation.md](docs/superpowers/plans/2026-09-03-word-island-implementation.md)
> **工程细节(命令 / 架构 / 数据模型 / 约定)**:[CLAUDE.md](CLAUDE.md)

## 已实现功能(一期)

- **100 词词库** —— [src/data/words.ts](src/data/words.ts),id 1..100 即解锁顺序,5 分类各 20 词(基础形状 / 食物 / 动物 / 自然界 / 交通与物品),`wordById` / `CATEGORY_LABELS` 供查词与分区标题;数据完整性由单测拦截(数量 / id 连续 / 文本唯一 / 分类基数 / 拼音笔误)。
- **运行时出题引擎** —— [src/game/engine.ts](src/game/engine.ts):每技能步 2 题串行,题型按技能随机组合 —— 拼音 choice / listen-choice、汉字 choice / match、英语 choice / listen-choice / match(填空题型未做,见二期)。干扰项同分类优先、不足跨类兜底、排除与目标词任一文本重复者;选项数按词 id(≤20 给 3 项,其余 4 项);选项 / 题干带全局唯一 id,供 React 复用 key。
- **学习单元步序与解锁**(纯逻辑,[src/game/lesson.ts](src/game/lesson.ts)):技能顺序 拼音→汉字→英语,`stepsFor` 按家长设置裁剪、全关时强制英语;词「全完成」= 启用技能全完成;解锁 = 自 1 起首个未完成词,全通则停在词 100 后。
- **奖励结算与称号**(纯逻辑,[src/game/progress.ts](src/game/progress.ts)):技能步首过 +30、整词首通加成 +20、重学不重复发放(只升不降);称号 8 档阈值(0/300/1000/2500/5000/8000/12000);前端内存态字段级合并(`completed` 取 OR、`stars_earned` 取 MAX)。
- **DB 行级进度** —— [schema.sql](schema.sql):`users`(单档案外键)+ `progress`(每 user × 每词一行,三技能完成位 + `stars_earned`)+ `user_settings`(三模块开关);[migrations/2026-09-03-word-progress.sql](migrations/2026-09-03-word-progress.sql) 幂等 DROP 旧 `game_state` 并建新表,可重复执行。
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

## 待完善与二期 backlog

### 已实现但留待收尾(短期 follow-up)

| 项 | 现状 / 处理 |
| --- | --- |
| 浏览器端人工验收 | 一期从未在真浏览器点验。需按实施计划 T14 §2 走 5 步:登录 → 词 1 三技能学习(含故意答错)→ 结算 +110 → 解锁词 2 → 关拼音后词 2 只 2 步 → 刷新持久 → 重置归零 |
| 生产库建表 | `npm run deploy` 前须对远程 D1 执行建表迁移,否则无 `progress` / `user_settings` 表 |
| 词库 emoji / 分类语义人工校对 | shape 组含书 / 门 / 礼物等非形状物、nature 组含蜜蜂 / 蝴蝶等动物,源自 v1.1 数据瑕疵,一期沿用;需真人对图 + 分类重整 |
| settings 中途开启模块的语义缺口 | 家长学习时关技能、之后重开 → 已学词按新配置重达「全完成」,会再触发 +20 且目标词回跳(重锁已学词)。默认恒定流程下正确;二期以 per-word 永久 `bonus_granted` 列 + ever-enabled 解锁修复(已在 spec §13 记录) |
| `mergeProgress` 死导出 | [src/game/progress.ts](src/game/progress.ts) 导出未被接线;接入加载合并或删除(连同测试) |
| 少量 hardcode / 死分支 | 「100 词」总进度文案写死;`partial`(🔄部分)地图态当前不可达;若干可达性 edge(`PUT [null]`、settings 全量替换、per-step PUT 静默失败由 MAX 自愈)均为非风险项,已论证保留 |

### 二期 backlog(设计已留口,本期明确不做)

- **绘画模块**:一词一画 — 拍照 → 缩略 → 亮度抠图 → 自动裁剪 → 确认;`progress.drawing_*` 列后续迁移加入(一期视觉来源 = `word.emoji`,`getVisual(word)` 已留接缝)。spec §2.2 / CLAUDE.md 二期 backlog 有述。
- **填空题型**:fillBlank — 汉字补缺字 / 英语补字母(引擎 §7.2 候选题型已预列,编码未做)。
- **复习挑战 / 错词重练排程**:每 5 新词、弱技能优先出题。
- **离线可用**:IndexedDB + Service Worker + syncQueue + 字段级合并。
- **词库数据人工校对与分类语义重整**(见上表)。

### 明确不做(非目标)

语音识别、汉字书写笔顺、绘画作品检测、社交 / 多人、多孩子档案、家长看板、商店 / 徽章 / 宠物 / 每日挑战、PWA、用户 ID 展示。设计已为非目标划界,避免二期待办蔓延。

## 快速上手

```bash
npm install        # 装依赖
npm run dev        # 全栈本地 :3000(Vite + workerd + 本地 D1)
npm test           # 纯逻辑单测
npm run lint       # oxlint
npm run build      # tsc -b && vite build → 前端 dist/client
npm run db:apply   # 本地 D1 建表(schema.sql)
npm run db:migrate # 本地执行 migrations/*.sql
npm run deploy     # build + wrangler deploy
```

登录令牌:本地读 `.dev.vars`(`ADMIN_TOKEN`,默认 `jazz-local-dev-token`);生产在 Workers 控制台设 `ADMIN_TOKEN`。部署 / 迁移 / 架构细节见 [CLAUDE.md](CLAUDE.md)。

## 技术栈

React 19 + TypeScript + Vite(:3000)+ Tailwind 4 + motion · Cloudflare Workers(手写路由,`worker/`)+ D1(行级表) · 单一访问令牌 HttpOnly cookie 认证 · 浏览器 SpeechSynthesis 发音 + Web Audio 音效。依赖精简:无路由库、无状态管理库、无浏览器测试框架(vitest 仅覆盖 `src/game/*.test.ts` 纯逻辑)。
