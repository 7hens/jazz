# 拼音积木「学习路径」实施计划(Section / Unit / Lesson 三层)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把「12 格单元地图 + 单元内三部分」换成一条 46 节点的竖向学习路径:7 个 Section(段头零文本)、12 个 Unit(一字不动)、每 Unit 拆成 3~5 题的 Lesson(节点),原「复习部分」降级成每单元一个独立的「练习」入口。

**Architecture:** 课程数据(`levels.ts`)题数据一行不动,只**新增** `SECTIONS` 与派生视图 `lessonsOf` / `pathLessons`;节级解锁与计数全部由星级表现算(`progress-stats.ts`),不落库、零迁移、零后端改动;UI 上 `UnitMap` → `LearningPath`、`UnitEntry` → `LessonEntry` + `PracticeEntry`、`PartRun` → `QuestionRun`,`part.ts` / `StageTransition` / 错题池机制整体退休。

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind 4 + motion;vitest(jsdom)+ @testing-library/react;oxlint;三层架构由 `src/architecture.test.ts` 守。

**Spec:** `docs/superpowers/specs/2026-09-30-learning-path-sections-design.md`(执行时**两份都要读** —— 计划是它的落地,不是它的替代)

## Global Constraints

- **182 道题的 id 一字不动。** `src/app/content-constants.test.ts:31` 那条守卫(12 单元 / 182 关 / 91+91)**不许改弱**,它是「老存档里每颗星都落回原题」的全部保障。
- **`starsFor` / `canPlace` / `autoTargetId` 的判定与取值一字不改**;`HARD_RETRIES` / `HARD_TRAY_PER_TYPE` / `REVIEW_TRAY_CAP` 沿用。`settle.ts` 整文件不动。
- **后端零改动、零迁移。** 存档仍是「每 user 一行、只升不降」,键仍是那 182 个题 id。
- **课程数据 `levels.ts` 的题数据一行不动** —— 只追加 `SECTIONS` 与派生函数。块显式写死、`read` 是汉字、id 唯一、全表不重音节等既有护栏继续有效。
- **零可见文字**:游戏区与地图上不出现任何汉字/拼音串(拼对后答案行亮出的那个同音汉字是唯一的例外)。
- **3 层架构**:`features/pinyin-blocks/` 自包含,公共面 = 目录 `index.ts`;feature 间禁编译期互引;`useService` 只允许出现在 `<Name>Entry.tsx` 与 `src/app/`。
- **每个 task 结束 `npx vitest run` 必须全绿**(jsdom)。`npm run lint` 与 `npm run build` 在 Task 10 收口时跑。
- **改用户可见行为(样式 / 布局 / 手势 / 动画 / 文案 / 持久化 / 发音)⇒ 同一个提交里必须同时更新 `docs/walkthrough.md`。** 本计划里凡涉及者,落在该 task 的提交步骤里。
- **提交信息结尾**:`Co-Authored-By: Claude Code <noreply@anthropic.com>`。
- **命名口径**:「复习 / 部分 / part」是**被废除的词汇**,新代码一律叫 practice / lesson。唯一例外:`wholeReviewQuestion` 这个名字 —— spec §9 明写「留 `wholeReviewQuestion`」,故原样保留;若审阅时想改名,改 `practice.ts` 一处 + 引用处即可。
- **不在射程**(spec §11):地图内联星级、折叠式段、练习的错块粒化、成就口径、皮肤 / 动效重做、家长面板、题面材质、「失败」概念。

## Review Focus

以下是 spec 隐含、但**没有任何 task 的测试直接覆盖**的输入/条件 —— 每一条都在下面指定的 task 里补了测试。写代码时按这个清单逐条自查。

1. **困难题为空的单元**(今天没有,合成单元可达):`lessonsOf` 必须切出 **0 节困难节**而不是一节空节;`nextLessonOf` 不因它卡住。→ Task 1 / Task 2。
2. **全通的档(182 题全 ≥1 星)**:`nextLessonOf` 返回 `null`;地图上**没有** current 节点时不得画出一个可点节点;每个练习入口按 §8.2 **全不亮**。→ Task 2 / Task 7。
3. **练习的题源边界**:本单元 <3 星的题 **0 道 ⇒ 入口不亮**;>5 道 ⇒ **封顶 5**(按 `unit.levels` 顺序取前 5)。→ Task 2 / Task 7。
4. **重玩一个全通的节点**:节内每题都已 ≥1 星,起点必须落在**第 0 题**而不是 `-1`(今天是 `Math.max(0, …)`,新代码别把这一层丢掉 —— 丢了就是白屏卡死)。→ Task 6。
5. **孤儿星 / 0 星**:存档里有课表外的 key、或某题是 `0` 星,一律视同**未通**,不参与计数、不影响解锁。→ Task 2。

---

## Task 1: 课程层 —— SECTIONS / Lesson / lessonsOf

**Files:**
- Modify: `src/features/pinyin-blocks/levels.ts`(文件末尾追加;题数据一行不动)
- Create: `src/features/pinyin-blocks/lessons.test.ts`
- Modify: `src/features/pinyin-blocks/index.ts`(追加导出)

**Interfaces:**
- Consumes: `UNITS` / `Unit` / `Level` / `easyLevelsOf` / `hardLevelsOf`(均已存在)
- Produces:
  - `LESSON_MAX: 5`
  - `type Section = { id: string; name: string; unitIds: readonly string[] }`
  - `SECTIONS: readonly Section[]`(7 条)
  - `type Lesson = { id: string; unitId: string; part: 'easy' | 'hard'; levelIds: readonly string[] }`
  - `lessonsOf(unit: Unit): readonly Lesson[]`
  - `pathLessons(units?: readonly Unit[]): readonly Lesson[]`

- [ ] **Step 1: 写失败的测试** —— `src/features/pinyin-blocks/lessons.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import {
  LESSON_MAX,
  SECTIONS,
  UNITS,
  lessonsOf,
  pathLessons,
  type Level,
  type Unit,
} from './levels'

/** 合成单元:靠它测切分算法本身的边界,不依赖真实数据的题数。 */
const level = (id: string, hard = false): Level => ({
  id,
  emoji: '🅰️',
  pinyin: 'ā',
  read: '啊',
  syl: [{ final: 'a', tone: 1 }],
  ...(hard ? { stage: 'hard' as const } : {}),
})

const synth = (easy: number, hard: number): Unit => ({
  id: 'ux',
  name: '合成',
  badge: [],
  levels: [
    ...Array.from({ length: easy }, (_, i) => level(`ux-${i}`)),
    ...Array.from({ length: hard }, (_, i) => level(`ux-${i}h`, true)),
  ],
})

describe('节的切分', () => {
  it('全表 46 节,覆盖 182 道题,零重复、零遗漏', () => {
    const lessons = pathLessons()
    expect(lessons).toHaveLength(46)
    const ids = lessons.flatMap((l) => l.levelIds)
    expect(ids).toHaveLength(182)
    expect(new Set(ids).size).toBe(182)
    expect(new Set(ids)).toEqual(new Set(UNITS.flatMap((u) => u.levels.map((l) => l.id))))
  })

  it('每节 3~5 题', () => {
    for (const lesson of pathLessons()) {
      expect(lesson.levelIds.length, lesson.id).toBeGreaterThanOrEqual(3)
      expect(lesson.levelIds.length, lesson.id).toBeLessThanOrEqual(LESSON_MAX)
    }
  })

  it('一节恒是纯简单题或纯困难题,且与 part 对上', () => {
    for (const unit of UNITS) {
      const byId = new Map(unit.levels.map((l) => [l.id, l]))
      for (const lesson of lessonsOf(unit)) {
        const hards = new Set(lesson.levelIds.map((id) => byId.get(id)!.stage === 'hard'))
        expect(hards.size, lesson.id).toBe(1)
        expect([...hards][0], lesson.id).toBe(lesson.part === 'hard')
      }
    }
  })

  it('顺序恒是「简单各节 → 困难各节」,且首尾相接覆盖全单元', () => {
    for (const unit of UNITS) {
      const lessons = lessonsOf(unit)
      const firstHard = lessons.findIndex((l) => l.part === 'hard')
      const easyCount = firstHard < 0 ? lessons.length : firstHard
      expect(lessons.slice(0, easyCount).every((l) => l.part === 'easy'), unit.id).toBe(true)
      expect(lessons.slice(easyCount).every((l) => l.part === 'hard'), unit.id).toBe(true)
      expect(lessons.flatMap((l) => l.levelIds), unit.id).toEqual(unit.levels.map((l) => l.id))
    }
  })

  it('均分而不是「每 5 题一刀」', () => {
    // n=6:每 5 题一刀会切出 5+1(末节一道题不成课),均分给 3+3
    expect(lessonsOf(synth(6, 0)).map((l) => l.levelIds.length)).toEqual([3, 3])
    expect(lessonsOf(synth(10, 0)).map((l) => l.levelIds.length)).toEqual([5, 5])
    expect(lessonsOf(synth(9, 0)).map((l) => l.levelIds.length)).toEqual([5, 4])
    expect(lessonsOf(synth(8, 0)).map((l) => l.levelIds.length)).toEqual([4, 4])
    expect(lessonsOf(synth(7, 0)).map((l) => l.levelIds.length)).toEqual([4, 3])
    expect(lessonsOf(synth(5, 0)).map((l) => l.levelIds.length)).toEqual([5])
  })

  it('困难题为空 ⇒ 0 节困难节,不产空节', () => {
    const lessons = lessonsOf(synth(4, 0))
    expect(lessons).toHaveLength(1)
    expect(lessons.every((l) => l.part === 'easy')).toBe(true)
  })

  it('节的 id 形如 ux#easy-1,且全路径唯一', () => {
    expect(lessonsOf(synth(10, 6)).map((l) => l.id)).toEqual([
      'ux#easy-0', 'ux#easy-1', 'ux#hard-0', 'ux#hard-1',
    ])
    const ids = pathLessons().map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('Section 分组', () => {
  it('7 段,划段只是分组、不重排', () => {
    expect(SECTIONS).toHaveLength(7)
    expect(SECTIONS.flatMap((s) => s.unitIds)).toEqual(UNITS.map((u) => u.id))
  })

  it('各段的节数 = 4 / 12 / 4 / 6 / 8 / 8 / 4(合计 46)', () => {
    const counts = SECTIONS.map((section) =>
      section.unitIds.reduce((sum, unitId) => {
        const unit = UNITS.find((u) => u.id === unitId)!
        return sum + lessonsOf(unit).length
      }, 0),
    )
    expect(counts).toEqual([4, 12, 4, 6, 8, 8, 4])
    expect(counts.reduce((a, b) => a + b, 0)).toBe(46)
  })
})
```

- [ ] **Step 2: 跑测试确认它红**

Run: `npx vitest run src/features/pinyin-blocks/lessons.test.ts`
Expected: FAIL —— `lessonsOf is not a function` / `SECTIONS` 未导出。

- [ ] **Step 3: 在 `levels.ts` 末尾追加实现**

```ts
/* ------------------------------------------------- 学习路径:Section / Lesson */

/** 一节的题数上限。一节 3~5 题是产品口径(spec §3)。 */
export const LESSON_MAX = 5

/** 一个 Section:按教学点分段。**只有分组,没有新数据** —— 段头要展示的东西全部从段内单元派生。 */
export type Section = {
  readonly id: string
  /** 仅用于家长 / 试玩者的选择器,游戏内不出现(与 `Unit.name` 同一口径)。 */
  readonly name: string
  readonly unitIds: readonly string[]
}

/** 7 段。段内 `unitIds` 的顺序即路径顺序。 */
export const SECTIONS: readonly Section[] = [
  { id: 's1', name: '单韵母', unitIds: ['u1'] },
  { id: 's2', name: '声母', unitIds: ['u2', 'u3', 'u4'] },
  { id: 's3', name: '复韵母', unitIds: ['u5'] },
  { id: 's4', name: '鼻韵母', unitIds: ['u6', 'u7'] },
  { id: 's5', name: '三拼与 ü', unitIds: ['u8', 'u9'] },
  { id: 's6', name: '整体认读', unitIds: ['u10', 'u11'] },
  { id: 's7', name: '双音节词', unitIds: ['u12'] },
]

/**
 * 学习路径上的一个节点。**不是存档键** —— 切分线挪动不碰任何已存的星(spec §3.1)。
 * 节是**派生视图**,不写进课程数据:换形状要同时改 `progress-stats` / `achievements` /
 * worker / 存档格式五处(见上面 `easyLevelsOf` 的注释),`lessonsOf` 走同一条路躲开它。
 */
export type Lesson = {
  /** 形如 'u2#easy-1'。 */
  readonly id: string
  readonly unitId: string
  readonly part: 'easy' | 'hard'
  readonly levelIds: readonly string[]
}

/**
 * 把一个部分的题**均分**成 k 节(k = ceil(n / LESSON_MAX))。
 *
 * 为什么是均分而不是「每 5 题一刀」:n = 6 时后者切出 5 + 1,末节一道题不成课;均分给 3 + 3。
 * 实测各档:`10→5+5`、`9→5+4`、`8→4+4`、`7→4+3`、`6→3+3`、`5→5`(单节)。
 * **空部分切出 0 节** —— 不产空节(进一个空节就是一块白屏)。
 */
function splitEven(levels: readonly Level[], unitId: string, part: 'easy' | 'hard'): Lesson[] {
  const n = levels.length
  if (n === 0) return []
  const k = Math.ceil(n / LESSON_MAX)
  const base = Math.floor(n / k)
  const rem = n % k
  const out: Lesson[] = []
  let at = 0
  for (let i = 0; i < k; i++) {
    const size = base + (i < rem ? 1 : 0)
    out.push({
      id: `${unitId}#${part}-${i}`,
      unitId,
      part,
      levelIds: levels.slice(at, at + size).map((l) => l.id),
    })
    at += size
  }
  return out
}

/** 一个单元的全部节,顺序 = 简单各节 → 困难各节。 */
export function lessonsOf(unit: Unit): readonly Lesson[] {
  return [
    ...splitEven(easyLevelsOf(unit), unit.id, 'easy'),
    ...splitEven(hardLevelsOf(unit), unit.id, 'hard'),
  ]
}

/** 全路径的节,按单元顺序展平 —— 地图顺序与「下一个该走哪一节」的唯一事实源。 */
export function pathLessons(units: readonly Unit[] = UNITS): readonly Lesson[] {
  return units.flatMap(lessonsOf)
}
```

- [ ] **Step 4: 跑测试确认它绿**

Run: `npx vitest run src/features/pinyin-blocks/lessons.test.ts`
Expected: PASS(11 条)。

- [ ] **Step 5: 扩公共面** —— `src/features/pinyin-blocks/index.ts`,把 `levels` 那一行改成:

```ts
export { UNITS, easyLevelsOf, hardLevelsOf, LESSON_MAX, lessonsOf, pathLessons, SECTIONS } from './levels'
```

并改类型导出行:

```ts
export type { Level, Lesson, Section, Syllable, Unit } from './levels'
```

- [ ] **Step 6: 全量测试 + 提交**

```bash
npx vitest run
git add src/features/pinyin-blocks/levels.ts src/features/pinyin-blocks/lessons.test.ts src/features/pinyin-blocks/index.ts
git commit -m "feat(pinyin-blocks): 课程层新增 SECTIONS 与派生节 lessonsOf/pathLessons（46 节覆盖 182 题）

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 2: 节级统计与解锁（新增，不动旧口径）

