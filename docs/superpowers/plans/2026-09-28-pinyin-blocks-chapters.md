# 拼音积木「单元三章」Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把「一关内走简单 → 困难 → 复习三段」改成「一个单元 = 三章（简单章 / 困难章 / 复习章），每章是一个连续的题池」，困难章另用 91 道手写的新音节。

**Architecture:** 数据层把 91 道困难题按 `id = 简单题 id + 'h'` 追加进 `Unit.levels` 的尾部（简单在前、困难在后），新增 `hard-levels.ts` 单独存这批数据。`progress-stats.ts` 长出章级统计与章锁链（单元锁放宽成「前一单元简单章全通」）。旧的相位机 `LevelRun.tsx`（一关内三段）整支换成 `ChapterRun.tsx`（章内逐题推进），`LevelEntry.tsx` 升格成 `UnitEntry.tsx`（持有错题池 + 章状态机）。`settle.ts` 的口径一字不改，只把调用时机从「一关一次」变成「一题一次、章末交账」。后端与迁移零改动。

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind 4 + motion；vitest（jsdom）+ @testing-library/react；oxlint。

**Spec:** `docs/superpowers/specs/2026-09-28-pinyin-blocks-chapters-design.md`

## Global Constraints

以下每一条都是本计划的**每一步隐含的前置要求**，逐字来自 spec 与本仓 `CLAUDE.md`：

- **零可见文字**：游戏区与地图都不许出现汉字/英文单词。唯一例外是拼对后答案行亮出的**同音汉字**（教学内容）与 `aria-label`（不进视觉）。地图上**不许出现「简单章 / 困难章 / 复习章」字样** —— 章的类别只由台阶条的亮格数表达。
- **`read` 必须是同音汉字**，绝不是拼音串（TTS 拿到拉丁串会逐字母念）；`read` 的字数 = 音节数。
- **`starsFor` / `canPlace` / `autoTargetId` 的判定与取值一字不改**（`rules.ts`）。`canPlace` 一个字都不动。
- **常量沿用，不重新发明**：`WRONG_PICK_THRESHOLD = 2`、`HARD_RETRIES = 2`、`HARD_TRAY_PER_TYPE = 2`、`MAX_REVIEW_QUESTIONS = 3`、`REVIEW_TRAY_CAP = 4`、`STAGE_TRANSITION_MS = 1200`。
- **每关同一类型的槽 ≤ 3**（新题也必须满足）。
- **后端零改动、零迁移**：`worker/` 与 `migrations/` 一个字节都不动。存档仍「每 user 一行、逐 key 取 MAX 只升不降」。
- **旧题 id 一字不改**（含原 12 道复习关的题）—— 它们是存档键，改了就是孤儿键。
- **wrangler 命令一律显式 `--config wrangler.toml`**；禁止 `[env.production]`；表结构变更走新增数字前缀迁移、不改 `0001`。本计划**不涉及**以上任何一条（零后端改动），但走查里出现的 wrangler 命令必须带 `--config`。
- **改用户可见行为（样式 / 布局 / 手势 / 动画 / 文案 / 持久化 / 发音）必须在同一个提交里更新 `docs/walkthrough.md`** —— T9 / T10 的提交里必须同时出现该文件。
- 每个任务结束时 `npm test` 必须绿、`npm run lint` 不得新增 error。
- 提交信息用中文、走仓库现有 `type(scope): 摘要` 格式（`feat(pinyin-blocks): …` / `test(pinyin-blocks): …` / `docs: …`）。

## Review Focus

以下是 spec 隐含、但没有哪条任务的测试会直接压到的五类失败模式（按「最可能咬到人」排序）。每一条都在**拥有那段代码的任务**里配了测试 —— 括号里是那处测试。

1. **章内一题的账在「孩子按 ← 回地图」的那一刻还没交出去。** 孩子拼完最后一题、庆祝动画还在飞（1.6~2.1s）时按回地图，那一题的星、星尘、成就**必须已经落库**且已经交给上层。期望着「没丢」，实际是常见的「丢了最后一题」。→ **T8 step 4 的 `onSectionEnd` await 顺序测试** + **T9 step 3 的 `flush` 一次性测试**。
2. **同一单元内跨章时错题池与起始题号失配。** 简单章走一半退出、重进困难章，池必须跨章活着（简单章的错要在复习章里考），起始题号必须重新取「本章第一道未通的题」。期望着「接着来」，实际可能是「从头来」或「跳到别人身上」。→ **T9 step 4 的起始题号测试** + **T2 的 `chapterCleared` 测试**。
3. **进一个没有题的章 = 一块白屏。** spec §2.2 的「空章不进」是一般性守卫（今天只对「困难题尚未录入的单元」成立，但守卫本身要一直在）。→ **T10 step 2 的合成空章测试**（`chapterEnterable` 用合成单元测，不依赖真实数据恰好有空章）。
4. **地图单元格从「一个按钮」变成「容器 + 三个按钮」。** 按钮套按钮是非法 HTML，浏览器会把 DOM 拆散；窄屏 375px 下三行章还要塞得进格子。→ **T10 step 1 的「单元格里没有嵌套 button」测试** + **T10 step 3 的走查条目 `W-M2`**。
5. **那 12 道原复习关题的星在章化后是否原样亮着。** 它们从「复习关」变成「简单章里的普通题」，id 没改 ⇒ 老存档的星必须原样保留。改了 id 就是静默丢星。→ **T1 step 1 的「原复习关题的 id 一字不改」测试**。

---

## 文件结构

| 文件 | 职责 | 动作 |
|---|---|---|
| `src/features/pinyin-blocks/chapter.ts` | 章的类型与顺序常量（LEAF，无依赖） | 新建 |
| `src/features/pinyin-blocks/hard-levels.ts` | 91 道困难题的数据（按单元 id 键控） | 新建 |
| `src/features/pinyin-blocks/levels.ts` | `Level` 字段换血 + 派生视图 + 拼接困难题 | 改 |
| `src/features/pinyin-blocks/blocks.ts` | `hintFor` 第三参换语义 | 改 |
| `src/features/pinyin-blocks/rules.ts` | 删 `level.review` 的 cap 分支 | 改 |
| `src/features/pinyin-blocks/progress-stats.ts` | 章级统计 + 章锁链 + 单元锁放宽 | 改 |
| `src/features/pinyin-blocks/mistakes.ts` | 章级出题（一类型一道题） | 改 |
| `src/features/pinyin-blocks/settle.ts` | 章级交账（`ChapterSettlement` + `mergeSettlement`） | 改 |
| `src/features/pinyin-blocks/ChapterRun.tsx` | 章内逐题推进机（替代 `LevelRun.tsx`） | 新建 |
| `src/features/pinyin-blocks/UnitEntry.tsx` | 单元运行宿主：错题池 + 章状态机（替代 `LevelEntry.tsx`） | 新建 |
| `src/features/pinyin-blocks/PinyinBlocksGame.tsx` | `hintFor` 第三参传 `mode` | 改 |
| `src/features/pinyin-blocks/StageBar.tsx` | `StageId` 改别名 `Chapter` | 改 |
| `src/features/pinyin-blocks/UnitMap.tsx` | 单元格 → 容器 + 三行章按钮 | 改 |
| `src/features/pinyin-blocks/MapEntry.tsx` | `onPick(unitIndex, chapter)` 透传 | 改 |
| `src/features/pinyin-blocks/index.ts` | 公共面跟着换名 | 改 |
| `src/features/pinyin-blocks/chapters.test.ts` | 章结构护栏（新建） | 新建 |
| `src/features/pinyin-blocks/ChapterRun.test.tsx` | 章内推进机测试（新建） | 新建 |
| `src/features/pinyin-blocks/UnitEntry.test.tsx` | 宿主测试（替代 `LevelEntry.test.tsx`） | 新建 |
| `src/app/App.tsx` / `src/app/useAppState.ts` | 视图状态加「章」 | 改 |
| `docs/walkthrough.md` | 走查条目（同提交！） | 改 |
| `docs/dev-reference.md` / `docs/PLAN.md` | 文档同步 | 改 |

---

### Task 1: 数据模型换血（删 `review`、加 `stage`、立 `Chapter`）

这是整条链的地基：`Level.review` 从数据与全部读点里消失，`Level.stage` 与 `Chapter` 就位，`levels.ts` 长出两个派生视图。做完这一步玩法**外观零变化**（困难章暂时是空的），但所有旧测试必须绿。

**Files:**
- Create: `src/features/pinyin-blocks/chapter.ts`
- Modify: `src/features/pinyin-blocks/levels.ts:23-52`（`Level` / `Unit` 类型）、`levels.ts` 的 12 处 `review: true`
- Modify: `src/features/pinyin-blocks/blocks.ts:152-155`（`hintFor`）
- Modify: `src/features/pinyin-blocks/rules.ts:165-167`（cap 分支）
- Modify: `src/features/pinyin-blocks/PinyinBlocksGame.tsx:192`
- Modify: `src/features/pinyin-blocks/StageBar.tsx:3-7`
- Modify: `src/features/pinyin-blocks/index.ts`
- Test: `src/features/pinyin-blocks/levels.test.ts`、`src/features/pinyin-blocks/rules.test.ts`

**Interfaces:**
- Consumes: 无（本任务是地基）
- Produces:
  - `chapter.ts`：`export const CHAPTERS: readonly ['easy', 'hard', 'review']`、`export type Chapter = 'easy' | 'hard' | 'review'`
  - `levels.ts`：`Level.stage?: 'hard'`（`Level.review` **消失**）、`export function easyLevelsOf(unit: Unit): readonly Level[]`、`export function hardLevelsOf(unit: Unit): readonly Level[]`
  - `blocks.ts`：`export function hintFor(unitId: string, missCount: number, chapter: Chapter = 'easy'): Hint`
  - `StageBar.tsx`：`export type StageId = Chapter`

- [ ] **Step 1: 先改测试，让「字段消失」这件事被钉住**

打开 `src/features/pinyin-blocks/levels.test.ts`，把 **`G6:每单元最后一关是复习关,且每单元恰好一个`** 那一整块（含它上面那行「G8 写在 rules.test.ts」的注释**保留**，注释不动）替换成下面两条：

```ts
  // 章化后「单元末复习关」这一关**不存在了** —— 原 12 道复习关的题并进简单章当普通题。
  // 这条钉的是**它们的 id 一字不改**:id 是存档键,改一个就是老存档里一颗星变孤儿。
  it('G6:原复习关的题保留成简单题,id 一字不改', () => {
    const legacy = [
      'u1-52', 'u2-54', 'u3-55', 'u4-58', 'u5-52', 'u6-52',
      'u7-51', 'u8-52', 'u9-57', 'u10-53', 'u11-56', 'u12-50',
    ]
    const ids = new Set(UNITS.flatMap((u) => u.levels.map((level) => level.id)))
    for (const id of legacy) expect(ids.has(id), `原复习关 ${id} 不见了`).toBe(true)
  })

  // 简单题 / 困难题的划分由 `stage` 一个字段决定,两个派生视图合起来必须正好是全表 ——
  // 派生视图漏掉一类(比如 hardLevelsOf 忘了过滤)在 UI 上就是「有些题永远走不到」。
  it('G6b:简单题与困难题互补,合起来等于全表', () => {
    for (const u of UNITS) {
      const easy = easyLevelsOf(u)
      const hard = hardLevelsOf(u)
      expect(easy.length + hard.length, `${u.id} 两章题数之和`).toBe(u.levels.length)
      expect(easy.some((level) => level.stage === 'hard'), `${u.id} 简单章混进了困难题`).toBe(false)
      expect(hard.every((level) => level.stage === 'hard'), `${u.id} 困难章混进了简单题`).toBe(false)
      // 顺序:简单章全在前、困难章全在后(索引必须单调)—— 章内「逐题往下走」直接吃这个顺序。
      const lastEasy = u.levels.findLastIndex((level) => level.stage !== 'hard')
      const firstHard = u.levels.findIndex((level) => level.stage === 'hard')
      if (firstHard >= 0) expect(lastEasy, `${u.id} 简单题与困难题交错了`).toBeLessThan(firstHard)
    }
  })
```

同一文件顶部的 import 行要加 `easyLevelsOf` 与 `hardLevelsOf`：

```ts
import { easyLevelsOf, hardLevelsOf, spell, UNITS, type Unit } from './levels'
```

（照当前文件里已有的那行 `./levels` import 合并，不要另起一行。）另外 id 正则那条护栏改成允许 `h` 后缀：

```ts
      expect(level.id, `${label} 缺 id`).toMatch(/^u\d+-\d+h?$/)
```

再打开 `src/features/pinyin-blocks/rules.test.ts`：

1. `干扰块总数封顶,且不与所需块重名` 里的 cap 行（第 228 行附近）改成：

```ts
        const cap = level.syl.length > 1 ? 2 : unit <= 1 ? 2 : 3
```

2. `双音节题不超上限(块数不炸)` 里（第 236-245 行附近）改成：

```ts
  it('双音节题不超上限(块数不炸)', () => {
    const unit = unitIdxOf('u7-0') // 双音节单元 —— 批二之后 UNITS[6] 不再是它
    for (const level of UNITS[unit]!.levels) {
      const cap = 2
      expect(build(level, seq([0.5])).length).toBeLessThanOrEqual(
        requiredBlocks(level).length + toneBlocks(level).length + cap,
      )
    }
  })
```

3. **整支删除** `G8`（`复习关的干扰块比同题面非复习时多,且仍全部来自已教过的池`）与 `G8b`（`复习关的干扰块上界是 5,且至少一个复习关真的摊满`）两个 `it(...)` 块，连同它们上方各自的注释。删完 `Level` 这个类型导入**仍然被第 33 / 46 / 403 行的用例用着，import 行不动**。

- [ ] **Step 2: 跑测试，确认它红**

```bash
npx vitest run src/features/pinyin-blocks/levels.test.ts src/features/pinyin-blocks/rules.test.ts
```

期望：编译失败 / 红 —— `easyLevelsOf` 与 `hardLevelsOf` 不存在（`levels.ts` 还没导出）；`level.review` 在 `rules.test.ts` 的残留处报错。

- [ ] **Step 3: 建 `chapter.ts`**

新建 `src/features/pinyin-blocks/chapter.ts`：

```ts
// 一个单元的三章。**这个数组就是「章的先后」的唯一事实源** —— 解锁链、地图上的排序、
// 章末该去哪一章,全部从它派生。别在别处再写一遍 ['easy','hard','review']。
// LEAF:不引任何东西(引它的人包括 blocks.ts,反向引会造成环)。

export const CHAPTERS = ['easy', 'hard', 'review'] as const
export type Chapter = (typeof CHAPTERS)[number]
```

- [ ] **Step 4: 换 `Level` / `Unit` 的字段，加派生视图**

`src/features/pinyin-blocks/levels.ts` 里，把 `Level` 的最后一个字段（那段带 `复习关:本单元最后一关…` 注释的 `readonly review?: boolean`）整段替换成：

```ts
  /**
   * 困难章。**不写 = 简单题**。
   *
   * 「简单 / 困难」的划分只有这一个字段说了算:`easyLevelsOf` / `hardLevelsOf`
   * 两个派生视图都从它取,别在别处按单元序号或题数猜。
   */
  readonly stage?: 'hard'
```

在 `Unit` 类型下面（`UNITS` 常量之前）加两个派生视图：

```ts
/**
 * 本单元的简单章 / 困难章。**只分组、不排序** —— 顺序沿用 `Unit.levels` 里已有的那个。
 *
 * `Unit.levels` 保持**扁平单数组**(简单题全在前、困难题全在后),而不是 `levels: { easy, hard }`:
 * `progress-stats` / `achievements` / 后端 / 存档格式遍历的都是 `unit.levels`,
 * 换个形状就要同时改五处,而这里只需要两个取值函数。
 */
export function easyLevelsOf(unit: Unit): readonly Level[] {
  return unit.levels.filter((level) => level.stage !== 'hard')
}

export function hardLevelsOf(unit: Unit): readonly Level[] {
  return unit.levels.filter((level) => level.stage === 'hard')
}
```

- [ ] **Step 5: 删掉 12 处 `review: true`**

```bash
grep -n "review: true" src/features/pinyin-blocks/levels.ts
```

应当有 **12** 处。逐处删除：行尾内联的删掉 `, review: true`；`u12-50` 那个多行对象里独立成行的 `review: true,` 删掉整行。**一个字都不许动旁边的 id / emoji / pinyin / read / syl** —— 这些题全部保留。

- [ ] **Step 6: `hintFor` 第三参换语义**

`src/features/pinyin-blocks/blocks.ts`：顶部加 `import type { Chapter } from './chapter'`，然后把 `hintFor` 换成：

```ts
/**
 * 本关此刻的提示档:基线由单元给,连错 2 次临时回强(只升不降)。
 *
 * 第三参是**章的类别**,不是「这一关是不是复习关」—— 章化后「复习」是复习章,
 * 那一段恒弱是因为它考的是错块,不是因为题的出身。
 */
export function hintFor(unitId: string, missCount: number, chapter: Chapter = 'easy'): Hint {
  if (missCount >= 2) return 'strong'
  return chapter === 'review' ? 'weak' : (HINT_BY_UNIT[unitId] ?? 'strong')
}
```

- [ ] **Step 7: 删 `rules.ts` 的 cap 分支**

`src/features/pinyin-blocks/rules.ts` 第 165-167 行附近，把注释与 cap 一起换成：

```ts
  // 干扰块总数封顶。这里的 cap 管的是**干扰块总数**(题面有多挤);
  // 「挤在里面的块有多像」由 CONFUSABLE 管。复习章的托盘由 `ReviewQuestion.tray` 给,
  // 压根不走这里 —— 那条路径上的上限是 `REVIEW_TRAY_CAP`。
  const cap = level.syl.length > 1 ? 2 : unit <= 1 ? 2 : 3
```

- [ ] **Step 8: `PinyinBlocksGame` 传 `mode`**

`src/features/pinyin-blocks/PinyinBlocksGame.tsx:192`：

```ts
  const hint = hintFor(unit.id, missCount, mode)
```

（`mode: StageId = review ? 'review' : stage` 就在上面几行 —— `StageId` 下一步会变成 `Chapter` 的别名，所以这里传得进去。）

- [ ] **Step 9: `StageBar` 的 `StageId` 改成 `Chapter` 的别名**

`src/features/pinyin-blocks/StageBar.tsx` 顶部那段（`import { cn }` 之后、`LABEL` 之前）换成：

```ts
import type { Chapter } from './chapter'

/**
 * 段的身份就是章的类别 —— 台阶条有三格,一个单元三章,同一套素材同一套语义。
 * 留着 `StageId` 这个名字是因为 `PinyinBlocksGame` 的 `stage` 入参是「段」的视角,
 * 两处指的是同一个联合类型,不许各写一份。
 */
export type StageId = Chapter
```

- [ ] **Step 10: `index.ts` 跟着换名**

`src/features/pinyin-blocks/index.ts`：

