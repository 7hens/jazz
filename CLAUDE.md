# CLAUDE.md

> 核心精简版。**细则(完整数据模型/题型/迁移/部署事实/模块清单)一律按需读 `docs/dev-reference.md`**,触发表见文末;此处只留常驻铁律与指针。

## 项目概述

「魔法语言岛」v2 — 拼音积木岛 — 面向儿童的拼音拼读游戏(自托管单机全栈,仓库里**只有这一套玩法**)。孩子扮演「语言小魔法师」,在地图上按单元解锁 **7 个单元 / 37 关**(单韵母 → 二拼 → 复韵母 → 鼻韵母 → 三拼介母 → 整体认读焊接 → 双音节词):每关给一张图 + 一个(或两个)音节,孩子从积木盘里挑出正确的声母/介母/韵母/鼻音块拼进凹槽、再给韵腹盖上声调块;放错累计 `miss`,一关 0 次错 = 3 星、≤2 次 = 2 星、其余 = 1 星(1 星即通关,不会「失败」)。通关产出星级 + 星尘(连击加成 / 幸运奖励 / 成就奖励),8 条隐藏成就按关卡口径扫描。MVP 闭环:登录后单档案进度**每 user 一行**(每关星级 JSON + 星尘累计,两条线单调升)存服务端。技术栈:React 19 + TS + Vite(:3000)+ Tailwind 4 + motion 前端;Cloudflare Workers(`worker/`)后端,`@cloudflare/vite-plugin` dev 内嵌 workerd;D1(binding `DB`,本地 `.wrangler/state`);单一访问令牌(env `ADMIN_TOKEN`)登录后存 HttpOnly `jazz_token` cookie 永不过期;发音走浏览器 `SpeechSynthesis`(读的是**同音汉字**,不是拼音串)。

**需求/任务管理**:统一收口 `docs/PLAN.md`(当前迭代 P0 / 想法池 P1·P2 / 坚决不做),单一事实源,防漂移。

## 常用命令

```bash
npm install            # 安装依赖
npm run dev            # 全栈本地运行(:3000):Vite dev + workerd 跑 worker + 本地 D1
npm run dev:init       # 新环境:db:local 后连跑 dev
npm run build          # tsc -b && vite build → 前端 dist/client(worker 部署时由 wrangler 现场打包)
npm run lint           # oxlint
npm test               # vitest(jsdom):关卡规则/结算/成就等纯逻辑 + 服务 + Entry 组件 + architecture 边界
npm run db:local       # 本地 D1 应用 migrations/(d1 migrations apply --local)
npm run deploy         # build && wrangler deploy(生产 = 默认 env)
npm run deploy:preview # build && wrangler deploy --env preview(独立 D1,冒烟用)
```

`npm test` 覆盖关卡数据完整性(7 单元 / 37 关 / 块显式写死)、积木规则(槽位 / 干扰块 / 星级)、结算与成就、各 feature 服务与组件、`architecture.test.ts`(shared/features/app 3 层边界与注册纪律,违反即红)。

**发布**:执行流水线(步骤/闸门/坑)走 `/release`(项目 skill);发布行为改动时 skill 与本仓库事实**两处同步**。版本规范/部署红线事实见 `docs/dev-reference.md`「部署与版本发布」。

## 版本与工作流(铁律精简)

- 需求先入 PLAN 想法池一行占位,确认才立项;**禁止直接开工**。详设入 `docs/superpowers/specs/`(唯一位置)。
- 分支:唯一长命 `main`(开发 + 发版)。大 plan 走 topic 分支 + worktree,成即合删;hotfix 从已发 tag 出。tag 长存不删(hotfix 锚点 + 回滚真相源)。
- 版本号只表影响面(bug=patch / 能力=minor / 破坏性=major),P 只表何时做。估算:S(≤2h)随发或直 commit;M(1~2d)独立 minor;L(≥3d)强制拆 spec。超限且完成 <50% → 收尾滚下版。
- 复盘三问答案追加至最新发布条目末(根 `CHANGELOG.md` 只追加)。

## 红线(常驻,违反即事故)