**Files:**
- Modify: `src/features/pinyin-blocks/progress-stats.ts`(追加;旧的 part 口径**这一轮不删**,留给 Task 9)
- Create: `src/features/pinyin-blocks/lesson-progress.test.ts`
- Modify: `src/features/pinyin-blocks/index.ts`

**Interfaces:**
- Consumes: `cleared`(本文件已有)、Task 1 的 `Lesson` / `Section` / `SECTIONS` / `pathLessons` / `UNITS`
- Produces:
  - `lessonCleared(stars, lesson): boolean`
  - `lessonClearedCount(stars, lesson): number`
  - `nextLessonOf(stars, lessons?): Lesson | null`
  - `lessonIndex(lessonId, lessons?): number`
  - `type LessonState = 'cleared' | 'current' | 'locked'`
  - `lessonState(stars, lesson, lessons?): LessonState`
  - `unitLessonsOf(unitId, lessons?): readonly Lesson[]`
  - `unitUnlockedByPath(stars, unitId, lessons?): boolean`
  - `lessonsOfSection(section, lessons?): readonly Lesson[]`
  - `sectionTotal(section, lessons?): number`
  - `sectionClearedCount(stars, section, lessons?): number`
  - `sectionCleared(stars, section, lessons?): boolean`
  - `PRACTICE_MAX: 5`
  - `practiceLevelsOf(stars, unit): readonly Level[]`

- [ ] **Step 1: 写失败的测试** —— `src/features/pinyin-blocks/lesson-progress.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import type { LevelStars } from '@/shared/services'
import { SECTIONS, lessonsOf, pathLessons, type Level, type Unit } from './levels'
import {
  PRACTICE_MAX,
  lessonCleared,
  lessonState,
  lessonsOfSection,
  nextLessonOf,
  practiceLevelsOf,
  sectionCleared,
  sectionClearedCount,
  sectionTotal,
  unitUnlockedByPath,
} from './progress-stats'

/** 合成单元:10 道简单题(切 5+5)+ 6 道困难题(切 3+3)⇒ 4 节。 */
const level = (id: string, hard = false): Level => ({
  id,
  emoji: '🅰️',
  pinyin: 'ā',
  read: '啊',
  syl: [{ final: 'a', tone: 1 }],
  ...(hard ? { stage: 'hard' as const } : {}),
})

const synth: Unit = {
  id: 'ux',
  name: '合成',
  badge: [],
  levels: [
    ...Array.from({ length: 10 }, (_, i) => level(`ux-${i}`)),
    ...Array.from({ length: 6 }, (_, i) => level(`ux-${i}h`, true)),
  ],
}

/** 把若干题打成指定星数;省略星数 = 1 星。 */
const star = (ids: readonly string[], n = 1): LevelStars => Object.fromEntries(ids.map((id) => [id, n]))

const lessons = lessonsOf(synth)
const lessonIds = lessons.map((l) => l.id)

describe('节级解锁', () => {
  it('节全通 = 节内每一题都 ≥1 星;缺 key 与 0 星都不算', () => {
    const first = lessons[0]!
    expect(lessonCleared({}, first)).toBe(false)
    expect(lessonCleared(star(first.levelIds.slice(0, -1)), first)).toBe(false)
    const zero = Object.fromEntries(first.levelIds.map((id) => [id, 0]))
    expect(lessonCleared(zero, first)).toBe(false)
    expect(lessonCleared(star(first.levelIds), first)).toBe(true)
  })

  it('nextLessonOf = 路径上第一个未全通的节;全通 ⇒ null', () => {
    expect(nextLessonOf({}, lessons)?.id).toBe(lessonIds[0])
    expect(nextLessonOf(star(lessons[0]!.levelIds), lessons)?.id).toBe(lessonIds[1])
    const all = star(lessons.flatMap((l) => l.levelIds))
    expect(nextLessonOf(all, lessons)).toBeNull()
  })

  it('中间某节没通也照样是它,与后面的节无关', () => {
    const pass1 = star(lessons[0]!.levelIds)
    const pass3 = star(lessons[2]!.levelIds)
    expect(nextLessonOf({ ...pass1, ...pass3 }, lessons)?.id).toBe(lessonIds[1])
  })

  it('三态:current 恒唯一;current 之前恒 cleared、之后恒 locked', () => {
    const stars = star(lessons[0]!.levelIds)
    expect(lessons.map((l) => lessonState(stars, l, lessons))).toEqual([
      'cleared', 'current', 'locked', 'locked',
    ])
    expect(lessons.filter((l) => lessonState(stars, l, lessons) === 'current')).toHaveLength(1)
  })

  it('全通时没有 current —— 每个节都是 cleared（重玩态）', () => {
    const stars = star(lessons.flatMap((l) => l.levelIds))
    expect(lessons.every((l) => lessonState(stars, l, lessons) === 'cleared')).toBe(true)
  })

  it('课表外的节 id 一律 locked,不会因为下标 -1 被算成 cleared', () => {
    const alien = { id: 'zz#easy-0', unitId: 'zz', part: 'easy' as const, levelIds: ['zz-0'] }
    expect(lessonState({}, alien, lessons)).toBe('locked')
  })
})

describe('节级计数与单元解锁', () => {
  it('单元解锁 = 本单元第一节不是 locked（严格逐节线性的推论）', () => {
    expect(unitUnlockedByPath({}, 'ux', lessons)).toBe(true) // 第一节就是当前节点
    const stars = star(lessons.flatMap((l) => l.levelIds))
    expect(unitUnlockedByPath(stars, 'ux', lessons)).toBe(true) // 全通 ⇒ 可重玩
  })

  it('空单元（无节）不解锁 —— 进去是一块白屏', () => {
    expect(unitUnlockedByPath({}, 'nope', lessons)).toBe(false)
  })

  it('段计数用真实课程:S1 4 节 / S2 12 节', () => {
    const all = pathLessons()
    expect(sectionTotal(SECTIONS[0]!, all)).toBe(4)
    expect(sectionTotal(SECTIONS[1]!, all)).toBe(12)
    expect(sectionClearedCount({}, SECTIONS[0]!, all)).toBe(0)
    expect(sectionCleared({}, SECTIONS[0]!, all)).toBe(false)
  })

  it('段全通 = 段内每一节全通', () => {
    const all = pathLessons()
    const s1 = SECTIONS[0]!
    const s1LessonIds = all.filter((l) => l.unitId === 'u1').flatMap((l) => l.levelIds)
    expect(sectionCleared(star(s1LessonIds), s1, all)).toBe(true)
    expect(sectionClearedCount(star(s1LessonIds), s1, all)).toBe(4)
    // 少一题 ⇒ 那个节不算通,段也不算通
    const short = { ...star(s1LessonIds) }
    delete short[s1LessonIds[0]!]
    expect(sectionClearedCount(short, s1, all)).toBe(3)
    expect(sectionCleared(short, s1, all)).toBe(false)
  })

  it('每一节都属于某个 Section（段覆盖是完整的）', () => {
    const all = pathLessons()
    const covered = new Set(SECTIONS.flatMap((s) => lessonsOfSection(s, all).map((l) => l.id)))
    expect(all.every((l) => covered.has(l.id))).toBe(true)
    expect(covered.size).toBe(all.length)
  })
})

describe('练习题源', () => {
  it('只取 <3 星的题,按 unit.levels 顺序', () => {
    const all3 = Object.fromEntries(synth.levels.map((l) => [l.id, 3]))
    const stars = { ...all3, 'ux-1': 2, 'ux-2': 0, 'ux-3': 1 }
    expect(practiceLevelsOf(stars, synth).map((l) => l.id)).toEqual(['ux-1', 'ux-2', 'ux-3'])
  })

  it('全 3 星 ⇒ 无题可练（入口据此不亮）', () => {
    const all = star(synth.levels.map((l) => l.id), 3)
    expect(practiceLevelsOf(all, synth)).toEqual([])
  })

  it('多于 5 道时封顶 5 道', () => {
    expect(practiceLevelsOf({}, synth)).toHaveLength(PRACTICE_MAX)
    expect(practiceLevelsOf({}, synth).map((l) => l.id)).toEqual(['ux-0', 'ux-1', 'ux-2', 'ux-3', 'ux-4'])
  })
})
```

- [ ] **Step 2: 跑测试确认它红**

Run: `npx vitest run src/features/pinyin-blocks/lesson-progress.test.ts`
Expected: FAIL —— `nextLessonOf is not a function`。

- [ ] **Step 3: 在 `progress-stats.ts` 追加实现**

文件顶部的 import 改成(新增 `Lesson` / `Section` / `SECTIONS` / `pathLessons`):

```ts
import { easyLevelsOf, hardLevelsOf, pathLessons, SECTIONS, UNITS, type Level, type Lesson, type Section, type Unit } from './levels'
```

末尾追加:

```ts
/* ----------------------------------------------------- 学习路径:节级解锁与计数 */

/** 本节是否全通:节内**每一题**都 ≥1 星(1 星即通关,与 `cleared` 同义)。 */
export function lessonCleared(stars: LevelStars, lesson: Lesson): boolean {
  return lesson.levelIds.every((id) => cleared(stars, id))
}

export function lessonClearedCount(stars: LevelStars, lesson: Lesson): number {
  return lesson.levelIds.filter((id) => cleared(stars, id)).length
}

/**
 * 路径上第一个**还没全通**的节;全部通过 ⇒ `null`。
 *
 * **只有它那一个节点可进**(`lessonState` 的 'current');它前面已通的随时可重玩,它后面全是锁
 * (spec §5.1 严格逐节线性)。全部现算,不落库。
 */
export function nextLessonOf(stars: LevelStars, lessons: readonly Lesson[] = pathLessons()): Lesson | null {
  return lessons.find((lesson) => !lessonCleared(stars, lesson)) ?? null
}

/** 本节在路径上的序号;不在表里 ⇒ -1。 */
export function lessonIndex(lessonId: string, lessons: readonly Lesson[] = pathLessons()): number {
  return lessons.findIndex((lesson) => lesson.id === lessonId)
}

/** 节点三态。'current' 恒唯一;全部通过时**不存在** current。 */
export type LessonState = 'cleared' | 'current' | 'locked'

/**
 * 地图上那一个节点画什么。**唯一口径** —— 地图不许自己拿星级再算一遍。
 *
 * 课表外的 id 一律 `'locked'`:少了下面那道 `at < 0` 的闸,下标 -1 会让它落进
 * `at < frontier` 被判成「已通」,地图上就多出一个点得进去、进去却什么都没有的节点。
 */
export function lessonState(
  stars: LevelStars,
  lesson: Lesson,
  lessons: readonly Lesson[] = pathLessons(),
): LessonState {
  const at = lessonIndex(lesson.id, lessons)
  if (at < 0) return 'locked'
  const next = nextLessonOf(stars, lessons)
  if (next && next.id === lesson.id) return 'current'
  const frontier = next ? lessonIndex(next.id, lessons) : lessons.length
  return at < frontier ? 'cleared' : 'locked'
}

export function unitLessonsOf(unitId: string, lessons: readonly Lesson[] = pathLessons()): readonly Lesson[] {
  return lessons.filter((lesson) => lesson.unitId === unitId)
}

/**
 * 单元是否解锁。严格逐节线性下它就是「本单元第一节不是 locked」——
 * 旧口径「前一单元简单部分全通」(见 `isUnitUnlocked`)被它**蕴含**,故旧的那条退休(spec §5.1)。
 */
export function unitUnlockedByPath(
  stars: LevelStars,
  unitId: string,
  lessons: readonly Lesson[] = pathLessons(),
): boolean {
  const first = unitLessonsOf(unitId, lessons)[0]
  if (!first) return false
  return lessonState(stars, first, lessons) !== 'locked'
}

export function lessonsOfSection(section: Section, lessons: readonly Lesson[] = pathLessons()): readonly Lesson[] {
  return lessons.filter((lesson) => section.unitIds.includes(lesson.unitId))
}

export function sectionTotal(section: Section, lessons: readonly Lesson[] = pathLessons()): number {
  return lessonsOfSection(section, lessons).length
}

export function sectionClearedCount(
  stars: LevelStars,
  section: Section,
  lessons: readonly Lesson[] = pathLessons(),
): number {
  return lessonsOfSection(section, lessons).filter((lesson) => lessonCleared(stars, lesson)).length
}

export function sectionCleared(
  stars: LevelStars,
  section: Section,
  lessons: readonly Lesson[] = pathLessons(),
): boolean {
  return lessonsOfSection(section, lessons).every((lesson) => lessonCleared(stars, lesson))
}

/** 一段的全部单元(按 `unitIds` 顺序)。地图画段头 / 簇头用。 */
export function unitsOfSection(section: Section, units: readonly Unit[] = UNITS): readonly Unit[] {
  return section.unitIds.flatMap((id) => {
    const unit = units.find((u) => u.id === id)
    return unit ? [unit] : []
  })
}

/* ------------------------------------------------------------ 练习题源 */

/** 一次练习最多几道题(≈ 一节长度)。产品裁定值 5(spec §8)。 */
export const PRACTICE_MAX = 5

/**
 * 练习的题源:本单元里**「<3 星」的题**,按 `unit.levels` 顺序,**封顶 `PRACTICE_MAX`**。
 *
 * 为什么要 `< 3` 而不是 `< 1`:练习是**回炉** —— 通关了但没打好的题才是要练的题。
 * 全 3 星 ⇒ 空数组 ⇒ 地图上该单元的练习入口**不亮**(spec §8.2,今天那套「复习部分恒存在」
 * 的裁定随之作废:伪造一道题是往屏幕上放假话)。
 *
 * ⚠ 星级只记得**哪道题**错过,记不得「他错的是声母还是韵母」—— 故练习重考**整题**
 * (`wholeReviewQuestion`),不再按类型挖空(spec §8.1)。
 */
export function practiceLevelsOf(stars: LevelStars, unit: Unit): readonly Level[] {
  return unit.levels.filter((level) => (stars[level.id] ?? 0) < 3).slice(0, PRACTICE_MAX)
}
```

- [ ] **Step 4: 跑测试确认它绿**

Run: `npx vitest run src/features/pinyin-blocks/lesson-progress.test.ts`
Expected: PASS。

- [ ] **Step 5: 扩公共面** —— `index.ts` 的 `progress-stats` 导出块改成:

```ts
export {
  completedLevelCount,
  isUnitUnlocked,
  lessonCleared,
  lessonClearedCount,
  lessonIndex,
  lessonState,
  lessonsOfSection,
  nextLessonOf,
  perfectLevelCount,
  perfectUnitCount,
  PRACTICE_MAX,
  practiceLevelsOf,
  sectionCleared,
  sectionClearedCount,
  sectionTotal,
  totalLevelCount,
  unitClearedCount,
  unitLessonsOf,
  unitTotal,
  unitUnlockedByPath,
  unitsOfSection,
  type LessonState,
} from './progress-stats'
```

- [ ] **Step 6: 全量测试 + 提交**

```bash
npx vitest run
git add src/features/pinyin-blocks/progress-stats.ts src/features/pinyin-blocks/lesson-progress.test.ts src/features/pinyin-blocks/index.ts
git commit -m "feat(pinyin-blocks): 节级解锁与统计（nextLessonOf / lessonState / 段计数 / 练习题源）

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 3: 练习层 —— practice.ts

**Files:**
- Create: `src/features/pinyin-blocks/practice.ts`
- Create: `src/features/pinyin-blocks/practice.test.ts`
- Modify: `src/features/pinyin-blocks/mistakes.ts`(删 `wholeReviewQuestion`,兜底改调 practice.ts)
- Modify: `src/features/pinyin-blocks/mistakes.test.ts`(把 `wholeReviewQuestion` 那几条搬走)
- Modify: `src/features/pinyin-blocks/index.ts`

**Interfaces:**
- Consumes: `buildBlocks` / `slotsFor` / `Rng` / `TrayBlock`(`rules.ts`)、`Level` / `Unit`(`levels.ts`)
- Produces:
  - `type PracticeQuestion = { slotIds: readonly string[]; tray: readonly TrayBlock[] }`
  - `wholeReviewQuestion(level, unitIndex, rng?): PracticeQuestion`
  - `type PracticeItem = { levelIndex: number; question: PracticeQuestion }`
  - `practiceQuestions(unit, unitIndex, levels, rng?): PracticeItem[]`

- [ ] **Step 1: 写失败的测试** —— `src/features/pinyin-blocks/practice.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { UNITS } from './levels'
import { practiceQuestions, wholeReviewQuestion } from './practice'
import { canPlace, slotsFor, type Rng } from './rules'

const unit = UNITS[0]!
const level = unit.levels[0]!

/** 固定种子的 rng —— 与 PinyinBlocksGame 同源的 LCG,只为让发牌可复现。 */
function makeRng(seed: number): Rng {
  let s = (seed * 2654435761) >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

describe('练习的整题', () => {
  it('全部槽都挖空,且每一槽都有一块放得进去的正解', () => {
    const q = wholeReviewQuestion(level, 0, makeRng(0))
    expect(q.slotIds).toEqual(slotsFor(level).map((s) => s.id))
    for (const slot of slotsFor(level)) {
      expect(q.tray.some((b) => canPlace(b, slot)), slot.id).toBe(true)
    }
  })

  it('同一 rng 种子恒产出等值对象（宿主 useMemo 重跑不该换一副牌）', () => {
    const a = wholeReviewQuestion(level, 0, makeRng(7))
    const b = wholeReviewQuestion(level, 0, makeRng(7))
    expect(a).toEqual(b)
  })

  it('tray 的块 id 形如 q0-N,且不重复', () => {
    const q = wholeReviewQuestion(level, 0, makeRng(3))
    const ids = q.tray.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((id) => /^q0-\d+$/.test(id))).toBe(true)
  })
})

describe('一个单元的练习题表', () => {
  it('一道题一项,levelIndex 是在 unit.levels 里的下标', () => {
    const picked = [unit.levels[1]!, unit.levels[3]!]
    const items = practiceQuestions(unit, 0, picked, makeRng(5))
    expect(items.map((i) => i.levelIndex)).toEqual([
      unit.levels.indexOf(picked[0]!),
      unit.levels.indexOf(picked[1]!),
    ])
  })

  it('空题表 ⇒ 空数组（练习入口据此不亮）', () => {
    expect(practiceQuestions(unit, 0, [], makeRng(1))).toEqual([])
  })
})
```

- [ ] **Step 2: 跑测试确认它红**

Run: `npx vitest run src/features/pinyin-blocks/practice.test.ts`
Expected: FAIL —— `Cannot find module './practice'`。

- [ ] **Step 3: 新建 `src/features/pinyin-blocks/practice.ts`**

```ts
// 练习入口的题源:本单元「<3 星」的题,每题一道**整题**(全槽挖空)。
// 不落库、不记 miss、不上报连击 —— 练习做得再差也不掉星(spec §8)。
// 纯函数 + 注入 rng,不引 React、不引服务 —— 组件只负责画。

import type { Level, Unit } from './levels'
import { buildBlocks, slotsFor, type Rng, type TrayBlock } from './rules'

/**
 * 练习里的一道题。**恒是全槽挖空、无预填。**
 *
 * 为什么不再按类型挖空:错题池存的是**块**,而星级只记得**哪道题**错过 ——
 * 「他错的是声母还是韵母」推不出来。故产品裁定练习重考整题,连带整个错题池机制退休(spec §8.1)。
 */
export type PracticeQuestion = Readonly<{
  /** 要挖空的槽。练习恒是全部槽。 */
  slotIds: readonly string[]
  /** 本小题的托盘:同简单部分(正解 + `taughtBlocks` 里挑得出的干扰块)。 */
  tray: readonly TrayBlock[]
}>

/**
 * 一道整题(全部槽挖空、托盘同简单部分)。**纯函数**(除注入的 rng)—— 同一批入参 + 同一种子恒等值。
 *
 * 这一点是**承重的**:宿主在进练习时算一次,之后不再重算;万一被重算(React 的 `useMemo`
 * 不保证不重跑),块 id 与托盘必须与旧的一致,否则盘面(只初始化一次的 `placement`)会与托盘失配 ——
 * 屏幕上就是「块放不进去」。
 */
export function wholeReviewQuestion(level: Level, unitIndex: number, rng: Rng = Math.random): PracticeQuestion {
  const tray: TrayBlock[] = buildBlocks(level, unitIndex, rng).map((b, i) => ({ ...b, id: `q0-${i}` }))
  return { slotIds: slotsFor(level).map((s) => s.id), tray }
}

/** 练习里的一道题,以及它挂在哪道题上(`levelIndex` = 在 `Unit.levels` 里的下标)。 */
export type PracticeItem = Readonly<{
  levelIndex: number
  question: PracticeQuestion
}>

/** 一个单元的练习题表 —— 题源由调用方给(口径在 `practiceLevelsOf`,唯一一处)。 */
export function practiceQuestions(
  unit: Unit,
  unitIndex: number,
  levels: readonly Level[],
  rng?: Rng,
): PracticeItem[] {
  return levels.map((level) => ({
    levelIndex: unit.levels.indexOf(level),
    question: wholeReviewQuestion(level, unitIndex, rng),
  }))
}
```

- [ ] **Step 4: 把 `mistakes.ts` 的 `wholeReviewQuestion` 换掉**

删掉 `mistakes.ts` 里的 `wholeReviewQuestion` 整个函数,顶部 import 加一行:

```ts
import { wholeReviewQuestion } from './practice'
```

`partReviewQuestions` 末尾那条兜底改成(其余不动):

```ts
  // 兜底只在**池本身为空**时触发:池非空但类型在本单元全表里都找不到槽 ⇒ 返回空数组(不产出半道题)。
  if (recent.length === 0) {
    return [{ levelIndex: 0, question: { kind: 'whole', prefill: {}, ...wholeReviewQuestion(first, unitIndex, rng) } }]
  }
```

- [ ] **Step 5: 搬走 `mistakes.test.ts` 里 `wholeReviewQuestion` 的用例**

在 `mistakes.test.ts` 里 grep 出所有提到 `wholeReviewQuestion` 的 `it` 块,**整块删除**(同名覆盖已经在 `practice.test.ts` 里了):

```bash
grep -n "wholeReviewQuestion" src/features/pinyin-blocks/mistakes.test.ts
```

若某条断言的是 `partReviewQuestions` 的**池空兜底**(而不是 `wholeReviewQuestion` 本身的形状),保留它、只把断言里读的字段改成新形状(`kind: 'whole'` / `prefill: {}` 仍在)。

- [ ] **Step 6: 跑测试确认它绿**

Run: `npx vitest run src/features/pinyin-blocks/practice.test.ts src/features/pinyin-blocks/mistakes.test.ts`
Expected: PASS。

- [ ] **Step 7: 扩公共面** —— `index.ts` 追加:

```ts
export { practiceQuestions, wholeReviewQuestion, type PracticeItem, type PracticeQuestion } from './practice'
```

- [ ] **Step 8: 全量测试 + 提交**

```bash
npx vitest run
git add src/features/pinyin-blocks/practice.ts src/features/pinyin-blocks/practice.test.ts src/features/pinyin-blocks/mistakes.ts src/features/pinyin-blocks/mistakes.test.ts src/features/pinyin-blocks/index.ts
git commit -m "feat(pinyin-blocks): 练习题源独立（整题挖空，题源=本单元 <3 星的题）

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 4: 题位条 —— StageBar 改成本节的 n 个题位；删换部分过场

**Files:**
- Modify: `src/features/pinyin-blocks/StageBar.tsx`
- Modify: `src/features/pinyin-blocks/StageBar.test.tsx`
- Modify: `src/index.css:528-608, 620-625`
- Delete: `src/features/pinyin-blocks/StageTransition.tsx`
- Modify: `src/features/pinyin-blocks/PinyinBlocksGame.tsx`(`reviewProgress` → `position`;`StageBar` 新签名)
- Modify: `src/features/pinyin-blocks/PartRun.tsx`(传 `position`)
- Modify: `src/features/pinyin-blocks/UnitEntry.tsx`(去过场支路)
- Modify: `src/features/pinyin-blocks/index.ts`(删 `STAGE_TRANSITION_MS` / `StageTransition` 导出)
- Modify: `src/features/pinyin-blocks/PartRun.test.tsx` / `UnitEntry.test.tsx` / `PinyinBlocksGame.test.tsx`(锚点跟着改)
- Modify: `docs/walkthrough.md`(W-C5 / W-C8 两行:不再有「换部分过场」)

**Interfaces:**
- Produces:
  - `StageBar({ total, done, big? }): JSX` —— `data-bar-total` / `data-bar-done` / `aria-label="本节 done/total"`
  - `StageDots({ total, done }): JSX`(不变,给练习用)
  - `PinyinBlocksGame` 新 props:`position?: { done: number; total: number }`(替换 `reviewProgress`)
- 删除:`StageBar` 的 `stage` 入参、`StageId` 类型、`StageTransition` / `STAGE_TRANSITION_MS`、`.pstage-step--cool` / `--pop` / `.pstage-bar--big` / `.pstage-veil`

- [ ] **Step 1: 改写测试** —— `StageBar.test.tsx` 整个替换为:

```tsx
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { StageBar, StageDots } from './StageBar'

/** 亮起来的格子数。 */
const litCount = (el: HTMLElement) => el.querySelectorAll('.pstage-step--on').length

afterEach(cleanup)

describe('本节题位条', () => {
  it('有几道题就几格 —— 3 / 4 / 5 题三档都能画', () => {
    for (const total of [3, 4, 5]) {
      const { container, unmount } = render(<StageBar total={total} done={1} />)
      expect(container.querySelectorAll('.pstage-step')).toHaveLength(total)
      unmount()
    }
  })

  it('亮到第几格就是做到第几题（done 从 1 起）', () => {
    const { rerender, container } = render(<StageBar total={4} done={1} />)
    const bar = container.firstElementChild as HTMLElement
    expect(litCount(bar)).toBe(1)
    rerender(<StageBar total={4} done={3} />)
    expect(litCount(bar)).toBe(3)
  })

  it('零文本:进度只进无障碍树', () => {
    const { container } = render(<StageBar total={5} done={2} />)
    const bar = container.firstElementChild as HTMLElement
    expect(bar.textContent).toBe('')
    expect(bar.getAttribute('aria-label')).toBe('本节 2/5')
    expect(bar.dataset.barTotal).toBe('5')
    expect(bar.dataset.barDone).toBe('2')
  })

  it('格子等高 —— 旧的「越右越高」编码的是部分难度阶，部分这个层没有了', () => {
    const { container } = render(<StageBar total={4} done={0} />)
    // 三格以上的档位不得再出现 nth-child 派生的高度差(形状必须靠 CSS 之外的东西判不出来,
    // 故这里只钉「不再有 --cool / --pop 这两支旧语汇」)。
    expect(container.querySelectorAll('.pstage-step--cool, .pstage-step--pop')).toHaveLength(0)
  })
})

describe('练习的小题进度点', () => {
  const dotCount = () => document.querySelectorAll('.pstage-dot').length
  const onCount = () => document.querySelectorAll('.pstage-dot--on').length

  it('有几道题就画几个点,当前第几道就亮几颗', () => {
    const { rerender } = render(<StageDots total={5} done={1} />)
    expect(dotCount()).toBe(5)
    expect(onCount()).toBe(1)
    rerender(<StageDots total={5} done={4} />)
    expect(onCount()).toBe(4)
  })
})
```

- [ ] **Step 2: 跑测试确认它红**

Run: `npx vitest run src/features/pinyin-blocks/StageBar.test.tsx`
Expected: FAIL —— 传 `total`/`done` 时 `.pstage-step` 仍是 3 个(旧实现按 `stage` 画三格)。

- [ ] **Step 3: 重写 `StageBar.tsx`**

```tsx
import { cn } from '@/shared/ui/utils'

/**
 * 本节题位条:这一节有几道题就几格,亮到第几格就是做到第几题(`done` 从 1 起)。
 *
 * 与旧「三格台阶条 = 三个部分」同名不同义 —— 部分这个层没有了(spec §9)。
 * 旧版「越右越高」编码的是**难度阶**,新语义是**同一节的第几题**,故格子等高、只有亮/暗两态。
 * 形状即语义:一排东西 + 亮暗两态,与连击点同源,孩子在这个游戏里已经学过。
 */
export function StageBar({ total, done, big = false }: { total: number; done: number; big?: boolean }) {
  return (
    <span
      data-bar-total={total}
      data-bar-done={done}
      aria-label={`本节 ${done}/${total}`}
      className={cn('pstage-bar', big && 'pstage-bar--big')}
    >
      {Array.from({ length: total }, (_, index) => (
        <span key={index} aria-hidden className={cn('pstage-step', index < done && 'pstage-step--on')} />
      ))}
    </span>
  )
}

/**
 * 练习的小题进度点:做完几道亮几颗(`done` 从 1 起)。与题位条同源,只是更小一号 ——
 * 练习不是一节课,不该长得像一节(它的题数还会随星级变)。
 */
export function StageDots({ total, done }: { total: number; done: number }) {
  return (
    <span data-review-dots data-review-done={done} aria-label={`练习 ${done}/${total}`} className="pstage-dots">
      {Array.from({ length: total }, (_, index) => (
        <span key={index} aria-hidden className={cn('pstage-dot', index < done && 'pstage-dot--on')} />
      ))}
    </span>
  )
}
```

