import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AchievementService,
  AudioService,
  CelebrateService,
  ComboService,
  LuckyBonusService,
  PinyinProgressService,
  SettingsService,
  SpeechService,
  type AnswerKind,
  type Achievement,
} from '@/shared/services'
import { registry } from '@/shared/services/core'
import { UNITS } from './levels'
import { canPlace, slotsFor } from './rules'
import { SPEAK_OF, type Block, type BlockType } from './blocks'
import type { Chapter } from './chapter'
import { UnitEntry } from './UnitEntry'

/** u1 简单 / 困难题在 `unit.levels` 里的绝对下标。 */
const U1_EASY_INDEXES = Array.from(
  { length: UNITS[0]!.levels.filter((level) => level.stage !== 'hard').length },
  (_, index) => index,
)
const U1_HARD_START = UNITS[0]!.levels.findIndex((level) => level.stage === 'hard')

/** 稳定引用的可发布快照 —— useSyncExternalStore 要求 getSnapshot 返回稳定引用。 */
function makeStore<T>(initial: T) {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    get: () => value,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    set(next: T) {
      value = next
      listeners.forEach((listener) => listener())
    },
  }
}

/** 只登记 UnitEntry 真正取用的服务 —— 未注册的服务会当场抛错,那本身也是断言。 */
function mountUnitEntry(opts: {
  comboAnswers?: number[]
  earned?: readonly Achievement[]
  luckyReward?: number
  unitIndex?: number
  chapter?: Chapter
} = {}) {
  const { unitIndex = 0, chapter = 'easy' } = opts
  registry.clear()

  const progressStore = makeStore({ status: 'ready' as const, data: { stars: {}, totalStars: 0 } })
  const progress = {
    getSnapshot: progressStore.get,
    subscribe: progressStore.subscribe,
    load: vi.fn(async () => undefined),
    recordClear: vi.fn(async () => undefined),
    resetAll: vi.fn(async () => undefined),
  }

  const settingsStore = makeStore({
    status: 'ready' as const,
    data: { earnedAchievements: [], consecutiveDays: 0, lastActiveDate: '', updatedAt: '' },
  })
  const settings = {
    getSnapshot: settingsStore.get,
    subscribe: settingsStore.subscribe,
    load: vi.fn(async () => undefined),
    save: vi.fn(async () => undefined),
  }

  const comboStore = makeStore({ combo: 0, maxCombo: 0 })
  const answers = [...(opts.comboAnswers ?? [])]
  let combo = 0
  const comboService = {
    getSnapshot: comboStore.get,
    subscribe: comboStore.subscribe,
    answer: vi.fn((_kind: AnswerKind) => {
      const scripted = answers.shift()
      combo = scripted ?? 0
      comboStore.set({ combo, maxCombo: Math.max(comboStore.get().maxCombo, combo) })
      return combo
    }),
    reset: vi.fn(),
    getBonus: vi.fn(() => 0),
  }

  const celebrate = { play: vi.fn() }
  const achievements = { scan: vi.fn(() => [...(opts.earned ?? [])]) }
  const lucky = { roll: vi.fn(() => opts.luckyReward ?? 0) }

  registry.register(PinyinProgressService, progress as never)
  registry.register(SettingsService, settings as never)
  registry.register(ComboService, comboService as never)
  registry.register(CelebrateService, celebrate as never)
  registry.register(AchievementService, achievements as never)
  registry.register(LuckyBonusService, lucky as never)
  registry.register(SpeechService, { speak: () => true, speakRole: () => true, stop: () => undefined } as never)
  registry.register(AudioService, {
    getSnapshot: () => true,
    subscribe: () => () => {},
    isOn: () => true,
    setOn: () => {},
    play: vi.fn(),
    unlock: () => undefined,
  } as never)

  const onSettle = vi.fn()
  const utils = render(
    <UnitEntry unitIndex={unitIndex} initialChapter={chapter} onExitToMap={vi.fn()} onSettle={onSettle} />,
  )
  return { ...utils, celebrate, comboService, comboStore, onSettle, progressService: progress }
}

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

/**
 * 困难章:给每个槽放一块**类型对、值错**的块。
 * 困难章的门禁只比类型(`sameTypeOnly`),这些块当场都放得进去;直到盘面填满才被判错 ——
 * 于是**恰好记 1 次 miss**,随后 720ms 撤块重来。
 */
