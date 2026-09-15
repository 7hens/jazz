# 题面糖果材质 + 爽感层 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把做题界面的词石从「白底圆角矩形」换成有厚度、有材质、答对会迸星的糖果厚块,并给连连看补上「配对 = 炼金」的状态表达。

**Architecture:** 材质全部写成 `src/index.css` 里**不带 `@layer` 的普通类**(`.stone` / `.stone--<态>` / `.stone-halo` / `.quiz-*`),布局仍走 Tailwind 工具类;新增 `Stone.tsx` 作为词石的**唯一渲染点**,`Choice` / `ListenChoice` / `MatchGame` 全部改为消费它。分档(哪个面拿哪些能力)落在**消费点是否渲染对应组件 / 是否传 `quiet`**,不在组件内部做开关。

**Tech Stack:** React 19 + TypeScript + Tailwind 4 + `motion/react` + lucide-react;vitest + @testing-library/react(jsdom)。

**Spec:** `docs/superpowers/specs/2026-09-15-quiz-candy-juice-design.md`

## Global Constraints

以下每一条对**每个任务**都成立,不再逐任务重复:

- **零动红线**:`question-engine` / `progress` / 判分语义 / `speech` / `Question` 数据形状 / `AudioCue` **一律不动**。本计划只改视觉壳与反馈层。
- **不引入任何新依赖**,不新增 service 调用,`useService()` 取用纪律不变。
- **材质类只写进 `src/index.css`,且不写进 `@layer`**(非分层样式优先级高于 `@layer utilities`,才能压过 Tailwind 工具类 —— 既有 `.stage-sky--*` 即此法)。
- **材质类一律用 `var(--color-*)` 与 `color-mix(in srgb, var(--color-x) p%, var(--color-surface))`,禁止裸 hex。** 白色高光/半透明白沿用仓库既有写法 `rgb(255 255 255 / 0.9)`。
- **禁写 `dark:` 前缀**:暗色模式靠 `index.css:103` 的 token 覆盖自动接管。
- **禁在 `stone.ts` 里写 Tailwind 任意值颜色类**(上一轮实测:抽成 helper 后产物规则数归零,而 `npm test` 与 `npm run lint` 全绿,只有 `npm run build` + 查产物 CSS 才暴露)。
- **任何新增的装饰节点必须 `aria-hidden`**(`aria-hidden` 写成布尔简写 `aria-hidden`,与仓库既有写法一致)。测试全部靠 accessible name 定位选项(`getByRole('button', { name: '太阳' })`),漏标即大面积崩。
- **新动效一律走 `motion`**(`src/app/App.tsx:249` 的 `MotionConfig reducedMotion="user"` 自动继承),**禁写裸 CSS `animation`**。CSS `transition` 可用(全局 reduced-motion 已把它压到 0.01ms)。
- **文字缩放**:石头高度用 `min-h` + `padding`,**禁固定 `height`**;不设 `overflow: hidden` 截字。
- **属性顺序**:错误使用 `if (a) return b` 之外,一律沿用仓库既有的 `type="button"` / `aria-*` / `data-*` / `onClick` 顺序,减少无谓 diff。
- **UI 文案中文**。
- **闸门**:每个任务结束时 `npm test` 全绿(**基线 68 文件 / 434 测试**)、`npm run lint` 0 error、**`npm run build` 成功**。

> `npm run build` 必须进闸门的原因(**预检实测**,与 Tailwind 扫描器同类):`tsconfig.app.json` 开了 `noUnusedLocals`,而 **`npm test`(vitest 不做类型检查)与 `npm run lint`(oxlint 的 `no-unused-vars` 只是 warning,退出码 0)都不会报未用 import** —— 删组件时漏删一个 import,两道闸门都绿,只有 `tsc -b` 会炸。它顺带也覆盖了「材质类没进产物」这个本计划最怕的失守。
- **导入大小写**:`./stone`(纯函数表)与 `./Stone`(组件)是两个不同文件,导入路径必须逐字写对;Linux 区分大小写,macOS 不区分 —— 本地过而别人机器炸的坑。

---

## 文件结构

**新建**

| 文件 | 职责 |
| --- | --- |
| `src/shared/ui/quiz/Stone.tsx` | 词石唯一渲染点:状态 → 材质类 + 晕托 + 角标 + children 插槽 |
| `src/shared/ui/quiz/SparkBurst.tsx` | 答对迸星,4 个 emoji 粒子,≤550ms,整体 `aria-hidden` |
| `src/shared/ui/quiz/ProgressCrystals.tsx` | 水晶进度条,替代 3 处重复的圆点行 |
| `src/features/lesson/LessonAmbience.tsx` | 词课景深层(天顶柔光 / 远云 / 题区落影),纯装饰 |
| 对应 `.test.tsx` / `.test.ts` | 见各任务 |

**修改**:`src/index.css`、`src/shared/ui/quiz/stone.ts`、`stone.test.ts`、`Choice.tsx`、`Choice.test.tsx`、`ListenChoice.tsx`、`ListenChoice.test.tsx`、`MatchGame.tsx`、`MatchGame.test.tsx`、`src/features/lesson/WordLesson.tsx`、`WordLesson.test.tsx`、`LessonEntry.tsx`、`src/features/foundation/TeachOverlay.tsx`、`ColdStartWizard.tsx`、`docs/design/game-visual.md`。

**零改**:`src/features/qianzigu/scene-ui.tsx` —— 它只消费 `Choice` / `ListenChoice` / `MatchGame`,改进随组件自动下发。

---

### Task 1: 材质地基(CSS 材质类 + 七态状态表)

纯 CSS + 纯函数,可独立回滚。做完之后 `Choice` / `MatchGame` 的观感**立刻改变**(它们开始输出 `stone stone--<态>`),但 DOM 结构与 accessible name 不变,测试改断言值即可。

**Files:**
- Modify: `src/index.css`(在 `@theme` 内加 5 个 gold token;在文件末尾加材质类)
- Modify: `src/shared/ui/quiz/stone.ts`
- Test: `src/shared/ui/quiz/stone.test.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `type StoneState = 'idle' | 'selected' | 'correct' | 'wrong' | 'muted' | 'gold' | 'slot'`
  - `STONE_LIFT: number`(= -4)
  - `stoneClass(state: StoneState, index?: number): string`
  - `stoneOffset(index: number): string`
  - `stoneMark(state: StoneState): '✓' | '✗' | '⭐' | null`
  - `stoneMarkClass(state: StoneState): string`
  - CSS 普通类:`.stone`、`.stone--idle|selected|correct|wrong|muted|gold|slot`、`.stone-halo`、`.stone-sub`、`.quiz-beam`
  - CSS token:`--color-gold` `#ffc23d`、`--color-gold-2` `#ffeaa8`、`--color-gold-edge` `#c98a00`、`--color-gold-ink` `#4a2e00`、`--color-gold-ink-2` `#6b4300`

- [ ] **Step 1: 写失败的测试**

把 `src/shared/ui/quiz/stone.test.ts` 整个替换为:

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { stoneClass, stoneMark, stoneMarkClass, stoneOffset } from './stone'

/** 直接读源文件,不用 `import css from '@/index.css?raw'` —— 实测(@tailwindcss/vite 在场)
 *  那条路返回**空字符串**:模块能解析、断言却恒假,是个沉默的假绿陷阱。 */
const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')

const ALL_STATES = ['idle', 'selected', 'correct', 'wrong', 'muted', 'gold', 'slot'] as const

describe('stone 词石纯函数', () => {
  it('对错/炼成各给形状冗余角标(色彩冗余:红绿之外给形状)', () => {
    expect(stoneMark('correct')).toBe('✓')
    expect(stoneMark('wrong')).toBe('✗')
    expect(stoneMark('gold')).toBe('⭐')
  })

  it('无冗余态不挂角标', () => {
    expect(stoneMark('idle')).toBeNull()
    expect(stoneMark('selected')).toBeNull()
    expect(stoneMark('muted')).toBeNull()
    expect(stoneMark('slot')).toBeNull()
  })

  it('角标底色随状态取 token', () => {
    expect(stoneMarkClass('correct')).toContain('bg-emerald')
    expect(stoneMarkClass('wrong')).toContain('bg-red')
    expect(stoneMarkClass('gold')).toContain('bg-gold')
    expect(stoneMarkClass('idle')).toBe('')
  })

  it('七态各自落到普通类 .stone--<态>', () => {
    for (const s of ALL_STATES) {
      expect(stoneClass(s)).toContain('stone')
      expect(stoneClass(s)).toContain(`stone--${s}`)
    }
  })

  it('状态类里不出现透明度工具类(不靠透明度压暗文字)', () => {
    for (const s of ALL_STATES) {
      expect(stoneClass(s)).not.toMatch(/\bopacity-/)
    }
  })

  it('错落:奇数列下移,偶数列不偏移', () => {
    expect(stoneOffset(1)).toContain('translate-y')
    expect(stoneOffset(0)).toBe('')
    expect(stoneOffset(2)).toBe('')
  })

  it('两列圆角半径不同,破等距方阵感', () => {
    expect(stoneClass('idle', 0)).not.toBe(stoneClass('idle', 1))
  })
})

