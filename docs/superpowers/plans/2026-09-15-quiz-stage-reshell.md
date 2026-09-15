# 题面舞台化实施计划(答题卡壳 → 游戏演出壳)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把「题干居中大标题 + 2×2 等距网格 + 确定按钮」的答题卡观感换成题面气泡 + 错落词石 + 施法钮的游戏演出壳,并补齐对错的形状冗余。

**Architecture:** 视觉统一发生在 `src/shared/ui/quiz/` **内部** —— 题型组件契约不变,4 个消费点调用代码基本不动,只再去掉各自的外层白卡。新增三个中性 UI 片段(`QuestionBubble` / `stone.ts` / `CastButton`)承载全部新观感,`Choice` / `ListenChoice` / `MatchGame` 只把渲染换成它们,判分/选中/朗读/a11y 状态机整块保留。

**Tech Stack:** React 19 + TypeScript + Tailwind 4(token 在 `src/index.css`)+ motion(`motion/react`)+ vitest / @testing-library(jsdom)。

**Spec:** `docs/superpowers/specs/2026-09-15-quiz-stage-reshell-design.md`

## Global Constraints

- **零动红线**:`question-engine`、`progress`、判分语义(`2 次作答` / `reveal` / `minCorrect`)、`speech` 服务、`Question` 数据形状、`AudioCue` **一律不改**。
- **提交钮文案逐字为** `就它了!` —— 全角感叹号 `!`(U+FF01)**禁止**;测试按精确字符串匹配,混用会静默失配。
- **选项按钮的 accessible name 必须保持 = 选项文本**。任何新增的角标、图标、修饰节点**必须** `aria-hidden="true"`。测试全靠 `getByRole('button', { name: '<选项文本>' })` 定位选项。
- **不得用 `opacity` 压暗表达状态**(破 4.5:1 对比);状态靠 token 色 + 形状(✓/✗)表达。
- **动效一律走 motion 的 transform/opacity API**,不写裸 CSS `animation` —— 全局 `MotionConfig reducedMotion="user"`(`src/app/App.tsx:249`)才能兜底减动效。
- **尺寸用 rem / Tailwind 间距 token**,不写死 `px`(文字缩放 2× 要求)。
- **`shared/` 禁引 `features/`**:气泡造型**照抄** `DialoguePresenter.tsx` 的 `Bubble` 参数,但**不复用其组件**,也不引 `stage-visuals.ts` 的 `moodBorder`。
- 每个任务结束 `npx vitest run <改动涉及的测试文件>` 须绿;全部任务结束 `npm test`(基线 **65 文件 / 416 测试**)与 `npm run lint`(0 error)须绿。
- 提交信息用仓库既有风格(`feat(quiz):` / `refactor(quiz):` / `test(quiz):`)。

---

## File Structure

**新建(`src/shared/ui/quiz/`)**

| 文件 | 职责 |
| --- | --- |
| `stone.ts` | 词石状态 → 样式/角标/错落的**纯函数**。无 React,可单测。 |
| `stone.test.ts` | 上述纯函数的单测。 |
| `QuestionBubble.tsx` | 题面气泡框:署名行 + 可选大图 emoji + 题干文本 + 三角尾;可选整块重听。不含判分逻辑。 |
| `QuestionBubble.test.tsx` | 气泡单测(署名/emoji/重听钮 a11y)。 |
| `CastButton.tsx` | 施法钮:文案常量 + 薄封装 `Button`。 |
| `CastButton.test.tsx` | 施法钮单测(文案逐字 / disabled 透传)。 |

**修改(`src/shared/ui/quiz/`)**:`Choice.tsx`(换渲染)· `ListenChoice.tsx`(标题行造型)· `MatchGame.tsx`(词石化 + ✗ 冗余)· `TypeBadge.tsx`(卷轴造型)

**修改(消费点)**:`features/qianzigu/scene-ui.tsx` · `features/lesson/WordLesson.tsx` · `features/foundation/TeachOverlay.tsx` · `features/foundation/ColdStartWizard.tsx`

**修改(测试,「确定」→「就它了!」共 9 文件)**:`shared/ui/quiz/Choice.test.tsx` · `shared/ui/quiz/ListenChoice.test.tsx` · `lesson/WordLesson.test.tsx` · `foundation/TeachOverlay.test.tsx` · `foundation/ColdStartWizard.test.tsx` · `foundation/FoundationStepGate.test.tsx` · `qianzigu/scene-ui.test.tsx` · `qianzigu/ChapterRunnerView.test.tsx` · `app/App.test.tsx`

**修改(文档)**:`docs/design/game-visual.md`

---

### Task 1: 词石纯函数 `stone.ts`

**Files:**
- Create: `src/shared/ui/quiz/stone.ts`
- Test: `src/shared/ui/quiz/stone.test.ts`

**Interfaces:**
- Consumes: 无(叶子模块)
- Produces:
  - `type StoneState = 'idle' | 'selected' | 'correct' | 'wrong' | 'muted'`
  - `function stoneClass(state: StoneState, index?: number): string`
  - `function stoneMark(state: StoneState): '✓' | '✗' | null`
  - `function stoneMarkClass(state: StoneState): string`
  - `function stoneOffset(index: number): string`

- [ ] **Step 1: Write the failing test**