- **wrangler 命令一律显式 `--config wrangler.toml`**,否则构建产物 `dist/jazz_life_tracker/wrangler.json` 劫持配置 → env 失效、DB 落生产库。
- **禁止 `[env.production]`**;生产 = 默认 env。prod `ADMIN_TOKEN` 已是 secret,勿覆盖(覆盖 = 全 cookie 失效)。
- 表结构变更 = 新增数字前缀迁移(`0002_xxx.sql`…),**不改 0001 基线**;新字段带 `DEFAULT`/可 `NULL`;顺序先升库后升代码(本地 `db:local` → 发布时 preview → prod)。
- **tag 仅在部署成功 + 浏览器冒烟通过后打**(`npm version` → push tags);失败绝不 version(孤儿 tag)。回滚方向见 dev-reference。
- 生命周期:词课 / 千字谷 / 字母林 / 基础引导 / 出题引擎 / 100 词词库 / `shared/ui/quiz/` 已随「拼音积木取代全游戏」**整批删除**。**勿重建**(含 kingdom / game_state / basics / qianzigu 类旧结构与旧路由);停用但保留的表 / 列见 dev-reference「数据模型」。

## 架构(3 层骨架;细则按需读 dev-reference)

后端(Workers 手写路由,`worker/`):唯一入口 `worker/index.ts` + 路由表(三组 handler:`auth.ts` / `pinyin-progress.ts` / `settings.ts`),每个 handler 先 `getAuthenticatedUser`(401),全部查询按 `user_id` 绑定隔离;只做行级读写,星级逐 key 取 `MAX` + 星尘 `MAX(...)` / 读-改-写合并保证只升不降(幂等),**不解析**拼音业务语义。无路由库。

前端 3 层(`src/architecture.test.ts` 守边界,**改完跑 `npm test` 须绿**):
- `src/shared/` — 无上层依赖的契约/纯逻辑/中性 UI(`services/*` 契约 + 同名一体 token + `core.ts` 访问机制;`ui/` 基础件:button / card / input / label / reward-card / utils)
- `src/features/<f>/` — 自包含,公共面 = 目录 `index.ts`,feature 间**禁编译期互引**。玩法 `pinyin-blocks`(地图 / 关卡 / 积木与规则);服务型 feature 11 个:`achievements` / `api` / `audio` / `auth` / `celebrate` / `combo` / `lucky-bonus` / `pinyin-progress` / `settings-state` / `speech` / `toast`
- `src/app/` — composition root(`bootstrap.ts` 唯一 register 点、App/useAppState 组装;`ParentPanel.tsx` 家长面板)

**取用纪律**:`useService()` 仅在 page feature `<Name>Entry.tsx` 与 `app/` hooks 内;注册只在 `bootstrap.ts`。

## 按需参考(涉及才读)

| 主题 | 读 |
|---|---|
| 数据模型/前端数据类归属/发音约定/模块清单 | `docs/dev-reference.md` |
| 部署/版本/tag/迁移/后端 handler 事实 | `docs/dev-reference.md` |
| 前端操作细则 | `docs/frontend-dev-standard.md` |
| 需求/任务/优先级 | `docs/PLAN.md` |
| **手工走查 / 浏览器冒烟条目**(发布闸门①的来源) | `docs/walkthrough.md` |

## 注意

- **改用户可见行为**(样式 / 布局 / 手势 / 动画 / 文案 / 持久化 / 发音):**同一个提交里必须同时更新 `docs/walkthrough.md`** —— jsdom 判不了的(像素、手势、真 cookie)只有人眼能判,清单不跟着改就等于没闸门。

- **改关卡**:只改 `src/features/pinyin-blocks/levels.ts`(单元顺序即难度阶梯;每关 `id` 形如 `u2-3` 是**存档键**,与显示顺序解耦 —— 挪关不改 id、新关照式追加)。块**显式写死**,不由拼音串反推;`read` 必须是**同音汉字**(TTS 拿到 `bà` 这种拉丁串会逐字母念)。
- **改玩法/结算/成就**:先看纯逻辑与其测试再动 UI —— 槽位 / 干扰块 / 星级在 `src/features/pinyin-blocks/rules.ts`(可注入 `rng` 保证确定性);解锁与统计口径在 `progress-stats.ts`(地图与成就同一份);结算(星级归一 / 首通 / 连续天数 / 成就扫描)在 `settle.ts`;成就目录在 `src/features/achievements/achievements.ts`;入库合并只升不降在 `src/features/pinyin-progress/`。
- **主题 token**:天空糖果色系在 `src/index.css`(`accent` 橙 / `emerald` 完成 / `red` 错误 / `ink/surface/hairline` 中性),拼音积木材质段另有 `--pb` 一族变量。改色/动效先看该文件。
- UI 文案中文;依赖精简、无路由/状态管理库 —— 新增保持同一简约风格。
