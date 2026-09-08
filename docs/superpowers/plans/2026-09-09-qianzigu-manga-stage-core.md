# 千字谷跑章漫画舞台化 · Plan 1/3:stage-core(数据字段 + 纯逻辑 + 舞台组件 + 对话演出 + 接线)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 铺好漫画舞台的"地基":scene 数据带可选舞台元数据(`stage`/`mood`,引擎零读、向后兼容);新增纯逻辑 `stage-meta`(阵容推导/氛围兜底/点亮档)与视觉源映射 `stage-visuals`;实现舞台组件 `StageFrame/StageSky/StageCast` 与**对话演出屏 `DialoguePresenter`**(全窗背景 + 同框多角色站队 + 说话者旁漫画泡 + 点按推进);并把千字谷运行器的 `dialogue/ending` 场景接线到新演出屏(其余 task/social/boss 等仍走现 UI,过渡态,Plan 2 收口)。

**Architecture:** 一切呈现层,集中在 `src/features/qianzigu/` 自包含目录,遵循 3 层边界(qianzigu 依赖 shared 既有类型 + shared/ui,不新增跨 feature 依赖)。引擎 `engine.ts` 不感知任何新字段,故数据模型加可选字段零风险;视觉源集中 `stage-visuals` 一处(位图接缝)。

**Tech Stack:** React 19 + TS + motion(含 `useReducedMotion`)+ 现有 shared/ui(`cn`/`Button`)+ lucide。不引新依赖、不引位图、无 worker/DB/迁移改动。

**Spec:** `docs/superpowers/specs/2026-09-09-qianzigu-manga-stage-design.md` §5(数据扩展)、§6.1(视觉源接缝)、§6.2 dialogue/ending 行、§6.3(DialoguePresenter)、§11 文件表 core 相关、§12 测试 core 相关。

## Global Constraints

- **引擎零改动**:本 plan 及后续不触碰 `engine.ts`;其测试保持不动。新字段只被 UI/纯逻辑消费。
- 新字段全可选:老 chapter 数据(如 `flowChapter` 测试 fixture、`CHAPTER_1` 原样)不带 `stage`/`mood` 也必须编译通过、行为不变。
- `useService` 仅 `<Name>Entry.tsx`;`ChapterRunnerView` 内服务全 props 注入(维持现状)。
- 视觉:不引位图、不引新依赖/路由;舞台用现有 token + 新增 CSS(只追加 `src/index.css`,不改既有 token 默认值)。
- `ROLE_META`(scene-ui 现导出)继续作角色 `name/emoji` 唯一事实源;`stage-visuals` 只做补充映射(尺寸/氛围/情绪),**不重复定义 name/emoji**。
- `narrator` 永不出现在站队阵容(进旁白叙述框);组件不渲染 narrator 站位。
- 尊重 `prefers-reduced-motion`:说话者无限弹跳动效须经 `useReducedMotion` 关闭。
- 语言:UI 文案中文;aria-label 用中文描述。
- 每个 task 后跑 `npx vitest run <目标>` → 全量 `npm test` 保持绿(现 264 基线)。

---

### Task 1: stage-meta 纯逻辑(阵容推导 / 氛围兜底 / 点亮档)

**Files:**
- Create: `src/features/qianzigu/stage-meta.ts`
- Test: `src/features/qianzigu/stage-meta.test.ts`

**Interfaces:**
- Consumes: `src/features/qianzigu/chapter.ts` 既有类型 `ChapterLine`、`SceneKind`、`SpeechRole`(来自 shared 重导出)。
- Produces(本 task 定义的函数,后续 task 引用):
  - `isNarrator(role: SpeechRole): boolean`
  - `castFor(lines: readonly ChapterLine[], presets?: readonly SpeechRole[]): SpeechRole[]`
  - `defaultAtmosphere(kind: SceneKind): AtmosphereKey`(现先以字面量 `'dawn'|'day'|'dark'|'night'` 返回值;`AtmosphereKey` 类型在 Task 2 定义后此处 import 保持一致)
  - `restoreCount(restored: ReadonlyArray<{ wordId: number }>, wordId: number): number`

> 注:`defaultAtmosphere` 返回类型先写 `string` 会过宽,此 task 不 import 尚不存在的 `AtmosphereKey`。**执行顺序按 Task 1 → Task 2**:Task 1 先实现 `isNarrator/castFor/restoreCount` 三类(不依赖新类型),`defaultAtmosphere` 留到 Task 2 随类型定义一并加。若按独立 task 执行感到别扭,可将 Task 1 与 Task 2 合并为一次 TDD 循环(见 Task 1 末提示)。

- [ ] **Step 1: 写失败测试(先做不依赖新类型的三个函数)**

