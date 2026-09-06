# 答题卡交互重构(点听·确认制)+ 短教结口 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把全 app 共享答题卡 Choice/ListenChoice/Match 的交互统一为「点选项 = 选中 + 自动朗读(不再即时判)」+「确定」主按钮提交判分,并给短教补上学习化出口(requireVisitAll 听齐门 + 返回地图 + accent 教学视觉壳),主词课判对自动推进与全部判分语义保留。

**Architecture:** 交互语义收敛到 `src/shared/ui/quiz/` 三组件(主词课 WordLesson / 短教 TeachOverlay / 冷启动 ColdStartWizard 共用),只动 shared 组件与其消费方测试;短教专属门 `requireVisitAll` 作 shared Choice 的可选 prop(仅 TeachOverlay 传 true),出口走 WordLesson `stepGate.render` ctx 新增可选 `exit` 逐层透传到 FoundationStepGate → TeachOverlay。纯前端,无 DB/API 改动。

**Tech Stack:** React 19 + TS + motion(Tailwind v4 token:`accent/accent-tint/accent-ink/emerald/red/red-tint/surface/surface-2/ink/ink-2/ink-3/hairline`,rounded-3xl,shadow-card)。测试 vitest + @testing-library/react(fireEvent/userEvent/screen/waitFor/findBy*,jsdom;App/ColdStart 用 fake timers)。

**Spec:** `docs/superpowers/specs/2026-09-06-quiz-interaction-redesign-design.md`(计划从 spec 立论;执行者两文件都读)。

## Global Constraints

- 不加任何新依赖;UI 文案中文,新增文案仅本 spec 给定串;新增 `确定`/`返回`/`再听一遍`/「把每个都点一点、听一听,再选答案」文案串不得改写。
- 纯前端交互/视觉改动;绝不改 `migrations/0001_init.sql`,无 db/API/存储改动,不回滚路径含 DB。
- `npm test` 全程绿(含 `src/architecture.test.ts`);`src/shared/ui/quiz/*` 源文件不得 import `@/features/*`(边界;三组件现仅 import `@/shared/*` 与外部包,维持)。
- Choice/ListenChoice/MatchGame 三处共用(主词课/短教/冷启动):Task 2 后默认确认制三处同生效;短教额外 `requireVisitAll`,主词课与冷启动不传。
- 判对自动推进保留:WordLesson 650ms / TeachOverlay 420ms / ColdStart 650ms;判定时机只平移至「确定」提交,`handleAnswer`/`handleQuizAnswer` 签名不改。
- 点选项 = 先 `speakCard(o.speak ?? o.text)`(match 只 `o.speak`)再置选中;`speak` 返 false(无语音)静默、不抛错、不阻塞「确定」。
- **grid 选择器红线**(测试 helper 依赖):`clickAnyOption`/`optionButtons` 取「首个含 button 的 `div.grid`」定位选项。新「确定」行与 ListenChoice 题干重听区**必须是 `flex` 容器,永不得是 `grid`**。
- **aria 唯一红线**:TeachOverlay 标题返回钮 aria 必须「返回」(不可「返回地图」——叠在 WordLesson header `aria-label="返回地图"` 上方会撞名);praise 的「返回地图」用可见文本钮,二者并存不冲突。
- 表/结构/词库/出题纯逻辑(decompose/estimator/demo-blocks/catalogs/teach-questions/question-engine/progress-rules)一律不动;纯逻辑测试不属本计划范围,不得改。
- 每次全量回归用 `npm test`;单文件用 `npx vitest run <路径>`(Windows Bash 下正斜杠路径可直接用)。

---

### Task 1: MatchGame 去喇叭 + 纯选择朗读

**Files:**
- Rewrite: `src/shared/ui/quiz/MatchGame.tsx`(整文件)
- Create: `src/shared/ui/quiz/MatchGame.test.tsx`

**Interfaces:**
- Produces: `MatchGame({ prompt, left, right, answerMap, skill, playSound, speak, onComplete })` 接口/导出不变(`MatchGameProps` 为文件内私有类型);行为变化:点卡不再即时触发配对判定外的朗读;朗读只发生在「纯选择」时刻(`speakOnPureSelect`),配对判合与取消选择不读。消费方仅 `WordLesson.tsx` match 分支,props 零改 → 编译不受影响。

- [ ] **Step 1: 写失败测试 `src/shared/ui/quiz/MatchGame.test.tsx`**

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { BaseOption } from '@/shared/services'
import { MatchGame } from './MatchGame'

const left: BaseOption[] = [
  { id: 'l1', text: '太阳', speak: '太阳' },
  { id: 'l2', text: '月亮', speak: '月亮' },
]
const right: BaseOption[] = [
  { id: 'r1', emoji: '☀️', text: '☀️', speak: '太阳' },
  { id: 'r2', emoji: '🌙', text: '🌙', speak: '月亮' },
]

describe('MatchGame 点读语义(纯选择才读,配对/取消不读)', () => {
  afterEach(cleanup)

  it('选中读一次、取消选择不读、再选再读', () => {
    const speak = vi.fn(() => true)
    const onComplete = vi.fn()
    render(
      <MatchGame
        prompt="配对"
        left={left}
        right={right}
        answerMap={{ l1: 'r1', l2: 'r2' }}
        skill="hanzi"
        playSound={vi.fn()}
        speak={speak}
        onComplete={onComplete}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '太阳' }))
    expect(speak).toHaveBeenCalledTimes(1)
    expect(speak).toHaveBeenLastCalledWith('太阳', 'zh-CN')
    fireEvent.click(screen.getByRole('button', { name: '太阳' })) // 取消选择
    expect(speak).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: '太阳' })) // 重新选中
    expect(speak).toHaveBeenCalledTimes(2)
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('配对判合不朗读;整组对 → onComplete(left id)', () => {
    const speak = vi.fn(() => true)
    const onComplete = vi.fn()
    render(
      <MatchGame
        prompt="配对"
        left={[{ id: 'l1', text: '太阳', speak: '太阳' }]}
        right={[{ id: 'r1', emoji: '☀️', text: '☀️', speak: '太阳' }]}
        answerMap={{ l1: 'r1' }}
        skill="hanzi"
        playSound={vi.fn()}
        speak={speak}
        onComplete={onComplete}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '太阳' }))
    expect(speak).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: '☀️' })) // 判合,不读
    expect(speak).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith('l1')
  })

  it('错配不朗读,出 wrong 音', () => {
    const speak = vi.fn(() => true)
    const playSound = vi.fn()
    render(
      <MatchGame
        prompt="配对"
        left={left}
        right={right}
        answerMap={{ l1: 'r1', l2: 'r2' }}
        skill="hanzi"
        playSound={playSound}
        speak={speak}
        onComplete={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '太阳' }))
    expect(speak).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: '🌙' })) // 错配判合,不读
    expect(speak).toHaveBeenCalledTimes(1)
    expect(playSound).toHaveBeenCalledWith('wrong')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/shared/ui/quiz/MatchGame.test.tsx`
Expected: FAIL —— 旧实现即时判定不朗读/取消 toggle 可能多读,断言不满足。

- [ ] **Step 3: 整文件重写 `src/shared/ui/quiz/MatchGame.tsx`**

删:第 3 行 `Volume2` import(仅留 `Check`)、`renderCard` 内 `speakText` 变量(旧 86 行)、卡片 `speakText` 喇叭块(旧 118-138 行)、`renderCard` 中失效注释。加:`speakOnPureSelect` helper;`pickLeft`/`pickRight` 改为显式选择 + 取消分支。其余(配对/错配/settlePair/done/样式/`Check` 徽标)原样保留。新整文件:

```tsx
import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Check } from 'lucide-react'
import { cn } from '@/shared/ui/utils'
import type { AudioCue } from '@/shared/services'
import { speakCard, type Speak } from './speech'
import type { BaseOption, SkillKey } from '@/shared/services'

type MatchGameProps = {
  prompt: string
  left: BaseOption[]
  right: BaseOption[]
  answerMap: Record<string, string>
  skill: SkillKey
  playSound: (cue: AudioCue) => void
  speak: Speak
  /** 全部配对成功时触发,传任一正确 left id(语义上整题 +10)。 */
  onComplete: (leftId: string) => void
}