// 材质类失守时 npm test 与 npm run lint 都是绿的,只有 npm run build 才暴露 —— 这组断言把
// 那个「只有构建能发现」的失败提前到测试里(spec §4.2 理由 1 的实测教训)。
describe('index.css 材质类存在性', () => {
  it('七个状态材质类都在产物源里', () => {
    for (const s of ALL_STATES) {
      expect(css).toContain(`.stone--${s}`)
    }
  })

  it('金石拼音行用实色 token,不用 opacity 压暗(4.01:1 会破 4.5:1 下限)', () => {
    const start = css.indexOf('.stone--gold {')
    expect(start).toBeGreaterThan(-1)
    const rule = css.slice(start, css.indexOf('}', start))
    expect(rule).not.toMatch(/opacity:/)
    expect(css).toContain('--color-gold-ink-2')
  })

  it('材质类不写裸 hex', () => {
    const start = css.indexOf('/* ===== 题面糖果材质')
    const block = css.slice(start)
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/shared/ui/quiz/stone.test.ts`
Expected: FAIL —— `stoneMark('gold')` 返回 `null`(收到 `undefined` 的断言失败)、`stoneClass('idle')` 不含 `stone--idle`、`css.indexOf('.stone--gold {')` 为 -1。

- [ ] **Step 3: 在 `index.css` 的 `@theme` 块里加 5 个金色 token**

在 `src/index.css` 的 `@theme { ... }` 中,`--color-red-tint` 那一行之后插入(注意:**不要**放进 `@media (prefers-color-scheme: dark)` 块 —— 金色是「炼成物」,三主题下恒定,与答对/答错语义色同理):

```css
  /* 金石(连连看炼成物):三主题恒定,故不进暗色覆盖块 */
  --color-gold: #ffc23d; /* 金石面(渐变深处) */
  --color-gold-2: #ffeaa8; /* 金石面(渐变亮处) */
  --color-gold-edge: #c98a00; /* 金石厚度底边 */
  --color-gold-ink: #4a2e00; /* 金石主行文字 —— 压 #ffc23d 实测 7.75:1 */
  --color-gold-ink-2: #6b4300; /* 金石拼音行   —— 压 #ffc23d 实测 5.37:1 */
```

- [ ] **Step 4: 在 `index.css` 文件末尾追加材质类**

追加在文件最后一行之后(即 `.stage-world--half` 之后):

```css
/* ===== 题面糖果材质(spec: 2026-09-15-quiz-candy-juice-design §5)=====
 * 为什么是「不带 @layer 的普通类」:非分层样式优先级高于 @layer utilities,才能压过 Tailwind
 * 任意值类;且完全绕开 v4 扫描器(上一轮把 color-mix 任意值抽成 helper 后,产物里规则数归零,
 * 而 npm test 与 npm run lint 全绿 —— 只有 npm run build 能发现)。
 * 为什么全部走 token + color-mix:暗色模式由 index.css 的 token 覆盖自动接管,无需 dark: 类。
 * 硬约束:本段禁止裸 hex;白色高光/半透明白沿用仓库既有写法 rgb(255 255 255 / x)。 */
.stone {
  position: relative;
  isolation: isolate; /* 让子元素 z-index:-1 的光柱/晕托稳定落在石面之上、文字之下 */
  border-style: solid;
  border-width: 2px;
  color: var(--color-ink);
  background-image: linear-gradient(180deg, var(--color-surface), var(--color-surface-2));
  /* 第三层 = 厚度(实心底边);第四层 = 内侧上缘高光;第二层 = 落影 */
  box-shadow:
    0 6px 0 var(--color-surface-3),
    0 12px 18px -12px rgb(31 58 95 / 0.35),
    inset 0 2px 0 rgb(255 255 255 / 0.9);
}

.stone--idle {
  border-color: var(--color-hairline);
}
.stone--idle:hover {
  border-color: color-mix(in srgb, var(--color-accent) 60%, var(--color-hairline));
}

.stone--selected {
  border-color: var(--color-accent);
  background-image: linear-gradient(
    180deg,
    color-mix(in srgb, var(--color-accent) 22%, var(--color-surface)),
    color-mix(in srgb, var(--color-accent) 14%, var(--color-surface))
  );
  box-shadow:
    0 6px 0 color-mix(in srgb, var(--color-accent) 55%, var(--color-surface-3)),
    0 0 0 3px color-mix(in srgb, var(--color-accent) 38%, transparent),
    0 14px 26px -12px color-mix(in srgb, var(--color-accent) 72%, transparent),
    inset 0 2px 0 rgb(255 255 255 / 0.9);
}

/* 三态中唯一发光者 —— 「对了」必须比「错了」更耀眼 */
.stone--correct {
  border-color: color-mix(in srgb, var(--color-emerald) 70%, var(--color-surface));
  background-image: linear-gradient(
    180deg,
    color-mix(in srgb, var(--color-emerald) 18%, var(--color-surface)),
    color-mix(in srgb, var(--color-emerald) 10%, var(--color-surface))
  );
  box-shadow:
    0 6px 0 color-mix(in srgb, var(--color-emerald) 55%, var(--color-surface-3)),
    0 0 0 3px color-mix(in srgb, var(--color-emerald) 34%, transparent),
    0 14px 30px -10px color-mix(in srgb, var(--color-emerald) 75%, transparent),
    inset 0 2px 0 rgb(255 255 255 / 0.9);
}

/* 答错不发光:不让「错了」比「对了」更耀眼 */
.stone--wrong {
  border-color: var(--color-red);
  background-image: linear-gradient(
    180deg,
    color-mix(in srgb, var(--color-red) 18%, var(--color-surface)),
    color-mix(in srgb, var(--color-red) 12%, var(--color-surface))
  );
  box-shadow:
    0 6px 0 color-mix(in srgb, var(--color-red) 45%, var(--color-surface-3)),
    inset 0 2px 0 rgb(255 255 255 / 0.9);
}

.stone--muted {
  border-color: var(--color-hairline);
  color: var(--color-ink-2);
  background-image: linear-gradient(180deg, var(--color-surface-2), var(--color-surface-2));
  box-shadow: 0 4px 0 color-mix(in srgb, var(--color-surface-3) 70%, var(--color-surface-2));
}

/* 金石 = 炼成物。金字色恒定(三主题同色),故这里用固定 token 而非 color-mix 进 surface。 */
.stone--gold {
  border-color: color-mix(in srgb, var(--color-gold-edge) 75%, var(--color-gold));
  color: var(--color-gold-ink);
  background-image: linear-gradient(180deg, var(--color-gold-2), var(--color-gold));
  box-shadow:
    0 6px 0 var(--color-gold-edge),
    0 14px 24px -12px color-mix(in srgb, var(--color-gold) 80%, transparent),
    inset 0 2px 0 rgb(255 255 255 / 0.9);
}

/* 凹槽 = 被熔走后的空位。虚线 + 内凹阴影是**非颜色**的形状冗余。 */
.stone--slot {
  border-style: dashed;
  border-color: color-mix(in srgb, var(--color-ink) 18%, transparent);
  background-image: none;
  background-color: color-mix(in srgb, var(--color-ink) 7%, transparent);
  box-shadow: inset 0 3px 7px color-mix(in srgb, var(--color-ink) 20%, transparent);
}

/* 金石第二行(拼音)。实色 token,禁止用 opacity 调弱 —— #4a2e00 @72% 压 #ffc23d 实测仅 4.01:1。 */
.stone-sub {
  color: var(--color-gold-ink-2);
}

/* 柔光晕托:emoji 是彩色位图不吃 color,橙底撞 🌙⭐🔥、绿底撞 🍏🥒、红底撞 🍎🍓。
 * 白色径向柔光把 emoji 可读性与底色彻底解耦。宽度随 em 缩放 → 跟着 2× 缩放走。 */
.stone-halo {
  position: relative;
  isolation: isolate;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.stone-halo::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 2.1em;
  height: 2.1em;
  transform: translate(-50%, -50%);
  border-radius: 999px;
  z-index: -1;
  background: radial-gradient(
    circle,
    rgb(255 255 255 / 0.95) 0%,
    rgb(255 255 255 / 0.72) 46%,
    rgb(255 255 255 / 0) 74%
  );
}

/* 答对光柱:从石底往上打的柔和绿光。静态渐变,不受 reduced-motion 影响(不塌)。 */
.quiz-beam {
  position: absolute;
  left: 50%;
  bottom: -16%;
  width: 78%;
  height: 132%;
  transform: translateX(-50%);
  z-index: -1;
  pointer-events: none;
  border-radius: 999px;
  background: radial-gradient(
    ellipse at 50% 100%,
    color-mix(in srgb, var(--color-emerald) 55%, transparent) 0%,
    transparent 72%
  );
}
```

- [ ] **Step 5: 改写 `stone.ts`**

把 `src/shared/ui/quiz/stone.ts` 整个替换为:

```ts
import { cn } from '@/shared/ui/utils'

/** 词石状态。reveal(双错后亮出正确答案)与 correct 同形 —— 视觉上都表示「这块是对的」。 */
export type StoneState = 'idle' | 'selected' | 'correct' | 'wrong' | 'muted' | 'gold' | 'slot'

/** 布局/间距走 Tailwind 工具类(字面量,扫描器认);材质走 index.css 的 .stone--<态> 普通类。
 *  间距 10px / min-h 92px 见 spec D7;禁固定 height → 2× 文字缩放不截字。 */
const STONE_BASE =
  'relative flex min-h-[92px] flex-col items-center justify-center gap-2.5 px-3 py-3 text-center transition-colors'

/** 选中/答对的上浮位移(px)。只能经 motion 的 `animate={{ y }}` 用 —— 裸 Tailwind `translate-y-*`
 *  会(1)逃逸 App 的 MotionConfig reducedMotion 兜底,(2)在 cn()/tailwind-merge 里与 stoneOffset 互吞。 */
export const STONE_LIFT = -4

/* ⚠ 材质**不进这里**。上一轮把 color-mix 任意值写在此处,产物规则数与 helper 抽法有关、极易归零,
 *  而 npm test 与 npm run lint 全绿 —— 只有 npm run build 查产物 CSS 才暴露。
 *  现在这里只拼「普通类名」,颜色/厚度/发光全部在 index.css,由 token 覆盖接管暗色模式。
 *  七态各写一条字面量(不拼模板字符串):读起来即状态表,与 CSS 段一一对应。 */
const STONE_MATERIAL: Record<StoneState, string> = {
  idle: 'stone stone--idle',
  selected: 'stone stone--selected',
  correct: 'stone stone--correct',
  wrong: 'stone stone--wrong',
  muted: 'stone stone--muted',
  gold: 'stone stone--gold',
  slot: 'stone stone--slot',
}

/** 两列不同圆角半径:同一词石在左右两列外形不同,破「等距方阵」的答题卡感。 */
const STONE_SHAPE = ['rounded-3xl', 'rounded-[1.75rem] rounded-tr-md'] as const

export function stoneClass(state: StoneState, index = 0): string {
  return cn(STONE_BASE, STONE_SHAPE[index % STONE_SHAPE.length], STONE_MATERIAL[state])
}

/** 错落:奇数列整体下移,破坏逐行等距。 */
export function stoneOffset(index: number): string {
  return index % 2 === 1 ? 'translate-y-1.5' : ''
}

/** 色彩冗余:对错/炼成在红绿之外再给形状(约 8% 男性红绿色盲看不出红=错)。无冗余态返回 null。 */
export function stoneMark(state: StoneState): '✓' | '✗' | '⭐' | null {
  if (state === 'correct') return '✓'
  if (state === 'wrong') return '✗'
  if (state === 'gold') return '⭐'
  return null
}

export function stoneMarkClass(state: StoneState): string {
  if (state === 'correct') return 'bg-emerald text-white'
  if (state === 'wrong') return 'bg-red text-white'
  if (state === 'gold') return 'bg-gold text-gold-ink'
  return ''
}
```

- [ ] **Step 6: 跑测试确认通过**

Run: `npx vitest run src/shared/ui/quiz/stone.test.ts`
Expected: PASS(9 个用例)。

- [ ] **Step 7: 跑全量测试 + lint**

Run: `npm test && npm run lint`
Expected: 全绿。`Choice.test.tsx` 的 `data-state` / `toHaveTextContent('✓')` / `not.toMatch(/\bopacity-/)` 断言不依赖已被移走的颜色类,应原样通过。

- [ ] **Step 8: 提交**

```bash
git add src/index.css src/shared/ui/quiz/stone.ts src/shared/ui/quiz/stone.test.ts
git commit -m "feat(quiz): 词石糖果材质地基 —— index.css 普通类 + 七态状态表"
```

---

### Task 2: 抽件(等价重构,零观感变化)

新增 `Stone.tsx` / `SparkBurst.tsx`,`Choice` / `ListenChoice` / `MatchGame` 改为消费 `Stone`。**此步不引入任何新观感** —— `SparkBurst` 只建文件与测试,尚无人渲染它。意图是让 `npm test` 在纯结构改动下全绿,证明重构没有夹带行为变更。

**Files:**
- Create: `src/shared/ui/quiz/Stone.tsx`, `src/shared/ui/quiz/Stone.test.tsx`
- Create: `src/shared/ui/quiz/SparkBurst.tsx`, `src/shared/ui/quiz/SparkBurst.test.tsx`
- Modify: `src/shared/ui/quiz/Choice.tsx`、`ListenChoice.tsx`、`MatchGame.tsx`

**Interfaces:**
- Consumes: Task 1 的 `StoneState` / `stoneClass` / `stoneOffset` / `stoneMark` / `stoneMarkClass` / `STONE_LIFT`;`.stone-halo` 类
- Produces:
  - `Stone(props: StoneProps)` —— `StoneProps = { state: StoneState; index?: number; text?: string; subText?: string; emoji?: string; horizontal?: boolean; disabled?: boolean; pressed?: boolean; shake?: boolean; onClick?: () => void; className?: string; children?: ReactNode }`
  - `SparkBurst()` —— 无 props;根节点带 `data-spark-burst` + `aria-hidden`,粒子节点带 `data-spark`

- [ ] **Step 1: 写失败的测试 —— `Stone.test.tsx`**

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Stone } from './Stone'

describe('Stone 词石唯一渲染点', () => {
  afterEach(cleanup)

  it('state 落到 data-state,供色彩冗余断言定位', () => {
    const { container } = render(<Stone state="wrong" text="B" />)
    expect(container.querySelector('button')).toHaveAttribute('data-state', 'wrong')
  })

  it('对错挂形状角标,且角标 aria-hidden 不影响 accessible name', () => {
    render(<Stone state="correct" text="A" />)
    const btn = screen.getByRole('button', { name: 'A' })
    expect(btn).toHaveTextContent('✓')
  })

  it('emoji 走柔光晕托节点,且不进入 accessible name', () => {
    const { container } = render(<Stone state="idle" emoji="🍎" text="苹果" />)
    const btn = screen.getByRole('button', { name: '苹果' })
    expect(btn.querySelector('[data-halo]')).not.toBeNull()
    expect(container.querySelector('[data-halo]')).toHaveAttribute('aria-hidden', 'true')
  })

  it('gold 态渲染两行文本(词 + 拼音)并挂 ⭐', () => {
    const { container } = render(<Stone state="gold" text="苹果" subText="píng guǒ" />)
    const btn = container.querySelector('button')!
    expect(btn).toHaveAttribute('data-state', 'gold')
    expect(btn).toHaveTextContent('⭐')
    expect(btn).toHaveTextContent('苹果')
    expect(btn).toHaveTextContent('píng guǒ')
  })

  it('slot 态不渲染任何文本(信息已并入金石)', () => {
    const { container } = render(<Stone state="slot" />)
    expect(container.querySelector('button')!.textContent).toBe('')
  })

  it('点卡回调与 pressed 透传', () => {
    const onClick = vi.fn()
    render(<Stone state="idle" text="A" pressed onClick={onClick} />)
    const btn = screen.getByRole('button', { name: 'A' })
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('children 渲染在按钮内部(迸星/光柱插槽)', () => {
    render(
      <Stone state="correct" text="A">
        <span data-probe>burst</span>
      </Stone>,
    )
    expect(screen.getByRole('button', { name: 'A' }).querySelector('[data-probe]')).not.toBeNull()
  })

  it('水平模式用于连连看,不禁用时不带 active 缩放类以外的交互类', () => {
    const { container } = render(<Stone state="idle" text="太阳" horizontal disabled />)
    expect(container.querySelector('button')).toHaveAttribute('aria-disabled', 'true')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/shared/ui/quiz/Stone.test.tsx`
Expected: FAIL —— `Failed to resolve import "./Stone"`。

- [ ] **Step 3: 写 `Stone.tsx`**

```tsx
import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/shared/ui/utils'
import { STONE_LIFT, stoneClass, stoneMark, stoneMarkClass, stoneOffset, type StoneState } from './stone'

export type StoneProps = {
  state: StoneState
  /** 造型序号:0 / 1 两套圆角(见 stone.ts STONE_SHAPE)。默认 0。 */
  index?: number
  /** 石面主行文字 */
  text?: string
  /** 石面第二行小字 —— 仅 gold 态(炼成后 词 / 拼音 两行) */
  subText?: string
  emoji?: string
  /** 横排(连连看)vs 竖排(选一选)。默认竖排。 */
  horizontal?: boolean
  disabled?: boolean
  pressed?: boolean
  /** 抖动(错配)。上浮由 state 自动决定,不由此控制。 */
  shake?: boolean
  onClick?: () => void
  className?: string
  /** 插槽:迸星 / 光柱等装饰由消费方决定要不要装(分档落在消费点,不在组件内做开关)。 */
  children?: ReactNode
}

/** 词石的**唯一渲染点**。布局走 Tailwind,材质走 index.css 的 .stone--<态>(见 stone.ts 注)。
 *  任何新增装饰节点都必须 aria-hidden —— 测试靠 accessible name 定位选项。 */
export function Stone({
  state,
  index = 0,
  text,
  subText,
  emoji,
  horizontal = false,
  disabled = false,
  pressed,
  shake = false,
  onClick,
  className,
  children,
}: StoneProps) {
  const mark = stoneMark(state)
  const lifts = state === 'selected' || state === 'correct'
  return (
    <motion.button
      type="button"
      aria-disabled={disabled}
      aria-pressed={pressed}
      data-state={state}
      onClick={onClick}
      animate={shake ? { x: [0, -9, 9, -6, 6, 0], y: 0 } : { x: 0, y: lifts ? STONE_LIFT : 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={cn(
        stoneClass(state, index),
        horizontal ? 'gap-2 flex-row min-h-[64px]' : stoneOffset(index),
        !disabled && 'cursor-pointer active:scale-[0.96]',
        className,
      )}
    >
      {children}
      {emoji ? (
        <span aria-hidden data-halo className={cn('stone-halo leading-none', horizontal ? 'text-2xl' : 'text-3xl')}>
          {emoji}
        </span>
      ) : null}
      {subText ? (
        <span className="flex flex-col leading-tight">
          <span className={cn('font-bold', emoji ? 'text-[15px]' : 'text-xl')}>{text}</span>
          <span className="stone-sub text-base font-bold">{subText}</span>
        </span>
      ) : text ? (
        <span className={cn('font-bold leading-tight', emoji ? 'text-[15px]' : 'text-xl')}>{text}</span>
      ) : null}
      {mark ? (
        <span
          aria-hidden
          className={cn(
            'absolute -right-1.5 -top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold shadow-card',
            stoneMarkClass(state),
          )}
        >
          {mark}
        </span>
      ) : null}
    </motion.button>
  )
}
```

> `gap-2 flex-row min-h-[64px]` 里的 `gap-2` / `min-h-[64px]` 会在 `cn()` 的 tailwind-merge 里覆盖 `STONE_BASE` 的 `gap-2.5` / `min-h-[92px]` —— 这正是连连看横排要的紧凑尺寸,**不是 bug**。

- [ ] **Step 4: 跑 Stone 测试确认通过**

Run: `npx vitest run src/shared/ui/quiz/Stone.test.tsx`
Expected: PASS(8 个用例)。

- [ ] **Step 5: 写失败的测试 —— `SparkBurst.test.tsx`**

```tsx
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { SparkBurst } from './SparkBurst'

describe('SparkBurst 答对迸星', () => {
  afterEach(cleanup)

  it('粒子数 ≤5 且整块 aria-hidden(不得改变宿主按钮的 accessible name)', () => {
    const { container } = render(<SparkBurst />)
    const wrap = container.querySelector('[data-spark-burst]')
    expect(wrap).not.toBeNull()
    expect(wrap).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelectorAll('[data-spark]').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('[data-spark]').length).toBeLessThanOrEqual(5)
  })
})
```

- [ ] **Step 6: 跑测试确认失败**

Run: `npx vitest run src/shared/ui/quiz/SparkBurst.test.tsx`
Expected: FAIL —— `Failed to resolve import "./SparkBurst"`。

- [ ] **Step 7: 写 `SparkBurst.tsx`**

```tsx
import { motion } from 'motion/react'

/** 4 个粒子的固定轨迹(px)。数量 ≤5、存活 ≤550ms —— 见 spec §5「克制约束」。 */
const SPARKS = [
  { emoji: '✨', x: -30, y: -34 },
  { emoji: '⭐', x: 30, y: -30 },
  { emoji: '✨', x: -14, y: 26 },
  { emoji: '🌟', x: 18, y: 28 },
] as const

/** 答对迸星。纯装饰:整块 aria-hidden,绝不进入宿主按钮的 accessible name(spec §9.1)。
 *  动效走 motion → 自动继承 App 的 MotionConfig reducedMotion="user"。 */
export function SparkBurst() {
  return (
    <span aria-hidden data-spark-burst className="quiz-burst">
      {SPARKS.map((s, i) => (
        <motion.span
          key={i}
          data-spark
          className="quiz-spark"
          initial={{ opacity: 0, scale: 0.4, x: 0, y: 0 }}
          animate={{ opacity: [0, 1, 0], scale: [0.4, 1.1, 0.85], x: s.x, y: s.y }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
        >
          {s.emoji}
        </motion.span>
      ))}
    </span>
  )
}
```

- [ ] **Step 8: 在 `index.css` 追加迸星的定位类**

追加在 `.quiz-beam` 之后:

```css
/* 迸星容器:铺满词石,粒子以中心为原点向外飞 */
.quiz-burst {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
}
.quiz-spark {
  position: absolute;
  left: 50%;
  top: 50%;
  translate: -50% -50%; /* 独立 translate 属性,motion 写的 transform 叠加其上不冲突 */
  font-size: 1.05em;
  line-height: 1;
}
```

- [ ] **Step 9: `Choice.tsx` 改为消费 `Stone`**

把 `src/shared/ui/quiz/Choice.tsx` 的 import 行(第 9 行)与渲染块(第 86–124 行)改掉:

import 行改为:

```tsx
import { Stone } from './Stone'
import type { StoneState } from './stone'
```

`options.map(...)` 的返回改为:

```tsx
          return (
            <Stone
              key={o.id}
              state={state}
              index={i}
              emoji={o.emoji}
              text={o.text}
              pressed={selected === o.id}
              disabled={disabled}
              shake={wrongId === o.id}
              onClick={() => handleCard(o)}
            />
          )
```

> `Stone` 已内联 `motion.button`、角标、emoji、文本 —— `Choice.tsx` 不再需要 `motion` / `cn` / `stoneMark*` / `STONE_LIFT` / `stoneOffset` 的 import。**同步删掉这些已无用的 import**(`npm run lint` 会揪出来)。`StoneState` 类型仍用于第 75 行的 `const state: StoneState = ...`。

- [ ] **Step 10: `ListenChoice.tsx` 保持原样**

`ListenChoice` 只是把 props 透传给 `Choice`,本次不动。跑一遍它的测试确认:

Run: `npx vitest run src/shared/ui/quiz/ListenChoice.test.tsx`
Expected: PASS,5 个用例全绿(测试文件无需改动)。

- [ ] **Step 11: `MatchGame.tsx` 改为消费 `Stone`**

import 行(第 9 行)改为:

```tsx
import { Stone } from './Stone'
import type { StoneState } from './stone'
```

`renderCard` 的返回改为(保持 `min-h-[64px]` 横排、`idle` 态交互类、`opacity-80` 已配对的旧行为):

```tsx
    return (
      <Stone
        key={o.id}
        state={state}
        horizontal
        emoji={o.emoji}
        text={o.text}
        disabled={Boolean(isMatched || mismatch || done)}
        shake={isMis}
        className={cn(isMatched && 'opacity-80', isMatched && 'pointer-events-none')}
        onClick={() => (isLeft ? pickLeft(o.id) : pickRight(o.id))}
      />
    )
```

> ⚠ 这里出现了一处**有意的行为对齐**:旧代码用 `!isMatched && !mismatch && !done && 'cursor-pointer active:scale-[0.96]'`,新 `Stone` 用 `!disabled && 'cursor-pointer active:scale-[0.96]'` —— 两者等价(`disabled` 就是那个三元表达式的取反)。`opacity-80` 保留原样。
>
> `pointer-events-none` 是**新增**的:旧代码里已配对的卡仍可点击,靠 `pickLeft` / `pickRight` 开头的 `if (matched[id] ...) return` 兜住。`aria-disabled` 的元素不该还能点,这里顺手对齐。**预检已定案:保留** —— 行为等价(那条早退分支仍在,只是再也走不到),不是行为变更。
>
> ⚠ **本步必须同时删掉 `MatchGame.tsx` 顶部的 `import { motion } from 'motion/react'`** —— `Stone` 接管了 `motion.button` 之后该文件不再用 `motion`,`tsc -b` 会以 `noUnusedLocals` 报错;而 `npm test` 与 `npm run lint` 都不报(见 Global Constraints 的闸门说明)。Task 4 会用 `motion.span` 渲染冲击波,届时**再引回来**。

- [ ] **Step 12: 跑全量测试 + lint**

Run: `npm test && npm run lint`
Expected: 全绿,**68 文件 / 434 测试**不变。若 `Choice.test.tsx` 或 `MatchGame.test.tsx` 有红,说明重构夹带了行为变更,回查而不是改测试。

- [ ] **Step 13: 提交**

```bash
git add src/index.css src/shared/ui/quiz/Stone.tsx src/shared/ui/quiz/Stone.test.tsx \
        src/shared/ui/quiz/SparkBurst.tsx src/shared/ui/quiz/SparkBurst.test.tsx \
        src/shared/ui/quiz/Choice.tsx src/shared/ui/quiz/MatchGame.tsx
git commit -m "refactor(quiz): 抽出 Stone / SparkBurst,三个题型组件换用(零观感变化)"
```

---

### Task 3: 答对反馈 —— 迸星 + 光柱 + `quiet` 分档

给 `Choice` 加 `quiet?: boolean`(缺省 false)。`quiet` 为真时不渲染 `SparkBurst` 与光柱。两个消费点会用到它:

- `ListenChoice` 内部**强制** `quiet` —— D9:该题的通路是耳朵,屏幕再炸一片星星是抢注意力。四个消费点零改。
- `TeachOverlay` 给 `Choice` / `ListenChoice` 都传 `quiet` —— §6 分档表:教学期要克制。

**Files:**
- Modify: `src/shared/ui/quiz/Choice.tsx`、`Choice.test.tsx`、`ListenChoice.tsx`、`ListenChoice.test.tsx`
- Modify: `src/features/foundation/TeachOverlay.tsx`

**Interfaces:**
- Consumes: Task 2 的 `Stone`(children 插槽)、`SparkBurst`
- Produces: `ChoiceProps` 新增 `quiet?: boolean`(可选,缺省 `false`)

- [ ] **Step 1: 写失败的测试 —— 追加到 `Choice.test.tsx` 的 `describe` 内**

```tsx
  it('答对迸星 + 光柱,且装饰不改变 accessible name', () => {
    const { container } = renderChoice({ correctId: 'a' })
    expect(container.querySelector('[data-spark-burst]')).not.toBeNull()
    expect(container.querySelector('.quiz-beam')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'A' })).toBeTruthy()
  })

  it('quiet 为真时不迸星、不上光柱(听一听 / 短教分档)', () => {
    const { container } = renderChoice({ correctId: 'a', quiet: true })
    expect(container.querySelector('[data-spark-burst]')).toBeNull()
    expect(container.querySelector('.quiz-beam')).toBeNull()
    expect(screen.getByRole('button', { name: 'A' })).toHaveTextContent('✓') // 形状冗余不受影响
  })
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/shared/ui/quiz/Choice.test.tsx`
Expected: FAIL —— 第一个用例 `container.querySelector('[data-spark-burst]')` 为 null;第二个用例因 `quiet` 不在 `ChoiceProps` 上而 TypeScript 报错。

- [ ] **Step 3: 给 `Choice.tsx` 加 `quiet` 与装饰插槽**

`ChoiceProps` 里 `showBadge` 之后插入:

```tsx
  /** 不迸星、不上光柱 —— 听一听(D9)与短教教学期用。缺省 false。 */
  quiet?: boolean
```

函数签名解构里加 `quiet = false,`(放在 `showBadge = true,` 之后);`StoneState` 计算之后、`return` 之前加:

```tsx
          const juice = state === 'correct' && !quiet
```

`Stone` 的改写(在 Task 2 的基础上加 children):

```tsx
            <Stone
              key={o.id}
              state={state}
              index={i}
              emoji={o.emoji}
              text={o.text}
              pressed={selected === o.id}
              disabled={disabled}
              shake={wrongId === o.id}
              onClick={() => handleCard(o)}
            >
              {juice ? <span aria-hidden className="quiz-beam" /> : null}
              {juice ? <SparkBurst /> : null}
            </Stone>
```

import 行补 `import { SparkBurst } from './SparkBurst'`。

- [ ] **Step 4: `ListenChoice.tsx` 强制 quiet**

第 39–46 行的 `<Choice ... />` 改为(注意 `quiet` 写在 `{...rest}` **之后**,保证消费方传不进来):

```tsx
      <Choice
        {...rest}
        quiet
        skill={skill}
        options={options}
        speak={speak}
        onAnswer={onAnswer}
        showBadge={false}
      />
```

- [ ] **Step 5: 追加 `ListenChoice.test.tsx` 断言**

```tsx
  it('D9:听一听不迸星、不上光柱(通路是耳朵,不抢注意力)', () => {
    const { container } = renderListen({ correctId: 'a' })
    expect(container.querySelector('[data-spark-burst]')).toBeNull()
    expect(container.querySelector('.quiz-beam')).toBeNull()
    expect(screen.getByRole('button', { name: 'A' })).toHaveTextContent('✓')
  })
```

- [ ] **Step 6: `TeachOverlay.tsx` 传 `quiet`**

第 214–221 行的 `shared` 对象里加一项:

```tsx
    const shared = {
      skill,
      options: q.options,
      speak,
      quiet: true, // 短教教学期要克制:不迸星、不上光柱(spec §6 分档表)
      disabled: qState === 'correct',
      correctId: qState === 'correct' ? correctId : null,
      onAnswer: handleQuizAnswer,
    }
```

`shared` 同时喂给 `Choice` 与 `ListenChoice` —— 两处都收到 `quiet`。`ColdStartWizard` **不传**(§6:冷启动要迸星),零改。

- [ ] **Step 7: 跑全量测试 + lint**

Run: `npm test && npm run lint`
Expected: 全绿。`TeachOverlay.test.tsx` 未断言迸星,应原样通过。

- [ ] **Step 8: 提交**

```bash
git add src/shared/ui/quiz/Choice.tsx src/shared/ui/quiz/Choice.test.tsx \
        src/shared/ui/quiz/ListenChoice.tsx src/shared/ui/quiz/ListenChoice.test.tsx \
        src/features/foundation/TeachOverlay.tsx
git commit -m "feat(quiz): 答对迸星 + 光柱,quiet 分档(听一听/短教不装)"
```

---

### Task 4: 连连看 —— 炼金(状态层)+ 爆点(事件层)

配对成功那一瞬的语义从「两块各自变绿」改成「右边的拼音被熔进左边的词石,炼成一块金星石,右边只留一个凹槽」。

**Files:**
- Modify: `src/shared/ui/quiz/MatchGame.tsx`、`MatchGame.test.tsx`
- Modify: `src/index.css`(爆点与对撞的材质类)

**Interfaces:**
- Consumes: Task 2 的 `Stone`(`subText` / 无文本 slot)、Task 1 的 `.stone--gold` / `.stone--slot` / `.stone-sub`
- Produces: 无对外接口变化(`MatchGameProps` 不变);新增 CSS 类 `.quiz-ring` / `.quiz-pop` / `.quiz-burst-layer` / `.stone--pop-l` / `.stone--pop-r`

- [ ] **Step 1: 写失败的测试 —— 追加到 `MatchGame.test.tsx`**

```tsx
  it('炼金:配对成功后左块变金石(含两侧内容),右位留空凹槽', () => {
    const { container } = render(
      <MatchGame
        prompt="配对"
        left={[{ id: 'l1', emoji: '🍎', text: '苹果', speak: '苹果' }]}
        right={[{ id: 'r1', text: 'píng guǒ', speak: '苹果' }]}
        answerMap={{ l1: 'r1' }}
        skill="hanzi"
        playSound={vi.fn()}
        speak={() => true}
        onComplete={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '苹果' }))
    fireEvent.click(screen.getByRole('button', { name: 'píng guǒ' }))

    const gold = container.querySelector('[data-state="gold"]')
    expect(gold).not.toBeNull()
    expect(gold).toHaveTextContent('苹果')
    expect(gold).toHaveTextContent('píng guǒ')
    expect(gold).toHaveTextContent('⭐')

    const slot = container.querySelector('[data-state="slot"]')
    expect(slot).not.toBeNull()
    expect(slot!.textContent).toBe('')
  })

  it('爆点:配对瞬间渲染冲击波与拟声词,且均为 aria-hidden 装饰', async () => {
    const { container } = render(
      <MatchGame
        prompt="配对"
        left={[{ id: 'l1', text: '苹果', speak: '苹果' }]}
        right={[{ id: 'r1', text: 'píng guǒ', speak: '苹果' }]}
        answerMap={{ l1: 'r1' }}
        skill="hanzi"
        playSound={vi.fn()}
        speak={() => true}
        onComplete={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '苹果' }))
    fireEvent.click(screen.getByRole('button', { name: 'píng guǒ' }))

    const layer = container.querySelector('[data-match-burst]')
    expect(layer).not.toBeNull()
    expect(layer).toHaveAttribute('aria-hidden', 'true')
    expect(layer).toHaveTextContent('啪!')

    await waitFor(() => expect(container.querySelector('[data-match-burst]')).toBeNull(), { timeout: 2000 })
  })
```

同步把文件顶部的 import 补成:

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/shared/ui/quiz/MatchGame.test.tsx`
Expected: FAIL —— 找不到 `[data-state="gold"]`(现为 `correct`)、`[data-match-burst]` 不存在。

- [ ] **Step 3: 在 `index.css` 追加爆点与对撞材质**

追加在 `.quiz-spark` 之后:

```css
/* 爆点浮层:居中于两列之上。单次扩散,非频闪(spec §8 闪光闸门)。 */
.quiz-burst-layer {
  position: absolute;
  inset: 0;
  z-index: 20;
  pointer-events: none;
}
.quiz-ring {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 11rem;
  height: 11rem;
  margin: -5.5rem 0 0 -5.5rem;
  border-radius: 999px;
  border: 4px solid rgb(255 255 255 / 0.9);
  box-shadow:
    0 0 28px rgb(255 220 120 / 0.9),
    inset 0 0 22px rgb(255 220 120 / 0.8);
}
.quiz-pop {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%) rotate(-8deg);
  font-size: 2rem;
  font-weight: 900;
  line-height: 1;
  color: rgb(255 255 255);
  -webkit-text-stroke: 3px var(--color-accent);
  paint-order: stroke fill;
}

/* 配对瞬间的对撞:两块各向对方偏 5px 并放大。用独立 translate/scale 属性,
 * 与 motion 写在 inline style 里的 transform 叠加而不互吞。 */
.stone--pop-l,
.stone--pop-r {
  transition: translate 120ms ease-out, scale 120ms ease-out;
  scale: 1.06;
}
.stone--pop-l {
  translate: 5px 0;
}
.stone--pop-r {
  translate: -5px 0;
}
```

- [ ] **Step 4: 改 `MatchGame.tsx` 的状态与渲染**

**(a)** state 区(`timerRef` 之后)加:

```tsx
  const [burst, setBurst] = useState<[string, string] | null>(null)
  // 爆点用独立 ref:mismatch 与 burst 可以叠加发生(爆点不锁输入),共用 timerRef 会互相取消,
  // 导致 burst 永不清空。
  const burstTimerRef = useRef<number | null>(null)
```

**(b)** 卸载清理的 `useEffect` 改为:

```tsx
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      if (burstTimerRef.current !== null) window.clearTimeout(burstTimerRef.current)
    },
    [],
  )
```

**(c)** `settlePair` 的成功分支加爆点(在 `setSelR(null)` 之后、`if (Object.keys(next).length === left.length)` 之前):

```tsx
      setBurst([l, r])
      if (burstTimerRef.current !== null) window.clearTimeout(burstTimerRef.current)
      burstTimerRef.current = window.setTimeout(() => setBurst(null), 450)
```

**(d)** `renderCard` 整块替换为:

```tsx
  function renderCard(o: BaseOption, isLeft: boolean) {
    const matchedRightIds = Object.values(matched)
    const isMatched = isLeft ? matched[o.id] !== undefined : matchedRightIds.includes(o.id)
    const isSel = isLeft ? selL === o.id : selR === o.id
    const isMis = mismatch ? (isLeft ? mismatch[0] === o.id : mismatch[1] === o.id) : false
    // 炼金(甲):左边炼成金石,右边留凹槽。凹槽不渲染文本 —— 信息已并入金石,
    // 免去低对比度灰字,也顺带让「读屏听到的」与「眼睛看到的」一致。
    const state: StoneState = isMatched ? (isLeft ? 'gold' : 'slot') : isMis ? 'wrong' : isSel ? 'selected' : 'idle'
    const goldSub = isLeft && isMatched ? right.find((r) => r.id === matched[o.id])?.text : undefined
    const popping = burst ? (isLeft ? burst[0] === o.id : burst[1] === o.id) : false
    return (
      <Stone
        key={o.id}
        state={state}
        horizontal
        emoji={isLeft ? o.emoji : undefined}
        text={state === 'slot' ? undefined : o.text}
        subText={goldSub}
        disabled={Boolean(isMatched || mismatch || done)}
        shake={isMis}
        className={cn(popping && (isLeft ? 'stone--pop-l' : 'stone--pop-r'))}
        onClick={() => (isLeft ? pickLeft(o.id) : pickRight(o.id))}
      />
    )
  }
```

> 变化说明:删掉了 Task 2 里写的 `cn(isMatched && 'opacity-80', isMatched && 'pointer-events-none')` —— 已配对的石头现在是金色或凹槽,再叠 80% 透明度会让「炼成」看起来很脏。

**(e)** 两列网格外层包一层相对定位容器,并挂爆点浮层。第 148–151 行改为:

```tsx
      <div className="relative">
        {burst ? (
          <span aria-hidden data-match-burst className="quiz-burst-layer">
            <motion.span
              className="quiz-ring"
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: [0, 1, 0], scale: [0.3, 1.15, 1.45] }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
            />
            <motion.span
              className="quiz-pop"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1.15, 1.05, 1] }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
            >
              啪!
            </motion.span>
          </span>
        ) : null}
        <div className="grid grid-cols-2 items-start gap-3">
          <div className="space-y-2.5">{left.map((o) => renderCard(o, true))}</div>
          <div className="space-y-2.5">{right.map((o) => renderCard(o, false))}</div>
        </div>
      </div>