- [ ] **Step 4: 改 CSS** —— `src/index.css`,把 531–572 行(台阶条 + `--cool` + `--pop` + `--big`)整段换成:

```css
/* 题位条:本节有几道题就几格,亮到第几格就是做到第几题(spec §9)。
   旧版三格「越右越高」编码的是**部分难度阶**,部分这个层没有了 ⇒ 格子等高、只有亮暗两态。
   读法与连击点同源(一排东西、亮/暗两态),孩子在这个游戏里已经学过,不用重新教。 */
.pstage-bar {
  display: flex;
  align-items: center;
  gap: 4px;
}
.pstage-step {
  width: 11px;
  height: 11px;
  border-radius: 3px;
  background-color: color-mix(in srgb, var(--color-ink) 18%, transparent);
}
.pstage-step--on {
  background-color: var(--color-accent);
}
```

再删 592–608 行整段(换段过场的 `.pstage-veil` + `@keyframes pveil-in`),并把 620–625 行的 `.ptray--review` 改名为 `.ptray--practice`(注释里的「复习段」改成「练习」):

```css
/* 练习的积木盘:去饱和灰 + 中性虚线环。虚线在这套语言里一贯表示「提示 / 非规则」。 */
.ptray--practice {
  background-color: color-mix(in srgb, var(--color-ink) 14%, var(--color-surface));
  border: 2px dashed color-mix(in srgb, var(--color-ink) 30%, transparent);
  box-shadow: var(--shadow-card);
}
```

`.pstage-bar--big` 的引用只剩 `StageBar` 的 `big` 入参(`PinyinBlocksGame` 不传),故 CSS 里保留一支最小定义即可:

```css
/* 放大版题位条(仅供将来复用;过场组件已退休)。 */
.pstage-bar--big {
  gap: 7px;
}
.pstage-bar--big .pstage-step {
  width: 18px;
  height: 18px;
}
```

校验没有任何 CSS 仍在引用已删的类:

```bash
grep -rn "pstage-veil\|pstage-step--cool\|pstage-step--pop\|ptray--review" src/ || echo "OK: 旧类已清干净"
```

- [ ] **Step 5: 删 `StageTransition.tsx`**

```bash
git rm src/features/pinyin-blocks/StageTransition.tsx
```

- [ ] **Step 6: `PinyinBlocksGame.tsx` 换用法**

- 第 21 行改成 `import { StageBar, StageDots } from './StageBar'`
- 两个 props 声明(第 59 行、第 102 行)`reviewProgress?: { done: number; total: number }` 改成:

```ts
  /** 本题在第几道 / 本串共几道。只影响画题位条与练习进度点。 */
  position?: { done: number; total: number }
```

- 第 121 行 `reviewProgress,` → `position,`
- 第 678–685 行那段改成:

```tsx
      {/* 题位条:一节有几道题就几格,亮到第几格就是做到第几题。
          练习改用小一号的进度点 —— 练习不是一节课(它的题数还会随星级变)。 */}
      <div className="flex flex-col items-center gap-1.5">
        {mode === 'review' ? (
          position ? <StageDots total={position.total} done={position.done} /> : null
        ) : (
          <StageBar total={position?.total ?? 1} done={position?.done ?? 0} />
        )}
      </div>
```

- 第 826 行 `reviewProgress={reviewProgress}` → `position={position}`
- 第 128 行 `const mode: StageId = review ? 'review' : stage` 里的 `StageId` 改成本地联合(这一轮**先**写成 `'easy' | 'hard' | 'review'`,`review` 的名字留到 Task 5 一起改,免得这一轮同时动太多):

```ts
  /** 三种口径。练习压过 stage —— 它自己就是一整串题。 */
  const mode: 'easy' | 'hard' | 'review' = review ? 'review' : stage
```

- [ ] **Step 7: `PartRun.tsx` 传位置** —— 第 98 行那个 `reviewProgress` 属性改成:

```tsx
      position={{ done: index + 1, total: items.length }}
```

并把 `PinyinBlocksGame` 那次调用上方那句注释改成:

```tsx
      // 题位条要的「第几道 / 共几道」在宿主这一层算 —— 组件自己不知道一节课有多长。
```

- [ ] **Step 8: `UnitEntry.tsx` 去掉过场**

- 删第 22 行 `import { StageTransition } from './StageTransition'`
- 删第 67–68 行 `transitionTo` 的 state
- `handlePartDone` 改成:

```tsx
  /** 本部分走完 → 交账 → 直接进下一部分(过场已取消),或回地图。 */
  const handlePartDone = useCallback(() => {
    flush()
    const next = nextPartOf(unit, part)
    if (next) setPart(next)
    else onExitToMap()
  }, [flush, unit, part, onExitToMap])
```

- 第 206–234 行的渲染分支改成(`transitionTo` 那一支整块删掉,只留两条):

```tsx
      {items.length > 0 ? (
        // 换部分即换 key ⇒ 部分内题号、盘面、发牌全部重来;**错题池在上层,跨部分不动**。
        <PartRun
          key={part}
          unit={unit}
          unitIndex={unitIndex}
          part={part}
          items={items}
          startIndex={startIndex}
          speak={speak}
          playSound={audio.play}
          onBlock={handleBlock}
          onQuestionEnd={part === 'review' ? undefined : endQuestion}
          onDone={handlePartDone}
        />
      ) : (
        // 空部分兜底:进去就是一块白屏(`partEnterable` 已在正常路径上挡掉)。
        // 没有过场可播了 —— 直接把决定权交回宿主。
        <EmptyPartFallback onDone={handlePartDone} />
      )}
```

并在文件末尾追加这个小件(零宽、只跑一次 effect,避免在渲染期调 setState):

```tsx
/** 空部分的兜底:渲染期不许调 `onDone`,故借一个 effect 把它推出去。 */
function EmptyPartFallback({ onDone }: { onDone: () => void }) {
  const done = useRef(onDone)
  useEffect(() => {
    done.current()
  }, [])
  return null
}
```

顶部 import 补 `useEffect`:`import { useCallback, useEffect, useMemo, useRef, useState } from 'react'`

- [ ] **Step 9: 修测试锚点**

`UnitEntry.test.tsx` 里三处过场断言(419 / 428 / 449 行)整块删掉,并新加一条「部分走完直接进下一部分,不再有过场」:

```tsx
  it('简单部分走完直接落到困难部分 —— 过场取消了', async () => {
    // 走法沿用本文件既有的「按正解一路填满」助手,走完最后一题后不再等 1.2s 遮罩
    await answerWholePart()
    expect(screen.getByText(/困难/)).toBeTruthy() // 或本文件既有的「当前部分」锚点
  })
```

> 执行时以本文件既有的定位方式为准(`data-part-progress` / 题面 emoji)—— 上面那行只是形状示例,锚点要换成文件里已有的那种。

`PartRun.test.tsx:105` 那条 `[data-stage-transition]` 断言删掉,同位置改成「走完一串题交回 onDone」。

`PinyinBlocksGame.test.tsx:1046` 的 `expect(document.querySelectorAll('.pstage-step')).toHaveLength(3)` 改成(题位条现在跟着 `position` 走):

```tsx
    expect(document.querySelectorAll('.pstage-step')).toHaveLength(1)
```

并把该文件里所有传 `reviewProgress=` 的地方改成 `position=`。

- [ ] **Step 10: 改公共面** —— `index.ts` 删这两处:

```ts
export { STAGE_TRANSITION_MS, StageTransition } from './StageTransition'
```

`StageBar` 那行的导出保留(名字没变),但把类型 `StageId` 去掉:

```ts
export { StageBar, StageDots } from './StageBar'
```

- [ ] **Step 11: 同步走查清单**(用户可见行为:过场消失、题位条语义变了)

`docs/walkthrough.md`:
- **W-C5**:去掉「本部分最后一题走完才出**换部分过场**」,改成「一节最后一题走完**直接回路径**(没有过场)」。本轮 UnitEntry 还在,故先写「部分内走到末尾不再有过场」,Task 7 再改成「回路径」。
- **W-C8**:整行重写 —— 解锁不再靠「部分末过场自动进困难部分」,而是「一节走完回路径,下一个节点亮起」。
- **W-C9** 里「两处**换部分过场**」那句删掉。

- [ ] **Step 12: 全量测试 + 提交**

```bash
npx vitest run
git add -A
git commit -m "refactor(pinyin-blocks): 题位条改成本节题位，删换部分过场 StageTransition

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 5: 练习口径下沉 —— PinyinBlocksGame 收 practice；PartRun → QuestionRun

**Files:**
- Modify: `src/features/pinyin-blocks/PinyinBlocksGame.tsx`
- Rename: `src/features/pinyin-blocks/PartRun.tsx` → `QuestionRun.tsx`(+ `PartRun.test.tsx` → `QuestionRun.test.tsx`)
- Modify: `src/features/pinyin-blocks/UnitEntry.tsx`
- Modify: `src/features/pinyin-blocks/index.ts`
- Modify: `src/features/pinyin-blocks/PinyinBlocksGame.test.tsx` / `UnitEntry.test.tsx`

**Interfaces:**
- Produces:
  - `PinyinBlocksGame` props:`practice?: PracticeQuestion | null`(替换 `review`)、`onQuestionEnd?: (result: QuestionResult) => void`(替换 `onPartEnd`)、`type QuestionResult = { missCount: number; failed: boolean }`(替换 `PartResult`,**去掉 `wrongBlocks`**)
  - `QuestionRun` / `type QuestionItem` / `type QuestionEnd = { levelId: string; stars: number }` / `QuestionRunProps`
- 删除:`MistakePool` 相关的一切(池、点错计数、错块上报)、`locked` / `prefill`、`StageId` 概念

- [ ] **Step 1: 写失败的测试** —— 在 `PinyinBlocksGame.test.tsx` 末尾加一组:

```tsx
describe('练习口径', () => {
  it('练习不记 miss、不上报连击、不交错块', async () => {
    const onBlock = vi.fn()
    const onQuestionEnd = vi.fn()
    const { container } = render(
      <PinyinBlocksGame
        unitIndex={0}
        levelIndex={0}
        practice={wholeReviewQuestion(UNITS[0]!.levels[0]!, 0, makeRng(0))}
        position={{ done: 1, total: 3 }}
        speak={vi.fn()}
        onBlock={onBlock}
        onQuestionEnd={onQuestionEnd}
      />,
    )
    // 故意把一块放错槽:练习里这不该计数
    await wrongDrop(container)
    expect(onBlock).not.toHaveBeenCalled()
    // 走完这一题 ⇒ 交回来的账目里 missCount 恒 0
    await finishPractice(container)
    expect(onQuestionEnd).toHaveBeenCalledWith({ missCount: 0, failed: false })
  })

  it('练习的盘面走灰底虚线环,困难盘面那套不出现', () => {
    const { container } = renderPractice()
    expect(container.querySelector('.ptray--practice')).not.toBeNull()
    expect(container.querySelector('.ptray--hard')).toBeNull()
  })
})
```

> `wrongDrop` / `finishPractice` / `renderPractice` 用本文件**已有的**助手(`placeBlockAt` / `fillAll` 之类)组装,别新写一套拖拽模拟。

- [ ] **Step 2: 跑测试确认它红**

Run: `npx vitest run src/features/pinyin-blocks/PinyinBlocksGame.test.tsx -t 练习口径`
Expected: FAIL —— `practice` 不是已知 prop(跑到 `review` 口径上)。

- [ ] **Step 3: 改 `PinyinBlocksGame.tsx`**

- 删 import:第 19 行整行(`addToPool, exactPoolKey, notePick, …`)换成:

```ts
import { wholeReviewQuestion, type PracticeQuestion } from './practice'
```

(若文件内不需要 `wholeReviewQuestion`,只引 `type PracticeQuestion` 即可 —— 由 `tsc` 与 lint 的未用导入规则兜底。)

- `Block` 的 import 保留(`slots` / `tray` 的类型要用)
- `PartResult` 改名为 `QuestionResult` 并去掉 `wrongBlocks`:

```ts
/** 一道题结束交回的账目。宿主据此落库与推进。 */
export type QuestionResult = Readonly<{
  /** 本题累计的错误次数。练习恒为 0 —— 星在进练习之前就落库了(spec §8)。 */
  missCount: number
  /** 困难题重试用尽 —— **不阻塞**,继续往下走。其余情形恒 false。 */
  failed: boolean
}>
```

- props:`review` → `practice`,`onPartEnd` → `onQuestionEnd`,`PartResult` → `QuestionResult`:

```ts
  /** 练习的一道题。给了它就走练习口径:预填无、限定托盘、不记 miss、不落库。 */
  practice?: PracticeQuestion | null
  /** 一道题结束交回账目。给了它就不再走 onSolved / 自走那条路 —— 由宿主决定下一步。 */
  onQuestionEnd?: (result: QuestionResult) => void
```

- `RoundProps` 同步:`review: PracticeQuestion | null` → `practice: PracticeQuestion | null`,`onPartEnd` → `onQuestionEnd`
- 第 127–131 行改成:

```ts
  /** 三种口径。练习压过 stage —— 它自己就是一整串题(spec §7)。 */
  const mode: 'easy' | 'hard' | 'practice' = practice ? 'practice' : stage
  const hard = mode === 'hard'
  /** 练习不记 miss、不上报连击 —— 星在进练习之前就落库了,练习做得再差也不掉星(spec §8)。 */
  const penalized = mode !== 'practice'
```

- 第 134–147 行:`review` → `practice`;预填相关整块删掉:

```ts
  // readonly:练习的托盘直接来自 `PracticeQuestion.tray`(契约就是只读的),这里不复制它。
  const tray: readonly TrayBlock[] = useMemo(
    () =>
      practice
        ? practice.tray
        : buildBlocks(level, unitIdx, makeRng(round), { hard }).map((b, i) => ({ ...b, id: `b${i}` })),
    [level, unitIdx, round, practice, hard],
  )
```

删掉 `locked` 那一行(原第 144 行),`placement` 初值改成:

```ts
  const [placement, setPlacement] = useState<Record<string, string>>({})
```

- 删 `poolRef` / `picksRef` / `noteWrongBlock`(原 165–189 行),删 `freezeResult` 里的 `wrongBlocks`:

```ts
  /** 账目在**判定那一刻**冻结(与星级同一口径):交的数字早已定下,不取决于定时器何时跑。 */
  const freezeResult = useCallback(
    (failed: boolean): QuestionResult => ({ missCount: missRef.current, failed }),
    [],
  )
```

- `endPart` → `endQuestion`(名字与 props 对齐),第 258–268 行:

```ts
  /** 本题结束:交回账目。给了 `onQuestionEnd` 就归宿主管;没给就退回老路(拼对 → onSolved)。 */
  const endQuestion = useCallback(
    (result: QuestionResult) => {
      if (onQuestionEnd) {
        onQuestionEnd(result)
        return
      }
      if (result.failed) return // 老路没有「失败」这一档;这条不该发生
      onSolved?.(starsFor(result.missCount))
    },
    [onQuestionEnd, onSolved],
  )