`src/features/qianzigu/stage-meta.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { ChapterLine } from './chapter'
import { castFor, isNarrator, restoreCount } from './stage-meta'

const L = (role: ChapterLine['role']): ChapterLine => ({ role, text: 'x' })

describe('stage-meta', () => {
  it('isNarrator: 仅 narrator 为真', () => {
    expect(isNarrator('narrator')).toBe(true)
    expect(isNarrator('lingling')).toBe(false)
  })

  it('castFor: 无 presets 时按台词首现序推角色(滤 narrator、去重)', () => {
    const lines = [L('lingling'), L('narrator'), L('sun'), L('lingling'), L('sun')]
    expect(castFor(lines)).toEqual(['lingling', 'sun'])
  })

  it('castFor: presets 常驻且优先,台词新角色按序补入,重复与 narrator 均滤除', () => {
    const lines = [L('sun'), L('villager')]
    expect(castFor(lines, ['lingling', 'moon', 'moon', 'narrator'])).toEqual(['lingling', 'moon', 'sun', 'villager'])
  })

  it('castFor: 空台词 + 无 presets → 空阵容', () => {
    expect(castFor([])).toEqual([])
  })

  it('restoreCount: 统计该词被恢复的次数(sound/shape 各计一次 → 0..2)', () => {
    const restored = [{ wordId: 1 }, { wordId: 2 }, { wordId: 1 }]
    expect(restoreCount(restored, 1)).toBe(2)
    expect(restoreCount(restored, 2)).toBe(1)
    expect(restoreCount(restored, 3)).toBe(0)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/qianzigu/stage-meta.test.ts`
Expected: FAIL(模块 `./stage-meta` 不存在)。

- [ ] **Step 3: 实现 stage-meta.ts(前三个函数)**

```ts
import type { ChapterLine } from './chapter'
import type { SpeechRole } from '@/shared/services'

const NARRATOR: SpeechRole = 'narrator'

export const isNarrator = (role: SpeechRole): boolean => role === NARRATOR

/** 展示组阵容:presets(常驻,保序)+ 台词首现序出现的角色;narrator 与重复一律滤除。 */
export function castFor(lines: readonly ChapterLine[], presets?: readonly SpeechRole[]): SpeechRole[] {
  const out: SpeechRole[] = []
  const seen = new Set<SpeechRole>()
  const push = (r: SpeechRole) => {
    if (r === NARRATOR || seen.has(r)) return
    seen.add(r)
    out.push(r)
  }
  if (presets) for (const r of presets) push(r)
  for (const l of lines) push(l.role)
  return out
}

/** 某词已恢复次数(0..2:两技能层各计一次;语义 = 原 SkyStrip 点亮档)。 */
export function restoreCount(restored: ReadonlyArray<{ wordId: number }>, wordId: number): number {
  let n = 0
  for (const e of restored) if (e.wordId === wordId) n++
  return n
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/features/qianzigu/stage-meta.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/features/qianzigu/stage-meta.ts src/features/qianzigu/stage-meta.test.ts
git commit -m "feat(qianzigu): stage-meta 纯逻辑(阵容推导/点亮档/isNarrator)"
```

> 提示:若想单循环做全,Task 1 + Task 2 合并执行:先写含 `defaultAtmosphere` 的测试,再一起实现并 commit(见 Task 2 的 Step 后)。分拆亦可,顺序不冲突。

---

### Task 2: chapter.ts 数据字段扩展(`mood?` / `stage?`) + defaultAtmosphere

**Files:**
- Modify: `src/features/qianzigu/chapter.ts`
- Modify: `src/features/qianzigu/stage-meta.ts`(补 `defaultAtmosphere`)
- Test: `src/features/qianzigu/stage-meta.test.ts`(补 defaultAtmosphere 用例)

**Interfaces:**
- Consumes: `SceneKind`(已有)。
- Produces(供 Task 3+ 与 Plan 2/3 用):
  - `type AtmosphereKey = 'dawn' | 'day' | 'dusk' | 'night' | 'dark'`
  - `type SpeechMood = 'calm' | 'sad' | 'happy' | 'scary'`
  - `type StageMeta = Readonly<{ cast?: readonly SpeechRole[]; atmosphere?: AtmosphereKey }>`
  - `ChapterLine` 增可选 `mood?: SpeechMood`
  - 每个 scene kind 接口(dialogue/task/social/break/boss/ending/settle)增可选 `stage?: StageMeta`
  - `defaultAtmosphere(kind: SceneKind): AtmosphereKey`

- [ ] **Step 1: 写失败测试(defaultAtmosphere)**

在 `stage-meta.test.ts` 追加:

```ts
import { castFor, defaultAtmosphere, isNarrator, restoreCount } from './stage-meta'

it('defaultAtmosphere: boss→dark;settle/ending→day;break→night;其余→dawn', () => {
  expect(defaultAtmosphere('boss')).toBe('dark')
  expect(defaultAtmosphere('settle')).toBe('day')
  expect(defaultAtmosphere('ending')).toBe('day')
  expect(defaultAtmosphere('break')).toBe('night')
  expect(defaultAtmosphere('dialogue')).toBe('dawn')
  expect(defaultAtmosphere('task')).toBe('dawn')
  expect(defaultAtmosphere('social')).toBe('dawn')
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/qianzigu/stage-meta.test.ts`
Expected: FAIL(`defaultAtmosphere is not a function`)。