- `export { UNITS } from './levels'` 改成 `export { UNITS, easyLevelsOf, hardLevelsOf } from './levels'`
- 加 `export { CHAPTERS, type Chapter } from './chapter'`
- `export { StageBar, StageDots, type StageId } from './StageBar'` 保持不变

- [ ] **Step 11: 跑测试，确认全绿**

```bash
npm test
```

期望：PASS。这一步之后**玩法与外观零变化** —— 困难章是空的（还没有题），旧的三段相位机原样在跑。

```bash
npm run lint
```

期望：不新增 error。

- [ ] **Step 12: 提交**

```bash
git add src/features/pinyin-blocks/chapter.ts src/features/pinyin-blocks/levels.ts src/features/pinyin-blocks/blocks.ts src/features/pinyin-blocks/rules.ts src/features/pinyin-blocks/PinyinBlocksGame.tsx src/features/pinyin-blocks/StageBar.tsx src/features/pinyin-blocks/index.ts src/features/pinyin-blocks/levels.test.ts src/features/pinyin-blocks/rules.test.ts
git commit -m "refactor(pinyin-blocks): Level 删 review 加 stage,立 Chapter 三章类型"
```

---

### Task 2: `progress-stats.ts` 章级统计与章锁链

**Files:**
- Modify: `src/features/pinyin-blocks/progress-stats.ts`（全文重写，54 行 → 约 130 行）
- Test: `src/features/pinyin-blocks/progress-stats.test.ts`

**Interfaces:**
- Consumes: `Chapter` / `CHAPTERS`（T1）、`easyLevelsOf` / `hardLevelsOf`（T1）
- Produces:
  - `export function chapterLevels(unit: Unit, chapter: Chapter): readonly Level[]` —— 复习章恒返回 `[]`（它的题由错题池当场决定，不是课程数据）
  - `export function chapterTotal(unit: Unit, chapter: Chapter): number`
  - `export function chapterClearedCount(stars: LevelStars, unit: Unit, chapter: Chapter): number`
  - `export function chapterCleared(stars: LevelStars, unit: Unit, chapter: Chapter): boolean` —— 空章恒 `true`（`every([])`）
  - `export function chapterEnterable(unit: Unit, chapter: Chapter): boolean` —— 复习章恒 `true`；其余看有没有题
  - `export function isChapterUnlocked(unitIndex: number, chapter: Chapter, stars: LevelStars, units?: readonly Unit[]): boolean`
  - `export function nextChapterOf(unit: Unit, chapter: Chapter): Chapter | null`
  - `isUnitUnlocked` 口径改成「前一单元**简单章**全通」

- [ ] **Step 1: 写失败测试**

新建 `src/features/pinyin-blocks/progress-stats.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import type { LevelStars } from '@/shared/services'
import { UNITS, type Level, type Unit } from './levels'
import {
  chapterCleared,
  chapterClearedCount,
  chapterEnterable,
  chapterLevels,
  chapterTotal,
  isChapterUnlocked,
  isUnitUnlocked,
  nextChapterOf,
} from './progress-stats'

/** 合成单元:3 道简单题 + 2 道困难题。用它测章口径 —— 不依赖真实数据恰好长什么样。 */
const synth: Unit = {
  id: 'ux',
  name: '合成',
  badge: [],
  levels: [
    { id: 'ux-0', emoji: '🅰️', pinyin: 'ā', read: '啊', syl: [{ final: 'a', tone: 1 }] },
    { id: 'ux-1', emoji: '🅱️', pinyin: 'ō', read: '噢', syl: [{ final: 'o', tone: 1 }] },
    { id: 'ux-2', emoji: '🆎', pinyin: 'ē', read: '诶', syl: [{ final: 'e', tone: 1 }] },
    { id: 'ux-0h', emoji: '🔺', pinyin: 'á', read: '啊', syl: [{ final: 'a', tone: 2 }], stage: 'hard' },
    { id: 'ux-1h', emoji: '🔻', pinyin: 'ó', read: '哦', syl: [{ final: 'o', tone: 2 }], stage: 'hard' },
  ],
}

/** 只有简单题的单元 —— 「空困难章」那条守卫的载体。 */
const noHard: Unit = { id: 'un', name: '无难', badge: [], levels: synth.levels.slice(0, 3) }

const star = (ids: readonly string[]): LevelStars => Object.fromEntries(ids.map((id) => [id, 1]))

describe('章级统计', () => {
  it('chapterLevels 按章切,复习章恒空', () => {
    expect(chapterLevels(synth, 'easy').map((l: Level) => l.id)).toEqual(['ux-0', 'ux-1', 'ux-2'])
    expect(chapterLevels(synth, 'hard').map((l: Level) => l.id)).toEqual(['ux-0h', 'ux-1h'])
    expect(chapterLevels(synth, 'review')).toEqual([])
    expect(chapterTotal(synth, 'easy')).toBe(3)
    expect(chapterTotal(synth, 'hard')).toBe(2)
    expect(chapterTotal(synth, 'review')).toBe(0)
    expect(chapterClearedCount(star(['ux-0', 'ux-1']), synth, 'easy')).toBe(2)
    expect(chapterClearedCount(star(['ux-0h']), synth, 'hard')).toBe(1)
  })

  it('chapterCleared 要求该章每题都 ≥1 星', () => {
    expect(chapterCleared(star(['ux-0', 'ux-1']), synth, 'easy')).toBe(false)
    expect(chapterCleared(star(['ux-0', 'ux-1', 'ux-2']), synth, 'easy')).toBe(true)
    // 空章恒「做完」—— 这是「困难章还没录入时复习章仍能解锁」的机制所在(every([]) === true)。
    expect(chapterCleared({}, noHard, 'hard')).toBe(true)
  })

  it('chapterEnterable:空章不进,复习章恒可进', () => {
    expect(chapterEnterable(synth, 'easy')).toBe(true)
    expect(chapterEnterable(synth, 'hard')).toBe(true)
    // 复习章的题由错题池当场决定,池空也有「照考整题」的兜底 ⇒ 它永远进得去。
    expect(chapterEnterable(synth, 'review')).toBe(true)
    expect(chapterEnterable(noHard, 'hard')).toBe(false)
  })
})

describe('章锁链', () => {
  it('单元锁 = 前一单元简单章全通(困难章不参与)', () => {
    const units = [synth, noHard]
    expect(isUnitUnlocked(0, {}, units)).toBe(true)
    // 前一单元的简单题只通两道 ⇒ 锁着
    expect(isUnitUnlocked(1, star(['ux-0', 'ux-1']), units)).toBe(false)
    // 简单章全通 ⇒ 解锁,即使困难章一道没碰
    expect(isUnitUnlocked(1, star(['ux-0', 'ux-1', 'ux-2']), units)).toBe(true)
  })

  it('章依次锁:简单章 → 困难章 → 复习章', () => {
    const units = [synth]
    expect(isChapterUnlocked(0, 'easy', {}, units)).toBe(true)
    expect(isChapterUnlocked(0, 'hard', {}, units)).toBe(false)
    expect(isChapterUnlocked(0, 'hard', star(['ux-0', 'ux-1', 'ux-2']), units)).toBe(true)
    expect(isChapterUnlocked(0, 'review', star(['ux-0', 'ux-1', 'ux-2']), units)).toBe(false)
    expect(isChapterUnlocked(0, 'review', star(['ux-0', 'ux-1', 'ux-2', 'ux-0h', 'ux-1h']), units)).toBe(true)
  })

  it('困难章为空时复习章直接解锁(空章不算一道没做完的章)', () => {
    const units = [noHard]
    expect(isChapterUnlocked(0, 'review', star(['ux-0', 'ux-1', 'ux-2']), units)).toBe(true)
  })

  it('nextChapterOf 只走相邻一章,空章跳过、末章回 null', () => {
    expect(nextChapterOf(synth, 'easy')).toBe('hard')
    expect(nextChapterOf(synth, 'hard')).toBe('review')
    expect(nextChapterOf(synth, 'review')).toBeNull()
    // 困难章空 ⇒ 简单章走完直接回地图(不进一块白屏)
    expect(nextChapterOf(noHard, 'easy')).toBeNull()
  })
})
```

- [ ] **Step 2: 跑测试，确认它红**

```bash
npx vitest run src/features/pinyin-blocks/progress-stats.test.ts
```

期望：FAIL —— `chapterLevels` 等六个导出不存在。

- [ ] **Step 3: 实现**

把 `src/features/pinyin-blocks/progress-stats.ts` 的 `isUnitUnlocked` 及其上方注释换成下面这一段（文件开头的 import 改成 `import { CHAPTERS, type Chapter } from './chapter'` + `import { easyLevelsOf, hardLevelsOf, UNITS, type Level, type Unit } from './levels'`）：

```ts
/**
 * 本章的题。复习章恒返回 `[]` —— **它的题由错题池当场决定,不是课程数据**。
 * 想数复习章有几道题,得先有池;想在它上面求「通没通」,答案是「不进这个口径」(见 `chapterCleared`)。
 */
export function chapterLevels(unit: Unit, chapter: Chapter): readonly Level[] {
  if (chapter === 'easy') return easyLevelsOf(unit)
  if (chapter === 'hard') return hardLevelsOf(unit)
  return []
}

export function chapterTotal(unit: Unit, chapter: Chapter): number {
  return chapterLevels(unit, chapter).length
}

export function chapterClearedCount(stars: LevelStars, unit: Unit, chapter: Chapter): number {
  return chapterLevels(unit, chapter).filter((level) => cleared(stars, level.id)).length
}

/**
 * 本章做完了没:该章**全部题都 ≥1 星**。1 星即通关,不要求满星。
 *
 * **空章恒为 true** —— 这不是巧合,是「困难章还没录题时复习章仍要解锁」的机制所在
 * (`every([]) === true`)。别把它「修」成 `length > 0 && every(...)`,那会让空章永远锁着。
 */
export function chapterCleared(stars: LevelStars, unit: Unit, chapter: Chapter): boolean {
  return chapterLevels(unit, chapter).every((level) => cleared(stars, level.id))
}

/**
 * 这一章有没有可进的题。**空章不进** —— 进去就是一块白屏。
 *
 * 复习章恒可进:它压根不从课程数据取题,池空也有「照考本单元第一道整题」的兜底(spec §5)。
 */
export function chapterEnterable(unit: Unit, chapter: Chapter): boolean {
  if (chapter === 'review') return true
  return chapterLevels(unit, chapter).length > 0
}

/**
 * 单元是否解锁:u1 恒开,其余要求**前一单元简单章全通**。
 *
 * **困难章与复习章不参与解锁** —— 孩子不该因为卡在困难章而看不到新单元。
 * 一星即可:「过了」是解锁的门槛,「打好」是星级的事,两件事不能混。
 */
export function isUnitUnlocked(
  unitIndex: number,
  stars: LevelStars,
  units: readonly Unit[] = UNITS,
): boolean {
  if (unitIndex <= 0) return true
  const previous = units[unitIndex - 1]
  if (!previous) return false
  return chapterCleared(stars, previous, 'easy')
}

/**
 * 章是否解锁:本单元**排在它前面的章**全部做完,且单元本身已解锁。
 * 简单章的解锁条件退化成「单元已解锁」—— 单元锁已经是「前一单元的简单章全通」。
 */
export function isChapterUnlocked(
  unitIndex: number,
  chapter: Chapter,
  stars: LevelStars,
  units: readonly Unit[] = UNITS,
): boolean {
  const unit = units[unitIndex]
  if (!unit) return false
  if (!isUnitUnlocked(unitIndex, stars, units)) return false
  const at = CHAPTERS.indexOf(chapter)
  for (let i = 0; i < at; i++) {
    const earlier = CHAPTERS[i]
    if (earlier && !chapterCleared(stars, unit, earlier)) return false
  }
  return true
}

/**
 * 本章走完后该去哪一章。**没有下一章、或下一章是空章 ⇒ null**(宿主据此回地图)。
 *
 * 不读 stars:能调到这儿就意味着本章刚走完,而「本章走完」正是下一章解锁的全部条件。
 * 唯一的例外是空章 —— 它永远不该被进(一块白屏),所以在这里就掐掉。
 */
export function nextChapterOf(unit: Unit, chapter: Chapter): Chapter | null {
  const next = CHAPTERS[CHAPTERS.indexOf(chapter) + 1]
  if (!next) return null
  return chapterEnterable(unit, next) ? next : null
}
```

- [ ] **Step 4: 跑测试，确认绿**

```bash
npx vitest run src/features/pinyin-blocks/progress-stats.test.ts
```

期望：PASS（6 条）。

- [ ] **Step 5: 跑全表**

```bash
npm test
```

期望：PASS。`isUnitUnlocked` 的口径从「前一单元全关」变成「前一单元简单章」—— 今天两者**等价**（`easyLevelsOf` 就是全部题），所以老测试不受影响。

- [ ] **Step 6: 提交**

```bash
git add src/features/pinyin-blocks/progress-stats.ts src/features/pinyin-blocks/progress-stats.test.ts
git commit -m "feat(pinyin-blocks): 章级统计与章锁链,单元锁放宽成前一单元简单章全通"
```

---

### Task 3: `mistakes.ts` 改造成章级出题

池的作用域从「一关内」扩到「一个单元的简单章 + 困难章」，出题侧从「一道题、多个类型」拆成「一类型一道题、每道挂在自己的题面上」。

**Files:**
- Modify: `src/features/pinyin-blocks/mistakes.ts:55-140`（`ReviewQuestion` 之后的全部）
- Test: `src/features/pinyin-blocks/mistakes.test.ts`（全文重写）
- Modify: `src/features/pinyin-blocks/index.ts`（导出面换名）

**Interfaces:**
- Consumes: `Chapter`（T1）、`chapterLevels`（T2 不直接需要）
- Produces:
  - `export type ChapterReviewItem = Readonly<{ levelIndex: number; question: ReviewQuestion }>`（`levelIndex` = 在 `unit.levels` 里的下标）
  - `export function reviewQuestionFor(level: Level, type: BlockType, pool: MistakePool, qi: number): ReviewQuestion`
  - `export function wholeReviewQuestion(level: Level, unitIndex: number, rng?: Rng): ReviewQuestion`
  - `export function chapterReviewQuestions(unit: Unit, unitIndex: number, pool: MistakePool, rng?: Rng): ChapterReviewItem[]`
  - **`reviewQuestions` 这个名字消失**（旧签名是「一道题出多道小题」，章化后不再成立）
  - 文件头的「池是**关内状态**」那句注释要改成「池是**单元内状态**」

- [ ] **Step 1: 重写测试**

把 `src/features/pinyin-blocks/mistakes.test.ts` 里 `describe('reviewQuestions', …)` 那一整块（第 123 行起到文件末）**整体替换**成下面两块。文件上半部分（`COMMON` / `seq` / `byId` / `unitIdxOf` / `b` / `familyCounts` / `saturatedPool` / `visible` 这些辅助）**原样保留**，import 行改成：

```ts
import {
  addToPool,
  chapterReviewQuestions,
  MAX_REVIEW_QUESTIONS,
  notePick,
  reviewQuestionFor,
  REVIEW_TRAY_CAP,
  WRONG_PICK_THRESHOLD,
  wholeReviewQuestion,
} from './mistakes'
import { UNITS, type Level } from './levels'
import { slotsFor } from './rules'
```

```ts
describe('chapterReviewQuestions', () => {
  /** 本单元全部题(简单 + 困难)拼起来的视图 —— 合成池时要按它喂错块。 */
  const levelsOf = (unitIndex: number): readonly Level[] => UNITS[unitIndex]!.levels

  it('池空:照考本单元第一道题的整题', () => {
    const unit = UNITS[0]!
    const out = chapterReviewQuestions(unit, 0, [])
    expect(out).toHaveLength(1)
    expect(out[0]!.levelIndex).toBe(0)
    expect(out[0]!.question.kind).toBe('whole')
    expect([...out[0]!.question.slotIds].sort()).toEqual(slotsFor(unit.levels[0]!).map((s) => s.id).sort())
  })

  it('一个类型一道小题,且每题挂在本单元第一道含该类型槽的题上', () => {
    const unitIndex = 0
    const unit = UNITS[unitIndex]!
    // 拿第一道题的真错块喂池:它只有 final / tone 两类槽。
    const level = unit.levels[0]!
    const pool = addToPool([], [{ type: 'final', value: 'zzz' }, { type: 'tone', value: '9' }])
    const out = chapterReviewQuestions(unit, unitIndex, pool)
    expect(out).toHaveLength(2)
    expect(out.map((item) => item.question.blockType).sort()).toEqual(['final', 'tone'])
    for (const item of out) {
      const host = levelsOf(unitIndex)[item.levelIndex]!
      expect(slotsFor(host).some((s) => s.type === item.question.blockType), `${host.id} 不含该类型槽`).toBe(true)
      // 「第一道含该类型槽」—— 换句话说是它前面那些题都不含
      for (const earlier of levelsOf(unitIndex).slice(0, item.levelIndex)) {
        expect(slotsFor(earlier).some((s) => s.type === item.question.blockType)).toBe(false)
      }
    }
  })

  it('挂题用的是**本单元全表**(含困难题),不是只到简单章为止', () => {
    // u9 的简单章第一道题是 jú(声母 + 韵母 + 声调),没有鼻尾槽;
    // 鼻尾要到 u9-53(qún)才出现 —— 它在本单元全表里的下标是 3(0 号是 u9-50)。
    const unit = UNITS.find((u) => u.id === 'u9')!
    const unitIndex = UNITS.indexOf(unit)
    const withNasal = unit.levels.findIndex((level) => slotsFor(level).some((s) => s.type === 'nasal'))
    expect(withNasal, 'u9 里没有含鼻尾槽的题 —— 这条用例的前提没了').toBeGreaterThan(0)
    const pool = addToPool([], [{ type: 'nasal', value: 'zz' }])
    const out = chapterReviewQuestions(unit, unitIndex, pool)
    expect(out).toHaveLength(1)
    expect(out[0]!.levelIndex).toBe(withNasal)
  })

  it('最多 MAX_REVIEW_QUESTIONS 道,最近的类型优先', () => {
    const unitIndex = 0
    const unit = UNITS[unitIndex]!
    // 四类都喂进池,池内顺序决定优先 —— 最后一个进来的排最前。
    let pool = addToPool([], [{ type: 'initial', value: 'zz' }])
    pool = addToPool(pool, [{ type: 'final', value: 'zz' }])
    pool = addToPool(pool, [{ type: 'tone', value: '9' }])
    pool = addToPool(pool, [{ type: 'medial', value: 'z' }])
    const out = chapterReviewQuestions(unit, unitIndex, pool)
    expect(out).toHaveLength(MAX_REVIEW_QUESTIONS)
    // 最近的三类:medial / tone / final(initial 被挤出)
    expect(out.map((item) => item.question.blockType)).toEqual(['medial', 'tone', 'final'])
  })

  it('池里的类型在本单元全表里找不到槽时跳过它,不产出半道题', () => {
    const unit = UNITS[0]!
    const pool = addToPool([], [{ type: 'medial', value: 'z' }])
    // u1 全是单韵母,没有任何介母槽 —— 该被跳过而不是抛错
    expect(chapterReviewQuestions(unit, 0, pool)).toEqual([])
  })
})

describe('reviewQuestionFor / wholeReviewQuestion', () => {
  it('挖空的是该题该类型的**全部**槽,其余槽用正确块预填', () => {
    const level = UNITS[6]!.levels[0]! // u7-0 xī guā:两个音节
    const q = reviewQuestionFor(level, 'final', [], 0)
    const empty = slotsFor(level).filter((s) => s.type === 'final')
    expect([...q.slotIds].sort()).toEqual(empty.map((s) => s.id).sort())
    expect(Object.keys(q.prefill).sort()).toEqual(
      slotsFor(level).filter((s) => s.type !== 'final').map((s) => s.id).sort(),
    )
    expect(q.kind).toBe('block')
    expect(q.blockType).toBe('final')
    // 块 id 前缀带小题序号 —— 同一章里多道小题的块 id 不许撞
    for (const block of q.tray) expect(block.id.startsWith('q0-'), block.id).toBe(true)
    const q1 = reviewQuestionFor(level, 'initial', [], 1)
    for (const block of q1.tray) expect(block.id.startsWith('q1-'), block.id).toBe(true)
  })

  it('托盘含全部正解(含重复),且至少一块错解', () => {
    const level = UNITS[6]!.levels[0]!
    const wrong = { type: 'initial' as const, value: 'zh' }
    const q = reviewQuestionFor(level, 'initial', [wrong], 0)
    const visible = q.tray.filter((t) => !Object.values(q.prefill).includes(t.id))
    // 正解:每个挖空的槽各一块
    const need = slotsFor(level).filter((s) => s.type === 'initial')
    for (const slot of need) {
      expect(visible.some((t) => t.type === 'initial' && t.value === slot.value), `缺正解 ${slot.value}`).toBe(true)
    }
    expect(visible.some((t) => t.value === 'zh'), '错解没进托盘').toBe(true)
    expect(visible.length, '可见块超了上限').toBeLessThanOrEqual(REVIEW_TRAY_CAP)
  })

  it('同形块不进托盘(两块分不开不是难度,是坏题)', () => {
    const level = UNITS[0]!.levels[0]!
    const slot = slotsFor(level).find((s) => s.type === 'final')!
    const q = reviewQuestionFor(level, 'final', [{ type: 'final', value: slot.value }], 0)
    const visible = q.tray.filter((t) => !Object.values(q.prefill).includes(t.id))
    const finals = visible.filter((t) => t.type === 'final')
    expect(finals).toHaveLength(1)
  })

  it('wholeReviewQuestion 挖空所有槽、无预填', () => {
    const unit = UNITS[0]!
    const level = unit.levels[0]!
    const q = wholeReviewQuestion(level, 0, seq([0.3, 0.7]))
    expect(q.kind).toBe('whole')
    expect(q.prefill).toEqual({})
    expect([...q.slotIds].sort()).toEqual(slotsFor(level).map((s) => s.id).sort())
    // 托盘等同简单段的 buildBlocks —— 每题都要有块可放
    for (const slot of slotsFor(level)) {
      expect(q.tray.some((t) => t.value === slot.value), `缺 ${slot.type}:${slot.value}`).toBe(true)
    }
  })
})
```