```

- 全文件把 `endPart` → `endQuestion`、`onPartEnd` → `onQuestionEnd`、`review` → `practice`、`REVIEW` 语义处改 `PRACTICE`:
  - 第 340 行 `if (locked.has(slotId)) return` 整行删
  - 第 347 行 `noteWrongBlock(block, blockId)` 整行删
  - 第 372 行 `if (bad) noteWrongBlock(bad, bad.id)` 整行删
  - 第 399 行 deps 里的 `locked` 删、第 410 行 `noteWrongBlock` 删
  - 第 420–423 行(纵深防御那段注释 + `if (locked.has(slotId)) return`)整块删
  - 第 430 行 deps 的 `locked` 删
  - 第 459 行 `noteWrongBlock(block, blockId)` 整行删
  - 第 620 行 `onClick={locked.has(slot.id) ? undefined : () => takeBack(slot.id)}` 改成 `onClick={() => takeBack(slot.id)}`
  - 第 707 行 `!hard && (mode === 'review' ? true : hint === 'mid') && 'pslots--mid'` 改成 `!hard && (mode === 'practice' ? true : hint === 'mid') && 'pslots--mid'`
  - 第 764 行 `mode === 'review' && 'ptray--review'` 改成 `mode === 'practice' && 'ptray--practice'`

- `hintFor(unit.id, missCount, mode)` 的第三参现在是 `'easy' | 'hard' | 'practice'` —— 本 task 同时改 `blocks.ts`(见下一条),否则编译不过。

- [ ] **Step 4: `blocks.ts` 的 `hintFor` 第三参换代**

```ts
/** 本题此刻的提示档:基线由单元给,连错 2 次临时回强(只升不降)。 */
export function hintFor(unitId: string, missCount: number, mode: 'easy' | 'hard' | 'practice' = 'easy'): Hint {
  if (missCount >= 2) return 'strong'
  // 练习恒弱:它考的是「还没打好的题」,不该把脚手架再搭回去。
  return mode === 'practice' ? 'weak' : (HINT_BY_UNIT[unitId] ?? 'strong')
}
```

`blocks.ts` 顶部那句 `import type { Part } from './part'` 整行删掉。

- [ ] **Step 5: `PartRun.tsx` → `QuestionRun.tsx`**

```bash
git mv src/features/pinyin-blocks/PartRun.tsx src/features/pinyin-blocks/QuestionRun.tsx
git mv src/features/pinyin-blocks/PartRun.test.tsx src/features/pinyin-blocks/QuestionRun.test.tsx
```

文件内容整体替换为:

```tsx
// 一串题的推进机:一道接一道自动走,走完把决定权交回宿主(回路径)。
// 复用 PinyinBlocksGame,只换入参 —— 不写第二套拼装台。
// **按题号换 key 重挂** —— 换题即清空,不在 effect 里 setState 补重置。

import { useCallback, useState } from 'react'
import type { AnswerKind } from '@/shared/services'
import type { Unit } from './levels'
import type { PracticeQuestion } from './practice'
import { PinyinBlocksGame } from './PinyinBlocksGame'
import { starsFor } from './rules'

/** 一串题里的一项。简单 / 困难节都是整题;练习也是一道**整题**(全槽挖空)。 */
export type QuestionItem =
  | Readonly<{ kind: 'level'; levelIndex: number }>
  | Readonly<{ kind: 'practice'; levelIndex: number; question: PracticeQuestion }>

/** 一道题结束的账目。宿主据此落库。 */
export type QuestionEnd = Readonly<{
  levelId: string
  /** 本题星级(0~3,`starsFor` 给的)。 */
  stars: number
}>

export type QuestionRunProps = {
  unit: Unit
  unitIndex: number
  /** 本题面身份:'easy' 走今天的玩法,'hard' 只比类型。练习由 `QuestionItem` 自己带。 */
  mode: 'easy' | 'hard'
  items: readonly QuestionItem[]
  /** 从这一项开始走(「接着上次」)。省略 = 从第 0 项。 */
  startIndex?: number
  speak: (text: string) => void
  playSound?: (cue: 'correct' | 'wrong' | 'victory' | 'tap') => void
  onBlock?: (kind: AnswerKind) => void
  /** 一道题结束。**不传 = 这一串不落库**(练习)。 */
  onQuestionEnd?: (end: QuestionEnd) => Promise<void>
  /** 本串走完 —— 宿主据此回路径。 */
  onDone: () => void
}

export function QuestionRun({
  unit,
  unitIndex,
  mode,
  items,
  startIndex = 0,
  speak,
  playSound,
  onBlock,
  onQuestionEnd,
  onDone,
}: QuestionRunProps) {
  // 起始题号在这里**冻结**:宿主每次渲染都会重算「本节第一道未通的题」,
  // 而走题过程中星级一直在变 —— 现算会把进度往回拽。本组件每次挂载只取一次初值。
  const [index, setIndex] = useState(startIndex)
  const item = items[index]

  const advance = useCallback(() => {
    if (index + 1 >= items.length) onDone()
    else setIndex(index + 1)
  }, [index, items.length, onDone])

  const onQuestionFinished = useCallback(
    async (missCount: number) => {
      const level = item ? unit.levels[item.levelIndex] : undefined
      if (item?.kind === 'level' && onQuestionEnd && level) {
        // **先 await 再推进**:孩子在这一题的庆祝动画里按「回路径」,那时这一题必须已经落库。
        await onQuestionEnd({ levelId: level.id, stars: starsFor(missCount) })
      }
      advance()
    },
    [item, unit, onQuestionEnd, advance],
  )

  if (!item) return null

  return (
    <PinyinBlocksGame
      // 换题即换 key ⇒ 盘面、提示全部重来。
      key={`${item.kind}-${index}`}
      unitIndex={unitIndex}
      levelIndex={item.levelIndex}
      stage={mode}
      practice={item.kind === 'practice' ? item.question : null}
      position={{ done: index + 1, total: items.length }}
      speak={speak}
      playSound={playSound}
      onBlock={onBlock}
      onQuestionEnd={(result) => { void onQuestionFinished(result.missCount) }}
    />
  )
}
```

- [ ] **Step 6: `UnitEntry.tsx` 改用新名字与练习题源**

- import 换:`import { QuestionRun, type QuestionEnd, type QuestionItem } from './QuestionRun'`
- import 换:`import { practiceQuestions } from './practice'`(删掉 `addToPool, partReviewQuestions, exactPoolKey, type MistakePool`)
- 删 `const [pool, setPool] = useState<MistakePool>([])`
- `items` 的 `useMemo` 改成:

```tsx
  const items: readonly QuestionItem[] = useMemo(() => {
    if (part === 'review') {
      // 练习的题源 = 本单元「<3 星」的题,封顶 5 道(口径在 `practiceLevelsOf`)。
      return practiceQuestions(unit, unitIndex, practiceLevelsOf(stars, unit)).map((item) => ({
        kind: 'practice' as const,
        levelIndex: item.levelIndex,
        question: item.question,
      }))
    }
    return partLevels(unit, part).map((level) => ({
      kind: 'level' as const,
      levelIndex: unit.levels.indexOf(level),
    }))
  }, [part, unit, unitIndex, stars])
```

- `endQuestion` 改成(错误行整块去掉):

```tsx
  /** 落库。**每道题结束时调一次**。 */
  const endQuestion = useCallback(
    async (end: QuestionEnd) => {
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
      pending.current = mergeSettlement(pending.current ?? EMPTY_PART_SETTLEMENT, result)
    },
    [progressSnap, settingsSnap, sessionCleared, progress, settings, combo, lucky, achievements],
  )
```

- `<PartRun …>` → `<QuestionRun … mode={part === 'hard' ? 'hard' : 'easy'} …>`
- 「练习不显示题数」那处注释里的「复习部分」改成「练习」
- 「连击的落点」注释里的「复习部分不上报」改成「练习不上报」
- 空练习的兜底:练习题表为空时 `items.length === 0` 会走 `EmptyPartFallback` → `handlePartDone` → `nextPartOf(unit,'review')` 为 null → 回地图。**这条路径保持**(地图上本来就点不进去;万一进去也是立刻弹回,不是白屏)。

- [ ] **Step 7: 改测试** —— `UnitEntry.test.tsx`

- 删 import 里的 `partReviewQuestions`,改成 `practiceLevelsOf`(`./progress-stats`)+ 断言用的题源
- 三处读 `[data-review-dots]` 的用例(479 / 492 行)保留,但锚点属性不变(`StageDots` 仍输出 `data-review-dots`)—— 但要确认练习的题数是**该单元 <3 星的题封顶 5**,不是 3:断言改成按 `practiceLevelsOf(stars, unit).length` 算
- 「复习部分不落库」那条守卫(`67c65ae` 加的)保留原判据,只把 `review` 的说法改成 `practice`

- [ ] **Step 8: 改公共面 `index.ts`**

```ts
export { QuestionRun, type QuestionEnd, type QuestionItem, type QuestionRunProps } from './QuestionRun'
export { PinyinBlocksGame, type PinyinBlocksGameProps, type QuestionResult } from './PinyinBlocksGame'
```

删掉原来的 `PartRun` 那一行与 `PartResult` 类型导出。任务清单里其余提到 `PartRun` / `PartItem` / `PartResult` 的地方一并改名。

- [ ] **Step 9: 全量测试 + 提交**

```bash
npx vitest run
git add -A
git commit -m "refactor(pinyin-blocks): 练习口径下沉（PartRun→QuestionRun，PinyinBlocksGame 收 practice，错题池删除）

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 6: LessonEntry + PracticeEntry（新组件，尚未接线）

**Files:**
- Create: `src/features/pinyin-blocks/LessonEntry.tsx`
- Create: `src/features/pinyin-blocks/LessonEntry.test.tsx`
- Create: `src/features/pinyin-blocks/PracticeEntry.tsx`
- Create: `src/features/pinyin-blocks/PracticeEntry.test.tsx`
- Modify: `src/features/pinyin-blocks/index.ts`

**Interfaces:**
- Consumes: `Lesson` / `UNITS` / `pathLessons`(Task 1)、`practiceLevelsOf`(Task 2)、`practiceQuestions`(Task 3)、`QuestionRun` / `QuestionEnd`(Task 5)、`settleLevel` / `mergeSettlement` / `EMPTY_PART_SETTLEMENT` / `PartSettlement`(`settle.ts`)、`cleared`(`progress-stats`)
- Produces:
  - `LessonEntry({ lessonId, onExitToPath, onSettle }): JSX`
  - `PracticeEntry({ unitId, onExitToPath }): JSX`

- [ ] **Step 1: 写失败的测试** —— `LessonEntry.test.tsx`

把 `UnitEntry.test.tsx` 顶部的 `makeStore` / `mountUnitEntry` 服务替身**整段复制**过来改名 `mountLessonEntry`,然后:

```tsx
describe('一节课', () => {
  it('起点 = 本节第一道未通的题（不是本节第 0 题）', () => {
    const lesson = pathLessons()[0]!
    const { container } = mountLessonEntry({ lessonId: lesson.id, stars: { [lesson.levelIds[0]!]: 1 } })
    // 第 0 题已通 ⇒ 落在第 1 题:题面是该题 emoji
    expect(container.textContent).toContain(levelById(lesson.levelIds[1]!).emoji)
  })

  it('本节全通时重玩从第 0 题起（-1 不许漏出去，否则白屏卡死）', () => {
    const lesson = pathLessons()[0]!
    const stars = Object.fromEntries(lesson.levelIds.map((id) => [id, 1]))
    const { container } = mountLessonEntry({ lessonId: lesson.id, stars })
    expect(container.textContent).toContain(levelById(lesson.levelIds[0]!).emoji)
  })

  it('题位条 = 本节题数，走完一题亮一格', () => {
    const lesson = pathLessons()[0]!
    mountLessonEntry({ lessonId: lesson.id, stars: {} })
    const bar = document.querySelector('[data-bar-total]') as HTMLElement
    expect(bar.dataset.barTotal).toBe(String(lesson.levelIds.length))
    expect(bar.dataset.barDone).toBe('1')
  })
})
```

> `levelById` 与「走完一题」的推进助手用本文件已有的定位方式实现(题面 emoji + 按正解填满)。

- [ ] **Step 2: 跑测试确认它红**

Run: `npx vitest run src/features/pinyin-blocks/LessonEntry.test.tsx`
Expected: FAIL —— `Cannot find module './LessonEntry'`。

- [ ] **Step 3: 写 `LessonEntry.tsx`**

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AchievementService,
  AudioService,
  CelebrateService,
  celebrationFor,
  ComboService,
  LuckyBonusService,
  PinyinProgressService,
  SettingsService,
  SpeechService,
  type AnswerKind,
} from '@/shared/services'
import { useService, useServiceSnapshot } from '@/shared/services/core'
import { cn } from '@/shared/ui/utils'
import { UNITS, pathLessons, type Lesson } from './levels'
import { cleared } from './progress-stats'
import { QuestionRun, type QuestionEnd, type QuestionItem } from './QuestionRun'
import { EMPTY_PART_SETTLEMENT, mergeSettlement, settleLevel, type PartSettlement } from './settle'

/** 连击圆点:5 颗封顶 —— 再多也读不出来,而 5 正好对上第一个撒花档。 */
const COMBO_DOTS = [0, 1, 2, 3, 4] as const

/**
 * 一节课(一个路径节点)。节内一道接一道自动走,走完**回路径** —— 没有换节过场(spec §7)。
 *
 * **起点不由孩子选**:从本节**第一道还没通的题**接着走;本节全通时从第 0 题起(整节重玩)。
 * 地图上只有当前节点和它前面已通的节点进得来,这一层不做门禁 —— 门禁在 `LearningPath` 上。
 */
