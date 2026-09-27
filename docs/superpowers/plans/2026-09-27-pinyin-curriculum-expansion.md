# 拼音课程全表扩充 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把课程从 7 单元 / 37 关扩到 **12 单元 / 91 关**,让 23 声母 / 24 韵母 / 16 整体认读 / 四声 / 三拼(含 ü 介母)/ ü 去点规则各至少有一关;旧 37 关一关不删,`Level.id` 一个不改。

**Architecture:** 分两批提交,把「改机制」与「改数据」的故障面切开。**批一**只动结构(`taughtBlocks` 派生池替代序号硬编码阈值 / `Level.review` / `hintFor` 第三参 / `cap` 一行 / `HINT_BY_UNIT` 12 条 / 新增 `spell()`),课程数据仍是旧的 37 关,全部测试保持绿 —— 批一的价值在拿新写的 `spell()` 去验**旧的手写数据**。**批二**换 `levels.ts` 的数据、补覆盖矩阵守卫、加 ü 两点飞走动画、同步文档与走查。

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind 4 + Vitest(jsdom);无新依赖,无后端改动,无迁移。

**Spec:** `docs/superpowers/specs/2026-09-27-pinyin-curriculum-expansion-design.md`

## Global Constraints

以下每条都对本计划的**每一个任务**生效,不再逐任务重复:

- **wrangler 命令一律显式 `--config wrangler.toml`**(本计划不跑任何 wrangler 命令)。
- **禁止 `[env.production]`**;生产 = 默认 env。本计划**零后端改动、零迁移**。
- **不做数据库迁移**:99 关 id 的格式 `/^u\d+-\d+$/` 不变 → `worker/pinyin-progress.ts` 的 `readStars` 与 `src/features/pinyin-progress/local-store.ts` 的副本校验**都不用改**。
- **改用户可见行为(样式 / 布局 / 手势 / 动画 / 文案 / 持久化 / 发音)= 同一个提交里必须同时更新 `docs/walkthrough.md`。** 本计划 Task 6、Task 7 各有一条。
- **`npm test` 必须绿**(`src/architecture.test.ts` 守 3 层边界与注册纪律)。每个任务结束时全量绿,不许把红留给下一个任务。
- **依赖精简**:不新增任何 npm 依赖。**UI 文案中文**;**CSS 禁颜色字面量**(唯一例外 = `rgb(255 255 255 / x)` 白色高光),一律走 token + `color-mix`。
- **`useService()` 只在 page feature 的 `<Name>Entry.tsx` 与 `app/` 内**;服务注册只在 `src/app/bootstrap.ts`。本计划两条都不碰。
- **提交只在每个任务末尾发生**;每个任务是**一个可独立回退的提交**。分支:本计划在 topic 分支上执行(见下方「开工前置」)。
- **`Level.read` 必须是与 `pinyin` 同音的汉字**(系统 TTS 拿到拉丁串会逐字母念);每个音节的 `read` 恰好一个字。
- **块显式写死,不由拼音串反推**;新数据一律手写。
- **`docs/superpowers/specs/` 是详设唯一位置**;本计划不改 spec 文件(六处与 spec 的偏差已在文末「与 spec 的偏差」登记)。

### 开工前置(产品/调度面,不由本计划执行)

1. **分支**:从 `main` 切 topic 分支 + worktree(仓库规则:大 plan 走 topic 分支)。分支名建议 `feat/pinyin-curriculum-expansion`。
2. **⛔ 串行红线**:PLAN 上的 `P0`「特效零文本化 + 地图徽章栏」同改布局面。本计划**不修改 `UnitMap.tsx` 的任何一行**,冲突只发生在**人眼走查**上:
   - 若徽章栏**尚未落地**,Task 7 的 `W-X1`(12 格宽度复核)必须在徽章栏落地后**重跑一次**(spec §10.1:反序则徽章栏的窄屏预算要在 12 格下重算)。
   - 若徽章栏**已落地**,`W-X1` 一次跑完成立。
   - 执行者开工前须先看一眼 `src/features/pinyin-blocks/UnitMap.tsx` 里有没有徽章行,并在 Task 7 的提交信息里写明当时的状态。

---

## File Structure

| 文件 | 本计划对它做什么 |
|---|---|
| `src/features/pinyin-blocks/levels.ts` | 加 `taughtBlocks` / `losesDots` / `writeSyllable` / `spellSyllable` / `spell`;`Level` 加 `review?`;`UNITS` 换成 12 单元 91 关。**唯一的数据真源** |
| `src/features/pinyin-blocks/blocks.ts` | 删 `poolFor`;加 `Ü_DROP_INITIALS`;`WELD_INITIALS` 加 `'w'`;`HINT_BY_UNIT` 改 12 条;`hintFor` 加第三参 |
| `src/features/pinyin-blocks/rules.ts` | `buildBlocks` 里池来源改 `taughtBlocks`、`cap` 一行加复习关 |
| `src/features/pinyin-blocks/PinyinBlocksGame.tsx` | `hintFor` 调用点补第三参;`renderSlot` 给 `BlockChip` 传 `dotsAway` |
| `src/features/pinyin-blocks/BlockChip.tsx` | 加 `dotsAway?: boolean`,渲染去点后的字形 + 两点 |
| `src/index.css` | 加 `.pb-glyph` / `.pb-dot` / `@keyframes pb-dots-away`(拼音积木材质段内) |
| `src/features/pinyin-blocks/levels.test.ts` | 池守卫换成「池只增不减」;`HINT_BY_UNIT` 12 格逐格钉死;新增 G1–G7、G9 与前段约束守卫 |
| `src/features/pinyin-blocks/rules.test.ts` | 取关改按 id;池断言用独立重算的 `seenIn`;`cap` 公式跟着改;新增 G8 |
| `src/app/content-constants.test.ts` | 「7 单元 / 37 关」→「12 单元 / 91 关」 |
| `src/features/api/api.test.ts` | 一行注释里的「37 个,u1-0 … u7-4」 |
| `README.md` / `CLAUDE.md` / `docs/dev-reference.md` / `docs/PLAN.md` | 单元序列与关数口径 |
| `docs/walkthrough.md` | 新增 W-X1~W-X7 |

**不改**:`src/features/pinyin-blocks/index.ts`(公共面无新导出 —— 新函数都在 feature 内部被同目录文件与同目录测试消费)、`worker/`、`migrations/`、任何 feature 的 `index.ts`。

---

# 批一 · 结构(课程数据不动,全部测试保持绿)

---

### Task 1: 块池改从课程数据派生,删 `poolFor`

**Files:**
- Modify: `src/features/pinyin-blocks/levels.ts`(在 `UNITS` 之后追加 `syllableBlocks` + `taughtBlocks`)
- Modify: `src/features/pinyin-blocks/blocks.ts:69-88`(删整个「单元解锁表」段)
- Modify: `src/features/pinyin-blocks/rules.ts:4`、`rules.ts:115-125`
- Test: `src/features/pinyin-blocks/levels.test.ts:54-66`
- Test: `src/features/pinyin-blocks/rules.test.ts:2`、`rules.test.ts:143-155`、`rules.test.ts:259-277`

**Interfaces:**
- Consumes: 无(本任务是最底层)
- Produces:
  - `levels.ts` → `export function taughtBlocks(unitIndex: number): readonly Block[]` —— 「第 `unitIndex` 单元(含)及之前课程里出现过的全部块,不含声调块」。`rules.ts` 与两个测试文件消费。
  - `blocks.ts` → `poolFor` **不再存在**。任何地方引用它都是编译错误。

- [ ] **Step 1: 先改测试,让它红**

打开 `src/features/pinyin-blocks/levels.test.ts`,把 `import { … poolFor … } from './blocks'` 一行里的 `poolFor` 删掉,并把 `import { UNITS, type Level, type Syllable } from './levels'` 改成:

```ts
import { UNITS, taughtBlocks, type Level, type Syllable } from './levels'
```

然后把 `levels.test.ts:54-66` 那一整条用例**整条换成**:

```ts
  // 原来这条是「每个块都在该单元**硬编码的**解锁池里」。池改成从课程数据派生之后,
  // 它变成了同义反复(池就是课程自己),故换成它真正在守的那半条性质:
  // 池只增不减 —— 后面的单元一定收得下前面单元出过的每一个块。
  it('块池只增不减:后一单元一定包含前一单元出过的全部块', () => {
    const keys = (unit: number): string[] => taughtBlocks(unit).map((b) => `${b.type}:${b.value}`)
    for (let unit = 1; unit < UNITS.length; unit++) {
      for (const key of keys(unit - 1)) {
        expect(keys(unit), `u${unit + 1} 的池丢了 ${key}`).toContain(key)
      }
    }
  })
```

打开 `src/features/pinyin-blocks/rules.test.ts`,把 `import { TONE_VALUES, poolFor, type Block } from './blocks'` 改成:

```ts
import { TONE_VALUES, type Block } from './blocks'
```

并把 `import { UNITS } from './levels'` 改成:

```ts
import { UNITS, taughtBlocks } from './levels'
```

然后在文件顶部 `const slot = …` 之前插入这个**独立重算**的辅助函数(故意不复用 `taughtBlocks` —— 拿被测代码当判据,断言永远绿):

```ts
/**
 * 该单元及之前课程里出现过的某类块值 —— **独立于 `levels.ts` 的 `taughtBlocks` 重算一遍**。
 * 拿被测代码当判据的断言永不会红,所以这里宁可多写十行。
 */
function seenIn(type: Block['type'], unit: number): string[] {
  const out = new Set<string>()
  for (const u of UNITS.slice(0, unit + 1)) {
    for (const level of u.levels) {
      for (const s of level.syl) {
        if (type === 'initial' && s.initial !== undefined) out.add(s.initial)
        if (type === 'medial' && s.medial !== undefined) out.add(s.medial)
        if (type === 'final' && s.final !== undefined) out.add(s.final)
        if (type === 'nasal' && s.nasal !== undefined) out.add(s.nasal)
      }
    }
  }
  return [...out]
}
```

把 `rules.test.ts` 里两处 `poolFor(...)` 换成 `seenIn(...)`:

```ts
// 第 151 行附近(用例「干扰块只从该单元已解锁的池子里取」)
          expect(seenIn(block.type, unit), `${level.pinyin} 干扰块 ${key}`).toContain(block.value)
```

```ts
// 第 269 行附近(用例「只要题面类型还有未用的同类块,托盘就该给出干扰」)
            seenIn(b.type, unit)
```

- [ ] **Step 2: 跑测试确认变红**

```bash
npx vitest run src/features/pinyin-blocks
```

Expected: FAIL —— `levels.ts` 没有导出 `taughtBlocks`(`SyntaxError: The requested module './levels' does not provide an export named 'taughtBlocks'`),且 `rules.ts` 仍在 import 已删除的 `poolFor`… 此刻 `poolFor` **还没删**,所以只会看到 `taughtBlocks` 这一条。两个测试文件报「does not provide an export named 'taughtBlocks'」。

- [ ] **Step 3: 在 `levels.ts` 里实现 `taughtBlocks`**

在 `levels.ts` 顶部 import 改成(原来只 import 了 `type Block`):

```ts
import type { Block } from './blocks'
```

在 `UNITS` 数组**之后**追加:

```ts
/* ------------------------------------------------------------ 解锁池(派生) */

/** 一个音节用到的块(不含声调块),顺序 = 块面顺序。 */
function syllableBlocks(syl: Syllable): Block[] {
  const out: Block[] = []
  if (syl.initial !== undefined) out.push({ type: 'initial', value: syl.initial })
  if (syl.medial !== undefined) out.push({ type: 'medial', value: syl.medial })
  if (syl.final !== undefined) out.push({ type: 'final', value: syl.final })
  if (syl.nasal !== undefined) out.push({ type: 'nasal', value: syl.nasal })
  return out
}

/**
 * 到第 unitIndex 单元(含)为止,课程里出现过的全部块。**干扰块的唯一来源**。
 *
 * 从课程数据派生,不按单元序号硬编码阈值:「哪个单元教什么」只有本文件知道,
 * 池子在 `blocks.ts` 再写一份必然漂移。语义正好是「只出孩子见过的块」。
 */
export function taughtBlocks(unitIndex: number): readonly Block[] {
  const seen = new Map<string, Block>()
  for (const unit of UNITS.slice(0, unitIndex + 1)) {
    for (const level of unit.levels) {
      for (const syl of level.syl) {
        for (const block of syllableBlocks(syl)) seen.set(`${block.type}:${block.value}`, block)
      }
    }
  }
  return [...seen.values()]
}
```