function fillWrongOnce(levelIndex = 0) {
  for (const slot of slotsFor(UNITS[0]!.levels[levelIndex]!)) {
    const pick = trayBlocks().find((el) => {
      const block = blockOf(el)
      return block.type === slot.type && block.value !== slot.value
    })
    expect(pick, `${slot.type} 槽找不到「类型对、值错」的块`).toBeDefined()
    fireEvent.keyDown(pick as HTMLElement, { key: 'Enter' })
  }
}

/** 通关回调在成功动画**之后**才发(260ms 判定 + 1600ms 停顿)—— 推时钟并把微任务排干。 */
async function settle() {
  await act(async () => {
    vi.advanceTimersByTime(3000)
  })
}

/** 章间过场停 1.2s 才交回(STAGE_TRANSITION_MS)—— 推时钟越过它。 */
async function transition() {
  await act(async () => {
    vi.advanceTimersByTime(1300)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  // jsdom 没实现 document.elementFromPoint(真实浏览器都有),拖拽回调会调它。
  Object.defineProperty(document, 'elementFromPoint', { value: () => null, configurable: true })
})

afterEach(() => {
  cleanup()
  registry.clear()
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.querySelectorAll('.pblock--dragging').forEach((el) => el.remove())
})

/** 放一块**放得下**的块(点选路径 = 自动落位)—— 每次落块都会走一次 onBlock。 */
function placeOneFitting() {
  for (const slot of slotsFor(UNITS[0]!.levels[0]!)) {
    const pick = trayBlocks().find((el) => canPlace(blockOf(el), slot))
    if (pick) {
      fireEvent.keyDown(pick, { key: 'Enter' })
      return
    }
  }
  throw new Error('托盘里没有放得下的块,落块用例无法推进')
}

describe('UnitEntry · 撒花接线', () => {
  // 只落一块:阈值判定在 celebrationFor(纯函数,用例在 celebrate.test.ts),
  // 这里证的是「combo.answer() 的返回值真的被接线了」—— 此前它被直接丢弃。
  it('落一块后 combo 返 5 → combo5 档撒花', () => {
    const { celebrate } = mountUnitEntry({ comboAnswers: [5] })
    placeOneFitting()
    expect(celebrate.play).toHaveBeenCalledWith('combo5')
    expect(celebrate.play).not.toHaveBeenCalledWith('combo10')
  })

  it('落一块后 combo 返 10 → combo10 档撒花', () => {
    const { celebrate } = mountUnitEntry({ comboAnswers: [10] })
    placeOneFitting()
    expect(celebrate.play).toHaveBeenCalledWith('combo10')
  })

  it('落一块后 combo 返 3 → 不撒花(不是每个数都撒)', () => {
    const { celebrate } = mountUnitEntry({ comboAnswers: [3] })
    placeOneFitting()
    expect(celebrate.play).not.toHaveBeenCalled()
  })

  it('一章拼成且没有奖励弹层接手 → word 档撒花', async () => {
    const { celebrate, onSettle } = mountUnitEntry()
    await solveChapter(U1_EASY_INDEXES)
    expect(onSettle).toHaveBeenCalled()
    expect(celebrate.play).toHaveBeenCalledWith('word')
  })

  it('有成就接手时 word 档不撒 —— 一次成功只撒一次花', async () => {
    const { celebrate, onSettle } = mountUnitEntry({
      earned: [{ id: 'perfect_level', name: '完美主义', description: 'x', emoji: '💎', reward: 50 }],
    })
    await solveChapter(U1_EASY_INDEXES)
    expect(onSettle).toHaveBeenCalled()
    expect(celebrate.play).not.toHaveBeenCalledWith('word')
  })

  it('有幸运奖励接手时 word 档不撒', async () => {
    const { celebrate, onSettle } = mountUnitEntry({ luckyReward: 50 })
    await solveChapter(U1_EASY_INDEXES)
    expect(onSettle).toHaveBeenCalled()
    expect(celebrate.play).not.toHaveBeenCalledWith('word')
  })
})

describe('UnitEntry · 连击圆点', () => {
  const litCount = () => document.querySelectorAll('[data-combo-dots] .bg-accent').length
  const announced = () =>
    Number(document.querySelector<HTMLElement>('[data-combo-dots]')?.dataset.comboLit)

  it('会话连击 0 → 一颗不亮', () => {
    mountUnitEntry()
    expect(announced()).toBe(0)
    expect(litCount()).toBe(0)
  })

  it('会话连击 3 → 亮 3 颗', () => {
    const { comboStore } = mountUnitEntry()
    act(() => comboStore.set({ combo: 3, maxCombo: 3 }))
    expect(announced()).toBe(3)
    expect(litCount()).toBe(3)
  })

  it('会话连击 7 → 封顶 5 颗', () => {
    const { comboStore } = mountUnitEntry()
    act(() => comboStore.set({ combo: 7, maxCombo: 7 }))
    expect(announced()).toBe(5)
    expect(litCount()).toBe(5)
  })

  // 断的是**填色**这一态,不写动画:App.tsx 的 MotionConfig reducedMotion="user" 全局生效,
  // 纯动画表达对减动效用户等于不存在。
  it('答错归零 → 全部熄灭(填色态跟着快照走)', () => {
    const { comboStore } = mountUnitEntry()
    act(() => comboStore.set({ combo: 4, maxCombo: 4 }))
    expect(litCount()).toBe(4)
    act(() => comboStore.set({ combo: 0, maxCombo: 4 }))
    expect(litCount()).toBe(0)
  })
})

describe('UnitEntry · 章推进与交账', () => {
  // 题内错数由 `ChapterRun` 交给 `starsFor` 折算成星级 —— 3 次点错足够跨出 2 星的档界。
  it('简单章:一题错 3 次 ⇒ 该题按 starsFor(3) = 1 星落库', async () => {
    const { progressService } = mountUnitEntry()
    for (let i = 0; i < 3; i++) {
      fireEvent.keyDown(screen.getByLabelText('声调块 4'), { key: 'Enter' })
    }
    solveCorrectly(0)
    await settle()
    expect(progressService.recordClear).toHaveBeenCalledWith(
      expect.objectContaining({ levelId: UNITS[0]!.levels[0]!.id, stars: 1 }),
    )
  })

  it('困难章:填满一套值错的块 ⇒ 判错撤块后重来,照样推进下一题', async () => {
    mountUnitEntry({ chapter: 'hard' })
    fillWrongOnce(U1_HARD_START)
    await act(async () => {
      vi.advanceTimersByTime(800)
    })
    solveCorrectly(U1_HARD_START)
    await settle()
    expect(document.body.textContent).toContain(UNITS[0]!.levels[U1_HARD_START + 1]!.emoji)
  })

  // `flush` 发完必须清账(`pending.current = null`)。
  // 少了那一行,pending 就一直在那儿 —— 回地图被连点两次(头部的按钮在退出动画里仍可点)
  // 会把同一笔结算**发两次**:星尘算两遍、撒花两遍。这里点两次、断言各一次。
  it('章内中途连点两次回地图:结算与撒花仍各只发一次', async () => {
    const { onSettle, celebrate } = mountUnitEntry()
    solveCorrectly(0)
    await settle()
    const back = screen.getByLabelText('回地图')
    fireEvent.click(back)
    // 树的父层只是 vi.fn(onExitToMap),组件没被卸载 —— 第二下会真的再走一次 handleExit。
    expect(back).toBeInTheDocument()
    fireEvent.click(back)
    expect(onSettle).toHaveBeenCalledTimes(1)
    expect(celebrate.play).toHaveBeenCalledTimes(1)
  })
})

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
    // 简单章第一题上故意把**韵母**与**声调**两类各点错两次(阈值 N = 2)⇒ 两类都入池。
    // 池里只喂一类的话,复习章只会出 1 道小题 ⇒ 进度点只有 1 颗,判据立不住。
    const finalHost = trayBlocks().find((el) => {
      const block = blockOf(el)
      return block.type === 'final' && block.value !== UNITS[0]!.levels[0]!.syl[0]!.final
    })
    expect(finalHost, '托盘中找不到要故意点错的韵母块').toBeDefined()
    fireEvent.keyDown(finalHost as HTMLElement, { key: 'Enter' })
    fireEvent.keyDown(finalHost as HTMLElement, { key: 'Enter' })
    const toneHost = trayBlocks().find((el) => {
      const block = blockOf(el)
      return block.type === 'tone' && block.value !== String(UNITS[0]!.levels[0]!.syl[0]!.tone)
    })
    expect(toneHost, '托盘中找不到要故意点错的声调块').toBeDefined()
    fireEvent.keyDown(toneHost as HTMLElement, { key: 'Enter' })
    fireEvent.keyDown(toneHost as HTMLElement, { key: 'Enter' })
    await solveChapter(Array.from({ length: u1Easy }, (_, i) => i))
    await transition() // → 困难章
    await solveChapter(Array.from({ length: 6 }, (_, i) => u1HardStart + i))
    await transition() // → 复习章
    const dots = document.querySelector<HTMLElement>('[data-review-dots]')
    expect(dots, '复习章没上屏').not.toBeNull()
    expect(dots!.querySelectorAll('.pstage-dot').length, '池空就该只有 1 颗兜底点').toBeGreaterThan(1)
  })
})