创建 `src/shared/ui/quiz/stone.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { stoneClass, stoneMark, stoneMarkClass, stoneOffset } from './stone'

describe('stone 词石纯函数', () => {
  it('对错态各自给出形状冗余角标(色彩冗余:红绿之外给形状)', () => {
    expect(stoneMark('correct')).toBe('✓')
    expect(stoneMark('wrong')).toBe('✗')
  })

  it('无冗余态不挂角标', () => {
    expect(stoneMark('idle')).toBeNull()
    expect(stoneMark('selected')).toBeNull()
    expect(stoneMark('muted')).toBeNull()
  })

  it('角标底色随对错取 token', () => {
    expect(stoneMarkClass('correct')).toContain('bg-emerald')
    expect(stoneMarkClass('wrong')).toContain('bg-red')
    expect(stoneMarkClass('idle')).toBe('')
  })

  it('对/错/选中各自用 token 色,且不出现 opacity 压暗', () => {
    expect(stoneClass('correct')).toContain('border-emerald/70')
    expect(stoneClass('wrong')).toContain('border-red')
    expect(stoneClass('selected')).toContain('border-accent')
    for (const s of ['idle', 'selected', 'correct', 'wrong', 'muted'] as const) {
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/ui/quiz/stone.test.ts`
Expected: FAIL —— `Failed to resolve import "./stone"`

- [ ] **Step 3: Write minimal implementation**

创建 `src/shared/ui/quiz/stone.ts`:

```ts
import { cn } from '@/shared/ui/utils'

/** 词石状态。reveal(双错后亮出正确答案)与 correct 同形 —— 视觉上都表示「这块是对的」。 */
export type StoneState = 'idle' | 'selected' | 'correct' | 'wrong' | 'muted'

const STONE_BASE =
  'relative flex min-h-[84px] flex-col items-center justify-center gap-1.5 border-2 px-3 py-3 text-center transition-colors'

const STONE_STATE: Record<StoneState, string> = {
  idle: 'border-hairline bg-surface text-ink hover:border-accent/60 hover:shadow-card',
  selected: 'border-accent bg-accent-tint text-ink shadow-card ring-2 ring-accent/40',
  correct: 'border-emerald/70 bg-emerald/10 text-ink ring-2 ring-emerald/30',
  wrong: 'border-red bg-red-tint text-red',
  muted: 'border-hairline bg-surface-2 text-ink-2',
}

/** 两列不同圆角半径:同一词石在左右两列外形不同,破「等距方阵」的答题卡感。 */
const STONE_SHAPE = ['rounded-3xl', 'rounded-[1.75rem] rounded-tr-md'] as const

export function stoneClass(state: StoneState, index = 0): string {
  return cn(STONE_BASE, STONE_SHAPE[index % STONE_SHAPE.length], STONE_STATE[state])
}

/** 错落:奇数列整体下移,破坏逐行等距。 */
export function stoneOffset(index: number): string {
  return index % 2 === 1 ? 'translate-y-1.5' : ''
}

/** 色彩冗余:对错在红绿之外再给形状(约 8% 男性红绿色盲看不出红=错)。无冗余态返回 null。 */
export function stoneMark(state: StoneState): '✓' | '✗' | null {
  if (state === 'correct') return '✓'
  if (state === 'wrong') return '✗'
  return null
}

export function stoneMarkClass(state: StoneState): string {
  if (state === 'correct') return 'bg-emerald text-white'
  if (state === 'wrong') return 'bg-red text-white'
  return ''
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/ui/quiz/stone.test.ts`
Expected: PASS(6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/shared/ui/quiz/stone.ts src/shared/ui/quiz/stone.test.ts
git commit -m "feat(quiz): 词石纯函数(四态样式 + 对错形状冗余 + 错落)"
```

---

### Task 2: 题面气泡 `QuestionBubble.tsx`

**Files:**
- Create: `src/shared/ui/quiz/QuestionBubble.tsx`
- Test: `src/shared/ui/quiz/QuestionBubble.test.tsx`

**Interfaces:**
- Consumes: 无
- Produces:
  - `type QuestionBubbleProps = { prompt: string; asker?: string; emoji?: string; onReplay?: () => void }`
  - `const DEFAULT_ASKER = '📜 魔法书'`
  - `function QuestionBubble(props: QuestionBubbleProps)`

- [ ] **Step 1: Write the failing test**

创建 `src/shared/ui/quiz/QuestionBubble.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DEFAULT_ASKER, QuestionBubble } from './QuestionBubble'