export function MatchGame({
  prompt,
  left,
  right,
  answerMap,
  skill,
  playSound,
  speak,
  onComplete,
}: MatchGameProps) {
  const [selL, setSelL] = useState<string | null>(null)
  const [selR, setSelR] = useState<string | null>(null)
  const [matched, setMatched] = useState<Record<string, string>>({})
  const [mismatch, setMismatch] = useState<[string, string] | null>(null)
  const [done, setDone] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    },
    [],
  )

  function settlePair(l: string, r: string) {
    if (done) return
    if (answerMap[l] === r) {
      const next = { ...matched, [l]: r }
      setMatched(next)
      setSelL(null)
      setSelR(null)
      if (Object.keys(next).length === left.length) {
        setDone(true)
        onComplete(left[0]?.id ?? '')
      } else {
        playSound('tap')
      }
    } else {
      playSound('wrong')
      setSelL(null)
      setSelR(null)
      setMismatch([l, r])
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => setMismatch(null), 420)
    }
  }

  /** 朗读只在「纯选择」时刻(点某侧卡、对侧无待配对选中);配对判合与取消选择都不读。 */
  function speakOnPureSelect(side: 'left' | 'right', id: string) {
    const opt = (side === 'left' ? left : right).find((x) => x.id === id)
    if (opt?.speak) speakCard(speak, skill, opt.speak)
  }

  function pickLeft(id: string) {
    if (matched[id] || mismatch || done) return
    if (selR) { settlePair(id, selR); return }
    if (selL === id) { setSelL(null); return } // 取消选择不朗读
    setSelL(id)
    speakOnPureSelect('left', id)
  }

  function pickRight(id: string) {
    const matchedRightIds = Object.values(matched)
    if (matchedRightIds.includes(id) || mismatch || done) return
    if (selL) { settlePair(selL, id); return }
    if (selR === id) { setSelR(null); return } // 取消选择不朗读
    setSelR(id)
    speakOnPureSelect('right', id)
  }

  function renderCard(o: BaseOption, isLeft: boolean) {
    const matchedRightIds = Object.values(matched)
    const isMatched = isLeft ? matched[o.id] !== undefined : matchedRightIds.includes(o.id)
    const isSel = isLeft ? selL === o.id : selR === o.id
    const isMis = mismatch ? (isLeft ? mismatch[0] === o.id : mismatch[1] === o.id) : false
    return (
      <motion.button
        key={o.id}
        type="button"
        aria-disabled={Boolean(isMatched || mismatch || done)}
        onClick={() => (isLeft ? pickLeft(o.id) : pickRight(o.id))}
        animate={isMis ? { x: [0, -9, 9, -6, 6, 0] } : { x: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className={cn(
          'relative flex min-h-[64px] w-full items-center justify-center gap-2 rounded-2xl border-2 px-3 py-3 text-center transition-colors',
          isMatched
            ? 'border-emerald/60 bg-emerald/10 opacity-80'
            : isMis
              ? 'border-red bg-red-tint'
              : isSel
                ? 'border-accent bg-accent-tint shadow-card'
                : 'border-hairline bg-surface hover:border-accent/60',
          !isMatched && !mismatch && !done && 'cursor-pointer active:scale-[0.96]',
        )}
      >
        {o.emoji ? (
          <span aria-hidden className="text-2xl leading-none">
            {o.emoji}
          </span>
        ) : null}
        <span className={cn('font-bold leading-tight', o.emoji ? 'text-base' : 'text-xl')}>{o.text}</span>
        {isMatched ? (
          <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald text-white">
            <Check className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </motion.button>
    )
  }

  return (
    <div className="space-y-5">
      <p className="text-center text-lg font-bold leading-snug text-ink">{prompt}</p>
      <div className="grid grid-cols-2 items-start gap-3">
        <div className="space-y-2.5">{left.map((o) => renderCard(o, true))}</div>
        <div className="space-y-2.5">{right.map((o) => renderCard(o, false))}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/shared/ui/quiz/MatchGame.test.tsx`
Expected: PASS(3/3)。旧 match 分支无既有单测,WordLesson 整量回归放到 Task 3 一并跑。

- [ ] **Step 5: Commit**

```bash
git add src/shared/ui/quiz/MatchGame.tsx src/shared/ui/quiz/MatchGame.test.tsx
git commit -m "refactor(quiz): Match 去喇叭,点卡即念(纯选择)"
```

---

### Task 2: Choice/ListenChoice 确认制重写(去喇叭 · 点卡即念 · 题干整块重听 · 「确定」提交)

**Files:**
- Rewrite: `src/shared/ui/quiz/Choice.tsx`(整文件)
- Rewrite: `src/shared/ui/quiz/ListenChoice.tsx`(整文件)
- Create: `src/shared/ui/quiz/Choice.test.tsx`
- Create: `src/shared/ui/quiz/ListenChoice.test.tsx`

**Interfaces:**
- Consumes: `Choice`/`ListenChoice` 现 props(WordLesson/TeachOverlay/ColdStart 三处同签名消费,不改消费方代码;消费方测试在 Task 3 迁移)。
- Produces: `ChoiceProps` 增可选 `requireVisitAll?: boolean`(短教专用);「确定」按钮 aria/文本名 = `确定`;题干重听钮(Choice 有 promptSpeak 时)与 ListenChoice 顶部重听区 aria = `再听一遍`。提交回调 `onAnswer(id)` 仅在点「确定」后触发,同实例确认后清空 `selected`(二答须重选,保 attempt 语义)。判分后 disabled 由消费方 `disabled` prop 传入(WordLesson `phase !== 'answering'`,TeachOverlay `qState === 'correct'`,ColdStart `qState !== 'answer'`),disabled 时确认行不渲染。

- [ ] **Step 1: 写失败测试 `src/shared/ui/quiz/Choice.test.tsx`**

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { BaseOption } from '@/shared/services'
import { Choice, type ChoiceProps } from './Choice'

const options: BaseOption[] = [
  { id: 'a', text: 'A' },
  { id: 'b', text: 'B' },
]
const speak = vi.fn(() => true)
const onAnswer = vi.fn()

function renderChoice(over: Partial<ChoiceProps> = {}) {
  const base: ChoiceProps = { prompt: '选出正确的一个', skill: 'pinyin', options, speak, onAnswer, ...over }
  return render(<Choice {...base} />)
}

describe('Choice 确认制(点听 · 确定提交)', () => {
  beforeEach(() => { speak.mockClear(); onAnswer.mockClear() })
  afterEach(cleanup)

  it('未选中「确定」禁用;点卡先念(缺 speak 读文本)再放开', () => {
    renderChoice()
    expect(screen.getByRole('button', { name: '确定' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'A' }))
    expect(speak).toHaveBeenCalledWith('A', 'zh-CN')
    expect(screen.getByRole('button', { name: '确定' })).not.toBeDisabled()
  })

  it('「确定」才提交;提交后清空选中,须重选再答', () => {
    renderChoice()
    fireEvent.click(screen.getByRole('button', { name: 'A' }))
    fireEvent.click(screen.getByRole('button', { name: '确定' }))
    expect(onAnswer).toHaveBeenCalledWith('a')
    expect(screen.getByRole('button', { name: '确定' })).toBeDisabled() // 已清空
  })

  it('点另一卡改选;提交的是当前选中', () => {
    renderChoice()
    fireEvent.click(screen.getByRole('button', { name: 'A' }))
    fireEvent.click(screen.getByRole('button', { name: 'B' }))
    fireEvent.click(screen.getByRole('button', { name: '确定' }))
    expect(onAnswer).toHaveBeenCalledWith('b')
  })

  it('重复点已选卡:重念 + 保持选中', () => {
    renderChoice()
    fireEvent.click(screen.getByRole('button', { name: 'A' }))
    fireEvent.click(screen.getByRole('button', { name: 'A' }))
    expect(speak).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('button', { name: '确定' }))
    expect(onAnswer).toHaveBeenCalledWith('a')
  })

  it('promptSpeak:题干整块为「再听一遍」重听区(无喇叭)', () => {
    renderChoice({ promptSpeak: 'xiao ming' })
    fireEvent.click(screen.getByRole('button', { name: '再听一遍' }))
    expect(speak).toHaveBeenCalledWith('xiao ming', 'zh-CN')
    expect(screen.queryByRole('button', { name: '朗读题目' })).toBeNull()
  })

  it('requireVisitAll:全部选项点过才放开「确定」;未齐显提示', () => {
    renderChoice({ requireVisitAll: true })
    expect(screen.getByRole('button', { name: '确定' })).toBeDisabled()
    expect(screen.getByText('把每个都点一点、听一听,再选答案')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'A' }))
    expect(screen.getByRole('button', { name: '确定' })).toBeDisabled() // 还差 B
    expect(screen.getByText('把每个都点一点、听一听,再选答案')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'B' }))
    expect(screen.getByRole('button', { name: '确定' })).not.toBeDisabled()
    expect(screen.queryByText('把每个都点一点、听一听,再选答案')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '确定' }))
    expect(onAnswer).toHaveBeenCalledWith('b')
  })

  it('disabled:不渲染「确定」,选项禁用', () => {
    renderChoice({ disabled: true })
    expect(screen.queryByRole('button', { name: '确定' })).toBeNull()
    expect(screen.getByRole('button', { name: 'A' })).toHaveAttribute('aria-disabled', 'true')
  })
})
```

- [ ] **Step 2: 写失败测试 `src/shared/ui/quiz/ListenChoice.test.tsx`**

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { BaseOption } from '@/shared/services'
import { ListenChoice, type ListenChoiceProps } from './ListenChoice'

const options: BaseOption[] = [
  { id: 'a', text: 'A' },
  { id: 'b', text: 'B' },
]
const speak = vi.fn(() => true)
const onAnswer = vi.fn()

function renderListen(over: Partial<ListenChoiceProps> = {}) {
  const base: ListenChoiceProps = {
    prompt: '听一听,选出你听到的',
    promptSpeak: 'xiao ming',
    skill: 'english',
    options,
    speak,
    onAnswer,
    ...over,
  }
  return render(<ListenChoice {...base} />)
}

describe('ListenChoice(自动读 · 整块重听 · 透传 Choice 确认制)', () => {
  beforeEach(() => { speak.mockClear(); onAnswer.mockClear() })
  afterEach(cleanup)

  it('进题自动朗读 promptSpeak 一次', () => {
    renderListen()
    expect(speak).toHaveBeenCalledTimes(1)
    expect(speak).toHaveBeenCalledWith('xiao ming', 'en-US')
  })

  it('顶部整块重听区点击重读(无喇叭图标)', () => {
    renderListen()
    expect(speak).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: '再听一遍' }))
    expect(speak).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('button', { name: '朗读题目' })).toBeNull()
  })

  it('点选项即念 + 「确定」透传提交;选项朗读语言随 skill', () => {
    renderListen()
    fireEvent.click(screen.getByRole('button', { name: 'A' }))
    expect(speak).toHaveBeenLastCalledWith('A', 'en-US')
    fireEvent.click(screen.getByRole('button', { name: '确定' }))
    expect(onAnswer).toHaveBeenCalledWith('a')
  })

  it('requireVisitAll 透传:点齐才可确认', () => {
    renderListen({ requireVisitAll: true })
    expect(screen.getByRole('button', { name: '确定' })).toBeDisabled()
    expect(screen.getByText('把每个都点一点、听一听,再选答案')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'A' }))
    fireEvent.click(screen.getByRole('button', { name: 'B' }))
    expect(screen.getByRole('button', { name: '确定' })).not.toBeDisabled()
  })
})
```

- [ ] **Step 3: 跑测试确认失败**

Run: `npx vitest run src/shared/ui/quiz/Choice.test.tsx src/shared/ui/quiz/ListenChoice.test.tsx`
Expected: FAIL —— 旧 Choice 点卡即 `onAnswer`(无选中态/无「确定」/无 requireVisitAll),断言几乎全挂。

- [ ] **Step 4: 整文件重写 `src/shared/ui/quiz/Choice.tsx`**

删:`Volume2` import、`SpeakChip`(旧 37-69 行)、题干喇叭按钮(旧 91-103 行)、每选项 `SpeakChip` 挂载(旧 134 行)、`cardCls` 4 参版。加:`useState`、`Button` import、`requireVisitAll?` prop、`cardCls` 5 参(选中态)、点卡先念后选、确认行(flex 容器,**非 grid**)。完整新文件:

```tsx
import { useState } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/shared/ui/utils'
import { Button } from '@/shared/ui/button'
import type { BaseOption, SkillKey } from '@/shared/services'
import { speakCard, type Speak } from './speech'

