# 拼音积木取代全游戏 · 设计

> 2026-09-21。把 `?mock=pinyin` 的试玩台落实成**唯一的正式玩法**，千字谷 / 字母林 / 词课整批退场。
> 面向 4-8 岁的零文本拼音积木：看图 → 挑块 → 拼进凹槽 → 声调骑韵腹。

## 1. 背景

试玩台目前是挂在 `phase` 状态机**旁边**的一块试验田（`?mock=pinyin`），零持久化、靠局部 state 推关、无解锁、无星级、无地图。正式游戏仍是「选择你的世界 → 千字谷 / 字母林」。

本设计把试验田扶正为唯一玩法，并把旧玩法的三条进度线（按词 `progress` / `basics` / `chapter`）整批作废。

**为什么一次到位而非并存**（决策记录）：并存意味着两套进度模型、两套 App 壳分支、两套词汇表长期并行维护；而试验田的玩法与旧词课共用「看图作答」的骨架，长期并存只会让两边都不干净。

## 2. 决策记录

| # | 决策 | 取舍理由 |
|---|---|---|
| D1 | **立刻取代，一次到位** | 见 §1 |
| D2 | **单元地图 + 单元内线性** | 纯线性没有「停在哪、从哪继续」的落点；地图给单元级解锁进度 |
| D3 | 地图格子 = **单元名片块** | 零文本下唯一自表意的方案：孩子认得的块就是路标，颜色还自带类型线索。emoji 找不到拼音单元的自然对应物；纯数字不预告内容 |
| D4 | 每关 **星级 1-3** | 给重玩动机；地图格子上直接摆星星 |
| D5 | 提示 **按单元固定撤 + 连错 2 次临时回强** | 脚手架既要会撤也要能回来；纯动态会让同一槽位的颜色在同关内变来变去，孩子无法建立「颜色 = 该拿哪种块」的稳定映射 |
| D6 | 连击 / 成就 / 幸运奖励 **全留** | 见 §7 |
| D7 | 星尘 **保留为全局累计** | 三套趣味件的产出全是星尘，删掉它们就变空转 |
| D8 | 目录名 `pinyin-blocks/` **不改** | 大删除的 diff 已经够大，改名只掺噪声 |
| D9 | 关卡加**显式稳定 id**，存档只认 id | 见 §3。用下标当 key 会在插入关卡时让所有存档错位 |

## 3. 关卡 id（D9 展开）

`pinyin_progress.stars` 的 key 必须是**稳定标识**，不能用 `UNITS` 展平后的下标：以后在 u2 中间插一关，u2 之后每一关的存档都会错位 —— 孩子的三星会跳到别的关上去，且没有任何报错。

所以 `Level` 加一个字段：

```ts
export type Level = {
  /** 存档键。与显示顺序解耦 —— 顺序可调、可插入,已存的星不受影响。全局唯一。 */
  readonly id: string
  readonly emoji: string
  readonly pinyin: string
  readonly read: string
  readonly syl: readonly Syllable[]
}
```

取值形如 `'u2-3'`（单元 id + 关内序号）。**注意：关内序号只在创建时取一次，之后该关怎么挪都不改 id。**

护栏：`levels.test.ts` 断言全部 id 非空、格式匹配 `/^u\d+-\d+$/`、**全局唯一**。

## 4. 信息架构

`useAppState` 相位从 8 个收成 5 个：

```
boot → login → map ──(点单元)──→ level
                └──(家长齿轮)──→ parent
```

- 删 `world` / `qianzigu-map` / `chapter` / `letter-forest` / `lesson`
- `settings` 改名 `parent`

`App.tsx` 渲染分支从 8 条降到 5 条。一并删除：`mockRoute`、`debugRow`、`stepGate`、`useCompletedWords`、`ColdStartWizard` 触发逻辑（`diagnosisOffered` 那一段）。

登录成功直接进 `map`，不再有「选择你的世界」。