- [ ] **Step 2: 跑测试，确认它红**

```bash
npx vitest run src/features/pinyin-blocks/mistakes.test.ts
```

期望：编译失败 —— `chapterReviewQuestions` / `reviewQuestionFor` / `wholeReviewQuestion` 都不存在。

- [ ] **Step 3: 实现**

`src/features/pinyin-blocks/mistakes.ts`：

1. 文件头注释第一段改成：

```ts
// 错题池与复习章的出题逻辑。不引 React、不引服务 —— 组件只负责画。
// 池是**单元内状态**:不持久化、不跨单元(简单章与困难章的错合并进同一个池),
// 由 `UnitEntry` 持有;退出到地图即随组件卸载丢弃。
```

2. import 行加 `import type { Unit } from './levels'`（原来的 `import type { Level } from './levels'` 保留，两个类型一起写）。

3. 把 `reviewQuestions` 整支函数（含它上方那段长注释）替换成下面四段：

```ts
/** 复习章的一道小题,以及它挂在哪道题上(`levelIndex` = 在 `Unit.levels` 里的下标)。 */
export type ChapterReviewItem = Readonly<{
  levelIndex: number
  question: ReviewQuestion
}>

/**
 * 一道「挖空某一题某一类型」的小题。纯函数、**不掷骰子** —— 同一批入参恒产出等值对象。
 *
 * 这一点是**承重的**:宿主把整章的小题在进章时算一次(见 `chapterReviewQuestions`),
 * 之后不再重算;万一被重算(React 的 `useMemo` 不保证不重跑),块 id 与 prefill 必须与旧的一致,
 * 否则盘面(只初始化一次的 `placement`)会与托盘失配 —— 屏幕上就是「块放不进去」。
 *
 * - 挖空该题里**该类型的全部**槽,其余槽用正确块预填(预填槽在复习章里拿不回来);
 * - 托盘 = 这些槽的正解(含重复,少一块就无解)+ 池里该类型的错块(家族去重);
 * - 预填块也在 `tray` 里(渲染层靠它找块),但**不计入** `REVIEW_TRAY_CAP` —— 上限管的是屏上看得见的那几块;
 * - 某错块的家族键与该小题的可见块相同时**不进托盘** —— 两块一模一样不是难度,是坏题。
 */
export function reviewQuestionFor(
  level: Level,
  type: BlockType,
  pool: MistakePool,
  qi: number,
): ReviewQuestion {
  const slots = slotsFor(level)
  const empty = slots.filter((s) => s.type === type)
  const rest = slots.filter((s) => s.type !== type)

  const tray: TrayBlock[] = empty.map((s, i) => ({ type: s.type, value: s.value, id: `q${qi}-c${i}` }))
  // 显式记下哪些块是**可见**的(正解与错解),不去反查 prefill —— 后者是同形块更容易出错。
  const visible = new Set(tray.map((t) => t.id))
  const prefill: Record<string, string> = {}
  rest.forEach((s, i) => {
    const id = `q${qi}-p${i}`
    tray.push({ type: s.type, value: s.value, id })
    prefill[s.id] = id
  })

  const taken = new Set(tray.filter((t) => visible.has(t.id)).map(familyKey))
  const room = Math.max(0, REVIEW_TRAY_CAP - empty.length)
  let added = 0
  // 池是追加的 ⇒ 倒序取 = 最近点错的优先。
  for (let i = pool.length - 1; i >= 0; i--) {
    if (added >= room) break
    const block = pool[i] as Block
    if (block.type !== type) continue
    if (taken.has(familyKey(block))) continue
    taken.add(familyKey(block))
    tray.push({ ...block, id: `q${qi}-w${added}` })
    added += 1
  }

  return { kind: 'block', blockType: type, slotIds: empty.map((s) => s.id), prefill, tray }
}

/**
 * 池空时的兜底:照考一道**整题**(全部槽挖空、无预填、托盘同简单段)。
 * 产品裁定「复习章恒存在」,不存在「这个单元没有复习章」。
 */
export function wholeReviewQuestion(level: Level, unitIndex: number, rng: Rng = Math.random): ReviewQuestion {
  const tray: TrayBlock[] = buildBlocks(level, unitIndex, rng).map((b, i) => ({ ...b, id: `q0-${i}` }))
  return { kind: 'whole', slotIds: slotsFor(level).map((s) => s.id), prefill: {}, tray }
}

/**
 * 一个单元的复习章:从池里取类型,**一个类型一道小题**,最多 `MAX_REVIEW_QUESTIONS` 道。
 *
 * 一道小题挂在哪道题上 = **本单元第一道含该类型槽的题**(`unit.levels` 顺序,含困难题)。
 * 今天「复习关自己就是那道题」,章化后池跨整个单元,必须重定这条;取「第一道含该槽的题」
 * 让题面选择可预期,而且**不必在池里存题号**(池只存块)。
 *
 * 池空 ⇒ 照考本单元第一道题的整题。池里的类型在本单元找不到槽 ⇒ 跳过它(不产出半道题)。
 */
export function chapterReviewQuestions(
  unit: Unit,
  unitIndex: number,
  pool: MistakePool,
  rng: Rng = Math.random,
): ChapterReviewItem[] {
  const levels = unit.levels
  const first = levels[0]
  if (!first) return []

  // 最近点错的类型排前面 —— 池是追加的,故倒序;同一家族只留最近那一次。
  const recent: Block[] = []
  const seenFamily = new Set<string>()
  for (let i = pool.length - 1; i >= 0; i--) {
    const block = pool[i] as Block
    const key = familyKey(block)
    if (seenFamily.has(key)) continue
    seenFamily.add(key)
    recent.push(block)
  }

  const out: ChapterReviewItem[] = []
  for (const block of recent) {
    if (out.length >= MAX_REVIEW_QUESTIONS) break
    if (out.some((item) => item.question.blockType === block.type)) continue
    const levelIndex = levels.findIndex((level) => slotsFor(level).some((s) => s.type === block.type))
    if (levelIndex < 0) continue
    out.push({ levelIndex, question: reviewQuestionFor(levels[levelIndex] as Level, block.type, pool, out.length) })
  }

  if (out.length === 0) {
    return [{ levelIndex: 0, question: wholeReviewQuestion(first, unitIndex, rng) }]
  }
  return out
}
```

4. `src/features/pinyin-blocks/index.ts` 的 mistakes 导出块换成：

```ts
export {
  addToPool,
  chapterReviewQuestions,
  MAX_REVIEW_QUESTIONS,
  notePick,
  reviewQuestionFor,
  REVIEW_TRAY_CAP,
  wholeReviewQuestion,
  WRONG_PICK_THRESHOLD,
  type ChapterReviewItem,
  type MistakePool,
  type PickCounts,
  type PoolKey,
  type ReviewQuestion,
} from './mistakes'
```

- [ ] **Step 4: 跑测试，确认绿**

```bash
npx vitest run src/features/pinyin-blocks/mistakes.test.ts
```

期望：PASS。

**注意**：此时 `LevelRun.tsx` 还在 import 已被删掉的 `reviewQuestions` —— `npm test` 的其它文件会编译失败。这是**预期的过渡态**：本 Step 只要求 `mistakes.test.ts` 自己绿（vitest 按文件编译）。若 `npx vitest run` 因其它文件报错而拒绝启动，改用：

```bash
npx vitest run --typecheck.enabled=false src/features/pinyin-blocks/mistakes.test.ts
```

并在 Step 5 里确认「只有 `LevelRun.tsx` 一条编译错」。

- [ ] **Step 5: 确认损坏面只有一处**

```bash
npx tsc -b --noEmit 2>&1 | head -20
```

期望：唯一的报错指向 `src/features/pinyin-blocks/LevelRun.tsx`（`reviewQuestions` 不存在）。这个文件在 T8 会被整支替换。**不要**为了让它过而临时改它。

- [ ] **Step 6: 提交**

```bash
git add src/features/pinyin-blocks/mistakes.ts src/features/pinyin-blocks/mistakes.test.ts src/features/pinyin-blocks/index.ts
git commit -m "feat(pinyin-blocks): 复习章出题改成章级「一类型一道题」"
```

---

### Task 4: 困难题 u1–u4（32 道）+ 章结构护栏

从这一批起，困难章开始有题。数据放**新文件** `hard-levels.ts`，按单元 id 键控；`levels.ts` 的每个单元在 `levels` 数组末尾展开对应的那一批。

**Files:**
- Create: `src/features/pinyin-blocks/hard-levels.ts`
- Modify: `src/features/pinyin-blocks/levels.ts`（u1–u4 四个单元的 `levels` 数组末尾各加一行展开）
- Test: `src/features/pinyin-blocks/chapters.test.ts`（新建）

**Interfaces:**
- Consumes: `Level`（T1，含 `stage?: 'hard'`）
- Produces: `export const HARD_LEVELS: Readonly<Partial<Record<string, readonly Level[]>>>`（`hard-levels.ts`）

- [ ] **Step 1: 写失败测试**

新建 `src/features/pinyin-blocks/chapters.test.ts`：

```ts
// 章结构护栏。**这一份的两条前提别搞混**:
// ① 「题长在本单元里 ⇒ 块必然在已教池里」是同一句话说两遍(`taughtBlocks(本单元)` 覆盖本单元全部题),
//    所以「块在已教范围内」要**重新定义** = 「前面各单元的全部题 + 本单元**简单章**」;
// ② 困难题分批录入,所以下面的遍历一律取「HARD_LEVELS 里已有条目的单元」——
//    最后一批(T6)再补一条总账,保证 12 个单元一个不缺。
import { describe, expect, it } from 'vitest'
import { INITIALS_ALL, MEDIALS, NASALS, WELD_INITIALS, type BlockType } from './blocks'
import { HARD_LEVELS } from './hard-levels'
import { UNITS, type Level } from './levels'
import { slotsFor } from './rules'

/** 到 unitIndex 为止**已经录完**的单元(含本单元简单章)里出现过的块。 */
function taughtUpTo(unitIndex: number): Set<string> {
  const out = new Set<string>()
  const add = (levels: readonly Level[]) => {
    for (const level of levels) {
      for (const slot of slotsFor(level)) out.add(`${slot.type}:${slot.value}`)
    }
  }
  for (const unit of UNITS.slice(0, unitIndex)) {
    add(unit.levels)
    add(HARD_LEVELS[unit.id] ?? [])
  }
  add(UNITS[unitIndex]!.levels.filter((level) => level.stage !== 'hard'))
  return out
}

/** 已录完的单元(困难章有题的)。 */
const recorded = UNITS.filter((unit) => (HARD_LEVELS[unit.id] ?? []).length > 0)

describe('困难章题', () => {
  it('每单元困难题数 = 简单题数,id = 对应简单题 id + h,顺序一一对应', () => {
    for (const unit of recorded) {
      const hard = HARD_LEVELS[unit.id]!
      const easy = unit.levels.filter((level) => level.stage !== 'hard')
      expect(hard.length, `${unit.id} 困难题数`).toBe(easy.length)
      expect(hard.map((level) => level.id), `${unit.id} 困难题 id`).toEqual(easy.map((level) => `${level.id}h`))
      for (const level of hard) expect(level.stage, level.id).toBe('hard')
    }
  })

  // 这才是 spec §9.1 规则 1 的口径。`taughtBlocks(本单元)` 那条既有护栏在这里问不出任何东西。
  it('困难题的块全部落在「前面各单元 + 本单元简单章」的池子里', () => {
    for (const [index, unit] of UNITS.entries()) {
      const hard = HARD_LEVELS[unit.id]
      if (!hard) continue
      const allowed = taughtUpTo(index)
      for (const level of hard) {
        for (const slot of slotsFor(level)) {
          // 声调块恒四调全出(`toneBlocks`),不走课程池 —— 池里本来就没有它们。
          if (slot.type === 'tone') continue
          expect(allowed.has(`${slot.type}:${slot.value}`), `${level.id} 用了还没教过的 ${slot.type}:${slot.value}`).toBe(true)
        }
      }
    }
  })

  it('困难题的块值都在块目录定义域内,焊死规则与简单题同口径', () => {
    const finals = new Set(UNITS.flatMap((u) => u.levels.flatMap((l) => l.syl.map((s) => s.final))))
    for (const unit of recorded) {
      for (const level of HARD_LEVELS[unit.id]!) {
        for (const syl of level.syl) {
          if (syl.initial !== undefined) expect(INITIALS_ALL, level.id).toContain(syl.initial)
          if (syl.medial !== undefined) expect(MEDIALS, level.id).toContain(syl.medial)
          if (syl.nasal !== undefined) expect(NASALS, level.id).toContain(syl.nasal)
          if (syl.final !== undefined) expect(finals.has(syl.final), `${level.id} 的韵母 ${syl.final}`).toBe(true)
          if (syl.weld) {
            expect(WELD_INITIALS, `${level.id} 焊死`).toContain(syl.initial)
            expect(syl.medial, `${level.id} 三拼不该焊`).toBeUndefined()
          }
        }
      }
    }
  })

  it('困难题不与简单题、也不与其它困难题撞 emoji', () => {
    const easyEmoji = new Set(UNITS.flatMap((u) => u.levels.filter((l) => l.stage !== 'hard').map((l) => l.emoji)))
    const seen = new Map<string, string>()
    for (const unit of recorded) {
      for (const level of HARD_LEVELS[unit.id]!) {
        expect(easyEmoji.has(level.emoji), `${level.id} 的 emoji 与简单题撞了`).toBe(false)
        const owner = seen.get(level.emoji)
        expect(owner, `${level.id} 的 emoji 与 ${owner} 撞了`).toBeUndefined()
        seen.set(level.emoji, level.id)
      }
    }
  })
})
```

**注意**：`chapters.test.ts` 里的 `recorded` 为空数组时，上面四条会「空过」。所以下面第 4 条步骤里要先确认 `HARD_LEVELS` 里确实有 4 个键。

- [ ] **Step 2: 跑测试，确认它红**

```bash
npx vitest run src/features/pinyin-blocks/chapters.test.ts
```

期望：FAIL —— `./hard-levels` 模块不存在。

- [ ] **Step 3: 建 `hard-levels.ts` 并喂进 u1–u4**

新建 `src/features/pinyin-blocks/hard-levels.ts`：