> 复习关「混合前面单元的块」不需要额外字段:`taughtBlocks(unit)` 天然是**累积**的,复习关作为单元末关,拿到的池子本来就混了前面所有单元的块。数据里多写一个 `mix: true` 之类,只会变成又一个会和池子漂移的手写副本。

- [ ] **Step 4: 删 `poolFor`,让 `rules.ts` 改用 `taughtBlocks`**

`blocks.ts:69-88` 那一段(注释 `/* ------- 单元解锁表 */` 到 `poolFor` 的函数体结束)**整段删除**。

`rules.ts:4` 改成:

```ts
import { DUAL_VALUES, TONE_VALUES, type Block, type BlockType } from './blocks'
import { taughtBlocks, type Level } from './levels'
```

(原来的 `import type { Level } from './levels'` 那一行**删掉**,合并进上面这行。)

`rules.ts:115-125` 的 `cursors` 构造改成:

```ts
  // 干扰块只从「该单元及之前课程里出现过的块」里取 —— 池子由课程数据派生,零硬编码。
  const taught = new Map<BlockType, string[]>()
  for (const block of taughtBlocks(unit)) {
    const values = taught.get(block.type)
    if (values) values.push(block.value)
    else taught.set(block.type, [block.value])
  }

  const cursors = new Map<BlockType, string[]>()
  for (const type of types) {
    const used = new Set(required.filter((b) => b.type === type).map((b) => b.value))
    cursors.set(
      type,
      shuffle(
        (taught.get(type) ?? []).filter((v) => !used.has(v)),
        rng,
      ),
    )
  }
```

**不要动 `buildBlocks` 的签名**(仍是 `buildBlocks(level: Level, unit: number, rng)`)—— `PinyinBlocksGame.tsx:91` 的调用点零改动。

- [ ] **Step 5: 跑测试确认全绿**

```bash
npx vitest run src/features/pinyin-blocks
```

Expected: PASS。特别确认这三条**都还在**:「块池只增不减」「干扰块只从该单元已解锁的池子里取」「只要题面类型还有未用的同类块,托盘就该给出干扰」。

- [ ] **Step 6: 全量测试 + 类型 + lint**

```bash
npm test && npm run build && npm run lint
```

Expected: 全绿。`build` 若报 `poolFor is not defined` / `has no exported member 'poolFor'`,说明还有引用点没清干净 —— 用 `npx tsc -b` 看完整清单。

- [ ] **Step 7: 提交**

```bash
git add src/features/pinyin-blocks/levels.ts src/features/pinyin-blocks/blocks.ts src/features/pinyin-blocks/rules.ts src/features/pinyin-blocks/levels.test.ts src/features/pinyin-blocks/rules.test.ts
git commit -m "refactor(pinyin-blocks): 干扰块池改从课程数据派生,删 poolFor"
```

---

### Task 2: `rules.test.ts` 取关改按存档 id,不再依赖顺序

**Files:**
- Test: `src/features/pinyin-blocks/rules.test.ts`(整份的取关方式;不改任何生产文件)

**Interfaces:**
- Consumes: `Level.id`(Task 1 之前就存在;本任务不改它)
- Produces: 测试内的 `byId(id)` / `unitIdxOf(id)` / `build(level, rng)` 三个辅助函数 —— 后续任务在同一文件里继续用它们

**为什么单独一个任务:** 批二会把 37 关挪进 12 个单元,`lv(4, 0)` 这种**按序号取关**的写法在批二会全部指错关(而且指错得很安静 —— 拿到的是「另一道存在的题」,断言照样跑)。这个任务把取关方式提前换成 id;**本任务不改数据**,所以它自己单独就能是绿的、可独立回退。

- [ ] **Step 1: 换掉取关辅助函数**

`rules.test.ts:27-30` 那四行:

```ts
const lv = (unit: number, index: number) => UNITS[unit]!.levels[index]!
const GUĀ = lv(4, 0) // 🍉 guā = g + 介母 u + a
const ZHĪ = lv(5, 0) // 🕷️ zhī = zh + i(焊死)
const XĪGUĀ = lv(6, 0) // 🍉 xī guā = 双音节
```

**整段换成**:

```ts
/** 按存档键取关。关卡顺序会变,**id 不会** —— 按序号取关在挪关后会静默指错题。 */
function byId(id: string): Level {
  for (const u of UNITS) for (const level of u.levels) if (level.id === id) return level
  throw new Error(`没有这一关:${id}`)
}

/** 关所属单元的下标 —— `buildBlocks` 要它。 */
function unitIdxOf(id: string): number {
  const index = UNITS.findIndex((u) => u.levels.some((level) => level.id === id))
  if (index < 0) throw new Error(`没有这一关:${id}`)
  return index
}

/** `buildBlocks` 的单元下标参数一律由关卡自己的 id 推 —— 测试里不再手写「第几个单元」。 */
const build = (level: Level, rng: Rng) => buildBlocks(level, unitIdxOf(level.id), rng)

const GUĀ = byId('u5-0') // 🍉 guā = g + 介母 u + a
const ZHĪ = byId('u6-0') // 🕷️ zhī = zh + i(焊死)
const XĪGUĀ = byId('u7-0') // 🍉 xī guā = 双音节
```

同时把 `import { UNITS } from './levels'`(第 3 行)改成:

```ts
import { UNITS, type Level } from './levels'
```

- [ ] **Step 2: 把所有内联的 `lv(a, b)` 调用点改成 `byId('...')`**

只有**内联在用例里**的 `lv(...)` 需要换(带名字的 `GUĀ` / `ZHĪ` / `XĪGUĀ` 已经在 Step 1 换掉了,它们在用例里的引用**一个都不用动**):

| 现在(行号) | 改成 | 那一关的题面(核对用) |
|---|---|---|
| `slotsFor(lv(4, 2))`(L37) | `slotsFor(byId('u5-2'))` | 🐻 xióng |
| `slotsFor(lv(5, 4))`(L43) | `slotsFor(byId('u6-4'))` | 🐟 yú |
| `slotsFor(lv(2, 2))`(L49) | `slotsFor(byId('u3-2'))` | ❤️ ài |
| `lv(6, 2)`(L102) | `byId('u7-2')` | 🥛 niú nǎi |
| `lv(6, 4)`(L106) | `byId('u7-4')` | 🌸 huā duǒ |
| `lv(2, 5)`(L113) | `byId('u3-5')` | 🐢 guī |
| `lv(6, 2).syl[0]!`(L116) | `byId('u7-2').syl[0]!` | 🥛 niú(**保留 `.syl[0]!`**) |
| `slotsFor(lv(1, 3))`(L225) | `slotsFor(byId('u2-3'))` | 🍐 lí |

换完 `npx vitest run src/features/pinyin-blocks/rules.test.ts` 应**全绿**(这批 id 在旧数据里都指向同一关)。

- [ ] **Step 3: 把直接调 `buildBlocks(..., 常数, ...)` 的两处改用 `build`**

L134(`describe('buildBlocks')` 第一条用例):

```ts
// 原来:const blocks = buildBlocks(GUĀ, 4, seq([0.1, 0.7, 0.3, 0.9]))
    const blocks = build(GUĀ, seq([0.1, 0.7, 0.3, 0.9]))
```

L169-175(`双音节题不超上限`):

```ts
  it('双音节题不超上限(块数不炸)', () => {
    const unit = unitIdxOf('u7-0') // 双音节单元 —— 批二之后 UNITS[6] 不再是它
    for (const level of UNITS[unit]!.levels) {
      expect(build(level, seq([0.5])).length).toBeLessThanOrEqual(
        requiredBlocks(level).length + toneBlocks(level).length + 2,
      )
    }
  })
```

**其余 `buildBlocks(level, unit, ...)` 一律不动** —— L147、L160、L244、L263 都在 `for (let unit = 0; unit < UNITS.length; unit++)` 里按数据实际结构遍历,循环里的 `unit` 就是它们该用的值(同一文件里的 `seenIn(…, unit)` 也用同一个 `unit`,必须对齐)。

- [ ] **Step 4: 跑测试确认全绿**

```bash
npx vitest run src/features/pinyin-blocks/rules.test.ts
```

Expected: PASS,**一条不少**(与改动前同样的用例数)。

- [ ] **Step 5: 提交**

```bash
git add src/features/pinyin-blocks/rules.test.ts
git commit -m "test(pinyin-blocks): rules 测试改按存档 id 取关,不再依赖单元顺序"
```

---

### Task 3: 复习关 —— `Level.review` 字段 + 提示第三参 + `cap` 一行 + `HINT_BY_UNIT` 12 条

**Files:**
- Modify: `src/features/pinyin-blocks/levels.ts:18-33`(`Level` 类型)
- Modify: `src/features/pinyin-blocks/blocks.ts:100-126`(`HINT_BY_UNIT` + `hintFor`)
- Modify: `src/features/pinyin-blocks/rules.ts:113`(`cap`)
- Modify: `src/features/pinyin-blocks/PinyinBlocksGame.tsx:115`
- Test: `src/features/pinyin-blocks/levels.test.ts:186-193`(换成 12 格)与两条新用例
- Test: `src/features/pinyin-blocks/rules.test.ts:161`(cap 公式)

**Interfaces:**
- Consumes: `taughtBlocks`(Task 1)
- Produces:
  - `Level.review?: boolean` —— 只记语义,不记提示档与干扰块数
  - `hintFor(unitId: string, missCount: number, review = false): Hint` —— 第三参可选,老调用点仍然编译得过
  - `HINT_BY_UNIT` 12 条

- [ ] **Step 1: 写失败的测试**

`levels.test.ts:186-193` 那一整条用例**整条换成**(表从 7 格变 12 格;档位边界随课程重排):

```ts
  // 撤档的**位置**是产品决策(哪几个单元还看得见颜色),不是实现细节 —— 钉边界,不抄整张表。
  // 到最后一关还全染色,颜色就成了拐杖;这也是唯一挡得住「整张表被改成全 strong」的东西。
  // 每个档位钉住**两格**(首格 + 末格):留一个能自由改的格子,档位边界就会被静默挪走
  // (中档缩成只剩 u5 一关也算「中档」)。末行钉格数,防止偷偷多一格少一格。
  it('脚手架逐段撤走:强档到 u4,中档到 u8,末四关不许再有颜色', () => {
    for (const id of ['u1', 'u2', 'u3', 'u4']) expect(HINT_BY_UNIT[id], `${id} 该是强档`).toBe('strong')
    for (const id of ['u5', 'u6', 'u7', 'u8']) expect(HINT_BY_UNIT[id], `${id} 该是中档`).toBe('mid')
    for (const id of ['u9', 'u10', 'u11', 'u12']) expect(HINT_BY_UNIT[id], `${id} 该是弱档`).toBe('weak')
    expect(Object.keys(HINT_BY_UNIT), '表的格数').toHaveLength(12)
  })
```

在同一文件末尾(`表里没有的单元 id 兜底强档`那条之后、`})` 之前)追加两条:

```ts
  // 复习关是难度的另一半:提示档不参与单元基线表,恒弱(连错 2 次的救急强档除外)。
  // 漏改 `PinyinBlocksGame.tsx` 的第三参时 review 恒为 false,复习关会**静默**用单元基线 ——
  // 这条就是为那一类静默失败设的。
  it('复习关的提示恒为弱档,除非连错 2 次', () => {
    for (const u of UNITS) {
      expect(hintFor(u.id, 0, true), `${u.id} 复习关该是弱档`).toBe('weak')
      expect(hintFor(u.id, 1, true), `${u.id} 复习关错一次仍是弱档`).toBe('weak')
      expect(hintFor(u.id, 2, true), `${u.id} 连错 2 次要回强档`).toBe('strong')
    }
  })

  // 复习关的数据里只有语义(`review: true`),位置与数量都得是真的:
  // 漏标 = 这一单元没有复习关;标错位置 = 孩子还没学完就先考。
  it('每单元最后一关是复习关,且每单元恰好一个', () => {
    for (const u of UNITS) {
      const reviews = u.levels.filter((level) => level.review === true)
      expect(reviews, `${u.id} 的复习关数`).toHaveLength(1)
      expect(u.levels.at(-1)?.review, `${u.id} 的复习关不在最后一关`).toBe(true)
    }
  })
```