```

- [ ] **Step 5: 跑测试确认通过**

Run: `npx vitest run src/shared/ui/quiz/MatchGame.test.tsx`
Expected: PASS(7 个用例)。

- [ ] **Step 6: 跑全量测试 + lint**

Run: `npm test && npm run lint`
Expected: 全绿。

> 已预先 grep 复核过下游:`src/features/qianzigu/ChapterRunnerView.test.tsx:193` 与 `src/app/App.test.tsx:190` 虽出现 `answerMap`,但 `left` / `right` 均为空数组或只配对不复查,不依赖「配对后右卡还能按名字取到」。若实测仍红,说明有测试在配对后用 `getByRole('button', { name: '☀️' })` 取右卡 —— 那是**预期内的语义变化**(凹槽本来就不该有可读文本),把定位改成 `container.querySelectorAll('[data-state="slot"]')`,并在该步提交信息里写明。

- [ ] **Step 7: 提交**

```bash
git add src/index.css src/shared/ui/quiz/MatchGame.tsx src/shared/ui/quiz/MatchGame.test.tsx
git commit -m "feat(quiz): 连连看炼金(金石+凹槽)与爆点(对撞+冲击波+拟声词)"
```

---

### Task 5: 水晶进度条

替代 3 处逐字重复的 `h-2 rounded-full` 圆点行。

**Files:**
- Create: `src/shared/ui/quiz/ProgressCrystals.tsx`, `ProgressCrystals.test.tsx`
- Modify: `src/index.css`、`src/features/lesson/WordLesson.tsx:293-303`、`src/features/foundation/TeachOverlay.tsx:164-173`、`src/features/foundation/ColdStartWizard.tsx:175-183`

**Interfaces:**
- Consumes: 无
- Produces: `ProgressCrystals({ total, current, className }: { total: number; current: number; className?: string })`;每格节点带 `data-crystal` = `'done' | 'active' | 'todo'`

- [ ] **Step 1: 写失败的测试**

```tsx
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { ProgressCrystals } from './ProgressCrystals'