export type ChoiceProps = {
  prompt: string
  promptSpeak?: string
  promptEmoji?: string
  skill: SkillKey
  options: BaseOption[]
  disabled?: boolean
  /** 两次答错后亮出的正确答案 option id */
  revealId?: string | null
  /** 刚答对(待推进)时高亮的 option id */
  correctId?: string | null
  /** 本次答错的 option id(红标 + 抖动) */
  wrongId?: string | null
  /** 短教专用:全部选项各点听一遍后才放开「确定」 */
  requireVisitAll?: boolean
  speak: Speak
  onAnswer: (id: string) => void
}

function cardCls(disabled: boolean, reveal: boolean, correct: boolean, wrong: boolean, selected: boolean): string {
  if (reveal || correct) {
    return 'border-emerald/70 bg-emerald/10 text-ink ring-2 ring-emerald/30'
  }
  if (wrong) {
    return 'border-red bg-red-tint text-red'
  }
  if (disabled) {
    return 'border-hairline bg-surface-2 text-ink-2'
  }
  if (selected) {
    return 'border-accent bg-accent-tint text-ink shadow-card'
  }
  return 'border-hairline bg-surface text-ink hover:border-accent/60 hover:shadow-card'
}

export function Choice({
  prompt,
  promptSpeak,
  promptEmoji,
  skill,
  options,
  disabled = false,
  revealId = null,
  correctId = null,
  wrongId = null,
  requireVisitAll = false,
  speak,
  onAnswer,
}: ChoiceProps) {
  // 每题/每轮由调用方 key 重挂载复位;同实例内确认提交后清空选中 → 二答须重选(attempt 语义不变)。
  const [selected, setSelected] = useState<string | null>(null)
  const [visited, setVisited] = useState<ReadonlySet<string>>(() => new Set())
  const allVisited = requireVisitAll && visited.size === options.length

  function handleCard(o: BaseOption) {
    if (disabled) return
    speakCard(speak, skill, o.speak ?? o.text) // 点卡 = 先念再选(缺 speak 读文本)
    setSelected(o.id)
    if (requireVisitAll) {
      setVisited((prev) => (prev.has(o.id) ? prev : new Set(prev).add(o.id)))
    }
  }

  function confirm() {
    if (selected === null || (requireVisitAll && !allVisited)) return
    onAnswer(selected)
    setSelected(null)
  }

  return (
    <div className="space-y-5">
      {promptSpeak ? (
        // 题干整块可点重听区(无喇叭图标)
        <button
          type="button"
          aria-label="再听一遍"
          onClick={() => speakCard(speak, skill, promptSpeak)}
          className="mx-auto flex w-full flex-col items-center gap-1 rounded-3xl px-2 pb-2 pt-1 transition-colors hover:bg-accent-tint/60 active:scale-[0.99]"
        >
          {promptEmoji ? (
            <span aria-hidden className="text-7xl leading-none drop-shadow-sm">{promptEmoji}</span>
          ) : null}
          <p className="text-center text-lg font-bold leading-snug text-ink">{prompt}</p>
        </button>
      ) : (
        <>
          {promptEmoji ? (
            <div aria-hidden className="flex justify-center pb-1">
              <span className="text-7xl leading-none drop-shadow-sm">{promptEmoji}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-center px-2">
            <p className="text-center text-lg font-bold leading-snug text-ink">{prompt}</p>
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        {options.map((o) => {
          const reveal = revealId === o.id
          const correct = correctId === o.id
          const wrong = wrongId === o.id
          const isSelected = !disabled && !reveal && !correct && !wrong && selected === o.id
          return (
            <motion.button
              key={o.id}
              type="button"
              aria-disabled={disabled}
              aria-pressed={selected === o.id}
              onClick={() => handleCard(o)}
              animate={wrong ? { x: [0, -9, 9, -6, 6, 0] } : { x: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className={cn(
                'relative flex min-h-[84px] flex-col items-center justify-center gap-1.5 rounded-3xl border-2 px-3 py-3 text-center transition-colors',
                cardCls(disabled, reveal, correct, wrong, isSelected),
                !disabled && 'active:scale-[0.96] cursor-pointer',
              )}
            >
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
          {requireVisitAll && !allVisited ? (
            <p className="text-center text-sm font-semibold text-accent-ink">把每个都点一点、听一听,再选答案</p>
          ) : null}
          <Button
            size="lg"
            className="w-full sm:w-auto sm:min-w-52"
            disabled={selected === null || (requireVisitAll && !allVisited)}
            onClick={confirm}
          >
            确定
          </Button>
        </div>
      ) : null}
    </div>
  )
}
```

> 自校:确认行与整块重听区均为 `flex`/`flex-col` 容器(红线);「确定」Btn 默认 variant、`size="lg"` 与现有 Button 用法一致。

- [ ] **Step 5: 整文件重写 `src/shared/ui/quiz/ListenChoice.tsx`**

删:`Volume2` import 与实心喇叭钮(旧 25-36 行)。加:`flex` 整块虚线重听区。`promptSpeak` 继续 destructure 出去(不透传给 Choice,防 Choice 双渲重听区);自动朗读 saidRef 逻辑原样保留(注释不动)。完整新文件:

```tsx
import { useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { speakCard } from './speech'
import { Choice, type ChoiceProps } from './Choice'

export type ListenChoiceProps = Omit<ChoiceProps, 'promptSpeak'> & {
  /** 进题自动朗读、点击重听区重播的文本 */
  promptSpeak: string
}

export function ListenChoice({ promptSpeak, skill, options, onAnswer, speak, ...rest }: ListenChoiceProps) {
  // 进题自动朗读一次(promptSpeak)。React StrictMode 开发模式会重放 effect(setup→cleanup→setup),
  // 若不拦,第二次 speak 会先 cancel 掉第一次正在合成的 utterance,speech-dispatcher 后端下该句
  // 直接丢失 → 无声。ref 去重保证同一组件实例只自动读一次;每题按 key 重挂载 → 新实例 → 新题仍会读。
  const saidRef = useRef(false)
  useEffect(() => {
    if (saidRef.current) return
    saidRef.current = true
    speakCard(speak, skill, promptSpeak)
  }, [skill, promptSpeak, speak])

  return (
    <div className="space-y-5">
      {/* 题干重听区:整块可点空区(flex,非 grid;不放答案文字,故无喇叭图标)。 */}
      <div className="flex justify-center">
        <motion.button
          type="button"
          aria-label="再听一遍"
          whileTap={{ scale: 0.94 }}
          onClick={() => speakCard(speak, skill, promptSpeak)}
          className="flex h-16 w-full max-w-60 items-center justify-center rounded-full border-2 border-dashed border-accent/60 bg-accent-tint/40 transition-colors hover:border-accent hover:bg-accent-tint"
        >
          <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-accent/70" />
        </motion.button>
      </div>
      <Choice skill={skill} options={options} speak={speak} onAnswer={onAnswer} {...rest} />
    </div>
  )
}
```

> 注:listen 题的 `prompt` 经 `...rest` 进 Choice;Choice 内 `promptSpeak` 已缺失 → 走「纯文本题干」分支,不产出额外重听钮。answer 语义与 Choice 全一致(点选项 = 选中即念,「确定」提交)。

- [ ] **Step 6: 跑新增测试 + quiz 目录回归**

Run: `npx vitest run src/shared/ui/quiz/Choice.test.tsx src/shared/ui/quiz/ListenChoice.test.tsx src/shared/ui/quiz/MatchGame.test.tsx`
Expected: PASS 全绿。此步不动消费方测试(它们此刻已因确认制「红」,Task 3 迁移)。

- [ ] **Step 7: Commit**

```bash
git add src/shared/ui/quiz/Choice.tsx src/shared/ui/quiz/ListenChoice.tsx src/shared/ui/quiz/Choice.test.tsx src/shared/ui/quiz/ListenChoice.test.tsx
git commit -m "feat(quiz): Choice/ListenChoice 去喇叭,点卡即念 + 「确定」提交(确认制)"
```

---

### Task 3: 消费方测试迁移到确认制(WordLesson · ColdStartWizard · App + TeachOverlay/FoundationStepGate 交互定稿)

> 说明:Task 2 后默认确认制已在三消费方生效,下列测试全部从「点卡即答」迁到「选卡 + 确定」。
> TeachOverlay/FoundationStepGate 测试在此一步直接写成**最终 tap-all + 确定 形式**(短教源码 Task 4 才开 `requireVisitAll`,但 tap-all 写法在门开关前后都成立 → 一步定稿、Task 4 零交互回改)。主词课判对仍自动推进(WordLesson 650ms → waitFor timeout 3000 沿用)。

**Files:**
- Rewrite: `src/features/lesson/WordLesson.test.tsx`(整文件,加 `answerChoice` helper)
- Rewrite: `src/features/foundation/ColdStartWizard.test.tsx`(整文件,加 `confirmAnswer` helper)
- Modify: `src/app/App.test.tsx`(加 `confirmAnswer` helper + 冷启动循环插入确认点击)
- Rewrite: `src/features/foundation/TeachOverlay.test.tsx`(整文件,最终 tap-all/确定 形式 + `optionButtons`/`answerTarget`/`answerWrong` helpers)
- Rewrite: `src/features/foundation/FoundationStepGate.test.tsx`(整文件,overlay 交互同 tap-all 定稿)

**Interfaces:**
- Consumes: Task 2 的确认制 Choice/ListenChoice(`确定` 按钮、「再听一遍」区)。
- Produces: 各测试文件可复用的 helper(`answerChoice`/`confirmAnswer`/`optionButtons`/`answerTarget`/`answerWrong`),Task 4 追加测试沿用。
- **grid 选择器红线适用**:helper 一律定位「首个含 button 的 `div.grid`」;确认行/重听区为 flex,永不误抓。

- [ ] **Step 1: 重写 `src/features/lesson/WordLesson.test.tsx` 到确认制**

改动要点:加 helper `answerChoice(text)` = `fireEvent.click(screen.getByText(text))` 后 `fireEvent.click(screen.getByRole('button', { name: '确定' }))`;旧直接 `fireEvent.click(screen.getByText('X'))` 的答题点击全部换 `answerChoice('X')`(换题/推进判定全随「确定」平移,断言与 waitFor 不改)。4 处 `renderGate` ctx 注解仍为窄版 `{ word; skill; cont }`(Task 4 ctx 增**可选** `exit` 后仍合法,不必动)。完整新文件:

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Question, SkillKey, UserSettings, WordUnit } from '@/shared/services'
import { WordLesson } from './WordLesson'

const settings: UserSettings = {
  enablePinyin: true,
  enableHanzi: true,
  enableEnglish: true,
  earnedAchievements: [],
  consecutiveDays: 0,
  lastActiveDate: '',
  updatedAt: '',
}
const word: WordUnit = { id: 21, emoji: '🍎', pinyin: 'píng guǒ', hanzi: '苹果', english: 'apple', category: 'food' }
const noop = () => {}
const makeQuestions = () => [{ kind: 'choice', prompt: 'x', options: [{ id: 'a', text: 'A' }], answerId: 'a' }] as unknown as Question[]

function renderLesson(over: Partial<Parameters<typeof WordLesson>[0]> = {}) {
  const base = { word, settings, combo: 0, makeQuestions, playSound: noop, speak: () => true, celebrate: noop, onAnswer: noop, onStepPass: noop, onLessonComplete: noop, onExit: noop }
  return render(<WordLesson {...base} {...over} />)
}

/** 新确认制作答:点选项(即念) → 点「确定」提交。 */
function answerChoice(text: string) {
  fireEvent.click(screen.getByText(text))
  fireEvent.click(screen.getByRole('button', { name: '确定' }))
}

describe('WordLesson stepGate', () => {
  afterEach(cleanup)
  it('无 stepGate:直接出题(现状回归)', () => {
    renderLesson()
    expect(screen.getByText('x')).toBeTruthy()
  })
  it('stepGate.judge true 首步 → 渲染 gate.render,cont 后出题', async () => {
    const renderGate = vi.fn((ctx: { word: WordUnit; skill: SkillKey; cont: () => void }) => (
      <button onClick={ctx.cont}>我先学一下</button>
    ))
    renderLesson({ stepGate: { judge: () => true, render: renderGate } })
    expect(renderGate).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: '我先学一下' }))
    expect(screen.getByText('x')).toBeTruthy() // cont 后装题
  })
  it('judge false → 不渲染 gate', () => {
    const renderGate = vi.fn(() => null)
    renderLesson({ stepGate: { judge: () => false, render: renderGate } })
    expect(renderGate).not.toHaveBeenCalled()
    expect(screen.getByText('x')).toBeTruthy()
  })
  it('judge 命中后续步:cont 过首步,答对进第二步再次开门', async () => {
    const renderGate = vi.fn((ctx: { word: WordUnit; skill: SkillKey; cont: () => void }) => (
      <button onClick={ctx.cont}>先学一下</button>
    ))
    renderLesson({
      makeQuestions: (_w: WordUnit, s: SkillKey) => [{ kind: 'choice', prompt: s, options: [{ id: 'a', text: 'A' }], answerId: 'a' }] as unknown as Question[],
      stepGate: { judge: () => true, render: renderGate },
    })
    expect(renderGate).toHaveBeenCalledTimes(1) // 首步(pinyin)门
    await userEvent.click(screen.getByRole('button', { name: '先学一下' }))
    answerChoice('A') // 答对首步 → 推进到第二步
    await waitFor(() => expect(renderGate).toHaveBeenCalledTimes(2), { timeout: 3000 }) // 第二步(hanzi)再开门
    expect(renderGate.mock.calls[1]?.[0]?.skill).toBe('hanzi')
    await userEvent.click(screen.getByRole('button', { name: '先学一下' }))
    expect(screen.getByText('hanzi')).toBeTruthy() // cont 后第二步装题
  })
  it('步内换题与 round 重试均不重判、不再开门', async () => {
    const renderGate = vi.fn((ctx: { word: WordUnit; skill: SkillKey; cont: () => void }) => (
      <button onClick={ctx.cont}>先学一下</button>
    ))
    const q1 = { kind: 'choice', prompt: 'x', options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], answerId: 'a' }
    const q2 = { kind: 'choice', prompt: 'y', options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], answerId: 'a' }
    renderLesson({
      makeQuestions: () => [q1, q2] as unknown as Question[],
      stepGate: { judge: () => true, render: renderGate },
    })
    await userEvent.click(screen.getByRole('button', { name: '先学一下' }))
    // 换题:首题答对 → 同一步内进第二题,不开门
    answerChoice('A')
    await waitFor(() => expect(screen.getByText('y')).toBeTruthy(), { timeout: 3000 })
    expect(renderGate).toHaveBeenCalledTimes(1)
    // round 重试:第二题连错两次 → reveal「再练一次」,点了仍在原步重出首题,不开门
    answerChoice('B')
    answerChoice('B')
    fireEvent.click(screen.getByRole('button', { name: '再练一次' }))
    expect(renderGate).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: '再练一次' })).toBeNull()
  })
  it('仅首步 judge 命中:末步(english)不开门,答完直通 onLessonComplete', async () => {
    const onComplete = vi.fn()
    const renderGate = vi.fn((ctx: { word: WordUnit; skill: SkillKey; cont: () => void }) => (
      <button onClick={ctx.cont}>先学一下</button>
    ))
    renderLesson({
      makeQuestions: (_w: WordUnit, s: SkillKey) => [{ kind: 'choice', prompt: s, options: [{ id: 'a', text: 'A' }], answerId: 'a' }] as unknown as Question[],
      stepGate: { judge: (_w, s) => s === 'pinyin', render: renderGate },
      onLessonComplete: onComplete,
    })
    expect(renderGate).toHaveBeenCalledTimes(1) // 首步(pinyin)门
    await userEvent.click(screen.getByRole('button', { name: '先学一下' }))
    answerChoice('A')
    await waitFor(() => expect(screen.getByText('hanzi')).toBeTruthy(), { timeout: 3000 }) // 第二步 judge false → 无门直出题
    expect(renderGate).toHaveBeenCalledTimes(1)
    answerChoice('A')
    await waitFor(() => expect(screen.getByText('english')).toBeTruthy(), { timeout: 3000 }) // 末步 judge false → 无门直出题
    expect(renderGate).toHaveBeenCalledTimes(1)
    answerChoice('A')
    await waitFor(() => expect(onComplete).toHaveBeenCalled(), { timeout: 3000 }) // 末步答完直通结课
  })
})
```

- [ ] **Step 2: 重写 `src/features/foundation/ColdStartWizard.test.tsx`(确认制插入点)**

改动要点:加 `confirmAnswer()` helper;两个循环(6 题、3 题)在 `clickAnyOption(container)` 后插 `confirmAnswer()` 再 `ADVANCE()`。其余(零写断言、跳过、关英语)不变。完整新文件:

```tsx
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BasicsProgressRow, BasicsService, UserSettings } from '@/shared/services'
import { ColdStartWizard } from './ColdStartWizard'

const settings: UserSettings = {
  enablePinyin: true,
  enableHanzi: true,
  enableEnglish: true,
  earnedAchievements: [],
  consecutiveDays: 0,
  lastActiveDate: '',
  updatedAt: '2026-09-05T00:00:00.000Z',
}
const noop = () => {}

function createFakeBasics() {
  const load = vi.fn(async () => {})
  const recordAnswer = vi.fn(async (_unitKey: string, _correct: boolean) => {})
  const markTaught = vi.fn(async (_unitKeys: readonly string[]) => {})
  const saveAll = vi.fn(async (_rows: readonly BasicsProgressRow[]) => {})
  const service: BasicsService = {
    load,
    recordAnswer,
    markTaught,
    saveAll,
    subscribe: () => () => undefined,
    getSnapshot: () => ({ status: 'ready', data: {} }),
  }
  return { service, load, recordAnswer, markTaught, saveAll }
}

/** 渲染向导(默认 settings 双轨开)。 */
function renderWizard(overrides: { settings?: UserSettings; onClose?: () => void } = {}) {
  const { service, load, recordAnswer, markTaught, saveAll } = createFakeBasics()
  const onClose = overrides.onClose ?? vi.fn()
  const utils = render(
    <ColdStartWizard
      settings={overrides.settings ?? settings}
      basics={service}
      speak={() => true}
      playSound={noop}
      onClose={onClose}
    />,
  )
  return { basics: service, load, recordAnswer, markTaught, saveAll, onClose, ...utils }
}

/** 点当前题首个选项(题面 shuffle 随机;对错都推进,故任选即可)。 */
function clickAnyOption(container: HTMLElement) {
  const grid = Array.from(container.querySelectorAll('div.grid')).find((el) => el.querySelectorAll('button').length > 0)
  expect(grid, '应存在选项 grid').toBeTruthy()
  const btn = grid!.querySelectorAll('button')[0] as HTMLElement
  fireEvent.click(btn)
}

/** 新确认制:点「确定」提交当前选中。 */
function confirmAnswer() {
  fireEvent.click(screen.getByRole('button', { name: '确定' }))
}

const ADVANCE = () => act(() => { vi.advanceTimersByTime(700) })

describe('ColdStartWizard', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { cleanup(); vi.useRealTimers() })

  it('逐题推进并答题 → 全程零写,「开始游戏」才一次性 saveAll(非空)+ onClose', () => {
    const { recordAnswer, saveAll, onClose, container } = renderWizard()

    // intro → question:首题(声母 g 锚点)题干出现
    fireEvent.click(screen.getByRole('button', { name: '开始' }))
    expect(screen.getByText(/声母|韵母|第几声|听一听/)).toBeInTheDocument()

    const total = 6 // 双轨开 → 3 pinyin + 3 english 探针
    for (let i = 0; i < total; i++) {
      clickAnyOption(container)
      confirmAnswer()
      ADVANCE()
      // 逐题只本地记录,不落库:中途答几题就「跳过」也不会提前写行
      expect(recordAnswer).not.toHaveBeenCalled()
      expect(saveAll).not.toHaveBeenCalled()
    }

    // done → 「开始游戏」一次性写入基线并收尾
    fireEvent.click(screen.getByRole('button', { name: '开始游戏' }))
    expect(recordAnswer).not.toHaveBeenCalled()
    expect(saveAll).toHaveBeenCalledTimes(1)
    const rows = saveAll.mock.calls[0][0] as readonly BasicsProgressRow[]
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((r) => r.taughtCount === 0)).toBe(true)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('跳过/退出 → 不 saveAll,onClose', () => {
    const { saveAll, recordAnswer, onClose } = renderWizard()

    fireEvent.click(screen.getByRole('button', { name: /跳过|退出/ }))

    expect(saveAll).not.toHaveBeenCalled()
    expect(recordAnswer).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('家长关英语 → 只抽拼音段,无英语听选题', () => {
    const { saveAll, recordAnswer, container } = renderWizard({ settings: { ...settings, enableEnglish: false } })

    fireEvent.click(screen.getByRole('button', { name: '开始' }))
    expect(screen.getByText(/声母/)).toBeInTheDocument() // 首题仍是拼音声母锚点题

    for (let i = 0; i < 3; i++) {
      clickAnyOption(container)
      confirmAnswer()
      ADVANCE()
    }

    expect(screen.getByRole('button', { name: '开始游戏' })).toBeInTheDocument()
    expect(screen.queryByText(/听一听,选出你听到的字母/)).not.toBeInTheDocument()
    expect(saveAll).toHaveBeenCalledTimes(0) // 未点「开始游戏」,尚未写基线
    expect(recordAnswer).not.toHaveBeenCalled() // 逐题零写:答完就跳也不落库
  })
})
```

- [ ] **Step 3: 修改 `src/app/App.test.tsx`(确认制插入点)**

改动 1 — 在现有 `clickAnyOption`(277-282 行)后加 helper(插到 `beforeEach(() => registry.clear())` 之前,`clickAnyOption` 定义块之后):

```tsx
/** 提交当前题(新确认制:点选项后再点「确定」才判)。 */
function confirmAnswer() {
  fireEvent.click(screen.getByRole('button', { name: '确定' }))
}
```

改动 2 — 冷启动循环(现 363-366 行)在每次 `clickAnyOption(container)` 后插入 `confirmAnswer()`:

```tsx
      for (let i = 0; i < 6; i++) {
        clickAnyOption(container)
        confirmAnswer()
        act(() => { vi.advanceTimersByTime(700) })
      }
```

> 其余不改:App.test 唯一 Choice/ListenChoice 交互即冷启动 6 题循环;speech spy 为 no-op,朗读不阻塞。home→lesson 用例只断言「返回地图」出现,不进题。

- [ ] **Step 4: 重写 `src/features/foundation/TeachOverlay.test.tsx` 到 tap-all/确定 定稿**

> 即便 Task 4 前 overlay 未开 `requireVisitAll`,tap-all 后确认必已放开 → 本文件即为终稿;Task 4 只追加出口用例。p/g 题事实沿用:声母 p 题选项 p/b/m(b 恒干扰,「两拼」口径),g 题选项 g/k/h。

```tsx
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { WordUnit, BasicsService, BasicsProgressSnapshot } from '@/shared/services'
import { TeachOverlay } from './TeachOverlay'

const apple: WordUnit = { id: 21, emoji: '🍎', pinyin: 'píng guǒ', hanzi: '苹果', english: 'apple', category: 'food' }
const speak = vi.fn(() => true)
const playSound = vi.fn()

function fakeBasics(): BasicsService {
  const snapshot: BasicsProgressSnapshot = { status: 'ready', data: {} }
  return {
    load: vi.fn(async () => {}),
    recordAnswer: vi.fn(async () => {}),
    markTaught: vi.fn(async () => {}),
    saveAll: vi.fn(async () => {}),
    subscribe: () => () => undefined,
    getSnapshot: () => snapshot,
  }
}

/** 前进到 quiz 步:demo → tap → quiz。 */
async function enterQuiz() {
  fireEvent.click(await screen.findByRole('button', { name: /下一步/ }))
  fireEvent.click(await screen.findByRole('button', { name: /下一步/ }))
  await screen.findByText(/开头的声母/)
}

/** 当前 quiz 题的选项按钮(首个含 button 的 div.grid;确认行/重听区为 flex,不会误抓)。 */
function optionButtons(container: HTMLElement): HTMLElement[] {
  const grid = Array.from(container.querySelectorAll('div.grid')).find((el) => el.querySelectorAll('button').length > 0)
  if (!grid) return []
  return Array.from(grid.querySelectorAll('button'))
}

/** 答对:全部选项点听一遍(听齐 + 满足 requireVisitAll)→ 选 target → 确定。 */
function answerTarget(container: HTMLElement, target: string) {
  optionButtons(container).forEach((b) => fireEvent.click(b))
  fireEvent.click(screen.getByText(target))
  fireEvent.click(screen.getByRole('button', { name: '确定' }))
}

/** 答错:同上,但最终选 wrong。 */
function answerWrong(container: HTMLElement, wrong: string) {
  optionButtons(container).forEach((b) => fireEvent.click(b))
  fireEvent.click(screen.getByText(wrong))
  fireEvent.click(screen.getByRole('button', { name: '确定' }))
}

function renderOverlay(over: { onDone?: () => void } = {}) {
  const basics = fakeBasics()
  const onDone = over.onDone ?? vi.fn()
  const utils = render(
    <TeachOverlay
      word={apple}
      skill="pinyin"
      units={['pinyin:p', 'pinyin:g']}
      basics={basics}
      speak={speak}
      playSound={playSound}
      onDone={onDone}
    />,
  )
  return { basics, onDone, ...utils }
}

describe('TeachOverlay', () => {
  it('按 units 逐题轻测,答对 recordAnswer(true) 且全过 markTaught + onDone', async () => {
    const { basics, onDone, container } = renderOverlay()

    await enterQuiz()

    // 两题逐题「听齐 + 选对 + 确定」
    answerTarget(container, 'p')
    // 第 1 题答对已推进到第 2 题(尚未全过)→ 教学记录此时不应落
    const second = await screen.findByText('g')
    expect(basics.markTaught).not.toHaveBeenCalled()
    answerTarget(container, 'g')

    // 全对 → praise 步「开始答题!」→ onDone
    fireEvent.click(await screen.findByRole('button', { name: /开始答题/ }))

    expect(basics.recordAnswer).toHaveBeenCalled()
    expect(basics.markTaught).toHaveBeenCalledWith(['pinyin:p', 'pinyin:g'])
    expect(onDone).toHaveBeenCalled()
  })

  it('答错 → recordAnswer(false) + 复演示反馈,点「再试一次」后答对继续,不 markTaught', async () => {
    const { basics, onDone, container } = renderOverlay()

    await enterQuiz()

    // 第 1 题听齐后选干扰项 'b' → 答错(复演示 overlay 替代题卡,Choice 卸载 → 重试时 visited 复位)
    answerWrong(container, 'b')
    expect(basics.recordAnswer).toHaveBeenCalledWith('pinyin:p', false)
    fireEvent.click(await screen.findByRole('button', { name: /再试一次/ }))

    // 重试第 1 题听齐答对,再答第 2 题
    answerTarget(container, 'p')
    const second = await screen.findByText('g')
    answerTarget(container, 'g')

    fireEvent.click(await screen.findByRole('button', { name: /开始答题/ }))

    expect(basics.recordAnswer).toHaveBeenCalledWith('pinyin:p', true)
    expect(basics.markTaught).toHaveBeenCalledWith(['pinyin:p', 'pinyin:g'])
    expect(onDone).toHaveBeenCalled()
  })

  it('「直接答题」跳过:onDone 即触发且不 markTaught', () => {
    const { basics, onDone } = renderOverlay()
    fireEvent.click(screen.getByRole('button', { name: /直接答题/ }))
    expect(onDone).toHaveBeenCalled()
    expect(basics.markTaught).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 5: 重写 `src/features/foundation/FoundationStepGate.test.tsx`(overlay 交互 tap-all 定稿)**

改动要点:覆盖到 TeachOverlay quiz 的交互(原直点 `p`/`g`)全部改 `answerTarget`(需 `container`);其余 needFor 镜像、`createPublishingBasics`(记录 estimator:correct 且 streak≥2 → known)、`GateHarness` 订阅结构、soft 浮条用例原样保留。完整新文件:

```tsx
import { useSyncExternalStore } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AudioCue, BasicsProgressData, BasicsProgressRow, BasicsProgressSnapshot, BasicsService, FoundationNeed, FoundationService, SkillKey, WordUnit } from '@/shared/services'
import type { Speak } from '@/shared/ui/quiz/speech'
import { FoundationStepGate } from './FoundationStepGate'

const apple: WordUnit = { id: 21, emoji: '🍎', pinyin: 'píng guǒ', hanzi: '苹果', english: 'apple', category: 'food' }
const noop = () => {}

/** 与 estimator.needFor 同口径:未掌握且从未教过→mandatory;教过仍 learning→soft;全 known→none。 */
function needFor(units: readonly string[], m: Readonly<BasicsProgressData>): FoundationNeed {
  let hasSoft = false
  for (const unit of units) {
    const row = m[unit]
    const model = row ? { state: row.state, taughtCount: row.taughtCount } : { state: 'learning' as const, taughtCount: 0 }
    if (model.state !== 'known' && model.taughtCount === 0) return 'mandatory'
    if (model.state !== 'known') hasSoft = true
  }
  return hasSoft ? 'soft' : 'none'
}

const foundation = { unitsFor: () => ['pinyin:p', 'pinyin:g'], needFor } as unknown as FoundationService
const basics = { recordAnswer: vi.fn(async () => {}), markTaught: vi.fn(async () => {}), saveAll: vi.fn(async () => {}) } as unknown as BasicsService

/** 会发布的 BasicsService fake:写入同步改内部快照并通知订阅者(镜像 App 对 basics 的订阅路径)。 */
function createPublishingBasics(initial: BasicsProgressData = {}) {
  let snapshot: BasicsProgressSnapshot = { status: 'ready', data: Object.freeze({ ...initial }) }
  const listeners = new Set<() => void>()
  function publish(nextData: BasicsProgressData) {
    snapshot = { status: 'ready', data: Object.freeze(nextData) }
    listeners.forEach((listener) => listener())
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    load: async () => {},
    async recordAnswer(unitKey: string, correct: boolean) {
      const row = snapshot.data[unitKey]
      const prev = row ? { state: row.state, correctStreak: row.correctStreak, taughtCount: row.taughtCount } : { state: 'learning' as const, correctStreak: 0, taughtCount: 0 }
      const streak = correct ? prev.correctStreak + 1 : 0
      const state = correct && streak >= 2 ? ('known' as const) : prev.state
      publish({ ...snapshot.data, [unitKey]: { unitKey, state, correctStreak: streak, taughtCount: prev.taughtCount, updatedAt: '' } })
    },
    async markTaught(unitKeys: readonly string[]) {
      const next: BasicsProgressData = { ...snapshot.data }
      for (const key of unitKeys) {
        const row = next[key]
        next[key] = { unitKey: key, state: row?.state ?? 'learning', correctStreak: row?.correctStreak ?? 0, taughtCount: (row?.taughtCount ?? 0) + 1, updatedAt: '' }
      }
      publish(next)
    },
    saveAll: async () => {},
  } as unknown as BasicsService
}

/** 挂载 FoundationStepGate 并从可发布 basics 快照实时取 data(镜像 App 的订阅路径)。 */
function GateHarness({ word, skill, foundation: f, basics: b, speak, playSound, onContinue }: {
  word: WordUnit
  skill: SkillKey
  foundation: FoundationService
  basics: BasicsService
  speak: Speak
  playSound: (cue: AudioCue) => void
  onContinue: () => void
}) {
  const snap = useSyncExternalStore(b.subscribe, b.getSnapshot, b.getSnapshot)
  return <FoundationStepGate word={word} skill={skill} data={snap.data} foundation={f} basics={b} speak={speak} playSound={playSound} onContinue={onContinue} />
}

/** 当前 quiz 题选项按钮 + 听齐答 target(同 TeachOverlay.test 定稿 helper)。 */
function answerTarget(container: HTMLElement, target: string) {
  const grid = Array.from(container.querySelectorAll('div.grid')).find((el) => el.querySelectorAll('button').length > 0)
  expect(grid, '应存在选项 grid').toBeTruthy()
  const btns = Array.from(grid!.querySelectorAll('button'))
  btns.forEach((b) => fireEvent.click(b))
  fireEvent.click(screen.getByText(target))
  fireEvent.click(screen.getByRole('button', { name: '确定' }))
}

describe('FoundationStepGate', () => {
  afterEach(cleanup)
  it('need mandatory → 渲染 TeachOverlay(出现「直接答题」/教学文案)', () => {
    render(<FoundationStepGate word={apple} skill="pinyin" data={{}} foundation={foundation} basics={basics} speak={() => true} playSound={noop} onContinue={vi.fn()} />)
    expect(screen.getByRole('button', { name: /直接答题/ })).toBeTruthy()
    expect(screen.getAllByText(/苹果/).length).toBeGreaterThan(0)
  })
  it('need none → 返回 null(不渲染)', () => {
    const { container } = render(<FoundationStepGate word={apple} skill="pinyin" data={{ 'pinyin:p': { unitKey: 'pinyin:p', state: 'known', correctStreak: 2, taughtCount: 1, updatedAt: '' }, 'pinyin:g': { unitKey: 'pinyin:g', state: 'known', correctStreak: 2, taughtCount: 1, updatedAt: '' } }} foundation={foundation} basics={basics} speak={() => true} playSound={noop} onContinue={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })
  it('soft(教过仍在 learning)→ 浮条,点「直接答题」走 onContinue', async () => {
    const cont = vi.fn()
    render(<FoundationStepGate word={apple} skill="pinyin" data={{}} foundation={{ ...foundation, needFor: () => 'soft' as const }} basics={basics} speak={() => true} playSound={noop} onContinue={cont} />)
    expect(screen.getByText(/想先学一下/)).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /直接答题/ }))
    expect(cont).toHaveBeenCalled()
  })
  it('soft 浮条点「先学一下」→ 切 TeachOverlay,onContinue 后走回调', async () => {
    const cont = vi.fn()
    render(<FoundationStepGate word={apple} skill="pinyin" data={{}} foundation={{ ...foundation, needFor: () => 'soft' as const }} basics={basics} speak={() => true} playSound={noop} onContinue={cont} />)
    await userEvent.click(screen.getByRole('button', { name: /先学一下/ }))
    expect(screen.getByRole('button', { name: /直接答题/ })).toBeTruthy() // 已切 TeachOverlay(其 header 带「直接答题」跳过)
  })
})

describe('FoundationStepGate (reactive basics — 自身写入不回抽)', () => {
  afterEach(cleanup)

  it('强制门:自身 recordAnswer/markTaught 写入不回抽,overlay 存活到 praise「开始答题!」', async () => {
    const publishing = createPublishingBasics()
    const onContinue = vi.fn()
    const { container } = render(<GateHarness word={apple} skill="pinyin" foundation={foundation} basics={publishing} speak={() => true} playSound={noop} onContinue={onContinue} />)

    fireEvent.click(await screen.findByRole('button', { name: /下一步/ })) // demo → tap
    fireEvent.click(await screen.findByRole('button', { name: /下一步/ })) // tap → quiz
    answerTarget(container, 'p')
    const g = await screen.findByText('g')
    answerTarget(container, 'g') // 末题答对 → recordAnswer + markTaught → 发布新快照(taughtCount=1 仍 learning)
    // 锁存:不得抽成 soft 浮条,overlay 须继续到 praise 结课
    expect(screen.queryByText(/想先学一下/)).toBeNull()
    fireEvent.click(await screen.findByRole('button', { name: /开始答题/ }))
    expect(onContinue).toHaveBeenCalled()
  })

  it('soft →「先学一下」:即使自身写入把单元升到 known 也不抽空,仍到 praise/onContinue', async () => {
    const rowP: BasicsProgressRow = { unitKey: 'pinyin:p', state: 'learning', correctStreak: 1, taughtCount: 1, updatedAt: '' }
    const rowG: BasicsProgressRow = { unitKey: 'pinyin:g', state: 'learning', correctStreak: 1, taughtCount: 1, updatedAt: '' }
    const publishing = createPublishingBasics({ 'pinyin:p': rowP, 'pinyin:g': rowG })
    const onContinue = vi.fn()
    const { container } = render(<GateHarness word={apple} skill="pinyin" foundation={foundation} basics={publishing} speak={() => true} playSound={noop} onContinue={onContinue} />)

    expect(screen.getByText(/想先学一下/)).toBeTruthy() // soft 浮条
    await userEvent.click(screen.getByRole('button', { name: /先学一下/ }))
    fireEvent.click(await screen.findByRole('button', { name: /下一步/ })) // demo → tap
    fireEvent.click(await screen.findByRole('button', { name: /下一步/ })) // tap → quiz
    answerTarget(container, 'p') // streak2 → known;发布
    const g = await screen.findByText('g')
    answerTarget(container, 'g') // 同 + markTaught;发布(全 known → need none,teaching latch 仍须保 overlay)
    expect(screen.queryByText(/想先学一下/)).toBeNull()
    fireEvent.click(await screen.findByRole('button', { name: /开始答题/ }))
    expect(onContinue).toHaveBeenCalled()
  })
})
```

> 注:`answerTarget(container, 'g')` 前的 `await screen.findByText('g')` 保证题卡已切到第 2 题(首题判对后 420ms 推进;真实计时器)。p/g 两题题面互不含对方目标字,`findByText` 不会撞第 1 题残留。

- [ ] **Step 6: 全量回归**

Run: `npm test`
Expected: 全绿(含 architecture)。此刻 overlay 源码尚未开 `requireVisitAll`,tap-all 用例已通过(Task 4 开闸后同样成立,交互零回改)。

- [ ] **Step 7: Commit**

```bash
git add src/features/lesson/WordLesson.test.tsx src/features/foundation/ColdStartWizard.test.tsx src/app/App.test.tsx src/features/foundation/TeachOverlay.test.tsx src/features/foundation/FoundationStepGate.test.tsx
git commit -m "test(quiz): 消费方测试迁移确认制(选卡+确定;短教 tap-all 定稿)"
```

---

### Task 4: TeachOverlay 学习化收口(requireVisitAll + accent 视觉壳 + 出口接线)+ ctx.exit 接线

**Files:**
- Modify: `src/features/foundation/TeachOverlay.tsx`(props `onExit?`、`requireVisitAll: true`、accent 教学壳、header 返回钮、praise 返回地图)
- Modify: `src/features/foundation/FoundationStepGate.tsx`(props `onExit?` + 透传)
- Modify: `src/features/lesson/WordLesson.tsx:37,269`(stepGate.render ctx 增可选 `exit`;渲染传 `exit: onExit`)
- Modify: `src/app/App.tsx:119`(stepGate.render ctx 类型增 `exit?`;给 FoundationStepGate 传 `onExit={ctx.exit}`)
- Modify: `src/features/lesson/WordLesson.test.tsx`(追加 ctx.exit 用例)
- Modify: `src/features/foundation/TeachOverlay.test.tsx`(追加出口用例)
- Modify: `src/features/foundation/FoundationStepGate.test.tsx`(追加透传用例)

**Interfaces:**
- Consumes: Task 3 各测试定稿 helpers(`answerTarget`/`optionButtons`);Task 2 Choice `requireVisitAll`。
- Produces: `TeachOverlayProps` 增 `onExit?: () => void`;`FoundationStepGateProps` 增 `onExit?: () => void`;`WordLesson` stepGate ctx = `{ word; skill; cont(): void; exit?: () => void }`(可选 → 未接线渲染器与 Task 3 窄注解全兼容);TeachOverlay 内 quiz 卡一律 `requireVisitAll: true`(语义仅开在短教;主词课/冷启动 Choice 不带该 prop)。

- [ ] **Step 1: 改 `src/features/foundation/TeachOverlay.tsx`**

1a. props 类型(现 17-25 行 `onDone` 后)与解构(35 行)增 `onExit`:

```tsx
export type TeachOverlayProps = {
  word: WordUnit
  skill: 'pinyin' | 'english'
  units: readonly string[] // 该词该技能拆出的目标单元(TeachGate 传入;≥1)
  basics: BasicsService // 教学回调直接落库(组件不 useService,由组装方注入)
  speak: Speak
  playSound: (cue: AudioCue) => void
  onDone: () => void // 全部完成(已 record/markTaught)或中途「直接答题」跳过
  onExit?: () => void // 短教出口:标题返回 / praise「返回地图」(可选,缺省无出口)
}
```

```tsx
export function TeachOverlay({ word, skill, units, basics, speak, playSound, onDone, onExit }: TeachOverlayProps) {
```

1b. import 增 `ArrowLeft`(第 6 行 `import { Volume2 } from 'lucide-react'` → 同包并取):

```tsx
import { ArrowLeft, Volume2 } from 'lucide-react'
```

1c. overlay 根容器(154 行)换 accent 教学底:

```tsx
<div className="fixed inset-0 z-50 overflow-y-auto bg-accent/10 backdrop-blur-sm">
```

1d. header(156-165 行)整体替换为「返回 + accent 教学 pill + 跳过」;返回钮 aria 固定「返回」(红线,勿用「返回地图」):

```tsx
<header className="flex items-center justify-between gap-2">
  <div className="flex items-center gap-2">
    {onExit && phase !== 'praise' ? (
      <Button variant="ghost" size="icon" onClick={onExit} aria-label="返回">
        <ArrowLeft className="h-5 w-5" />
      </Button>
    ) : null}
    <span className="rounded-full border border-accent/40 bg-accent-tint/60 px-2.5 py-1 text-xs font-semibold text-accent-ink">
      {word.emoji} {word.hanzi} · {SKILL_LABEL[skill]}短教
    </span>
  </div>
  {phase !== 'praise' ? (
    <Button variant="ghost" size="sm" onClick={skip} aria-label="跳过短教直接答题">
      直接答题
    </Button>
  ) : null}
</header>
```

1e. `renderQuestion` 内 `shared`(347-354 行)开 `requireVisitAll`:

```tsx
const shared = {
  skill,
  options: q.options,
  speak,
  requireVisitAll: true, // 短教学习化:目标+干扰全点听一遍才可确认(仍判分)
  disabled: qState === 'correct',
  correctId: qState === 'correct' ? correctId : null,
  onAnswer: handleQuizAnswer,
}
```

1f. 两个 quiz 卡外框(362 行、374 行,同一 className 字符串出现两处,`replaceAll`)白卡 → accent distinct(教学期外框与真答题白卡拉开):

```tsx
className="rounded-[1.75rem] border-2 border-accent/30 bg-accent/10 p-4 sm:p-5"
```

1g. `renderPraise`(403-410 行)前置「返回地图」ghost(onExit 时):

```tsx
<div className="flex flex-wrap items-center justify-center gap-2">
  {onExit ? (
    <Button variant="ghost" onClick={onExit}>
      返回地图
    </Button>
  ) : null}
  <Button variant="ghost" onClick={replayDemo}>
    再看一遍演示
  </Button>
  <Button size="lg" onClick={onDone}>
    开始答题!
  </Button>
</div>
```

> demo/tap 步的点读喇叭与「朗读整词/组 chip」保留(非选项卡,属教学点读,spec §3.5)。

- [ ] **Step 2: 改 `src/features/foundation/FoundationStepGate.tsx`(onExit 透传)**

props 类型(9-18 行)增、解构(20 行)增、mandatory 分支(31-33 行)传:

```tsx
export type FoundationStepGateProps = {
  word: WordUnit
  skill: SkillKey // hanzi 不会到这(判定已滤)
  data: Readonly<BasicsProgressData> // 当前熟度快照(组装层订阅后传入)
  foundation: FoundationService
  basics: BasicsService
  speak: Speak
  playSound: (cue: AudioCue) => void
  onContinue: () => void // 跳过或学完回正题
  onExit?: () => void // 教学出口(可选):直接回群岛
}
```

```tsx
export function FoundationStepGate({ word, skill, data, foundation, basics, speak, playSound, onContinue, onExit }: FoundationStepGateProps) {
```

```tsx
  if (need === 'mandatory' || teaching) {
    return <TeachOverlay word={word} skill={skill} units={units} basics={basics} speak={speak} playSound={playSound} onDone={onContinue} onExit={onExit} />
  }
```

- [ ] **Step 3: 改 `src/features/lesson/WordLesson.tsx`(gate ctx 增可选 exit)**

37 行 ctx 类型:

```tsx
  stepGate?: {
    judge(word: WordUnit, skill: SkillKey): boolean
    render(ctx: { word: WordUnit; skill: SkillKey; cont(): void; exit?: () => void }): ReactNode
  }
```

269 行 gate 渲染调用:

```tsx
          {stepGate?.render({ word, skill: gate.skill, cont, exit: onExit })}
```

- [ ] **Step 4: 改 `src/app/App.tsx`(ctx 透传 exit → FoundationStepGate onExit)**

119 行 render ctx 参数类型 + FoundationStepGate 传参(120-131 行):

```tsx
      render: (ctx: { word: WordUnit; skill: SkillKey; cont: () => void; exit?: () => void }) => (
        <FoundationStepGate
          key={`${ctx.word.id}-${ctx.skill}`}
          word={ctx.word}
          skill={ctx.skill}
          data={data}
          foundation={foundation}
          basics={basics}
          speak={speech.speak}
          playSound={audio.play}
          onContinue={ctx.cont}
          onExit={ctx.exit}
        />
      ),
```

> `ctx.exit` 在 WordLesson 侧恒为 `onExit`(App 传 `actions.exitToHome`);类型可选,未接线渲染器不崩。deps 数组(133 行)不变。

- [ ] **Step 5: 追加 `src/features/lesson/WordLesson.test.tsx` ctx.exit 用例**

在原 describe 收尾前(现「仅首步 judge 命中…」用例 `})` 与 describe 收尾 `})` 之间)插入:

```tsx
  it('gate.render ctx 携带 exit:点返回钮触发 onExit', async () => {
    const onExit = vi.fn()
    const renderGate = vi.fn((ctx: { word: WordUnit; skill: SkillKey; cont: () => void; exit?: () => void }) => (
      <button onClick={() => ctx.exit?.()}>先离开一下</button>
    ))
    renderLesson({ stepGate: { judge: () => true, render: renderGate }, onExit })
    await userEvent.click(screen.getByRole('button', { name: '先离开一下' }))
    expect(onExit).toHaveBeenCalledTimes(1)
  })
```

- [ ] **Step 6: 追加 `src/features/foundation/TeachOverlay.test.tsx` 出口用例**

Task 3 的 `renderOverlay` 缺省不传 `onExit`(当时 TeachOverlay 尚无该 prop);此处 TeachOverlay 已支持(Task 4 Step 1),先把 helper 升级为可选 `onExit` 透传——Task 3 旧三用例不传参,语义不变:

```tsx
function renderOverlay(over: { onDone?: () => void; onExit?: () => void } = {}) {
  const basics = fakeBasics()
  const onDone = over.onDone ?? vi.fn()
  const onExit = over.onExit ?? vi.fn()
  const utils = render(
    <TeachOverlay
      word={apple}
      skill="pinyin"
      units={['pinyin:p', 'pinyin:g']}
      basics={basics}
      speak={speak}
      playSound={playSound}
      onDone={onDone}
      onExit={onExit}
    />,
  )
  return { basics, onDone, ...utils }
}
```

在原文件末尾 describe 收尾前插入两用例(复用 Task 3 helpers;文件与 Task 3 一致**不 import `cleanup`**——靠 vitest globals 下 RTL 自动清理,勿用 `cleanup()`):

```tsx
  it('onExit:标题栏「返回」离教(demo 期)', () => {
    const onExit = vi.fn()
    const onDone = vi.fn()
    renderOverlay({ onDone, onExit })
    fireEvent.click(screen.getByRole('button', { name: '返回' }))
    expect(onExit).toHaveBeenCalledTimes(1)
    expect(onDone).not.toHaveBeenCalled()
  })

  it('onExit:praise 结课「返回地图」离教(未点「开始答题」不 onDone)', async () => {
    const onExit = vi.fn()
    const onDone = vi.fn()
    const { container } = renderOverlay({ onDone, onExit })

    await enterQuiz()
    answerTarget(container, 'p')
    await screen.findByText('g')
    answerTarget(container, 'g')

    fireEvent.click(await screen.findByRole('button', { name: '返回地图' }))
    expect(onExit).toHaveBeenCalledTimes(1)
    expect(onDone).not.toHaveBeenCalled()
  })
```

> demo/praise 前阶段标题栏返回钮 aria 固定「返回」;praise 期 header 返回隐藏、由结课「返回地图」可见文本钮接管(红线:两钮并存不撞名)。

- [ ] **Step 7: 追加 `src/features/foundation/FoundationStepGate.test.tsx` 透传用例**

在文件末尾(第二个 describe 收尾前或其后另起 describe 均可)追加:

```tsx
describe('FoundationStepGate onExit 透传', () => {
  afterEach(cleanup)
  it('mandatory → TeachOverlay 标题「返回」触发 onExit', () => {
    const exit = vi.fn()
    render(<FoundationStepGate word={apple} skill="pinyin" data={{}} foundation={foundation} basics={basics} speak={() => true} playSound={noop} onContinue={vi.fn()} onExit={exit} />)
    fireEvent.click(screen.getByRole('button', { name: '返回' }))
    expect(exit).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 8: 全量回归**

Run: `npm test`
Expected: 全绿。要点核对:TeachOverlay/FoundationStepGate tap-all 用例在 `requireVisitAll: true` 下照常过(Task 3 已 tap-all);WordLesson ctx 增可选 exit 不破坏窄注解;architecture 边界(shared/features/app 三层、注册纪律)不破。

- [ ] **Step 9: Commit**

```bash
git add src/features/foundation/TeachOverlay.tsx src/features/foundation/FoundationStepGate.tsx src/features/lesson/WordLesson.tsx src/app/App.tsx src/features/lesson/WordLesson.test.tsx src/features/foundation/TeachOverlay.test.tsx src/features/foundation/FoundationStepGate.test.tsx
git commit -m "feat(foundation): 短教学习化收口(requireVisitAll + accent 壳 + 返回地图出口)+ gate exit 接线"
```

---

## Self-Review(已内联核对)

- **Spec 覆盖**:§3.1 Choice 确认制/去喇叭/整块重听/requireVisitAll → Task 2;§3.2 ListenChoice 重听区/透传 → Task 2;§3.3 Match 去喇叭/纯选择朗读 → Task 1;§3.4 主词课自动推进保留 + 判定平移 → Task 2/3(650ms 不变);§3.5 短教学习化(requireVisitAll 判分保熟度 + onExit 出口 + accent 壳)→ Task 4;§3.6 冷启动随确认制、计时不变 → Task 3;§4 文件表全部落位(WordLesson/App/FoundationStepGate/ColdStart 源码因可选/默认向下兼容或语义保留近乎零改,已逐条说明)。
- **Placeholder 扫描**:所有新文件/重写文件为完整正文;源码改动为「旧值 → 新值」精确串;无 TBD/占位。
- **类型一致**:helper 命名跨文件统一(`optionButtons`/`answerTarget`/`answerWrong` in TeachOverlay.test;同名 `answerTarget` 于 FoundationStepGate.test 但 local;`answerChoice` 仅 WordLesson.test;`confirmAnswer` 于 ColdStartWizard.test 与 App.test;`clickAnyOption` 保留原名)。Choice prop 名 `requireVisitAll`;TeachOverlay/FoundationStepGate prop `onExit?`;WordLesson ctx 成员 `exit?: () => void` 各处同名。listen/choice 语言经 `speakCard` → `langFor`(english → en-US,其余 zh-CN),测试断言一致。
- **红线自检**:确认行/重听区皆 flex;TeachOverlay 返回 aria「返回」、praise「返回地图」可见文本;Task 3 未动 App.test 其余;WordLesson ctx `exit` 可选保 Task 3 窄注解兼容。