`rules.test.ts:161` 的 cap 公式跟着加复习关那一档:

```ts
        const cap = level.review ? 5 : level.syl.length > 1 ? 2 : unit <= 1 ? 2 : 3
```

- [ ] **Step 2: 跑测试确认变红**

```bash
npx vitest run src/features/pinyin-blocks
```

Expected: FAIL —— 「脚手架逐段撤走」报 `expected undefined to be 'mid'`(u5/u6/u7/u8 今天分别是 mid/mid/weak/undefined);「复习关的提示恒为弱档」报 `expected 'strong' to be 'weak'`;「每单元最后一关是复习关」报 `expected 0 to have length 1`。

- [ ] **Step 3: 给 `Level` 加 `review?`**

`levels.ts` 的 `Level` 类型,在 `readonly syl` 之后追加:

```ts
  /**
   * 复习关:本单元最后一关。数据里**只记语义** —— 提示档与干扰块数由 `blocks.ts` / `rules.ts`
   * 派生。把 `hint: 'weak'` 之类直接写进数据,产品口径一变就要逐关改 12 处。
   */
  readonly review?: boolean
```

- [ ] **Step 4: `HINT_BY_UNIT` 12 条 + `hintFor` 第三参**

`blocks.ts:100-126` 那一段**整段换成**:

```ts
/* ---------------------------------------------------------- 提示强度 */

/**
 * 空槽提示的三档。梯度是**染色深浅**,不是「染不染」——
 * 旧版 mid 与 weak 只差 2% 墨色,肉眼分不出,等于只有两档。
 */
export type Hint = 'strong' | 'mid' | 'weak'

/**
 * 每个单元的提示基线。脚手架随课程推进撤掉(u1-u4 强 → u5-u8 中 → u9-u12 弱),
 * 跟难度曲线同步,而不是孩子一进关就面对满屏颜色。
 * **复习关不参与这张表** —— 它恒弱(见 `hintFor`)。
 */
export const HINT_BY_UNIT: Readonly<Record<string, Hint>> = {
  u1: 'strong', u2: 'strong', u3: 'strong', u4: 'strong',
  u5: 'mid', u6: 'mid', u7: 'mid', u8: 'mid',
  u9: 'weak', u10: 'weak', u11: 'weak', u12: 'weak',
}

/**
 * 本关此刻的提示档。
 *
 * - 连错 2 次临时提到强档 —— 脚手架既要会撤,也要能回来。**优先于一切**,包括复习关。
 * - 复习关恒弱:难度靠「块多、池混、提示弱」三件事,不再靠新机制。
 * - 表里没有的单元 id 兜底强档(宁可多给线索,也不要让新单元变成一块灰砖)。
 */
export function hintFor(unitId: string, missCount: number, review = false): Hint {
  if (missCount >= 2) return 'strong'
  return review ? 'weak' : (HINT_BY_UNIT[unitId] ?? 'strong')
}
```

- [ ] **Step 5: `cap` 加复习关那一档**

`rules.ts:113` 改成:

```ts
  // 复习关的干扰块拉满 —— 难度的三件事之一(另两件:池天然混入前面单元的块、提示恒弱)。
  const cap = level.review ? 5 : level.syl.length > 1 ? 2 : unit <= 1 ? 2 : 3
```

- [ ] **Step 6: 补上唯一的调用点**

`PinyinBlocksGame.tsx:115` 改成:

```ts
  const hint = hintFor(unit.id, missCount, level.review)
```

**注意:`PinyinBlocksGame.tsx:91` 的 `buildBlocks(level, unitIdx, makeRng(round))` 一个字都不改**(签名没变)。

- [ ] **Step 7: 跑测试确认全绿**

```bash
npx vitest run src/features/pinyin-blocks
```

Expected: PASS。**此刻 `levels.ts` 里一个 `review: true` 都还没有**,但「每单元最后一关是复习关」那条**应该已经红了** —— 那正是预期的:它在等批二的数据。

等一下,这里是本计划**唯一**一处「测试在新数据到位前必红」。故本步骤的判定口径是:

```bash
npx vitest run src/features/pinyin-blocks -t "复习关"
```

Expected: **「复习关的提示恒为弱档」PASS**、**「每单元最后一关是复习关」FAIL**(报 `expected 0 to have length 1`)。

**为了不把红留给下一个任务**,把那第二条用例**先写成待批二启用的形态** —— 用 `it.skip`,并在名字前加标注:

```ts
  // ⏳ 批二启用:今天的数据里还没有任何 `review: true`,启用于 Task 5 末尾。
  it.skip('每单元最后一关是复习关,且每单元恰好一个', () => {
```

`it.skip` 的**启用**是 Task 5 的一个明确步骤。其余全部用例此时必须全绿。

```bash
npx vitest run
```

Expected: PASS(含 1 条 skip)。

- [ ] **Step 8: 提交**

```bash
git add src/features/pinyin-blocks/levels.ts src/features/pinyin-blocks/blocks.ts src/features/pinyin-blocks/rules.ts src/features/pinyin-blocks/PinyinBlocksGame.tsx src/features/pinyin-blocks/levels.test.ts src/features/pinyin-blocks/rules.test.ts
git commit -m "feat(pinyin-blocks): 复习关字段 + 提示第三参 + cap 拉满 + HINT_BY_UNIT 12 条"
```

---

### Task 4: `spell()` —— 把「显示串」与「结构」对起来(批一的主守卫)

**Files:**
- Modify: `src/features/pinyin-blocks/blocks.ts`(加 `Ü_DROP_INITIALS`)
- Modify: `src/features/pinyin-blocks/levels.ts`(加 `losesDots` / `writeSyllable` / `toneIndex` / `TONED` / `spellSyllable` / `spell`)
- Test: `src/features/pinyin-blocks/levels.test.ts`(新增 G1 与 `spellSyllable` 的单测)

**Interfaces:**
- Consumes: `Syllable` / `Level` / `UNITS`(既有)
- Produces:
  - `blocks.ts` → `export const Ü_DROP_INITIALS: ReadonlySet<string>` = `{'j','q','x','y'}`
  - `levels.ts` → `export function losesDots(initial: string | undefined, value: string): boolean` —— **全仓唯一去点判据**,Task 6 的渲染层复用它
  - `levels.ts` → `export function spellSyllable(syl: Syllable): string`
  - `levels.ts` → `export function spell(level: Level): string`

**为什么这是批一的主守卫:** `Level.pinyin`(屏幕上显示什么)与 `Level.syl`(孩子拼的是什么)是**两份手写数据,今天没有任何东西保证一致**。`pinyin: 'māo'` 配 `syl: [{final: 'ao', tone: 1}]` 能通过全部现有测试。37 关时是隐患,91 关手写数据下它会变成必然。**本任务拿新写的 `spell()` 去验现有那 37 关** —— 若红了,红的是旧数据的既有错误,必须在批二动数据之前知道。

- [ ] **Step 1: 写失败的测试**

`levels.test.ts` 的 import 改成:

```ts
import { UNITS, losesDots, spell, spellSyllable, taughtBlocks, type Level, type Syllable } from './levels'
```

在 `拼音积木关卡数据` 这个 `describe` 内部追加两条用例:

```ts
  // 本文件最值钱的一条。`pinyin`(显示串)与 `syl`(孩子拼的块)是两份手写数据,
  // 在此之前**没有任何东西保证一致** —— `pinyin: 'māo'` 配 `syl: [{final:'ao'}]` 会一路全绿,
  // 而孩子看到的拼音和积木拼出来的不是一回事。
  // 它同时也守住了标调位置:`niú` 若被标成 `níu`,spell 产出 `níu` 而 pinyin 写 `niú`,当场红。
  it('每关的 pinyin 与 syl 拼出来的一致', () => {
    for (const entry of allLevels) {
      expect(spell(entry.level), where(entry)).toBe(entry.level.pinyin)
    }
  })

  // 标调位置与 y/w 改写本身是知识点,给纯函数单测(逐条对应 spec §7.2 的规则)。
  it('spellSyllable:零声母改写、y 代劳 i、ü 去点、标调位置', () => {
    const syl = (s: Omit<Syllable, 'tone'> & { tone: Syllable['tone'] }): Syllable => ({ ...s })

    // 零声母:i / u / ü 单独作韵母 → yi / wu / yu;其余照抄
    expect(spellSyllable(syl({ final: 'i', tone: 3 }))).toBe('yǐ')
    expect(spellSyllable(syl({ final: 'u', tone: 3 }))).toBe('wǔ')
    expect(spellSyllable(syl({ final: 'ü', tone: 2 }))).toBe('yú')
    expect(spellSyllable(syl({ final: 'üe', tone: 4 }))).toBe('yuè')
    expect(spellSyllable(syl({ final: 'ai', tone: 4 }))).toBe('ài')
    expect(spellSyllable(syl({ final: 'er', tone: 2 }))).toBe('ér')

    // y 是零声母的写法:后面的 i 由它代劳,不写成 yie
    expect(spellSyllable(syl({ initial: 'y', final: 'ie', tone: 4 }))).toBe('yè')
    expect(spellSyllable(syl({ initial: 'y', final: 'i', tone: 1 }))).toBe('yī')
    expect(spellSyllable(syl({ initial: 'y', final: 'i', nasal: 'n', tone: 1 }))).toBe('yīn')
    expect(spellSyllable(syl({ initial: 'y', final: 'i', nasal: 'ng', tone: 1 }))).toBe('yīng')

    // j q x y 之后的 ü 去点;n l 之后保留
    expect(spellSyllable(syl({ initial: 'j', final: 'ü', tone: 2 }))).toBe('jú')
    expect(spellSyllable(syl({ initial: 'q', final: 'ü', nasal: 'n', tone: 2 }))).toBe('qún')
    expect(spellSyllable(syl({ initial: 'n', final: 'ü', tone: 3 }))).toBe('nǚ')
    expect(spellSyllable(syl({ initial: 'l', final: 'ü', tone: 4 }))).toBe('lǜ')
    expect(spellSyllable(syl({ initial: 'q', medial: 'ü', final: 'a', nasal: 'n', tone: 1 }))).toBe('quān')

    // 标调位置:有 a 标 a;没 a 而有 o/e 标它;i/u 并列标**后一个**;单个标自己
    expect(spellSyllable(syl({ initial: 'd', medial: 'u', final: 'o', tone: 3 }))).toBe('duǒ')
    expect(spellSyllable(syl({ initial: 'h', final: 'ei', tone: 1 }))).toBe('hēi')
    expect(spellSyllable(syl({ initial: 'n', final: 'iu', tone: 2 }))).toBe('niú')
    expect(spellSyllable(syl({ initial: 'g', final: 'ui', tone: 1 }))).toBe('guī')
    expect(spellSyllable(syl({ initial: 'x', final: 'i', tone: 1 }))).toBe('xī')
  })

  // 去点判据只此一处:渲染层的「两点飞走」与 spell 共用它,不许各写一份。
  it('losesDots:j q x y 之后去掉两点,n l 之后保留', () => {
    for (const head of ['j', 'q', 'x', 'y']) expect(losesDots(head, 'üe'), head).toBe(true)
    for (const head of ['n', 'l']) expect(losesDots(head, 'ü'), head).toBe(false)
    expect(losesDots(undefined, 'ü'), '零声母的 ü 走另一条规则(ü → yu)').toBe(false)
    expect(losesDots('j', 'a'), '不带 ü 的音节没有两点可去').toBe(false)
  })
```

> `tone: Syllable['tone']` 而不是写死 `1|2|3|4`:声调档位哪天变了,这个辅助函数跟着变。

- [ ] **Step 2: 跑测试确认变红**