## 5. 数据模型

### 5.1 迁移 `0008_pinyin_progress.sql`

```sql
-- 拼音积木正式版:每 user 一行(每关星级 + 星尘累计)。
-- additive:仅新增表,不改 0001 基线;旧代码回滚无视本表。
CREATE TABLE IF NOT EXISTS pinyin_progress (
  user_id     TEXT    PRIMARY KEY,
  stars       TEXT    NOT NULL DEFAULT '{}',  -- JSON: { "<levelId>": 1|2|3 },未通关的关不出现
  total_stars INTEGER NOT NULL DEFAULT 0,
  updated_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

旧表 `progress` / `user_settings` / `basics_progress` / `qianzigu_progress` **保留不删**：`0001` 基线不可改，`DROP` 也无法回滚。新代码不再读写它们，`user_settings` 仅继续承载 `earned_achievements` / `consecutive_days` / `last_active_date` 三列（成就系统仍用）。

### 5.2 服务端 `worker/pinyin-progress.ts`

```
GET    /api/pinyin-progress  → { stars: {...}, totalStars: number }
PUT    /api/pinyin-progress  ← { stars: {...}, totalStars: number }
DELETE /api/pinyin-progress  → 清该 user 的行（「重置全部进度」）
```

三条一律先 `getAuthenticatedUser`，401；查询按 `user_id` 绑定。

**合并语义（两条线都单调升）**：

- `total_stars` 在 SQL 里 `MAX(现有, 新值)` —— 原子、幂等
- `stars` 是 JSON，SQL 里无法逐 key 取 max → **读-改-写**：SELECT 现有 → 逐 key 取 `max` → UPSERT

读-改-写的并发窗口：单档案自托管场景（一个家庭、一次一台设备写）下不可达；且前端 service 每次 PUT 提交的是**已 merge 服务端旧值的全量**（见 §5.3），即使覆盖也不会丢已通关的位。

校验（非法值一律 400，不静默降级）：`stars` 的 key 匹配 `/^u\d+-\d+$/`、value ∈ {1,2,3}；`totalStars` 为非负整数。worker **不校验该 levelId 是否真实存在** —— 那需要引入关卡目录，属于业务语义（红线：worker 不解析词库业务语义）。

### 5.3 前端服务 `src/features/pinyin-progress/`

契约 `src/shared/services/pinyin-progress.ts`，token 在 `bootstrap.ts` 注册。

```ts
export type LevelStars = Readonly<Record<string, number>>  // levelId → 1..3

/** 每 user 一份(单档案:整表就一行)。 */
export type PinyinProgressData = Readonly<{ stars: LevelStars; totalStars: number }>
export type PinyinProgressSnapshot = LoadState<PinyinProgressData>