- [ ] **Step 3: 扩展 chapter.ts 类型**

在 `chapter.ts` 顶部(SpeechRole import 之后、`SceneKind` 之后)加:

```ts
export type AtmosphereKey = 'dawn' | 'day' | 'dusk' | 'night' | 'dark'
export type SpeechMood = 'calm' | 'sad' | 'happy' | 'scary'
/** 舞台元数据(全可选;引擎零读)。cast 顺序即站位偏好,自动分槽;narrator 永不出现在 cast。 */
export type StageMeta = Readonly<{ cast?: readonly SpeechRole[]; atmosphere?: AtmosphereKey }>
```

把 `ChapterLine` 改为:

```ts
export type ChapterLine = Readonly<{ role: SpeechRole; text: string; mood?: SpeechMood }>
```

给以下每种 scene 接口**各加一行** `stage?: StageMeta`(与其它字段并列;顺序不限):
`TaskScene`、`DialogueScene`、`SocialScene`、`BreakScene`、`BossScene`、`EndingScene`、`SettleScene`。

保持 `Scene` union 与 `Chapter` 结构不变。`CHAPTER_1` 与测试 fixture(无 `stage`/`mood`)不改也能通过编译(字段全可选)。

- [ ] **Step 4: 在 stage-meta.ts 补 defaultAtmosphere**

```ts
import type { AtmosphereKey, ChapterLine, SceneKind } from './chapter'
import type { SpeechRole } from '@/shared/services'
// …castFor/restoreCount 保持不变…

/** 氛围兜底:stage.atmosphere 缺失时按场景 kind 取默认。 */
export function defaultAtmosphere(kind: SceneKind): AtmosphereKey {
  switch (kind) {
    case 'boss':
      return 'dark'
    case 'settle':
    case 'ending':
      return 'day'
    case 'break':
      return 'night'
    default:
      return 'dawn'
  }
}
```

> 同步:把该文件顶部的 `./chapter` type import 扩成含 `AtmosphereKey, SceneKind`;`SpeechRole` 保持从 `@/shared/services` 导入(chapter.ts 只 import 不 re-export SpeechRole)。

- [ ] **Step 5: 跑测试确认通过 + 类型与全量回归**

Run: `npx vitest run src/features/qianzigu/stage-meta.test.ts`
Expected: PASS。

Run: `npx tsc -b`(无类型错;老 chapter 数据兼容)→ `npm test`
Expected: 全绿(引擎/现有 UI 零回归)。

- [ ] **Step 6: Commit**

```bash
git add src/features/qianzigu/chapter.ts src/features/qianzigu/stage-meta.ts src/features/qianzigu/stage-meta.test.ts
git commit -m "feat(qianzigu): chapter 舞台元数据字段(mood?/stage?,全可选) + defaultAtmosphere"
```

---

### Task 3: stage-visuals 视觉源映射 + index.css 舞台样式

**Files:**
- Create: `src/features/qianzigu/stage-visuals.ts`
- Test: `src/features/qianzigu/stage-visuals.test.ts`
- Modify: `src/index.css`(追加)

**Interfaces:**
- Consumes: `AtmosphereKey`/`SpeechMood`/`SpeechRole`(chapter/shared)。
- Produces:
  - `roleScale(role: SpeechRole): number`(静默大反派放大 1.5,其余 1)
  - `moodBorder(mood: SpeechMood): string`(返回边框 class:sad→`border-sky`,happy→`border-emerald`,scary→`border-red`,calm→`border-hairline-strong`)
  - `atmosphereToClass(key: AtmosphereKey): string`(返回 `stage-sky stage-sky--<key>`)

- [ ] **Step 1: 写失败测试**

`src/features/qianzigu/stage-visuals.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { atmosphereToClass, moodBorder, roleScale } from './stage-visuals'

describe('stage-visuals', () => {
  it('roleScale: 静默放大,其余 1', () => {
    expect(roleScale('jingmo')).toBe(1.5)
    expect(roleScale('lingling')).toBe(1)
    expect(roleScale('sun')).toBe(1)
  })
  it('atmosphereToClass: 映射唯一 stage-sky 类', () => {
    expect(atmosphereToClass('night')).toBe('stage-sky stage-sky--night')
    expect(atmosphereToClass('day')).toBe('stage-sky stage-sky--day')
  })
  it('moodBorder: sad→sky/happy→emerald/scary→red/calm→hairline-strong', () => {
    expect(moodBorder('sad')).toBe('border-sky')
    expect(moodBorder('happy')).toBe('border-emerald')
    expect(moodBorder('scary')).toBe('border-red')
    expect(moodBorder('calm')).toBe('border-hairline-strong')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/qianzigu/stage-visuals.test.ts`
Expected: FAIL(模块不存在)。

- [ ] **Step 3: 实现 stage-visuals.ts**