```bash
npx vitest run src/features/pinyin-blocks/levels.test.ts
```

Expected: FAIL —— `does not provide an export named 'losesDots'`。

- [ ] **Step 3: `blocks.ts` 加 `Ü_DROP_INITIALS`**

在 `blocks.ts` 的 `WELD_INITIALS` 那一行**之后**追加:

```ts
/**
 * 拼上 ü 之后把两点带走的声母(去点规则)。
 * **全仓唯一判据** —— `levels.ts` 的 `spellSyllable` 与 `BlockChip` 的两点飞走共用它。
 */
export const Ü_DROP_INITIALS: ReadonlySet<string> = new Set(['j', 'q', 'x', 'y'])
```

同时把 `levels.ts` 的 import 改成:

```ts
import { Ü_DROP_INITIALS, type Block } from './blocks'
```

- [ ] **Step 4: `levels.ts` 实现拼写**

在 `taughtBlocks` **之后**追加:

```ts
/* ------------------------------------------------------------ 拼写(显示串) */

/**
 * j q x y 之后的 ü 去两点。
 *
 * **全仓唯一判据** —— `spellSyllable` 与 BlockChip 的「两点飞走」动画共用,
 * 渲染层不许再写一份(判据分家 = 屏幕上飞走的两点和答案行对不上)。
 */
export function losesDots(initial: string | undefined, value: string): boolean {
  return value.startsWith('ü') && initial !== undefined && Ü_DROP_INITIALS.has(initial)
}

/**
 * 块面串 → 拼音串。三条规则,**每条都是知识点本身**:
 *   1. 零声母:i / u / ü 单独作韵母时写成 yi / wu / yu(两点去掉)
 *   2. y / w 是零声母的**写法**,不是真声母:y 后面的 i 由它代劳(`{y, ie}` 写 ye,不写 yie)
 *   3. j q x y 之后的 ü 去两点(与渲染层的「两点飞走」同一个判据)
 */
function writeSyllable(head: string, body: string): string {
  if (head === '') {
    if (body.startsWith('ü')) return `y${body.replace('ü', 'u')}`
    if (body === 'i') return 'yi'
    if (body === 'u') return 'wu'
    return body
  }
  const spelled = losesDots(head, body) ? body.replace('ü', 'u') : body
  if (head === 'y' && spelled.startsWith('i') && spelled.length > 1) return `y${spelled.slice(1)}`
  return `${head}${spelled}`
}

/** ü 带调时两点保留(ǖ ǘ ǚ ǜ)—— 去点只由声母决定,与声调无关。 */
const TONED: Readonly<Record<string, readonly string[]>> = {
  a: ['ā', 'á', 'ǎ', 'à'],
  o: ['ō', 'ó', 'ǒ', 'ò'],
  e: ['ē', 'é', 'ě', 'è'],
  i: ['ī', 'í', 'ǐ', 'ì'],
  u: ['ū', 'ú', 'ǔ', 'ù'],
  ü: ['ǖ', 'ǘ', 'ǚ', 'ǜ'],
}

/**
 * 标调位置 —— 这条本身就是知识点:有 `a` 标 `a`;没 `a` 而有 `o`/`e` 就标它;
 * 都没有时 `i`/`u` 并列标**后一个**(`niú`、`guī`),单个韵母标自己。
 */
function toneIndex(plain: string): number {
  const a = plain.indexOf('a')
  if (a >= 0) return a
  const oe = plain.search(/[oe]/)
  if (oe >= 0) return oe
  const pair = plain.search(/[iuü][iuü]/)
  return pair >= 0 ? pair + 1 : plain.search(/[iuü]/)
}

/** 一个音节拼出来的带调拼音串。 */
export function spellSyllable(syl: Syllable): string {
  const plain = writeSyllable(syl.initial ?? '', `${syl.medial ?? ''}${syl.final ?? ''}`) + (syl.nasal ?? '')
  const at = toneIndex(plain)
  const marked = at >= 0 ? TONED[plain[at] as string]?.[syl.tone - 1] : undefined
  return marked === undefined ? plain : plain.slice(0, at) + marked + plain.slice(at + 1)
}

/** 一关的完整显示串:各音节空格分隔,与 `Level.pinyin` 同形。 */
export function spell(level: Level): string {
  return level.syl.map(spellSyllable).join(' ')
}
```

- [ ] **Step 5: 跑测试确认全绿 —— 这里是批一的判定点**

```bash
npx vitest run src/features/pinyin-blocks/levels.test.ts
```

Expected: PASS。**若「每关的 pinyin 与 syl 拼出来的一致」红了**:红的是**旧 37 关的既有错误**(这一批没动数据)。处置顺序:
1. 逐条看失败信息 —— 格式是 `u3-1: expected 'guī' to be 'gūi'` 之类。
2. 判据永远是 `syl` 对、`pinyin` 错(数据是答案,显示串是它的投影),除非 `syl` 本身写错了块。
3. 改 `levels.ts` 里那一关的 `pinyin`(或该关的 `syl`),**在这个任务的同一个提交里改** —— 它就是本任务要交付的东西之一。
4. 在本任务的提交信息末尾追加一行说明改了哪几关、为什么。

- [ ] **Step 6: 全量测试 + 类型 + lint(批一闸门)**

```bash
npm test && npm run build && npm run lint
```

Expected: 全绿;`npm test` 里恰有 1 条 skip(Task 3 的复习关位置用例,批二启用)。

- [ ] **Step 7: 提交**

```bash
git add src/features/pinyin-blocks/levels.ts src/features/pinyin-blocks/blocks.ts src/features/pinyin-blocks/levels.test.ts
git commit -m "feat(pinyin-blocks): 新增 spell() 守住 pinyin 与 syl 一致(批一收口)"
```

---

# 批二 · 内容

> 批一跑完后,「机制」这一侧已全部就位且对旧数据验证过。批二若出问题(某关例字放不进池、`spell` 对不上),红的是**数据**,不是机制。

---

### Task 5: 课程换成 12 单元 / 91 关

**Files:**
- Modify: `src/features/pinyin-blocks/levels.ts`(`UNITS` 整段替换;顶部注释改写)
- Modify: `src/features/pinyin-blocks/blocks.ts:67`(`WELD_INITIALS` 加 `'w'`)
- Test: `src/features/pinyin-blocks/levels.test.ts`(新增**覆盖矩阵 G2–G6** + 前段约束;启用 Task 3 的 `it.skip`)
- Test: `src/features/pinyin-blocks/rules.test.ts`(新增 **G8**)
- Test: `src/app/content-constants.test.ts:31-39`
- Test: `src/features/api/api.test.ts:153`

**Interfaces:**
- Consumes: `spell` / `spellSyllable` / `losesDots` / `taughtBlocks`(Task 1、4)、`Level.review`(Task 3)
- Produces: 12 个 `Unit`、91 个 `Level`,id 沿用旧 37 个 + 54 个新 id(一律 50 段)

**为什么这一个任务这么大、不再拆:** 覆盖矩阵守卫(G2–G6)只有在新数据到位后才可能绿,而仓库规则是「每个任务结束时 `npm test` 全绿」。把守卫与数据拆成两个提交,中间那次提交必然红。所以本任务内部仍按 TDD 走(先写守卫 → 红 → 换数据 → 绿),但**交付边界是这一个提交**。

- [ ] **Step 1: 写失败的守卫(覆盖矩阵 G2–G6 + 前段约束)**

`levels.test.ts` 的 import 改成:

```ts
import {
  FINAL_BASIC,
  FINAL_COMPOUND,
  HINT_BY_UNIT,
  INITIALS_ALL,
  MEDIALS,
  NASALS,
  TONE_VALUES,
  WELD_INITIALS,
  hintFor,
  speakOf,
} from './blocks'
import { UNITS, losesDots, spell, spellSyllable, taughtBlocks, type Level, type Syllable } from './levels'
```

在 `where(...)` 之后追加:

```ts
/** 全课程的音节摊平 —— 覆盖矩阵那几条守卫共用。 */
const allSyls = allLevels.flatMap((entry) => entry.level.syl.map((syl) => ({ ...entry, syl })))

/** 16 个整体认读的**不带调**写法(汉语拼音方案的固定表)。 */
const WELD_SYLLABLES = [
  'zhi', 'chi', 'shi', 'ri', 'zi', 'ci', 'si',
  'yi', 'wu', 'yu', 'ye', 'yue', 'yuan', 'yin', 'yun', 'ying',
] as const

/** 去掉调号 —— 整体认读表按不带调的写法数。 */
const TONE_MARKS: Readonly<Record<string, string>> = {
  ā: 'a', á: 'a', ǎ: 'a', à: 'a',
  ē: 'e', é: 'e', ě: 'e', è: 'e',
  ī: 'i', í: 'i', ǐ: 'i', ì: 'i',
  ō: 'o', ó: 'o', ǒ: 'o', ò: 'o',
  ū: 'u', ú: 'u', ǔ: 'u', ù: 'u',
  ǖ: 'ü', ǘ: 'ü', ǚ: 'ü', ǜ: 'ü',
}

const stripTone = (s: string): string => [...s].map((c) => TONE_MARKS[c] ?? c).join('')
```

在 `拼音积木关卡数据` 这个 `describe` 末尾(`表里没有的单元 id 兜底强档`之后)追加:

```ts
  /* ------------------------------------------------ 覆盖矩阵(spec §4) */

  it('G2:23 个声母全部教到', () => {
    const taught = new Set(allSyls.map((e) => e.syl.initial).filter((v) => v !== undefined))
    for (const p of INITIALS_ALL) expect(taught, `声母 ${p} 一关都没出现过`).toContain(p)
  })

  it('G3:韵母全表教到(单韵母 / 复韵母 / er / 前鼻 / 后鼻)', () => {
    const finals = new Set(allSyls.map((e) => e.syl.final).filter((v) => v !== undefined))
    for (const v of FINAL_BASIC) expect(finals, `单韵母 ${v}`).toContain(v)
    for (const v of FINAL_COMPOUND) expect(finals, `复韵母 / 特殊韵母 ${v}`).toContain(v)

    // 鼻韵母按「韵腹 + 鼻尾」判:an en in un ün 与 ang eng ing ong 都得有。
    const nasalized = new Set(
      allSyls
        .filter((e) => e.syl.nasal !== undefined)
        .map((e) => `${e.syl.final}${e.syl.nasal}`),
    )
    for (const v of ['an', 'en', 'in', 'un', 'ün', 'ang', 'eng', 'ing', 'ong']) {
      expect(nasalized, `鼻韵母 ${v}`).toContain(v)
    }
  })

  // 四声是知识点,不是配色 —— 每一调都得在课程里出现过,且字母上真的带对了调号
  // (带错调的 `pinyin` 会被 G1 抓住,这里只管「四调齐不齐」)。
  it('G3b:四个声调全部教到', () => {
    const tones = new Set(allLevels.flatMap((e) => e.level.syl.map((s) => s.tone)))
    for (const t of TONE_VALUES) expect(tones, `第 ${t} 声一关都没出现过`).toContain(Number(t))
  })

  it('G4:16 个整体认读全部教到', () => {
    const spelled = new Set(
      allLevels.flatMap((e) => e.level.syl.map((s) => stripTone(spellSyllable(s)))),
    )
    for (const w of WELD_SYLLABLES) expect(spelled, `整体认读 ${w}`).toContain(w)
  })

  it('G5:ü 的三类结构各至少一关(去点 / 不去点 / 作介母)', () => {
    // 介母槽与韵母槽都可能是那个 ü(quān 在介母位、jú 在韵母位),两处都查。
    const drops = (s: Syllable): boolean =>
      losesDots(s.initial, s.medial ?? '') || losesDots(s.initial, s.final ?? '')

    expect(allSyls.filter((e) => drops(e.syl)).length, 'j q x y 之后去点的关').toBeGreaterThan(0)

    const keep = allSyls.filter(
      (e) => (e.syl.final ?? '').startsWith('ü') && !losesDots(e.syl.initial, e.syl.final ?? ''),
    )
    expect(keep.length, 'n l 之后保留两点的关').toBeGreaterThan(0)
    for (const e of keep) {
      expect(['n', 'l'], `${where(e)} 保留两点该只在 n / l 之后`).toContain(e.syl.initial)
    }

    expect(allSyls.filter((e) => e.syl.medial === 'ü').length, 'ü 作介母的三拼关').toBeGreaterThan(0)
  })

  // G8 写在 `rules.test.ts`(它比的是干扰块的数量机制,那里已有 `buildBlocks` / `seenIn` / `seq`)。

  it('G6:每单元最后一关是复习关,且每单元恰好一个', () => {
    for (const u of UNITS) {
      const reviews = u.levels.filter((level) => level.review === true)
      expect(reviews, `${u.id} 的复习关数`).toHaveLength(1)
      expect(u.levels.at(-1)?.review, `${u.id} 的复习关不在最后一关`).toBe(true)
    }
  })

  // spec §3.3 的硬约束:课程最前只有 a o e i u 五个韵母可用(复韵母到 u5、鼻尾到 u6/u7 才教)。
  // 派生池兜得住「不出现没教过的块」,兜不住「孩子还没学到那个韵母就先用了它」——
  // 池是按单元**累积**的,累积到哪一单元为止才决定孩子见没见过。
  it('u1–u4 的例字只用单韵母,不带鼻尾', () => {
    for (const unit of UNITS.filter((u) => ['u1', 'u2', 'u3', 'u4'].includes(u.id))) {
      for (const level of unit.levels) {
        for (const syl of level.syl) {
          expect(FINAL_BASIC, `${level.id} 用了 ${syl.final}`).toContain(syl.final)
          expect(syl.nasal, `${level.id} 用了鼻尾 ${syl.nasal}`).toBeUndefined()
        }
      }
    }
  })
```