```ts
// 困难章的题。**与简单章一一对应**:同单元、`id = 对应简单题的完整 id + 'h'`。
//
// 为什么 id 是「照抄简单题的 id 加 h」而不是按位置编序号:现有 id 记的是
// 「这道题出自哪一课的题组」,和它今天落在哪个单元**无关** —— u3 单元里有 u2-4、
// u5 单元里有 u3-0~u3-5 和 u6-5、u12 单元的六道题**全部**是 u7-*。
// 按位置编序号 = 造新存档键 = 老存档的星全断。
//
// 数据与 `levels.ts` 分开放:182 道题的单个数组读不动,而「哪一批是新增的」在 diff 里一眼看得出。
// `Partial`:分批录入,缺哪个单元那个单元的困难章就是空的(空章不进,见 progress-stats)。
// 全部录完后由 `chapters.test.ts` 的总账那条钉住 12 个单元一个不缺。
import type { Level } from './levels'

export const HARD_LEVELS: Readonly<Partial<Record<string, readonly Level[]>>> = {
  u1: [
    { id: 'u1-0h', emoji: '🅰️', pinyin: 'ā', read: '啊', syl: [{ final: 'a', tone: 1 }], stage: 'hard' },
    { id: 'u1-1h', emoji: '🅾️', pinyin: 'ō', read: '噢', syl: [{ final: 'o', tone: 1 }], stage: 'hard' },
    { id: 'u1-2h', emoji: '😐', pinyin: 'ě', read: '恶', syl: [{ final: 'e', tone: 3 }], stage: 'hard' },
    { id: 'u1-50h', emoji: '👚', pinyin: 'yí', read: '姨', syl: [{ final: 'i', tone: 2 }], stage: 'hard' },
    { id: 'u1-51h', emoji: '🌫️', pinyin: 'wù', read: '雾', syl: [{ final: 'u', tone: 4 }], stage: 'hard' },
    { id: 'u1-52h', emoji: '😲', pinyin: 'ò', read: '哦', syl: [{ final: 'o', tone: 4 }], stage: 'hard' },
  ],
  u2: [
    { id: 'u2-0h', emoji: '8️⃣', pinyin: 'bā', read: '八', syl: [{ initial: 'b', final: 'a', tone: 1 }], stage: 'hard' },
    { id: 'u2-1h', emoji: '👩', pinyin: 'mā', read: '妈', syl: [{ initial: 'm', final: 'a', tone: 1 }], stage: 'hard' },
    { id: 'u2-2h', emoji: '⚽', pinyin: 'tī', read: '踢', syl: [{ initial: 't', final: 'i', tone: 1 }], stage: 'hard' },
    { id: 'u2-3h', emoji: '🟤', pinyin: 'ní', read: '泥', syl: [{ initial: 'n', final: 'i', tone: 2 }], stage: 'hard' },
    { id: 'u2-50h', emoji: '🧗', pinyin: 'pá', read: '爬', syl: [{ initial: 'p', final: 'a', tone: 2 }], stage: 'hard' },
    { id: 'u2-51h', emoji: '🙏', pinyin: 'fó', read: '佛', syl: [{ initial: 'f', final: 'o', tone: 2 }], stage: 'hard' },
    { id: 'u2-52h', emoji: '🐘', pinyin: 'dà', read: '大', syl: [{ initial: 'd', final: 'a', tone: 4 }], stage: 'hard' },
    { id: 'u2-53h', emoji: '🛣️', pinyin: 'lù', read: '路', syl: [{ initial: 'l', final: 'u', tone: 4 }], stage: 'hard' },
    { id: 'u2-54h', emoji: '🪵', pinyin: 'mù', read: '木', syl: [{ initial: 'm', final: 'u', tone: 4 }], stage: 'hard' },
  ],
  u3: [
    { id: 'u2-4h', emoji: '😰', pinyin: 'jí', read: '急', syl: [{ initial: 'j', final: 'i', tone: 2 }], stage: 'hard' },
    { id: 'u3-50h', emoji: '👦', pinyin: 'gē', read: '哥', syl: [{ initial: 'g', final: 'e', tone: 1 }], stage: 'hard' },
    { id: 'u3-51h', emoji: '😖', pinyin: 'kǔ', read: '苦', syl: [{ initial: 'k', final: 'u', tone: 3 }], stage: 'hard' },
    { id: 'u3-52h', emoji: '😄', pinyin: 'hā', read: '哈', syl: [{ initial: 'h', final: 'a', tone: 1 }], stage: 'hard' },
    { id: 'u3-53h', emoji: '💨', pinyin: 'qì', read: '汽', syl: [{ initial: 'q', final: 'i', tone: 4 }], stage: 'hard' },
    { id: 'u3-54h', emoji: '⬅️', pinyin: 'xī', read: '西', syl: [{ initial: 'x', final: 'i', tone: 1 }], stage: 'hard' },
    { id: 'u3-55h', emoji: '📚', pinyin: 'kè', read: '课', syl: [{ initial: 'k', final: 'e', tone: 4 }], stage: 'hard' },
  ],
  u4: [
    { id: 'u2-5h', emoji: '🧩', pinyin: 'zá', read: '杂', syl: [{ initial: 'z', final: 'a', tone: 2 }], stage: 'hard' },
    { id: 'u4-50h', emoji: '💥', pinyin: 'zhà', read: '炸', syl: [{ initial: 'zh', final: 'a', tone: 4 }], stage: 'hard' },
    { id: 'u4-51h', emoji: '🍵', pinyin: 'chá', read: '茶', syl: [{ initial: 'ch', final: 'a', tone: 2 }], stage: 'hard' },
    { id: 'u4-52h', emoji: '🐍', pinyin: 'shé', read: '蛇', syl: [{ initial: 'sh', final: 'e', tone: 2 }], stage: 'hard' },
    { id: 'u4-53h', emoji: '📥', pinyin: 'rù', read: '入', syl: [{ initial: 'r', final: 'u', tone: 4 }], stage: 'hard' },
    { id: 'u4-54h', emoji: '🧴', pinyin: 'cù', read: '醋', syl: [{ initial: 'c', final: 'u', tone: 4 }], stage: 'hard' },
    { id: 'u4-55h', emoji: '🚿', pinyin: 'sǎ', read: '洒', syl: [{ initial: 's', final: 'a', tone: 3 }], stage: 'hard' },
    { id: 'u4-56h', emoji: '🐸', pinyin: 'wā', read: '蛙', syl: [{ initial: 'w', final: 'a', tone: 1 }], stage: 'hard' },
    { id: 'u4-57h', emoji: '💡', pinyin: 'yì', read: '意', syl: [{ initial: 'y', final: 'i', tone: 4 }], stage: 'hard' },
    { id: 'u4-58h', emoji: '👴', pinyin: 'zǔ', read: '祖', syl: [{ initial: 'z', final: 'u', tone: 3 }], stage: 'hard' },
  ],
}
```

在 `src/features/pinyin-blocks/levels.ts` 里：

1. 顶部加 `import { HARD_LEVELS } from './hard-levels'`
2. 找到 `u1` / `u2` / `u3` / `u4` 四个单元各自的 `levels` 数组，在**数组最后一项之后、闭合的 `]` 之前**各加一行：

```ts
      // 困难章:另一批音节,与上面的简单题一一对应(id + 'h')。见 hard-levels.ts。
      ...(HARD_LEVELS.u1 ?? []),
```

（对应关系：u1 写 `HARD_LEVELS.u1`、u2 写 `HARD_LEVELS.u2`，以此类推。四个单元一个都不许漏 —— 漏了那个单元的困难章就是空的。）

- [ ] **Step 4: 跑测试，确认绿**

```bash
npx vitest run src/features/pinyin-blocks/chapters.test.ts src/features/pinyin-blocks/levels.test.ts
```

期望：PASS。若 `chapters.test.ts` 全绿但其实是空过（`recorded` 为空），下面这条会告诉你：

```bash
npx vitest run src/features/pinyin-blocks/chapters.test.ts --reporter=verbose
```

四条用例名都要出现，且 `levels.test.ts` 的「每关的 pinyin 与 syl 拼出来的一致」「每关都有稳定 id」「每关都有图与拼音,且拼音不重复」都覆盖到了新加的 32 道题。

- [ ] **Step 5: 跑全表**

```bash
npm test
```

期望：PASS（`tsc -b` 那条已知的 `LevelRun.tsx` 报错要等 T8；vitest 不过 tsc 全项目，按文件跑）。

- [ ] **Step 6: 提交**

```bash
git add src/features/pinyin-blocks/hard-levels.ts src/features/pinyin-blocks/chapters.test.ts src/features/pinyin-blocks/levels.ts
git commit -m "feat(pinyin-blocks): 困难章题 u1-u4(32 道)+ 章结构护栏"
```

---

### Task 5: 困难题 u5–u8（28 道）

与 T4 同形。数据自 T4 的 `chapters.test.ts` 护栏自动接管，**不要**再复制一遍那四条用例。

**Files:**
- Modify: `src/features/pinyin-blocks/hard-levels.ts`（加 u5–u8 四个键）
- Modify: `src/features/pinyin-blocks/levels.ts`（u5–u8 四个单元的展开）

**Interfaces:**
- Consumes: `HARD_LEVELS`（T4）
- Produces: `HARD_LEVELS.u5` / `.u6` / `.u7` / `.u8`

- [ ] **Step 1: 先跑一次护栏，确认 u5–u8 目前是「没录」**

```bash
npx vitest run src/features/pinyin-blocks/chapters.test.ts
```

期望：PASS —— 但这是「u5-u8 不在 `recorded` 里」的空过。记下这一点：**这一批的数据只有靠 `recorded` 扩到 u8 才算真的被覆盖**，所以下面 Step 3 加完数据后必须重跑。

- [ ] **Step 2: 加数据**

在 `src/features/pinyin-blocks/hard-levels.ts` 的 `u4` 键之后追加：

```ts
  u5: [
    { id: 'u3-0h', emoji: '🏃', pinyin: 'pǎo', read: '跑', syl: [{ initial: 'p', final: 'ao', tone: 3 }], stage: 'hard' },
    { id: 'u3-1h', emoji: '🐒', pinyin: 'hóu', read: '猴', syl: [{ initial: 'h', final: 'ou', tone: 2 }], stage: 'hard' },
    { id: 'u3-2h', emoji: '⚪', pinyin: 'bái', read: '白', syl: [{ initial: 'b', final: 'ai', tone: 2 }], stage: 'hard' },
    { id: 'u3-3h', emoji: '🕊️', pinyin: 'fēi', read: '飞', syl: [{ initial: 'f', final: 'ei', tone: 1 }], stage: 'hard' },
    { id: 'u3-4h', emoji: '🤏', pinyin: 'niē', read: '捏', syl: [{ initial: 'n', final: 'ie', tone: 1 }], stage: 'hard' },
    { id: 'u3-5h', emoji: '🍶', pinyin: 'jiǔ', read: '酒', syl: [{ initial: 'j', final: 'iu', tone: 3 }], stage: 'hard' },
    { id: 'u6-5h', emoji: '🔒', pinyin: 'yuē', read: '约', syl: [{ initial: 'y', final: 'üe', tone: 1 }], stage: 'hard' },
    { id: 'u5-50h', emoji: '🫘', pinyin: 'dòu', read: '豆', syl: [{ initial: 'd', final: 'ou', tone: 4 }], stage: 'hard' },
    { id: 'u5-51h', emoji: '😪', pinyin: 'lèi', read: '累', syl: [{ initial: 'l', final: 'ei', tone: 4 }], stage: 'hard' },
    { id: 'u5-52h', emoji: '👭', pinyin: 'mèi', read: '妹', syl: [{ initial: 'm', final: 'ei', tone: 4 }], stage: 'hard' },
  ],
  u6: [
    { id: 'u4-0h', emoji: '🌱', pinyin: 'gēn', read: '根', syl: [{ initial: 'g', final: 'e', nasal: 'n', tone: 1 }], stage: 'hard' },
    { id: 'u4-1h', emoji: '🏫', pinyin: 'bān', read: '班', syl: [{ initial: 'b', final: 'a', nasal: 'n', tone: 1 }], stage: 'hard' },
    { id: 'u6-50h', emoji: '🥈', pinyin: 'yín', read: '银', syl: [{ initial: 'y', final: 'i', nasal: 'n', tone: 2 }], stage: 'hard' },
    { id: 'u6-51h', emoji: '🍽️', pinyin: 'pán', read: '盘', syl: [{ initial: 'p', final: 'a', nasal: 'n', tone: 2 }], stage: 'hard' },
    { id: 'u6-52h', emoji: '💧', pinyin: 'hàn', read: '汗', syl: [{ initial: 'h', final: 'a', nasal: 'n', tone: 4 }], stage: 'hard' },
  ],
  u7: [
    { id: 'u4-2h', emoji: '🤝', pinyin: 'bāng', read: '帮', syl: [{ initial: 'b', final: 'a', nasal: 'ng', tone: 1 }], stage: 'hard' },
    { id: 'u4-3h', emoji: '🔩', pinyin: 'gāng', read: '钢', syl: [{ initial: 'g', final: 'a', nasal: 'ng', tone: 1 }], stage: 'hard' },
    { id: 'u4-4h', emoji: '↔️', pinyin: 'héng', read: '横', syl: [{ initial: 'h', final: 'e', nasal: 'ng', tone: 2 }], stage: 'hard' },
    { id: 'u5-4h', emoji: '🍬', pinyin: 'táng', read: '糖', syl: [{ initial: 't', final: 'a', nasal: 'ng', tone: 2 }], stage: 'hard' },
    { id: 'u7-50h', emoji: '🕳️', pinyin: 'kēng', read: '坑', syl: [{ initial: 'k', final: 'e', nasal: 'ng', tone: 1 }], stage: 'hard' },
    { id: 'u7-51h', emoji: '👬', pinyin: 'péng', read: '朋', syl: [{ initial: 'p', final: 'e', nasal: 'ng', tone: 2 }], stage: 'hard' },
  ],
  u8: [
    { id: 'u5-0h', emoji: '🔢', pinyin: 'duō', read: '多', syl: [{ initial: 'd', medial: 'u', final: 'o', tone: 1 }], stage: 'hard' },
    { id: 'u5-1h', emoji: '🌤️', pinyin: 'tiān', read: '天', syl: [{ initial: 't', medial: 'i', final: 'a', nasal: 'n', tone: 1 }], stage: 'hard' },
    { id: 'u5-2h', emoji: '🏘️', pinyin: 'jiā', read: '家', syl: [{ initial: 'j', medial: 'i', final: 'a', tone: 1 }], stage: 'hard' },
    { id: 'u5-3h', emoji: '🏀', pinyin: 'qiú', read: '球', syl: [{ initial: 'q', final: 'iu', tone: 2 }], stage: 'hard' },
    { id: 'u8-50h', emoji: '🖊️', pinyin: 'xiě', read: '写', syl: [{ initial: 'x', final: 'ie', tone: 3 }], stage: 'hard' },
    { id: 'u8-51h', emoji: '🌊', pinyin: 'shuǐ', read: '水', syl: [{ initial: 'sh', final: 'ui', tone: 3 }], stage: 'hard' },
    { id: 'u8-52h', emoji: '⚡', pinyin: 'kuài', read: '快', syl: [{ initial: 'k', medial: 'u', final: 'ai', tone: 4 }], stage: 'hard' },
  ],
```

然后在 `levels.ts` 的 u5 / u6 / u7 / u8 四个单元各加一行展开（同 T4 的写法，键换成 `HARD_LEVELS.u5` … `HARD_LEVELS.u8`）。

- [ ] **Step 3: 跑测试，确认绿且真的被覆盖**

```bash
npx vitest run src/features/pinyin-blocks/chapters.test.ts src/features/pinyin-blocks/levels.test.ts --reporter=verbose
```

期望：PASS。此时 `recorded` 是 8 个单元 —— 护栏真的在检 u1–u8 的 60 道题，不是空过。

- [ ] **Step 4: 跑全表**

```bash
npm test
```

期望：PASS。

- [ ] **Step 5: 提交**

```bash
git add src/features/pinyin-blocks/hard-levels.ts src/features/pinyin-blocks/levels.ts
git commit -m "feat(pinyin-blocks): 困难章题 u5-u8(28 道)"
```

---

### Task 6: 困难题 u9–u12（31 道）+ 总账护栏

**Files:**
- Modify: `src/features/pinyin-blocks/hard-levels.ts`（加 u9–u12）
- Modify: `src/features/pinyin-blocks/levels.ts`（u9–u12 的展开）
- Test: `src/features/pinyin-blocks/chapters.test.ts`（补总账那一条）

**Interfaces:**
- Consumes: `HARD_LEVELS`（T4/T5）
- Produces: `HARD_LEVELS` 全 12 键就位（本任务是「182 道题」这个数字第一次成真）

- [ ] **Step 1: 在护栏里补一条总账**

在 `src/features/pinyin-blocks/chapters.test.ts` 的 `describe('困难章题', …)` 里，**最后**加一条：

```ts
  // 分批录入的收口。上面四条一律只走 `recorded`(已录完的单元)—— 那是为了让每批数据
  // 加进来时护栏立刻生效、而不是等最后一批。代价是「某个单元忘了录」在上面四条里是**看不见**的,
  // 这一条就是为那件事存在:182 = 12 个单元一个不缺。
  it('总账:12 个单元全部录完,困难题总数 = 简单题总数', () => {
    const missing = UNITS.filter((unit) => (HARD_LEVELS[unit.id] ?? []).length === 0).map((unit) => unit.id)
    expect(missing, `这些单元还没录困难题:${missing.join(', ')}`).toEqual([])
    const hard = UNITS.reduce((sum, unit) => sum + (HARD_LEVELS[unit.id] ?? []).length, 0)
    const easy = UNITS.reduce((sum, unit) => sum + unit.levels.filter((l) => l.stage !== 'hard').length, 0)
    expect(hard, '困难题总数').toBe(easy)
    expect(easy, '简单题总数').toBe(91)
  })
```

- [ ] **Step 2: 跑测试，确认它红**

```bash
npx vitest run src/features/pinyin-blocks/chapters.test.ts
```

期望：FAIL —— `这些单元还没录困难题:u9, u10, u11, u12`。

- [ ] **Step 3: 加数据**

在 `src/features/pinyin-blocks/hard-levels.ts` 的 `u8` 键之后追加：

