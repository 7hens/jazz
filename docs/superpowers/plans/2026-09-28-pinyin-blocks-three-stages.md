# 拼音积木一关三段(简单 / 困难 / 复习)实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让一关分成「简单 → 困难 → 复习」三段:困难段放开「值必须对」这条门禁、让填满后真的能判错并重试,复习段把这一关孩子点错过的块挖空重考,三段各有看得见的形态。

**Architecture:** 玩法只有一套拼装台(`PinyinBlocksGame`),三段靠**入参**区分门禁 / 托盘 / 初始 placement,不新写平行组件。相位机放在 `LevelEntry` 下面一个新组件 `LevelRun`(按 `level.id` 换 key 重挂,不靠 effect 重置)。星在**困难段结束时就落库**,`onSettle` 与撒花推迟到复习段之后 —— 这是「复习到一半退出,星也得已经记上」的实现方式。后端与存档形状零改动。

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind 4 + motion;vitest(jsdom)+ @testing-library/react;纯 CSS 变量材质层在 `src/index.css`。

**Spec:** `docs/superpowers/specs/2026-09-27-pinyin-blocks-difficulty-design.md`(下称「spec」,章节号即该文件章节号)

## Global Constraints

- **游戏区零可见文字。** 所有中文只在 `aria-label` 与注释里;三段的区别只能靠形状、颜色、材质、动画。
- **后端零改动、零迁移。** 困难段与复习段的成绩不落库(spec 裁定 I);唯一影响是间接的 —— 它们改变 `missCount`,而 `missCount` 决定星级。
- **`canPlace` / `starsFor` / `autoTargetId` 的判定与取值一个字不改**(spec §5)。困难段用的是**另一个**函数 `sameTypeOnly`。
- **简单段的一切不动**:判定时机、`succeed` 的时序与动画时长(1600 / 2100ms)、`hintFor` 三档与 `HINT_BY_UNIT` 的 12 条、`buildBlocks` 的 `cap` 算法。
- **干扰块永远只来自 `taughtBlocks(unit)`** —— 没教过的块不许出现在题面上,易混伙伴不例外。
- **1 星即通关**,永远不是失败。
- **`src/index.css` 拼音积木材质段**(marker `/* ===== 拼音积木材质`)**禁一切颜色字面量**,只走 token + `color-mix`(唯一例外:白色高光 `rgb(255 255 255 / x)`);同类规则**只许有一条**(`material.test.ts` 按选择器字面量计数)。
- **依赖精简**:本行不新增任何 npm 依赖。
- **改用户可见行为必须在同一个提交里更新 `docs/walkthrough.md`**(Task 10)。
- 每个任务结束跑 `npm test` 必须全绿,提交前跑 `npm run lint`。
- 落盘产物(代码、注释、提交信息、文档、spec/plan)一律**正常行文**,不用 caveman 腔。

## Review Focus

以下是 spec 隐含、但任何任务的测试都不会自然覆盖的输入 / 失败模式。每条都已指派给一个任务的测试。

1. **复习托盘里一块错块都不剩**(池里那些错块的 family key 与挖空槽的正解相同,被 §3.7 那条过滤规则全部滤掉)—— 孩子看到的是一道只剩正解的题。预期:仍出一道有效小题(挖空槽 ≥1、托盘里**不会**出现两块同形块),不崩。→ Task 5。
2. **困难段重试用尽、正解演示正在进行时,孩子继续点托盘块 / 拖块** —— 预期:不重复演示、不重复触发段结束、不重复落库、不重复推进下一关。→ Task 8。
3. **复习段中途按「回地图」** —— 预期:这一关的星**已经**落库(`recordClear` 已调用),`onSettle` 恰好发一次(不重不漏)。→ Task 9。
4. **同一关重玩(已通关的关再进)** —— 预期:相位回到简单段重跑,池清零;星级只升不降(合并在 `pinyin-progress`,本行不改)。→ Task 9。
5. **双音节 + 双身份块**(`xī guā`:同一关既有介母 `u` 又有韵母 `i`)—— 预期:困难段托盘里介母块与韵母块各归各的类型,复习小题挖空两个同类型槽时托盘给足**两块**正解。→ Task 2 / Task 3。

---

## 文件结构

| 文件 | 责任 |
|---|---|
| `src/features/pinyin-blocks/blocks.ts` | 改:新增纯语言学知识表 `CONFUSABLE`(易混伙伴) |
| `src/features/pinyin-blocks/blocks.test.ts` | 新建:`CONFUSABLE` 的值域护栏 |
| `src/features/pinyin-blocks/rules.ts` | 改:`familyKey`、`buildBlocks` 的伙伴优先与 `opts.hard`、`sameTypeOnly`、`autoTypeTargetId`、`HARD_RETRIES`、`HARD_TRAY_PER_TYPE`、`wrongSlotIds` 的可注入判据 |
| `src/features/pinyin-blocks/mistakes.ts` | 新建:错题池与复习小题的纯逻辑(阈值、去重、上限、小题推导) |
| `src/features/pinyin-blocks/mistakes.test.ts` | 新建:池与小题的纯逻辑测试 |
| `src/features/pinyin-blocks/StageBar.tsx` | 新建:段标(台阶条)+ 复习段小题进度点 |
| `src/features/pinyin-blocks/StageTransition.tsx` | 新建:换段过场(暗遮罩 + 放大的台阶条,停 1.2s) |
| `src/features/pinyin-blocks/StageBar.test.tsx` | 新建:段标 / 进度点 / 过场的渲染测试 |
| `src/features/pinyin-blocks/PinyinBlocksGame.tsx` | 改:三段入参(`stage` / `review` / `reviewProgress` / `onSectionEnd`)+ 点错块的视觉反馈 |
| `src/features/pinyin-blocks/LevelRun.tsx` | 新建:一关的三段相位机 |
| `src/features/pinyin-blocks/LevelEntry.tsx` | 改:落库与 `onSettle` 拆到复习段两侧,挂 `LevelRun` |
| `src/features/pinyin-blocks/index.ts` | 改:导出新公共面 |
| `src/index.css` | 改:台阶条 / 过场遮罩 / 困难段槽与托盘 / 复习段托盘 / 点错块 |
| `src/features/pinyin-blocks/material.test.ts` | 改:新增材质护栏 |
| `docs/walkthrough.md` / `CLAUDE.md` / `docs/dev-reference.md` / `docs/PLAN.md` | 改:文档同步 |

---

### Task 1: 易混伙伴表 `CONFUSABLE`

**Files:**
- Modify: `src/features/pinyin-blocks/blocks.ts`(在 `SPEAK_OF` 之后、`speakOf` 之前插入)
- Test: `src/features/pinyin-blocks/blocks.test.ts`(新建)

**Interfaces:**
- Consumes: `BlockType`、`INITIALS_ALL`、`FINAL_BASIC`、`FINAL_COMPOUND`、`MEDIALS`、`NASALS`(均已在 `blocks.ts` 里)
- Produces: `CONFUSABLE: Readonly<Record<BlockType, Readonly<Record<string, readonly string[]>>>>`

- [ ] **Step 1: 写失败的测试**

新建 `src/features/pinyin-blocks/blocks.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { CONFUSABLE, FINAL_BASIC, FINAL_COMPOUND, INITIALS_ALL, MEDIALS, NASALS, type BlockType } from './blocks'

/** 每一类块真实存在的值域 —— 表里写错一个字母不会有别的东西红,只有这里能拦。 */
const DOMAIN: Record<BlockType, readonly string[]> = {
  initial: INITIALS_ALL,
  medial: MEDIALS,
  final: [...FINAL_BASIC, ...FINAL_COMPOUND],
  nasal: NASALS,
  tone: [],
}

describe('CONFUSABLE', () => {
  it('每个键与每个伙伴值都是该类型下真实存在的块值', () => {
    for (const [type, table] of Object.entries(CONFUSABLE) as [BlockType, Record<string, readonly string[]>][]) {
      for (const [key, friends] of Object.entries(table)) {
        expect(DOMAIN[type], `${type} 里的键 ${key} 不是真实块值`).toContain(key)
        for (const friend of friends) {
          expect(DOMAIN[type], `${type}:${key} 的伙伴 ${friend} 不是真实块值`).toContain(friend)
        }
      }
    }
  })

  it('伙伴不含自己(自己跟自己不像,也不该占掉一个干扰名额)', () => {
    for (const [type, table] of Object.entries(CONFUSABLE) as [BlockType, Record<string, readonly string[]>][]) {
      for (const [key, friends] of Object.entries(table)) {
        expect(friends, `${type}:${key}`).not.toContain(key)
      }
    }
  })

  it('声调没有这张表(四声恒全出,不需要易混对)', () => {
    expect(Object.keys(CONFUSABLE.tone)).toEqual([])
  })

  // 单韵母 a/o/e/i 与 er 不进表:u1 面对的是刚认字母的孩子,那里不该有陷阱(spec §3.1 第 3 条)。
  it('单韵母与 er 不在表里', () => {
    for (const value of ['a', 'o', 'e', 'i', 'er']) {
      expect(Object.keys(CONFUSABLE.final), `韵母 ${value} 不该有易混对`).not.toContain(value)
    }
  })
})
```

- [ ] **Step 2: 跑测试确认它失败**

Run: `npx vitest run src/features/pinyin-blocks/blocks.test.ts`
Expected: FAIL —— `CONFUSABLE` is not exported(导入报错 / TypeError)。

- [ ] **Step 3: 写最小实现**

在 `src/features/pinyin-blocks/blocks.ts` 的 `SPEAK_OF` 定义**之后**、`speakOf` 函数之前插入:

```ts
/**
 * 易混伙伴:一块积木在托盘里优先拿谁来当干扰块。
 * 只写「像」,不写「教没教」—— 后者由 taughtBlocks 在运行时过滤(见 rules.ts 的 buildBlocks),
 * 于是**难度曲线是课程曲线自动派生的**:u1 一个伙伴都没教,关卡难度不变;u2 教齐 b/p/d/t/n/l/m
 * 之后开始出对;u4 进来平翘舌整组;u5 进来复韵母对;u7 进来前后鼻尾。
 *
 * 三条口径:
 * 1. 表是**不对称**的(`b: ['p']` 与 `p: ['b']` 各写一遍)—— 有些对本来就不对称
 *    (平翘舌里孩子更常误选 zh 而不是 z),结构上留余地。
 * 2. 表只表达「像」,不表达「教过没有」。
 * 3. 单韵母 a/o/e/i 与 er 不进表 —— u1 面对的是刚认字母的孩子,那里不该有陷阱。
 */
export const CONFUSABLE: Readonly<Record<BlockType, Readonly<Record<string, readonly string[]>>>> = {
  initial: {
    b: ['p'], p: ['b'],
    d: ['t'], t: ['d'],
    g: ['k'], k: ['g'],
    j: ['q'], q: ['j'],
    zh: ['z', 'ch'], z: ['zh', 'c'], ch: ['c', 'zh'], c: ['ch', 'z'],
    sh: ['s'], s: ['sh'],
    n: ['l'], l: ['n'],
    m: ['n'],
    f: ['h'], h: ['f'],
  },
  medial: { u: ['ü'], ü: ['u'] },
  final: {
    u: ['ü'], ü: ['u'],
    ai: ['ei'], ei: ['ai'],
    ao: ['ou'], ou: ['ao'],
    iu: ['ui'], ui: ['iu'],
    ie: ['üe'], üe: ['ie'],
  },
  // 前/后鼻音只差一个鼻尾,所以「对」记在鼻尾上,而不在韵腹上 —— an / ang 的韵腹是同一个 a。
  nasal: { n: ['ng'], ng: ['n'] },
  // 四声恒全出(见 toneBlocks),声调不需要这张表。
  tone: {},
}
```

- [ ] **Step 4: 跑测试确认它通过**

Run: `npx vitest run src/features/pinyin-blocks/blocks.test.ts`
Expected: PASS(4 条)。

- [ ] **Step 5: 提交**

```bash
git add src/features/pinyin-blocks/blocks.ts src/features/pinyin-blocks/blocks.test.ts
git commit -m "feat(pinyin-blocks): 最小对立干扰块的知识表 CONFUSABLE"
```

---

### Task 2: `familyKey` 去重 + 干扰块伙伴优先

**Files:**
- Modify: `src/features/pinyin-blocks/rules.ts:72`(`keyOf` 之后新增 `familyKey`)、`:111`(`takenKeys` 的判据)、`:124-134`(游标构建)
- Test: `src/features/pinyin-blocks/rules.test.ts`(`describe('buildBlocks')` 内追加)

**Interfaces:**
- Consumes: Task 1 的 `CONFUSABLE`
- Produces: `familyKey(b: Block): string`(从 `rules.ts` 导出)

- [ ] **Step 1: 写失败的测试**

在 `src/features/pinyin-blocks/rules.test.ts` 的 `describe('buildBlocks')` 块**末尾**(G8b 那条之后)追加:

```ts
  // 双身份块(i/u/ü)在孩子手里是**同一块积木**:canPlace 允许介母槽与韵母槽互换,
  // 而旧去重按「类型 + 值」算,于是 guā 的托盘里会多出一块 final:u —— 它拖进介母槽
  // canPlace 判通过,成了「干扰块里唯一能放的」,孩子随手一拖就中(spec §3.3)。
  it('双身份块按家族去重:托盘的干扰块里不再出现与正确块同字母的另一身份', () => {
    const blocks = build(GUĀ, seq([0.31, 0.62, 0.17, 0.83, 0.44]))
    const solution = solutionValues(GUĀ)
    const extras = blocks.filter((b) => !solution.has(`${b.type}:${b.value}`) && b.type !== 'tone')
    // guā 的正确块是 initial:g + medial:u + final:a —— final:u 是那个必须消失的冒牌货。
    expect(extras.some((b) => b.value === 'u'), '托盘里还有第二块 u').toBe(false)
  })

  // 反过来:声母 n 与鼻尾 n 值相同、类型不同,是两个**真身份**(canPlace 判它们不通用),
  // 同时出现是刻意设计 —— 一律按值去重会把这一对合法干扰块删掉,等于把游戏改简单。
  it('声母 n 与鼻尾 n 是两个身份,不许被家族去重合并', () => {
    const zhōng = byId('u9-0') // 中 zhōng = zh + o + ng,池里已有 n 与 ng 也会教到 n
    const unit = unitIdxOf('u9-0')
    for (let i = 0; i < 20; i++) {
      const blocks = buildBlocks(zhōng, unit, seq([0.05 * i, 0.37, 0.91]))
      const ns = blocks.filter((b) => b.value === 'n')
      // 同一次发牌里若两块都在,必须一个是 initial、一个是 nasal —— 不能是两块同类型。
      const keys = ns.map((b) => `${b.type}:${b.value}`)
      expect(new Set(keys).size, `同一类型出现两块 n:${keys.join(',')}`).toBe(keys.length)
    }
  })

  // 易混伙伴优先取:把伙伴放在候选游标**尾部**(取块走 pop,取尾),于是有已教伙伴时先取它。
  it('有已教伙伴时,干扰块优先取伙伴', () => {
    const bà = byId('u2-0') // 爸 bà = b + a
    const extra = build(bà, seq([0.42, 0.13, 0.87, 0.24])).filter(
      (b) => b.type === 'initial' && b.value !== 'b',
    )
    expect(extra.map((b) => b.value)).toContain('p') // b 的易混伙伴
  })

  it('伙伴没教过就不取:同一道题在只教了 b 的池子里取不到任何伙伴', () => {
    // u1 的池里一个声母都没有 —— 构造一个「池子里没有伙伴」的查法:直接看 u1 的题。
    const first = UNITS[0]!.levels[0]!
    const extras = buildBlocks(first, 0, seq([0.2, 0.6, 0.4])).filter((b) => b.type !== 'tone')
    for (const b of extras) {
      expect(seenIn(b.type, 0), `${b.type}:${b.value} 不在 u1 的池里`).toContain(b.value)
    }
    // u1 的韵母池里没有 CONFUSABLE.final 的任何键(a/o/e/i 都不进表)⇒ 一道题都取不到伙伴。
    const keys = new Set(extras.filter((b) => b.type === 'final').map((b) => b.value))
    for (const v of keys) expect(Object.keys(CONFUSABLE.final)).not.toContain(v)
  })
```

同时把该文件顶部的 `import { TONE_VALUES, type Block } from './blocks'` 改成:

```ts
import { CONFUSABLE, TONE_VALUES, type Block } from './blocks'
```

- [ ] **Step 2: 跑测试确认它失败**

Run: `npx vitest run src/features/pinyin-blocks/rules.test.ts -t "家族"`
Expected: FAIL —— 「双身份块按家族去重」那条红(`托盘里还有第二块 u`)。**注意**:`u5-0` 的池子里确实要有 `final:u` 且要真被取到;若这条没有红,不要改断言,先按下面 Step 3 里 `cursors` 的写法核对一遍候选池(gua 的 `final` 池 = 已教韵母去掉 `a`,里面必然有 `u`)。

- [ ] **Step 3: 写实现**

