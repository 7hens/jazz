# 魔法语言岛 v2 · 拼音积木岛

面向儿童的**拼音拼读**游戏(自托管单机全栈)。孩子扮演「语言小魔法师」,在地图上按单元解锁关卡:一张图、一个音节,从积木盘里挑出声母 / 介母 / 韵母 / 鼻音块拼进凹槽,再给韵腹盖上声调块。通关累计星尘与隐藏成就,刷新不丢。

> **当前状态**:仓库里**只有这一套玩法** —— 词课 / 千字谷 / 字母林 / 基础引导 / 出题引擎 / 100 词词库已整批删除。`0.2.0` feature 轨在跑(未发版),进度见 [docs/PLAN.md](docs/PLAN.md)。
> **权威设计**:[docs/superpowers/specs/2026-09-21-pinyin-blocks-full-game-design.md](docs/superpowers/specs/2026-09-21-pinyin-blocks-full-game-design.md)
> **工程细节(命令 / 架构 / 数据模型 / 部署)**:[CLAUDE.md](CLAUDE.md) + [docs/dev-reference.md](docs/dev-reference.md) · 前端细则 [docs/frontend-dev-standard.md](docs/frontend-dev-standard.md)

## 玩法

- **7 个单元 / 37 关**,由易到难:单韵母 → 二拼 → 复韵母 → 鼻韵母 → 三拼介母 → 整体认读焊接 → 双音节词 — [src/features/pinyin-blocks/levels.ts](src/features/pinyin-blocks/levels.ts)。单元地图每格用**真积木**当名片(零文本 —— 孩子读不出「单韵母」三个字)。
- **一关 = 一张图 + 一(两)个音节**:5 类块各有颜色(声母蓝 / 介母青 / 韵母绿 / 鼻音紫 / 声调金),孩子把块拼进对应凹槽(点选或拖拽皆可),放错累计 `miss`。
- **星级与解锁**:0 次错 = ⭐⭐⭐、≤2 次 = ⭐⭐、其余 = ⭐(**1 星即通关,不设失败**);u1 恒开,其余单元要求前一单元全关通关。统计口径单点在 [progress-stats.ts](src/features/pinyin-blocks/progress-stats.ts) —— 地图与成就取同一份数,两处各算一遍必然漂移。
- **星尘与成就**:通关产出星尘(连击加成 + 首次通关的幸运奖励 + 成就奖励),8 条隐藏成就(完美主义 / 连击王者 / 马拉松 / 早起鸟 / 夜猫子 / 收集者 / 坚持者 / 大法师)按关卡口径扫描;星尘只增不减。
- **发音**:块与音节的朗读文本是**同音汉字**(系统 TTS 拿到 `bà` 这种拉丁串会逐字母念);音效另走 Web Audio 合成。

## 数据与后端

- **单一访问令牌**登录(env `ADMIN_TOKEN`,存 HttpOnly `jazz_token` cookie 永不过期);本地 dev 缺省令牌 `jazz`,零配置。
- **进度每 user 一行** —— 表 `pinyin_progress`([migrations/0008_pinyin_progress.sql](migrations/0008_pinyin_progress.sql)):`stars`(关卡 id → 1/2/3 的 JSON)+ `total_stars`(星尘累计);两条线只升不降(worker 逐 key 取 `MAX` + 读-改-写合并)。
- **API**([worker/index.ts](worker/index.ts),手写路由,无路由库):

  | 路由 | 方法 | 说明 |
  |---|---|---|
  | `/api/auth/login` | POST / GET | 提交令牌登入(设 cookie)/ 顺带返回当前用户 |
  | `/api/auth/logout` | POST | 清 cookie |
  | `/api/me` | GET | 当前用户(未授权 401) |
  | `/api/pinyin-progress` | GET / PUT / DELETE | 读该 user 单行 / 合并写入(星级与星尘只升不降)/ 重置全部进度 |
  | `/api/settings` | GET / PUT | 成就集与连续学习天数 |

  未匹配的 `/api/*` 一律 JSON 404(绝不落到静态资源);每个 handler 先鉴权(401),所有查询按 `user_id` 隔离。
- **家长面板**(地图上的入口):登出 / 重置全部进度。

> 词课时代的 `progress` / `basics_progress` / `qianzigu_progress` 等表与 `enable_*` 列**已停用**但保留在库中(迁移不可回滚,不删列不删表),完整清单见 [docs/dev-reference.md](docs/dev-reference.md)「数据模型」。

### 前端架构备忘

`src/shared/`(契约 + 纯逻辑 + 中性基础件,无上层依赖)→ `src/features/<f>/`(自包含模块,公共面 = `index.ts`)→ `src/app/`(composition root:`bootstrap.ts` 唯一注册点 + 页面状态路由 + 跨 feature 组装)。中性视觉件剩 4 个(`shared/ui/` 的 button / card / input / label,外加 `utils.ts` 的 `cn`);玩法全在 `features/pinyin-blocks/`。边界纪律由 [src/architecture.test.ts](src/architecture.test.ts) 强制(feature 间禁编译期互引、`useService` 仅页面入口与 app、服务注册唯一入口 `app/bootstrap.ts`)。

### 质量状态

- 全量 `npm test`(vitest,jsdom)31 个测试文件 / 249 用例全绿,覆盖关卡数据完整性、积木规则(槽位 / 干扰块 / 星级)、结算与成就、各 feature 服务与组件、`architecture.test.ts` 3 层边界;`tsc -b`、`npm run lint`(oxlint)、`npm run build` 通过。
- 旧世界(词课 / 千字谷 / 字母林 / 基础引导 / 出题引擎 / 词库 / `shared/ui/quiz/`)的代码已删除,无残留引用。

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

登录令牌:本地 dev **不用配置** —— 缺省令牌 `jazz`,直接登录;想换令牌才需要 `.dev.vars`(`cp .dev.vars.example .dev.vars` 后改 `ADMIN_TOKEN`,该文件被 gitignore 且**不随 worktree 复制**)。生产用 `wrangler secret put ADMIN_TOKEN`(预览 env 需 `--env preview` 另设;构建产物无任何兜底,secret 缺失即全部 401),**禁止** Cloudflare Dashboard 手改变量。部署 / 迁移 / 发布流水线 / 架构细节见 [CLAUDE.md](CLAUDE.md)。

## 技术栈

React 19 + TypeScript + Vite(:3000)+ Tailwind 4 + motion · Cloudflare Workers(手写路由,`worker/`)+ D1 · 单一访问令牌 HttpOnly cookie 认证 · 浏览器 SpeechSynthesis 发音 + Web Audio 音效。依赖精简:无路由库、无状态管理库;vitest(jsdom)覆盖纯逻辑 + 组件 + 架构边界。