export function LessonEntry({
  lessonId,
  onExitToPath,
  onSettle,
}: {
  lessonId: string
  onExitToPath(): void
  /** 一节走完交一次账(或退出到路径时补交)。 */
  onSettle(result: PartSettlement): void
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

  const stars = progressSnap.data.stars

  /**
   * 节点在**挂载时冻结一次**。`LessonEntry` 由宿主按 `lessonId` 换 key 重挂,
   * 故这个初值每节只取一次 —— 正是要的语义(走题过程中星级一直在变,现算会把进度往回拽)。
   */
  const [lesson] = useState<Lesson | null>(() => pathLessons().find((l) => l.id === lessonId) ?? null)
  const unitIndex = lesson ? UNITS.findIndex((u) => u.id === lesson.unitId) : -1
  const unit = unitIndex >= 0 ? UNITS[unitIndex]! : null

  const [sessionCleared, setSessionCleared] = useState(0)
  /** 已落库、还没交出去的账。**必须是 ref** —— 它跨整节活着。 */
  const pending = useRef<PartSettlement | null>(null)

  const comboLit = Math.min(comboSnap.combo, COMBO_DOTS.length)
  const speak = useCallback((text: string) => speech.speak(text, 'zh-CN'), [speech])

  /** 本节要走的题。`levelIndex` 一律是**在 `unit.levels` 里的下标** —— `QuestionRun` 拿它直接索引。 */
  const items: readonly QuestionItem[] = useMemo(() => {
    if (!lesson || !unit) return []
    return lesson.levelIds.flatMap((id) => {
      const levelIndex = unit.levels.findIndex((level) => level.id === id)
      return levelIndex < 0 ? [] : [{ kind: 'level' as const, levelIndex }]
    })
  }, [lesson, unit])

  /**
   * 从本节**第一道未通的题**接着走。本节全通 ⇒ 从第 0 题起(整节重玩)。
   *
   * `Math.max(0, …)` **不是多余的防御**:全通时 `findIndex` 返回 -1,少了这层,
   * `QuestionRun` 收到 `startIndex = -1` ⇒ `items[-1]` 是 `undefined` ⇒ `return null`
   * ⇒ 重玩全通节点白屏且不调 `onDone`(卡死)。
   */
  const startIndex = useMemo(() => {
    if (!lesson || !unit) return 0
    const at = lesson.levelIds.findIndex((id) => !cleared(stars, id))
    return at < 0 ? 0 : at
  }, [lesson, unit, stars])

  /** 落库。**每道题结束时调一次**。 */
  const endQuestion = useCallback(
    async (end: QuestionEnd) => {
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
      pending.current = mergeSettlement(pending.current ?? EMPTY_PART_SETTLEMENT, result)
    },
    [progressSnap, settingsSnap, sessionCleared, progress, settings, combo, lucky, achievements],
  )

  /** 发 onSettle + 撒花。**只发一次** —— 发完就清账,节末与中途退出共用这一条路。 */
  const flush = useCallback(() => {
    const result = pending.current
    if (!result) return
    pending.current = null
    onSettle(result)
    // 一次成功只撒一次花,而**一节只撒一次**(spec §7)—— 逐题撒花会把「拼对了」这件小事淹掉。
    if (result.achievements.length === 0 && result.luckyReward <= 0) celebrate.play('word')
  }, [onSettle, celebrate])

  /** 本节走完 → 交账 → 回路径。 */
  const handleDone = useCallback(() => {
    flush()
    onExitToPath()
  }, [flush, onExitToPath])

  /** 头部「回路径」。**先交账再走** —— 一节走到一半退出时,onSettle 还欠着。 */
  const handleExit = useCallback(() => {
    flush()
    onExitToPath()
  }, [flush, onExitToPath])

  // 连击的落点:每放一块上报一次。放对 'first'、放错 'wrong'。
  const handleBlock = useCallback(
    (kind: AnswerKind) => {
      const tier = celebrationFor(combo.answer(kind))
      if (tier) celebrate.play(tier)
    },
    [combo, celebrate],
  )

  // 课表外的 lessonId 或空题表:不进白屏,直接把决定权交回宿主。
  useEffect(() => {
    if (!lesson || !unit || items.length === 0) onExitToPath()
  }, [lesson, unit, items.length, onExitToPath])

  if (!lesson || !unit || items.length === 0) return null

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={handleExit}
          aria-label="回路径"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-surface/70 text-ink-2"
        >
          ←
        </button>
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
      </div>
      <QuestionRun
        unit={unit}
        unitIndex={unitIndex}
        mode={lesson.part === 'hard' ? 'hard' : 'easy'}
        items={items}
        startIndex={startIndex}
        speak={speak}
        playSound={audio.play}
        onBlock={handleBlock}
        onQuestionEnd={endQuestion}
        onDone={handleDone}
      />
    </div>
  )
}
```

- [ ] **Step 4: 跑 `LessonEntry.test.tsx` 确认绿**

Run: `npx vitest run src/features/pinyin-blocks/LessonEntry.test.tsx`
Expected: PASS。若「起点」那条挂了,先查 `pathLessons()` 的第一节是不是 u1 的 `u1#easy-0`(Task 1 已钉)。

- [ ] **Step 5: 写 `PracticeEntry.test.tsx`(先红)**

```tsx
describe('一次练习', () => {
  it('题数 = 本单元 <3 星的题（封顶 5），进度点跟它走', () => {
    const unit = UNITS[0]!
    const stars = { [unit.levels[0]!.id]: 2 }
    mountPracticeEntry({ unitId: unit.id, stars })
    expect(document.querySelectorAll('.pstage-dot')).toHaveLength(1)
  })

  it('不落库:走完一道题 progress.recordClear 一次都没调', async () => {
    const unit = UNITS[0]!
    const { progress } = mountPracticeEntry({ unitId: unit.id, stars: {} })
    await finishOneQuestion()
    expect(progress.recordClear).not.toHaveBeenCalled()
  })

  it('无题可练 ⇒ 立刻交回宿主，不画白屏', () => {
    const unit = UNITS[0]!
    const stars = Object.fromEntries(unit.levels.map((l) => [l.id, 3]))
    const onExit = vi.fn()
    render(<PracticeEntry unitId={unit.id} onExitToPath={onExit} />)
    expect(onExit).toHaveBeenCalled()
  })
})
```

- [ ] **Step 6: 跑它确认红**

Run: `npx vitest run src/features/pinyin-blocks/PracticeEntry.test.tsx`
Expected: FAIL —— 模块不存在。

- [ ] **Step 7: 写 `PracticeEntry.tsx`**

```tsx
import { useCallback, useEffect, useMemo } from 'react'
import { AudioService, PinyinProgressService, SpeechService } from '@/shared/services'
import { useService, useServiceSnapshot } from '@/shared/services/core'
import { UNITS } from './levels'
import { practiceLevelsOf } from './progress-stats'
import { practiceQuestions } from './practice'
import { QuestionRun, type QuestionItem } from './QuestionRun'

/**
 * 练习入口(原「复习部分」)。**不是课,是回炉**(spec §8):
 * 题源 = 本单元「<3 星」的题(封顶 5),每题一道整题;不落库、不记 miss、不上报连击
 * —— 练习做得再差也不掉星。
 *
 * 不参与逐节线性:该单元的节点解锁了它就能进(门禁在 `LearningPath`)。
 * 无题可练时地图上它不亮;万一还是进来了,这里立刻交回宿主,不画一块白屏。
 */
export function PracticeEntry({ unitId, onExitToPath }: { unitId: string; onExitToPath(): void }) {
  const progress = useService(PinyinProgressService)
  const speech = useService(SpeechService)
  const audio = useService(AudioService)
  const progressSnap = useServiceSnapshot(progress)

  const unitIndex = UNITS.findIndex((u) => u.id === unitId)
  const unit = unitIndex >= 0 ? UNITS[unitIndex]! : null
  const stars = progressSnap.data.stars

  const items: readonly QuestionItem[] = useMemo(() => {
    if (!unit) return []
    return practiceQuestions(unit, unitIndex, practiceLevelsOf(stars, unit)).map((item) => ({
      kind: 'practice' as const,
      levelIndex: item.levelIndex,
      question: item.question,
    }))
  }, [unit, unitIndex, stars])

  const speak = useCallback((text: string) => speech.speak(text, 'zh-CN'), [speech])

  // 课表外的 unitId 或空题表:立刻交回宿主(渲染期不许调 props,故借 effect)。
  useEffect(() => {
    if (!unit || items.length === 0) onExitToPath()
  }, [unit, items.length, onExitToPath])

  if (!unit || items.length === 0) return null

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={onExitToPath}
          aria-label="回路径"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-surface/70 text-ink-2"
        >
          ←
        </button>
      </div>
      <QuestionRun
        unit={unit}
        unitIndex={unitIndex}
        mode="easy"
        items={items}
        speak={speak}
        playSound={audio.play}
        // 不传 onQuestionEnd 与 onBlock:不落库、不记 miss、不报连击(spec §8)。
        onDone={onExitToPath}
      />
    </div>
  )
}
```

- [ ] **Step 8: 跑测试确认绿 + 扩公共面**

Run: `npx vitest run src/features/pinyin-blocks/PracticeEntry.test.tsx src/features/pinyin-blocks/LessonEntry.test.tsx`
Expected: PASS。

`index.ts` 追加:

```ts
export { LessonEntry } from './LessonEntry'
export { PracticeEntry } from './PracticeEntry'
```

- [ ] **Step 9: 全量测试 + 提交**

```bash
npx vitest run
git add -A
git commit -m "feat(pinyin-blocks): 一节课入口 LessonEntry 与练习入口 PracticeEntry

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 7: LearningPath —— 地图重画成三层路径

**Files:**
- Create: `src/features/pinyin-blocks/LearningPath.tsx`
- Create: `src/features/pinyin-blocks/LearningPath.test.tsx`(以 `UnitMap.test.tsx` 为底改写)
- Modify: `src/features/pinyin-blocks/index.ts`

**Interfaces:**
- Consumes: `UNITS` / `SECTIONS` / `pathLessons` / `unitsOfSection` / `unitLessonsOf` / `lessonState` / `sectionTotal` / `sectionClearedCount` / `unitClearedCount` / `unitTotal` / `practiceLevelsOf` / `unitUnlockedByPath`
- Produces:
  - `LearningPath({ stars, totalStars, badges, earned, onPickLesson, onPickPractice, onOpenParent }): JSX`
  - `type LearningPathProps`

- [ ] **Step 1: 写失败的测试** —— `LearningPath.test.tsx`

以 `UnitMap.test.tsx` 为底:**保留**它的服务无关渲染助手、名片字号那条、布局预算那条(锚点从 `[data-unit-map]` 换到 `[data-learning-path]`,`[data-unit-id]` 换到 `[data-lesson-id]`),**新增**:

```tsx
const renderPath = (stars: LevelStars = {}) =>
  render(
    <LearningPath
      stars={stars}
      totalStars={0}
      badges={ACHIEVEMENTS}
      earned={[]}
      onPickLesson={vi.fn()}
      onPickPractice={vi.fn()}
      onOpenParent={vi.fn()}
    />,
  )