```ts
  u9: [
    { id: 'u9-50h', emoji: '🛖', pinyin: 'jū', read: '居', syl: [{ initial: 'j', final: 'ü', tone: 1 }], stage: 'hard' },
    { id: 'u9-51h', emoji: '🤲', pinyin: 'qǔ', read: '取', syl: [{ initial: 'q', final: 'ü', tone: 3 }], stage: 'hard' },
    { id: 'u9-52h', emoji: '👢', pinyin: 'xuē', read: '靴', syl: [{ initial: 'x', final: 'üe', tone: 1 }], stage: 'hard' },
    { id: 'u9-53h', emoji: '🎖️', pinyin: 'jūn', read: '军', syl: [{ initial: 'j', final: 'ü', nasal: 'n', tone: 1 }], stage: 'hard' },
    { id: 'u9-54h', emoji: '🔭', pinyin: 'yuǎn', read: '远', syl: [{ initial: 'y', medial: 'ü', final: 'a', nasal: 'n', tone: 3 }], stage: 'hard' },
    { id: 'u9-55h', emoji: '🫏', pinyin: 'lǘ', read: '驴', syl: [{ initial: 'l', final: 'ü', tone: 2 }], stage: 'hard' },
    { id: 'u9-56h', emoji: '💬', pinyin: 'jù', read: '句', syl: [{ initial: 'j', final: 'ü', tone: 4 }], stage: 'hard' },
    { id: 'u9-57h', emoji: '📋', pinyin: 'xù', read: '序', syl: [{ initial: 'x', final: 'ü', tone: 4 }], stage: 'hard' },
  ],
  u10: [
    { id: 'u6-0h', emoji: '📓', pinyin: 'zhì', read: '志', syl: [{ initial: 'zh', final: 'i', tone: 4, weld: true }], stage: 'hard' },
    { id: 'u6-1h', emoji: '⏰', pinyin: 'chí', read: '迟', syl: [{ initial: 'ch', final: 'i', tone: 2, weld: true }], stage: 'hard' },
    { id: 'u6-2h', emoji: '🏙️', pinyin: 'shì', read: '市', syl: [{ initial: 'sh', final: 'i', tone: 4, weld: true }], stage: 'hard' },
    { id: 'u6-3h', emoji: '🔤', pinyin: 'cí', read: '词', syl: [{ initial: 'c', final: 'i', tone: 2, weld: true }], stage: 'hard' },
    { id: 'u10-50h', emoji: '🍜', pinyin: 'chī', read: '吃', syl: [{ initial: 'ch', final: 'i', tone: 1, weld: true }], stage: 'hard' },
    { id: 'u10-51h', emoji: '🟣', pinyin: 'zǐ', read: '紫', syl: [{ initial: 'z', final: 'i', tone: 3, weld: true }], stage: 'hard' },
    { id: 'u10-52h', emoji: '🧶', pinyin: 'sī', read: '丝', syl: [{ initial: 's', final: 'i', tone: 1, weld: true }], stage: 'hard' },
    { id: 'u10-53h', emoji: '🪽', pinyin: 'chì', read: '翅', syl: [{ initial: 'ch', final: 'i', tone: 4, weld: true }], stage: 'hard' },
  ],
  u11: [
    { id: 'u6-4h', emoji: '💎', pinyin: 'yù', read: '玉', syl: [{ initial: 'y', final: 'ü', tone: 4, weld: true }], stage: 'hard' },
    { id: 'u6-6h', emoji: '👤', pinyin: 'yǐng', read: '影', syl: [{ initial: 'y', final: 'i', nasal: 'ng', tone: 3, weld: true }], stage: 'hard' },
    { id: 'u11-50h', emoji: '🔖', pinyin: 'yìn', read: '印', syl: [{ initial: 'y', final: 'i', nasal: 'n', tone: 4, weld: true }], stage: 'hard' },
    { id: 'u11-51h', emoji: '🚚', pinyin: 'yùn', read: '运', syl: [{ initial: 'y', final: 'ü', nasal: 'n', tone: 4, weld: true }], stage: 'hard' },
    { id: 'u11-52h', emoji: '🏕️', pinyin: 'yě', read: '野', syl: [{ initial: 'y', final: 'ie', tone: 3, weld: true }], stage: 'hard' },
    { id: 'u11-53h', emoji: '🏛️', pinyin: 'yuàn', read: '院', syl: [{ initial: 'y', medial: 'ü', final: 'a', nasal: 'n', tone: 4 }], stage: 'hard' },
    { id: 'u11-54h', emoji: '🏆', pinyin: 'yíng', read: '赢', syl: [{ initial: 'y', final: 'i', nasal: 'ng', tone: 2, weld: true }], stage: 'hard' },
    { id: 'u11-55h', emoji: '🪨', pinyin: 'yìng', read: '硬', syl: [{ initial: 'y', final: 'i', nasal: 'ng', tone: 4, weld: true }], stage: 'hard' },
    { id: 'u11-56h', emoji: '🧲', pinyin: 'yǐn', read: '引', syl: [{ initial: 'y', final: 'i', nasal: 'n', tone: 3, weld: true }], stage: 'hard' },
  ],
  u12: [
    {
      id: 'u7-0h',
      emoji: '🌥️',
      pinyin: 'bái yún',
      read: '白云',
      syl: [
        { initial: 'b', final: 'ai', tone: 2 },
        { initial: 'y', final: 'ü', nasal: 'n', tone: 2, weld: true },
      ],
      stage: 'hard',
    },
    {
      id: 'u7-1h',
      emoji: '🐜',
      pinyin: 'mǎ yǐ',
      read: '蚂蚁',
      syl: [
        { initial: 'm', final: 'a', tone: 3 },
        { initial: 'y', final: 'i', tone: 3, weld: true },
      ],
      stage: 'hard',
    },
    {
      id: 'u7-2h',
      emoji: '🐓',
      pinyin: 'gōng jī',
      read: '公鸡',
      syl: [
        { initial: 'g', final: 'o', nasal: 'ng', tone: 1 },
        { initial: 'j', final: 'i', tone: 1 },
      ],
      stage: 'hard',
    },
    {
      id: 'u7-3h',
      emoji: '🐬',
      pinyin: 'hǎi tún',
      read: '海豚',
      syl: [
        { initial: 'h', final: 'ai', tone: 3 },
        { initial: 't', final: 'u', nasal: 'n', tone: 2 },
      ],
      stage: 'hard',
    },
    {
      id: 'u7-4h',
      emoji: '🦕',
      pinyin: 'kǒng lóng',
      read: '恐龙',
      syl: [
        { initial: 'k', final: 'o', nasal: 'ng', tone: 3 },
        { initial: 'l', final: 'o', nasal: 'ng', tone: 2 },
      ],
      stage: 'hard',
    },
    {
      id: 'u12-50h',
      emoji: '🐤',
      pinyin: 'xiǎo niǎo',
      read: '小鸟',
      syl: [
        { initial: 'x', medial: 'i', final: 'ao', tone: 3 },
        { initial: 'n', medial: 'i', final: 'ao', tone: 3 },
      ],
      stage: 'hard',
    },
  ],
```

然后在 `levels.ts` 的 u9 / u10 / u11 / u12 四个单元各加一行展开（键 `HARD_LEVELS.u9` … `HARD_LEVELS.u12`）。

- [ ] **Step 4: 跑测试，确认全绿**

```bash
npx vitest run src/features/pinyin-blocks/chapters.test.ts src/features/pinyin-blocks/levels.test.ts --reporter=verbose
```

期望：PASS，且总账那条不再报缺单元。特别确认这几条覆盖到了全部 182 道题：
- `每关都有稳定 id,格式合规且全局唯一`
- `每关都有图与拼音,且拼音不重复`
- `每关的 pinyin 与 syl 拼出来的一致`
- `每关同一类型的槽最多 3 个`
- `u1–u4 的例字只用单韵母,不带鼻尾`

- [ ] **Step 5: 删掉两份临时草稿**

```bash
rm src/features/pinyin-blocks/.hard-draft.ts src/features/pinyin-blocks/.hard-draft.test.ts
```

（这两份是录数据时的校验草稿，数据已进 `hard-levels.ts`，草稿留着就是第二份事实源。）

- [ ] **Step 6: 跑全表 + 提交**

```bash
npm test
```

```bash
git add -A src/features/pinyin-blocks
git commit -m "feat(pinyin-blocks): 困难章题 u9-u12(31 道),182 题全表就位"
```

---

### Task 7: `settle.ts` 章级交账

`settleLevel` 一个字不改。新增的是「把一题一题的结果攒起来、章末交一次账」的那一层。

**Files:**
- Modify: `src/features/pinyin-blocks/settle.ts`（在 `LevelSettlement` 之后追加）
- Test: `src/features/pinyin-blocks/settle.test.ts`（追加一个 describe）

**Interfaces:**
- Consumes: `LevelSettlement`（已存在）
- Produces:
  - `export type ChapterSettlement = Readonly<{ starDust: number; luckyReward: number; achievements: readonly Achievement[]; sessionCleared: number }>`
  - `export const EMPTY_CHAPTER_SETTLEMENT: ChapterSettlement`
  - `export function mergeSettlement(into: ChapterSettlement, next: LevelSettlement): ChapterSettlement`

- [ ] **Step 1: 写失败测试**

在 `src/features/pinyin-blocks/settle.test.ts` **末尾**追加（import 行合并加 `EMPTY_CHAPTER_SETTLEMENT` / `mergeSettlement`）：

```ts
describe('章级交账', () => {
  const ach = (id: string, reward = 50): Achievement => ({ id, name: id, description: '', emoji: '🏅', reward })

  it('星尘与幸运求和,首通数取最新', () => {
    const a = mergeSettlement(EMPTY_CHAPTER_SETTLEMENT, {
      stars: 3, starDust: 10, luckyReward: 0, achievements: [], sessionCleared: 1,
    })
    const b = mergeSettlement(a, { stars: 1, starDust: 5, luckyReward: 20, achievements: [], sessionCleared: 2 })
    expect(b.starDust).toBe(15)
    expect(b.luckyReward).toBe(20)
    expect(b.sessionCleared).toBe(2)
  })

  it('成就按 id 去重合并,先出现的排前面', () => {
    const a = mergeSettlement(EMPTY_CHAPTER_SETTLEMENT, {
      stars: 3, starDust: 0, luckyReward: 0, achievements: [ach('first'), ach('perfect')], sessionCleared: 1,
    })
    const b = mergeSettlement(a, {
      stars: 3, starDust: 0, luckyReward: 0, achievements: [ach('perfect'), ach('marathon')], sessionCleared: 2,
    })
    expect(b.achievements.map((x) => x.id)).toEqual(['first', 'perfect', 'marathon'])
  })

  it('空账是加法的单位元', () => {
    const empty = mergeSettlement(EMPTY_CHAPTER_SETTLEMENT, {
      stars: 0, starDust: 0, luckyReward: 0, achievements: [], sessionCleared: 0,
    })
    expect(empty).toEqual(EMPTY_CHAPTER_SETTLEMENT)
  })
})
```

若文件顶部没有 `import type { Achievement } from '@/shared/services'`，在 import 区加 `import type { Achievement } from '@/shared/services'`。

- [ ] **Step 2: 跑测试，确认它红**

```bash
npx vitest run src/features/pinyin-blocks/settle.test.ts
```

期望：FAIL —— `mergeSettlement` / `EMPTY_CHAPTER_SETTLEMENT` 未导出。

- [ ] **Step 3: 实现**

在 `src/features/pinyin-blocks/settle.ts` 的 `LevelSettlement` 类型定义**之后**插入：

```ts
/**
 * 交回给上层的账 —— **一章一笔**,不是一题一笔。
 *
 * 为什么不是 `LevelSettlement`:那个结构里的 `stars` 是「这一题拿了几星」,
 * 累积十道题之后这个数字没有意义(求和得到 30 星?)。上层真正要的是
 * 「这一章新出了哪些成就、多少星尘」—— 撒花与弹层就判这两个。
 */
export type ChapterSettlement = Readonly<{
  /** 本章入账的星尘合计(连击加成 + 幸运 + 成就奖励)。 */
  starDust: number
  luckyReward: number
  /** 本章新得的成就,**按 id 去重**(同一章里两道题各触发一次只算一条)。 */
  achievements: readonly Achievement[]
  /** 章末的会话首通数 —— 交回调用方存着,下一章再带进来。 */
  sessionCleared: number
}>

/** 章开始时的那笔空账。`mergeSettlement` 拿它当加法的单位元。 */
export const EMPTY_CHAPTER_SETTLEMENT: ChapterSettlement = {
  starDust: 0,
  luckyReward: 0,
  achievements: [],
  sessionCleared: 0,
}

/**
 * 把一题的结算并进本章的账。**纯函数** —— 攒账本身不碰服务、不写库(写库在 `settleLevel` 里已经做了)。
 *
 * `sessionCleared` 是**取最新**而不是相加:它是 `settleLevel` 交回的绝对量
 *(「本次会话已首通的关数」),相加会把它翻倍。
 */
export function mergeSettlement(into: ChapterSettlement, next: LevelSettlement): ChapterSettlement {
  const seen = new Set(into.achievements.map((achievement) => achievement.id))
  return {
    starDust: into.starDust + next.starDust,
    luckyReward: into.luckyReward + next.luckyReward,
    achievements: [...into.achievements, ...next.achievements.filter((a) => !seen.has(a.id))],
    sessionCleared: next.sessionCleared,
  }
}
```

`src/features/pinyin-blocks/index.ts` 里把 `export type { LevelSettlement } from './settle'` 换成：

```ts
export {
  EMPTY_CHAPTER_SETTLEMENT,
  mergeSettlement,
  type ChapterSettlement,
  type LevelSettlement,
} from './settle'
```

- [ ] **Step 4: 跑测试，确认绿**

```bash
npx vitest run src/features/pinyin-blocks/settle.test.ts
```

期望：PASS。

- [ ] **Step 5: 提交**

```bash
git add src/features/pinyin-blocks/settle.ts src/features/pinyin-blocks/settle.test.ts src/features/pinyin-blocks/index.ts
git commit -m "feat(pinyin-blocks): 章级交账 ChapterSettlement 与 mergeSettlement"
```

---

### Task 8: `ChapterRun.tsx` —— 章内逐题推进机

替代 `LevelRun.tsx`（一关内三段相位机）。**章内没有过场**，一道接一道自动走；章末把「下一章」的决定交回宿主。

**Files:**
- Create: `src/features/pinyin-blocks/ChapterRun.tsx`
- Delete: `src/features/pinyin-blocks/LevelRun.tsx`
- Modify: `src/features/pinyin-blocks/index.ts`（`LevelRun` 导出换成 `ChapterRun`）
- Test: `src/features/pinyin-blocks/ChapterRun.test.tsx`（新建）

**Interfaces:**
- Consumes: `PinyinBlocksGame` / `SectionResult`（已有）、`starsFor`（已有）、`Chapter`（T1）、`ReviewQuestion` / `MistakePool`（T3）、`Unit`（已有）
- Produces:
  - `export type ChapterItem = Readonly<{ kind: 'level'; levelIndex: number }> | Readonly<{ kind: 'review'; levelIndex: number; question: ReviewQuestion }>`
  - `export type QuestionEnd = Readonly<{ levelId: string; stars: number; wrongBlocks: readonly Block[]; exact: boolean }>`
  - `export function ChapterRun(props: ChapterRunProps): ReactElement | null`，props 见下

- [ ] **Step 1: 写失败测试**

新建 `src/features/pinyin-blocks/ChapterRun.test.tsx`：

```tsx
import { act, fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SPEAK_OF, type Block, type BlockType } from './blocks'
import { UNITS } from './levels'
import { canPlace, slotsFor } from './rules'
import { ChapterRun, type ChapterItem, type QuestionEnd } from './ChapterRun'

const unit = UNITS[0]!
const speak = vi.fn()

/** 推一段虚拟时间 —— 落块到「题结束」之间有一段动画(成功 1.6s / 焊死 2.1s)。 */
const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

function mount(items: readonly ChapterItem[], onQuestionEnd = vi.fn<[], Promise<void>>(async () => {})) {
  const onDone = vi.fn()
  const view = render(
    <ChapterRun
      unit={unit}
      unitIndex={0}
      chapter="easy"
      items={items}
      speak={speak}
      onQuestionEnd={onQuestionEnd}
      onDone={onDone}
    />,
  )
  return { view, onDone, onQuestionEnd }
}

// 下面三个辅助**照抄** `LevelEntry.test.tsx:109-151` 的同名实现(托盘取块 / 读块身份 / 点选落位),
// 只把写死的 `UNITS[0].levels[0]` 换成「当前这一题」。别另发明一套取法 ——
// 那套已经踩过坑:块的身份印在里层 `[data-value]` 上,点选走的是 `keyDown Enter`(不是 click)。

/** 托盘里还没入槽的块。 */
function trayBlocks(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-block-id]')).filter(
    (el) => el.closest('[data-slot-id]') === null,
  )
}

/** 读一块托盘积木的身份 —— 类型与值印在里层的 .pblock 上。 */
function blockOf(el: HTMLElement): Block {
  const chip = el.querySelector<HTMLElement>('[data-value]')
  const type = chip?.dataset.type as BlockType | undefined
  const value = chip?.dataset.value
  if (!type || !(type in SPEAK_OF) || value === undefined) {
    throw new Error(`托盘块读不出身份:${chip?.outerHTML ?? '(没有块)'}`)
  }
  return { type, value }
}

/** 把**当前这一题**拼对:按槽序逐个点选正确块,一次不错。 */
function solveCurrent(levelIndex: number): void {
  for (const slot of slotsFor(unit.levels[levelIndex]!)) {
    const fits = trayBlocks().filter((el) => canPlace(blockOf(el), slot))
    const pick = fits.find((el) => blockOf(el).type === slot.type) ?? fits[0]
    expect(pick, `${slot.type}:${slot.value} 在托盘里找不到可放块`).toBeDefined()
    fireEvent.keyDown(pick as HTMLElement, { key: 'Enter' })
  }
}

describe('ChapterRun', () => {
  it('章内一道接一道:第一题结束后自动换到第二题', async () => {
    vi.useFakeTimers()
    const items: ChapterItem[] = [{ kind: 'level', levelIndex: 0 }, { kind: 'level', levelIndex: 1 }]
    const { view, onDone, onQuestionEnd } = mount(items)
    expect(view.container.textContent).toContain(unit.levels[0]!.emoji)

    solveCurrent(0)
    await advance(2000)

    expect(onQuestionEnd, '每题结束都该交一次账').toHaveBeenCalledTimes(1)
    const end = onQuestionEnd.mock.calls[0]![0] as QuestionEnd
    expect(end.levelId).toBe(unit.levels[0]!.id)
    expect(end.exact, '简单章的错块按家族记账').toBe(false)
    expect(onDone, '还有题没走完,不该交账').not.toHaveBeenCalled()
    expect(view.container.textContent).toContain(unit.levels[1]!.emoji)
    vi.useRealTimers()
  })

  it('最后一题走完交 onDone,不再往下走', async () => {
    vi.useFakeTimers()
    const items: ChapterItem[] = [{ kind: 'level', levelIndex: 0 }]
    const { view, onDone } = mount(items)
    solveCurrent(0)
    await advance(2000)
    expect(onDone).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('困难章的错块按精确身份记账', async () => {
    vi.useFakeTimers()
    const items: ChapterItem[] = [{ kind: 'level', levelIndex: 0 }]
    const onQuestionEnd = vi.fn<[], Promise<void>>(async () => {})
    const onDone = vi.fn()
    const view = render(
      <ChapterRun
        unit={unit}
        unitIndex={0}
        chapter="hard"
        items={items}
        speak={speak}
        onQuestionEnd={onQuestionEnd}
        onDone={onDone}
      />,
    )
    solveCurrent(0)
    await advance(2500)
    expect(onQuestionEnd).toHaveBeenCalledTimes(1)
    expect((onQuestionEnd.mock.calls[0]![0] as QuestionEnd).exact).toBe(true)
    vi.useRealTimers()
  })

  it('不传 onQuestionEnd 时(复习章)照走,只是不交账', async () => {
    vi.useFakeTimers()
    const items: ChapterItem[] = [{ kind: 'level', levelIndex: 0 }]
    const onDone = vi.fn()
    const view = render(
      <ChapterRun unit={unit} unitIndex={0} chapter="review" items={items} speak={speak} onDone={onDone} />,
    )
    solveCurrent(0)
    await advance(2000)
    expect(onDone, '复习章也不许卡住').toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
```

**注意**：第 4 条（`chapter="review"` 但 `items` 给的是 `kind: 'level'`）刻意混搭 —— 它要测的是**「不传 `onQuestionEnd` 时不落库、但仍往下走」**这条通路，而这条通路与 `kind` 无关。真复习章的 `kind: 'review'` 通路由 T9 的「简单章的错块跨章活着」覆盖。

- [ ] **Step 2: 跑测试，确认它红**

```bash
npx vitest run src/features/pinyin-blocks/ChapterRun.test.tsx
```

期望：FAIL —— `./ChapterRun` 不存在。

- [ ] **Step 3: 实现**

新建 `src/features/pinyin-blocks/ChapterRun.tsx`：