`rules.test.ts` 的 `describe('buildBlocks')` 末尾(「双音节题不超上限」**之后**)追加 G8(它用的 `buildBlocks` / `seenIn` / `seq` / `Level` 在这个文件里现成):

```ts
  // G8。「复习关更难」这条承诺的两个半边:干扰块**真的更多**,且**没有越过池子** ——
  // 为了凑数掏出没教过的块,孩子就得在一块他从没见过的积木上做选择。
  // 同一个 rng、同一道题面,只翻 `review` 一位对比 —— 比的是机制,不是某个具体数字。
  it('复习关的干扰块比同题面非复习时多,且仍全部来自已教过的池', () => {
    const seed = seq([0.11, 0.29, 0.53, 0.77])
    for (const [unit, u] of UNITS.entries()) {
      for (const level of u.levels) {
        if (level.review !== true) continue
        const solution = solutionValues(level)
        const extras = (lvl: Level): Block[] =>
          buildBlocks(lvl, unit, seed).filter((b) => b.type !== 'tone' && !solution.has(`${b.type}:${b.value}`))

        expect(extras(level).length, `${level.pinyin} 复习关没比普通关多干扰`).toBeGreaterThan(
          extras({ ...level, review: false }).length,
        )
        for (const b of extras(level)) {
          expect(seenIn(b.type, unit), `${level.pinyin} 干扰块 ${b.type}:${b.value} 没教过`).toContain(b.value)
        }
      }
    }
  })
```

同时把 Task 3 里那条 `it.skip('每单元最后一关是复习关,且每单元恰好一个', …)` **整条删掉**(它的内容已被上面的 G6 覆盖,留着就是两处同样的断言)。

`content-constants.test.ts:31-39` **整条换成**:

```ts
  it('课程 = 12 单元 / 91 关', () => {
    expect(UNITS, '单元数').toHaveLength(12)
    expect(
      UNITS.reduce((sum, unit) => sum + unit.levels.length, 0),
      '关数 = 各单元相加',
    ).toBe(91)
    // 每个单元至少一关:否则上面的「相加」可以靠一个空单元凑出来,而空单元在玩法里没有意义。
    for (const unit of UNITS) expect(unit.levels, `${unit.id} 的关卡`).not.toHaveLength(0)
  })
```

`api.test.ts:153` 那一行注释改成:

```ts
    // 两侧一起改错也得红:格式必须仍认真实关卡 id(91 个,u1-0 … u12-50)。
```

- [ ] **Step 2: 跑测试确认变红**

```bash
npx vitest run src/features/pinyin-blocks src/app/content-constants.test.ts
```

Expected: FAIL —— 覆盖矩阵几条全部红(G2 报 `声母 p 一关都没出现过`,G4 报 `整体认读 ye`,G3 报 `鼻韵母 ün`…),`content-constants` 报 `expected length 7 to be 12`。**G8 这时是绿的**:旧数据里一个 `review: true` 都没有,循环体一次都不进(它要等 Step 4 的数据才真正开始工作)。

- [ ] **Step 3: `WELD_INITIALS` 加 `'w'`**

`blocks.ts:66-67` 改成:

```ts
/**
 * 焊死的声母:它们拼上 i/u 之后读音不是「声母 + 衣/乌」,拼合时金箍焊成一体。
 * `y` / `w` 是零声母的写法(半元音),同样属于这一批 —— `yī`、`wū` 都是整体认读。
 */
export const WELD_INITIALS = ['zh', 'ch', 'sh', 'r', 'z', 'c', 's', 'y', 'w'] as const
```

- [ ] **Step 4: 换 `levels.ts` 的课程数据**

`levels.ts` 顶部的注释段(第 1-3 行)**整段换成**:

```ts
// 课程路径与关卡数据(纯数据)。
// 12 个单元由易到难:单韵母 → 声母·双唇舌尖 → 声母·舌根舌面 → 声母·翘舌平舌 → 复韵母
// → 前鼻韵母 → 后鼻韵母 → 三拼·介母 → ü 行韵母 → 整体认读·一 → 整体认读·二 → 双音节词。
// 每题的块**显式写死**,不由拼音串反推 —— 数据即答案,反推逻辑藏在解析器里出错更难查。
//
// ⚠ `id` 是存档键,**前缀不等于所属单元**:旧关沿用建关时的 0–6 段序号(如 `u2-4` 今天住在 u3),
// 新关一律从 50 起(`u5-50`、…)—— 两代键永不可能相撞。挪关不改 id。
```

`UNITS` 数组(第 44 行 `export const UNITS` 到它对应的 `]`)**整段替换为**(顺序即显示顺序;每个单元内:先旧关,后新关):

