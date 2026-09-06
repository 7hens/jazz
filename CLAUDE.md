# CLAUDE.md

> 核心精简版。**细则(完整数据模型/题型/迁移/部署事实/模块清单)一律按需读 `docs/dev-reference.md`**,触发表见文末;此处只留常驻铁律与指针。

## 项目概述

「魔法语言岛」v2 — 词库学习岛 — 面向儿童的拼音/汉字/英语学习游戏(自托管单机全栈)。孩子扮演「语言小魔法师」,按 5 大主题收集 100 词的星尘:每词按家长设定的启用模块跑「拼音/汉字/英语」技能步(每步 2 题、每题 2 次作答机会),技能步首过 +30 星尘、整词首通 +20 加成,星尘决定称号(语言初学者→…→语言大法师)。MVP 闭环:登录后单档案进度按「每词一行」存服务端。技术栈:React 19 + TS + Vite(:3000)+ Tailwind 4 + motion 前端;Cloudflare Workers(`worker/`)后端,`@cloudflare/vite-plugin` dev 内嵌 workerd;D1(binding `DB`,本地 `.wrangler/state`);单一访问令牌(env `ADMIN_TOKEN`)登录后存 HttpOnly `jazz_token` cookie 永不过期;发音走浏览器 `SpeechSynthesis`。

**需求/任务管理**:统一收口 `docs/PLAN.md`(当前迭代 P0 / 想法池 P1·P2 / 坚决不做),单一事实源,防漂移。

## 常用命令

```bash
npm install            # 安装依赖
npm run dev            # 全栈本地运行(:3000):Vite dev + workerd 跑 worker + 本地 D1
npm run dev:init       # 新环境:db:local 后连跑 dev
npm run build          # tsc -b && vite build → 前端 dist/client(worker 部署时由 wrangler 现场打包)
npm run lint           # oxlint
npm test               # vitest(jsdom):纯逻辑/服务 + Entry 组件 + architecture 边界
npm run db:local       # 本地 D1 应用 migrations/(d1 migrations apply --local)
npm run deploy         # build && wrangler deploy(生产 = 默认 env)
npm run deploy:preview # build && wrangler deploy --env preview(独立 D1,冒烟用)
```

`npm test` 覆盖词库完整性、出题引擎、步序/结算/称号、各 feature 服务与组件、`architecture.test.ts`(shared/features/app 3 层边界与注册纪律,违反即红)。

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
- 生命周期:关卡制旧代码已删/迁 feature。**勿重建** kingdom 别名或 game_state 类旧结构(细节见 dev-reference 与 CHANGELOG)。

## 架构(3 层骨架;细则按需读 dev-reference)

后端(Workers 手写路由,`worker/`):唯一入口 `worker/index.ts` + 路由表,auth/progress/settings handler 先 `getAuthenticatedUser`(401),全部查询按 `user_id` 绑定隔离;只做行级读写、`MAX` 合并保证星尘只升不降(幂等),**不解析**词库业务语义。无路由库。

前端 3 层(`src/architecture.test.ts` 守边界,**改完跑 `npm test` 须绿**):
- `src/shared/` — 无上层依赖的契约/纯逻辑/中性 UI(`services/*` 契约 + 同名一体 token + `core.ts` 访问机制;`ui/` 基础件)
- `src/features/<f>/` — 自包含,公共面 = 目录 `index.ts`,feature 间**禁编译期互引**
- `src/app/` — composition root(`bootstrap.ts` 唯一 register 点、App/useAppState 组装)

**取用纪律**:`useService()` 仅在 page feature `<Name>Entry.tsx` 与 `app/` hooks 内;注册只在 `bootstrap.ts`。

## 按需参考(涉及才读)

| 主题 | 读 |
|---|---|
| 数据模型/前端数据类归属/题型与发音约定/模块清单 | `docs/dev-reference.md` |
| 部署/版本/tag/迁移/后端 handler 事实 | `docs/dev-reference.md` |
| 前端操作细则 | `docs/frontend-dev-standard.md` |
| 需求/任务/优先级 | `docs/PLAN.md` |

## 注意

- **改词库**:只改 `src/features/vocabulary/words.ts`(分类 id 段、无重复文本)。发音文本由引擎自动推导,**无需 `speak` 字段**。
- **改奖励/解锁/称号/出题**:先看纯逻辑与其测试再动 UI —— 称号/进阶规则在 `src/features/lesson/progress-rules.ts`(语义属主;改动纯函数时跨 feature 消费方无需动);出题引擎 `src/features/question-engine/`(可注入 `rng` 保证确定性);结算/称号消费在 `src/features/lesson/`。
- **主题 token**:天空糖果色系在 `src/index.css`(`accent` 橙 / `emerald` 完成 / `red` 错误 / `ink/surface/hairline` 中性)。改色/动效先看该文件。
- UI 文案中文;依赖精简、无路由/状态管理库 —— 新增保持同一简约风格。