`src/features/pinyin-blocks/rules.ts` 顶部 import 改成:

```ts
import { CONFUSABLE, DUAL_VALUES, TONE_VALUES, type Block, type BlockType } from './blocks'
```

在 `const keyOf = ...`(第 72 行)**之后**插入:

```ts
/**
 * 家族键:i / u / ü 只按值算,其余仍按「类型 + 值」。
 *
 * canPlace 对双身份块明确允许介母 ↔ 韵母互换 —— 也就是说 `medial:u` 与 `final:u`
 * 在孩子手里是**同一块积木**。按 keyOf 去重会留下两块一模一样的「u」,其中一块拖到
 * 某个槽上是「对」、另一块拖到同一个槽上也是「对」(spec §3.3)。
 *
 * **不能一律按值去重**:`initial:n`(声母 n,读「讷」)与 `nasal:n`(鼻尾 n,读「恩」)
 * 值相同但 canPlace 判它们**不通用**,是两个真身份 —— 它们同时出现在托盘里是刻意设计。
 * **困难段是例外**:那一段按类型严格比,介母块与韵母块是两个真身份,一律走 keyOf。
 */
export const familyKey = (b: Block): string => (DUAL_VALUES.has(b.value) ? b.value : keyOf(b))
```

把 `buildBlocks` 里的 `takenKeys` 那一行(第 111 行)改成:

```ts
  // 简单段与复习段按家族去重(双身份块算同一块);困难段的门禁只比类型,那两身份是真的,按 keyOf。
  const dedupeKey = opts.hard ? keyOf : familyKey
  const takenKeys = new Set([...required, ...tones].map(dedupeKey))
```

(`opts` 参数在 Task 3 加;本步先写 `const dedupeKey = familyKey` —— Task 3 再改成三元的写法。**本步就写 `familyKey`,不要提前引 `opts`。**)

把游标构建(`:124-134`)整体换成:

```ts
  const cursors = new Map<BlockType, string[]>()
  for (const type of types) {
    const used = new Set(required.filter((b) => b.type === type).map((b) => b.value))
    const pool = (taught.get(type) ?? []).filter((v) => !used.has(v))
    // 易混伙伴放在游标**尾部** —— 取块走 pop()(取尾),于是伙伴先被取走(spec §3.2)。
    // 伙伴先按 taughtBlocks 过滤过一遍:没教过的伙伴不进托盘。
    const friends = new Set(
      required.filter((b) => b.type === type).flatMap((b) => CONFUSABLE[type][b.value] ?? []),
    )
    const near = pool.filter((v) => friends.has(v))
    const far = pool.filter((v) => !friends.has(v))
    cursors.set(type, [...shuffle(far, rng), ...shuffle(near, rng)])
  }
```

把取块循环里的 `if (takenKeys.has(keyOf(block))) continue` 改成 `if (takenKeys.has(dedupeKey(block))) continue`,`takenKeys.add(keyOf(block))` 改成 `takenKeys.add(dedupeKey(block))`。

- [ ] **Step 4: 跑测试确认它通过**

Run: `npx vitest run src/features/pinyin-blocks/rules.test.ts`
Expected: PASS(全部,含既有的 G8 / G8b)。

> **若 G8(「复习关的干扰块比同题面非复习时多」)或 G8b(「至少一个复习关真的摊满 5」)变红:先诊断,不许回退 `familyKey`。**
> 这两条比的都是**干扰块条数**,而条数只由「每类候选池的大小 + 取块循环」决定,与取到什么值无关 —— 唯一能让条数变化的是取块循环里那个 `continue`:它**消耗一个 `placed` 名额却不放块**。家族去重让这个 `continue` 更容易命中(候选值被前面的 `used`/`takenKeys` 判重)。
> 诊断顺序:① 临时打印每个复习关的 `extras.length`,看是哪几关掉了一格;② 若掉格只发生在有双身份块的关(u5 起),把 `taught` 构建的那几行改成按类型去重 —— `for (const value of new Set((taught.get(type) ?? [])))`(课程数据里同一个值会被 push 多次,重复值正是那个空耗名额的来源);③ 重跑;④ 若仍有关掉到 4,把该关的 `cap` 依据与 G8b 的断言一并复核后**在提交信息里写明原因**,不要默默放宽断言。

- [ ] **Step 5: 提交**

```bash
git add src/features/pinyin-blocks/rules.ts src/features/pinyin-blocks/rules.test.ts
git commit -m "fix(pinyin-blocks): 双身份块按家族去重,并把易混伙伴排进取块游标尾部"
```

---

### Task 3: 困难段托盘(`buildBlocks` 的 `opts.hard`)

**Files:**
- Modify: `src/features/pinyin-blocks/rules.ts:108-152`(`buildBlocks` 的签名与取块循环)
- Test: `src/features/pinyin-blocks/rules.test.ts`(追加)

**Interfaces:**
- Consumes: Task 2 的 `dedupeKey` / `familyKey`
- Produces:
  - `type BuildOptions = { readonly hard?: boolean }`
  - `buildBlocks(level: Level, unit: number, rng?: Rng, opts?: BuildOptions): Block[]`
  - `const HARD_TRAY_PER_TYPE = 2`

- [ ] **Step 1: 写失败的测试**

在 `src/features/pinyin-blocks/rules.test.ts` 的 `describe('buildBlocks')` 末尾追加:

```ts
  // 困难段的全部手感在托盘:干扰不够就不构成难度(spec §3.6)。
  // 与简单段的 cap 是**两个旋钮** —— 这里拧的是「每个用到的类型至少 2 块」。
  it('困难段:每个用到的类型至少 2 块,声调照旧四声全出', () => {
    for (let unit = 0; unit < UNITS.length; unit++) {
      for (const level of UNITS[unit]!.levels) {
        const blocks = buildBlocks(level, unit, seq([0.23, 0.71, 0.44, 0.09]), { hard: true })
        const types = [...new Set(requiredBlocks(level).map((b) => b.type))]
        for (const type of types) {
          const values = new Set(blocks.filter((b) => b.type === type).map((b) => b.value))
          // u1 的池子天然不够时给不出 2 块 —— 那是课程的事实,不是算法漏了。
          expect(values.size, `${level.pinyin} 的 ${type} 只给了 ${values.size} 块`).toBeGreaterThanOrEqual(
            Math.min(2, seenIn(type, unit).length),
          )
        }
        for (const t of TONE_VALUES) {
          expect(blocks.some((b) => b.type === 'tone' && b.value === t), `${level.pinyin} 少了声调 ${t}`).toBe(true)
        }
      }
    }
  })

  it('困难段:全部正确块都在托盘里(少一块孩子就无解)', () => {
    for (let unit = 0; unit < UNITS.length; unit++) {
      for (const level of UNITS[unit]!.levels) {
        const blocks = buildBlocks(level, unit, seq([0.5, 0.25]), { hard: true })
        for (const need of requiredBlocks(level)) {
          expect(
            blocks.filter((b) => b.type === need.type && b.value === need.value).length,
            `${level.pinyin} 少了正确块 ${need.type}:${need.value}`,
          ).toBeGreaterThanOrEqual(1)
        }
      }
    }
  })

  // 困难段的门禁只比类型,介母与韵母在那一段是**两个真身份**(青色进介母槽、绿色进韵母槽)。
  it('困难段:双身份块不被家族合并,两块都在', () => {
    const block = byId('u7-0') // xī guā = x + i(介母) + g + u(介母) + a
    const blocks = buildBlocks(block, unitIdxOf('u7-0'), seq([0.12, 0.34, 0.56, 0.78]), { hard: true })
    const identifiers = blocks.filter((b) => b.value === 'i').map((b) => `${b.type}:${b.value}`)
    expect(new Set(identifiers).size).toBe(identifiers.length)
  })

  // u2-0(爸 bà):困难段 8 块,简单段 5 块 —— 这个差额本身就是两段的手感差别(spec §3.6)。
  it('困难段的托盘比简单段大:u2-0 是 8 块', () => {
    const bà = byId('u2-0')
    const unit = unitIdxOf('u2-0')
    expect(buildBlocks(bà, unit, seq([0.4, 0.8]), { hard: true })).toHaveLength(8)
    expect(buildBlocks(bà, unit, seq([0.4, 0.8]))).toHaveLength(5)
  })
```

- [ ] **Step 2: 跑测试确认它失败**

Run: `npx vitest run src/features/pinyin-blocks/rules.test.ts -t "困难段"`
Expected: FAIL —— `buildBlocks` 忽略第 4 个参数,`u2-0` 的困难段只有 5 块。

- [ ] **Step 3: 写实现**

`rules.ts` 里 `buildBlocks` 的签名改成(并把 Task 2 写下的 `const dedupeKey = familyKey` 换成三元写法):

```ts
/** 困难段的托盘参数:与简单段的 cap 是两个旋钮 —— 这里只拧「每个类型至少几块」。 */
export type BuildOptions = {
  /** 困难段:每类给足 2 块(正确块 + ≥1 个易混干扰块)、门禁只比类型、去重按 keyOf。 */
  readonly hard?: boolean
}

/**
 * 困难段每个用到的类型至少给几块。2 = 「正确块 + 至少一个对手」——
 * 一个类型只有一块等于没有选择,那就不是难度(spec §3.6)。
 */
export const HARD_TRAY_PER_TYPE = 2

/**
 * 托盘积木 = 所需块(含重复) + 声调块 + 干扰块。
 * 干扰块总数封顶并按类型轮摊(**不是**每类各来 N 个,那样块数会炸);
 * 干扰块只从已解锁的池子里取 —— 还没教的块不该出现在题面上。
 * `opts.hard` 走另一套取块算法(每类给足),见 HARD_TRAY_PER_TYPE。
 */
export function buildBlocks(
  level: Level,
  unit: number,
  rng: Rng = Math.random,
  opts: BuildOptions = {},
): Block[] {
```

把取块循环(`for (let placed = 0; placed < cap; placed++) { … }`)整体换成:

```ts
  const extra: Block[] = []
  if (opts.hard) {
    // 困难段:对每个用到的类型取到 HARD_TRAY_PER_TYPE 块为止。while 而不是 for ——
    // 撞上重复值时**不消耗名额**(那个 continue 白吃一格正是这个循环最容易漏的地方)。
    for (const type of types) {
      const want = HARD_TRAY_PER_TYPE - required.filter((b) => b.type === type).length
      let got = 0
      while (got < want) {
        const value = cursors.get(type)?.pop()
        if (value === undefined) break
        const block: Block = { type, value }
        if (takenKeys.has(dedupeKey(block))) continue
        takenKeys.add(dedupeKey(block))
        extra.push(block)
        got += 1
      }
    }
  } else {
    for (let placed = 0; placed < cap; placed++) {
      // 每轮挑候选最多的那一类,避免某一类被抽空后失衡
      const candidates = types.filter((t) => (cursors.get(t)?.length ?? 0) > 0)
      if (candidates.length === 0) break
      candidates.sort((a, b) => (cursors.get(b)?.length ?? 0) - (cursors.get(a)?.length ?? 0))
      const type = candidates[0] as BlockType
      const value = cursors.get(type)?.pop()
      if (value === undefined) continue
      const block: Block = { type, value }
      if (takenKeys.has(dedupeKey(block))) continue
      takenKeys.add(dedupeKey(block))
      extra.push(block)
    }
  }
```

同时把第 113 行那句注释改成现在仍然是真话的说法:

```ts
  // 复习关的干扰块拉满 —— 难度的三件事之一(另两件:池天然混入前面单元的块、提示恒弱)。
  // 这里的 cap 管的是**干扰块总数**(题面有多挤);「挤在里面的块有多像」由 CONFUSABLE 管。
```

(该行原样保留,只补第二句 —— 原注释没错,只是不完整。)

- [ ] **Step 4: 跑测试确认它通过**

Run: `npx vitest run src/features/pinyin-blocks/rules.test.ts`
Expected: PASS。`u2-0` 的困难段 = `initial:b, initial:p, final:a, final:o` + 4 个声调 = 8 块;简单段 = 5 块。

- [ ] **Step 5: 提交**

```bash
git add src/features/pinyin-blocks/rules.ts src/features/pinyin-blocks/rules.test.ts
git commit -m "feat(pinyin-blocks): 困难段托盘每类给足两块(每个类型都有对手)"
```

---

### Task 4: 困难段门禁 `sameTypeOnly` / `autoTypeTargetId` / `HARD_RETRIES`

**Files:**
- Modify: `src/features/pinyin-blocks/rules.ts`(`canPlace` 之后、`autoTargetId` 之后、`wrongSlotIds`)
- Test: `src/features/pinyin-blocks/rules.test.ts`(追加)

**Interfaces:**
- Produces:
  - `sameTypeOnly(block: Block, slot: Slot): boolean`
  - `autoTypeTargetId(block: Block, slots: readonly Slot[], placement: Placement): string | null`
  - `const HARD_RETRIES = 2`
  - `wrongSlotIds(slots, placement, tray, judge?: (b: Block, s: Slot) => boolean): string[]`

- [ ] **Step 1: 写失败的测试**

在 `src/features/pinyin-blocks/rules.test.ts` 的 `describe('isComplete / wrongSlotIds')` 块**之前**新增一个 describe:

```ts
describe('sameTypeOnly(困难段的门禁)', () => {
  it('值错但类型对:放得进去 —— 这正是困难段的全部考点', () => {
    expect(sameTypeOnly({ type: 'initial', value: 'p' }, slot('initial', 'b'))).toBe(true)
    expect(sameTypeOnly({ type: 'final', value: 'o' }, slot('final', 'a'))).toBe(true)
    expect(sameTypeOnly({ type: 'tone', value: '3' }, slot('tone', '1'))).toBe(true)
  })

  it('类型不对就放不进去 —— 声母进不了韵母槽', () => {
    expect(sameTypeOnly({ type: 'initial', value: 'a' }, slot('final', 'a'))).toBe(false)
    expect(sameTypeOnly({ type: 'nasal', value: 'n' }, slot('initial', 'n'))).toBe(false)
  })

  // 与 canPlace 的分水岭:双身份块在困难段**不通用**(介母块青、韵母块绿,颜色上分得开)。
  it('介母与韵母在困难段不通用,尽管 canPlace 允许互换', () => {
    expect(canPlace({ type: 'medial', value: 'u' }, slot('final', 'u'))).toBe(true)
    expect(sameTypeOnly({ type: 'medial', value: 'u' }, slot('final', 'u'))).toBe(false)
    expect(sameTypeOnly({ type: 'final', value: 'u' }, slot('medial', 'u'))).toBe(false)
  })
})

describe('autoTypeTargetId(困难段的点选落位)', () => {
  it('落到同类型的第一个空槽,不看值', () => {
    const slots: Slot[] = [slot('initial', 'b'), slot('final', 'a')]
    expect(autoTypeTargetId({ type: 'initial', value: 'p' }, slots, {})).toBe('x')
  })

  it('同类型的槽都占满了就没有落点(不跨类型找)', () => {
    const slots: Slot[] = [slot('initial', 'b'), slot('final', 'a')]
    expect(autoTypeTargetId({ type: 'initial', value: 'p' }, slots, { x: 'b0' })).toBe(null)
  })
})

describe('困难段的重试上限', () => {
  it('每关 2 次(用尽即本段失败,不阻塞)', () => {
    expect(HARD_RETRIES).toBe(2)
  })
})
```

在 `describe('isComplete / wrongSlotIds')` 内追加:

```ts
  it('wrongSlotIds 的判据可注入:困难段传 sameTypeOnly,值错不算错', () => {
    const hard: TrayBlock[] = [withId({ type: 'initial', value: 'p' }, 'b0'), withId({ type: 'final', value: 'a' }, 'b1')]
    const placements: Placement = { x: 'b0' }
    expect(wrongSlotIds([slot('initial', 'b')], placements, hard)).toHaveLength(1) // canPlace:值错 ⇒ 错
    expect(wrongSlotIds([slot('initial', 'b')], placements, hard, sameTypeOnly)).toHaveLength(0)
  })
```

并把该文件顶部 `./rules` 的 import 列表补上新名字(按字母序插入):

```ts
import {
  autoTargetId,
  autoTypeTargetId,
  buildBlocks,
  canPlace,
  HARD_RETRIES,
  isComplete,
  requiredBlocks,
  sameTypeOnly,
  slotsFor,
  solutionValues,
  starsFor,
  toneBlocks,
  wrongSlotIds,
  type Placement,
  type Rng,
  type Slot,
  type TrayBlock,
} from './rules'
```

- [ ] **Step 2: 跑测试确认它失败**

Run: `npx vitest run src/features/pinyin-blocks/rules.test.ts -t "sameTypeOnly"`
Expected: FAIL —— `sameTypeOnly` is not exported。

- [ ] **Step 3: 写实现**

在 `rules.ts` 的 `canPlace` **之后**插入:

```ts
/**
 * 困难段的门禁:只比类型。值错了也放得进去 —— 这正是那一段的全部考点(spec §3.6)。
 *
 * 这是**第三个**判定函数,不是修改 canPlace(canPlace 一个字不动)。
 * 双身份块在这里**不通用**:介母槽只收介母块(青),韵母槽只收韵母块(绿),颜色上分得开。
 */
export function sameTypeOnly(block: Block, slot: Slot): boolean {
  return block.type === slot.type
}

/** 困难段每关允许的判错重试次数。用尽即本段失败 —— 但**不阻塞**,继续往下走(spec §3.6)。 */
export const HARD_RETRIES = 2
```

把 `wrongSlotIds` 改成可注入判据:

```ts
/**
 * 放错(值或类型不匹配)的槽 id。全空返回 []。
 * `judge` 默认 `canPlace`(简单段与复习段);困难段传 `sameTypeOnly` —— 那一段值错不算错。
 */
export function wrongSlotIds(
  slots: readonly Slot[],
  placement: Placement,
  tray: readonly TrayBlock[],
  judge: (block: Block, slot: Slot) => boolean = canPlace,
): string[] {
  const byId = new Map(tray.map((b) => [b.id, b]))
  const bad: string[] = []
  for (const slot of slots) {
    const blockId = placement[slot.id]
    if (blockId === undefined) continue
    const block = byId.get(blockId)
    if (!block || !judge(block, slot)) bad.push(slot.id)
  }
  return bad
}
```

把 `autoTargetId` 那句 doc 注释改成不再断言「只有一种点选路径」,并在它**之后**插入:

```ts
/**
 * 困难段的点选落位:同类型的第一个空槽。产品保留一键落位,它在困难段退化成
 * 「把块放进它那一类的槽里」—— 选哪一块、选得对不对仍由孩子负责,考点没有被绕过去。
 */
export function autoTypeTargetId(block: Block, slots: readonly Slot[], placement: Placement): string | null {
  return slots.find((s) => placement[s.id] === undefined && s.type === block.type)?.id ?? null
}
```

- [ ] **Step 4: 跑测试确认它通过**

Run: `npx vitest run src/features/pinyin-blocks/rules.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/features/pinyin-blocks/rules.ts src/features/pinyin-blocks/rules.test.ts
git commit -m "feat(pinyin-blocks): 困难段门禁 sameTypeOnly 与同类型点选落位"
```

---

### Task 5: 错题池与复习小题(`mistakes.ts`)

**Files:**
- Create: `src/features/pinyin-blocks/mistakes.ts`
- Create: `src/features/pinyin-blocks/mistakes.test.ts`
- Modify: `src/features/pinyin-blocks/index.ts`(导出公共面)

**Interfaces:**
- Consumes: `familyKey`、`slotsFor`、`buildBlocks`、`Placement`、`Rng`、`TrayBlock`(Task 2 / Task 3);`Level`(`levels.ts`)
- Produces:
  - `const WRONG_PICK_THRESHOLD = 2` / `MAX_REVIEW_QUESTIONS = 3` / `REVIEW_TRAY_CAP = 4`
  - `type MistakePool = readonly Block[]` / `type PickCounts = Readonly<Record<string, number>>`
  - `type PoolKey = (b: Block) => string` / `familyPoolKey` / `exactPoolKey`
  - `notePick(counts: PickCounts, blockId: string): { counts: PickCounts; reached: boolean }`
  - `addToPool(pool: MistakePool, blocks: readonly Block[], key?: PoolKey): MistakePool`
  - `type ReviewQuestion` / `reviewQuestions(level: Level, unit: number, pool: MistakePool, rng?: Rng): ReviewQuestion[]`

- [ ] **Step 1: 写失败的测试**

新建 `src/features/pinyin-blocks/mistakes.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { DUAL_VALUES, FINAL_BASIC, FINAL_COMPOUND, INITIALS_ALL, MEDIALS, NASALS, TONE_VALUES, type Block, type BlockType } from './blocks'
import { UNITS, type Level } from './levels'
import { requiredBlocks, slotsFor, type Rng } from './rules'
import {
  addToPool,
  MAX_REVIEW_QUESTIONS,
  notePick,
  REVIEW_TRAY_CAP,
  reviewQuestions,
  WRONG_PICK_THRESHOLD,
  type MistakePool,
} from './mistakes'

/** 「灌满池子」用的候选值域:每一类都有几个与正解不同的值。 */
const COMMON: Record<BlockType, readonly string[]> = {
  initial: INITIALS_ALL,
  medial: MEDIALS,
  final: [...FINAL_BASIC, ...FINAL_COMPOUND],
  nasal: NASALS,
  tone: TONE_VALUES,
}

const seq = (values: number[]): Rng => {
  let i = 0
  return () => values[i++ % values.length] as number
}

function byId(id: string): Level {
  for (const u of UNITS) for (const level of u.levels) if (level.id === id) return level
  throw new Error(`没有这一关:${id}`)
}

function unitIdxOf(id: string): number {
  const index = UNITS.findIndex((u) => u.levels.some((level) => level.id === id))
  if (index < 0) throw new Error(`没有这一关:${id}`)
  return index
}

const b = (type: Block['type'], value: string): Block => ({ type, value })

describe('notePick(简单段的点错计数)', () => {
  it('同一块点到第 2 次才算数(N = 2)', () => {
    expect(WRONG_PICK_THRESHOLD).toBe(2)
    const first = notePick({}, 'b3')
    expect(first.reached).toBe(false)
    expect(first.counts).toEqual({ b3: 1 })
    const second = notePick(first.counts, 'b3')
    expect(second.reached).toBe(true)
    expect(second.counts).toEqual({ b3: 2 })
  })

  it('计数按块 id 分开:点错两块不同的 p 不算「同一块两次」', () => {
    const a = notePick({}, 'b1')
    const c = notePick(a.counts, 'b2')
    expect(c.reached).toBe(false)
    expect(c.counts).toEqual({ b1: 1, b2: 1 })
  })
})

describe('addToPool', () => {
  it('按家族去重:同一块加两次只进一次', () => {
    const pool = addToPool([], [b('initial', 'p')])
    expect(addToPool(pool, [b('initial', 'p')])).toHaveLength(1)
  })

  // 双身份块按家族算同一块(简单段与复习段的门禁是 canPlace,它们真能混用)。
  it('默认按家族去重:final:u 与 medial:u 算同一块', () => {
    const pool = addToPool([], [b('medial', 'u')])
    expect(addToPool(pool, [b('final', 'u')])).toHaveLength(1)
  })

  // 困难段的门禁只比类型,那两个身份是真的 —— 那里按 keyOf 记账。
  it('传 exactPoolKey 时按精确身份去重:两块都留下', () => {
    const pool = addToPool([], [b('medial', 'u')], exactPoolKey)
    expect(addToPool(pool, [b('final', 'u')], exactPoolKey)).toHaveLength(2)
  })

  it('声母 n 与鼻尾 n 是两个身份,永远不被家族合并', () => {
    const pool = addToPool([], [b('initial', 'n')])
    expect(addToPool(pool, [b('nasal', 'n')])).toHaveLength(2)
  })
})

describe('reviewQuestions', () => {
  const BÀ = byId('u2-0') // 爸 bà = b + a + 声调
  const unit = unitIdxOf('u2-0')

  /**
   * **可见托盘** —— 复习段的托盘数组同时驮着正解、错解与**预填块**(预填块必须在这个数组里,
   * 渲染层才找得到它、才画得进槽),而屏上看得见的是「没被预填走的那几块」。
   * 上限与「不出现两块同形块」这两条都是对**可见的那几块**说的。
   */
  const visible = (q: { prefill: Record<string, string>; tray: readonly { id: string; value: string }[] }) => {
    const placed = new Set(Object.values(q.prefill))
    return q.tray.filter((t) => !placed.has(t.id))
  }

  it('每个错块一道小题,同一类型合成一道,最多 3 道', () => {
    expect(MAX_REVIEW_QUESTIONS).toBe(3)
    const pool: MistakePool = [b('initial', 'p'), b('initial', 'm'), b('final', 'o')]
    const questions = reviewQuestions(BÀ, unit, pool, seq([0.3, 0.6]))
    expect(questions.map((q) => q.blockType)).toEqual(['initial', 'final'])
  })

  it('超过 3 个类型时取最近点错的前 3 个', () => {
    const pool: MistakePool = [
      b('initial', 'p'),
      b('final', 'o'),
      b('tone', '3'),
      b('nasal', 'n'), // 第 4 个类型 —— 该被挤掉(题面里本来也没有鼻尾槽,这里只验序)
    ]
    const questions = reviewQuestions(BÀ, unit, pool, seq([0.3, 0.6]))
    expect(questions).toHaveLength(MAX_REVIEW_QUESTIONS)
    expect(questions.map((q) => q.blockType)).toEqual(['nasal', 'tone', 'final'])
  })

  it('挖空的是本关该类型的**所有**槽,其余槽用正确块预填', () => {
    const questions = reviewQuestions(BÀ, unit, [b('initial', 'p')], seq([0.3, 0.6]))
    const q = questions[0]!
    const slots = slotsFor(BÀ)
    expect(q.slotIds).toEqual(['s0-i'])
    // 其余槽(韵母 + 声调)都预填了,且预填的块就在托盘里 —— 渲染层靠这个找得到它。
    for (const slot of slots.filter((s) => s.id !== 's0-i')) {
      const blockId = q.prefill[slot.id]
      expect(blockId, `${slot.id} 没预填`).toBeDefined()
      const block = q.tray.find((t) => t.id === blockId)
      expect(block, `预填块 ${blockId} 不在托盘里`).toBeDefined()
      expect(block!.type).toBe(slot.type)
      expect(block!.value).toBe(slot.value)
    }
  })

  it('可见托盘 = 挖空槽的正解 + 错解', () => {
    const questions = reviewQuestions(BÀ, unit, [b('initial', 'p')], seq([0.3, 0.6]))
    expect(REVIEW_TRAY_CAP).toBe(4)
    const q = questions[0]!
    // 正解 b + 错解 p —— 与视觉稿第 3 帧一致(韵母槽与声调槽都已预填,不在可见托盘里)。
    expect(visible(q).map((t) => t.value).sort()).toEqual(['b', 'p'])
  })

  // 上限是对**可见**那几块说的。预填块也在 tray 数组里(渲染层靠它找块),把它们算进上限就永远超。
  it('可见托盘永不超过 4 块(全 91 关,池灌满)', () => {
    for (let unit = 0; unit < UNITS.length; unit++) {
      for (const level of UNITS[unit]!.levels) {
        // 池灌满:把该关每一个槽的类型都给上几个「值不同」的错块。
        const saturated: MistakePool = slotsFor(level).map((s) => {
          const other = COMMON[s.type].find((v) => v !== s.value)
          return b(s.type, other ?? s.value)
        })
        for (const q of reviewQuestions(level, unit, saturated, seq([0.3, 0.6]))) {
          expect(visible(q).length, `${level.pinyin} 的复习托盘挤了 ${visible(q).length} 块`).toBeLessThanOrEqual(
            REVIEW_TRAY_CAP,
          )
          // 可见托盘里不许有两块同形块 —— 分不开的两块不是难度。
          const seen = new Set(visible(q).map((t) => (DUAL_VALUES.has(t.value) ? t.value : `${t.type}:${t.value}`)))
          expect(seen.size, `${level.pinyin} 的复习托盘里有同形块`).toBe(visible(q).length)
        }
      }
    }
  })

  it('错块的家族键与正解相同时不进可见托盘(否则两块一模一样,孩子只能瞎猜)', () => {
    // xī guā 的两个介母槽正解是 i 与 u。池里的 medial:ü 与正解不同家族,会进;medial:u 同家族,不进。
    const xīguā = byId('u7-0')
    const questions = reviewQuestions(xīguā, unitIdxOf('u7-0'), [b('medial', 'u')], seq([0.3, 0.6]))
    const q = questions[0]!
    expect(visible(q).map((t) => t.value).sort()).toEqual(['i', 'u'])
    // 但小题仍然成立:两个槽都挖空,考的是「哪个音节用哪个」。
    expect(q.slotIds).toEqual(['s0-m', 's1-m'])
  })

  it('池空时:照考本关整题 —— 所有槽挖空,托盘同简单段', () => {
    const questions = reviewQuestions(BÀ, unit, [], seq([0.3, 0.6, 0.9]))
    expect(questions).toHaveLength(1)
    const q = questions[0]!
    expect(q.kind).toBe('whole')
    expect(q.slotIds).toEqual(slotsFor(BÀ).map((s) => s.id))
    expect(q.prefill).toEqual({})
    for (const need of requiredBlocks(BÀ)) {
      expect(q.tray.some((t) => t.type === need.type && t.value === need.value), `${need.value} 不在托盘里`).toBe(true)
    }
  })

  // Review Focus #5:双音节 + 双身份块 —— 两个同类型槽同时挖空时,托盘要给足两块正解,少一块就无解。
  it('双音节的两个同类型槽都挖空时,托盘给足两块正解', () => {
    const xīguā = byId('u7-0')
    const questions = reviewQuestions(xīguā, unitIdxOf('u7-0'), [b('medial', 'ü')], seq([0.3, 0.6]))
    const q = questions[0]!
    expect(q.slotIds).toHaveLength(2)
    for (const value of ['i', 'u']) {
      expect(q.tray.some((t) => t.type === 'medial' && t.value === value), `正解 ${value} 不在托盘里`).toBe(true)
    }
  })

  // 全 91 关的不变量:每个错块的类型在本关都必有槽(否则小题挖不出空槽,复习段当场空转)。
  it('每一关的每一个块类型,只要它在池里就一定挖得出槽', () => {
    for (let unit = 0; unit < UNITS.length; unit++) {
      for (const level of UNITS[unit]!.levels) {
        const types = new Set(slotsFor(level).map((s) => s.type))
        const questions = reviewQuestions(
          level,
          unit,
          [...types].map((type) => b(type, slotsFor(level).find((s) => s.type === type)!.value)),
          seq([0.2, 0.5, 0.8]),
        )
        for (const q of questions) {
          expect(q.slotIds.length, `${level.pinyin} 的小题没挖空任何槽`).toBeGreaterThan(0)
          expect(q.prefill).toBeDefined()
        }
      }
    }
  })
})
```

- [ ] **Step 2: 跑测试确认它失败**

Run: `npx vitest run src/features/pinyin-blocks/mistakes.test.ts`
Expected: FAIL —— 找不到模块 `./mistakes`。

- [ ] **Step 3: 写实现**

新建 `src/features/pinyin-blocks/mistakes.ts`:

```ts
// 错题池与复习小题的纯逻辑。不引 React、不引服务 —— 组件只负责画。
// 池是**关内状态**:不持久化、不跨关(产品裁定「复习段只考本关」)。

import type { Block, BlockType } from './blocks'
import type { Level } from './levels'
import { buildBlocks, familyKey, slotsFor, type Placement, type Rng, type TrayBlock } from './rules'

/** 简单段同一块被点错几次才进错题池。产品裁定值 N = 2(见 spec §3.5)。 */
export const WRONG_PICK_THRESHOLD = 2

/** 复习段最多几道小题。产品裁定值(见 spec §3.7)。 */
export const MAX_REVIEW_QUESTIONS = 3

/** 复习段托盘的块数上限 —— 正解与错解一起数。 */
export const REVIEW_TRAY_CAP = 4

/** 错题池:按入池顺序追加,后面的是最近点错的。 */
export type MistakePool = readonly Block[]

/** 块 id → 被点错的次数。 */
export type PickCounts = Readonly<Record<string, number>>

/** 入池去重的判据。 */
export type PoolKey = (b: Block) => string

/** 简单段与复习段:双身份块算同一块(canPlace 判它们通用)。 */
export const familyPoolKey: PoolKey = familyKey

/** 困难段:那一段的门禁只比类型,介母块与韵母块是两个真身份(spec §3.3 的例外)。 */
export const exactPoolKey: PoolKey = (b) => `${b.type}:${b.value}`

/**
 * 记一次「选中了错块」。计数按**块 id** —— 托盘里那一块,一轮之内身份稳定;
 * 这样「同一块被点两次」才算数,而不是「同样点错两块不同的 p」凑数。
 * `reached` 只在那一次为真(阈值上取等),避免同一块被反复入池。
 */
export function notePick(counts: PickCounts, blockId: string): { counts: PickCounts; reached: boolean } {
  const n = (counts[blockId] ?? 0) + 1
  return { counts: { ...counts, [blockId]: n }, reached: n === WRONG_PICK_THRESHOLD }
}

/** 把块加进错题池(按 key 去重,保序:后进的在后 = 最近点错的)。 */
export function addToPool(pool: MistakePool, blocks: readonly Block[], key: PoolKey = familyPoolKey): MistakePool {
  const seen = new Set(pool.map(key))
  const out = [...pool]
  for (const block of blocks) {
    const k = key(block)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(block)
  }
  return out
}

/** 复习段的一道小题。 */
export type ReviewQuestion = Readonly<{
  /** `'block'` = 考某一类块(挖空该类型的槽);`'whole'` = 池空时照考本关整题(所有槽挖空)。 */
  kind: 'block' | 'whole'
  /** `kind === 'block'` 时考的是哪一类。单测与调试用,UI 不读。 */
  blockType?: BlockType
  /** 要挖空的槽。其余槽用 `prefill` 里的正确块预填。 */
  slotIds: readonly string[]
  /** slotId → blockId。**这些槽在复习段不能拿回**(不绑 onClick,见 spec §3.7)。 */
  prefill: Placement
  /** 本小题的托盘:含全部正解,以及(尽量)至少一块错解。 */
  tray: readonly TrayBlock[]
}>

/**
 * 复习小题的推导(纯函数)。
 *
 * - 错块按**家族键**去重,同一类型合成一道小题,最多 MAX_REVIEW_QUESTIONS 道(最近的优先);
 * - 每道小题挖空本关中该类型的**所有**槽,其余槽用正确块预填 —— 复用本关的图与音节;
 * - 托盘 = 这些槽的正解(含重复,少一块就无解)+ 该类型下点错过的块(家族去重),
 *   预填块也在这个数组里但**不计入** REVIEW_TRAY_CAP —— 上限管的是屏上看得见的那几块;
 * - 某错块的家族键与该小题的可见块相同时**不进托盘** —— 两块一模一样不是难度,是坏题;
 * - **池空时照考整题**(产品裁定「三段结构恒定」,不存在「这一关只有两段」)。
 */
export function reviewQuestions(
  level: Level,
  unit: number,
  pool: MistakePool,
  rng: Rng = Math.random,
): ReviewQuestion[] {
  const slots = slotsFor(level)

  // 最近点错的排前面 —— 池是追加的,故倒序;同一家族只留最近那一次。
  const recent: Block[] = []
  const seenFamily = new Set<string>()
  for (let i = pool.length - 1; i >= 0; i--) {
    const block = pool[i] as Block
    const key = familyKey(block)
    if (seenFamily.has(key)) continue
    seenFamily.add(key)
    recent.push(block)
  }

  const types: BlockType[] = []
  for (const block of recent) {
    if (!types.includes(block.type)) types.push(block.type)
  }

  if (types.length === 0) {
    // 池空:照考本关整题 —— 所有槽挖空,托盘同简单段。
    const tray: TrayBlock[] = buildBlocks(level, unit, rng).map((b, i) => ({ ...b, id: `q0-${i}` }))
    return [{ kind: 'whole', slotIds: slots.map((s) => s.id), prefill: {}, tray }]
  }

  return types.slice(0, MAX_REVIEW_QUESTIONS).map((type, qi) => {
    const empty = slots.filter((s) => s.type === type)
    const rest = slots.filter((s) => s.type !== type)

    // 正解:挖空的每个槽各一块(含重复 —— 双音节两个韵母槽就要两块)。
    const tray: TrayBlock[] = empty.map((s, i) => ({ type: s.type, value: s.value, id: `q${qi}-c${i}` }))
    // 显式记下哪些块是**可见**的(正解与错解),不去反查 prefill —— 后者是同形块更容易出错。
    const visible = new Set(tray.map((t) => t.id))
    const prefill: Record<string, string> = {}
    rest.forEach((s, i) => {
      const id = `q${qi}-p${i}`
      tray.push({ type: s.type, value: s.value, id })
      prefill[s.id] = id
    })

    // 错解:同一类型、且与可见块**不同家族**(不出现两块分不开的同形块)。
    // 名额按**可见**块算 —— 预填块也在这个数组里(渲染层靠它找块),把它们算进名额就永远是负的。
    const taken = new Set(tray.filter((t) => visible.has(t.id)).map(familyKey))
    const room = Math.max(0, REVIEW_TRAY_CAP - empty.length)
    let added = 0
    for (const block of recent) {
      if (added >= room) break
      if (block.type !== type) continue
      if (taken.has(familyKey(block))) continue
      taken.add(familyKey(block))
      tray.push({ ...block, id: `q${qi}-w${added}` })
      added += 1
    }

    return { kind: 'block', blockType: type, slotIds: empty.map((s) => s.id), prefill, tray }
  })
}
```

在 `src/features/pinyin-blocks/index.ts` 追加导出(放在 rules 那一组旁边):

```ts
export {
  addToPool,
  MAX_REVIEW_QUESTIONS,
  notePick,
  REVIEW_TRAY_CAP,
  reviewQuestions,
  WRONG_PICK_THRESHOLD,
  type MistakePool,
  type PickCounts,
  type PoolKey,
  type ReviewQuestion,
} from './mistakes'
export { autoTypeTargetId, familyKey, HARD_RETRIES, HARD_TRAY_PER_TYPE, sameTypeOnly, type BuildOptions } from './rules'
export { StageBar, StageDots, type StageId } from './StageBar'
export { StageTransition } from './StageTransition'
```

> `StageBar` / `StageTransition` 到 Task 7 才存在 —— **本步只加 `./mistakes` 与 `./rules` 那两行**,`StageBar` / `StageTransition` 那两行留到 Task 7 一起加,否则 `npm test` 会红在导入上。

- [ ] **Step 4: 跑测试确认它通过**

Run: `npx vitest run src/features/pinyin-blocks/mistakes.test.ts`
Expected: PASS。

> 「可见托盘永不超过 4 块」那条若红,先打印那一关的实际输出:课程里**同一类型的槽最多 2 个**(双音节的两个韵母槽),而每类错解的家族数也有限(声调 4 个值、介母 3 个值),所以 4 块这个上限在本课程里**不会真的顶到** —— 它是一条护栏,不是一条会触发的分支。红了一定是实现把预填块算进了名额,去改 `room`,`不要`把断言放宽到 5。

- [ ] **Step 5: 提交**

```bash
git add src/features/pinyin-blocks/mistakes.ts src/features/pinyin-blocks/mistakes.test.ts src/features/pinyin-blocks/index.ts
git commit -m "feat(pinyin-blocks): 错题池与复习小题的纯逻辑(N=2 / 每题一类 / 上限 3 道)"
```

---

### Task 6: 三段的材质(CSS)

**Files:**
- Modify: `src/index.css`(台阶条 / 过场遮罩 / 困难段槽与托盘 / 复习段托盘 / 点错块,全部落在「拼音积木材质」段内)
- Test: `src/features/pinyin-blocks/material.test.ts`(追加)

**Interfaces:**
- Produces(CSS 类名,Task 7 / Task 8 消费):`.pstage-bar` / `.pstage-step(--on|--cool|--pop)` / `.pstage-bar--big` / `.pstage-dots` / `.pstage-dot(--on)` / `.pstage-veil` / `.ptray--hard` / `.ptray--review` / `.pslots--hard` / `.pblock--reject`;变量 `--slot-style`

- [ ] **Step 1: 写失败的测试**

在 `src/features/pinyin-blocks/material.test.ts` 的 `describe('index.css 拼音积木材质段')` 块**末尾**追加:

```ts
  // 困难段的槽:**类型色从提示升格成硬规则的载体**。u9–u12 全是弱档(--slot-line: 0%),
  // 在那里「同颜色的槽才能放」这条规则在屏幕上是不可见的 —— 孩子只能靠猜。
  // 做法必须走「容器上覆盖变量」,不能给每种类型再写一条 .pslots--hard .pslot--initial:
  // 那样上面那条「每种类型只该有一条规则」的护栏会数出两条(复合选择器里含同一个字面量)。
  it('困难段的槽:恒亮 100% + 实线边,走容器变量而不是复合选择器', () => {
    expect(css.split('.pslots--hard {').length - 1, '.pslots--hard { 只该有一条规则').toBe(1)
    const start = css.indexOf('.pslots--hard {')
    const rule = css.slice(start, css.indexOf('}', start))
    expect(rule, '困难段的槽没恒亮').toContain('--slot-line: 100%')
    expect(rule, '实线 / 虚线的区别没落在变量上').toContain('--slot-style: solid')

    // 虚线是默认值,且真的被 .pslot 读走 —— 只声明不消费等于没写。
    const base = css.indexOf('.pslot {')
    const baseRule = css.slice(base, css.indexOf('}', base))
    expect(baseRule, '.pslot 没读 --slot-style,困难段的实线边不会生效').toContain('var(--slot-style)')
    expect(css.split('.pslot {').length - 1, '.pslot { 仍只该有一条规则').toBe(1)

    for (const name of ['initial', 'medial', 'final', 'nasal', 'tone']) {
      expect(css.split(`.pslot--${name} {`).length - 1, `${name} 被拆成两条了`).toBe(1)
    }
  })

  it('三段各有自己的底盘与段标', () => {
    for (const cls of ['.ptray--hard {', '.ptray--review {', '.pblock--reject {', '.pstage-veil {']) {
      expect(css.split(cls).length - 1, `${cls} 只该有一条规则`).toBe(1)
    }
    // 困难段的盘压暗 + 橙环;复习段的盘去饱和 + 虚线环。
    const hard = css.indexOf('.ptray--hard {')
    expect(css.slice(hard, css.indexOf('}', hard))).toContain('var(--color-accent)')
    const review = css.indexOf('.ptray--review {')
    expect(css.slice(review, css.indexOf('}', review))).toContain('dashed')
  })

  it('段标是「三格、越右越高」,亮态用 accent、复习段第三格用灰蓝', () => {
    // 行首锚定,不用 split —— 过场里的 `.pstage-bar--big .pstage-step {` 里含 `.pstage-step {` 这个
    // 子串,split 会把它一起数进来(同一类坑:复合选择器让「一条规则」的护栏数出两条)。
    const rules = (sel: string) => css.match(new RegExp(`^${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{`, 'gm'))?.length ?? 0
    expect(rules('.pstage-bar'), '.pstage-bar 只该有一条规则').toBe(1)
    expect(rules('.pstage-step'), '.pstage-step 只该有一条规则').toBe(1)
    expect(rules('.pstage-step--on'), '.pstage-step--on 只该有一条规则').toBe(1)
    expect(rules('.pstage-step--cool'), '.pstage-step--cool 只该有一条规则').toBe(1)
    expect(rules('.pstage-dot'), '.pstage-dot 只该有一条规则').toBe(1)
    const on = css.indexOf('\n.pstage-step--on {')
    expect(css.slice(on, css.indexOf('}', on))).toContain('var(--color-accent)')
    const cool = css.indexOf('\n.pstage-step--cool {')
    expect(css.slice(cool, css.indexOf('}', cool))).toContain('var(--color-ink-2)')
  })
```

- [ ] **Step 2: 跑测试确认它失败**

Run: `npx vitest run src/features/pinyin-blocks/material.test.ts`
Expected: FAIL —— `.pslots--hard {` 找不到。

- [ ] **Step 3: 写实现**

**(a)** 把 `.pslot` 规则(第 320-329 行)里的 `border: 3px dashed var(--slot-base-line);` 换成:

```css
  /* 实线 = 规则,虚线 = 提示。困难段把类型色升格成硬规则的载体,靠容器覆盖这个变量(spec §3.8)。 */
  --slot-style: dashed;
  border: 3px var(--slot-style) var(--slot-base-line);
```

**(b)** 把 `.pslots` 那一行改成(仍然只有一条规则):

```css
.pslots        { --slot-line: 55%; --slot-fill: 12%; --slot-style: dashed; }
```

**(c)** 在 `.pslots--weak` 之后插入:

```css
/* 困难段:类型色**恒亮**且换实线边。这不是审美选择,是正确性要求 —— 弱档单元(u9–u12)
   的 --slot-line 是 0%,而困难段的规则正是「同颜色的槽才能放」(spec §3.8)。
   走容器变量覆盖,不给每种类型另写一条规则(复合选择器会让「一种类型一条规则」的护栏数出两条)。
   选择器与 `{` 之间**只留一个空格** —— 护栏按 `.pslots--hard {` 这个字面量数条数(照抄
   `.pslots--mid {` 那些行的写法,别为了对齐敲成多个空格)。 */
.pslots--hard { --slot-line: 100%; --slot-fill: 24%; --slot-style: solid; }
```

**(d)** 在 `.pslot--wrong` 之后插入点错块的反馈:

```css
/* 点错一块(托盘里那块无处可落 / 拖到不匹配的槽上)的即时反馈。
   今天这里**只有声音** —— 静音环境(平板很常见)里孩子的体验是「点了它一下,什么都没发生」,
   而 miss 已经在涨了。干扰块变成 b/p 这种高度相似的对手之后,它会直接变成挫败。 */
.pblock--reject {
  animation: pblock-shake 0.4s;
  box-shadow:
    inset 0 2px 0 rgb(255 255 255 / 0.5),
    0 7px 0 var(--pb-edge),
    0 0 0 4px color-mix(in srgb, var(--color-red) 55%, transparent);
}
```

**(e)** 在材质段**末尾**(`.pstar--on` 之后)追加段标、进度点、过场与三段底盘:

```css
/* ---- 三段:段标 / 过场 / 底盘(spec §3.8)----
   三段的区别只能靠形状、颜色、材质 —— 游戏区零可见文字。 */

/* 台阶条:三格并排、越右越高,亮到第几格就是第几段。位置钉在题面图上方,不占新位置。
   读法与连击点同源(一排东西、亮/暗两态),孩子在这个游戏里已经学过,不用重新教。 */
.pstage-bar {
  display: flex;
  align-items: flex-end;
  gap: 4px;
}
.pstage-step {
  width: 11px;
  border-radius: 3px;
  background-color: color-mix(in srgb, var(--color-ink) 18%, transparent);
}
.pstage-step:nth-child(1) { height: 11px; }
.pstage-step:nth-child(2) { height: 19px; }
.pstage-step:nth-child(3) { height: 27px; }
.pstage-step--on {
  background-color: var(--color-accent);
}
/* 复习段的第三格换灰蓝:台阶「越右越高」说的是难度,而复习不是第三级难度,是回炉 ——
   颜色断掉,就不会被读成「三级台阶的顶」。这一支灰蓝同时是小题目进度点的颜色,不是新色号。 */
.pstage-step--cool {
  background-color: var(--color-ink-2);
}
.pstage-step--pop {
  animation: pstep-pop 0.34s ease-out backwards;
}
@keyframes pstep-pop {
  0% { transform: scaleY(0.35); opacity: 0.3; }
  60% { transform: scaleY(1.18); opacity: 1; }
  100% { transform: scaleY(1); opacity: 1; }
}

/* 过场里那一条放大版:同一个组件,只是尺寸不同(逐格点亮由 --pop 的 animation-delay 排)。 */
.pstage-bar--big {
  gap: 7px;
}
.pstage-bar--big .pstage-step {
  width: 18px;
}
.pstage-bar--big .pstage-step:nth-child(1) { height: 18px; }
.pstage-bar--big .pstage-step:nth-child(2) { height: 30px; }
.pstage-bar--big .pstage-step:nth-child(3) { height: 42px; }

/* 复习段的小题进度点:最多 3 个,做完几道亮几颗,位置钉在台阶条正下方。放错只抖,不动它。 */
.pstage-dots {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 8px;
}
.pstage-dot {
  display: block;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background-color: color-mix(in srgb, var(--color-ink) 18%, transparent);
}
.pstage-dot--on {
  background-color: var(--color-ink-2);
}

/* 换段过场:压一层暗遮罩,台阶条放大到屏幕中央。A(进困难)与 B(进复习)共用这一个面 ——
   B 的「画法不同」全在台阶条的颜色语言里(前两格橙 + 第三格灰蓝),不另做一个遮罩。
   减动效下动画被压成 0.01ms,而停留时长由组件的 JS 计时器保证 ⇒ 退化成同一个静态帧。 */
.pstage-veil {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  background-color: color-mix(in srgb, var(--color-ink) 62%, transparent);
  backdrop-filter: blur(6px);
  animation: pveil-in 0.28s ease-out;
}
@keyframes pveil-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* 困难段的积木盘:底色压暗一档 + 橙实线环 + 内阴影。
   盘是屏幕下半部最大的一块面,底色是最不占位置的段信号;压暗之后五类块面反而更跳。 */
.ptray--hard {
  background-color: color-mix(in srgb, var(--color-ink) 22%, transparent);
  border: 2px solid var(--color-accent);
  box-shadow:
    inset 0 6px 16px -8px color-mix(in srgb, var(--color-shadow) 60%, transparent),
    var(--shadow-card);
}

/* 复习段的积木盘:去饱和灰 + 中性虚线环。虚线在这套语言里一贯表示「提示 / 非规则」。 */
.ptray--review {
  background-color: color-mix(in srgb, var(--color-ink) 14%, var(--color-surface));
  border: 2px dashed color-mix(in srgb, var(--color-ink) 30%, transparent);
  box-shadow: var(--shadow-card);
}
```

- [ ] **Step 4: 跑测试确认它通过**

Run: `npx vitest run src/features/pinyin-blocks/material.test.ts`
Expected: PASS(全部,含既有的颜色字面量与其他护栏)。

> 材质段从 marker 到**文件尾**都要过「无颜色字面量」那条 —— 上面新写的内容全部走 token 与 `color-mix`,没有 hex / `rgb()`。若某条护栏报出字面量,是写实现时手滑抄了色值,改回 token,**不要放宽那条护栏**。

- [ ] **Step 5: 提交**

```bash
git add src/index.css src/features/pinyin-blocks/material.test.ts
git commit -m "feat(pinyin-blocks): 三段材质:台阶条 / 过场遮罩 / 困难段恒亮槽与压暗盘 / 复习段灰盘"
```

---

### Task 7: 段标组件(`StageBar` / `StageDots` / `StageTransition`)

**Files:**
- Create: `src/features/pinyin-blocks/StageBar.tsx`
- Create: `src/features/pinyin-blocks/StageTransition.tsx`
- Test: `src/features/pinyin-blocks/StageBar.test.tsx`(新建)
- Modify: `src/features/pinyin-blocks/index.ts`(补 Task 5 欠下的两行导出)

**Interfaces:**
- Consumes: Task 6 的 CSS 类
- Produces:
  - `type StageId = 'easy' | 'hard' | 'review'`
  - `StageBar({ stage, big?, pop? }: { stage: StageId; big?: boolean; pop?: boolean })`
  - `StageDots({ total, done }: { total: number; done: number })`
  - `const STAGE_TRANSITION_MS = 1200`
  - `StageTransition({ stage, onDone }: { stage: StageId; onDone: () => void })`

- [ ] **Step 1: 写失败的测试**

新建 `src/features/pinyin-blocks/StageBar.test.tsx`:

```tsx
import { cleanup, render, screen } from '@testing-library/react'
import { act, useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StageBar, StageDots } from './StageBar'
import { STAGE_TRANSITION_MS, StageTransition } from './StageTransition'

/** 亮起来的格子数(未亮的格子没有 --on / --cool 类)。 */
const litCount = (el: HTMLElement) => el.querySelectorAll('.pstage-step--on, .pstage-step--cool').length
const coolCount = (el: HTMLElement) => el.querySelectorAll('.pstage-step--cool').length

afterEach(cleanup)

describe('段标(台阶条)', () => {
  it('三段各自的亮法:简单 1 格 / 困难 2 格 / 复习 2 格橙 + 1 格灰蓝', () => {
    const easy = render(<StageBar stage="easy" />).container.firstElementChild as HTMLElement
    expect(litCount(easy)).toBe(1)
    expect(coolCount(easy)).toBe(0)

    cleanup()
    const hard = render(<StageBar stage="hard" />).container.firstElementChild as HTMLElement
    expect(litCount(hard)).toBe(2)
    expect(coolCount(hard)).toBe(0)

    cleanup()
    const review = render(<StageBar stage="review" />).container.firstElementChild as HTMLElement
    expect(litCount(review)).toBe(3)
    expect(coolCount(review)).toBe(1)
    expect(review.dataset.stage).toBe('review')
  })

  it('三格恒存在(形状先给,颜色后给 —— 减动效用户看到的也是一样的两个状态)', () => {
    const { container } = render(<StageBar stage="easy" />)
    expect(container.querySelectorAll('.pstage-step')).toHaveLength(3)
  })
})

describe('复习段的小题进度点', () => {
  const dotCount = () => document.querySelectorAll('.pstage-dot').length
  const onCount = () => document.querySelectorAll('.pstage-dot--on').length

  it('有几道题就画几个点,当前第几道就亮几颗', () => {
    const { rerender } = render(<StageDots total={3} done={1} />)
    expect(dotCount()).toBe(3)
    expect(onCount()).toBe(1)
    rerender(<StageDots total={3} done={2} />)
    expect(onCount()).toBe(2)
  })

  it('池空时的整题小题只有一颗点', () => {
    render(<StageDots total={1} done={1} />)
    expect(dotCount()).toBe(1)
    expect(onCount()).toBe(1)
  })
})

describe('换段过场', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('停 1.2s 后才交回,且期间台阶条已经是目标段的样子', () => {
    const onDone = vi.fn()
    const { container } = render(<StageTransition stage="hard" onDone={onDone} />)
    expect(container.querySelector('[data-stage-transition="hard"]')).not.toBeNull()
    expect(litCount(container.querySelector('.pstage-bar') as HTMLElement)).toBe(2)

    act(() => vi.advanceTimersByTime(STAGE_TRANSITION_MS - 1))
    expect(onDone).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  // onDone 每次渲染都是新的内联箭头函数 —— 挂进 effect 的 deps 会把计时器反复重置,过场永远走不完。
  it('中途重渲染不会重置计时器', () => {
    const onDone = vi.fn()
    const { rerender } = render(<StageTransition stage="review" onDone={onDone} />)
    act(() => vi.advanceTimersByTime(1000))
    rerender(<StageTransition stage="review" onDone={() => onDone()} />)
    act(() => vi.advanceTimersByTime(200))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('进复习那一处遮罩里,第三格已经是灰蓝', () => {
    const { container } = render(<StageTransition stage="review" onDone={vi.fn()} />)
    expect(coolCount(container.querySelector('.pstage-bar') as HTMLElement)).toBe(1)
  })
})
```

- [ ] **Step 2: 跑测试确认它失败**

Run: `npx vitest run src/features/pinyin-blocks/StageBar.test.tsx`
Expected: FAIL —— 找不到模块 `./StageBar`。

- [ ] **Step 3: 写实现**

新建 `src/features/pinyin-blocks/StageBar.tsx`:

```tsx
import { cn } from '@/shared/ui/utils'

/**
 * 三段身份。**与课程数据里的 `Level.review`(复习**关**)是两个独立的东西** ——
 * 一个复习关里也有三段,三段里的第三段才叫复习段(spec §3.0 的命名撞车说明)。
 */
export type StageId = 'easy' | 'hard' | 'review'

/** 只进无障碍树,不上屏 —— 游戏区零可见文字。 */
const LABEL: Record<StageId, string> = {
  easy: '第一段 简单',
  hard: '第二段 困难',
  review: '第三段 复习',
}

/**
 * 段标(台阶条):三格并排、越右越高,亮到第几格就是第几段。
 * 复习段的第三格是灰蓝而不是橙 —— 复习不是第三级难度,是回炉(spec §3.8)。
 */
export function StageBar({ stage, big = false, pop = false }: { stage: StageId; big?: boolean; pop?: boolean }) {
  const cells: ('on' | 'off' | 'cool')[] = ['on', stage === 'easy' ? 'off' : 'on', stage === 'review' ? 'cool' : 'off']
  return (
    <span data-stage={stage} aria-label={LABEL[stage]} className={cn('pstage-bar', big && 'pstage-bar--big')}>
      {cells.map((cell, index) => (
        <span
          key={index}
          aria-hidden
          className={cn(
            'pstage-step',
            cell === 'on' && 'pstage-step--on',
            cell === 'cool' && 'pstage-step--cool',
            pop && cell !== 'off' && 'pstage-step--pop',
          )}
          // 逐格点亮:只在过场里排延迟。减动效下动画被压成 0.01ms,延迟仍在 ⇒ 两态依然可读。
          style={pop && cell !== 'off' ? { animationDelay: `${index * 180}ms` } : undefined}
        />
      ))}
    </span>
  )
}

/**
 * 复习段的小题进度点:最多 3 个,当前第几道就亮几颗(`done` 从 1 起)。
 * 颜色与台阶条第三格同源(同一支灰蓝),放错只抖不动它。
 */
export function StageDots({ total, done }: { total: number; done: number }) {
  return (
    <span data-review-dots data-review-done={done} aria-label={`复习 ${done}/${total}`} className="pstage-dots">
      {Array.from({ length: total }, (_, index) => (
        <span key={index} aria-hidden className={cn('pstage-dot', index < done && 'pstage-dot--on')} />
      ))}
    </span>
  )
}
```

新建 `src/features/pinyin-blocks/StageTransition.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import { StageBar, type StageId } from './StageBar'

/**
 * 过场停留时长。**减动效下也是这个数** —— 动画被压成 0.01ms 之后,
 * 「停 1.2s」这一下由这个 JS 计时器保证,两态可读不靠位移(spec §3.8)。
 */
export const STAGE_TRANSITION_MS = 1200

/**
 * 换段过场:压一层暗遮罩,台阶条放大到屏幕中央。
 * 两处共用一个组件,画法由 `stage` 决定 —— 进困难是「两格逐格点亮」,
 * 进复习是「前两格保持 + 第三格点亮成灰蓝」,颜色语言告诉孩子这不是升级。
 */
export function StageTransition({ stage, onDone }: { stage: StageId; onDone: () => void }) {
  // onDone 恒放 ref:调用方写的是内联箭头函数,每次渲染都是新身份;
  // 挂进下方 effect 的 deps 会让 1.2s 的计时器被反复重置,过场永远走不完。
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  })
  useEffect(() => {
    const timer = window.setTimeout(() => done.current(), STAGE_TRANSITION_MS)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div className="pstage-veil" role="presentation" data-stage-transition={stage}>
      <StageBar stage={stage} big pop />
    </div>
  )
}
```

在 `src/features/pinyin-blocks/index.ts` 里补上 Task 5 留下的两行:

```ts
export { StageBar, StageDots, type StageId } from './StageBar'
export { STAGE_TRANSITION_MS, StageTransition } from './StageTransition'
```

- [ ] **Step 4: 跑测试确认它通过**

Run: `npx vitest run src/features/pinyin-blocks/StageBar.test.tsx && npm test`
Expected: PASS(含全量 —— `index.ts` 的导出现在指向真实文件)。

- [ ] **Step 5: 提交**

```bash
git add src/features/pinyin-blocks/StageBar.tsx src/features/pinyin-blocks/StageTransition.tsx src/features/pinyin-blocks/StageBar.test.tsx src/features/pinyin-blocks/index.ts
git commit -m "feat(pinyin-blocks): 段标(台阶条 + 小题进度点)与换段过场组件"
```

---

### Task 8: 拼装台接三段(`PinyinBlocksGame`)

**Files:**
- Modify: `src/features/pinyin-blocks/PinyinBlocksGame.tsx`(props / `PinyinRound` 的门禁·托盘·判错处置 / 渲染 / 壳)
- Test: `src/features/pinyin-blocks/PinyinBlocksGame.test.tsx`(追加)

**Interfaces:**
- Consumes: Task 3 的 `buildBlocks(..., { hard })`、Task 4 的 `sameTypeOnly` / `autoTypeTargetId` / `HARD_RETRIES` / `wrongSlotIds` 的第 4 参、Task 5 的 `ReviewQuestion` / `addToPool` / `notePick` / `exactPoolKey`、Task 6 的 CSS、Task 7 的 `StageBar` / `StageDots` / `StageId`
- Produces:
  - `type SectionResult = Readonly<{ missCount: number; wrongBlocks: readonly Block[]; failed: boolean }>`
  - `PinyinBlocksGameProps` 新增可选:`stage?: 'easy' | 'hard'`、`review?: ReviewQuestion | null`、`reviewProgress?: { done: number; total: number }`、`onSectionEnd?: (r: SectionResult) => void`

- [ ] **Step 1: 写失败的测试**

在 `src/features/pinyin-blocks/PinyinBlocksGame.test.tsx` 末尾追加(该文件已有 `at` / `unitIdx` / `blockOf` / `trayBlocks` / `solveCorrectly` / `settle` 等助手,直接复用):

> 该文件既有的挂载助手签名是 `mount(unit, level, onAdvance = vi.fn())`,而 `at(levelId)` 交回的是
> `[unit, level]` **元组**、`unitIdx(id)` 收的是**单元 id**(不是关卡 id)。所以下面不直接用 `mount`,
> 另起一个收 props 的 `mountSection` —— 别把元组当 level 传进去(那是 `NaN`,测试会静默指到第一关)。

```tsx
describe('一关三段', () => {
  const SECTION_LEVEL = 'u2-0'
  /** 本关的数据对象 —— `at()` 交回的是下标元组,取关要用它。 */
  const LV = UNITS[at(SECTION_LEVEL)[0]]!.levels[at(SECTION_LEVEL)[1]]!

  /** 段口径的挂载:三段入参直接喂给拼装台。 */
  function mountSection(levelId: string, props: Partial<PinyinBlocksGameProps>) {
    const [unit, level] = at(levelId)
    const speak = vi.fn()
    return render(<PinyinBlocksGame unitIndex={unit} levelIndex={level} speak={speak} {...props} />)
  }

  /**
   * 按「门禁」把一段拼对。困难段用 `sameTypeOnly`,复习段用 `canPlace` ——
   * 判据不同,但**正确块都满足两者**,所以这里传一个判据就够。
   */
  function solveStage(judge: (b: Block, s: Slot) => boolean) {
    for (const slot of slotsFor(LV)) {
      const fits = trayBlocks().filter((el) => judge(blockOf(el), slot))
      const pick = fits.find((el) => blockOf(el).type === slot.type) ?? fits[0]
      expect(pick, `${slot.type}:${slot.value} 在托盘里找不到可放块`).toBeDefined()
      fireEvent.keyDown(pick as HTMLElement, { key: 'Enter' })
    }
  }

  /** 把每个槽都填上一块**类型对、值错**的块 —— 困难段里这才会走到「填满后判错」。 */
  function fillWrongOnce() {
    for (const slot of slotsFor(LV)) {
      const pick = trayBlocks().find((el) => {
        const block = blockOf(el)
        return block.type === slot.type && block.value !== slot.value
      })
      // 声调槽在困难段四声全出,韵母池里也总有别的韵母;找不到就说明托盘算法漏了(那是 Task 3 的账)。
      expect(pick, `${slot.type} 槽找不到「类型对、值错」的块`).toBeDefined()
      fireEvent.keyDown(pick as HTMLElement, { key: 'Enter' })
    }
  }

  it('困难段:门禁只比类型 —— 值错的块放得进去,判错后撤块重试', async () => {
    const onSectionEnd = vi.fn()
    mountSection(SECTION_LEVEL, { stage: 'hard', onSectionEnd })
    // 往声母槽里放一块**值错但类型对**的声母(托盘里 b 之外的声母)。
    const initialSlot = slotsFor(LV).find((s) => s.type === 'initial')!
    const wrong = trayBlocks().find((el) => {
      const block = blockOf(el)
      return block.type === 'initial' && block.value !== initialSlot.value
    })
    expect(wrong, '困难段的托盘里必须有另一块声母').toBeDefined()
    fireEvent.keyDown(wrong as HTMLElement, { key: 'Enter' })
    // 落进去了(简单段会当场弹回)—— 这是「值可以错」的直接证据。
    expect(document.querySelector(`[data-slot-id="${initialSlot.id}"] [data-value]`)).not.toBeNull()
  })

  it('困难段:填满后判错 → 指出错误槽 → 撤块重试', async () => {
    const onSectionEnd = vi.fn()
    mountSection(SECTION_LEVEL, { stage: 'hard', onSectionEnd })
    fillWrongOnce()
    expect(document.querySelectorAll('.pslot--wrong').length).toBeGreaterThan(0)
    await act(async () => {
      vi.advanceTimersByTime(800)
    })
    // 撤块:错误槽空了,又能重来 —— 段还没结束。
    expect(document.querySelectorAll('.pslot--wrong').length).toBe(0)
    expect(onSectionEnd).not.toHaveBeenCalled()
  })

  it('困难段:2 次重试用尽 → 演示正解 → 交回「失败」但不阻塞', async () => {
    const onSectionEnd = vi.fn()
    mountSection(SECTION_LEVEL, { stage: 'hard', onSectionEnd })
    fillWrongOnce()
    await act(async () => {
      vi.advanceTimersByTime(800)
    })
    fillWrongOnce()
    await act(async () => {
      vi.advanceTimersByTime(800)
    })
    fillWrongOnce() // 第 3 次判错 = 用尽
    expect(document.querySelectorAll('.pslot--wrong').length).toBeGreaterThan(0)
    await act(async () => {
      vi.advanceTimersByTime(800)
    })
    // 演示:所有槽都填上了正确块。
    expect(document.querySelectorAll('[data-slot-id] [data-value]')).toHaveLength(slotsFor(LV).length)
    await act(async () => {
      vi.advanceTimersByTime(1400)
    })
    expect(onSectionEnd).toHaveBeenCalledTimes(1)
    expect(onSectionEnd.mock.calls[0]![0]).toMatchObject({ failed: true })
    expect(onSectionEnd.mock.calls[0]![0].missCount).toBeGreaterThanOrEqual(3)
  })

  // Review Focus #2:演示期间孩子继续点托盘块 —— 不许重复交账。
  it('重试用尽后的演示期间,继续点托盘块不会重复交账', async () => {
    const onSectionEnd = vi.fn()
    mountSection(SECTION_LEVEL, { stage: 'hard', onSectionEnd })
    for (let i = 0; i < 3; i++) {
      fillWrongOnce()
      await act(async () => {
        vi.advanceTimersByTime(800)
      })
    }
    for (const el of trayBlocks()) fireEvent.keyDown(el, { key: 'Enter' })
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })
    expect(onSectionEnd).toHaveBeenCalledTimes(1)
  })

  it('简单段:同一块点错 2 次才进错题池', async () => {
    const onSectionEnd = vi.fn()
    mountSection(SECTION_LEVEL, { stage: 'easy', onSectionEnd })
    const extra = trayBlocks().find((el) => {
      const block = blockOf(el)
      return block.type === 'initial' && block.value !== 'b'
    })
    expect(extra).toBeDefined()
    fireEvent.keyDown(extra as HTMLElement, { key: 'Enter' })
    solveStage(canPlace)
    await settle()
    expect(onSectionEnd).toHaveBeenCalledTimes(1)
    // 只点错一次 ⇒ 不进池(阈值 N = 2)。
    expect(onSectionEnd.mock.calls[0]![0].wrongBlocks).toHaveLength(0)
  })

  it('简单段:同一块点错 2 次 ⇒ 进错题池', async () => {
    const onSectionEnd = vi.fn()
    mountSection(SECTION_LEVEL, { stage: 'easy', onSectionEnd })
    const extra = trayBlocks().find((el) => {
      const block = blockOf(el)
      return block.type === 'initial' && block.value !== 'b'
    })
    fireEvent.keyDown(extra as HTMLElement, { key: 'Enter' })
    fireEvent.keyDown(extra as HTMLElement, { key: 'Enter' })
    const first = slotsFor(LV).find((s) => s.type === 'initial')!
    fireEvent.keyDown(trayBlocks().find((el) => canPlace(blockOf(el), first)) as HTMLElement, { key: 'Enter' })
    for (const slot of slotsFor(LV).filter((s) => s.id !== first.id)) {
      const pick = trayBlocks().find((el) => canPlace(blockOf(el), slot))
      if (pick) fireEvent.keyDown(pick, { key: 'Enter' })
    }
    await settle()
    expect(onSectionEnd.mock.calls[0]![0].wrongBlocks.map((block: Block) => `${block.type}:${block.value}`)).toContain(
      'initial:p',
    )
  })

  /**
   * 复习段的题**一律由 `reviewQuestions` 造**。手搓一个 prefill 不全的题面(比如只填 slotIds
   * 与 tray,prefill 留空)会得到一道**无解**的题:托盘里只有声母块,而屏幕上还有韵母槽与声调槽,
   * `isComplete` 永远不成立 ⇒ `onSectionEnd` 一次都不发,测试却会红在断言而不是病因上。
   */
  const reviewQuestionFor = (pool: Block[]) =>
    reviewQuestions(LV, at(SECTION_LEVEL)[0], pool, () => 0.5)[0]!

  it('复习段:预填槽拿不回(点了也不动),托盘只剩挖空槽的正解与错解', () => {
    const question = reviewQuestionFor([{ type: 'initial', value: 'p' }])
    mountSection(SECTION_LEVEL, { review: question })
    // 可见托盘 = 正解 b + 错解 p(韵母与声调都已预填,不在托盘里)。
    expect(trayBlocks()).toHaveLength(2)
    // 三个槽都在屏上,段标也照常画着。
    expect(document.querySelectorAll('[data-slot-id]')).toHaveLength(3)
    expect(document.querySelectorAll('.pstage-step')).toHaveLength(3)

    const prefilled = slotsFor(LV).find((s) => s.id !== question.slotIds[0])!
    const chip = document.querySelector(`[data-slot-id="${prefilled.id}"] [data-value]`)
    expect(chip, `${prefilled.id} 没预填`).not.toBeNull()
    fireEvent.click(chip as HTMLElement)
    // 点了还在槽里 —— 简单段点一下就会弹回托盘(那里 onClick = takeBack)。
    expect(document.querySelector(`[data-slot-id="${prefilled.id}"] [data-value]`)).not.toBeNull()
    expect(trayBlocks()).toHaveLength(2)
  })

  it('复习段:不记 miss(放错只抖)', async () => {
    const onSectionEnd = vi.fn()
    const question = reviewQuestionFor([{ type: 'initial', value: 'p' }])
    mountSection(SECTION_LEVEL, { review: question, onSectionEnd })
    const wrong = trayBlocks().find((el) => blockOf(el).value === 'p')
    fireEvent.keyDown(wrong as HTMLElement, { key: 'Enter' })
    // p 放不进 b 的槽(复习段用 canPlace)⇒ 弹回,托盘里还是两块。
    expect(trayBlocks()).toHaveLength(2)
    const right = trayBlocks().find((el) => blockOf(el).value === 'b')
    fireEvent.keyDown(right as HTMLElement, { key: 'Enter' })
    await settle()
    expect(onSectionEnd.mock.calls[0]![0]).toMatchObject({ missCount: 0, failed: false })
  })
})
```

最后,把上面用到的名字**并进该文件顶部已有的那几行 import**(`./rules` 与 `./blocks` 都已经有一行了 ——
新起一行重名导入会编译不过):缺的是 `sameTypeOnly`、`type Slot`、`type BlockType`(rules / blocks 那两行),
外加这两行:

```tsx
import { reviewQuestions, type ReviewQuestion } from './mistakes'
import { PinyinBlocksGame, type PinyinBlocksGameProps } from './PinyinBlocksGame'
```

(若 `PinyinBlocksGame` 已在顶部的 import 里,把 `type PinyinBlocksGameProps` 加进那一行即可。)

- [ ] **Step 2: 跑测试确认它失败**

Run: `npx vitest run src/features/pinyin-blocks/PinyinBlocksGame.test.tsx -t "一关三段"`
Expected: FAIL —— 渲染 `PinyinBlocksGame` 时不认 `stage` / `review` / `onSectionEnd`(TypeScript 报错 / 行为与老一致)。

- [ ] **Step 3: 写实现**

**(a)** 顶部 import 改成:

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { hintFor, speakOf, type Block } from './blocks'
import { UNITS, losesDots, type Level } from './levels'
import {
  autoTargetId,
  autoTypeTargetId,
  buildBlocks,
  canPlace,
  HARD_RETRIES,
  isComplete,
  sameTypeOnly,
  slotsFor,
  starsFor,
  wrongSlotIds,
  type Rng,
  type Slot,
  type TrayBlock,
} from './rules'
import { addToPool, exactPoolKey, notePick, type MistakePool, type PickCounts, type ReviewQuestion } from './mistakes'
import { BlockChip } from './BlockChip'
import { StageBar, StageDots, type StageId } from './StageBar'
import { cn } from '@/shared/ui/utils'
import type { AnswerKind } from '@/shared/services'
```

**(b)** 在 `type Status = ...` 之后加类型:

```tsx
/** 段结束交回的账目。入口页据此决定下一段。 */
export type SectionResult = Readonly<{
  /** 本段累计的错误次数。复习段恒为 0 —— 星在进复习段之前就落库了(spec §3.9)。 */
  missCount: number
  /** 本段新进错题池的块。 */
  wrongBlocks: readonly Block[]
  /** 困难段重试用尽 —— 本段失败,但**不阻塞**,继续往下走。其余情形恒 false。 */
  failed: boolean
}>
```

**(c)** `PinyinBlocksGameProps` 改为:

```tsx
export type PinyinBlocksGameProps = {
  /** 朗读(拼音串)。由 Entry 从 SpeechService 注入 —— feature 内不碰 useService。 */
  speak: (text: string) => void
  playSound?: (cue: 'correct' | 'wrong' | 'victory' | 'tap') => void
  /** 每放一块上报一次 —— 连击靠它驱动。放对 'first',放错 'wrong'。 */
  onBlock?: (kind: AnswerKind) => void
  unitIndex?: number
  levelIndex?: number
  /** 本段身份。默认 'easy' = 今天的玩法(门禁 canPlace、托盘同 buildBlocks 现状)。 */
  stage?: 'easy' | 'hard'
  /** 复习段的小题。给了它就走复习口径:canPlace 门禁 + 预填槽 + 限定托盘 + 不记 miss。 */
  review?: ReviewQuestion | null
  /** 复习段的小题进度(当前第几道 / 共几道)。只影响画点。 */
  reviewProgress?: { done: number; total: number }
  /** 段结束交回账目。给了它就不再走 onSolved / 自走那条路 —— 由入口页决定下一段。 */
  onSectionEnd?: (result: SectionResult) => void
  /** 通关:交出本关星级(1..3),由入口页负责落库与推进。 */
  onSolved?: (stars: number) => void
  onAdvance?: (unit: number, level: number) => void
}
```

**(d)** `RoundProps` 改为:

```tsx
type RoundProps = {
  unitIdx: number
  lvlIdx: number
  round: number
  speak: (text: string) => void
  playSound?: PinyinBlocksGameProps['playSound']
  onBlock?: (kind: AnswerKind) => void
  onSolved?: (stars: number) => void
  stage: 'easy' | 'hard'
  review: ReviewQuestion | null
  reviewProgress?: { done: number; total: number }
  onSectionEnd?: (result: SectionResult) => void
}
```

**(e)** `PinyinRound` 的函数头与开头几行改成:

```tsx
function PinyinRound({
  unitIdx,
  lvlIdx,
  round,
  speak,
  playSound,
  onBlock,
  onSolved,
  stage,
  review,
  reviewProgress,
  onSectionEnd,
}: RoundProps) {
  const unit = UNITS[unitIdx] ?? UNITS[0]!
  const level: Level = unit.levels[lvlIdx] ?? unit.levels[0]!

  /** 三种口径。复习段压过 stage —— 它自己就是一段。类型直接借 StageId,免得两处各写一遍联合类型。 */
  const mode: StageId = review ? 'review' : stage
  const hard = mode === 'hard'
  /** 复习段不记 miss、不上报连击 —— 星在进这一段之前就落库了(spec §3.9)。 */
  const penalized = mode !== 'review'

  const slots = useMemo(() => slotsFor(level), [level])
  const tray: TrayBlock[] = useMemo(
    () =>
      review
        ? review.tray
        : buildBlocks(level, unitIdx, makeRng(round), { hard }).map((b, i) => ({ ...b, id: `b${i}` })),
    [level, unitIdx, round, review, hard],
  )

  /** 预填的槽不能拿回 —— 复习段的考点就是挖空的那几个槽(spec §3.7)。 */
  const locked = useMemo(() => new Set(Object.keys(review?.prefill ?? {})), [review])
```

把 `const [placement, setPlacement] = useState<Record<string, string>>({})` 换成:

```tsx
  // 复习段带预填:其余槽用正确块填好,孩子只动挖空的那几个。
  const [placement, setPlacement] = useState<Record<string, string>>(() => ({ ...(review?.prefill ?? {}) }))
```

**(f)** 给**已有的** `noteMiss` 补一道闸(这是改它,不是新加一个 —— 别留两份),并在它之后就着现有状态往下加:

```tsx
  /** 同步计数:placeBlock 的闭包里读到的是旧 state,而判定发生在同一次调用里。
      复习段恒不计数 —— 星在进这一段之前就落库了(spec §3.9)。 */
  function noteMiss() {
    if (!penalized) return
    missRef.current += 1
    setMissCount(missRef.current)
  }

  /**
   * 错题池 —— **关内状态**,不持久化、不跨关(产品裁定「复习段只考本关」)。
   * 只在段末交回入口页,不需要触发重渲染,故用 ref。
   */
  const poolRef = useRef<MistakePool>([])
  /** 简单段的点错计数:按块 id(见 notePick)。 */
  const picksRef = useRef<PickCounts>({})

  /**
   * 记一次「选中了错块」。简单段攒够 WRONG_PICK_THRESHOLD 才进池;困难段当场进池
   * (那一段每一次判错都是真错,没有「手滑」与「不会」的分别)。复习段不记。
   */
  const noteWrongBlock = useCallback(
    (block: Block, blockId: string) => {
      if (!penalized) return
      if (hard) {
        poolRef.current = addToPool(poolRef.current, [block], exactPoolKey)
        return
      }
      const { counts, reached } = notePick(picksRef.current, blockId)
      picksRef.current = counts
      if (reached) poolRef.current = addToPool(poolRef.current, [block])
    },
    [hard, penalized],
  )
```

**(g)** 在 `flashReject` 之后加点错块的即时反馈:

```tsx
  /** 点错块的即时反馈(与 flashReject 同构:同一个自增序号驱动,连续点同一块也能重放动画)。
      今天点错块**只有声音** —— 静音环境(平板很常见)里孩子的体验是「点了它一下,什么都没发生」。 */
  const [rejectBlock, setRejectBlock] = useState<{ id: string; n: number } | null>(null)
  const rejectBlockTimer = useRef<number | null>(null)
  useEffect(
    () => () => {
      if (rejectBlockTimer.current !== null) window.clearTimeout(rejectBlockTimer.current)
    },
    [],
  )
  const flashRejectBlock = useCallback((blockId: string) => {
    setRejectBlock((cur) => ({ id: blockId, n: (cur?.n ?? 0) + 1 }))
    if (rejectBlockTimer.current !== null) window.clearTimeout(rejectBlockTimer.current)
    rejectBlockTimer.current = window.setTimeout(() => setRejectBlock(null), 520)
  }, [])
```

**(h)** 紧接在 `noteWrongBlock` / `flashRejectBlock` 之后(`placedBlockIds` 那几行之前)插入段的收尾三件套 —— **顺序不能换**:`endSection` 被 `demoSolution` 用,`demoSolution` 被 `placeBlock` 的 deps 用:

```tsx
  /** 本段的重试计数 —— 每关 2 次,用尽即失败但不阻塞(spec §3.6)。 */
  const retriesRef = useRef(0)

  /** 段结束:交回账目。给了 `onSectionEnd` 就归入口页管;没给就退回今天那条老路(拼对 → onSolved)。 */
  const endSection = useCallback(
    (failed: boolean) => {
      if (onSectionEnd) {
        onSectionEnd({ missCount: missRef.current, wrongBlocks: poolRef.current, failed })
        return
      }
      if (failed) return // 老路没有「失败」这一档;这条不该发生
      onSolved?.(starsFor(missRef.current))
    },
    [onSectionEnd, onSolved],
  )

  /** 重试用尽:把正解一块块落进各自的槽,**演示一遍**再收尾。
      一关只有一道题,「继续下一道题」在一关内无从落实;直接跳过会让孩子不知道正确答案是什么。 */
  const demoSolution = useCallback(() => {
    const used = new Set<string>()
    const next: Record<string, string> = {}
    for (const slot of slots) {
      const block = tray.find((b) => !used.has(b.id) && canPlace(b, slot))
      if (!block) continue
      used.add(block.id)
      next[slot.id] = block.id
    }
    setPlacement(next)
    setWrongIds([])
    setStatus('solved')
    playSound?.('victory')
    speak(level.read)
    setBurst(true)
    timer.current = window.setTimeout(() => {
      setBurst(false)
      endSection(true)
    }, 1200)
  }, [slots, tray, level, playSound, speak, endSection])
```

**(i)** `succeed` 改成:

```tsx
  const succeed = useCallback(() => {
    setStatus('solved')
    playSound?.('victory')
    speak(level.read)
    setBurst(true)
    timer.current = window.setTimeout(
      () => {
        setBurst(false)
        // 有三段相位就走交账那条路;没有才是今天那套「拼对即通关」。
        if (onSectionEnd) endSection(false)
        else onSolved?.(starsFor(missRef.current))
      },
      welded ? 2100 : 1600,
    )
  }, [level, onSectionEnd, endSection, onSolved, playSound, speak, welded])
```

**(j)** `placeBlock` 整体换成:

```tsx
  /** 本段的落位判据。困难段只比类型(值可以错),其余两段与今天一致。 */
  const fits = useCallback((block: Block, slot: Slot) => (hard ? sameTypeOnly(block, slot) : canPlace(block, slot)), [hard])

  const placeBlock = useCallback(
    (blockId: string, slotId: string) => {
      if (status !== 'playing') return
      const block = tray.find((b) => b.id === blockId)
      const slot = slots.find((s) => s.id === slotId)
      if (!block || !slot) return
      if (locked.has(slotId)) return // 复习段的预填槽:不进不出
      if (!fits(block, slot)) {
        noteMiss()
        if (penalized) onBlock?.('wrong')
        playSound?.('wrong')
        flashReject(slotId)
        flashRejectBlock(blockId)
        noteWrongBlock(block, blockId)
        return
      }
      playSound?.('tap')
      if (penalized) onBlock?.('first')
      const next: Record<string, string> = { ...placement }
      for (const [sid, bid] of Object.entries(next)) if (bid === blockId) delete next[sid]
      next[slotId] = blockId
      setPlacement(next)

      if (!isComplete(slots, next)) return
      const wrong = wrongSlotIds(slots, next, tray, fits)
      if (wrong.length === 0) {
        clearTimer()
        timer.current = window.setTimeout(succeed, 260)
        return
      }
      // 全填后判错 —— **困难段是这段代码的入口**。简单段与复习段的门禁在落位前就挡住了错的,
      // 所以那两段里这条分支不可达(它的存在是给困难段用的,不是死代码)。
      noteMiss()
      if (penalized) onBlock?.('wrong')
      for (const id of wrong) {
        const bad = tray.find((b) => b.id === next[id])
        if (bad) noteWrongBlock(bad, bad.id)
      }
      playSound?.('wrong')
      setStatus('wrong')
      setWrongIds(wrong)
      const exhausted = hard && retriesRef.current >= HARD_RETRIES
      if (hard && !exhausted) retriesRef.current += 1
      timer.current = window.setTimeout(() => {
        if (exhausted) {
          demoSolution()
          return
        }
        setPlacement((cur) => {
          const copy = { ...cur }
          for (const id of wrong) delete copy[id]
          return copy
        })
        setWrongIds([])
        setStatus('playing')
      }, 720)
    },
    [
      status,
      tray,
      slots,
      placement,
      locked,
      fits,
      hard,
      penalized,
      succeed,
      demoSolution,
      playSound,
      onBlock,
      clearTimer,
      flashReject,
      flashRejectBlock,
      noteWrongBlock,
    ],
  )
```

**(k)** `takeBack` 加一道预填槽的闸,`autoPlace` 换成:

```tsx
  const takeBack = useCallback(
    (slotId: string) => {
      if (status !== 'playing') return
      if (locked.has(slotId)) return // 预填槽不可拿回(见 locked)
      setPlacement((cur) => {
        const copy = { ...cur }
        delete copy[slotId]
        return copy
      })
    },
    [status, locked],
  )

  const autoPlace = useCallback(
    (blockId: string) => {
      const block = tray.find((b) => b.id === blockId)
      if (!block) return
      // 困难段的落点取「同类型的第一个空槽」(值可以错);其余两段走今天的 autoTargetId。
      const target = hard ? autoTypeTargetId(block, slots, placement) : autoTargetId(block, slots, placement)
      if (target) placeBlock(blockId, target)
      else {
        noteMiss()
        if (penalized) onBlock?.('wrong')
        playSound?.('wrong')
        flashRejectBlock(blockId)
        noteWrongBlock(block, blockId)
      }
    },
    [tray, slots, placement, hard, penalized, placeBlock, playSound, onBlock, flashRejectBlock, noteWrongBlock],
  )
```

**(l)** `renderSlot` 里 `BlockChip` 的 `onClick` 改成:

```tsx
            // 复习段的预填槽不绑 onClick —— 孩子能操作的是挖空的那几个槽(spec §3.7)。
            onClick={locked.has(slot.id) ? undefined : () => takeBack(slot.id)}
```

**(m)** `trayBlock` 的 wrapper 加上点错反馈的类与重放用的 key:

```tsx
  const trayBlock = (b: TrayBlock) => (
    <div
      // 被拒时换 key 重挂本块,让抖动动画从头播(与槽位的 flashReject 同一手法)
      key={rejectBlock?.id === b.id ? `${b.id}-${rejectBlock.n}` : b.id}
      data-block-id={b.id}
      onPointerDown={(e) => onDown(e, b.id)}
      className={cn('cursor-grab active:cursor-grabbing', rejectBlock?.id === b.id && 'pblock--reject')}
      role="button"
      tabIndex={0}
      aria-label={b.type === 'tone' ? `声调块 ${b.value}` : `积木 ${b.value}`}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        speakBlock(b)
        autoPlace(b.id)
      }}
    >
      <BlockChip
        type={b.type}
        value={b.value}
        dim={draggingId === b.id}
        className={cn(b.type === 'tone' ? TRAY_BOX_TONE : TRAY_BOX)}
      />
    </div>
  )
```

> `.pblock--reject` 挂在 wrapper 上(与 `pblock--dragging` 的克隆同层),所以它的 `box-shadow` 走 `--pb-edge` —— wrapper 上没有这个变量,shadow 会用 `var(--pb-edge)` 的**继承值**。给 wrapper 补一条兜底:把类挂到 wrapper 时同时加 `text-...`? **不要**。正确做法是把 `pblock--reject` 挂到 **`BlockChip` 的 className 上**(那里就是 `.pblock`),抖动也跟着块本体走:

```tsx
      <BlockChip
        type={b.type}
        value={b.value}
        dim={draggingId === b.id}
        className={cn(b.type === 'tone' ? TRAY_BOX_TONE : TRAY_BOX, rejectBlock?.id === b.id && 'pblock--reject')}
      />
```

wrapper 上**不挂** `pblock--reject`,只留换 key 那一手。

**(n)** 主题面(台阶条 + 进度点)插在题面图**之前**:

```tsx
      {/* 段标:台阶条三格,亮到第几格就是第几段;复习段下面再挂一排小题进度点。
          位置钉在题面图上方、与拼装台同列 —— 不占新地方(spec §3.8)。 */}
      <div className="flex flex-col items-center gap-1.5">
        <StageBar stage={mode} />
        {mode === 'review' && reviewProgress ? (
          <StageDots total={reviewProgress.total} done={reviewProgress.done} />
        ) : null}
      </div>
```

**(o)** 拼装台的提示档改成:

```tsx
      <div
        role="group"
        aria-label="拼装台"
        className={cn(
          'pslots flex min-h-[7.5rem] items-end justify-center gap-1',
          // 困难段:类型色恒亮 + 实线边,不吃提示档 —— 那一段的规则就是「同颜色才能放」,
          // 在弱档单元(u9–u12,--slot-line: 0%)不恒亮的话这条规则在屏幕上不可见。
          hard && 'pslots--hard',
          !hard && (mode === 'review' ? true : hint === 'mid') && 'pslots--mid',
          !hard && mode === 'easy' && hint === 'weak' && 'pslots--weak',
        )}
      >
```

**(p)** 托盘改成:

```tsx
      <div
        className={cn(
          'glass-strong flex w-full max-w-3xl flex-col items-center gap-3 rounded-4xl px-4 py-4 shadow-[var(--shadow-card)]',
          hard && 'ptray--hard',
          mode === 'review' && 'ptray--review',
        )}
      >
        <div className="flex flex-wrap items-center justify-center gap-3">
          {liveBlocks.filter((b) => b.type !== 'tone').map(trayBlock)}
        </div>
        {/* 声调行按需出现:复习段的托盘常常一块声调都没有,那时不该留一条空的虚线分隔。 */}
        {liveBlocks.some((b) => b.type === 'tone') ? (
          <div className="flex items-center justify-center gap-4 border-t-2 border-dotted border-hairline-strong pt-3">
            {liveBlocks.filter((b) => b.type === 'tone').map(trayBlock)}
          </div>
        ) : null}
      </div>
```

**(q)** 壳 `PinyinBlocksGame` 的签名与 `<PinyinRound>` 改成:

```tsx
export function PinyinBlocksGame({
  speak,
  playSound,
  onBlock,
  unitIndex,
  levelIndex,
  stage = 'easy',
  review = null,
  reviewProgress,
  onSectionEnd,
  onSolved,
  onAdvance,
}: PinyinBlocksGameProps) {
  const [self, setSelf] = useState({ unit: 0, level: 0 })
  const [round, setRound] = useState(0)
  const unit = unitIndex ?? self.unit
  const level = levelIndex ?? self.level

  /** 关内自己往下走(试玩路径)。由外层控关时不动 —— 那是 LevelEntry 的事。 */
  const advance = () => {
    const u = UNITS[unit] ?? UNITS[0]!
    const next =
      level + 1 < u.levels.length ? { unit, level: level + 1 } : { unit: (unit + 1) % UNITS.length, level: 0 }
    setRound((r) => r + 1)
    if (unitIndex === undefined) setSelf(next)
    onAdvance?.(next.unit, next.level)
  }

  return (
    <PinyinRound
      key={`${unit}-${level}-${round}`}
      unitIdx={unit}
      lvlIdx={level}
      round={round}
      speak={speak}
      playSound={playSound}
      onBlock={onBlock}
      stage={stage}
      review={review}
      reviewProgress={reviewProgress}
      onSectionEnd={onSectionEnd}
      // 有 onSectionEnd 就不给这条老路:段结束由入口页决定下一段。
      onSolved={
        onSectionEnd
          ? undefined
          : (stars) => {
              if (onSolved) onSolved(stars)
              else advance()
            }
      }
    />
  )
}
```

- [ ] **Step 4: 跑测试确认它通过**

Run: `npx vitest run src/features/pinyin-blocks/PinyinBlocksGame.test.tsx && npm test`
Expected: PASS(含既有的 708 行老用例 —— 默认 `stage='easy'`、`review=null` 时行为与今天一致)。

> 既有用例若因**托盘内容**变化而红(家族去重少了一块干扰块、伙伴优先换了块),先确认红的是「断言某个具体干扰块存在」这类**过强的断言**,把它改成断言「干扰块只来自已教过的池」(该文件既有的口径),**不要**为了迁就旧断言回退 Task 2 的去重。

- [ ] **Step 5: 提交**

```bash
git add src/features/pinyin-blocks/PinyinBlocksGame.tsx src/features/pinyin-blocks/PinyinBlocksGame.test.tsx
git commit -m "feat(pinyin-blocks): 拼装台接三段(困难段门禁/重试/正解演示,复习段预填与限定托盘)"
```

---

### Task 9: 相位机(`LevelRun`)与落库顺序(`LevelEntry`)

**Files:**
- Create: `src/features/pinyin-blocks/LevelRun.tsx`
- Modify: `src/features/pinyin-blocks/LevelEntry.tsx`
- Modify: `src/features/pinyin-blocks/index.ts`(导出 `LevelRun` 与 `SectionResult`)
- Test: `src/features/pinyin-blocks/LevelEntry.test.tsx`(改写求解助手 + 追加)

**Interfaces:**
- Consumes: Task 5 的 `reviewQuestions` / `addToPool` / `exactPoolKey`、Task 7 的 `StageTransition`、Task 8 的 `SectionResult` / `PinyinBlocksGameProps`
- Produces: `LevelRun({ unit, unitIndex, levelIndex, speak, playSound, onBlock, settle, onDone })`

- [ ] **Step 1: 改写既有测试的求解助手并加新用例**

`LevelEntry.test.tsx` 现有用例全部假设「拼对一次 = 通关」。三段之后,一条通关路径要**三段都走完**。把该文件里的 `solveCorrectly()` 与 `settle()` 之后追加:

```tsx
/** 过场停 1.2s 才交回(STAGE_TRANSITION_MS)—— 推时钟越过它。 */
async function transition() {
  await act(async () => {
    vi.advanceTimersByTime(1300)
  })
}

/**
 * 走完一整关:简单段 → 过场 A → 困难段 →(落库)→ 过场 B → 复习段 → 推进。
 * 段内一律拼对 ⇒ 错题池为空 ⇒ 复习段是「本关整题重做」,求解方式与简单段相同。
 */
async function solveLevel() {
  solveCorrectly() // 简单段
  await settle() // 成功动画 → 过场 A
  await transition()
  solveCorrectly() // 困难段
  await settle() // 成功动画 → settleLevel → 过场 B
  await transition()
  solveCorrectly() // 复习段(池空 = 整题)
  await settle() // → onDone → 推进下一关
}
```

把现有**三条需要真的通关**的用例里的 `solveCorrectly(); await settle()` 换成 `await solveLevel()`:

- `一关拼成且没有奖励弹层接手 → word 档撒花`(第 192 行)
- `有成就接手时 word 档不撒 —— 一次成功只撒一次花`(第 200 行)
- `有幸运奖励接手时 word 档不撒`(第 210 行)

其余七条(落一块的三条 + 连击圆点四条)只落一块、不通关,**不动** —— 它们不依赖段推进。

> 这三条都断言 `celebrate.play` 的**档位**,而 `solveLevel()` 会在简单段与困难段一路落十几块、每块都过
> `handleBlock`(连击档的接线)。它们没传 `comboAnswers`,假 combo 默认返 0 ⇒ `celebrationFor(0)` 返 null
> ⇒ 不会多撒一记,断言才站得住。若为了让 `solveLevel()` 跑通而给它们塞了 `comboAnswers`,那三条会红在
> 「多了一记撒花」上 —— 那是用例自己造的,不是实现的问题。

在该文件末尾追加:

```tsx
describe('关卡页 · 三段相位', () => {
  it('一关走完三段:每一步都在,最后推进到下一关', async () => {
    const { onSettle } = mountLevelEntry()
    solveCorrectly()
    expect(document.querySelector('[data-stage="easy"]')).not.toBeNull()
    await settle()
    await transition()
    expect(document.querySelector('[data-stage="hard"]')).not.toBeNull()
    solveCorrectly()
    await settle()
    await transition()
    expect(document.querySelector('[data-stage="review"]')).not.toBeNull()
    solveCorrectly()
    await settle()
    expect(onSettle).toHaveBeenCalledTimes(1)
  })

  // Review Focus #3:复习到一半按「回地图」就走 —— 那一关的星必须**已经**记上。
  it('进复习段之前 recordClear 已被调用(复习到一半退出不会丢星)', async () => {
    const { progressService, onSettle } = mountLevelEntry()
    solveCorrectly()
    await settle()
    await transition()
    solveCorrectly()
    await settle()
    // 此刻已进复习段 —— 星必须已落库。
    await transition()
    expect(progressService.recordClear).toHaveBeenCalled()
    expect(onSettle).not.toHaveBeenCalled() // 但还没发:弹层要等复习段跑完
  })

  it('复习段中途回地图:补发 onSettle + 撒花,且只发一次', async () => {
    const { onSettle, celebrate } = mountLevelEntry()
    solveCorrectly()
    await settle()
    await transition()
    solveCorrectly()
    await settle()
    await transition()
    fireEvent.click(screen.getByLabelText('回地图'))
    expect(onSettle).toHaveBeenCalledTimes(1)
    expect(celebrate.play).toHaveBeenCalledWith('word')
  })

  // Review Focus #4:重玩已通关的关 —— 相位从简单段重跑,不残留上一轮的池。
  it('重挂同一关:相位回到简单段', async () => {
    const { unmount, onSettle } = mountLevelEntry()
    await solveLevel()
    expect(onSettle).toHaveBeenCalled()
    unmount()
    mountLevelEntry()
    expect(document.querySelector('[data-stage="easy"]')).not.toBeNull()
  })
})
```

该文件顶部的 testing-library import 现在没有 `screen`,把它加进去(一行改一处,别新起一行):

```tsx
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
```

`mountLevelEntry` 需要多交出进度服务,把它 return 的那一行改成:

```tsx
  return { ...utils, celebrate, comboService, comboStore, onSettle, progressService: progress }
```

(`progress` 就是该函数里已经建好、并注册给 `PinyinProgressService` 的那个假服务 —— 在 return 里映射一个名字出来即可,别再造一个假的。)

另:该文件的 `solveCorrectly()` **写死了 `UNITS[0]!.levels[0]`**(u1-0),而 `mountLevelEntry` 恒以 `unitIndex={0}` 挂载,
所以整份用例都在 u1-0 上跑。`solveLevel()` 连点三段**都还在 u1-0 上**(推进下一关发生在复习段交账之后),
这个写死因此不碍事 —— 但也**只**在 u1-0 上成立:要换关就得先把 `solveCorrectly` 参数化,别指望它自己跟着走。

- [ ] **Step 2: 跑测试确认它失败**

Run: `npx vitest run src/features/pinyin-blocks/LevelEntry.test.tsx`
Expected: FAIL —— 三段流程不存在,拼对一次就直接结算推进了。

- [ ] **Step 3: 写实现**

新建 `src/features/pinyin-blocks/LevelRun.tsx`:

```tsx
// 一关的三段相位机:简单 → 过场 A → 困难 →(落库)→ 过场 B → 复习 → 交账。
// 复用 PinyinBlocksGame,只换入参 —— 不写第二套拼装台(spec §3.10)。
// **按 level.id 换 key 重挂** —— 换关即清空,不在 effect 里 setState 补重置。

import { useCallback, useMemo, useRef, useState } from 'react'
import type { AnswerKind } from '@/shared/services'
import type { Unit } from './levels'
import { addToPool, exactPoolKey, reviewQuestions, type MistakePool } from './mistakes'
import { PinyinBlocksGame, type SectionResult } from './PinyinBlocksGame'
import { starsFor } from './rules'
import { StageTransition } from './StageTransition'

type LevelRunProps = {
  unit: Unit
  unitIndex: number
  levelIndex: number
  speak: (text: string) => void
  playSound?: (cue: 'correct' | 'wrong' | 'victory' | 'tap') => void
  onBlock?: (kind: AnswerKind) => void
  /**
   * 落库(星级归一 / 首通 / 连续天数 / 成就 / 星尘)。**困难段一结束就调**,在复习段之前 ——
   * 复习到一半按「回地图」就走,那时这一关必须已经记上(spec §3.9)。
   */
  settle: (stars: number) => Promise<void>
  /** 复习段跑完。入口页据此发 onSettle + 撒花 + 推进下一关。 */
  onDone: () => void
}

export function LevelRun({
  unit,
  unitIndex,
  levelIndex,
  speak,
  playSound,
  onBlock,
  settle,
  onDone,
}: LevelRunProps) {
  const level = unit.levels[levelIndex]
  const [phase, setPhase] = useState<'easy' | 'transitionA' | 'hard' | 'transitionB' | 'review'>('easy')
  const [reviewIdx, setReviewIdx] = useState(0)
  const [pool, setPool] = useState<MistakePool>([])
  /** 简单段的错次数 —— 与困难段的错相加才是这一关的 miss(spec §3.9 裁定 M)。 */
  const easyMiss = useRef(0)

  // 复习小题只算一次:它内部会发牌(池空那一支),每次渲染重算会把托盘在题目中途换掉。
  const questions = useMemo(
    () => (phase === 'transitionB' || phase === 'review' ? reviewQuestions(level!, unitIndex, pool) : []),
    [phase, level, unitIndex, pool],
  )

  const onEasyEnd = useCallback((result: SectionResult) => {
    easyMiss.current = result.missCount
    setPool((cur) => addToPool(cur, result.wrongBlocks))
    setPhase('transitionA')
  }, [])

  const onHardEnd = useCallback(
    async (result: SectionResult) => {
      // 困难段的池按**精确身份**记账 —— 那一段的门禁只比类型,介母块与韵母块是两个真身份。
      setPool((cur) => addToPool(cur, result.wrongBlocks, exactPoolKey))
      // 星在复习段之前落库。复习段恒不增 miss,所以这里的数就是这一关的最终星级。
      await settle(starsFor(easyMiss.current + result.missCount))
      setPhase('transitionB')
    },
    [settle],
  )

  const onReviewEnd = useCallback(() => {
    // 最后一道小题做完才交账;否则换下一道(换 reviewIdx ⇒ 换 key ⇒ 重挂)。
    if (reviewIdx + 1 >= questions.length) {
      onDone()
      return
    }
    setReviewIdx(reviewIdx + 1)
  }, [reviewIdx, questions.length, onDone])

  if (!level) return null

  // 过场期间就把目标那一段挂上(蒙在遮罩后面)—— 遮罩一散,孩子看到的就是新一段,
  // 不会有一次「空屏 → 重挂」的闪。key 不变 ⇒ 这一挂是同一个实例,状态不被重置。
  const active: 'easy' | 'hard' | 'review' =
    phase === 'easy' ? 'easy' : phase === 'hard' || phase === 'transitionA' ? 'hard' : 'review'
  const question = questions[reviewIdx]

  const game = () => {
    if (active === 'easy') {
      return (
        <PinyinBlocksGame
          key={`${level.id}-easy`}
          unitIndex={unitIndex}
          levelIndex={levelIndex}
          stage="easy"
          speak={speak}
          playSound={playSound}
          onBlock={onBlock}
          onSectionEnd={onEasyEnd}
        />
      )
    }
    if (active === 'hard') {
      return (
        <PinyinBlocksGame
          key={`${level.id}-hard`}
          unitIndex={unitIndex}
          levelIndex={levelIndex}
          stage="hard"
          speak={speak}
          playSound={playSound}
          onBlock={onBlock}
          onSectionEnd={onHardEnd}
        />
      )
    }
    if (!question) return null
    return (
      <PinyinBlocksGame
        key={`${level.id}-review-${reviewIdx}`}
        unitIndex={unitIndex}
        levelIndex={levelIndex}
        review={question}
        reviewProgress={{ done: reviewIdx + 1, total: questions.length }}
        speak={speak}
        playSound={playSound}
        onBlock={onBlock}
        onSectionEnd={onReviewEnd}
      />
    )
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {game()}
      {phase === 'transitionA' ? <StageTransition stage="hard" onDone={() => setPhase('hard')} /> : null}
      {phase === 'transitionB' ? <StageTransition stage="review" onDone={() => setPhase('review')} /> : null}
    </div>
  )
}
```

`LevelEntry.tsx` 改成:

```tsx
import { useCallback, useRef, useState } from 'react'
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
import { LevelRun } from './LevelRun'
import { UNITS } from './levels'
import { settleLevel, type LevelSettlement } from './settle'

/** 连击圆点:5 颗封顶 —— 再多也读不出来,而 5 正好对上第一个撒花档。 */
const COMBO_DOTS = [0, 1, 2, 3, 4] as const

/**
 * 关卡页入口。一关走完三段(简单 / 困难 / 复习)→ 结算 → **自动**推进到下一关;
 * 单元最后一关则自动回地图(两处都不是按钮 —— 屏幕上没有「继续」)。
 *
 * 本关是单元内第几关由 unitIndex 决定,恒从该单元**第一个未通关**的关口进 ——
 * 地图上点的是单元,不是具体某一关。
 *
 * **落库与 onSettle 被拆到复习段的两侧**(spec §3.9):
 * `settle`(写库)在困难段一结束就发生,`onSettle`(弹层 + 撒花)等复习段跑完再发 ——
 * 成就 / 幸运奖励的弹层压在复习台上就没法玩了。孩子复习到一半按「回地图」而走时,
 * 星已经安全了(`flush` 会把没发的 onSettle 补上)。
 */
export function LevelEntry({
  unitIndex,
  onExitToMap,
  onSettle,
}: {
  unitIndex: number
  onExitToMap(): void
  onSettle(result: LevelSettlement): void
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
  const unit = UNITS[unitIndex] ?? UNITS[0]!
  const firstUncleared = unit.levels.findIndex((level) => (progressSnap.data.stars[level.id] ?? 0) === 0)
  const [levelIndex, setLevelIndex] = useState(firstUncleared < 0 ? 0 : firstUncleared)

  const comboLit = Math.min(comboSnap.combo, COMBO_DOTS.length)

  const speak = useCallback((text: string) => speech.speak(text, 'zh-CN'), [speech])

  /** 已落库、但还没发出去的结算结果。**必须是 ref** —— 它跨「复习段」这一整段活着。 */
  const pending = useRef<LevelSettlement | null>(null)

  /** 落库。在困难段结束时调用,早于复习段。 */
  const settle = useCallback(
    async (stars: number) => {
      const level = unit.levels[levelIndex]
      if (!level) return
      const result = await settleLevel(
        {
          levelId: level.id,
          stars,
          currentStars: progressSnap.data.stars,
          totalStars: progressSnap.data.totalStars,
          settings: settingsSnap.data,
          sessionCleared,
          // 连击存在 sessionStorage,是浏览器会话的账;结算把它带过来一次用掉
          maxCombo: combo.getSnapshot().maxCombo,
        },
        { progress, settings, combo, lucky, achievements },
      )
      // 用结算交回的**结果**,不是自己 +1 —— 重玩一关不该让首通数虚增
      setSessionCleared(result.sessionCleared)
      pending.current = result
    },
    [unit, levelIndex, progressSnap, settingsSnap, sessionCleared, progress, settings, combo, lucky, achievements],
  )

  /** 发 onSettle + 撒花。**只发一次** —— 发完就清账,复习段跑完与中途退出共用这一条路。 */
  const flush = useCallback(() => {
    const result = pending.current
    if (!result) return
    pending.current = null
    onSettle(result)
    // 一次成功只撒一次花。两个分支**各自弹层都有自己的档** —— 成就 `achievement`(200 粒)、
    // 幸运 `lucky`(60 粒),两处都在 `celebrate.ts` 的 `CONFIGS` 里(粒数照那张表核)。
    // 所以「让掉 `word`」在两边是**同一个道理**:不让就是「它自己那一记 + `word` 的 100 粒」
    // 叠在同一个通关上,把「发生了什么」糊掉 —— 这个算术对**两个分支都成立**,不再分岔。
    // 而「让掉 `word`」**不等于**「这一关一记都不出」:那一记由各自弹层的档出,只是不出 `word`。
    // 出处:spec `docs/superpowers/specs/2026-09-24-reward-flight-design.md`(幸运第五档)。
    if (result.achievements.length === 0 && result.luckyReward <= 0) celebrate.play('word')
  }, [onSettle, celebrate])

  /** 复习段跑完 → 交账 → 推进下一关 / 回地图。 */
  const handleDone = useCallback(() => {
    flush()
    if (levelIndex + 1 < unit.levels.length) setLevelIndex(levelIndex + 1)
    else onExitToMap()
  }, [flush, levelIndex, unit, onExitToMap])

  /** 头部「回地图」。**先交账再走** —— 复习段中途退出时,onSettle 还欠着。 */
  const handleExit = useCallback(() => {
    flush()
    onExitToMap()
  }, [flush, onExitToMap])

  // 连击的落点:每放一块上报一次。放对 'first'、放错 'wrong'。
  // answer() 的返回值此前被丢弃 —— 撒花档就挂在它上面(阈值判定在 celebrationFor)。
  // 复习段不上报(见 PinyinBlocksGame 的 penalized),免得复习变成刷连击的通道。
  const handleBlock = useCallback(
    (kind: AnswerKind) => {
      const tier = celebrationFor(combo.answer(kind))
      if (tier) celebrate.play(tier)
    },
    [combo, celebrate],
  )

  const level = unit.levels[levelIndex]

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
          {/* 连击圆点:会话连击(见 spec §3.3 的裁定),封顶 5 颗。
              靠「亮/暗」两态表达 —— 减动效用户也必须看得见。 */}
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
          <span className="text-sm font-bold text-ink-3 tabular-nums">
            {levelIndex + 1}/{unit.levels.length}
          </span>
        </span>
      </div>
      {/* 换关即换 key ⇒ 相位、错题池、发牌全部重来 —— 不靠 effect 里 setState 补重置。 */}
      {level ? (
        <LevelRun
          key={level.id}
          unit={unit}
          unitIndex={unitIndex}
          levelIndex={levelIndex}
          speak={speak}
          playSound={audio.play}
          onBlock={handleBlock}
          settle={settle}
          onDone={handleDone}
        />
      ) : null}
    </div>
  )
}
```

在 `src/features/pinyin-blocks/index.ts` 的 `./LevelEntry` 那一组旁边补:

```ts
export { LevelRun } from './LevelRun'
export { PinyinBlocksGame, type PinyinBlocksGameProps, type SectionResult } from './PinyinBlocksGame'
```

(若 `PinyinBlocksGame` 已经在导出列表里,把 `PinyinBlocksGameProps` / `SectionResult` 两个类型加进那一行,别写成两行。)

- [ ] **Step 4: 跑测试确认它通过**

Run: `npm test`
Expected: PASS(全量)。

> 若 `solveLevel()` 在「困难段拼对 → settle」之后卡在过场 A/B 上,是 `settle` 那个 `await` 的微任务没在同一个 `act` 里排干 —— 在 `transition()` 之前补一句 `await act(async () => {})`。**不要**把 `settle()` 的时间从 3000 调小,那会碰到成功动画(1600 / 2100ms)的时序。

- [ ] **Step 5: 提交**

```bash
git add src/features/pinyin-blocks/LevelRun.tsx src/features/pinyin-blocks/LevelEntry.tsx src/features/pinyin-blocks/LevelEntry.test.tsx src/features/pinyin-blocks/index.ts
git commit -m "feat(pinyin-blocks): 一关三段相位机,星在复习段之前落库"
```

---

### Task 10: 文档同步

**Files:**
- Modify: `docs/walkthrough.md`(§B 核心回归 / §C 的对应条目)
- Modify: `CLAUDE.md`(玩法那一段)
- Modify: `docs/dev-reference.md`(玩法 / 模块清单)
- Modify: `docs/PLAN.md`(本行状态)
- Modify: `docs/superpowers/specs/2026-09-27-pinyin-blocks-difficulty-design.md`(§3.0 表格里的一处笔误)

**Interfaces:**
- Consumes: 前九个任务的全部产物
- Produces: 发布闸门①的条目

- [ ] **Step 1: 修 spec 的一处自相矛盾**

spec §3.0 的表格里,复习段的「提示档」写的是「恒弱档(`hintFor(unit.id, 0, true)`)」,而 §3.8 与视觉稿(full-flow.html)写的都是**中档约 40% 虚线边**。实现按 §3.8 走(复习不是最难,别把脚手架撤光)。把 §3.0 那一格改成:

```markdown
| **提示档** | `hintFor(unit.id, missCount, level.review)` 现状 | **不适用** —— 槽恒亮,不吃档位变量(§3.8) | 恒中档(`pslots--mid` 写死,不走 `hintFor`) |
```

- [ ] **Step 2: 改 `CLAUDE.md` 的玩法描述**

把「每关给一张图 + 一个(或两个)音节,孩子从积木盘里挑出正确的声母/介母/韵母/鼻音块拼进凹槽、再给韵腹盖上声调块;放错累计 `miss`,一关 0 次错 = 3 星、≤2 次 = 2 星、其余 = 1 星(1 星即通关,不会「失败」)。」这一段换成(保持原文风格):

```markdown
每关给一张图 + 一个(或两个)音节,**分三段走**:简单段(现有玩法,门禁 `canPlace`,没有失败路径)→ 困难段(门禁只比**类型**,值可以错;填满即判,指出错误槽并撤块重试,**每关 2 次**,用尽则演示正解、本段记失败但**不阻塞**)→ 复习段(把这一段里孩子点错过的块挖空重考,门禁同简单段,不记 miss)。三段共用同一张图与音节,靠**台阶条 + 托盘材质 + 换段过场**区分(游戏区零可见文字)。全关 0 次错 = 3 星、≤2 次 = 2 星、其余 = 1 星(1 星即通关,不会「失败」);星在困难段结束时就落库,复习段做得再差也不掉星。
```

- [ ] **Step 3: 改 `docs/dev-reference.md`**

在玩法/模块清单那一节:① 把单段玩法描述按上面同样口径改成三段;② 模块清单里加上 `LevelRun.tsx`(相位机)、`mistakes.ts`(错题池与复习小题的纯逻辑)、`StageBar.tsx` / `StageTransition.tsx`(段标与过场);③ 在「发音约定」附近补一句:`SPEAK_OF.tone` 是空表(声调没有可念的音),所以复习小题复用**图 + 音节**,不做「听音选块」。

- [ ] **Step 4: 改 `docs/walkthrough.md`**

§B 核心回归 / §C 里追加(条目写法照抄该文件既有条目的格式与编号风格),至少覆盖:

- 台阶条三段各自的形态(1 格 / 2 格 / 2 格橙 + 1 格灰蓝),以及它与连击圆点在同一屏上不混;
- 过场 A(进困难)与过场 B(进复习)各一次:暗遮罩 + 放大的台阶条,约 1.2s;开**减动效**后两者都退化成静态帧,仍能看出是哪一段;
- 困难段:盘面压暗 + 橙环、槽是**实线**且类型色恒亮 —— 特意在 **u9–u12 的弱档单元**各走一关(那里的槽类型色本来是 0%,困难段必须仍看得见);
- 困难段:托盘每类至少两块(与简单段同一关对比,块数明显更多);
- 困难段:填满后判错 → 错槽红描边抖动 → 720ms 后撤块回托盘 → 重试;
- 困难段:连错 2 次后第 3 次判错 → 自动演示正解 → 答案行亮起 → 进复习段;星级此时已是 1 星但**照常通关**;
- 复习段:预填槽点不动(挖空的那几个槽之外都不能操作);
- 复习段:小题进度点(1~3 颗,做完一道亮一颗;池空时只有一颗);
- 复习段:放错只抖、不记 miss、连击圆点不动;
- 复习段中途按「回地图」→ 回地图后那一关的星**已经**亮;
- 单音节 u1 与双音节三拼(xī guā)各走一关(托盘最小与最大的两头)。
- **复核**「答错不落位」相关的既有条目:简单段与复习段仍然是弹回(符合),困难段是**落位后判错**,措辞要分开。

- [ ] **Step 5: 改 `docs/PLAN.md`**

把「拼音积木难度改造」那一行从想法池挪到当前迭代 P0,状态改成「实现中(计划:`docs/superpowers/plans/2026-09-28-pinyin-blocks-three-stages.md`)」;并在该行注明与「奖励层『归属动作』重做」期 2 的**串行红线**(期 2 先落,本行随后 —— 裁定 E1)。

- [ ] **Step 6: 跑全量并提交**

Run: `npm test && npm run lint`
Expected: 全绿。

```bash
git add CLAUDE.md docs/walkthrough.md docs/dev-reference.md docs/PLAN.md docs/superpowers/specs/2026-09-27-pinyin-blocks-difficulty-design.md
git commit -m "docs: 一关三段的走查条目 / 玩法描述 / 模块清单同步"
```

---

## 收尾检查(全部任务完成后)

- [ ] `npm test` 全绿、`npm run lint` 干净。
- [ ] 手工走一遍 Task 10 的走查清单(jsdom 判不了像素、手势与动画 —— 那份清单是唯一闸门)。
- [ ] 确认**没有**碰后端:`git diff --stat` 里不出现 `worker/`、`migrations/`、`local-store.ts`、`pinyin-progress/` 的任何文件。
- [ ] 确认 `canPlace` / `starsFor` / `autoTargetId` 的**函数体**没被改动(`git diff src/features/pinyin-blocks/rules.ts` 里那三个函数应当只有注释变化或零变化)。
- [ ] 分支与提交:本行是 M 级(1~2 天)且开发期允许直 commit 到 `main`;**发版**按 `/release` 走,tag 只在部署成功 + 浏览器冒烟通过后打。