describe('ProgressCrystals 水晶进度条', () => {
  afterEach(cleanup)

  it('按 total 渲染格数,按 current 标记已过/当前/未到', () => {
    const { container } = render(<ProgressCrystals total={4} current={2} />)
    const cells = Array.from(container.querySelectorAll('[data-crystal]'))
    expect(cells.map((c) => c.getAttribute('data-crystal'))).toEqual(['done', 'done', 'active', 'todo'])
  })

  it('current=0 时首格是 active、其余未到', () => {
    const { container } = render(<ProgressCrystals total={3} current={0} />)
    const cells = Array.from(container.querySelectorAll('[data-crystal]'))
    expect(cells.map((c) => c.getAttribute('data-crystal'))).toEqual(['active', 'todo', 'todo'])
  })

  it('纯装饰:整行不进 a11y 树(进度语义由既有文本承载)', () => {
    const { container } = render(<ProgressCrystals total={2} current={1} />)
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/shared/ui/quiz/ProgressCrystals.test.tsx`
Expected: FAIL —— `Failed to resolve import "./ProgressCrystals"`。

- [ ] **Step 3: 写 `ProgressCrystals.tsx`**

```tsx
import { cn } from '@/shared/ui/utils'

export type ProgressCrystalsProps = {
  total: number
  /** 当前所在格(0 基)。小于它的格为已过。 */
  current: number
  className?: string
}

/** 水晶进度条:替代三处逐字重复的圆点行。
 *  纯装饰 —— 每格 aria-hidden,进度语义仍由消费点既有的文本承担(勿以为它可读)。 */
export function ProgressCrystals({ total, current, className }: ProgressCrystalsProps) {
  return (
    <div data-crystals className={cn('flex items-center justify-center gap-1.5', className)}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          aria-hidden
          data-crystal={i < current ? 'done' : i === current ? 'active' : 'todo'}
          className={cn(
            'h-2.5 rounded-full transition-all',
            i < current ? 'crystal crystal--done w-2.5' : i === current ? 'crystal crystal--active w-6' : 'crystal crystal--todo w-2.5',
          )}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 4: 在 `index.css` 追加水晶材质**

追加在 `.stone--pop-r` 之后:

```css
/* 水晶进度格:已过=翠玉发光 / 当前=拉长的琥珀发光 / 未到=内凹凹槽 */
.crystal {
  position: relative;
  isolation: isolate;
}
.crystal--done {
  background-image: linear-gradient(
    180deg,
    color-mix(in srgb, var(--color-emerald) 55%, rgb(255 255 255)),
    var(--color-emerald)
  );
  box-shadow: 0 0 8px color-mix(in srgb, var(--color-emerald) 55%, transparent);
}
.crystal--active {
  background-image: linear-gradient(
    180deg,
    color-mix(in srgb, var(--color-accent) 55%, rgb(255 255 255)),
    var(--color-accent)
  );
  box-shadow: 0 0 12px color-mix(in srgb, var(--color-accent) 70%, transparent);
}
.crystal--todo {
  background-color: color-mix(in srgb, var(--color-ink-3) 25%, var(--color-surface-2));
  box-shadow: inset 0 1px 2px rgb(31 58 95 / 0.18);
}
```

- [ ] **Step 5: 跑 ProgressCrystals 测试确认通过**

Run: `npx vitest run src/shared/ui/quiz/ProgressCrystals.test.tsx`
Expected: PASS(3 个用例)。

- [ ] **Step 6: 三处接线**

**(a) `WordLesson.tsx:293-303`** —— 整块替换为:

```tsx
        {/* 技能步进度:水晶条(纯装饰,进度文本在顶栏) */}
        <ProgressCrystals total={steps.length} current={stepIndex} className="pb-4" />
```

并在 import 区加 `import { ProgressCrystals } from '@/shared/ui/quiz/ProgressCrystals'`。

> ⚠ **已 grep 核实:第 297 行是 `cn` 在这个文件里的唯一用处**(`grep -n "cn(" src/features/lesson/WordLesson.tsx` 只有一行)。删掉圆点行之后 `cn` 必然变成未用 import —— **同一处改动里一并删掉 `import { cn } from '@/shared/ui/utils'`**,否则 `npm run build` 会因 `noUnusedLocals` 失败(`npm test` / `npm run lint` 不会拦)。

**(b) `TeachOverlay.tsx:164-173`**(`renderQuiz` 内)整块替换为:

```tsx
        <ProgressCrystals total={progress} current={qi} className="pb-3" />
```

加 import `import { ProgressCrystals } from '@/shared/ui/quiz/ProgressCrystals'`。

**(c) `ColdStartWizard.tsx:175-183`**(`renderQuestion` 内)整块替换为:

```tsx
        <ProgressCrystals total={items.length} current={qi} className="pb-3" />
```

加 import `import { ProgressCrystals } from '@/shared/ui/quiz/ProgressCrystals'`。

- [ ] **Step 7: 跑全量测试 + lint**

Run: `npm test && npm run lint`
Expected: 全绿。既有的 `ColdStartWizard.test.tsx` / `TeachOverlay.test.tsx` 未断言圆点结构(已 grep 复核),应零改通过。

- [ ] **Step 8: 提交**

```bash
git add src/index.css src/shared/ui/quiz/ProgressCrystals.tsx src/shared/ui/quiz/ProgressCrystals.test.tsx \
        src/features/lesson/WordLesson.tsx src/features/foundation/TeachOverlay.tsx src/features/foundation/ColdStartWizard.tsx
git commit -m "feat(quiz): 水晶进度条 + 词课/短教/冷启动三处接线"
```

---

### Task 6: 词课满配(景深 + 顶栏 HUD + 星尘)

**Files:**
- Create: `src/features/lesson/LessonAmbience.tsx`, `LessonAmbience.test.tsx`
- Modify: `src/features/lesson/WordLesson.tsx`、`WordLesson.test.tsx`、`LessonEntry.tsx`

**Interfaces:**
- Consumes: `LessonSession` 的 `progressData: ProgressData`、既有的 `totalStars(progress: ProgressData): number`(`LessonEntry.tsx:64`)
- Produces: `WordLessonProps` 新增**必传** `dust: number`;`LessonAmbience()` 无 props,根节点带 `data-lesson-ambience` + `aria-hidden`

> `dust` 定为**必传**:唯一真实调用方 `LessonEntry` 恒有值;定为可选会留下「看着像功能其实没接线」的假绿路径。

- [ ] **Step 1: 写失败的测试 —— `LessonAmbience.test.tsx`**

```tsx
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { LessonAmbience } from './LessonAmbience'

describe('LessonAmbience 词课景深层', () => {
  afterEach(cleanup)

  it('纯装饰:整层 aria-hidden 且不吃点击', () => {
    const { container } = render(<LessonAmbience />)
    const layer = container.querySelector('[data-lesson-ambience]')
    expect(layer).not.toBeNull()
    expect(layer).toHaveAttribute('aria-hidden', 'true')
    expect(layer!.className).toContain('pointer-events-none')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/lesson/LessonAmbience.test.tsx`
Expected: FAIL —— `Failed to resolve import "./LessonAmbience"`。

- [ ] **Step 3: 写 `LessonAmbience.tsx`**

```tsx
/** 词课景深层:天顶柔光 + 远处云 + 题区落影,把题卡从「浮在天空渐变上的白盒子」变成
 *  「落在地上的物件」。只服务词课 —— 千字谷由舞台自备,短教/冷启动是全屏浮层没有天空
 *  (spec §6 分档表 + 勘误)。纯装饰:aria-hidden + pointer-events-none。 */
export function LessonAmbience() {
  return (
    <div aria-hidden data-lesson-ambience className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {/* 天顶柔光 */}
      <div className="absolute -top-32 left-1/2 h-64 w-[140%] -translate-x-1/2 rounded-full bg-surface/60 blur-3xl" />
      {/* 远处云 */}
      <div className="absolute left-[6%] top-[15%] text-4xl opacity-40">☁️</div>
      <div className="absolute right-[9%] top-[8%] text-3xl opacity-30">☁️</div>
      {/* 题区落影:词石组脚下的地面感 */}
      <div className="absolute left-1/2 top-[58%] h-24 w-[76%] -translate-x-1/2 rounded-[999px] bg-ink/10 blur-2xl" />
    </div>
  )
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/features/lesson/LessonAmbience.test.tsx`
Expected: PASS。

- [ ] **Step 5: 写失败的测试 —— 改 `WordLesson.test.tsx`**

`renderLesson` 的 base 补上 `dust`(必传,缺了 TS 直接报错):

```tsx
function renderLesson(over: Partial<Parameters<typeof WordLesson>[0]> = {}) {
  const base = { word, settings, combo: 0, dust: 0, makeQuestions, playSound: noop, speak: () => true, celebrate: noop, onAnswer: noop, onStepPass: noop, onLessonComplete: noop, onExit: noop }
  return render(<WordLesson {...base} {...over} />)
}
```

追加用例:

```tsx
describe('WordLesson 顶栏 HUD', () => {
  afterEach(cleanup)

  it('渲染传入的星尘数', () => {
    const { container } = renderLesson({ dust: 42 })
    expect(container.querySelector('[data-hud="dust"]')).toHaveTextContent('42')
  })

  it('连击 <2 不显示连击档(单次答对不叫连击)', () => {
    const { container } = renderLesson({ combo: 1 })
    expect(container.querySelector('[data-hud="combo"]')).toBeNull()
  })

  it('连击 ≥2 显示连击档', () => {
    const { container } = renderLesson({ combo: 3 })
    expect(container.querySelector('[data-hud="combo"]')).toHaveTextContent('3')
  })

  it('景深层随题卡一同渲染', () => {
    const { container } = renderLesson()
    expect(container.querySelector('[data-lesson-ambience]')).not.toBeNull()
  })
})
```

- [ ] **Step 6: 跑测试确认失败**

Run: `npx vitest run src/features/lesson/WordLesson.test.tsx`
Expected: FAIL —— `dust` 不在 `WordLessonProps` 上(TS 报错),`[data-hud="dust"]` 为 null。

- [ ] **Step 7: 改 `WordLesson.tsx`**

**(a)** `WordLessonProps` 里 `combo` 之后加:

```tsx
  /** 当前累计星尘(顶栏 HUD 展示)。必传 —— 可选会留下「看着像功能其实没接线」的假绿路径。 */
  dust: number
```

**(b)** 函数签名解构里 `combo,` 之后加 `dust,`。

**(c)** import 区加 `import { LessonAmbience } from './LessonAmbience'` 与 `import { ProgressCrystals } from '@/shared/ui/quiz/ProgressCrystals'`。

**(d)** 正常返回分支的根节点与 header 改为:

```tsx
  return (
    <div className="relative min-h-screen text-ink">
      <LessonAmbience />
      <header className="glass-strong sticky top-0 z-30 border-b border-hairline">
        <div className="mx-auto flex h-14 max-w-xl items-center gap-2 px-4">
          <Button variant="ghost" size="icon" onClick={onExit} aria-label="返回地图">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="truncate text-[15px] font-bold">
            {word.emoji} {word.hanzi} · {SKILL_LABEL[skill]}
          </span>
          <span className="ml-auto shrink-0 rounded-full border border-hairline bg-surface px-2.5 py-1 text-xs font-semibold text-ink-2">
            {qIndex + 1}/{questions.length} · 第{stepIndex + 1}/{steps.length}技能
          </span>
        </div>
        {/* HUD:星尘 + 连击。连击 <2 不占位(单次答对不叫连击)。 */}
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 pb-2 text-xs font-bold">
          <span data-hud="dust" className="text-accent-ink">
            ✨ {dust}
          </span>
          {combo >= 2 ? (
            <span data-hud="combo" className="text-accent-ink">
              🔥 {combo} 连击
            </span>
          ) : null}
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-xl px-4 pb-24 pt-5">
```

> `main` 加 `relative z-10` 压住景深层。gate 分支(`if (gate)`)的返回保持原样 —— 教学期不显示 HUD 与景深。
>
> ⚠ **文件边界**:`WordLesson.tsx` 同时被 Task 5 改过(第 293 行的圆点行换成了 `<ProgressCrystals .../>`)。本步**只动三处**:根节点开标签、`<header>` 整块、`<main>` 开标签。**不要整体重写 `return`** —— 重写会把 Task 5 的水晶条冲掉,而 `npm test` 与 `npm run lint` 都不会告诉你(唯一会拦的是 Task 7 的浏览器走查)。

- [ ] **Step 8: `LessonEntry.tsx` 传 `dust`**

第 210–223 行的 `<WordLesson ... />` 里,`combo` 之后加一行:

```tsx
      dust={totalStars(progressData)}
```

> 用 **prop `progressData`** 而非 `latestProgress` ref(R3):`progressData` 来自 `useServiceSnapshot` 的实时快照,`saveStep` 落库后父级重渲染即带动本组件重算;ref 是渲染外可变值,渲染序上可能取到陈旧值。

- [ ] **Step 9: 跑全量测试 + lint**

Run: `npm test && npm run lint`
Expected: 全绿。`LessonEntry.test.tsx` 渲染的是 `LessonEntry`(内部自会传 `dust`),无需改。

- [ ] **Step 10: 提交**

```bash
git add src/features/lesson/LessonAmbience.tsx src/features/lesson/LessonAmbience.test.tsx \
        src/features/lesson/WordLesson.tsx src/features/lesson/WordLesson.test.tsx \
        src/features/lesson/LessonEntry.tsx
git commit -m "feat(lesson): 词课满配 —— 景深层 + 顶栏星尘/连击 HUD + dust prop"
```

---

### Task 7: 收口(构建验产物 + 文档同步 + 走查)

**Files:**
- Modify: `docs/design/game-visual.md`、`docs/superpowers/specs/2026-09-15-quiz-candy-juice-design.md`(状态行)

- [ ] **Step 1: 全量闸门**

Run: `npm test && npm run lint`
Expected: 全绿(测试文件数应 ≥ 基线 68,用例数应 ≥ 434)。

- [ ] **Step 2: 构建 + **查产物 CSS**(本轮唯一的材质失守探针)**

```bash
npm run build
ls dist/client/assets/*.css
grep -c 'stone--gold' dist/client/assets/*.css
grep -c 'stone--selected' dist/client/assets/*.css
grep -c 'stone-halo' dist/client/assets/*.css
grep -c 'quiz-beam' dist/client/assets/*.css
grep -c 'crystal--active' dist/client/assets/*.css
```

Expected: 每条的计数 **≥ 1**。任何一条为 0 就说明材质类没进产物 —— 这正是上一轮 `npm test` + `npm run lint` 全绿却翻车的那种失守,必须回查而不是放过。

- [ ] **Step 3: 浏览器走查(含夜戏与全屏浮层)**

Run: `npm run dev`,然后逐面走一遍:

| 面 | 看什么 |
| --- | --- |
| 词课(pinyin / hanzi / english 三步) | 词石有厚度;选中浮起;答对迸星 + 光柱;答错只抖不发光;顶栏 ✨星尘 与 🔥连击;技能步水晶条;天顶柔光与落影 |
| 千字谷跑章 `t5` 台灯夜戏 | 夜/暗天空下糖果石压深色天空的观感、文字对比度(R6) |
| 千字谷 BOSS 幕 | 同上 + 连连看金石/凹槽/爆点 |
| 短教(TeachOverlay) | 教学期**不迸星、不上光柱**;水晶条;虚线教学框仍在 |
| 冷启动向导 | 迸星 + 光柱;水晶条;无景深层 |
| 连连看(任一面) | 配对后左块变金石两行字、右位留凹槽;爆点白环 + 「啪!」≤0.5s 消失;四对全通不重复弹层 |

- [ ] **Step 4: 人肉过一遍无障碍闸门**

- 系统开启「减弱动态效果」后重走词课:景深/光柱/晕托是静态渐变,**画面不塌**;迸星与爆点消失。
- 暗色模式(系统偏好)下重走词课与连连看:金石仍是金色(三主题恒定),文字可读。
- 浏览器放大到 200%:词石文字不被截断(靠 `min-h` + `padding`)。

- [ ] **Step 5: 更新设计文档**

`docs/design/game-visual.md`「现状接缝映射」表里「前景交互层」那一行,把题面观感落点补全。该行末尾的守则句改为:

```
题面气泡(`shared/ui/quiz/QuestionBubble.tsx`)/ 词石渲染(`shared/ui/quiz/Stone.tsx`,状态表 `stone.ts`)/ **词石材质**(`index.css` 的 `.stone*` / `.stone-halo` / `.quiz-*` **普通类**,禁裸 hex)/ 施法钮(`CastButton.tsx`)/ 进度水晶(`ProgressCrystals.tsx`)/ 词课景深(`features/lesson/LessonAmbience.tsx`)已建 —— 改题面观感改这些,勿在消费点内联绕过
```

- [ ] **Step 6: 更新 spec 状态行**

`docs/superpowers/specs/2026-09-15-quiz-candy-juice-design.md` 第 3 行 `状态:**待评审**` 改为 `状态:**已实施**`。

- [ ] **Step 7: 提交**

```bash
git add docs/design/game-visual.md docs/superpowers/specs/2026-09-15-quiz-candy-juice-design.md
git commit -m "docs(visual): 题面材质/景深/进度水晶落点入接缝表,spec 转已实施"
```

---

## 自审记录

**Spec 覆盖核对**(逐节对照 `2026-09-15-quiz-candy-juice-design.md`):

| Spec 条目 | 落到哪个任务 |
| --- | --- |
| §5 词石六态 + 炼成/凹槽 + emoji 晕托 + 间距 + 新 token | Task 1 |
| §5 答对反馈(迸星 + 光柱) | Task 3 |
| §5 题区景深层 / 顶栏 HUD / 进度水晶 | Task 6 / Task 6 / Task 5 |
| §7.1 甲·炼金 | Task 4 |
| §7.2 丙·爆点 | Task 4 |
| §6 分档表(含 D9 quiet) | Task 3(`quiet`)+ 各任务接线 |
| §8 无障碍闸门 | Task 1(不透明度纪律/`min-h`)+ Task 3·4(装饰 `aria-hidden`)+ Task 7 Step 4 |
| §9.1 新增装饰必须 `aria-hidden` | Task 2(`data-halo`)、Task 3(`data-spark-burst`/`.quiz-beam`)、Task 4(`data-match-burst`)、Task 5(`data-crystal`) |
| §9.3 `dust` 必传 | Task 6 |
| §11 实施顺序 | 七个任务的顺序即 §11 的展开 |
| §12 文档同步 | Task 7 |

**与 spec 的有意偏差(两处,均为 spec 未展开的实施细节):**

1. spec §11 把「抽件」与「连连看」并列为第 2、3 步,本计划在中间插入了 **Task 3(答对迸星 + 光柱 + quiet 分档)**。理由:§11 第 2 步要求「此步不引入新观感」,而迸星/光柱是新观感,混在一起就没法用「测试全绿」证明重构无行为变更。
2. spec §6 说分档「全部落在消费点是否渲染对应组件」,但 `Choice` 是四个面共用件,`quiet` 是唯一旋钮 —— 短教由 `TeachOverlay` 传 `quiet`(一行),这是 spec 未点明、但由其分档表必然推出的一处消费点改动。

**类型一致性**:`StoneState` 七态在 `stone.ts`(Task 1)、`Stone.tsx`(Task 2)、`MatchGame.tsx`(Task 4)三处一致;`stoneMark` 返回类型在 Task 1 由二值扩到三值,`stoneMarkClass` 同步;`ChoiceProps.quiet` 在 Task 3 定义并被 Task 3 的 `ListenChoice` / `TeachOverlay` 消费;`dust` 在 Task 6 定义并被同任务的 `LessonEntry` 消费。