describe('三层路径', () => {
  it('7 个段头 + 46 个节点 + 12 个练习入口', () => {
    const { container } = renderPath()
    expect(container.querySelectorAll('[data-section-id]')).toHaveLength(7)
    expect(container.querySelectorAll('[data-lesson-id]')).toHaveLength(46)
    expect(container.querySelectorAll('[data-practice-unit]')).toHaveLength(12)
  })

  it('12 个单元簇，其中 9 个画簇头（单单元段不画）', () => {
    const { container } = renderPath()
    expect(container.querySelectorAll('[data-unit-cluster]')).toHaveLength(12)
    // S1/S3/S7 各只有一个单元 ⇒ 段头已经把本段全部名片画完了,再画一遍是纯冗余;
    // 其余 4 段共 9 个单元 ⇒ 9 个簇头。
    expect(container.querySelectorAll('[data-unit-header]')).toHaveLength(9)
    expect(container.querySelector('[data-section-id="s1"] [data-unit-header]')).toBeNull()
  })

  it('三态:一道题没做时只有第 1 个节点是 current，其余全 locked', () => {
    const { container } = renderPath()
    expect(container.querySelectorAll('[data-lesson-state="current"]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-lesson-state="cleared"]')).toHaveLength(0)
    expect(container.querySelectorAll('[data-lesson-state="locked"]')).toHaveLength(45)
  })

  it('当前节点之后一律锁着：点它不回调', () => {
    const onPickLesson = vi.fn()
    const { container } = render(/* … onPickLesson={onPickLesson} … */)
    const locked = container.querySelector<HTMLElement>('[data-lesson-state="locked"]')!
    fireEvent.click(locked)
    expect(onPickLesson).not.toHaveBeenCalled()
  })

  it('全通时没有 current，且每个节点都可重玩', () => {
    const all = Object.fromEntries(pathLessons().flatMap((l) => l.levelIds).map((id) => [id, 1]))
    const { container } = renderPath(all)
    expect(container.querySelectorAll('[data-lesson-state="current"]')).toHaveLength(0)
    expect(container.querySelectorAll('[data-lesson-state="cleared"]')).toHaveLength(46)
  })

  it('练习入口：本单元一道 <3 星的题都没有时不亮，点它不回调', () => {
    const unit = UNITS[0]!
    // 只把 u1 做满 3 星 —— 其余单元的练习入口不受影响(它们的题一道没做)
    const stars = Object.fromEntries(unit.levels.map((l) => [l.id, 3]))
    const onPickPractice = vi.fn()
    const { container } = render(
      <LearningPath
        stars={stars}
        totalStars={0}
        badges={ACHIEVEMENTS}
        earned={[]}
        onPickLesson={vi.fn()}
        onPickPractice={onPickPractice}
        onOpenParent={vi.fn()}
      />,
    )
    const entry = container.querySelector<HTMLElement>('[data-practice-unit="u1"]')!
    expect(entry.dataset.practiceLit).toBe('false')
    fireEvent.click(entry)
    expect(onPickPractice).not.toHaveBeenCalled()

    // 反面:题一道没做的单元,入口是亮的、点得动
    const other = container.querySelector<HTMLElement>('[data-practice-unit="u2"]')!
    expect(other.dataset.practiceLit).toBe('true')
    fireEvent.click(other)
    expect(onPickPractice).toHaveBeenCalledWith('u2')
  })

  it('零文本:除无障碍标签外没有可见字符（数字不算文字）', () => {
    const { container } = renderPath()
    const path = container.querySelector('[data-learning-path]') as HTMLElement
    // 顶端星尘的数字、段/簇完成计数都是数字;任何汉字出现即红
    expect(/[一-龥]/.test(path.textContent ?? '')).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试确认它红**

Run: `npx vitest run src/features/pinyin-blocks/LearningPath.test.tsx`
Expected: FAIL —— 模块不存在。

- [ ] **Step 3: 写 `LearningPath.tsx`**

按下面骨架实现(顶栏与徽章栏**整段照搬** `UnitMap.tsx:64-125`,含 `BADGE_BOX` 与那两段布局预算注释 —— 这是**移动**不是重写):

```tsx
import { Check, Lock, Play, RotateCcw, Settings, Star } from 'lucide-react'
import type { Achievement, LevelStars } from '@/shared/services'
import { cn } from '@/shared/ui/utils'
import { BlockChip } from './BlockChip'
import { SECTIONS, UNITS, pathLessons, type Lesson, type Section, type Unit } from './levels'
import {
  lessonState,
  practiceLevelsOf,
  sectionClearedCount,
  sectionTotal,
  unitClearedCount,
  unitLessonsOf,
  unitTotal,
  unitsOfSection,
} from './progress-stats'

export type LearningPathProps = {
  stars: LevelStars
  totalStars: number
  badges: readonly Achievement[]
  /** 已得的成就 id。**`null` = 还不知道**(settings 未就绪)→ 整条徽章栏不渲染。 */
  earned: readonly string[] | null
  onPickLesson(lessonId: string): void
  onPickPractice(unitId: string): void
  onOpenParent(): void
}

/** 蛇形排布:节点在 4 个横向档位间来回,读起来是一条向左下折返的路。 */
const ZIGZAG = ['ml-0', 'ml-10', 'ml-20', 'ml-10'] as const

/** 段头名片 / 簇头名片里那些块:段头 = 段内单元 badge 的并集(按 `type:value` 去重)。 */
function badgesOf(units: readonly Unit<never>[] | readonly Unit[]) {
  const seen = new Set<string>()
  const out: { type: string; value: string }[] = []
  for (const unit of units) {
    for (const block of unit.badge) {
      const key = `${block.type}:${block.value}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(block)
    }
  }
  return out
}

/**
 * 学习路径。**零文本** —— 段头 / 簇头靠积木名片自表意 + 一个完成计数,节点靠三态图标:
 * 4-8 岁的孩子读不出「单韵母」这类字,而积木是他刚在游戏里摸过的东西。
 *
 * 三层可见结构(spec §6):Section 段头一行 → Unit 簇头一行(仅当段内单元 > 1)→ Lesson 圆形节点。
 * **单单元段不画簇头** —— 段头与簇头是同一套名片,画两遍是纯冗余。
 */
export function LearningPath({
  stars,
  totalStars,
  badges,
  earned,
  onPickLesson,
  onPickPractice,
  onOpenParent,
}: LearningPathProps) {
  const lessons = pathLessons()

  return (
    <div data-learning-path className="min-h-screen px-4 pb-10 pt-4">
      {/* 顶栏(星尘 + 家长)与成就徽章栏:整段照搬 UnitMap.tsx:64-125,注释一并搬过来。 */}

      <div className="mx-auto mt-6 flex max-w-2xl flex-col gap-10">
        {SECTIONS.map((section) => (
          <SectionGroup
            key={section.id}
            section={section}
            stars={stars}
            lessons={lessons}
            onPickLesson={onPickLesson}
            onPickPractice={onPickPractice}
          />
        ))}
      </div>
    </div>
  )
}

/** 一段:段头 + 段内各单元(簇头 + 节点 + 练习入口)。 */
function SectionGroup({
  section,
  stars,
  lessons,
  onPickLesson,
  onPickPractice,
}: {
  section: Section
  stars: LevelStars
  lessons: readonly Lesson[]
  onPickLesson(lessonId: string): void
  onPickPractice(unitId: string): void
}) {
  const units = unitsOfSection(section)
  return (
    <section data-section-id={section.id} className="flex flex-col gap-6">
      {/* 段头:本段新教块的积木名片行 + 段完成计数。**零文本**。 */}
      <div className="flex flex-col items-center gap-1">
        <span className="flex min-h-9 flex-wrap items-center justify-center gap-1.5">
          {badgesOf(units).map((block, i) => (
            <BlockChip key={`${block.type}-${block.value}-${i}`} type={block.type as never} value={block.value} className="h-9 w-9 text-[0.95rem]!" />
          ))}
        </span>
        <span data-section-progress={section.id} className="text-xs font-bold text-ink-2 tabular-nums">
          {sectionClearedCount(stars, section, lessons)}/{sectionTotal(section, lessons)}
        </span>
      </div>

      {units.map((unit) => (
        <UnitCluster
          key={unit.id}
          unit={unit}
          showHeader={units.length > 1}
          stars={stars}
          lessons={lessons}
          onPickLesson={onPickLesson}
          onPickPractice={onPickPractice}
        />
      ))}
    </section>
  )
}

/** 一个单元:簇头(可选)+ 本单元各节 + 练习入口(挂在簇末)。 */
function UnitCluster({
  unit,
  showHeader,
  stars,
  lessons,
  onPickLesson,
  onPickPractice,
}: {
  unit: Unit
  showHeader: boolean
  stars: LevelStars
  lessons: readonly Lesson[]
  onPickLesson(lessonId: string): void
  onPickPractice(unitId: string): void
}) {
  const own = unitLessonsOf(unit.id, lessons)
  const practice = practiceLevelsOf(stars, unit)
  const practiceLit = practice.length > 0
  return (
    <div data-unit-cluster={unit.id} className="flex flex-col items-center gap-3">
      {showHeader ? (
        <div data-unit-header={unit.id} className="flex flex-col items-center gap-1">
          <span className="flex min-h-8 flex-wrap items-center justify-center gap-1">
            {unit.badge.map((block, i) => (
              <BlockChip key={`${block.type}-${block.value}-${i}`} type={block.type} value={block.value} className="h-8 w-8 text-[0.85rem]!" />
            ))}
          </span>
          <span data-unit-progress={unit.id} className="text-xs font-bold text-ink-3 tabular-nums">
            {unitClearedCount(stars, unit)}/{unitTotal(unit)}
          </span>
        </div>
      ) : null}

      {own.map((lesson, i) => {
        const state = lessonState(stars, lesson, lessons)
        const locked = state === 'locked'
        return (
          <button
            key={lesson.id}
            type="button"
            data-lesson-id={lesson.id}
            data-lesson-state={state}
            aria-disabled={locked}
            aria-label={`第 ${i + 1} 节`}
            onClick={() => {
              if (locked) return
              onPickLesson(lesson.id)
            }}
            className={cn(
              'flex h-14 w-14 items-center justify-center rounded-full transition-shadow duration-150 ease-out',
              ZIGZAG[i % ZIGZAG.length],
              state === 'current' && 'm3-state cursor-pointer bg-accent text-accent-ink shadow-m3-2',
              state === 'cleared' && 'm3-state cursor-pointer bg-surface text-ink shadow-m3-1',
              locked && 'bg-surface-container-high text-ink-2 shadow-none',
            )}
          >
            {locked ? (
              <Lock aria-hidden className="h-5 w-5" />
            ) : state === 'current' ? (
              <Play aria-hidden className="h-5 w-5" />
            ) : (
              <Check aria-hidden className="h-6 w-6" />
            )}
          </button>
        )
      })}

      {/* 练习入口:与节点同列但形状不同(方一点 + 回炉图标)—— 它不是这条链上的一环。
          无题可练时不亮(spec §8.2):全 3 星 = 没什么可练的,伪造一道题是往屏幕上放假话。 */}
      <button
        type="button"
        data-practice-unit={unit.id}
        data-practice-lit={practiceLit ? 'true' : 'false'}
        aria-disabled={!practiceLit}
        aria-label={`练习 ${practice.length} 题`}
        onClick={() => {
          if (!practiceLit) return
          onPickPractice(unit.id)
        }}
        className={cn(
          'mt-1 flex h-11 w-11 items-center justify-center rounded-m3-lg',
          practiceLit
            ? 'm3-state cursor-pointer bg-surface-container-low text-ink shadow-m3-1 hover:shadow-m3-2'
            : 'bg-surface-container-high text-ink-2 shadow-none',
        )}
      >
        <RotateCcw aria-hidden className="h-5 w-5" />
      </button>
    </div>
  )
}
```

**执行注意**:
- `badgesOf` 的签名写简单些 —— 直接收 `readonly Unit[]`,返回 `readonly Block[]`(`Block` 从 `./blocks` 引)。上面那段按 `{ type: string; value: string }` 写只是为了说明去重键;实现时用真类型,`BlockChip` 的 `type` 入参不要再 `as never`。
- 顶栏那一段是**整段搬**;`UnitMap.tsx` 的 `BADGE_BOX` 常量与它上方那段布局预算注释一起搬进 `LearningPath.tsx`(它们解释的是徽章栏的尺寸预算)。
- 节点的 `aria-label` 用序号(零文本的例外:无障碍树里可以有字)。

- [ ] **Step 4: 跑测试确认绿**

Run: `npx vitest run src/features/pinyin-blocks/LearningPath.test.tsx`
Expected: PASS。挂了的按顺序查:段数 / 节点数 / 簇头数(9)/ 三态分布。

- [ ] **Step 5: 扩公共面** —— `index.ts`:

```ts
export { LearningPath, type LearningPathProps } from './LearningPath'
```

- [ ] **Step 6: 全量测试 + 提交**

```bash
npx vitest run
git add -A
git commit -m "feat(pinyin-blocks): LearningPath 三层路径（段头/簇头/蛇形节点 + 练习入口）

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 8: 接线 —— App / useAppState 切到节与练习；删旧三件套

**Files:**
- Modify: `src/app/useAppState.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/app/useAppState.test.tsx` / `src/app/App.test.tsx`
- Modify: `src/features/pinyin-blocks/MapEntry.tsx`(改成渲染 `LearningPath`,新 props)
- Delete: `src/features/pinyin-blocks/UnitEntry.tsx` + `UnitEntry.test.tsx`
- Delete: `src/features/pinyin-blocks/UnitMap.tsx` + `UnitMap.test.tsx`
- Modify: `src/features/pinyin-blocks/index.ts`
- Modify: `docs/walkthrough.md`(整份重走一遍 —— 地图从 12 格变路径)

**Interfaces:**
- Produces:
  - `type AppPhase = 'boot' | 'login' | 'path' | 'lesson' | 'practice' | 'parent'`
  - `AppState = { phase, lessonId: string | null, practiceUnitId: string | null, actions: { enterLesson(id), enterPractice(unitId), exitToPath(), openParent(), closeParent() } }`
  - `MapEntry({ badges, onPickLesson, onPickPractice, onOpenParent })`

- [ ] **Step 1: 改 `useAppState.test.tsx`(先红)**

```tsx
  it('六个相位:登录 → 路径 → 一节 / 一次练习,外加家长面板', () => {
    const { result } = renderHook(() => useAppState())
    expect(result.current.phase).toBe('boot')
    act(() => result.current.actions.enterLesson('u1#easy-0'))
    expect(result.current.phase).toBe('lesson')
    expect(result.current.lessonId).toBe('u1#easy-0')
    expect(result.current.practiceUnitId).toBeNull()
    act(() => result.current.actions.exitToPath())
    expect(result.current.phase).toBe('path')
    act(() => result.current.actions.enterPractice('u1'))
    expect(result.current.phase).toBe('practice')
    expect(result.current.practiceUnitId).toBe('u1')
    expect(result.current.lessonId).toBeNull()
  })
```

- [ ] **Step 2: 跑它确认红**

Run: `npx vitest run src/app/useAppState.test.tsx`
Expected: FAIL —— `enterLesson` 不存在。

- [ ] **Step 3: 重写 `useAppState.ts`**

```ts
import { useState } from 'react'

export type AppPhase = 'boot' | 'login' | 'path' | 'lesson' | 'practice' | 'parent'

export interface AppState {
  phase: AppPhase
  /** 正在走的节。只在 `phase === 'lesson'` 时非空。 */
  lessonId: string | null
  /** 正在练的单元。只在 `phase === 'practice'` 时非空。 */
  practiceUnitId: string | null
  actions: {
    enterLesson(lessonId: string): void
    enterPractice(unitId: string): void
    exitToPath(): void
    openParent(): void
    closeParent(): void
  }
}

/**
 * 六个相位:登录 → 学习路径 → 一节 / 一次练习,外加一个家长面板。**路径是唯一的「家」**。
 *
 * 两个查看相位**只存 id**,不存整个对象 —— 课程数据一变(加题、挪节),存下来的对象就是旧世界的一份
 * 快照,而 id 永远指向当前真实那份。`LessonEntry` / `PracticeEntry` 各自按 id 去课表里取。
 */
export function useAppState(): AppState {
  const [phase, setPhase] = useState<AppPhase>('boot')
  const [lessonId, setLessonId] = useState<string | null>(null)
  const [practiceUnitId, setPracticeUnitId] = useState<string | null>(null)

  const toPath = () => {
    setLessonId(null)
    setPracticeUnitId(null)
    setPhase('path')
  }

  return {
    phase,
    lessonId,
    practiceUnitId,
    actions: {
      enterLesson(id) {
        setLessonId(id)
        setPracticeUnitId(null)
        setPhase('lesson')
      },
      enterPractice(unitId) {
        setPracticeUnitId(unitId)
        setLessonId(null)
        setPhase('practice')
      },
      exitToPath: toPath,
      openParent() {
        setPhase('parent')
      },
      closeParent: toPath,
    },
  }
}
```

- [ ] **Step 4: 改 `MapEntry.tsx`**

```tsx
import { PinyinProgressService, SettingsService, type Achievement } from '@/shared/services'
import { useService, useServiceSnapshot } from '@/shared/services/core'
import { LearningPath } from './LearningPath'

/**
 * 路径页入口。useService 只允许出现在 <Name>Entry.tsx,故服务在这里取、以 props 下传。
 * 路径不需要音频 / 语音服务 —— 点锁着的节点只是不响应,不发声。
 *
 * settings 只用来读已得成就:`status !== 'ready'` 时传 `null`(「还不知道」),
 * 由 `LearningPath` 决定整条徽章栏不渲染 —— 不拿空数组冒充「一个都没拿到」。
 */
export function MapEntry({
  badges,
  onPickLesson,
  onPickPractice,
  onOpenParent,
}: {
  badges: readonly Achievement[]
  onPickLesson(lessonId: string): void
  onPickPractice(unitId: string): void
  onOpenParent(): void
}) {
  const progress = useService(PinyinProgressService)
  const settings = useService(SettingsService)
  const snapshot = useServiceSnapshot(progress)
  const settingsSnap = useServiceSnapshot(settings)

  return (
    <LearningPath
      stars={snapshot.data.stars}
      totalStars={snapshot.data.totalStars}
      badges={badges}
      earned={settingsSnap.status === 'ready' ? settingsSnap.data.earnedAchievements : null}
      onPickLesson={onPickLesson}
      onPickPractice={onPickPractice}
      onOpenParent={onOpenParent}
    />
  )
}
```

- [ ] **Step 5: 改 `App.tsx`**

- import 换成:

```tsx
import { LessonEntry, PracticeEntry, MapEntry, type PartSettlement } from '@/features/pinyin-blocks'
```

- `const { phase, currentUnitIndex, actions } = useAppState()` → `const { phase, lessonId, practiceUnitId, actions } = useAppState()`
- 登录成功那条 effect 里的 `actions.exitToMap()` → `actions.exitToPath()`
- 渲染分支改成:

```tsx
  let content
  if (authSnap.status === 'checking') content = <BootScreen />
  else if (authSnap.status !== 'authenticated') content = <AuthEntry />
  else if (phase === 'parent') content = <ParentPanel onClose={actions.closeParent} />
  else if (phase === 'lesson' && lessonId) {
    // 设置没就绪就进不去 —— 宁可进不去,也不能拿默认值覆盖服务端。
    // 显式三元而非把条件并进上层 if:并进去会落到下面的路径分支(静默回路径)。
    content = settingsSnap.status === 'ready'
      ? <LessonEntry
          // key 带节 id —— 从一节回路径再进另一节时强制重挂,别复用上一节的实例。
          key={lessonId}
          lessonId={lessonId}
          onExitToPath={actions.exitToPath}
          onSettle={handleSettle}
        />
      : <BootScreen />
  } else if (phase === 'practice' && practiceUnitId) {
    content = settingsSnap.status === 'ready'
      ? <PracticeEntry key={practiceUnitId} unitId={practiceUnitId} onExitToPath={actions.exitToPath} />
      : <BootScreen />
  // 路径要拿它渲染星星与星尘 —— 进度没到位就先停 boot,别闪一下空路径再跳
  } else if (progressSnap.status !== 'ready') {
    content = <BootScreen />
  } else {
    content = (
      <MapEntry
        badges={ACHIEVEMENTS}
        onPickLesson={actions.enterLesson}
        onPickPractice={actions.enterPractice}
        onOpenParent={actions.openParent}
      />
    )
  }
```

> `PracticeEntry` 也守 settings 理由是**连击 / 撒花的默认值风险**:练习不落库,但走题仍会读 combo 快照,和 LessonEntry 同一条纪律,保持一致。

- [ ] **Step 6: 删旧三件套**

```bash
git rm src/features/pinyin-blocks/UnitEntry.tsx src/features/pinyin-blocks/UnitEntry.test.tsx
git rm src/features/pinyin-blocks/UnitMap.tsx src/features/pinyin-blocks/UnitMap.test.tsx
```

`index.ts` 里对应的导出行删掉:

```ts
export { UnitEntry } from './UnitEntry'
export { UnitMap } from './UnitMap'
```

- [ ] **Step 7: 改 `App.test.tsx`**

- 所有 `enterUnit` / `exitToMap` / 单元页断言改成节与路径的口径(用 `data-learning-path`、`[data-lesson-id]`、`[data-practice-unit]` 定位)
- 第 308 行那条「UnitEntry 只负责结算」的注释与它的用例改成 `LessonEntry`
- 「登录后落在单元地图,只有第 1 单元可点」那条改成「登录后落在学习路径,**只有第一个节点可点**,其余 45 个带锁」

- [ ] **Step 8: 重走 `docs/walkthrough.md`**(用户可见行为 = 整页形态变了)

- **W-C1**:落在**学习路径**;**只有第 1 个节点可点**(亮橙色 ▶),其余 45 个是灰锁;练习入口按单元单独判亮不亮。
- **W-C2**:点**第 1 个节点**(节点本身即入口,圆形整块可点)→ 进第一节(3~5 题),**页头不再有「部分已通/总数」**,题位条就在题面图上方(几道题几格)。
- **W-C5**:一节最后一题走完 → **回路径**,没有过场。
- **W-C7**:刷新后回路径,节点三态与刷新前一致。
- **W-C8**:解锁 —— 走完一节回路径,**下一个节点**从锁变亮;走完 u1 的最后一节,**S2 段的第一个节点**亮起,段头计数 +1。
- **W-C9**:零文本半 —— 地图上新增**段头名片行 + 段完成计数**、**簇头名片行 + 单元完成计数**(只有多单元段才有簇头)、**圆形节点三态**、**练习入口**(回炉图标);**节内题位条**替代旧台阶条,**换部分过场已删除**(W-C9 里那句删掉)。
- 新增一行 **W-C10 练习入口**:把一个单元某题做成 2 星(故意错两次)→ 回路径看到该单元的练习入口**亮**着 → 点进去走完 → **星级没变、星尘没涨**;把该单元全部做成 3 星 → 入口**不亮、点不动**。

- [ ] **Step 9: 全量测试 + 提交**

```bash
npx vitest run
npx oxlint
git add -A
git commit -m "feat(pinyin-blocks): 学习路径上线（App 视图状态切到节/练习，UnitEntry 与 UnitMap 退休）+ 走查清单同步

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 9: 删除面收口（不留「永远为假」的死分支）

**Files:**
- Delete: `src/features/pinyin-blocks/part.ts`
- Delete: `src/features/pinyin-blocks/mistakes.ts` + `mistakes.test.ts`
- Modify: `src/features/pinyin-blocks/progress-stats.ts` + `progress-stats.test.ts`
- Modify: `src/features/pinyin-blocks/blocks.ts`(注释里的「复习部分」改写)+ `levels.test.ts:310` 附近
- Modify: `src/features/pinyin-blocks/index.ts`
- Modify: `docs/PLAN.md`(立项行勾掉)

**Interfaces:**
- 删除的导出(逐个 `grep -rn` 确认**零消费者**再删):`PARTS` / `Part`(整文件)、`firstIncompletePart` / `nextPartOf` / `isUnitUnlocked` / `partLevels` / `partTotal` / `partCleared` / `partClearedCount` / `partEnterable`、`MistakePool` / `PickCounts` / `PoolKey` / `familyPoolKey` / `exactPoolKey` / `notePick` / `addToPool` / `WRONG_PICK_THRESHOLD` / `MAX_REVIEW_QUESTIONS` / `reviewQuestionFor` / `partReviewQuestions` / `ReviewQuestion` / `PartReviewItem`

- [ ] **Step 1: 逐个确认零消费者**

```bash
grep -rn "PARTS\|firstIncompletePart\|nextPartOf\|isUnitUnlocked\|partLevels\|partTotal\|partCleared\|partEnterable\|MistakePool\|PickCounts\|PoolKey\|familyPoolKey\|exactPoolKey\|notePick\|addToPool\|WRONG_PICK_THRESHOLD\|MAX_REVIEW_QUESTIONS\|reviewQuestionFor\|partReviewQuestions\|ReviewQuestion\|PartReviewItem" src/
```

Expected:只出现在 `part.ts` / `mistakes.ts` / `progress-stats.ts` 自身、它们的测试、以及 `index.ts` 的导出面。**任何别的命中都是漏改** —— 先改掉,再继续。

- [ ] **Step 2: 删文件**

```bash
git rm src/features/pinyin-blocks/part.ts
git rm src/features/pinyin-blocks/mistakes.ts src/features/pinyin-blocks/mistakes.test.ts
```

- [ ] **Step 3: 清 `progress-stats.ts`**

删掉 `partLevels` / `partTotal` / `partClearedCount` / `partCleared` / `partEnterable` / `firstIncompletePart` / `nextPartOf` / `isUnitUnlocked`,以及顶部 `import { PARTS, type Part } from './part'` 那一行。

`progress-stats.ts` 里那句「复习部分恒返回 []」的注释随函数一起消失;头部总注释改成:

```ts
// 由星级表派生的统计:节级解锁、段/单元计数、通关数、三星数、完美单元数。
// 地图与成就都从这一份口径取数 —— 两处各算一遍必然漂移。
// 纯函数,不引 React、不引服务。
```

- [ ] **Step 4: 清 `progress-stats.test.ts`**

删掉 `describe('部分级统计')` / `describe('单元锁')` / `describe('起点与推进')` 三个块与合成单元 `noHard`(节级口径已在 `lesson-progress.test.ts` 覆盖);保留 `describe('拼音进度统计')` 那一组。

- [ ] **Step 5: 清 `index.ts` 导出面**

把 `progress-stats` 那一块改成只留活着的:

```ts
export {
  cleared,
  completedLevelCount,
  lessonCleared,
  lessonClearedCount,
  lessonIndex,
  lessonState,
  lessonsOfSection,
  nextLessonOf,
  perfectLevelCount,
  perfectUnitCount,
  PRACTICE_MAX,
  practiceLevelsOf,
  sectionCleared,
  sectionClearedCount,
  sectionTotal,
  totalLevelCount,
  unitClearedCount,
  unitLessonsOf,
  unitTotal,
  unitUnlockedByPath,
  unitsOfSection,
  type LessonState,
} from './progress-stats'
```

(若 `cleared` 此前没在公共面上,这一轮顺手导出 —— `LearningPath` / `LessonEntry` 都该能用同一条口径。)

删掉这些行:

```ts
export { PARTS, type Part } from './part'
export { PartRun, type PartItem, type PartRunProps, type QuestionEnd } from './PartRun'
```

并把 `mistakes` 那一整块导出**删掉**。

- [ ] **Step 6: 清 `blocks.ts` 与 `levels.ts` 里过时的注释**

```bash
grep -rn "复习部分\|复习关\|部分化" src/features/pinyin-blocks/*.ts src/features/pinyin-blocks/*.tsx
```

逐条改写成练习 / 节的口径(功能性描述**不许变**,只换词汇)。`levels.test.ts:310` 附近那条「漏改 `PinyinBlocksGame.tsx` 的第三参时…」的守卫注释改成「第三参 `practice`」。

`levels.ts` 里 `Level.stage` 与 `easyLevelsOf` 的注释里若提到「复习部分」,改成「练习不进这个口径 —— 它的题由星级表现算」。

- [ ] **Step 7: 全量测试 + lint**

```bash
npx vitest run
npx oxlint
```

Expected:全绿。若 `architecture.test.ts` 报未使用导出/注册纪律,按它说的收口。

- [ ] **Step 8: 提交**

```bash
git add -A
git commit -m "refactor(pinyin-blocks): 删除面收口（part.ts / 错题池 / 旧部分口径全退休）

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Task 10: 文档同步与全量验证

**Files:**
- Modify: `docs/dev-reference.md`(玩法与模块清单)
- Modify: `CLAUDE.md`(项目概述那段)
- Modify: `docs/PLAN.md`(立项行勾掉 + 复盘三问)
- Modify: `docs/superpowers/specs/2026-09-30-learning-path-sections-design.md`(若实现与 spec 有出入,把出入写进 §13)
- Verify: `docs/walkthrough.md`(Task 8 已改,这里复核一遍是否还有「部分 / 过场 / 复习部分」的残句)

- [ ] **Step 1: 找残句**

```bash
grep -rn "三部分\|换部分\|部分末\|复习部分\|firstIncompletePart\|UnitEntry\|UnitMap\|StageTransition" docs/ CLAUDE.md src/ | grep -v "docs/superpowers/"
```

Expected:只剩历史 spec / 计划里的记述(Task 9 已清代码)。凡在 `docs/dev-reference.md` / `CLAUDE.md` / `docs/PLAN.md` / `docs/walkthrough.md` 里的,**逐条改掉**。

- [ ] **Step 2: 改 `CLAUDE.md` 的项目概述**

把「一个单元 = 三部分(简单 / 困难 / 复习),三部分是一个整体 —— 地图上每个单元只有一个入口…」整段换成三层路径口径:

> 学习路径按 **Section(7 段)/ Unit(12 个)/ Lesson(每单元 3~5 题一节,共 46 节)** 组织:**只有第一个未全通的节可进**,它前面已通的节点可重玩,后面全是锁;一节内逐题自动推进,**走完回路径**(没有换节过场);每单元另挂一个**独立练习入口**(本单元 <3 星的题,封顶 5 道,不落库、不掉星;无题可练时不亮)。一题一颗星:0 次错 = 3 星、≤2 次 = 2 星、其余 = 1 星(1 星即通关,不会「失败」)。

- [ ] **Step 3: 改 `docs/dev-reference.md`**

- 模块清单里加 `lessons`(课程层的 Section/Lesson 派生视图)、`practice`(练习题源)、`LearningPath` / `LessonEntry` / `PracticeEntry` / `QuestionRun`
- 删掉 `part.ts` / `StageTransition` / `UnitEntry` / `UnitMap` / `PartRun` / 错题池的描述
- 「数据模型」一节补一句:节的边界是**派生的**(`lessonsOf` 均分),**不是存档键**;星的键仍是 182 个题 id

- [ ] **Step 4: 勾 `docs/PLAN.md` 立项行**

把那一行的 `- [ ]` 改成 `- [x]`,并在行末追加:

```
—— 已实现:`lessonsOf` 派生 46 节 / `nextLessonOf` 严格逐节线性 / `LearningPath` 三层零文本 / 练习入口(<3 星,封顶 5,不落库);见 plan `docs/superpowers/plans/2026-09-30-learning-path-sections.md`
```

- [ ] **Step 5: 全量验证**

```bash
npx vitest run
npx oxlint
npm run build
```

Expected:三条全绿(`content-constants.test.ts` 的 12/182/91+91 必须仍然通过 —— 它是这次重构没碰内容数据的证明)。

- [ ] **Step 6: 人工冒烟(必须真浏览器,不许用截图代替)**

`npm run dev` → 按 `docs/walkthrough.md` 的 **W-C1 / W-C2 / W-C8 / W-C9 / W-C10** 逐条走。**判不了就记「未验」**,不许记通过。

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "docs: 学习路径口径同步（CLAUDE.md / dev-reference / PLAN）

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec 覆盖**(逐节对照 spec):

| spec 节 | 落在哪个 task |
|---|---|
| §2 结构 / §2.1 规模(46 节 / 7 段) | Task 1 |
| §3 切分规则(均分、3~5 题) | Task 1 |
| §3.1 Lesson 是派生视图 | Task 1 |
| §4 数据模型(SECTIONS / 题数据不动) | Task 1 |
| §5.1 严格逐节线性 / §5.2 计数口径 | Task 2 |
| §6 地图与导航(三层、零文本、蛇形、单单元段不画簇头、46 节点长滚动) | Task 7 |
| §7 节律与结算(逐题落库、节末交账、撒花一节一次、mode 三值) | Task 4(mode/过场)、Task 5(账目)、Task 6(交账) |
| §8 练习入口 / §8.1 整题 / §8.2 空池不亮 | Task 2(题源)、Task 3(题源)、Task 6(入口组件)、Task 7(亮不亮) |
| §9 删除面 | Task 4 / 5 / 8 / 9 |
| §10 不变量(新守卫) | Task 1 / 2(切分与段覆盖、路径唯一、练习封顶) |
| §11 明确不做 | 全程未做(计划里没有任何一条碰它们) |
| §12 影响面 | Task 1–9 的文件清单 |
| §13 待实测 | Task 10 Step 6(人工冒烟) |

**2. 占位符扫描**:计划里没有 TBD / TODO / 「适当处理」。Task 6 / Task 7 的测试里有几处「用本文件已有的助手」是**指路**而非占位 —— 那几处指的是同目录已存在的具体文件与既有函数,执行时按文件里现成的那套写。

**3. 类型一致性**(跨 task 的名字已对齐):

- `Lesson` / `Section` / `lessonsOf` / `pathLessons` / `LESSON_MAX`(Task 1)→ Task 2 / 6 / 7 一致
- `lessonCleared` / `nextLessonOf` / `lessonState` / `unitLessonsOf` / `unitsOfSection` / `practiceLevelsOf` / `PRACTICE_MAX`(Task 2)→ Task 6 / 7 一致
- `PracticeQuestion` / `wholeReviewQuestion` / `practiceQuestions`(Task 3)→ Task 5 / 6 一致
- `QuestionResult` / `onQuestionEnd` / `position` / `practice`(Task 4 + 5)→ Task 6 一致
- `QuestionRun` / `QuestionItem` / `QuestionEnd`(Task 5)→ Task 6 一致
- `LearningPathProps` / `onPickLesson` / `onPickPractice`(Task 7)→ Task 8 一致
- `AppPhase` / `lessonId` / `practiceUnitId` / `enterLesson` / `enterPractice` / `exitToPath`(Task 8)→ 一致

**4. Review Focus 的落点**:5 条分别在 Task 1(第 6 条测试)、Task 2(前 5 条测试)、Task 7(第 2/3 条的 UI 侧)、Task 6(第 4 条)—— 都有具体断言,不是空承诺。