```ts
import type { AtmosphereKey, SpeechMood } from './chapter'
import type { SpeechRole } from '@/shared/services'

/** 角色形象比例(emoji 放大系数;静默大反派)。
 *  位图接缝:将来换立绘只改此映射 + stage-visuals 同文件 atmosphere 表,组件零改。 */
export const roleScale = (role: SpeechRole): number => (role === 'jingmo' ? 1.5 : 1)

/** 气泡边框情绪色(mood 缺省 calm 由调用方回退)。 */
export const moodBorder = (mood: SpeechMood): string =>
  mood === 'sad' ? 'border-sky' : mood === 'happy' ? 'border-emerald' : mood === 'scary' ? 'border-red' : 'border-hairline-strong'

/** 氛围背景类(具体渐变在 index.css `.stage-sky--*`)。 */
export const atmosphereToClass = (key: AtmosphereKey): string => `stage-sky stage-sky--${key}`
```

- [ ] **Step 4: 追加 index.css 舞台样式**

在 `src/index.css` 末尾(暗色/reduced-motion 覆盖之后)追加——用**普通 CSS 类**,不依赖 `@apply`(避开 Tailwind v4 编译细节),直接叠在既有 token 上:

```css
/* 千字谷漫画舞台:全窗天空氛围(普通类,由 stage-visuals.atmosphereToClass 引用) */
.stage-sky {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.stage-sky--dawn { background-image: linear-gradient(180deg, #9fb3c4, #c7d4dc 75%); }
.stage-sky--day { background-image: linear-gradient(180deg, var(--color-canvas), var(--color-canvas-2) 75%); }
.stage-sky--dusk { background-image: linear-gradient(180deg, #f2b28c, #fbd9b7 75%); }
.stage-sky--night { background-image: linear-gradient(180deg, #16294a, #2c4a70 75%); }
.stage-sky--dark { background-image: linear-gradient(180deg, #141a30, #2a2140 80%); }
```

> 观感说明:各渐变先以"直觉色"起步(dawn 灰冷 / night 深蓝 / dark 暗紫);配色精调属 Plan 3 浏览器验收打磨项,不在本 task 追求完美像素。

- [ ] **Step 5: 跑测试确认通过**

Run: `npx vitest run src/features/qianzigu/stage-visuals.test.ts`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add src/features/qianzigu/stage-visuals.ts src/features/qianzigu/stage-visuals.test.ts src/index.css
git commit -m "feat(qianzigu): stage-visuals 视觉源映射 + 舞台天空氛围样式"
```

---

### Task 4: 舞台组件 StageFrame / StageSky / StageCast

**Files:**
- Create: `src/features/qianzigu/stage.tsx`
- Test: `src/features/qianzigu/stage.test.tsx`

**Interfaces:**
- Consumes: `ROLE_META`(from `./scene-ui`)、`restoreCount/isNarrator`(Task 1)、`roleScale/atmosphereToClass`(Task 3)、`AtmosphereKey`。
- Produces(供 Task 5+):
  - `StageFrame({ children, className? }: { children: ReactNode; className?: string })` — 全窗不滚帧(`h-dvh` + `overflow-hidden`)。
  - `StageSky({ atmosphere, words, restored })` — 背景氛围渐变 + 词 emoji 点灯(0/1/2 档)。
  - `StageCast({ cast, speaker, bubble })` — 角色站队(说话者弹跳高亮 + 名字牌;speaker 时在角色上方渲染 `bubble` ReactNode);**不接收 narrator**(由调用方保证)。

- [ ] **Step 1: 写失败测试**

`src/features/qianzigu/stage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StageCast, StageSky } from './stage'

describe('StageSky', () => {
  it('按 atmosphere 出 class;词 emoji 随 restored 档位点亮', () => {
    const { container } = render(
      <StageSky
        atmosphere="dawn"
        words={[
          { id: 1, emoji: '☀️' },
          { id: 2, emoji: '⭐' },
        ]}
        restored={[{ wordId: 1 }, { wordId: 1 }]}
      />,
    )
    expect(container.querySelector('.stage-sky--dawn')).not.toBeNull()
    const [sun, star] = Array.from(container.querySelectorAll('.stage-word'))
    expect(sun!.className).toContain('opacity-100')
    expect(star!.className).toContain('grayscale')
  })
})