```ts
export const UNITS: readonly Unit[] = [
  {
    id: 'u1',
    name: '单韵母',
    badge: [{ type: 'final', value: 'a' }],
    levels: [
      { id: 'u1-0', emoji: '🪿', pinyin: 'é', read: '鹅', syl: [{ final: 'e', tone: 2 }] },
      { id: 'u1-1', emoji: '😮', pinyin: 'ó', read: '哦', syl: [{ final: 'o', tone: 2 }] },
      { id: 'u1-2', emoji: '🗣️', pinyin: 'à', read: '啊', syl: [{ final: 'a', tone: 4 }] },
      // i / u 不能单独作音节:零声母时写成 yi / wu。块面仍是 i / u,显示串是它们的改写。
      { id: 'u1-50', emoji: '🪑', pinyin: 'yǐ', read: '椅', syl: [{ final: 'i', tone: 3 }] },
      { id: 'u1-51', emoji: '✋', pinyin: 'wǔ', read: '五', syl: [{ final: 'u', tone: 3 }] },
      // 复习关:一轮 a o e i u 走完
      { id: 'u1-52', emoji: '😋', pinyin: 'è', read: '饿', syl: [{ final: 'e', tone: 4 }], review: true },
    ],
  },
  {
    id: 'u2',
    name: '声母 · 双唇舌尖',
    badge: [{ type: 'initial', value: 'b' }, { type: 'final', value: 'a' }],
    levels: [
      { id: 'u2-0', emoji: '👨', pinyin: 'bà', read: '爸', syl: [{ initial: 'b', final: 'a', tone: 4 }] },
      { id: 'u2-1', emoji: '🐴', pinyin: 'mǎ', read: '马', syl: [{ initial: 'm', final: 'a', tone: 3 }] },
      { id: 'u2-2', emoji: '🐰', pinyin: 'tù', read: '兔', syl: [{ initial: 't', final: 'u', tone: 4 }] },
      { id: 'u2-3', emoji: '🍐', pinyin: 'lí', read: '梨', syl: [{ initial: 'l', final: 'i', tone: 2 }] },
      { id: 'u2-50', emoji: '👵', pinyin: 'pó', read: '婆', syl: [{ initial: 'p', final: 'o', tone: 2 }] },
      { id: 'u2-51', emoji: '🪓', pinyin: 'fǔ', read: '斧', syl: [{ initial: 'f', final: 'u', tone: 3 }] },
      { id: 'u2-52', emoji: '🌍', pinyin: 'dì', read: '地', syl: [{ initial: 'd', final: 'i', tone: 4 }] },
      { id: 'u2-53', emoji: '😠', pinyin: 'nù', read: '怒', syl: [{ initial: 'n', final: 'u', tone: 4 }] },
      { id: 'u2-54', emoji: '✏️', pinyin: 'bǐ', read: '笔', syl: [{ initial: 'b', final: 'i', tone: 3 }], review: true },
    ],
  },
  {
    id: 'u3',
    name: '声母 · 舌根舌面',
    badge: [{ type: 'initial', value: 'g' }, { type: 'final', value: 'a' }],
    levels: [
      { id: 'u2-4', emoji: '🐔', pinyin: 'jī', read: '鸡', syl: [{ initial: 'j', final: 'i', tone: 1 }] },
      { id: 'u3-50', emoji: '🥁', pinyin: 'gǔ', read: '鼓', syl: [{ initial: 'g', final: 'u', tone: 3 }] },
      { id: 'u3-51', emoji: '😭', pinyin: 'kū', read: '哭', syl: [{ initial: 'k', final: 'u', tone: 1 }] },
      { id: 'u3-52', emoji: '🐯', pinyin: 'hǔ', read: '虎', syl: [{ initial: 'h', final: 'u', tone: 3 }] },
      { id: 'u3-53', emoji: '7️⃣', pinyin: 'qī', read: '七', syl: [{ initial: 'q', final: 'i', tone: 1 }] },
      { id: 'u3-54', emoji: '🛁', pinyin: 'xǐ', read: '洗', syl: [{ initial: 'x', final: 'i', tone: 3 }] },
      { id: 'u3-55', emoji: '🥤', pinyin: 'hē', read: '喝', syl: [{ initial: 'h', final: 'e', tone: 1 }], review: true },
    ],
  },
  {
    id: 'u4',
    name: '声母 · 翘舌平舌',
    badge: [{ type: 'initial', value: 'zh' }, { type: 'final', value: 'a' }],
    levels: [
      { id: 'u2-5', emoji: '🦶', pinyin: 'zú', read: '足', syl: [{ initial: 'z', final: 'u', tone: 2 }] },
      { id: 'u4-50', emoji: '🐷', pinyin: 'zhū', read: '猪', syl: [{ initial: 'zh', final: 'u', tone: 1 }] },
      { id: 'u4-51', emoji: '🚗', pinyin: 'chē', read: '车', syl: [{ initial: 'ch', final: 'e', tone: 1 }] },
      { id: 'u4-52', emoji: '📕', pinyin: 'shū', read: '书', syl: [{ initial: 'sh', final: 'u', tone: 1 }] },
      { id: 'u4-53', emoji: '🔥', pinyin: 'rè', read: '热', syl: [{ initial: 'r', final: 'e', tone: 4 }] },
      { id: 'u4-54', emoji: '🧽', pinyin: 'cā', read: '擦', syl: [{ initial: 'c', final: 'a', tone: 1 }] },
      { id: 'u4-55', emoji: '🎨', pinyin: 'sè', read: '色', syl: [{ initial: 's', final: 'e', tone: 4 }] },
      { id: 'u4-56', emoji: '🦆', pinyin: 'yā', read: '鸭', syl: [{ initial: 'y', final: 'a', tone: 1 }] },
      { id: 'u4-57', emoji: '🙋', pinyin: 'wǒ', read: '我', syl: [{ initial: 'w', final: 'o', tone: 3 }] },
      { id: 'u4-58', emoji: '📄', pinyin: 'zhǐ', read: '纸', syl: [{ initial: 'zh', final: 'i', tone: 3 }], review: true },
    ],
  },
  {
    id: 'u5',
    name: '复韵母',
    badge: [{ type: 'final', value: 'ai' }],
    levels: [
      { id: 'u3-0', emoji: '🐱', pinyin: 'māo', read: '猫', syl: [{ initial: 'm', final: 'ao', tone: 1 }] },
      { id: 'u3-1', emoji: '🐶', pinyin: 'gǒu', read: '狗', syl: [{ initial: 'g', final: 'ou', tone: 3 }] },
      { id: 'u3-2', emoji: '❤️', pinyin: 'ài', read: '爱', syl: [{ final: 'ai', tone: 4 }] },
      { id: 'u3-3', emoji: '⚫', pinyin: 'hēi', read: '黑', syl: [{ initial: 'h', final: 'ei', tone: 1 }] },
      { id: 'u3-4', emoji: '👟', pinyin: 'xié', read: '鞋', syl: [{ initial: 'x', final: 'ie', tone: 2 }] },
      { id: 'u3-5', emoji: '🐢', pinyin: 'guī', read: '龟', syl: [{ initial: 'g', final: 'ui', tone: 1 }] },
      // y + üe 拼出 yue(ü 去两点)—— 「两点飞走」动画的首演关,规则本身在块的拼合里显形
      { id: 'u6-5', emoji: '🌙', pinyin: 'yuè', read: '月', syl: [{ initial: 'y', final: 'üe', tone: 4, weld: true }] },
      // iu(← iou)是**独立韵母**,不是介母 + 韵母:拆成 i+ou 会拼出 niou
      { id: 'u5-50', emoji: '🐮', pinyin: 'niú', read: '牛', syl: [{ initial: 'n', final: 'iu', tone: 2 }] },
      // er 是特殊韵母:自成音节,永远不跟声母拼
      { id: 'u5-51', emoji: '👶', pinyin: 'ér', read: '儿', syl: [{ final: 'er', tone: 2 }] },
      { id: 'u5-52', emoji: '👍', pinyin: 'hǎo', read: '好', syl: [{ initial: 'h', final: 'ao', tone: 3 }], review: true },
    ],
  },
  {
    id: 'u6',
    name: '前鼻韵母',
    badge: [{ type: 'final', value: 'a' }, { type: 'nasal', value: 'n' }],
    levels: [
      { id: 'u4-0', emoji: '🚪', pinyin: 'mén', read: '门', syl: [{ initial: 'm', final: 'e', nasal: 'n', tone: 2 }] },
      { id: 'u4-1', emoji: '⛰️', pinyin: 'shān', read: '山', syl: [{ initial: 'sh', final: 'a', nasal: 'n', tone: 1 }] },
      { id: 'u6-50', emoji: '✉️', pinyin: 'xìn', read: '信', syl: [{ initial: 'x', final: 'i', nasal: 'n', tone: 4 }] },
      { id: 'u6-51', emoji: '🛞', pinyin: 'lún', read: '轮', syl: [{ initial: 'l', final: 'u', nasal: 'n', tone: 2 }] },
      { id: 'u6-52', emoji: '🍚', pinyin: 'fàn', read: '饭', syl: [{ initial: 'f', final: 'a', nasal: 'n', tone: 4 }], review: true },
    ],
  },
  {
    id: 'u7',
    name: '后鼻韵母',
    badge: [{ type: 'final', value: 'a' }, { type: 'nasal', value: 'ng' }],
    levels: [
      { id: 'u4-2', emoji: '🏡', pinyin: 'fáng', read: '房', syl: [{ initial: 'f', final: 'a', nasal: 'ng', tone: 2 }] },
      { id: 'u4-3', emoji: '🐉', pinyin: 'lóng', read: '龙', syl: [{ initial: 'l', final: 'o', nasal: 'ng', tone: 2 }] },
      { id: 'u4-4', emoji: '🌬️', pinyin: 'fēng', read: '风', syl: [{ initial: 'f', final: 'e', nasal: 'ng', tone: 1 }] },
      { id: 'u5-4', emoji: '👑', pinyin: 'wáng', read: '王', syl: [{ initial: 'w', final: 'a', nasal: 'ng', tone: 2 }] },
      { id: 'u7-50', emoji: '⭐', pinyin: 'xīng', read: '星', syl: [{ initial: 'x', final: 'i', nasal: 'ng', tone: 1 }] },
      { id: 'u7-51', emoji: '🐑', pinyin: 'yáng', read: '羊', syl: [{ initial: 'y', final: 'a', nasal: 'ng', tone: 2 }], review: true },
    ],
  },
  {
    id: 'u8',
    name: '三拼 · 介母',
    badge: [{ type: 'initial', value: 'g' }, { type: 'medial', value: 'u' }, { type: 'final', value: 'a' }],
    levels: [
      { id: 'u5-0', emoji: '🍉', pinyin: 'guā', read: '瓜', syl: [{ initial: 'g', medial: 'u', final: 'a', tone: 1 }] },
      { id: 'u5-1', emoji: '🐦', pinyin: 'niǎo', read: '鸟', syl: [{ initial: 'n', medial: 'i', final: 'ao', tone: 3 }] },
      { id: 'u5-2', emoji: '🐻', pinyin: 'xióng', read: '熊', syl: [{ initial: 'x', medial: 'i', final: 'o', nasal: 'ng', tone: 2 }] },
      { id: 'u5-3', emoji: '🍎', pinyin: 'guǒ', read: '果', syl: [{ initial: 'g', medial: 'u', final: 'o', tone: 3 }] },
      { id: 'u8-50', emoji: '⬇️', pinyin: 'xià', read: '下', syl: [{ initial: 'x', medial: 'i', final: 'a', tone: 4 }] },
      { id: 'u8-51', emoji: '💰', pinyin: 'qián', read: '钱', syl: [{ initial: 'q', medial: 'i', final: 'a', nasal: 'n', tone: 2 }] },
      { id: 'u8-52', emoji: '🪥', pinyin: 'shuā', read: '刷', syl: [{ initial: 'sh', medial: 'u', final: 'a', tone: 1 }], review: true },
    ],
  },
  {
    id: 'u9',
    name: 'ü 行韵母 · 两点去留',
    badge: [{ type: 'initial', value: 'j' }, { type: 'final', value: 'ü' }],
    levels: [
      // ü 行四个韵母(ü / üe / ün / üan)加两点去留两面:j q x 之后去点,n l 之后保留。
      { id: 'u9-50', emoji: '🍊', pinyin: 'jú', read: '橘', syl: [{ initial: 'j', final: 'ü', tone: 2 }] },
      { id: 'u9-51', emoji: '🚶', pinyin: 'qù', read: '去', syl: [{ initial: 'q', final: 'ü', tone: 4 }] },
      { id: 'u9-52', emoji: '❄️', pinyin: 'xuě', read: '雪', syl: [{ initial: 'x', final: 'üe', tone: 3 }] },
      // ün 只与 j q x y 相拼 → 永远是去点形态,故不放在 u6(前鼻),放在这里讲
      { id: 'u9-53', emoji: '👗', pinyin: 'qún', read: '裙', syl: [{ initial: 'q', final: 'ü', nasal: 'n', tone: 2 }] },
      // ü 作介母的三拼 —— 顺带兑现「三拼 ü 介母」这条覆盖缺口,不必另开单元
      { id: 'u9-54', emoji: '⭕', pinyin: 'quān', read: '圈', syl: [{ initial: 'q', medial: 'ü', final: 'a', nasal: 'n', tone: 1 }] },
      { id: 'u9-55', emoji: '👧', pinyin: 'nǚ', read: '女', syl: [{ initial: 'n', final: 'ü', tone: 3 }] },
      { id: 'u9-56', emoji: '🟩', pinyin: 'lǜ', read: '绿', syl: [{ initial: 'l', final: 'ü', tone: 4 }] },
      { id: 'u9-57', emoji: '🙌', pinyin: 'jǔ', read: '举', syl: [{ initial: 'j', final: 'ü', tone: 3 }], review: true },
    ],
  },
  {
    id: 'u10',
    name: '整体认读 · 一',
    badge: [{ type: 'initial', value: 'zh' }, { type: 'final', value: 'i' }],
    levels: [
      { id: 'u6-0', emoji: '🕷️', pinyin: 'zhī', read: '蜘', syl: [{ initial: 'zh', final: 'i', tone: 1, weld: true }] },
      { id: 'u6-1', emoji: '📏', pinyin: 'chǐ', read: '尺', syl: [{ initial: 'ch', final: 'i', tone: 3, weld: true }] },
      { id: 'u6-2', emoji: '🦁', pinyin: 'shī', read: '狮', syl: [{ initial: 'sh', final: 'i', tone: 1, weld: true }] },
      { id: 'u6-3', emoji: '🦔', pinyin: 'cì', read: '刺', syl: [{ initial: 'c', final: 'i', tone: 4, weld: true }] },
      { id: 'u10-50', emoji: '☀️', pinyin: 'rì', read: '日', syl: [{ initial: 'r', final: 'i', tone: 4, weld: true }] },
      { id: 'u10-51', emoji: '📝', pinyin: 'zì', read: '字', syl: [{ initial: 'z', final: 'i', tone: 4, weld: true }] },
      { id: 'u10-52', emoji: '4️⃣', pinyin: 'sì', read: '四', syl: [{ initial: 's', final: 'i', tone: 4, weld: true }] },
      { id: 'u10-53', emoji: '🔟', pinyin: 'shí', read: '十', syl: [{ initial: 'sh', final: 'i', tone: 2, weld: true }], review: true },
    ],
  },
  {
    id: 'u11',
    name: '整体认读 · 二',
    badge: [{ type: 'initial', value: 'y' }, { type: 'final', value: 'ü' }, { type: 'nasal', value: 'n' }],
    levels: [
      { id: 'u6-4', emoji: '🐟', pinyin: 'yú', read: '鱼', syl: [{ initial: 'y', final: 'ü', tone: 2, weld: true }] },
      { id: 'u6-6', emoji: '🦅', pinyin: 'yīng', read: '鹰', syl: [{ initial: 'y', final: 'i', nasal: 'ng', tone: 1, weld: true }] },
      { id: 'u11-50', emoji: '🧥', pinyin: 'yī', read: '衣', syl: [{ initial: 'y', final: 'i', tone: 1, weld: true }] },
      { id: 'u11-51', emoji: '🏠', pinyin: 'wū', read: '屋', syl: [{ initial: 'w', final: 'u', tone: 1, weld: true }] },
      // y + ie 写成 ye:i 由 y 代劳,不写 yie
      { id: 'u11-52', emoji: '🍃', pinyin: 'yè', read: '叶', syl: [{ initial: 'y', final: 'ie', tone: 4, weld: true }] },
      // yuan 带介母 → **不焊**:焊接语义是「逐块拼读 ≠ 整体读音」,三拼另有介母槽要走过
      { id: 'u11-53', emoji: '🔵', pinyin: 'yuán', read: '圆', syl: [{ initial: 'y', medial: 'ü', final: 'a', nasal: 'n', tone: 2 }] },
      { id: 'u11-54', emoji: '🎵', pinyin: 'yīn', read: '音', syl: [{ initial: 'y', final: 'i', nasal: 'n', tone: 1, weld: true }] },
      { id: 'u11-55', emoji: '☁️', pinyin: 'yún', read: '云', syl: [{ initial: 'y', final: 'ü', nasal: 'n', tone: 2, weld: true }] },
      { id: 'u11-56', emoji: '🌧️', pinyin: 'yǔ', read: '雨', syl: [{ initial: 'y', final: 'ü', tone: 3, weld: true }], review: true },
    ],
  },
  {
    id: 'u12',
    name: '双音节词',
    // 五个块 = 两组音节(零宽间隔由渲染层表意),比别的单元宽 —— 一眼看出「这一格是两段」。
    badge: [
      { type: 'initial', value: 'x' },
      { type: 'final', value: 'i' },
      { type: 'initial', value: 'g' },
      { type: 'medial', value: 'u' },
      { type: 'final', value: 'a' },
    ],
    levels: [
      {
        id: 'u7-0',
        emoji: '🍉',
        pinyin: 'xī guā',
        read: '西瓜',
        syl: [
          { initial: 'x', final: 'i', tone: 1 },
          { initial: 'g', medial: 'u', final: 'a', tone: 1 },
        ],
      },
      {
        id: 'u7-1',
        emoji: '🐼',
        pinyin: 'xióng māo',
        read: '熊猫',
        syl: [
          { initial: 'x', medial: 'i', final: 'o', nasal: 'ng', tone: 2 },
          { initial: 'm', final: 'ao', tone: 1 },
        ],
      },
      {
        id: 'u7-2',
        emoji: '🥛',
        pinyin: 'niú nǎi',
        read: '牛奶',
        syl: [
          { initial: 'n', final: 'iu', tone: 2 },
          { initial: 'n', final: 'ai', tone: 3 },
        ],
      },
      {
        id: 'u7-3',
        emoji: '🦋',
        pinyin: 'hú dié',
        read: '蝴蝶',
        syl: [
          { initial: 'h', final: 'u', tone: 2 },
          { initial: 'd', final: 'ie', tone: 2 },
        ],
      },
      {
        id: 'u7-4',
        emoji: '🌸',
        pinyin: 'huā duǒ',
        read: '花朵',
        syl: [
          { initial: 'h', medial: 'u', final: 'a', tone: 1 },
          { initial: 'd', medial: 'u', final: 'o', tone: 3 },
        ],
      },
      {
        id: 'u12-50',
        emoji: '🌳',
        pinyin: 'dà shù',
        read: '大树',
        syl: [
          { initial: 'd', final: 'a', tone: 4 },
          { initial: 'sh', final: 'u', tone: 4 },
        ],
        review: true,
      },
    ],
  },
]
```