```tsx
// 一章的推进机:章内一道接一道自动走,章末把决定权交回宿主(进下一章 / 回地图)。
// 复用 PinyinBlocksGame,只换入参 —— 不写第二套拼装台。
// **按 (章, 题号) 换 key 重挂** —— 换题即清空,不在 effect 里 setState 补重置。

import { useCallback, useState } from 'react'
import type { AnswerKind } from '@/shared/services'
import type { Block } from './blocks'
import type { Chapter } from './chapter'
import type { Unit } from './levels'
import type { ReviewQuestion } from './mistakes'
import { PinyinBlocksGame, type SectionResult } from './PinyinBlocksGame'
import { starsFor } from './rules'

/** 本章要走的题。简单 / 困难章两种都是一道整题;复习章是一道挖空小题。 */
export type ChapterItem =
  | Readonly<{ kind: 'level'; levelIndex: number }>
  | Readonly<{ kind: 'review'; levelIndex: number; question: ReviewQuestion }>

/** 一道题结束的账目。宿主据此落库(简单 / 困难章)与把错块记进池。 */
export type QuestionEnd = Readonly<{
  levelId: string
  /** 本题星级(0~3,`starsFor` 给的)。 */
  stars: number
  /** 本题新错的块。 */
  wrongBlocks: readonly Block[]
  /** 错块是否按**精确身份**记账 —— 困难章的门禁只比类型,介母块与韵母块是两个真身份。 */
  exact: boolean
}>

export type ChapterRunProps = {
  unit: Unit
  unitIndex: number
  chapter: Chapter
  items: readonly ChapterItem[]
  /** 从这一项开始走(章内「接着上次」)。省略 = 从第 0 项。 */
  startIndex?: number
  speak: (text: string) => void
  playSound?: (cue: 'correct' | 'wrong' | 'victory' | 'tap') => void
  onBlock?: (kind: AnswerKind) => void
  /** 一道题结束。**不传 = 这一章不落库**(复习章)。 */
  onQuestionEnd?: (end: QuestionEnd) => Promise<void>
  /** 本章走完 —— 宿主据此进下一章或回地图。 */
  onDone: () => void
}

export function ChapterRun({
  unit,
  unitIndex,
  chapter,
  items,
  startIndex = 0,
  speak,
  playSound,
  onBlock,
  onQuestionEnd,
  onDone,
}: ChapterRunProps) {
  // 起始题号在这里**冻结**:宿主每次渲染都会重算「本章第一道未通的题」,
  // 而走题过程中星级一直在变 —— 现算会把进度往回拽。本组件按 chapter 换 key 重挂,
  // 所以这个初值每章只取一次,正是要的语义。
  const [index, setIndex] = useState(startIndex)
  const item = items[index]

  const advance = useCallback(() => {
    if (index + 1 >= items.length) onDone()
    else setIndex(index + 1)
  }, [index, items.length, onDone])

  const onSectionEnd = useCallback(
    async (result: SectionResult) => {
      if (item?.kind === 'level' && onQuestionEnd) {
        const level = unit.levels[item.levelIndex]
        if (level) {
          // **先 await 再推进**:孩子在这一题的庆祝动画里按「回地图」,那时这一题必须已经落库。
          await onQuestionEnd({
            levelId: level.id,
            stars: starsFor(result.missCount),
            wrongBlocks: result.wrongBlocks,
            exact: chapter === 'hard',
          })
        }
      }
      advance()
    },
    [item, unit, chapter, onQuestionEnd, advance],
  )

  if (!item) return null

  return (
    <PinyinBlocksGame
      // 换题即换 key ⇒ 盘面、提示、错题池全部重来。
      key={`${chapter}-${index}`}
      unitIndex={unitIndex}
      levelIndex={item.levelIndex}
      stage={chapter === 'hard' ? 'hard' : 'easy'}
      review={item.kind === 'review' ? item.question : null}
      reviewProgress={item.kind === 'review' ? { done: index + 1, total: items.length } : undefined}
      speak={speak}
      playSound={playSound}
      onBlock={onBlock}
      onSectionEnd={onSectionEnd}
    />
  )
}
```

删掉 `src/features/pinyin-blocks/LevelRun.tsx`：

```bash
git rm src/features/pinyin-blocks/LevelRun.tsx
```

`src/features/pinyin-blocks/index.ts`：`export { LevelRun } from './LevelRun'` 换成

```ts
export { ChapterRun, type ChapterItem, type ChapterRunProps, type QuestionEnd } from './ChapterRun'
```

**注意**：此时 `LevelEntry.tsx` 还在 import 已删掉的 `LevelRun` —— 这是**预期的过渡态**，T9 会把它整支换掉。`npm test` 里 `LevelEntry.test.tsx` 会红到 T9 为止。

- [ ] **Step 4: 跑测试，确认绿**

```bash
npx vitest run src/features/pinyin-blocks/ChapterRun.test.tsx
```

期望：PASS（4 条）。

- [ ] **Step 5: 提交**

```bash
git add src/features/pinyin-blocks/ChapterRun.tsx src/features/pinyin-blocks/ChapterRun.test.tsx src/features/pinyin-blocks/index.ts
git rm --cached src/features/pinyin-blocks/LevelRun.tsx 2>/dev/null || true
git commit -m "feat(pinyin-blocks): ChapterRun 章内逐题推进机,取代 LevelRun"
```

（`LevelRun.tsx` 的删除已经在上一步 `git rm` 里进了暂存区，本步骤的 `git add` 只补其余文件。若 `git status` 显示删除已暂存，直接提交即可。）

---

### Task 9: `UnitEntry.tsx` —— 单元运行宿主 + App 接线 + 走查

**Files:**
- Create: `src/features/pinyin-blocks/UnitEntry.tsx`
- Delete: `src/features/pinyin-blocks/LevelEntry.tsx`、`src/features/pinyin-blocks/LevelEntry.test.tsx`
- Create: `src/features/pinyin-blocks/UnitEntry.test.tsx`
- Modify: `src/features/pinyin-blocks/index.ts`
- Modify: `src/app/App.tsx:7,63-88`、`src/app/useAppState.ts`
- Modify: `src/app/useAppState.test.tsx`
- Modify: `docs/walkthrough.md`（**同一个提交**）

**Interfaces:**
- Consumes: `ChapterRun` / `ChapterItem` / `QuestionEnd`（T8）、`chapterLevels` / `chapterClearedCount` / `nextChapterOf`（T2）、`chapterReviewQuestions`（T3）、`ChapterSettlement` / `EMPTY_CHAPTER_SETTLEMENT` / `mergeSettlement`（T7）
- Produces:
  - `export function UnitEntry(props: { unitIndex: number; initialChapter: Chapter; onExitToMap(): void; onSettle(result: ChapterSettlement): void }): ReactElement`
  - `useAppState()` 的 `AppState` 长出 `currentChapter: Chapter | null`，`enterUnit(unitIndex: number, chapter: Chapter): void`

- [ ] **Step 1: 写失败测试**

新建 `src/features/pinyin-blocks/UnitEntry.test.tsx`（`git mv src/features/pinyin-blocks/LevelEntry.test.tsx src/features/pinyin-blocks/UnitEntry.test.tsx` 之后就地改）。改动分三处：

**(a)** 顶部的 `mountLevelEntry` 改名 `mountUnitEntry`，加章参数，其余（服务注册那段，一个服务都不许少）原样保留：

```tsx
function mountUnitEntry(opts: { unitIndex?: number; chapter?: Chapter } = {}) {
  const { unitIndex = 0, chapter = 'easy' } = opts
  // …服务注册那段从 mountLevelEntry 原样搬过来,一个字不改…
  const onSettle = vi.fn()
  const utils = render(
    <UnitEntry unitIndex={unitIndex} initialChapter={chapter} onExitToMap={vi.fn()} onSettle={onSettle} />,
  )
  return { ...utils, onSettle }
}
```

**(b)** 三个辅助（`trayBlocks` / `blockOf` / `solveCorrectly` / `fillWrongOnce` / `settle` / `transition`）**原样保留**。`solveCorrectly` 里写死的 `UNITS[0]!.levels[0]!` 要改成参数：

```tsx
/** 按题目要求把正确块一个个点进去(点选路径 = 自动落位),一次不错。缺省跑本单元第一道题。 */
function solveCorrectly(levelIndex = 0) {
  for (const slot of slotsFor(UNITS[0]!.levels[levelIndex]!)) {
    const fits = trayBlocks().filter((el) => canPlace(blockOf(el), slot))
    const pick = fits.find((el) => blockOf(el).type === slot.type) ?? fits[0]
    expect(pick, `${slot.type}:${slot.value} 在托盘里找不到可放块`).toBeDefined()
    fireEvent.keyDown(pick as HTMLElement, { key: 'Enter' })
  }
}

/** 把一整个章的题全部拼对(逐题:拼 → 等落地动画 → 下一题自动上屏)。 */
async function solveChapter(levelIndexes: readonly number[]) {
  for (const index of levelIndexes) {
    solveCorrectly(index)
    await settle()
  }
}
```

`fillWrongOnce` 同样加 `levelIndex = 0` 参数。**`solveChapter` 里没有 `transition()`** —— 章内题与题之间没有过场，这正是 T8/T9 要钉的节律；`transition()` 只在**章末**用。

**(c)** 原有三个 describe（「撒花接线」/「连击圆点」/「三段相位」）里凡是写死单关的断言，跟着章口径改；「复习段错题池接线」整个 describe 换成下面的新用例。

测试正文：

```tsx
describe('UnitEntry —— 章状态机与错题池', () => {
  const u1Easy = UNITS[0]!.levels.filter((l) => l.stage !== 'hard').length
  const u1HardStart = UNITS[0]!.levels.findIndex((l) => l.stage === 'hard')

  it('简单章走完自动进困难章(章末过场 1.2s)', async () => {
    mountUnitEntry({ unitIndex: 0, chapter: 'easy' })
    await solveChapter(Array.from({ length: u1Easy }, (_, i) => i))
    await transition() // 只有章末才有过场
    // 困难章第一道题上屏:它的 emoji 与简单章第一道不同
    expect(document.body.textContent).toContain(UNITS[0]!.levels[u1HardStart]!.emoji)
  })

  it('章内两道题之间没有过场(拼完直接换题)', async () => {
    mountUnitEntry({ unitIndex: 0, chapter: 'easy' })
    solveCorrectly(0)
    await settle()
    expect(document.querySelector('[data-stage-transition]'), '章内不该出过场').toBeNull()
    expect(document.body.textContent).toContain(UNITS[0]!.levels[1]!.emoji)
  })

  it('从地图带困难章进来,就直接落在困难章', async () => {
    mountUnitEntry({ unitIndex: 0, chapter: 'hard' })
    expect(document.body.textContent).toContain(UNITS[0]!.levels[u1HardStart]!.emoji)
  })

  // Review Focus #1:章走到一半退出,欠着的账必须**当场**交出去 —— 不是等章末。
  it('中途退出到地图:先把已落库的那笔账交出去,且只交一次', async () => {
    const { onSettle } = mountUnitEntry({ unitIndex: 0, chapter: 'easy' })
    solveCorrectly(0)
    await settle()
    fireEvent.click(document.querySelector<HTMLElement>('[aria-label="回地图"]')!)
    expect(onSettle, '退出时把这一笔交出去').toHaveBeenCalledTimes(1)
  })

  it('章末交账一次;章末之后按回地图不再重复交', async () => {
    const { onSettle } = mountUnitEntry({ unitIndex: 0, chapter: 'easy' })
    await solveChapter(Array.from({ length: u1Easy }, (_, i) => i))
    await transition()
    expect(onSettle, '章末交账').toHaveBeenCalledTimes(1)
    fireEvent.click(document.querySelector<HTMLElement>('[aria-label="回地图"]')!)
    expect(onSettle, '已经交过的账不许再交一次(弹层会重放)').toHaveBeenCalledTimes(1)
  })

  // Review Focus #2:池跨章活着 —— 简单章点错的块,要到**困难章之后的复习章**才被考到。
  it('简单章的错块跨章活着:进复习章时池里有它们', async () => {
    mountUnitEntry({ unitIndex: 0, chapter: 'easy' })
    // 简单章第一题上故意把**韵母**类点错两次(阈值 N = 2)⇒ 入池。原样搬 LevelEntry.test.tsx:416。
    const host = trayBlocks().find((el) => {
      const block = blockOf(el)
      return block.type === 'final' && block.value !== UNITS[0]!.levels[0]!.syl[0]!.final
    })
    expect(host, '托盘中找不到要故意点错的韵母块').toBeDefined()
    fireEvent.keyDown(host as HTMLElement, { key: 'Enter' })
    fireEvent.keyDown(host as HTMLElement, { key: 'Enter' })
    await solveChapter(Array.from({ length: u1Easy }, (_, i) => i))
    await transition() // → 困难章
    await solveChapter(Array.from({ length: 6 }, (_, i) => u1HardStart + i))
    await transition() // → 复习章
    const dots = document.querySelector<HTMLElement>('[data-review-dots]')
    expect(dots, '复习章没上屏').not.toBeNull()
    expect(dots!.querySelectorAll('.pstage-dot').length, '池空就该只有 1 颗兜底点').toBeGreaterThan(1)
  })
})
```

（最后那条断言是**池跨了两次换章**的判据：池没跟着走的话，复习章拿到的池是空的，只会画 1 颗兜底点。）

- [ ] **Step 2: 跑测试，确认它红**

```bash
npx vitest run src/features/pinyin-blocks/UnitEntry.test.tsx
```

期望：FAIL —— `./UnitEntry` 不存在。

- [ ] **Step 3: 实现 `UnitEntry.tsx`**

新建 `src/features/pinyin-blocks/UnitEntry.tsx`：把 `LevelEntry.tsx` 的服务注入与头部（回地图按钮 + 连击圆点）原样搬过来，把中间的「关卡索引 + 三段」换成章状态机。

```tsx
import { useCallback, useMemo, useRef, useState } from 'react'
import {
  AchievementService, AudioService, CelebrateService, celebrationFor, ComboService,
  LuckyBonusService, PinyinProgressService, SettingsService, SpeechService, type AnswerKind,
} from '@/shared/services'
import { useService, useServiceSnapshot } from '@/shared/services/core'
import { cn } from '@/shared/ui/utils'
import { ChapterRun, type ChapterItem, type QuestionEnd } from './ChapterRun'
import type { Chapter } from './chapter'
import { UNITS } from './levels'
import { addToPool, chapterReviewQuestions, exactPoolKey, type MistakePool } from './mistakes'
import { chapterClearedCount, chapterLevels, chapterTotal, nextChapterOf } from './progress-stats'
import { EMPTY_CHAPTER_SETTLEMENT, mergeSettlement, settleLevel, type ChapterSettlement } from './settle'
import { StageTransition } from './StageTransition'

/** 连击圆点:5 颗封顶 —— 再多也读不出来,而 5 正好对上第一个撒花档。 */
const COMBO_DOTS = [0, 1, 2, 3, 4] as const

export function UnitEntry({
  unitIndex,
  initialChapter,
  onExitToMap,
  onSettle,
}: {
  unitIndex: number
  /** 从地图点进来时选的那一章。 */
  initialChapter: Chapter
  onExitToMap(): void
  /** 一章走完交一次账(或退出到地图时补交)。 */
  onSettle(result: ChapterSettlement): void
}) {
  const progress = useService(PinyinProgressService)
  const settings = useService(SettingsService)
  const combo = useService(ComboService)
  const lucky = useService(LuckyBonusService)
  const achievements = useService(AchievementService)
  const speech = useService(SpeechService)
  const audio = useService(AudioService)
  const celebrate = useService(CelebrateService)
  const progressSnap = useServiceSnapshot(progress)
  const settingsSnap = useServiceSnapshot(settings)
  const comboSnap = useServiceSnapshot(combo)

  const [sessionCleared, setSessionCleared] = useState(0)
  const [chapter, setChapter] = useState<Chapter>(initialChapter)
  /** 错题池:**跨章**活着(简单章 + 困难章的错合并成一个池)。退出到地图即随组件卸载丢弃。 */
  const [pool, setPool] = useState<MistakePool>([])
  /** 已落库、还没交出去的账。**必须是 ref** —— 它跨整章活着。 */
  const pending = useRef<ChapterSettlement | null>(null)

  const unit = UNITS[unitIndex] ?? UNITS[0]!
  const stars = progressSnap.data.stars
  const comboLit = Math.min(comboSnap.combo, COMBO_DOTS.length)
  const speak = useCallback((text: string) => speech.speak(text, 'zh-CN'), [speech])

  /**
   * 本章的题表。复习章由错题池当场决定(§5),其余取课程数据。
   *
   * `levelIndex` 一律是**在 `unit.levels` 里的下标** —— `ChapterRun` 拿它直接索引。
   * `unit.levels` 里简单题全在前、困难题全在后,所以 `chapterLevels` 的下标与它同序。
   */
  const items: readonly ChapterItem[] = useMemo(() => {
    if (chapter === 'review') {
      return chapterReviewQuestions(unit, unitIndex, pool).map((item) => ({
        kind: 'review' as const,
        levelIndex: item.levelIndex,
        question: item.question,
      }))
    }
    return chapterLevels(unit, chapter).map((level) => ({
      kind: 'level' as const,
      levelIndex: unit.levels.indexOf(level),
    }))
  }, [chapter, unit, unitIndex, pool])

  /**
   * 本章从哪道题接着走 = 该章**第一道未通的题**(§7)。
   *
   * 这一项**不是 state**:它每次渲染都重算是**有意的** —— `ChapterRun` 把它冻在自己的挂载状态里,
   * 而 `ChapterRun` 按 `chapter` 换了 key,所以每章只取一次初值。
   * 复习章恒从 0 起(它的题从不落库,没有「通过」这一说)。
   */
  const startIndex = chapter === 'review'
    ? 0
    : Math.max(0, items.findIndex((item) => item.kind === 'level' && (stars[unit.levels[item.levelIndex]!.id] ?? 0) === 0))

  /** 落库 + 把错块记进池。**每道题结束时调一次**。 */
  const endQuestion = useCallback(
    async (end: QuestionEnd) => {
      setPool((cur) => addToPool(cur, end.wrongBlocks, end.exact ? exactPoolKey : undefined))
      const result = await settleLevel(
        {
          levelId: end.levelId,
          stars: end.stars,
          currentStars: progressSnap.data.stars,
          totalStars: progressSnap.data.totalStars,
          settings: settingsSnap.data,
          sessionCleared,
          maxCombo: combo.getSnapshot().maxCombo,
        },
        { progress, settings, combo, lucky, achievements },
      )
      setSessionCleared(result.sessionCleared)
      pending.current = mergeSettlement(pending.current ?? EMPTY_CHAPTER_SETTLEMENT, result)
    },
    [progressSnap, settingsSnap, sessionCleared, progress, settings, combo, lucky, achievements],
  )

  /** 发 onSettle + 撒花。**只发一次** —— 发完就清账,章末与中途退出共用这一条路。 */
  const flush = useCallback(() => {
    const result = pending.current
    if (!result) return
    pending.current = null
    onSettle(result)
    // 一次成功只撒一次花,而**一章只撒一次**(spec §7.1)—— 逐题撒花会把「拼对了」这件小事淹掉。
    // 两个分支各自弹层都有自己的档(成就 `achievement` / 幸运 `lucky`),所以「让掉 `word`」
    // 在两个分支上是同一个道理:不让就是两记撒花叠在同一个通关上,把「发生了什么」糊掉。
    if (result.achievements.length === 0 && result.luckyReward <= 0) celebrate.play('word')
  }, [onSettle, celebrate])

  /** 本章走完 → 交账 → 进下一章(过场)或回地图。 */
  const handleChapterDone = useCallback(() => {
    flush()
    const next = nextChapterOf(unit, chapter)
    if (next) setChapter(next)
    else onExitToMap()
  }, [flush, unit, chapter, onExitToMap])

  /** 头部「回地图」。**先交账再走** —— 章走到一半退出时,onSettle 还欠着。 */
  const handleExit = useCallback(() => {
    flush()
    onExitToMap()
  }, [flush, onExitToMap])

  // 连击的落点:每放一块上报一次。放对 'first'、放错 'wrong'。
  // 复习章不上报(见 PinyinBlocksGame 的 penalized),免得复习变成刷连击的通道。
  const handleBlock = useCallback(
    (kind: AnswerKind) => {
      const tier = celebrationFor(combo.answer(kind))
      if (tier) celebrate.play(tier)
    },
    [combo, celebrate],
  )

  const cleared = chapter === 'review' ? 0 : chapterClearedCount(stars, unit, chapter)
  const total = chapter === 'review' ? 0 : chapterTotal(unit, chapter)

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={handleExit}
          aria-label="回地图"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-surface/70 text-ink-2"
        >
          ←
        </button>
        <span className="flex items-center gap-2">
          <span
            data-combo-dots
            data-combo-lit={comboLit}
            aria-label={`连击 ${comboLit}`}
            className="flex items-center gap-1"
          >
            {COMBO_DOTS.map((index) => (
              <span
                key={index}
                aria-hidden
                className={cn('h-2.5 w-2.5 rounded-full', index < comboLit ? 'bg-accent' : 'bg-ink-2')}
              />
            ))}
          </span>
          {/* 复习章不显示题数 —— 它的题由池当场决定,那个分母这一刻还在变。
              题内进度由台阶条下面那排点表达(StageDots)。 */}
          {chapter === 'review' ? null : (
            <span data-chapter-progress className="text-sm font-bold text-ink-3 tabular-nums">
              {cleared}/{total}
            </span>
          )}
        </span>
      </div>
      {/* 换章即换 key ⇒ 章内题号、盘面、发牌全部重来;**错题池在上层,跨章不动**。 */}
      {items.length > 0 ? (
        <ChapterRun
          key={chapter}
          unit={unit}
          unitIndex={unitIndex}
          chapter={chapter}
          items={items}
          startIndex={startIndex}
          speak={speak}
          playSound={audio.play}
          onBlock={handleBlock}
          onQuestionEnd={chapter === 'review' ? undefined : endQuestion}
          onDone={handleChapterDone}
        />
      ) : (
        <StageTransition stage={chapter} onDone={handleChapterDone} />
      )}
    </div>
  )
}
```