export interface PinyinProgressService extends ReactiveService<PinyinProgressSnapshot> {
  load(): Promise<void>
  /** 通关一次:取 max(旧, 新) 合并,并把本关的星尘产出计入 totalStars。 */
  recordClear(levelId: string, stars: number, starDust: number): Promise<void>
  resetAll(): Promise<void>
}
```

复用既有 `progress` 服务的那套**乐观合并 + 串行事务**结构（`saveTransactions` 队列、`visibleSnapshot()`、`settleSave()`）—— 已通关的关卡在等服务端确认期间就该显示为已通关。旧的 `src/features/progress/` 随词课删除，这套结构搬进新服务。

### 5.4 `api.ts`

删 `getProgress` / `putProgress` / `deleteProgress` / `getBasicsProgress` / `putBasicsProgress` / `getChapterProgress` / `putChapterProgress`；加 `getPinyinProgress` / `putPinyinProgress` / `deletePinyinProgress`。`getSettings` / `putSettings` 保留（成就仍用）。

## 6. 单元地图

新增 `UnitMap.tsx` 于 `pinyin-blocks/` 内（与关卡共享 `UNITS` 与块材质；拆成两个 feature 反而要跨 feature 引用，违反 `architecture.test.ts` 的边界）。

### 6.1 名片块

`Unit` 加一个字段：

```ts
export type Unit = {
  readonly id: string
  readonly name: string
  /** 地图格子里的名片 —— 本单元新教的块。跟 levels 一样**显式写死**,不靠反推。 */
  readonly badge: readonly Block[]
  readonly levels: readonly Level[]
}
```

| 单元 | 名片块 |
|---|---|
| u1 单韵母 | `[a]` |
| u2 二拼 | `[b][a]` |
| u3 复韵母 | `[ai]` |
| u4 鼻韵母 | `[a][n]` |
| u5 三拼介母 | `[g][u][a]` |
| u6 焊接音 | `[zh][i]` |
| u7 双音节 | `[x][i]` + `[g][u][a]`（缩一档） |

名片用**真材质**（`BlockChip` + 现有 `.pblock--*` 类），跟游戏里的块像素级一致 —— 视觉关联是这套表意的地基。

### 6.2 格子状态

| 状态 | 表现 |
|---|---|
| 未解锁 | 整格灰（`opacity` + 去饱和）、🔒 覆盖、名片块也灰 |
| 已解锁未通关 | 亮起，底部无星 |
| 已通关 | 底部一排星（★★☆），名片块正常 |

> ⚠ **2026-09-23 勘误(上表原文一字未改)**:本版的实际表现 = **`opacity-45` 淡化 + 🔒 覆盖**(`src/features/pinyin-blocks/UnitMap.tsx:77`、`:105`),**没有去饱和**;且「底部一排星」是**每关一个星位、通没通两态**(`.pstar` / `.pstar--on`),**不是** ★★☆ 这种星级计数 —— 某关是 1 / 2 / 3 星在界面上**看不出来**。

解锁规则：**u1 恒解锁；u(n) 解锁 = u(n-1) 全部关卡都 ≥1 星**。

点未解锁格 → 抖一下 + 提示音，不进入。复用 `.pblock--buzz` 那套或新增同构类。

> ⚠ **2026-09-23 勘误(上句原文一字未改)**:本版点未解锁格**无任何反应** —— `UnitMap.tsx:71-74` 是 `if (locked) return`,既不进关、也不抖动、也不发声(spec 里那句「复用 `.pblock--buzz`」所指的 `.pblock--buzz` 规则因此从未接线,已从 `src/index.css` 删除)。

### 6.3 地图页其它元素

- 顶部：星尘计数 `⭐ 340`
- 角落：齿轮图标 → `parent` 相位

## 7. 提示降档与星级

### 7.1 三档提示

先纠一处既有瑕疵：现在 `mid` 与 `weak` **实质没差别**（`pslot--plain` 的边框 14% 墨色 vs 基础 16%，肉眼分不出）。真正有意义的梯度是**染色深浅**：

| 档 | 空槽边框 | 空槽底色 | 单元 |
|---|---|---|---|
| 强 | 55% | 12% | u1 / u2 / u3 |
| 中 | 30% | 6% | u4 / u5 |
| 弱 | 无色（只留虚线框） | — | u6 / u7 |

**实现**：把强度收敛成两个 CSS 变量（`--pslot-line` / `--pslot-fill`），五套 `.pslot--*` 规则一律消费这两个变量，档位只改容器上的变量值。删掉 `.pslot--plain` —— 它是「每加一档就要复制五条规则」这个问题的产物。

`.pslot--medial` 的斜切双色渐变有自己的 alpha（16%），一并改为消费 `--pslot-fill`。

### 7.2 连错回强

本关内 `missCount >= 2` → 变量提到强档。**不落库**：刷新即重置，它是救急垫脚石而非存档。

### 7.3 星级判定

| 星 | 条件 |
|---|---|
| ★★★ | 本关 0 次错误 |
| ★★☆ | 1-2 次错误 |
| ★☆☆ | ≥3 次错误 |

**一次「错」** = 触发 `pslot--wrong` 抖动的那件事：拖到放不下的槽 / 点选被拒 / 盖到已占的槽被判错。计数在 `PinyinRound` 内（新增 `missCount` state）。

重玩取 `max(旧星, 新星)` —— 只升不降，与幂等纪律一致。

### 7.4 关卡间衔接

拼齐 → 撒花 + 星级揭晓 + 朗读整词 → 「继续」按钮 → 下一关。**单元最后一关的「继续」按钮变成「回地图」**。

> ⚠ **2026-09-23 勘误(上句原文一字未改)**:本版**未实现**星级揭晓与「继续」按钮。实际行为 = 拼齐 → 答案行亮出(拼音 + 汉字)并朗读 → 约 260ms 判定 + 1600ms 停顿 → **自动**进下一关,**单元最后一关自动回地图**(`src/features/pinyin-blocks/LevelEntry.tsx:70-71`);关内**不显示星** —— 星只作为**地图格子上的点/灭两态**可见(`UnitMap.tsx` 的 `.pstar`),看不出某关是 1 / 2 / 3 星。是否补关卡内星级即时反馈,见 `docs/PLAN.md` 想法池。

## 8. 趣味系统重锚（D6 / D7）

### 8.1 连击

触发点从「词课每答一题」改到「**每放一块**」：放对 = `first`，放错 = `wrong`。`getBonus()` 的星尘产出挪到**关卡结算**一并入账，跟 `recordClear` 同批写。

### 8.2 幸运奖励

关卡结算时掷一次骰（10% → +50 星尘），与连击加成同批写。

### 8.3 成就

目录 8 条逐条重审 —— 3 条原样活，5 条换锚点：

| 原 id | 原条件 | 处置 |
|---|---|---|
| `perfect_word` | 一个词全部题目首答就对 | → **一关 0 错通关**（= 三星） |
| `combo_15` | 连击达到 15 | 原样 |
| `marathon` | 一次学习首通 5 个词 | → **一次会话首通 5 关** |
| `early_bird` | 早上学习 | 原样 |
| `night_owl` | 晚上学习 | 原样 |
| `collector` | 完成一个分类的全部 20 词 | → **一个单元全三星** |
| `dedicated` | 连续 7 天学习 | 原样 |
| `grand_master` | 全部 100 词完成 | → **全部关卡通关** |

`AchievementState` 字段随之换名：

| 原 | 新 |
|---|---|
| `perfectWords` | `perfectLevels` |
| `categoryDone` | `unitPerfect` |
| `completedWords` / `totalWords` | `completedLevels` / `totalLevels` |
| `maxCombo` / `firstCompleteToday` / `consecutiveDays` / `hour` | 不变 |

**保留汉字文案**：成就弹窗是全游戏唯一还给孩子看汉字的地方。它低频、emoji 已承担主视觉、且这些是给家长看的里程碑，故不零文本化。这是**故意的例外**，不是遗漏。

## 9. 家长面板

`settings` 相位改名 `parent`，内容整个重做 —— 旧的设置页只有两个领域开关（汉语 / 英语），新游戏只有拼音，这一页失去全部内容。

面板内容：

- **登出**（原在字母林首页 `HomeEntry.tsx:243`）
- **重置全部进度**（原在 `HomeEntry.tsx:36`，`window.confirm` 确认）

两件都是**大人用的**，不是孩子用的。面板本身可以有文字。

## 10. 删除清单

### 10.1 整目录删除

`src/features/` 下：`qianzigu/` `archipelago/` `lesson/` `foundation/` `question-engine/` `vocabulary/` `lingling/` `progress/` `settings/`

**注意 `settings/` 与 `settings-state/` 不是一回事**：前者是设置**页 UI**（只有两个领域开关，随新游戏失去内容）；后者是 `createSettingsService` 的实现，承载成就系统仍要用的 `earned_achievements` / `consecutive_days` / `last_active_date`。**删前者，留后者。**

文档：`docs/design/`（故事圣经 / game-direction / game-assets / game-visual）、`docs/superpowers/plans/`（旧计划）

### 10.2 `src/shared/ui/` 清扫

`pinyin-blocks` 只用了 `shared/ui/utils` 的 `cn`（已核实：全部 import 里仅此一条来自 `shared/ui`）。所以整个 `shared/ui/quiz/`（`Choice` `MatchGame` `Stone` `CastButton` `QuestionBubble` `SparkBurst` `ListenChoice` `ProgressCrystals` `TypeBadge` 及其测试）在删除后**全部失去消费者**，连同词课题型一起退场。

基础件（`badge` `button` `card` `chart-tooltip` `input` `label` `select`）按**引用清扫**逐个确认：零引用即删。这一步不能用 `tsc` 兜底 —— 无人引用的模块不会报错，只会静静腐烂。

顺带修一处会变陈旧的注释：`material.test.ts` 开头引 `stone.test.ts` 作为「读源文件而非 `?raw`」的先例，该文件删掉后这句要改指仍在的文件。

### 10.3 保留并改

`pinyin-blocks/`（加地图 + 名片 + id + 提示变量 + 星级）、`achievements/`（§8.3）、`combo/`（§8.1）、`lucky-bonus/`（§8.2）、`celebrate/`、`audio/`、`speech/`、`toast/`、`auth/`、`api/`、`settings-state/`（服务实现，非 UI）、新增 `pinyin-progress/`

### 10.4 服务端

删 `worker/progress.ts` `worker/basics.ts` `worker/chapter-progress.ts`，加 `worker/pinyin-progress.ts`；`worker/index.ts` 路由表三条换一条。

`src/shared/services/` 删 `progress.ts` `basics-progress.ts` `chapter-progress.ts`，以及 `settings.ts` 里的 `DomainKey` / `enableKeyOf` / `DOMAIN_ORDER`（`SettingsService` 本体保留 —— 成就仍用）。`bootstrap.ts` 的 token 清单同步。

### 10.5 需要同步的文档

`CLAUDE.md`（项目概述、按需参考表）、`docs/dev-reference.md`（数据模型 / 模块清单 / 后端 handler 事实）、`docs/PLAN.md`（本需求入池行 + 大删除留痕）。

## 11. 实施时序

**分两次提交，先建后删。**

| # | 步骤 | 门 |
|---|---|---|
| 1 | 建：迁移 `0008` + `worker/pinyin-progress.ts` + 路由 + 前端服务 + 地图 + 名片 + 关卡 id + 提示变量 + 星级 + parent 面板 | — |
| 2 | 切 `App.tsx` 壳到新相位机（旧 feature 变成不可达） | `npx tsc -b` + `npm test` + 浏览器冒烟 |
| 3 | **提交 1**（`feat`，纯新增 + 切换） | — |
| 4 | 删：§10 全部 | — |
| 5 | 复跑 | `npx tsc -b` + `npm test` + `oxlint` + `npm run build` + 浏览器冒烟 |
| 6 | **提交 2**（`chore`，纯删除） | — |

删除独立成一个可 revert 的提交 —— 真发现漏了什么，退第二步就行，不用把新东西一起退掉。

### 迁移顺序（红线）

先升库后升代码：本地 `npm run db:local` → 发布时 preview → prod。发布走 `/release` skill 的流水线。

## 12. 测试与验收

### 12.1 新增护栏

- `levels.test.ts`：关卡 id 非空、格式匹配、**全局唯一**；每个单元有非空 `badge`，且 badge 里的块值都在块目录定义域内
- `rules.test.ts`：星级判定表（0 错 / 1-2 错 / ≥3 错）；`max(旧星, 新星)` 只升不降
- `material.test.ts`：三档提示强度只通过两个 CSS 变量表达（`.pslot--plain` 已删）；五套 `.pslot--*` 都消费这两个变量
- `pinyin-progress` 服务：乐观合并、串行事务、resetAll 后 in-flight GET 不复活旧数据（照搬旧 `progress.test.ts` 的用例族）
- `worker`：`stars` 逐 key 取 max 的合并；非法 key / value / totalStars 返回 400
- 解锁规则（纯函数）：u1 恒解锁；u(n) 解锁 = u(n-1) 全关 ≥1 星

**不指望 `architecture.test.ts` 帮你发现删漏**：它是**规则式**的（禁跨 feature import、`useService` 只许在 `*Entry.tsx`、`registry.register` 唯一在 `bootstrap.ts`），不枚举 feature 清单，删目录不会让它变红。删漏的引用由 `tsc -b` 抓（编译期），而**无人引用的死模块谁也抓不到** —— 那正是 §10.2 要人工逐个确认的理由。

### 12.2 浏览器冒烟清单

1. 登录 → 落到地图，只有 u1 亮
2. 点 u1 → 进第 1 关 → 拼对 → 撒花 + 三星 + 「继续」
   > ⚠ **2026-09-23 勘误(上句原文一字未改)**:本版**未实现**星级揭晓与「继续」按钮 —— 拼对后是**自动**进下一关(末关自动回地图),星要**回地图看该关的星位**(只表示通没通,不显示几星)。详见 §7.4 的勘误注记。
3. 故意放错 3 次 → 一星
4. 连错 2 次 → 空槽颜色变回强档
5. u1 全通 → u2 解锁
6. 刷新 → 回到地图，星与解锁状态都在
7. 重玩一个二星的关拿到三星 → 地图上星星增加（**不减少**）
8. 齿轮 → 登出；重登 → 状态仍在
9. 齿轮 → 重置全部进度 → 地图回零
10. 断网重放（可选）：乐观合并期间已通关的关不闪回未通关

### 12.3 遵守的约束

- **No Screenshots**：一律用 `textContent` dump、`getComputedStyle`、测试、grep 构建产物 CSS、console / network 验证。确实需要看像素请用户自己看。
- `wrangler` 命令一律显式 `--config wrangler.toml`
- `tag` 仅在部署成功 + 浏览器冒烟通过后打

## 13. 未纳入本轮

### 13.1 内容缺口（另立一条）

「覆盖全部拼音知识」是最初目标，但**现在 37 关没覆盖全**：

- **16 个整体认读音节只做了 7 个**（`zhi chi shi ci yu yue ying`），缺 `ri zi si yi wu ye yuan yin yun`
- **ü 的两点规则**只覆盖 `yu` / `yue`，缺 `jue que xue`（j/q/x + üe）
- **三拼 ü** 缺（`juan quan xuan`）
- **`er`** 在 `FINAL_COMPOUND` 里定义了，但**一关都没用上**（已核实：0 处引用）

补齐属于内容扩充，与骨架落地是两件事。**本 spec 不含内容扩充。**

### 13.2 明确不做

- 家长跳关面板（D2 时已否决）
- 多档案 / 多孩子（现架构是单一 `ADMIN_TOKEN` 单档案）
- 贴纸图鉴（D7 时已否决，选星尘）

## 14. 风险

| 风险 | 处置 |
|---|---|
| 删除不可逆 | 拆成独立可 revert 的提交（§11）；且本轮前全仓已推到远端 |
| `stars` 读-改-写非原子 | 单档案自托管下并发窗口不可达；前端每次 PUT 提交已 merge 的全量，覆盖也不丢位（§5.2） |
| 关卡 id 手工维护易重复 | `levels.test.ts` 全局唯一护栏 |
| 旧表残留令人困惑 | `dev-reference.md` 明确标注「0001/0003/0005 建的表已停用，保留仅为不可回滚」 |
| 大删除遗漏引用 | `npm test`（含 `architecture.test.ts` 边界）+ `tsc -b` 是硬门；分两次提交让删除单独可退 |