- [ ] **Step 5: 跑测试,逐条修**

```bash
npx vitest run src/features/pinyin-blocks src/app/content-constants.test.ts
```

Expected: 大部分绿。可能的红与处置:

| 红的样子 | 原因 | 处置 |
|---|---|---|
| `每关的 pinyin 与 syl 拼出来的一致` 报某一关 | 新关的 `pinyin` 手写错了 | 改 `levels.ts` 那一关的 `pinyin`(**不要**改 `spell` —— 它已被 Task 4 的 57 条单测锁住) |
| `块值都在块目录的定义域内` | 某个 `final` 不在 `FINAL_BASIC ∪ FINAL_COMPOUND` | 改那一关的结构(常是 `iu`/`ui` 被写成了介母 + 韵母) |
| `焊死标记只落在焊接声母起头、且不带介母的音节上` | `weld` 用在了 `n`/`l`/`p` 起头或带介母的音节上 | 去掉该 `weld`,或改正声母。**`yuán` 故意不焊**(它有介母 `ü`) |
| `朗读文本是汉字,且字数与音节数一致` | `read` 不是汉字或字数不对 | 每条 `read` 恰好等于音节个数个汉字 |
| `拼音不重复` | 两个关卡 `pinyin` 相同 | 换一个例字或换声调(u1 的 `yǐ`/`wǔ` 与 u11 的 `yī`/`wū` 就是靠声调错开的) |
| `G3 韵母全表` 报缺某个 | 该韵母一关都没用上 | 补一关,或核对 `syl` 的写法(鼻韵母必须写成 `final` + `nasal` 两块) |

- [ ] **Step 6: 全量测试 + 类型 + lint**

```bash
npm test && npm run build && npm run lint
```

Expected: 全绿(**零 skip** —— Task 3 的 `it.skip` 已在 Step 1 删除,内容由 G6 覆盖)。

- [ ] **Step 7: 顺手复核交付面(不写代码,只核对事实)**

```bash
node -e "const s=require('fs').readFileSync('src/features/pinyin-blocks/levels.ts','utf8');const ids=[...s.matchAll(/id: '(u\d+-\d+)'/g)].map(x=>x[1]);console.log('关卡数',ids.length,'唯一',new Set(ids).size);console.log('旧键',ids.filter(i=>!/-\d\d$/.test(i.replace(/^u\d+-/,''))||true).length)"
```

这条只是给个手边数字。**真正的判据是测试**,不是这条命令。

- [ ] **Step 8: 提交**

```bash
git add src/features/pinyin-blocks/levels.ts src/features/pinyin-blocks/blocks.ts src/features/pinyin-blocks/levels.test.ts src/features/pinyin-blocks/rules.test.ts src/app/content-constants.test.ts src/features/api/api.test.ts
git commit -m "feat(pinyin-blocks): 课程扩到 12 单元 / 91 关,补齐声韵调全表覆盖"
```

---

### Task 6: ü 的两点飞走

**Files:**
- Modify: `src/features/pinyin-blocks/BlockChip.tsx`
- Modify: `src/features/pinyin-blocks/PinyinBlocksGame.tsx`(import + `renderSlot`)
- Modify: `src/index.css`(拼音积木材质段内,`.pblock--placed` 之后)
- Test: `src/features/pinyin-blocks/BlockChip.test.tsx`(**新建**;仓库既有组件测试的写法见同目录 `PinyinBlocksGame.test.tsx`)
- Modify: `docs/walkthrough.md`(**同一个提交里**)

**Interfaces:**
- Consumes: `losesDots`(Task 4)
- Produces: `BlockChipProps.dotsAway?: boolean`

**判据是结构,不是单元。** 某个音节里 `initial ∈ {j, q, x, y}` 且韵母以 `ü` 起头 → 孩子把 `ü` 拖进槽里即触发。所以 `yuè`(u5,首演关)也会飞,`nǚ` / `lǜ`(u9)不飞。这条判据与 `spellSyllable` 的第 3 条规则**同源**,复用同一个 `losesDots`,渲染层不再写一遍。

- [ ] **Step 1: 写失败的测试**

先看一眼同目录既有组件测试怎么挂载(照着来,别自创):

```bash
npx vitest run src/features/pinyin-blocks/PinyinBlocksGame.test.tsx
```

新建 `src/features/pinyin-blocks/BlockChip.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BlockChip } from './BlockChip'

const chip = (props: Parameters<typeof BlockChip>[0]) => render(<BlockChip {...props} />).container.firstElementChild

describe('BlockChip 的两点飞走', () => {
  // 触发时块面渲染的是**去点后**的字形(u / ue),两点叠在上面飞走 —— 孩子看到的就是「j 把两点带走了」。
  it('dotsAway 时块面写去点后的字形,并挂上会飞走的两点', () => {
    const el = chip({ type: 'final', value: 'ü', dotsAway: true })
    expect(el?.textContent).toBe('u')
    expect(el?.querySelector('.pb-dot'), '两点没了就没得飞').not.toBeNull()
  })

  it('dotsAway 时 üe 只去第一点的两点', () => {
    const el = chip({ type: 'final', value: 'üe', dotsAway: true })
    expect(el?.textContent).toBe('ue')
  })

  // 不去点的关(nǚ / lǜ)与「两点飞走」无关 —— 判据在调用方,这里只保证不误伤。
  it('不带 dotsAway 时原样显示 ü,也没有两点元素', () => {
    const el = chip({ type: 'final', value: 'ü' })
    expect(el?.textContent).toBe('ü')
    expect(el?.querySelector('.pb-dot')).toBeNull()
  })

  // 块面尺寸由调用方给的 className 定死(h-[4.5rem] w-[4.5rem] 之类),不随字形内容变。
  it('去点前后字号类一致,块面不因换字跳动', () => {
    const before = chip({ type: 'final', value: 'ü' })
    const after = chip({ type: 'final', value: 'ü', dotsAway: true })
    expect(after?.className).toBe(before?.className)
  })
})
```

- [ ] **Step 2: 跑测试确认变红**

```bash
npx vitest run src/features/pinyin-blocks/BlockChip.test.tsx
```

Expected: FAIL —— `expected 'ü' to be 'u'`(前两条)。

- [ ] **Step 3: `BlockChip` 实现**

`BlockChip.tsx` 的 `BlockChipProps` 在 `welded?: boolean` 之后加:

```ts
  /** 这一块的两点该飞走(j q x y 之后拼 ü)。由调用方用 `losesDots` 判 —— 组件不重算结构。 */
  dotsAway?: boolean
```

解构参数加上 `dotsAway`(挨着 `welded`)。渲染那一段(`{isTone ? <ToneGlyph value={value} /> : value}`)**整段换成**:

```tsx
      {isTone ? <ToneGlyph value={value} /> : renderGlyph(value, dotsAway)}
```

在同文件的 `ToneGlyph` **之后**加:

```tsx
/**
 * 块面字形。`dotsAway` 时写**去点后**的字形(`ü` → `u`、`üe` → `ue`),两点叠在第一个字母上飞走
 * —— 孩子看到的就是「j q x y 把两点带走了」。
 *
 * 两点不是字符(`ü` 是一个字符),故用**一个**元素画两个圆点(`box-shadow` 复制一份):
 * 少一层 DOM,也免了两个点各自对齐时的漂移。块面尺寸由调用方的 className 定死,不随字形变。
 *
 * 减弱动效由 `index.css` 顶部那条全局 `prefers-reduced-motion` 规则接管
 * (`animation-duration: 0.01ms`),动画瞬间落到终态 = 直接显示去点后的结果,不另写一条。
 */
function renderGlyph(value: string, dotsAway: boolean | undefined) {
  if (!dotsAway || !value.startsWith('ü')) return value
  return (
    <span className="pb-glyph">
      {`u${value.slice(1)}`}
      <span className="pb-dot" aria-hidden="true" />
    </span>
  )
}
```

- [ ] **Step 4: 跑测试确认全绿**

```bash
npx vitest run src/features/pinyin-blocks/BlockChip.test.tsx
```

Expected: PASS。

- [ ] **Step 5: `index.css` 加材质**

在 `src/index.css` 拼音积木材质段内、`.pblock--placed` 规则**之后**(`@keyframes pblock-shake` 之前)插入:

```css
/* ü 飞走的两点。位置是「第一个字母的左上」—— `ü` 与 `ue` 两点都在同一处,
   故一个固定的 left 就够,不需要按字形分支。颜色跟块面墨色走(currentColor)。 */
.pb-glyph {
  position: relative;
  display: inline-block;
}

.pb-dot {
  position: absolute;
  left: 0.16em;
  top: 0.04em;
  width: 0.2em;
  height: 0.2em;
  border-radius: 999px;
  background: currentColor;
  box-shadow: 0.3em 0 0 0 currentColor;
  pointer-events: none;
  animation: pb-dots-away 0.3s ease-out forwards;
}

@keyframes pb-dots-away {
  from { opacity: 1; transform: translateY(0) }
  to { opacity: 0; transform: translateY(-0.55em) }
}
```

> **减弱动效**:不再写第二条规则。文件顶部已有的全局 `@media (prefers-reduced-motion: reduce)` 把 `animation-duration` 压到 `0.01ms`,`forwards` 让它落到终态(两点消失)= 直接显示去点后的结果。加一条重复的规则只会制造「两处都在管同一件事」的假象。
>
> **块尺寸不跳动**:`.pblock` 是 `display: grid; place-items: center`,外层尺寸由调用方给的 `h-[4.5rem] w-[4.5rem]` 一类的类定死;`.pb-glyph` 是 `inline-block`,`u` 与 `ü` 在常见字体里同宽,即便不同宽也只影响这一个 inline box,不动块面。

- [ ] **Step 6: `PinyinBlocksGame` 接线**

`PinyinBlocksGame.tsx:3` 的 import 改成:

```ts
import { UNITS, losesDots, type Level } from './levels'
```

`renderSlot` 里 `<BlockChip>` 的 `welded={…}` 那一行**之后**插入:

```tsx
            // 触发判据与答案行的拼写同源:同一个 losesDots,渲染层不重算结构。
            dotsAway={losesDots(level.syl[slot.sylIdx]?.initial, block.value)}
```

- [ ] **Step 7: 加走查条目(同一个提交里)**

`docs/walkthrough.md` 的「关卡与积木盘」分区内追加(**列数与那一节既有的表格对齐**,下面是内容):