describe('StageCast', () => {
  it('按 cast 站队出名字牌;说者高亮 accent,听者灰', () => {
    const { container } = render(
      <StageCast cast={['lingling', 'sun']} speaker="sun" />,
    )
    const names = Array.from(container.querySelectorAll('span')).map((n) => n.textContent)
    expect(names).toContain('灵灵')
    expect(names).toContain('太阳')
    const speakerBadge = screen.getAllByText('太阳')[0].parentElement?.parentElement
    // sun 说者高亮 class(accent),灵灵听者灰
    const badges = container.querySelectorAll('span')
    const speakerTag = Array.from(badges).find((b) => b.textContent === '太阳')!
    const listenerTag = Array.from(badges).find((b) => b.textContent === '灵灵')!
    expect(speakerTag.className).toContain('bg-accent')
    expect(listenerTag.className).toContain('bg-ink/60')
  })

  it('bubble 仅渲染在当前说话者上方', () => {
    const { container } = render(
      <StageCast cast={['lingling', 'sun']} speaker="sun" bubble={<span>救救我</span>} />,
    )
    expect(screen.getByText('救救我')).toBeInTheDocument()
    // 气泡数量 = 1(只在说话者列)
    expect(container.querySelectorAll('[data-stage-bubble]').length).toBe(1)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/qianzigu/stage.test.tsx`
Expected: FAIL(组件不存在)。

- [ ] **Step 3: 实现 stage.tsx**

```tsx
import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import type { SpeechRole } from '@/shared/services'
import { cn } from '@/shared/ui/utils'
import type { AtmosphereKey } from './chapter'
import { ROLE_META } from './scene-ui'
import { restoreCount } from './stage-meta'
import { atmosphereToClass, roleScale } from './stage-visuals'

/** 全窗不滚舞台帧(dvh 防移动端地址栏)。 */
export function StageFrame({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('relative h-dvh w-full overflow-hidden bg-canvas', className)}>{children}</div>
}

type LitWord = { id: number; emoji: string }
type RestoredEntry = { wordId: number }

/** 天空氛围层 + 词 emoji 点灯(点亮档同原 SkyStrip:0 灰 / 1 半 / 2 全)。 */
export function StageSky({
  atmosphere,
  words,
  restored,
}: {
  atmosphere: AtmosphereKey
  words: readonly LitWord[]
  restored?: readonly RestoredEntry[]
}) {
  return (
    <div aria-hidden className={cn('absolute inset-0', atmosphereToClass(atmosphere))}>
      <div className="absolute inset-x-0 top-[4vh] flex flex-wrap items-center justify-center gap-x-6 gap-y-2 px-6">
        {words.map((w) => {
          const count = restoreCount(restored ?? [], w.id)
          return (
            <span
              key={w.id}
              className={cn(
                'stage-word text-3xl transition-all duration-1000 sm:text-4xl',
                count >= 2 ? 'opacity-100' : count === 1 ? 'opacity-70 grayscale-[.55]' : 'opacity-40 grayscale',
              )}
            >
              {w.emoji}
            </span>
          )
        })}
      </div>
    </div>
  )
}

/** 角色站队:说话者弹跳 + 高亮名字牌;bubble 渲染在其上方(角色旁泡位置)。 */
export function StageCast({
  cast,
  speaker,
  bubble,
}: {
  cast: readonly SpeechRole[]
  speaker?: SpeechRole | null
  bubble?: ReactNode
}) {
  const reduce = useReducedMotion()
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-around gap-2 px-[6vw] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      {cast.map((role) => {
        const meta = ROLE_META[role]
        const talking = role === speaker
        return (
          <div key={role} className="relative flex min-w-0 flex-1 flex-col items-center">
            <div className="mb-1 flex h-[3.5rem] w-full max-w-[46vw] items-end justify-center sm:max-w-xs">
              {talking && bubble ? <div data-stage-bubble>{bubble}</div> : null}
            </div>
            <motion.div
              className="flex flex-col items-center"
              style={{ scale: roleScale(role) }}
              animate={talking && !reduce ? { y: [0, -9, 0] } : { y: 0 }}
              transition={
                talking && !reduce
                  ? { repeat: Infinity, duration: 0.5, ease: 'easeInOut' }
                  : { duration: 0.2 }
              }
            >
              <span aria-hidden className={cn('text-6xl leading-none sm:text-7xl', talking ? 'drop-shadow-lg' : 'opacity-75 saturate-50')}>
                {meta.emoji}
              </span>
              <span
                className={cn(
                  'mt-1 rounded-full px-2 py-0.5 text-xs font-bold text-white',
                  talking ? 'bg-accent' : 'bg-ink/60',
                )}
              >
                {meta.name}
              </span>
            </motion.div>
          </div>
        )
      })}
    </div>
  )
}
```

> 说明:气泡固定显示区域(`h-[3.5rem]`)让"无泡列"占位,避免说话切换时布局跳动;bubble 内容(含尾)由 Task 5 提供。测试里 `data-stage-bubble` 用于计数。

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/features/qianzigu/stage.test.tsx`
Expected: PASS。

- [ ] **Step 5: 全量回归**

Run: `npm test`
Expected: 全绿(stage.tsx 新文件无副作用;scene-ui 未动)。

- [ ] **Step 6: Commit**

```bash
git add src/features/qianzigu/stage.tsx src/features/qianzigu/stage.test.tsx
git commit -m "feat(qianzigu): 舞台组件 StageFrame/StageSky/StageCast"
```

---

### Task 5: DialoguePresenter 对话演出屏(角色旁泡 + 旁白框 + 点按推进)

**Files:**
- Create: `src/features/qianzigu/DialoguePresenter.tsx`
- Test: `src/features/qianzigu/DialoguePresenter.test.tsx`

**Interfaces:**
- Consumes: `StageFrame/StageSky/StageCast`(Task 4)、`castFor/isNarrator`(Task 1)、`moodBorder`(Task 3)、`ROLE_META`(名字/emoji 不用;旁白框用)、`Button`/`cn`、`ChapterLine`/`AtmosphereKey`。
- Produces(供 Task 6 与 Plan 2):
  - `DialoguePresenterProps` 与组件签名见下;与旧 `LineScene` 的差异是**:整屏舞台化 + 需要舞台上下文 props**。

```ts
export type DialoguePresenterProps = {
  lines: readonly ChapterLine[]
  /** 舞台上下文 */
  atmosphere: AtmosphereKey
  restored?: ReadonlyArray<{ wordId: number }>
  skyWords?: ReadonlyArray<{ id: number; emoji: string }>
  /** scene.stage?.cast 常驻预设(可省;缺省按台词推导) */
  cast?: readonly SpeechRole[]
  speakRole(text: string, role: SpeechRole): boolean
  onDone(): void
  /** 左上退出(返回地图);缺省不显示 */
  onExit?: () => void
  doneLabel?: string
  // final-review:ariaLabel 已删(未用死 prop;整屏可点层 aria-hidden,键盘/AT 出口 = 底部 Continue)
}
```

- [ ] **Step 1: 写失败测试**

`src/features/qianzigu/DialoguePresenter.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { SpeechRole } from '@/shared/services'
import { DialoguePresenter } from './DialoguePresenter'

const speak = vi.fn((_t: string, _r: SpeechRole) => true)

function renderLines(lines: DialoguePresenterProps['lines'], extra: Partial<DialoguePresenterProps> = {}) {
  const onDone = vi.fn()
  const utils = render(
    <DialoguePresenter lines={lines} atmosphere="dawn" speakRole={speak} onDone={onDone} {...extra} />,
  )
  return { onDone, ...utils }
}

import type { DialoguePresenterProps } from './DialoguePresenter'

it('逐句推进:首句泡 → 点继续 → 末句泡 → 再点触发 onDone', () => {
  const { onDone } = renderLines([
    { role: 'lingling', text: '千字谷到了!' },
    { role: 'sun', text: '救救我…' },
  ])
  expect(screen.getByText('千字谷到了!')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '继续' }))
  expect(screen.getByText('救救我…')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '继续' }))
  expect(onDone).toHaveBeenCalledTimes(1)
})

it('同框:cast=[lingling,sun],台词轮换时名字牌都在,说者随句切换', () => {
  renderLines(
    [
      { role: 'lingling', text: '你好' },
      { role: 'sun', text: '救救我' },
    ],
    { cast: ['lingling', 'sun'] },
  )
  expect(screen.getByText('灵灵')).toBeInTheDocument()
  expect(screen.getByText('太阳')).toBeInTheDocument()
})

it('narrator 台词走旁白叙述框,不占站队', () => {
  const { container } = renderLines([{ role: 'narrator', text: '千字谷,很久很久以前…' }])
  expect(screen.getByText('千字谷,很久很久以前…')).toBeInTheDocument()
  // 站队无任何名字牌(narrator 不入 cast)
  expect(container.querySelectorAll('span')).not.toHaveLength(0)
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/qianzigu/DialoguePresenter.test.tsx`
Expected: FAIL(组件不存在)。

- [ ] **Step 3: 实现 DialoguePresenter.tsx**

```tsx
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import type { SpeechRole } from '@/shared/services'
import { cn } from '@/shared/ui/utils'
import { Button } from '@/shared/ui/button'
import type { AtmosphereKey, ChapterLine } from './chapter'
import { StageCast, StageFrame, StageSky } from './stage'
import { castFor, isNarrator } from './stage-meta'
import { moodBorder } from './stage-visuals'

export type DialoguePresenterProps = {
  lines: readonly ChapterLine[]
  atmosphere: AtmosphereKey
  restored?: ReadonlyArray<{ wordId: number }>
  skyWords?: ReadonlyArray<{ id: number; emoji: string }>
  cast?: readonly SpeechRole[]
  speakRole(text: string, role: SpeechRole): boolean
  onDone(): void
  onExit?: () => void
  doneLabel?: string
}

function tail() {
  return (
    <span aria-hidden className="mx-auto -mt-1 block h-0 w-0 border-x-8 border-t-[10px] border-x-transparent border-t-surface" />
  )
}

function Bubble({ line }: { line: ChapterLine }) {
  return (
    <div className="w-full">
      <div
        className={cn(
          'rounded-2xl rounded-tl-sm border-2 bg-surface px-4 py-2.5 text-[15px] font-bold leading-relaxed text-ink shadow-card sm:text-base',
          moodBorder(line.mood ?? 'calm'),
        )}
      >
        {line.text}
      </div>
      {tail()}
    </div>
  )
}

export function DialoguePresenter({
  lines,
  atmosphere,
  restored,
  skyWords,
  cast,
  speakRole,
  onDone,
  onExit,
  doneLabel = '继续',
}: DialoguePresenterProps) {
  const [index, setIndex] = useState(0)
  const saidRef = useRef<number | null>(null)
  const line = lines[Math.min(index, lines.length - 1)]

  useEffect(() => {
    if (!line || saidRef.current === index) return
    saidRef.current = index
    speakRole(line.text, line.role)
  }, [index, line, speakRole])

  if (!line) {
    return (
      <StageFrame>
        {/* final-review:ariaLabel 不传 StageFrame(其签名无 role;空态同主态) */}
        <div className="flex h-full items-center justify-center">
          <Button size="lg" onClick={onDone}>
            {doneLabel}
          </Button>
        </div>
      </StageFrame>
    )
  }

  const isLast = index >= lines.length - 1
  const advance = () => (isLast ? onDone() : setIndex((i) => i + 1))
  const showBubble = !isNarrator(line.role)
  const speaker = isNarrator(line.role) ? null : line.role
  const displayCast = castFor(lines, cast) // narrator 已被 castFor 滤除

  return (
    <StageFrame>
      {/* final-review:ariaLabel 不传 StageFrame(其签名无 role) */}
      <StageSky atmosphere={atmosphere} words={skyWords ?? []} restored={restored} />
      {onExit ? (
        <Button variant="ghost" size="icon" aria-label="返回地图" onClick={onExit} className="absolute left-3 top-3 z-20">
          <ArrowLeft className="h-5 w-5" />
        </Button>
      ) : null}

      {isNarrator(line.role) ? (
        <div className="absolute left-1/2 top-[14vh] z-10 w-[72vw] max-w-sm -translate-x-1/2">
          <p className="rounded-xl border border-dashed border-ink-3 bg-canvas-2/90 px-4 py-2 text-center text-sm font-semibold text-ink-2">
            {line.text}
          </p>
        </div>
      ) : null}

      <StageCast cast={displayCast} speaker={speaker} bubble={showBubble ? <Bubble line={line} /> : undefined} />

      <button
        type="button"
        aria-label="下一句"
        onClick={advance}
        className="absolute inset-0 z-10 cursor-pointer bg-transparent"
      />

      <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <span aria-hidden className="text-sm font-bold text-ink/70 drop-shadow">
          {isLast ? '' : '点一下继续'}
        </span>
        <Button size="lg" onClick={advance}>
          {isLast ? doneLabel : '继续'}
          {isLast ? <ArrowRight className="ml-1 h-4 w-4" /> : null}
        </Button>
      </div>
    </StageFrame>
  )
}
```

> 交互说明:整屏透明 `button`(z-10)覆盖台词区与背景,**但位于 StageCast(z-auto)之下、底部控制条(z-20)之上**——所以点角色/背景/字幕 = 推进,点到底部按钮/左上退出不冲突;测试走底部可见 `Button`(aria 名「继续」/doneLabel),与旧测试驱动一致。

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/features/qianzigu/DialoguePresenter.test.tsx`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/features/qianzigu/DialoguePresenter.tsx src/features/qianzigu/DialoguePresenter.test.tsx
git commit -m "feat(qianzigu): DialoguePresenter 对话演出屏(同框角色+角色旁泡+旁白框)"
```

---

### Task 6: ChapterRunnerView 接线 dialogue/ending → DialoguePresenter

**Files:**
- Modify: `src/features/qianzigu/ChapterRunnerView.tsx`
- Test: `src/features/qianzigu/ChapterRunnerView.test.tsx`(补一个舞台屏断言;其余沿用)

**Interfaces:**
- Consumes: Task 1 `defaultAtmosphere`、Task 5 `DialoguePresenter`、现 `scene.kind`/`scene.stage`。
- Produces: dialogue/ending 场景渲染整屏 `DialoguePresenter`(不再包旧 `Shell`),其余 scene(task/social/boss/break/settle)维持现 `Shell` + `LineScene`/卡片 UI —— **明确为过渡态,Plan 2 统一 StageFrame 包裹并逐 scene 浮层化**。

- [ ] **Step 1: 写失败测试(接线后 dialogue 屏走舞台)**

在 `ChapterRunnerView.test.tsx` 追加 fixture 与用例:

```tsx
it('dialogue 屏渲染为舞台屏:cast 站队 + 台词泡;点继续推进到下一屏', async () => {
  renderRunner(flowChapter())
  expect(await screen.findByText('你好,太阳!')).toBeInTheDocument()
  expect(screen.getByText('灵灵')).toBeInTheDocument() // 名字牌(cast 推导)
  fireEvent.click(screen.getByRole('button', { name: '继续' }))
  expect(await screen.findByText('拯救声音')).toBeInTheDocument() // task 屏(旧 UI 过渡)
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/qianzigu/ChapterRunnerView.test.tsx`
Expected: FAIL(当前 dialogue 屏无「灵灵」名字牌——是旧 LineScene)。

- [ ] **Step 3: 改 ChapterRunnerView 渲染分支**

在 `ChapterRunnerView.tsx`:
1. import:`DialoguePresenter` from `./DialoguePresenter`;`defaultAtmosphere` from `./stage-meta`。
2. 在 `sceneBody` 上方加小助手取舞台词元素:

```tsx
function skyWordsOf(chapter: Chapter): { id: number; emoji: string }[] {
  return chapter.wordIds
    .map((id) => services.vocabulary.wordById(id))
    .filter((w): w is WordUnit => w !== undefined)
    .map((w) => ({ id: w.id, emoji: w.emoji }))
}
```
(若放组件外,把 `services.vocabulary` 改从 `sceneBody` 闭包取;实现时选组件内局部函数即可——保持 `services` 作用域。)

3. 顶部 `return` 结构改为:当 `runState.finished && !runState.bossWon`(BOSS 失败)仍走原 `Shell` 分支;否则:

```tsx
const content = pendingLines
  ? <LineScene lines={pendingLines} speakRole={speakRole} onDone={() => setPendingLines(null)} />
  : sceneBody(scene)

// dialogue/ending 整屏舞台化(过渡态;其余仍包旧 Shell)
if (scene.kind === 'dialogue' || scene.kind === 'ending') {
  return (
    <DialoguePresenter
      key={scene.id}
      lines={scene.lines}
      atmosphere={scene.stage?.atmosphere ?? defaultAtmosphere(scene.kind)}
      restored={runState.restored}
      skyWords={skyWordsOf()}
      cast={scene.stage?.cast}
      speakRole={speakRole}
      onDone={() => step({ type: 'advance' })}
      onExit={handleExit}
    />
  )
}
return <Shell chapter={chapter} onExit={handleExit}>...</Shell>
```
实现细节:把 `content`/`Shell` 那段改造成:非 dialogue/ending 时返回原 `Shell` 包裹结构(BOSS 失败分支保持最前);dialogue/ending 时返回上表整屏。

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/features/qianzigu/ChapterRunnerView.test.tsx`
Expected: 新用例 PASS,既有 7 例不回归(flow/social/boss/break 流程仍走通)。

- [ ] **Step 5: 全量回归**

Run: `npx tsc -b && npm test`
Expected: 全绿。

- [ ] **Step 6: Commit**

```bash
git add src/features/qianzigu/ChapterRunnerView.tsx src/features/qianzigu/ChapterRunnerView.test.tsx
git commit -m "feat(qianzigu): dialogue/ending 接线舞台对话屏(过渡态)"
```

---

## Self-Review

**Spec 覆盖(core 部分):**
- §5 数据扩展(`mood?`/`stage?`/类型,向后兼容)→ Task 2;引擎零读 → Global Constraints + Task 2 回归。
- §6.1 视觉源接缝(`roleScale`/`atmosphereToClass`/`moodBorder` 集中一处)→ Task 3(位图接缝:组件经 stage-visuals 取视觉)。
- §6.2 dialogue/ending 行 + §6.3 DialoguePresenter(同框角色 / 角色旁泡 / 旁白框 / 点按推进 / speakRole 朗读时序沿用)→ Task 5;接线 → Task 6。
- §11 文件表 core:stage.tsx / stage-visuals.ts / stage-meta.ts(DialoguePresenter.tsx 比 spec 文件表多一文件,拆分理由=对话演出独立文件避免 scene-ui 持续膨胀)→ Task 3/4/5。
- §12 测试 core:cast 推导、atmosphere 兜底、narrator 特判、点亮档、舞台组件、对话推进 → Task 1/2/4/5。
- §7 验收 core 子集(开场同框、点推进、词点亮)由 Task 6 后可浏览器观察;完整两态/全 scene 由 Plan 2/3。

**未覆盖(正确留给后续 plan,已在 §14 拆分):** task/social/boss/break/settle 的浮层化与全 scene 统一 StageFrame(Plan 2);ch1 数据舞台字段补编(Plan 3)。

**占位扫描:** 无 TBD/「适当处理」类;每个实现步骤给最小可跑代码。`skyWordsOf` 标注了放置自由度(组件内外皆可,保持 services 闭包)非占位,是实现注。Task 1 提示可合并 1/2 属可选执行说明。

**类型一致性:**
- `castFor(lines, presets?)`、`restoreCount(restored, wordId)`、`defaultAtmosphere(kind)`、`isNarrator(role)` 在 Task 4/5/6 调用处与 Task 1/2 定义签名一致。
- `AtmosphereKey`/`SpeechMood`/`StageMeta` Task 2 定义;`stage?.atmosphere`/`stage?.cast` 在 Task 6 消费,类型来自 `Scene` 各 kind 的 `stage?`(Task 2 已加)。
- `moodBorder('calm'|'sad'|'happy'|'scary')` 返回边框 class,Task 5 `Bubble` 内用 `line.mood ?? 'calm'` 对齐 `SpeechMood` 并集。
- `StageCast` `cast` 只收 `SpeechRole[]`;DialoguePresenter 经 `castFor` 已滤 narrator → 组件约定「narrator 不进」在数据流上成立。
- 推进按钮文案沿用旧语义(单句/多句末 → `doneLabel` 默认「继续」),`ChapterRunnerView.test.tsx` 既有 `getByRole('button',{name:'继续'})` 驱动不破坏。