describe('QuestionBubble 题面气泡', () => {
  afterEach(cleanup)

  it('渲染题干与默认出题者署名', () => {
    render(<QuestionBubble prompt="这个字读什么?" />)
    expect(screen.getByText('这个字读什么?')).toBeTruthy()
    expect(screen.getByText(DEFAULT_ASKER)).toBeTruthy()
  })

  it('asker 传空串则不渲染署名行', () => {
    render(<QuestionBubble prompt="这个字读什么?" asker="" />)
    expect(screen.queryByText(DEFAULT_ASKER)).toBeNull()
  })

  it('无 onReplay 时题干不是按钮(否则会污染 a11y 树)', () => {
    render(<QuestionBubble prompt="这个字读什么?" />)
    expect(screen.queryByRole('button', { name: '再听一遍' })).toBeNull()
  })

  it('有 onReplay 时整块为「再听一遍」重听区,点击回调', () => {
    const onReplay = vi.fn()
    render(<QuestionBubble prompt="这个字读什么?" onReplay={onReplay} />)
    fireEvent.click(screen.getByRole('button', { name: '再听一遍' }))
    expect(onReplay).toHaveBeenCalledTimes(1)
  })

  it('emoji 为装饰:不贡献 accessible name', () => {
    render(<QuestionBubble prompt="太阳" emoji="☀️" onReplay={() => {}} />)
    expect(screen.getByRole('button', { name: '再听一遍' })).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/ui/quiz/QuestionBubble.test.tsx`
Expected: FAIL —— `Failed to resolve import "./QuestionBubble"`

- [ ] **Step 3: Write minimal implementation**

创建 `src/shared/ui/quiz/QuestionBubble.tsx`:

```tsx
import { cn } from '@/shared/ui/utils'

/** 出题者署名默认值:无角色语境(词课/短教/冷启动)时统一由此位代言。 */
export const DEFAULT_ASKER = '📜 魔法书'

export type QuestionBubbleProps = {
  prompt: string
  /** 出题者署名;传空串则不渲染署名行 */
  asker?: string
  /** 题干大图 emoji(装饰,aria-hidden) */
  emoji?: string
  /** 有 promptSpeak 时传:整块变成「再听一遍」重听区 */
  onReplay?: () => void
}

/**
 * 题面气泡:替代「居中大标题」,给题目一个「谁在问」的说话者感。
 * 造型对齐 DialoguePresenter 的 Bubble(左上小圆角 + 三角尾),但代码不耦合 —— shared 禁引 features。
 */
export function QuestionBubble({ prompt, asker = DEFAULT_ASKER, emoji, onReplay }: QuestionBubbleProps) {
  const content = (
    <>
      {asker ? <span className="text-xs font-bold tracking-widest text-ink-3">{asker}</span> : null}
      {emoji ? (
        <span aria-hidden className="text-6xl leading-none drop-shadow-sm">
          {emoji}
        </span>
      ) : null}
      <span className="text-lg font-bold leading-snug text-ink">{prompt}</span>
    </>
  )

  const boxCls = cn(
    'relative mx-auto flex w-full flex-col items-center gap-1.5 rounded-2xl rounded-tl-sm border-2 border-hairline bg-surface px-4 py-3 text-center shadow-card',
    onReplay && 'transition-colors hover:bg-accent-tint/60 active:scale-[0.99]',
  )

  return (
    <div className="pb-2">
      {onReplay ? (
        <button type="button" aria-label="再听一遍" onClick={onReplay} className={boxCls}>
          {content}
        </button>
      ) : (
        <div className={boxCls}>{content}</div>
      )}
      {/* 尾:指向出题者(左下) */}
      <span
        aria-hidden
        className="ml-6 block h-0 w-0 border-x-8 border-t-[10px] border-x-transparent border-t-surface"
      />
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/ui/quiz/QuestionBubble.test.tsx`
Expected: PASS(5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/shared/ui/quiz/QuestionBubble.tsx src/shared/ui/quiz/QuestionBubble.test.tsx
git commit -m "feat(quiz): 题面气泡(替题干居中大标题)"
```

---

### Task 3: 施法钮 `CastButton.tsx`

**Files:**
- Create: `src/shared/ui/quiz/CastButton.tsx`
- Test: `src/shared/ui/quiz/CastButton.test.tsx`

**Interfaces:**
- Consumes: `Button`(`@/shared/ui/button`)
- Produces:
  - `const CAST_LABEL = '就它了!'`
  - `function CastButton({ disabled, onClick }: { disabled: boolean; onClick: () => void })`

- [ ] **Step 1: Write the failing test**

创建 `src/shared/ui/quiz/CastButton.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CAST_LABEL, CastButton } from './CastButton'

describe('CastButton 施法钮', () => {
  afterEach(cleanup)

  it('文案逐字为「就它了!」(半角感叹号,见 spec D4)', () => {
    render(<CastButton disabled={false} onClick={() => {}} />)
    expect(CAST_LABEL).toBe('就它了!')
    expect(screen.getByRole('button', { name: CAST_LABEL })).toBeTruthy()
  })

  it('disabled 透传:禁用时不触发 onClick', () => {
    const onClick = vi.fn()
    render(<CastButton disabled onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: CAST_LABEL }))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('可用时触发 onClick', () => {
    const onClick = vi.fn()
    render(<CastButton disabled={false} onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: CAST_LABEL }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/ui/quiz/CastButton.test.tsx`
Expected: FAIL —— `Failed to resolve import "./CastButton"`

- [ ] **Step 3: Write minimal implementation**

创建 `src/shared/ui/quiz/CastButton.tsx`:

```tsx
import { Button } from '@/shared/ui/button'

/** 提交钮文案。感叹号写死为 ASCII `!`(U+0021)—— 测试按精确字符串匹配,换全角会静默失配。 */
export const CAST_LABEL = '就它了!'

/** 施法钮:替代「确定」,去掉交卷感。措辞与造型都集中在此,消费点只传状态。 */
export function CastButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <Button size="lg" className="w-full sm:w-auto sm:min-w-52" disabled={disabled} onClick={onClick}>
      {CAST_LABEL}
      <span aria-hidden className="ml-1">
        ✨
      </span>
    </Button>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/ui/quiz/CastButton.test.tsx`
Expected: PASS(3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/shared/ui/quiz/CastButton.tsx src/shared/ui/quiz/CastButton.test.tsx
git commit -m "feat(quiz): 施法钮(替「确定」)"
```

---

### Task 4: `Choice.tsx` 换渲染(气泡 + 词石 + 施法钮)

**Files:**
- Modify: `src/shared/ui/quiz/Choice.tsx:73-151`(return 块)
- Test: `src/shared/ui/quiz/Choice.test.tsx`

**Interfaces:**
- Consumes: `QuestionBubble`(Task 2)· `CastButton` / `CAST_LABEL`(Task 3)· `stoneClass` / `stoneMark` / `stoneMarkClass` / `stoneOffset` / `StoneState`(Task 1)
- Produces: `ChoiceProps` **不变**(`prompt` / `promptSpeak` / `promptEmoji` / `skill` / `options` / `disabled` / `revealId` / `correctId` / `wrongId` / `showBadge` / `speak` / `onAnswer`)—— 消费点零改的前提

- [ ] **Step 1: 更新测试(先改断言,看它失败)**

`src/shared/ui/quiz/Choice.test.tsx`:把全部 `{ name: '确定' }` 改为 `{ name: '就它了!' }`,并把 `describe` 标题与两条注释勘误。

```ts
import { CAST_LABEL } from './CastButton'
```

- 第 18 行 `describe('Choice 确认制(点听 · 确定提交)')` → `describe('Choice 确认制(点听 · 施法钮提交)')`
- 第 32 行 `it('未选中「确定」禁用;点卡先念(缺 speak 读文本)再放开')` → `it('未选中「就它了!」禁用;点卡先念(缺 speak 读文本)再放开')`
- 第 34/37/43/46/53/63/76 行的 `{ name: '确定' }` 全部 → `{ name: CAST_LABEL }`
- 第 40 行 `it('「确定」才提交;提交后清空选中,须重选再答')` → `it('「就它了!」才提交;提交后清空选中,须重选再答')`
- 第 74 行 `it('disabled:不渲染「确定」,选项禁用')` → `it('disabled:不渲染「就它了!」,选项禁用')`

新增两条词石断言,追加在 `describe` 内:

```tsx
  it('对错带形状冗余角标(data-state 可测,色彩冗余的可测化)', () => {
    const { rerender } = renderChoice()
    fireEvent.click(screen.getByRole('button', { name: 'A' }))
    fireEvent.click(screen.getByRole('button', { name: CAST_LABEL }))
    rerender(<Choice prompt="选出正确的一个" skill="pinyin" options={options} speak={speak} onAnswer={onAnswer} correctId="a" />)
    expect(screen.getByRole('button', { name: 'A' })).toHaveAttribute('data-state', 'correct')
  })

  it('答错态挂 ✗ 冗余且不靠透明度压暗', () => {
    renderChoice({ wrongId: 'a' })
    const btn = screen.getByRole('button', { name: 'A' })
    expect(btn).toHaveAttribute('data-state', 'wrong')
    expect(btn.className).not.toMatch(/\bopacity-/)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/ui/quiz/Choice.test.tsx`
Expected: FAIL —— `Unable to find an accessible element with the role "button" and name "就它了!"`(实现仍渲染「确定」)

- [ ] **Step 3: 换渲染**

`src/shared/ui/quiz/Choice.tsx` 顶部 import 加:

```tsx
import { QuestionBubble } from './QuestionBubble'
import { CastButton } from './CastButton'
import { stoneClass, stoneMark, stoneMarkClass, stoneOffset, type StoneState } from './stone'
```

删除本文件里的 `cardCls` 函数(`:28-42`,职责已由 `stone.ts` 承接)。

把 `return (` 起至文件末的整块(`:73-151`)替换为:

```tsx
  return (
    <div className="space-y-5">
      {showBadge ? (
        <div className="flex justify-start">
          <TypeBadge kind="choice" />
        </div>
      ) : null}

      <QuestionBubble
        prompt={prompt}
        emoji={promptEmoji}
        onReplay={promptSpeak ? () => speakCard(speak, skill, promptSpeak) : undefined}
      />

      <div className="grid grid-cols-2 gap-3">
        {options.map((o, i) => {
          const state: StoneState =
            revealId === o.id || correctId === o.id
              ? 'correct'
              : wrongId === o.id
                ? 'wrong'
                : disabled
                  ? 'muted'
                  : selected === o.id
                    ? 'selected'
                    : 'idle'
          const mark = stoneMark(state)
          return (
            <motion.button
              key={o.id}
              type="button"
              aria-disabled={disabled}
              aria-pressed={selected === o.id}
              data-state={state}
              onClick={() => handleCard(o)}
              animate={wrongId === o.id ? { x: [0, -9, 9, -6, 6, 0] } : { x: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className={cn(
                stoneClass(state, i),
                stoneOffset(i),
                !disabled && 'cursor-pointer active:scale-[0.96]',
              )}
            >
              {mark ? (
                <span
                  aria-hidden
                  className={cn(
                    'absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold shadow-card',
                    stoneMarkClass(state),
                  )}
                >
                  {mark}
                </span>
              ) : null}
              {o.emoji ? (
                <span aria-hidden className="text-3xl leading-none">
                  {o.emoji}
                </span>
              ) : null}
              <span className={cn('font-bold leading-tight', o.emoji ? 'text-[15px]' : 'text-xl')}>{o.text}</span>
            </motion.button>
          )
        })}
      </div>

      {!disabled ? (
        <div className="flex flex-col items-center gap-2 pt-1">
          <CastButton disabled={selected === null} onClick={confirm} />
        </div>
      ) : null}
    </div>
  )
```

> 注意 `promptSpeak` 的语义保持:现在由 `QuestionBubble` 的 `onReplay` 承载,`aria-label="再听一遍"` 不变 → 第 67-72 行那条测试不动即应仍绿。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/ui/quiz/Choice.test.tsx`
Expected: PASS(9 tests:原 7 + 新 2)

- [ ] **Step 5: 跑该模块全部单测**

Run: `npx vitest run src/shared/ui/quiz/`
Expected: PASS(注意 `ListenChoice.test.tsx` 此刻仍断言「确定」→ 预期 FAIL;若 FAIL 属**已知**,由 Task 8 统一收口,可继续)

- [ ] **Step 6: Commit**

```bash
git add src/shared/ui/quiz/Choice.tsx src/shared/ui/quiz/Choice.test.tsx
git commit -m "refactor(quiz): Choice 换渲染(气泡 + 词石 + 施法钮 + 对错形状冗余)"
```

---

### Task 5: `ListenChoice.tsx` 标题行换造型

**Files:**
- Modify: `src/shared/ui/quiz/ListenChoice.tsx:24-48`
- Test: `src/shared/ui/quiz/ListenChoice.test.tsx`

**Interfaces:**
- Consumes: `Choice`(Task 4 后的新渲染)· `TypeBadge`(Task 7 前的现造型)
- Produces: `ListenChoiceProps` **不变**

- [ ] **Step 1: 更新测试断言**

`src/shared/ui/quiz/ListenChoice.test.tsx`:第 47-53 行 `{ name: '确定' }` → `{ name: '就它了!' }`;文件顶部加 `import { CAST_LABEL } from './CastButton'` 并改用常量;第 47 行用例名「…+「确定」透传提交…」→「…+「就它了!」透传提交…」。

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run src/shared/ui/quiz/ListenChoice.test.tsx`
Expected: PASS —— Task 4 已换掉 `Choice` 的实现,此处**只改断言即应转绿**(本任务不新增行为,故无「先失败」步)。

- [ ] **Step 3: 标题行换造型**

`src/shared/ui/quiz/ListenChoice.tsx` 的 `return` 中,标题行(`:27-38`)整块替换为:

```tsx
      {/* 标题行:左徽章「听一听」,右喇叭 = 点击重听 */}
      <div className="flex items-center justify-between gap-2">
        <TypeBadge kind="listen-choice" />
        <motion.button
          type="button"
          aria-label="再听一遍"
          whileTap={{ scale: 0.9 }}
          onClick={() => speakCard(speak, skill, promptSpeak)}
          className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-hairline bg-surface text-ink-2 shadow-card transition-colors hover:border-accent/60 hover:text-accent"
        >
          <Volume2 className="h-5 w-5" />
        </motion.button>
      </div>
```

外层容器 `space-y-5` **不动**。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/ui/quiz/ListenChoice.test.tsx`
Expected: PASS(3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/shared/ui/quiz/ListenChoice.tsx src/shared/ui/quiz/ListenChoice.test.tsx
git commit -m "refactor(quiz): ListenChoice 标题行换造型 + 断言改施法钮"
```

---

### Task 6: `MatchGame.tsx` 词石化 + ✗ 冗余

**Files:**
- Modify: `src/shared/ui/quiz/MatchGame.tsx:95-132`(`renderCard`)
- Test: `src/shared/ui/quiz/MatchGame.test.tsx`

**Interfaces:**
- Consumes: `stoneClass` / `stoneMark` / `stoneMarkClass` / `StoneState`(Task 1)
- Produces: `MatchGameProps` **不变**;`MatchGame` **无提交钮**(配对即判),不受 `CAST_LABEL` 影响

- [ ] **Step 1: 新增冗余断言**

`src/shared/ui/quiz/MatchGame.test.tsx` 追加一条用例(放在既有 describe 内):

```tsx
  it('配错态挂 ✗ 形状冗余(data-state 可测)', () => {
    render(<MatchGame prompt="连一连" left={left} right={right} answerMap={answerMap} skill="hanzi" playSound={vi.fn()} speak={vi.fn(() => true)} onComplete={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '日' }))
    fireEvent.click(screen.getByRole('button', { name: '月' }))
    expect(screen.getByRole('button', { name: '日' })).toHaveAttribute('data-state', 'wrong')
  })
```

> `left` / `right` / `answerMap` 沿用该文件既有 fixture;若变量名不同,按实际 fixture 改写,勿新造。

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/ui/quiz/MatchGame.test.tsx`
Expected: FAIL —— 按钮无 `data-state` 属性

- [ ] **Step 3: 换渲染**

`src/shared/ui/quiz/MatchGame.tsx` 顶部 import 加:

```tsx
import { stoneClass, stoneMark, stoneMarkClass, type StoneState } from './stone'
```

`renderCard`(`:95-132`)整块替换为:

```tsx
  function renderCard(o: BaseOption, isLeft: boolean) {
    const matchedRightIds = Object.values(matched)
    const isMatched = isLeft ? matched[o.id] !== undefined : matchedRightIds.includes(o.id)
    const isSel = isLeft ? selL === o.id : selR === o.id
    const isMis = mismatch ? (isLeft ? mismatch[0] === o.id : mismatch[1] === o.id) : false
    const state: StoneState = isMatched ? 'correct' : isMis ? 'wrong' : isSel ? 'selected' : 'idle'
    const mark = stoneMark(state)
    return (
      <motion.button
        key={o.id}
        type="button"
        aria-disabled={Boolean(isMatched || mismatch || done)}
        data-state={state}
        onClick={() => (isLeft ? pickLeft(o.id) : pickRight(o.id))}
        animate={isMis ? { x: [0, -9, 9, -6, 6, 0] } : { x: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className={cn(
          stoneClass(state),
          'min-h-[64px]',
          isMatched && 'opacity-80',
          !isMatched && !mismatch && !done && 'cursor-pointer active:scale-[0.96]',
        )}
      >
        {o.emoji ? (
          <span aria-hidden className="text-2xl leading-none">
            {o.emoji}
          </span>
        ) : null}
        <span className={cn('font-bold leading-tight', o.emoji ? 'text-base' : 'text-xl')}>{o.text}</span>
        {mark ? (
          <span
            aria-hidden
            className={cn(
              'absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold shadow-card',
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

随后删除本文件的 `import { Check } from 'lucide-react'`(已由 `stoneMark` 的 ✓ 取代)。

> `stoneClass` 自带 `flex-col`,但配对卡是横排(emoji + 文本)。故在 `className` 末尾追加 `'flex-row'`,覆盖为横排:

```tsx
          stoneClass(state),
          'min-h-[64px] flex-row',
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/ui/quiz/MatchGame.test.tsx`
Expected: PASS(原 3 + 新 1)

- [ ] **Step 5: Commit**

```bash
git add src/shared/ui/quiz/MatchGame.tsx src/shared/ui/quiz/MatchGame.test.tsx
git commit -m "refactor(quiz): MatchGame 词石化 + 配错 ✗ 冗余"
```

---

### Task 7: `TypeBadge.tsx` 卷轴造型

**Files:**
- Modify: `src/shared/ui/quiz/TypeBadge.tsx:14-24`
- Test: `src/shared/ui/quiz/Choice.test.tsx` / `ListenChoice.test.tsx` / `MatchGame.test.tsx`(既有 `getByText('选一选' | '听一听' | '连连看')` 断言,应**不动即绿**)

**Interfaces:**
- Consumes: 无
- Produces: `TypeBadge` props **不变**(`kind` / `className`);`KIND_LABEL` 文案**不变**(测试按文案断言)

- [ ] **Step 1: 换造型**

`src/shared/ui/quiz/TypeBadge.tsx` 的 `return` 替换为:

```tsx
  return (
    <span
      className={cn(
        'inline-flex items-stretch overflow-hidden rounded-full border-2 border-hairline bg-surface-2 text-xs font-bold text-ink-2 shadow-card',
        className,
      )}
    >
      {/* 两端「卷轴杆」:把胶囊变成卷轴标签,替掉纯灰底标签的工具感 */}
      <span aria-hidden className="w-1.5 bg-accent/50" />
      <span className="px-2 py-1">{KIND_LABEL[kind]}</span>
      <span aria-hidden className="w-1.5 bg-accent/50" />
    </span>
  )
```

- [ ] **Step 2: Run tests to verify they still pass**

Run: `npx vitest run src/shared/ui/quiz/`
Expected: PASS —— `getByText('选一选')` 仍命中内层 `<span>` 文本节点

- [ ] **Step 3: Commit**

```bash
git add src/shared/ui/quiz/TypeBadge.tsx
git commit -m "refactor(quiz): 题型徽章改卷轴造型"
```

---

### Task 8: 9 文件断言改名收口

**Files:**
- Modify: `src/features/lesson/WordLesson.test.tsx:24,27` · `src/features/foundation/TeachOverlay.test.tsx:29,32,35,38` · `src/features/foundation/ColdStartWizard.test.tsx:56,58` · `src/features/foundation/FoundationStepGate.test.tsx:83` · `src/features/qianzigu/scene-ui.test.tsx:34,37` · `src/features/qianzigu/ChapterRunnerView.test.tsx:234,237` · `src/app/App.test.tsx:316,318`

**Interfaces:**
- Consumes: `CAST_LABEL`(Task 3)
- Produces: 无(测试收口)

- [ ] **Step 1: 逐个文件改断言**

对上述每个文件:把 `{ name: '确定' }` → `{ name: '就它了!' }`;并在**注释里描述「点『确定』」**的位置一并勘误为「点『就它了!』」:

| 文件 | 注释勘误行 |
| --- | --- |
| `scene-ui.test.tsx` | `:34` `// Choice 是两步:点卡(顺带朗读)→ 点「确定」提交(Choice.tsx:61-71)。` |
| `ChapterRunnerView.test.tsx` | `:234` `/** 当前 Choice 题作答:点选项再点确定…*/` + `:237` 行内注释 `// 现有 helper:点选项 → 确定` |
| `ColdStartWizard.test.tsx` | `:56` `/** 新确认制:点「确定」提交当前选中。 */` |
| `TeachOverlay.test.tsx` | `:29` `/** 直接判分作答:选 target → 确定。 */` · `:35` `/** 直接判分作答:选干扰项 wrong → 确定。 */` |
| `WordLesson.test.tsx` | `:24` `/** 新确认制作答:点选项(即念) → 点「确定」提交。 */` |
| `App.test.tsx` | `:316` `/** 提交当前题(新确认制:点选项后再点「确定」才判)。 */` |

> 每个文件独立可验证;若引 `CAST_LABEL` 跨 feature 会触碰 `architecture.test.ts` 边界,则**直接写字符串字面量 `'就它了!'`**(测试文件不受 feature 边界约束,但引 `shared/ui/quiz` 更稳妥 —— 优先字面量,零耦合)。

- [ ] **Step 2: Run the full suite**

Run: `npm test`
Expected: PASS,0 failure。

测试数推算(**基线 65 文件 / 416 测试**,开工前已核对):

| 来源 | 文件 | 用例 |
| --- | --- | --- |
| 基线 | 65 | 416 |
| Task 1-3 新增 3 个测试文件 | +3 | +14(stone 6 / QuestionBubble 5 / CastButton 3) |
| Task 4 新增词石断言 | — | +2 |
| Task 6 新增 ✗ 冗余断言 | — | +1 |
| Task 12 新增演示头断言 | — | +1 |
| **合计** | **68** | **434** |

数字对不上 = 有断言漏改或有测试文件没被收集,**回头核对,不要凑数放过**。

- [ ] **Step 3: Commit**

```bash
git add src/features/lesson/WordLesson.test.tsx src/features/foundation/TeachOverlay.test.tsx src/features/foundation/ColdStartWizard.test.tsx src/features/foundation/FoundationStepGate.test.tsx src/features/qianzigu/scene-ui.test.tsx src/features/qianzigu/ChapterRunnerView.test.tsx src/app/App.test.tsx
git commit -m "test(quiz): 施法钮措辞收口(确定 → 就它了!)+ 注释勘误"
```

---

### Task 9: 千字谷去白卡(题浮上舞台)

**Files:**
- Modify: `src/features/qianzigu/scene-ui.tsx:151-186`(`QuestionCard` 外层)
- Test: `src/features/qianzigu/scene-ui.test.tsx` · `src/features/qianzigu/ChapterRunnerView.test.tsx`

**Interfaces:**
- Consumes: 无(只改外层 className/结构)
- Produces: `QuestionCard` / `TaskScene` / `BossScene` props **不变**

- [ ] **Step 1: 去卡**

`src/features/qianzigu/scene-ui.tsx` 的 `QuestionCard` return(`:151-186`):

```tsx
  return (
    <div className="rounded-[1.75rem] border border-hairline bg-surface p-4 shadow-card sm:p-6">
```

改为(题直接浮在 `ScenePanel` 的滚动区上,白卡撤除 → 观感从「一张卷子」变成「舞台上的魔法事件」):

```tsx
  return (
    <div className="space-y-3">
```

块内其余子节点(`AnimatePresence` / 反馈行 / 重试钮)**全部保留不动**。

- [ ] **Step 2: Run the scene tests**

Run: `npx vitest run src/features/qianzigu/scene-ui.test.tsx src/features/qianzigu/ChapterRunnerView.test.tsx`
Expected: PASS

- [ ] **Step 3: 目视复核亮色氛围档**

启动 `npm run dev`,千字谷冷启动章节,用 debug 直达跳进任一 task 幕(`?s=1.1.3` 类),确认题面气泡与词石在 `dawn`/`day` 天空上有足够对比(spec R2)。
若对比不足 → 在 `QuestionBubble` 与词石的 `bg-surface` 上加一层 `backdrop-blur-sm`,**不要**改回白卡。

- [ ] **Step 4: Commit**

```bash
git add src/features/qianzigu/scene-ui.tsx
git commit -m "feat(qianzigu): 题面去白卡,浮上舞台"
```

---

### Task 10: 主线词课去白卡

**Files:**
- Modify: `src/features/lesson/WordLesson.tsx:305`
- Test: `src/features/lesson/WordLesson.test.tsx`

**Interfaces:**
- Consumes: 无
- Produces: 无

- [ ] **Step 1: 去卡**

`src/features/lesson/WordLesson.tsx:305`:

```tsx
        <div className="rounded-[1.75rem] border border-hairline bg-surface p-4 shadow-card sm:p-6">
```

改为:

```tsx
        <div className="space-y-3 px-1">
```

- [ ] **Step 2: Run the lesson tests**

Run: `npx vitest run src/features/lesson/WordLesson.test.tsx src/app/App.test.tsx`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/features/lesson/WordLesson.tsx
git commit -m "feat(lesson): 词课题面去白卡"
```

---

### Task 11: 冷启动向导去白卡

**Files:**
- Modify: `src/features/foundation/ColdStartWizard.tsx:191` 与 `:201`(两个 `motion.div` 的 className)
- Test: `src/features/foundation/ColdStartWizard.test.tsx`

**Interfaces:**
- Consumes: 无
- Produces: 无

- [ ] **Step 1: 去卡**

`src/features/foundation/ColdStartWizard.tsx` 内**两处**完全相同的:

```tsx
            className="rounded-[1.75rem] border border-hairline bg-surface p-4 shadow-card sm:p-5"
```

同步改为:

```tsx
            className="space-y-3 px-1"
```

> 两处字符串一致 —— 用编辑器的 replace-all,或两段带区分上下文分别改,勿只改一处。

- [ ] **Step 2: Run the wizard tests**

Run: `npx vitest run src/features/foundation/ColdStartWizard.test.tsx`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/features/foundation/ColdStartWizard.tsx
git commit -m "feat(foundation): 冷启动向导题面去白卡"
```

---

### Task 12: 短教虚线壳 + 「演示」卷轴头(兑现 PLAN 既有承诺)

**Files:**
- Modify: `src/features/foundation/TeachOverlay.tsx:228-236`
- Test: `src/features/foundation/TeachOverlay.test.tsx`

**Interfaces:**
- Consumes: 无
- Produces: `TeachOverlay` props **不变**

> 背景:`docs/PLAN.md:34` 要求「**教学期视觉壳与真答题区分**」。换壳后真答题壳已变,教学壳必须同步重做区分,且**不能只靠颜色**(spec §7 色彩冗余)。

- [ ] **Step 1: 新增区分断言**

`src/features/foundation/TeachOverlay.test.tsx` 追加:

```tsx
  it('教学期挂「📖 演示」卷轴头且用虚线边框(与真答题区分,不单靠颜色)', () => {
    renderOverlay()
    expect(screen.getByText('📖 演示')).toBeTruthy()
  })
```

> `renderOverlay()` 用该文件既有的渲染 helper;若名字不同按实际改写。

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/foundation/TeachOverlay.test.tsx`
Expected: FAIL —— `Unable to find an element with the text: 📖 演示`

- [ ] **Step 3: 换教学壳**

`src/features/foundation/TeachOverlay.tsx:228-236`,`motion.div` 的 `className` 与内部结构改为:

```tsx
        className="relative space-y-3 rounded-[1.75rem] border-2 border-dashed border-accent/50 p-4 sm:p-5"
      >
        {/* 教学期标识:虚线边框 + 卷轴头双通道冗余,单靠颜色不算区分(色盲看不见) */}
        <span className="inline-flex items-center rounded-full border-2 border-accent/40 bg-surface px-2.5 py-0.5 text-xs font-bold text-accent-ink shadow-card">
          📖 演示
        </span>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/foundation/TeachOverlay.test.tsx src/features/foundation/FoundationStepGate.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/foundation/TeachOverlay.tsx src/features/foundation/TeachOverlay.test.tsx
git commit -m "feat(foundation): 短教改虚线壳 + 演示卷轴头(与真答题双通道区分)"
```

---

### Task 13: 文档同步 + 全量闸门

**Files:**
- Modify: `docs/design/game-visual.md`
- Modify: `docs/PLAN.md`(立项行状态)

**Interfaces:**
- Consumes: 全部前置任务
- Produces: 无

- [ ] **Step 1: 同步 game-visual.md 接缝表**

`docs/design/game-visual.md`「现状接缝映射」表中,`前景交互层` 行的「现状 / 守则」列追加一句(标明**已建勿重建**):

```
;题面气泡(`shared/ui/quiz/QuestionBubble.tsx`)/ 词石(`stone.ts`)/ 施法钮(`CastButton.tsx`)已建 —— 改题面观感改这三处,勿在消费点内联绕过
```

- [ ] **Step 2: 更新 PLAN 行状态**

`docs/PLAN.md` 本需求行末尾,把 `— spec 已出待评审,未开工 —` 改为 `— 开发完成,待 0.3.0 发 —`。

- [ ] **Step 3: 全量闸门**

Run: `npm test`
Expected: PASS,0 failure

Run: `npm run lint`
Expected: 0 error(warning 不阻塞)

- [ ] **Step 4: 浏览器人工走查(发布前闸门)**

`npm run dev`,依次走:
1. **主线词课**:词 1 三技能,故意答错一次看 ✗ + 抖动,再答对看 ✓
2. **千字谷跑章**:debug 直达任一 task 幕 + boss 幕,确认题浮在天空上、可读
3. **短教**:触发一次「先学一下」,确认「📖 演示」卷轴头 + 虚线壳与真答题**一眼可辨**
4. **冷启动向导**:新档案走一遍探针题
5. **减动效**:系统开 `prefers-reduced-motion`,确认词石不再飞行/抖动
6. **窄屏**:375px 宽下确认长选项(3 字词)不被错落挤出

- [ ] **Step 5: Commit**

```bash
git add docs/design/game-visual.md docs/PLAN.md
git commit -m "docs(design+plan): 题面舞台化接缝与状态同步"
```

---

## Self-Review 记录

- **Spec 覆盖**:§3 三 signifier → Task 2(题干)/1(词石)/3(施法钮);§4 壳层三文件 → Task 1-3;§5 元素表 → Task 1/2/3/6/7;§6 四消费点 → Task 9/10/11/12;§7 无障碍 → Task 1(形状冗余)/6/12(不单靠色)+ Global Constraints(减动效、缩放、对比);§8 测试 → Task 4/6/8;§9 文档 → Task 13。**无缺口**。
- **类型一致**:`StoneState` 五值在 Task 1 定义,Task 4/6 消费一致;`CAST_LABEL` 单一来源(Task 3)→ Task 4/5/8;`QuestionBubbleProps` 三处签名一致。
- **与 spec 的一处已知偏差**:spec §5 表把「答对反馈」写作「词石上浮 + 粒子迸发」;本计划 Task 4 **未实现粒子**,只做到「绿 + ✓ 角标 + ring」。理由:粒子是纯装饰且是 R4 平台字形风险的来源,收益低;若需要,单开一个小任务(在 `Choice` 的 `onPass` 路径上挂一次性的 motion 装饰层,`aria-hidden`)。
