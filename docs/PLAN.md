# PLAN 需求与任务管理

> 全仓需求/任务**唯一入口**,取代 `docs/IDEAS.md`(想法池)+ `docs/TODO.md`(看板)。规则:
>
> - 任何新需求先进「想法池」**一行,带 `P0`/`P1`/`P2` 前缀**;重复即弃旧;**禁止直接开工**。
> - 排进本轮开工 → 升「当前迭代」;确认不做 → 移「坚决不做」留痕(防反复)。
> - 状态细节在 spec / plan / sdd,此处只记**行级事实 + 优先级**,不逐条抄进度。
> - 关键准则(准入 / 估算收尾 / 复盘三问 / 分支模型):见 `CLAUDE.md`「需求与版本管理」。

## P 优先级(需求 = 影响面,P = 何时做)

| 级 | 含义 | 闸门 |
| :-- | :-- | :-- |
| `P0` | 最高:本轮在跑 / 阻塞发版 | 立即做,做完发 |
| `P1` | 确认要做,待排期(原「二期 backlog」) | 立项 → 排期 → 开工 |
| `P2` | 想法观察,未承诺 | 先入池冷静;重复即弃 |

## 当前迭代

> 双轨制,可并行(轨 = 变更类型/发布线,版本号由影响面定,见 CLAUDE「版本语义」):
> - **feature 轨** — 新能力/需求线,可**聚合多个需求**并行开发;集齐、双闸门过才发,不逐需求发。版本:兼容新增 → minor;破坏 → major(1.0.0 起,0.x 阶段破坏仍落 minor)。
> - **hotfix 轨** — bug 修复线,基于**已发布 tag** 出,不夹带未发 feature 代码;就绪即发独立 patch。
> 行格式:`- [ ] P<n> [轨] 标题 — <状态> · <链接>`;详设 `superpowers/specs/`、执行 `superpowers/plans/` + `.superpowers/sdd/`,轨内可多 plan。发版后清空对应轨换新、版本前推。

### feature 轨 — 目标 `0.2.0`(未发;新能力,兼容 → minor)

- [x] `P0` `[feature]` 趣味性系统(fun-system)— 开发完成并入 main,随 0.2.0 一起发 — [plan](superpowers/plans/2026-09-04-fun-system.md) / [spec](superpowers/specs/2026-09-04-fun-system-design.md)
- [x] `P0` `[feature]` 前端架构重构 — 开发完成并入 main,随 0.2.0 一起发 — [plan](superpowers/plans/2026-09-04-dev-architecture-refactor.md) / [spec](superpowers/specs/2026-09-04-dev-architecture-refactor-design.md)
- [ ] `P0` `[feature]` 浏览器端人工验收 — 0.2.0 发布前置:登录 → 词 1 三技能(含故意答错)→ 结算 +110 → 解锁词 2 → 关拼音后词 2 只 2 步 → 刷新持久 → 重置归零;补 fun 抽查(连击 / 成就 / 幸运 / 夸奖 / 撒花)
- [ ] `P0` `[feature]` 远程 D1 迁移 — 0.2.0 发布前 apply `migrations/0002_fun.sql`(settings 新列),preview → 生产;本地已 `npm run db:local`

### hotfix 轨 — 目标 `0.1.1`(基于 `v0.1.0` 已发 tag)

- (空 — `0.2.0` 发布前只修 `v0.1.0` 上线 bug → `0.1.1`;`0.2.0` 发布后 base 前移,下一 hotfix 为 `0.2.1`。浏览器验收 / 生产冒烟发现 bug 即在此加行 `[hotfix]`,独立快速发)

## 想法池

> 一行一需求,`P1` = 确认要做待排期,`P2` = 想法观察不承诺。行格式:`- [ ] P<n> 标题 — <一句上下文>`。重复即弃旧。

- [ ] `P1` 绘画题型 — 一词一画:拍照 → 缩略 → 亮度抠图 → 自动裁剪 → 确认;`progress.drawing_*` 列后续迁移加入(一期视觉来源 = `word.emoji`,`getVisual(word)` 已留接缝)。spec §2.2 有述
- [ ] `P1` 填空题型 — fillBlank:汉字补缺字 / 英语补字母(引擎候选题型 §7.2 已预列,编码未做)
- [ ] `P1` 复习挑战 / 错词重练排程 — 每 5 新词、弱技能优先出题
- [ ] `P1` 离线可用 — IndexedDB + Service Worker + syncQueue + 字段级合并
- [ ] `P1` settings 中途开启模块的语义缺口 — 家长学习时关技能、之后重开 → 已学词重达「全完成」再触发 +20、目标词回跳;以 per-word 永久 `bonus_granted` 列 + ever-enabled 解锁修复。spec §13 有述
- [ ] `P1` 词库 emoji / 分类语义人工校对 — shape 组含书 / 门 / 礼物等非形状物、nature 组含蜜蜂 / 蝴蝶等动物(源自 v1.1 数据瑕疵),需真人图文重整
- [ ] `P2` mergeProgress 死导出 — [src/game/progress.ts](../src/game/progress.ts) 导出未接线;接入加载合并或删除(连同测试)

## 坚决不做

> 非目标,留痕防反复。设计已划界,避免待办蔓延。原 `CLAUDE.md`「真不做」+ `README`「明确不做」并集。

- 语音识别
- 汉字书写笔顺
- 绘画作品检测(对作品照片做内容识别)
- 多孩子档案
- 家长看板
- 商店 / 徽章 / 宠物 / 每日挑战
- PWA
- 多人在线 / 社交
- 用户 ID 展示