**说明两处非显然的选择：**

1. `addToPool(cur, blocks, key)` 的第三参传 `undefined` 时用的就是默认的 `familyPoolKey` —— 这是 `mistakes.ts` 已有的签名，实现时照传即可（别写成 `familyPoolKey` 的重复 import）。
2. 空 `items` 那一支渲染 `<StageTransition stage={chapter} onDone={handleChapterDone} />`：`StageTransition` 的 props 正好是 `{ stage: StageId; onDone: () => void }`，而 `StageId` 就是 `Chapter` 的别名，直接传得进；它自己在 1.2s 后调 `onDone`，于是「空章」在**入口处**就被消化掉（正常路径上 `nextChapterOf` 已经跳过空章，这一支是兜底）。

删掉旧文件：

```bash
git rm src/features/pinyin-blocks/LevelEntry.tsx src/features/pinyin-blocks/LevelEntry.test.tsx
```

`src/features/pinyin-blocks/index.ts`：`export { LevelEntry } from './LevelEntry'` 换成

```ts
export { UnitEntry } from './UnitEntry'
```

- [ ] **Step 4: 跑测试，确认绿**

```bash
npx vitest run src/features/pinyin-blocks/UnitEntry.test.tsx
```

期望：PASS（4 条）。

**若第 4 条（池跨章）红**：说明 `pool` 没跨章活着 —— 检查 `items` 的 `useMemo` 依赖里有 `pool`（有），以及 `ChapterRun` 的 `key` **只是 `chapter`**、没有把 `pool` 拼进去（拼进去就会每章重置）。

- [ ] **Step 5: 接 App**

`src/app/useAppState.ts` 全文换成：

```ts
import { useState } from 'react'
import type { Chapter } from '@/features/pinyin-blocks'

export type AppPhase = 'boot' | 'login' | 'map' | 'level' | 'parent'

export interface AppState {
  phase: AppPhase
  currentUnitIndex: number | null
  /** 当前所在的章。与单元一起构成关卡页的身份 —— 两者缺一就不进关卡页。 */
  currentChapter: Chapter | null
  actions: {
    enterUnit(unitIndex: number, chapter: Chapter): void
    exitToMap(): void
    openParent(): void
    closeParent(): void
  }
}

/** 五个相位:登录 → 单元地图 → 单元(章),外加一个家长面板。地图是唯一的「家」。 */
export function useAppState(): AppState {
  const [phase, setPhase] = useState<AppPhase>('boot')
  const [currentUnitIndex, setCurrentUnitIndex] = useState<number | null>(null)
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null)

  return {
    phase,
    currentUnitIndex,
    currentChapter,
    actions: {
      enterUnit(unitIndex, chapter) {
        setCurrentUnitIndex(unitIndex)
        setCurrentChapter(chapter)
        setPhase('level')
      },
      exitToMap() {
        setCurrentUnitIndex(null)
        setCurrentChapter(null)
        setPhase('map')
      },
      openParent() {
        setPhase('parent')
      },
      closeParent() {
        setPhase('map')
      },
    },
  }
}
```

`src/app/useAppState.test.tsx` 里的三处 `enterUnit(n)` 改成 `enterUnit(n, 'easy')`，并加一条：

```tsx
it('map → level:enterUnit 记下单元与章', () => {
  const { result } = renderHook(() => useAppState())
  act(() => result.current.actions.enterUnit(2, 'hard'))
  expect(result.current.phase).toBe('level')
  expect(result.current.currentUnitIndex).toBe(2)
  expect(result.current.currentChapter).toBe('hard')
  act(() => result.current.actions.exitToMap())
  expect(result.current.currentChapter).toBeNull()
})
```

`src/app/App.tsx`：

- import 行：`import { UnitEntry, MapEntry, type ChapterSettlement } from '@/features/pinyin-blocks'`
- `type Celebration = Readonly<{ achievements: ChapterSettlement['achievements']; luckyReward: number }>`
- `function handleSettle(result: ChapterSettlement) { … }`（函数体一字不改）
- `const { phase, currentUnitIndex, currentChapter, actions } = useAppState()`
- 关卡页分支：

```tsx
  } else if (phase === 'level' && currentUnitIndex !== null && currentChapter !== null) {
    // 设置没就绪就进不去 —— 宁可进不去,也不能拿默认值覆盖服务端。
    // 显式三元而非把条件并进上层 if:并进去会落到下面的地图分支(静默进地图)。
    content = settingsSnap.status === 'ready'
      ? <UnitEntry
          key={`unit-${currentUnitIndex}-${currentChapter}`}
          unitIndex={currentUnitIndex}
          initialChapter={currentChapter}
          onExitToMap={actions.exitToMap}
          onSettle={handleSettle}
        />
      : <BootScreen />
```

（`key` 里必须带章 —— 孩子回地图、再点同一单元的**另一章**时，不带章就会复用同一个实例、忽略 `initialChapter`。）

- [ ] **Step 6: 跑全表**

```bash
npm test
```

期望：PASS。此时 `LevelEntry.test.tsx` 已随文件删除，`UnitEntry.test.tsx` 接棒。

```bash
npx tsc -b --noEmit
```

期望：干净（T3 遗留的 `LevelRun.tsx` 那条已经在 T8 消失）。

- [ ] **Step 7: 更新 `docs/walkthrough.md`（同一个提交）**

改 `docs/walkthrough.md` 四处：

**(a)** §B 的 `W-C2` 「进第 1 单元(右上角显示 **1/6**)」改成「进第 1 单元的**简单章**(右上角显示该章的 **已通/总数**)」。

**(b)** `W-C5` 的期望改成：

```
**不卡死、不丢块**;随后**直接进下一题**(章内没有过场);本章最后一题走完才出**换章过场**
```

**(c)** `W-C8` 换成：

```
| **W-C8** 解锁 | 任意设备 | 把第 1 单元的**简单章**全部走完(困难章一道不做) | 章末**自动**回地图:第 2 单元的 🔒 **消失且可点进去**;第 1 单元的**困难章那行**已解锁(不再灰) |
```

**(d)** `W-C10` / `W-C11` 换成：

```
| **W-C10** 一个单元三章能走完 | 任意设备 | 从地图点第 1 单元的**简单章**,把整章走完 → 章末过场 → 困难章走完 → 章末过场 → 复习章做完;再点单元页左上 **←** 回地图 | 三章依次都到得了;**章内题与题之间没有过场**、两处**章间过场**各一次;回地图后地图上该单元**第一行(简单章)的 `n/m` 加满** |
| **W-C11** 困难章答错不阻塞 | 任意设备,走到困难章 | 只按**类型**放对、故意让**值**错、把槽填满,连错到**重试用尽** | 判错时**错槽被指出、错块被撤回**;用尽后**自动演示正解**、答案行亮起并朗读,随后**照常进下一题、照常通关** —— 地图上**不出现任何失败标记** |
```

**(e)** §C 的「### 一关三段(简单 / 困难 / 复习)」整节**改名并改写**成：

```markdown
### 一个单元三章(简单 / 困难 / 复习)

> **本组(`W-T*`)是「单元三章」条目。** 一个单元 = 三章,每章是一个连续的题池:
> 先把本单元所有题在**简单章**里走完,再用**另一批音节**在**困难章**里走一遍,最后进**复习章**重考本单元错过的块。
> 章与章之间有 1.2s 过场,**章内的题与题之间没有过场**。

| # | 前提 | 操作 | 期望 |
|---|---|---|---|
| **W-T1** 台阶条三章形态 | 任意设备,进任一单元的任一章 | 依次走过三章,每次看题面图上方的台阶条(三根竖条并排、**越右越高**) | **简单章亮第 1 格**;**困难章亮第 1 + 2 格**(都橙);**复习章第 1 + 2 格保持橙、第 3 格转灰蓝** —— 第 3 格**不是橙** |
| **W-T2** 台阶条与连击圆点不混 | 任意设备 | 一眼扫过屏幕:题面图上方的台阶条(竖条)与右上角那排连击圆点 | 两组同时在场、**一眼分得开** —— 台阶条是**三根高矮不一的竖条**、连击圆点是**一排等大的小圆点** |
| **W-T3** 章间过场,章内不过场 | 任意设备,进任一单元的简单章 | 走完**一道题**盯住屏幕;再走完**整章**盯住屏幕 | **题与题之间没有遮罩** —— 拼对后约 1.6s 直接换下一道题面;**章末**压一层暗遮罩、屏幕中央出现**放大的台阶条**,约 **1.2s** 后散去进下一章。简单→困难亮到第 2 格(橙),困难→复习亮到第 3 格(**灰蓝**) |
| **W-T4** 减动效下的章间过场 | 系统开启「减少动态效果」 | 重复 `W-T3` 的章末那一次 | 过场**不播缩放 / 逐格点亮动画**(退化成静态帧),但**仍停留约 1.2s**;亮格仍看得清是哪一格 |
| **W-T5** 困难章槽恒亮(弱档单元) | 任意设备,**u9–u12 各走一章** | 进困难章后看拼装台的槽与积木盘 | 槽是**实线边**、且**类型色恒亮**(u9–u12 也一样看得见,不被淡成灰砖);积木盘**底色压暗 + 一圈橙实线环** |
| **W-T6** 困难章每类都有能落位的对手块 | 任意设备,进任一单元的困难章 | 把一块**类型对、值不对**的块拖到它那一类的空槽上;再回同一单元的**简单章**做同一件事。**注意:困难章的托盘块数不一定比简单章多**,别去数块数 | **困难章放得进去**(槽吃下它、块**留在槽里**也不弹回);**简单章同一块被弹回**(该槽红一下、块不落位)。困难章里**每一类槽都至少有一块这样的对手块**;声调那一行照旧四声全出,同样放得进 |
| **W-T7** 困难章判错与重试 | 任意设备,进任一单元的困难章 | 只按**类型**放对、故意让**值**错,把槽填满 | 填满当场判错:**错槽红描边并抖动**;约 **720ms** 后**错块被撤回托盘**、槽空出,可以重放 |
| **W-T8** 困难章重试用尽 | 任意设备,进任一单元的困难章 | 连续三次把值放错、每次都等判错走完 | 前两次判错都**撤块可重试**;第 **3** 次判错后**自动把正解一块块落进槽**(演示),**答案行亮起拼音 + 汉字**并朗读,随后照常**进下一题**、这一单元照常通关 |
| **W-T9** 复习章预填槽锁死 | 任意设备,走到复习章 | 点那些**已经填好**的槽(挖空的那几个之外) | **点不动** —— 不响、不弹回、槽里的块**拿不回来**;只有挖空的那几个槽能操作 |
| **W-T10** 复习章小题进度点 | 任意设备,走到复习章(本单元错过若干块时最多 3 道小题) | 看台阶条第 3 格**正下方**,做完一道小题再看一眼 | 有 **1~3 颗灰蓝小点**、**做完一道亮一颗**;错题池空时只有 **1 颗**(整题重做),同样做完亮起 |
| **W-T11** 复习章不记 miss、不动连击 | 任意设备,走到复习章。**先记下右上角连击圆点亮着几颗** | 复习小题里**故意把块放错**,做完这道小题再**故意把块放对**(两边都试);每次都看一眼右上角连击圆点 | 放错**只抖一下、块弹回**;**放错或放对都不动连击圆点** —— 亮着的颗数**不变**(不点亮、也不清零);这一段做得再差也**不掉星** |
| **W-T12** 章内中途退出,已过的题落库了 | 任意设备,先让简单章走到**第 2 道题**(不要走完) | 点单元页左上 **←** 回地图,**再进同一单元的简单章** | 该章**从第 2 道题接着来**(不是从头);地图上简单章那行的 `n/m` **已经加过第 1 道** —— 星是**逐题落库**的 |
| **W-T13** 托盘两端各走一章 | 任意设备 | 分别走 **u1 的单音节章**与 **`xī guā` 的双音节三拼章**(托盘最小与最大的两头) | 两端都能把三章走完;u1 每道题 **2 个槽**(韵母 + 声调)在三章里都**填得进、盘面不溢出**;`xī guā` 的两组槽在三章里都**分得开、不被压扁** |
| **W-T14** 困难章第一轮是不是在「猜」(**人眼判断**) | 任意设备,进任一单元的困难章(**首推 u5 / u6 / u7 这类带真对手块的单元**) | 盯住困难章的**第一轮** —— 这时的题面是孩子**没见过的音节**,没有「刚亮过的答案」可抄 | 看孩子(或你自己**装作 4~8 岁的孩子**)是不是**只按类型**挑块 —— 那类槽空着就随手拿同类里任意一块塞进去,值的对错根本没过脑子。**记录「是 / 否」**。**若判「是」= 太难或太易**(两种读法都要记):这是**设计问题,不是代码问题** —— 回去改 spec 里困难题的选题规则(§9.1),走一次 spec 修订;**不许**在现场悄悄改代码。这一条 `npm test` 判不了,只有人眼能判 |
```

- [ ] **Step 8: 提交**

```bash
git add src/features/pinyin-blocks/UnitEntry.tsx src/features/pinyin-blocks/UnitEntry.test.tsx src/features/pinyin-blocks/index.ts src/app/App.tsx src/app/useAppState.ts src/app/useAppState.test.tsx docs/walkthrough.md
git commit -m "feat(pinyin-blocks): UnitEntry 单元运行宿主 + App 接线 + 走查同步"
```

---

### Task 10: 地图三层格

**Files:**
- Modify: `src/features/pinyin-blocks/UnitMap.tsx:8-22,110-160`（props + 网格）
- Modify: `src/features/pinyin-blocks/MapEntry.tsx`
- Modify: `src/features/pinyin-blocks/UnitMap.test.tsx`、`src/features/pinyin-blocks/material.test.ts:235-261`
- Modify: `src/index.css:470-475`（删 `.pstar` / `.pstar--on`）
- Modify: `docs/walkthrough.md`（**同一个提交**）

**Interfaces:**
- Consumes: `chapterLevels` / `chapterTotal` / `chapterClearedCount` / `chapterEnterable` / `isChapterUnlocked` / `isUnitUnlocked`（T2）、`CHAPTERS`（T1）
- Produces: `UnitMapProps.onPick(unitIndex: number, chapter: Chapter): void`；新增可选 `units?: readonly Unit[]`（默认 `UNITS`，供测试喂合成单元）

- [ ] **Step 1: 写失败测试**

改 `src/features/pinyin-blocks/UnitMap.test.tsx`：

1. `base` props 里的 `onPick` 签名不变（`vi.fn()` 能吃两个参数）。**「u1 解锁可点、u2 锁上点不动」那条的断言要改**：

```tsx
    fireEvent.click(cellOf('u1')) // 现在点的是格子的**第一行章按钮**
    expect(onPick).toHaveBeenCalledWith(0, 'easy')
```

（`cellOf` 取的是 `[data-unit-id]` 容器 —— 改 `cellOf` 让它返回容器，再在它里面找 `[data-chapter]` 按钮点。）

2. 加两条：

```tsx
  // 按钮不能套按钮 —— 嵌套的 <button> 是非法 HTML,浏览器会把 DOM 拆散,
  // 孩子点到的可能是半截元素(而且是静默的:jsdom 里查询照样找得到)。
  it('单元格是容器,章按钮在它里面,没有嵌套 button', () => {
    for (const unit of UNITS) {
      const cell = container.querySelector(`[data-unit-id="${unit.id}"]`)!
      expect(cell.tagName).not.toBe('BUTTON')
      const chapters = cell.querySelectorAll('[data-chapter]')
      expect(chapters.length, `${unit.id} 的章按钮数`).toBe(3)
      for (const button of chapters) {
        expect(button.tagName).toBe('BUTTON')
        expect(button.querySelector('button'), '章按钮里套了 button').toBeNull()
      }
    }
  })

  // 空章不进 —— 用合成单元测,不依赖真实数据恰好有空章。
  it('空困难章的单元:困难那一行锁着,复习那一行仍可点', () => {
    const synth: Unit = { id: 'ux', name: '合成', badge: [], levels: [/* 只放简单题,见 base 里的 u1 前 3 道 */] }
    render(<UnitMap {...base} units={[synth]} stars={allEasyStar} />)
    const cell = container.querySelector('[data-unit-id="ux"]')!
    expect(cell.querySelector('[data-chapter="hard"]')!.getAttribute('data-locked')).toBe('true')
    expect(cell.querySelector('[data-chapter="review"]')!.getAttribute('data-locked')).toBe('false')
  })
```