```markdown
| **W-X3** 两点飞走 | 任意设备,进 u9 的 `jú` 关(🍊) | 把 `ü` 块拖进 `j` 后的槽 | 两点**淡出飘走**、块面变 `u`;**块尺寸不跳动**;答案行显示 `jú` |
| **W-X4** 两点不去 | 同上,进 u9 的 `nǚ` 关(👧) | 把 `ü` 块拖进 `n` 后的槽 | 两点**原样保留**;答案行显示 `nǚ`(带两点) |
| **W-X5** 减少动效 | 系统开启「减少动态效果」 | 重复 W-X3 | 不播动画,**直接**显示去点后的结果 |
| **W-X5b** 首演关也飞 | 进 u5 的 `yuè` 关(🌙) | 把 `üe` 块拖进 `y` 后的槽 | **同样飞走** —— 判据是结构不是单元,这一关就是孩子第一次看见这个规则 |
```

- [ ] **Step 8: 全量测试 + 类型 + lint**

```bash
npm test && npm run build && npm run lint
```

Expected: 全绿。

- [ ] **Step 9: 浏览器看一眼(发布闸门①的一条,不是可选项)**

```bash
npm run dev
```

打开 `:3000`,进 u9 的 `jú` 关,把 `ü` 拖进 `j` 后的槽 → 两点淡出上飘、块面变 `u`、块不跳。再进 `nǚ` 关 → 两点原样。**这一条 jsdom 判不了,必须人眼看。**

- [ ] **Step 10: 提交**

```bash
git add src/features/pinyin-blocks/BlockChip.tsx src/features/pinyin-blocks/PinyinBlocksGame.tsx src/features/pinyin-blocks/BlockChip.test.tsx src/index.css docs/walkthrough.md
git commit -m "feat(pinyin-blocks): ü 的两点飞走动画 + 走查条目 W-X3/W-X4/W-X5/W-X5b"
```

---

### Task 7: 文档与走查同步

**Files:**
- Modify: `docs/walkthrough.md`(地图 / 布局与窄屏分区 + 进度分区)
- Modify: `README.md:11`
- Modify: `CLAUDE.md:7`、`CLAUDE.md:24`
- Modify: `docs/dev-reference.md:107`、`docs/dev-reference.md:121`
- Modify: `docs/PLAN.md:50`(状态尾巴)

**Interfaces:**
- Consumes: 前六个任务的全部产出(单元数 / 关数 / 复习关 / 提示档 / 两点飞走)
- Produces: 无代码面

**为什么必须同一个提交:** 走查条目是发布闸门①的唯一来源。「清单不跟着改就等于没闸门」—— 这条是仓库铁律。

- [ ] **Step 1: `docs/walkthrough.md` 补条目**

在「地图」分区内追加(**列数与那一节既有的表格对齐**,下面是内容):

```markdown
| **W-X1** 地图 12 格 | 窗口 **640px** 与 **375px** 各一次 | 看单元地图 | 12 格正常换行**不溢出**;最宽那张名片(双音节单元,5 块)**不折行**(640px 下) |
| **W-X6** 解锁倒退(一次性) | 已有星的存档 | 刷新进地图 | u1 显示 `3/6`,**u2 起带 🔒** —— 这是「前一单元全通才解锁」在单元变长后的预期表现,**不是 bug** |
| **W-X7** 旧星不丢 | 同上 | 逐格点亮 u1 的新关 → 回地图 | u1 满 6/6 后 u2 解锁;旧有的三颗星**自始至终亮着** |
```

在「关卡与积木盘」分区内追加:

```markdown
| **W-X2** 复习关托盘 | 任意设备,进任一单元最后一关 | 看积木盘 | 干扰块**明显多于普通关**;**不被压扁、不溢出**;仍能一眼分出组合块行与声调块行 |
```

> 若 PLAN 上的「特效零文本化 + 地图徽章栏」**尚未落地**,把 `W-X1` 的备注补一句「徽章栏落地后须重跑」(见本计划「开工前置 · 2」)。

- [ ] **Step 2: 三处关数口径**

`README.md:11` 开头那段改成:

```markdown
- **12 个单元 / 91 关**,由易到难:单韵母 → 声母(双唇舌尖 / 舌根舌面 / 翘舌平舌)→ 复韵母 → 前鼻韵母 → 后鼻韵母 → 三拼介母 → ü 行韵母(两点去留)→ 整体认读(两组)→ 双音节词,每单元末有一个复习关 — [src/features/pinyin-blocks/levels.ts](src/features/pinyin-blocks/levels.ts)。单元地图每格用**真积木**当名片(零文本 —— 孩子读不出「单韵母」三个字)。
```

`CLAUDE.md:7` 里 `在地图上按单元解锁 **7 个单元 / 37 关**(单韵母 → 二拼 → 复韵母 → 鼻韵母 → 三拼介母 → 整体认读焊接 → 双音节词)` 改成:

```markdown
在地图上按单元解锁 **12 个单元 / 91 关**(单韵母 → 声母三组 → 复韵母 → 前/后鼻韵母 → 三拼介母 → ü 行韵母 → 整体认读两组 → 双音节词,每单元末一个复习关)
```

`CLAUDE.md:24` 里的 `(7 单元 / 37 关 / 块显式写死)` 改成 `(12 单元 / 91 关 / 块显式写死)`。

`docs/dev-reference.md:107` 里的 `` `UNITS` = **7 单元 / 37 关**(单韵母 / 二拼 / 复韵母 / 鼻韵母 / 三拼介母 / 焊接音 / 双音节词) `` 改成:

```markdown
- **关卡数据**:`UNITS` = **12 单元 / 91 关**(单韵母 / 声母·双唇舌尖 / 声母·舌根舌面 / 声母·翘舌平舌 / 复韵母 / 前鼻韵母 / 后鼻韵母 / 三拼·介母 / ü 行韵母 / 整体认读·一 / 整体认读·二 / 双音节词),单元顺序即难度阶梯,每单元末关 `review: true`。`Unit.badge`(地图格里的名片块)与 `Level.syl`(槽位来源)都**显式写死,不由拼音串反推** —— 数据即答案,反推逻辑藏在解析器里出错更难查。
```

并在同一条之后追加一段:

```markdown
- **`Level.pinyin` 有机器守卫**:`levels.ts` 的 `spell(level)` 由 `syl` 结构拼出显示串(零声母 y/w 改写、`j q x y` 之后 ü 去点、标调位置),`levels.test.ts` 逐关断言 `pinyin === spell(syl)`。手写数据下这是唯一挡得住「屏幕上显示的和积木拼出来的不是一回事」的东西。同一个 `losesDots(initial, value)` 也是关内「两点飞走」动画的判据 —— 判据只此一处。
```

`docs/dev-reference.md:121` 里的 `levels.ts`(7 单元 / 37 关课程数据)改成 `levels.ts`(12 单元 / 91 关课程数据 + `spell()` 拼写守卫)。

- [ ] **Step 3: `docs/PLAN.md:50` 的状态尾巴**

那一行结尾的 `— 已立项,spec 已出待评审 — [design](…)` 改成:

```markdown
— 已立项,plan 已出 — [design](superpowers/specs/2026-09-27-pinyin-curriculum-expansion-design.md) / [plan](superpowers/plans/2026-09-27-pinyin-curriculum-expansion.md)
```

**不要**把它改成 `[x]`:PLAN 的规则是「已合进 main」才勾,合并在 Task 7 之后由人决定。

- [ ] **Step 4: 全量测试 + 类型 + lint**

```bash
npm test && npm run build && npm run lint
```

Expected: 全绿。

- [ ] **Step 5: 提交**

```bash
git add docs/walkthrough.md README.md CLAUDE.md docs/dev-reference.md docs/PLAN.md
git commit -m "docs: 课程扩到 12 单元 / 91 关的文档与走查同步"
```

---

## 收尾(不属于任何任务)

七条任务提交完成后:

1. **人眼走查全跑一遍** —— `docs/walkthrough.md` 的 §B 核心回归 + §C 分区扩展全量,含本计划新增的 W-X1~W-X7。清单不跑完 = 闸门没开。
2. **合并**:topic 分支合进 `main`(仓库规则:成即合删)。
3. **打勾**:`docs/PLAN.md:50` 改 `[x]` 并追加合并提交号,同时更新 **`docs/PLAN.md:48`** 的串行备注(徽章栏与本行谁先落地)。
4. **发布**走 `/release` skill。⚠ 本计划**零迁移**,所以「先升库后升代码」这条不适用;但 `0.2.0` 轨上「远程 D1 迁移」那条行与本计划**无关**,别顺手带。

---

## 与 spec 的偏差(六处,执行前须知)

批一/批二的实现推演中发现 spec 有六处与事实或自洽性不符。**本计划按下列处置执行**,执行者不要照着 spec 原样做:

| # | spec 处 | 事实 | 本计划的处置 |
|---|---|---|---|
| 1 | §3 把 `i` / `u` 两关直接排进 u1 | 单独的 `i` / `u` **不是合法音节**:`Level.read` 必须是汉字(§7 的守卫 `/^[一-龥]+$/` + TTS 要求),而**没有任何汉字读 `ī` / `ū`** | u1 的两关写成零声母改写后的 `yǐ`(椅)/ `wǔ`(五),块面仍是 `final: i` / `final: u` —— §7.2 的规则 2 由此**第一次被真的用上** |
| 2 | §3 的 u1 新关与 §4「整体认读 16/16 在 u11」并列 | `levels.test.ts:82-91` 守**全局** `pinyin` 唯一。u1 若用 `yī` / `wū`,u11 的 `yī` / `wū` 就重复 | u1 用**别的声调**:`yǐ`(椅)/ `wǔ`(五);`yī`(衣)/ `wū`(屋)留给 u11。u1 的复习关改用 `è`(饿) |
| 3 | §7.2 规则 1「拼底串」+ 规则 2「`i` 改 `y`」 | 这两条合不到一起:`y` + `ie` 照底串拼出 `yie` | `writeSyllable` 里加一条明确规则:`head === 'y'` 且 `body` 以 `i` 起头**且 `body.length > 1`** 时,由 `y` 代劳那个 `i`(`y+ie` → `ye`)。`y+ i`(单字母韵母)不受影响,`yī` / `yīn` / `yīng` 仍然正确 |
| 4 | §6 未提 `WELD_INITIALS` | `levels.test.ts:48` 断言 `weld ⟹ initial ∈ WELD_INITIALS`,而表里**没有 `w`**,`wū`(屋)焊不上 | 给 `WELD_INITIALS` 加 `'w'`(语义正确:`w` 与 `y` 一样是零声母的半元音写法)。守卫是单向的,加值不会破任何既有断言;该常量的**生产引用为零**,只有这一个测试在用 |
| 5 | §3.2 表里 `yuan` 未标焊接 | `levels.test.ts:49` **禁止**带介母的音节焊接,而 `yuán` 有介母 `ü` | `yuán` **不焊**(`yú` / `yè` / `yīn` / `yún` / `yǔ` / `yīng` 照焊),理由写进数据注释 |
| 6 | §6.2 说 `unit <= 1 ? 2 : 3` 那档「12 单元下仍指 u1」 | 0 基的 `unit <= 1` 覆盖 u1 **和 u2** 两个单元 | **保留原样照抄**。它今天对 u1/u2 **两个**单元生效,改了就顺手把 u2 的难度调了 —— 那不是本计划该做的事。复习关的 `cap = 5` 优先于它,不受影响 |

另外两处**不是偏差、但执行时会撞上**:

- **emoji / `pinyin` 撞车**已逐个手工核对过:`xǐ` 洗用 🛁(避开 `cā` 擦的 🧽)、`xìn` 信用 ✉️(避开 `qián` 钱的 💰)、`rì` 日用 ☀️(u12 复习关因此用 🌳 大树而不是太阳)。新增关卡时若换例字,**必须重跑 `npm test`** —— `拼音不重复` 与 `emoji.length > 0` 两条守卫会兜住绝大多数。
- **`unit <= 1` 的 u2**:派生池上线后 u2 的干扰块题面会变(池更窄),`rules.test.ts` 里钉具体干扰块的断言已改为「用独立重算的 `seenIn` 判池」—— **不要**改成「钉新池的具体块」,那是把同一个脆弱性换个值。