（`allEasyStar` 是「合成单元的简单题全通」的星级表；`synth.levels` 用 `base` 里已有的 u1 关卡对象切前 3 个。）

3. 零文本扫描那条（第 29-36 行）**保持原样** —— 它现在要连三个章按钮一起扫，正是它的价值所在。

4. 删掉 `.pstar` 计数那条（第 54-71 行）—— 星排没了。`src/features/pinyin-blocks/material.test.ts` 里 `T10` 那两条 `.pstar` / `.pstar--on` 的用例（235-261 行附近）一并删；`src/index.css` 的 `.pstar` / `.pstar--on` 两条规则（470-475 行附近）也删（留着就是死代码，而 `material.test.ts` 那条「只该有一条规则」的用例正是为「谁会守它」存在的）。

- [ ] **Step 2: 跑测试，确认它红**

```bash
npx vitest run src/features/pinyin-blocks/UnitMap.test.tsx
```

期望：FAIL —— 没有 `[data-chapter]`。

- [ ] **Step 3: 实现**

`src/features/pinyin-blocks/UnitMap.tsx`：

1. props：`onPick(unitIndex: number, chapter: Chapter): void`，并加可选 `units?: readonly Unit[]`（默认 `UNITS`）。
2. 网格那一整块（`<div className="mx-auto mt-6 grid …">` 里 `UNITS.map(...)` 的整段，110-160 行）换成：

```tsx
      <div className="mx-auto mt-6 grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-3">
        {units.map((unit, index) => {
          const locked = !isUnitUnlocked(index, stars, units)
          return (
            // 容器**不是按钮** —— 一个格子里有三章,三个按钮不能套在一个按钮里。
            // data-unit-id / data-locked 留在容器上:地图测试与走查条目都靠它们定位。
            <div
              key={unit.id}
              data-unit-id={unit.id}
              data-locked={locked ? 'true' : 'false'}
              aria-label={`第 ${index + 1} 单元`}
              className={cn(
                'flex flex-col items-center gap-2 rounded-4xl border-2 border-hairline bg-surface p-4 shadow-card',
                locked ? 'opacity-45' : undefined,
              )}
            >
              <span className="flex min-h-9 flex-wrap items-center justify-center gap-1">
                {unit.badge.map((block, i) => (
                  <BlockChip
                    key={`${block.type}-${block.value}-${i}`}
                    type={block.type}
                    value={block.value}
                    className={BADGE_BOX}
                  />
                ))}
              </span>
              {/* 一行一章。**章名不进地图**(地图在零可见文字的铁律下)——
                  章的类别由台阶条的亮格数表达,与进章之后题面正上方那根是同一套素材、同一套语义。
                  复习章那一行**不显示题数**:它的题由错题池当场决定,地图上没有可数的东西。 */}
              {CHAPTERS.map((chapter) => {
                const open = !locked && isChapterUnlocked(index, chapter, stars, units)
                const enterable = chapterEnterable(unit, chapter)
                const ok = isChapterUnlocked(index, chapter, stars, units) && enterable
                return (
                  <button
                    key={chapter}
                    type="button"
                    data-chapter={chapter}
                    data-locked={ok ? 'false' : 'true'}
                    aria-disabled={!ok}
                    aria-label={`第 ${index + 1} 单元 第 ${CHAPTERS.indexOf(chapter) + 1} 章`}
                    onClick={() => {
                      if (!ok) return
                      onPick(index, chapter)
                    }}
                    className={cn(
                      'flex w-full items-center justify-center gap-1.5 rounded-2xl px-2 py-1 transition-transform',
                      ok ? 'hover:bg-accent/10 active:scale-[0.98]' : 'opacity-45',
                    )}
                  >
                    <StageBar stage={chapter} />
                    {chapter === 'review' ? null : (
                      <span className="text-xs font-bold text-ink-3 tabular-nums">
                        {chapterClearedCount(stars, unit, chapter)}/{chapterTotal(unit, chapter)}
                      </span>
                    )}
                    {ok ? null : <span aria-hidden className="text-sm">🔒</span>}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
```

顶部 import 加 `import { CHAPTERS, type Chapter } from './chapter'`、`import { StageBar } from './StageBar'`，并从 `./progress-stats` 补 `chapterClearedCount` / `chapterEnterable` / `chapterTotal` / `isChapterUnlocked`；`cleared` 若不再被本文件用到就一并去掉 import。

**注意**：`StageBar` 的尺寸是为题面上方那根定的。地图里它会被压在一个小按钮里 —— 375px 下如果它撑破格子，走查条目 `W-M2` 会红，届时**改 `StageBar` 在按钮内的尺寸**（加一个 `small` 之类的类），**不要**改 `.pstage-bar` 的全局规则（那会同时改掉题面上方那根）。

`src/features/pinyin-blocks/MapEntry.tsx`：`onPick(unitIndex, chapter)` 透传给 `UnitMap`（props 类型跟着改成 `onPick(unitIndex: number, chapter: Chapter): void`）。

- [ ] **Step 4: 跑测试，确认绿**

```bash
npx vitest run src/features/pinyin-blocks/UnitMap.test.tsx src/features/pinyin-blocks/material.test.ts
```

期望：PASS。

- [ ] **Step 5: 更新 `docs/walkthrough.md`（同一个提交）**

**(a)** §C「### 地图」里，`W-X1`（12 格宽度）与 `W-X6` / `W-X7`（解锁倒退 / 旧星不丢）改成按**章**计：

```
| **W-M2** 一格三行章 | 窗口 **≥704px**、**640px**、**375px** 各看一次 | 看单元地图每个格子 | 每格是**名片 + 三行章**(不是一排星);三行都**塞得进格子、不溢出、不把名片挤掉**;375px 下三行仍然看得清是**三根高矮不一的竖条**(简单 1 格 / 困难 2 格 / 复习 3 格)。**地图上一个汉字都没有** |
| **W-M3** 章锁 | 先登录,停在地图上 | 看第 1 单元的困难 / 复习那两行,再看第 2 单元的三行 | 第 1 单元的困难行**已经开着**(简单章没走过时它是灰的);第 2 单元的**三行全灰 + 🔒**。**点灰掉的章:不进章、不抖、不响、外观不变**(`W-M1` 的判据)。简单章全通后回地图:困难行**自己开了** |
```

**(b)** 删掉 `W-X2`（「复习关托盘」—— 复习关不存在了）。

**(c)** `W-X6` / `W-X7` 改成：

```
| **W-X6** 解锁倒退(一次性) | 已有星的存档 | 刷新进地图 | u1 的简单章那行显示 `3/6`,**u2 起带 🔒** —— 这是「前一单元**简单章**全通才解锁」在单元变长后的预期表现,**不是 bug** |
| **W-X7** 旧星不丢 | 同上 | 逐道点亮 u1 简单章的新题 → 回地图 | u1 简单章满 `6/6` 后 u2 解锁;旧有的三颗星**自始至终亮着**(在简单章那行的 `n/6` 里) |
```

- [ ] **Step 6: 跑全表 + 提交**

```bash
npm test && npm run lint
```

```bash
git add src/features/pinyin-blocks/UnitMap.tsx src/features/pinyin-blocks/MapEntry.tsx src/features/pinyin-blocks/UnitMap.test.tsx src/features/pinyin-blocks/material.test.ts src/index.css docs/walkthrough.md
git commit -m "feat(pinyin-blocks): 地图单元格改成一格三行章"
```

---

### Task 11: 文档同步

**Files:**
- Modify: `docs/PLAN.md`（当前迭代的 feature 轨加一行）
- Modify: `docs/dev-reference.md`（关卡 / 章结构的描述）
- Modify: `CLAUDE.md`（项目概述里的玩法一句话）

- [ ] **Step 1: `docs/PLAN.md`**

在 `### feature 轨 — 目标 0.2.0` 那条「拼音课程全表扩充」行**之后**（`### feature 轨 — 目标 0.3.0` 之前）追加：

```markdown
- [ ] `P0` `[feature]` 拼音积木「单元三章」(简单章 / 困难章 / 复习章)— 2026-09-28 产品口径「每个关卡分成 3 个部分,简单部分放到一起,接着是困难部分,再接着是复习部分,不是一道题一个循环;简单和困难的题目尽可能有所不同」。**结构**:一个单元 = 三章,每章是一个连续题池 —— 简单章 = 现有全部 91 道题(含原 12 道复习关的题,**题保留、关撤掉**)、困难章 = 手写 91 道**另一批音节**的门禁只比类型的新题、复习章 = 本单元错块重考(不落库)。**八项产品裁定**:①每单元三章(12×3 = 36 章);②困难章用另一批音节;③新题手写;④进度单位仍是**每道题一颗星**(章是分组外壳,后端/迁移零改动);⑤复习章 = 本单元错题,撤掉旧复习关;⑥三章依次锁;⑦困难章直接上(不做难度缓冲);⑧单元锁**放宽**成「前一单元**简单章**全通」—— 题量翻倍后旧口径会让第二单元起几乎推不动。**落库时机**:一题一次 `settleLevel`、结果累积、**章末交账**(撒花一档一次,不是一题一次);复习章全程不落库。**存档零风险**:简单章 id 一字不改 ⇒ 老存档每一颗星原样落回原题、零孤儿键;困难题是新 key ⇒ 取 MAX 后自然「未通」。**代价(产品已知悉)**:星尘的连击加成会被放大(一题结算一次,一个单元约翻一个数量级)、`collector` / `grand_master` 两条成就明显变难 —— spec §13 的裁定是**结算与成就口径一字不改**,先照此实现,实测失真再单开一行改。— [design](superpowers/specs/2026-09-28-pinyin-blocks-chapters-design.md) / [plan](superpowers/plans/2026-09-28-pinyin-blocks-chapters.md)
```

- [ ] **Step 2: `docs/dev-reference.md`**

```bash
grep -n "91\|复习关\|三段\|简单段\|困难段" docs/dev-reference.md
```

把命中的每一处改成章口径：**「12 单元 / 91 关」→「12 单元 / 91 章 / 182 关」**、「一关三段(简单段 / 困难段 / 复习段)」→「一个单元三章(简单章 / 困难章 / 复习章)」、「每单元末一个复习关」→「每单元末复习章(不落库)」，并删掉任何还在描述 `Level.review` 的句子（该字段已不存在）。`Level.review` 若在该文件里被列为数据模型字段，替换成 `Level.stage?: 'hard'`。

- [ ] **Step 3: `CLAUDE.md`**

「项目概述」那一段里描述玩法结构的话（「在地图上按单元解锁 **12 个单元 / 91 关**…每关给一张图 + 一个(或两个)音节,**分三段走**:简单段…」）整段换成章口径，保留原有的其余事实（星级 / 星尘 / 成就 / 后端 / 技术栈那一串**一个字不动**）。要改的核心句：

> …在地图上按单元解锁 **12 个单元 × 3 章 / 182 关**(简单章 / 困难章 / 复习章,单韵母 → 声母三组 → … → 双音节词):**章是一个连续题池**,简单章 = 本单元全部基础题、困难章 = 另一批音节且门禁只比**类型**(值可以错,填满才判,每关 2 次重试,用尽则演示正解、**不阻塞**)、复习章 = 把本单元点错过的块挖空重考(不落库)。章内逐题自动推进(无过场),章间 1.2s 过场;一题一颗星…

- [ ] **Step 4: 检查有没有漏掉的旧口径**

```bash
grep -rn "Level.review\|review: true\|复习关\|一关三段" --include=*.ts --include=*.tsx --include=*.md src worker docs CLAUDE.md README.md
```

期望：**零命中**（除了 `docs/superpowers/specs/` 与 `docs/superpowers/plans/` 下的历史文档 —— 那些是当时的事实，不改；以及 `docs/PLAN.md` / `CHANGELOG.md` 里就地留痕的旧条目）。

- [ ] **Step 5: 跑全表 + 提交**

```bash
npm test && npm run lint
```

```bash
git add docs/PLAN.md docs/dev-reference.md CLAUDE.md
git commit -m "docs: 单元三章的 PLAN / dev-reference / CLAUDE 同步"
```

---

## 自审

**1. Spec 覆盖**

| Spec 章节 | 落在哪个任务 |
|---|---|
| §2.1 题量表(91 + 91 = 182) | T4 / T5 / T6(总账那条断言 91) |
| §2.2 顺序锁 / 空章不进 / 单元锁放宽 | T2(`isChapterUnlocked` / `chapterEnterable` / `isUnitUnlocked` / `nextChapterOf`)+ T10 step 1 |
| §3.1 `Level` 增 `stage` 删 `review` + 六处读点 | T1 step 1 / 4 / 5 / 6 / 7 / 8 |
| §3.2 数组顺序 + 两个派生视图 | T1 step 4 + `levels.test.ts` 的 G6b |
| §3.3 题 id 约定(含「现有 id 不是按单元顺序编的」) | T1 step 1(id 正则 + 原复习关 id 保留)+ T4 step 3(`hard-levels.ts` 文件头注释) |
| §3.4 存档零改动 | 无代码改动；由 T1 step 1 与 T6 的 id 护栏保证 |
| §4 三章门禁 / 托盘表 | 门禁与托盘逻辑一字未动（`canPlace` / `sameTypeOnly` / `buildBlocks` 全在），章的选择由 T8 的 `stage` 入参完成 |
| §4.1 星级 + 落库时机 | T8 `starsFor(result.missCount)` + `await onQuestionEnd` + T9 `endQuestion` |
| §5 复习章池范围 / 一类型一道题 / 池空兜底 / 不落库 | T3(`chapterReviewQuestions`)+ T9(`onQuestionEnd={chapter === 'review' ? undefined : endQuestion}`) |
| §6 地图与导航(零文本 / 章名不进地图 / 复习章不显示题数 / 按钮不套按钮 / `data-unit-id` 在容器上) | T10 step 1 / 3 |
| §7 节律(章内无过场、章间 1.2s) | T8(`ChapterRun` 里没有 `StageTransition`)+ T9(`handleChapterDone` → `setChapter`)+ 走查 W-T3 |
| §7.1 一题一次 settleLevel、章末交账、撒花一章一次 | T7 + T9(`pending` ref / `flush` / `endQuestion`) |
| §8 视觉沿用 | 无改动（`StageBar` / `StageDots` / `.pstage-*` 全在）；T10 只为地图那三行加了尺寸注 |
| §9.1 选题四规则 | T4 step 3 的文件头注入 + T4 step 1 的块池护栏 + 既有 `read` / 无重音节护栏 |
| §9.2 规模 | T4 / T5 / T6 |
| §10 不变量五条 | ①`starsFor`/`canPlace`/`autoTargetId` 一字未动 ②T4 step 1 的护栏 ③既有「每类型槽 ≤3」自动扩到 182 题 ④T1 step 1 的 id 护栏 ⑤零后端改动 |
| §11 明确不做 | 无任务(负向约束)；走查条目里没有任何题级星位的地图内联要求 |
| §12 影响面 | 逐行对到了本计划的文件结构表 |
| §13 四个开放项 | 三个是「先照此实现、实测再改」，一个是「发布前走查留意」—— 已抄进 `docs/PLAN.md`(T11)与走查 W-T14 |

**2. 占位符扫描**：无 `TBD` / `TODO` / 「类似 Task N」/ 「加上适当的错误处理」。每一处代码块都是可直接粘贴的完整实现。两处刻意留白的判断已写明判据而非「看情况」：T8 step 1 的 `solveCurrent` 选择器（照 `PinyinBlocksGame.test.tsx` 的现成取法改）、T9 step 3 的空 `items` 分支（`StageTransition` 不吃 `'easy'` 就传 `'hard'`）。

**3. 类型一致性**（逐个跨任务核对）：

- `Chapter` 只在 `chapter.ts` 定义一次，`StageBar.tsx` 的 `StageId` 是它的**别名**（T1 step 9），两处不是两份联合类型。
- `hintFor(unitId, missCount, chapter)` 的第三参在 T1 step 6 定义、T1 step 8 传 `mode`（`mode: StageId = Chapter`）—— 类型对得上。
- `chapterLevels` / `chapterCleared` / `chapterEnterable` / `isChapterUnlocked` / `nextChapterOf` 的签名在 T2 定义，T9（`chapterLevels` / `chapterClearedCount` / `chapterTotal` / `nextChapterOf`）与 T10（`chapterClearedCount` / `chapterEnterable` / `chapterTotal` / `isChapterUnlocked`）按同一套参数顺序调用。
- `ChapterReviewItem.levelIndex` 在 T3 定义成「在 `unit.levels` 里的下标」，T8 的 `ChapterItem.levelIndex` 与 T9 的 `unit.levels[item.levelIndex]` 用它 —— 语义一致。
- `ChapterItem` / `QuestionEnd` / `ChapterRunProps` 在 T8 定义，T9 按同一组字段构造与消费。
- `ChapterSettlement` / `EMPTY_CHAPTER_SETTLEMENT` / `mergeSettlement` 在 T7 定义，T9 与 `App.tsx` 按同一组字段用。
- `HARD_LEVELS` 的类型是 `Readonly<Partial<Record<string, readonly Level[]>>>`（T4），T5 / T6 往里加键、`levels.ts` 用 `?? []` 展开 —— 不需要非空断言。
- `addToPool(pool, blocks, key?)`：T9 传 `end.exact ? exactPoolKey : undefined`，`undefined` 落到默认的 `familyPoolKey`（`mistakes.ts` 既有签名）。

**4. Review Focus 的五条，逐条对应到测试**：

1. 章内最后一题的账 ← T8 step 1「每题结束都该交一次账」+ T9 step 1「章末交账一次,退出到地图再交一次」。
2. 跨章时池与起始题号 ← T9 step 1 的「简单章的错块跨章活着」与「从地图带困难章进来就直接落在困难章」。
3. 空章不进 ← T2 step 1 的「困难章为空时复习章直接解锁」+ `chapterEnterable` 合成单元用例 + T10 step 1 的合成空章用例。
4. 容器 + 三按钮、无嵌套 button ← T10 step 1 的「单元格是容器,章按钮在它里面,没有嵌套 button」+ 走查 `W-M2`。
5. 那 12 道题的 id 一字不改 ← T1 step 1 的「原复习关的题保留成简单题,id 一字不改」。

**5. 已知的过渡态**（不是缺陷，是分批的代价，已写在对应任务里）：T3 之后到 T8 之前 `LevelRun.tsx` 编译不过；T8 之后到 T9 之前 `LevelEntry.tsx` 编译不过。两个文件都在 T8 / T9 被删除。**不要**为了「让全表先绿」而在中途临时修补它们 —— 那会在终审里变成两份实现。
