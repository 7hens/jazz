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
import { easyLevelsOf, hardLevelsOf, UNITS, type Level } from './levels'
import { canPlace, slotsFor } from './rules'
import { SPEAK_OF, type Block, type BlockType } from './blocks'
import { practiceQuestions } from './practice'
import { PRACTICE_MAX, practiceLevelsOf } from './progress-stats'
import { UnitEntry } from './UnitEntry'

/**
 * u1 的简单题 / 困难题,以及它们在 `unit.levels` 里的绝对下标。
 * **一律从 `easyLevelsOf` / `hardLevelsOf` 派生** —— 题数增删时这里跟着走,
 * 不写死题数(写死的话加一题这条文件会以「题面找不到」的误导性方式红)。
 */
const U1_EASY_LEVELS = easyLevelsOf(UNITS[0]!)
const U1_HARD_LEVELS = hardLevelsOf(UNITS[0]!)
const u1IndexesOf = (levels: readonly Level[]) => levels.map((level) => UNITS[0]!.levels.indexOf(level))
const U1_EASY_INDEXES = u1IndexesOf(U1_EASY_LEVELS)
const U1_HARD_INDEXES = u1IndexesOf(U1_HARD_LEVELS)
const U1_HARD_START = U1_HARD_INDEXES[0]!

/**
 * 「简单部分已全通」的星级表 —— 用它把起点推到困难部分。
 *
 * 地图上一个单元只有一个入口,起点由 `firstIncompletePart` 按星级表算,**不由孩子选**;
 * 所以「从困难部分进」这件事今天只能用预置星级表来造。
 */
const easySolved = (): Record<string, number> =>
  Object.fromEntries(U1_EASY_LEVELS.map((level) => [level.id, 1]))

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
  /** 预置在库的星级表(存档键 → 星数)—— 起点由 `firstIncompletePart` 按它算。 */
  stars?: Record<string, number>
} = {}) {
  const { unitIndex = 0, stars = {} } = opts
  registry.clear()

  const progressStore = makeStore({ status: 'ready' as const, data: { stars, totalStars: 0 } })
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
  const utils = render(<UnitEntry unitIndex={unitIndex} onExitToMap={vi.fn()} onSettle={onSettle} />)
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

/** 把一整个部分的题全部拼对(逐题:拼 → 等落地动画 → 下一题自动上屏)。 */
async function solvePart(levelIndexes: readonly number[]) {
  for (const index of levelIndexes) {
    solveCorrectly(index)
    await settle()
  }
}

/**
 * 困难部分:给每个槽放一块**类型对、值错**的块。
 * 困难部分的门禁只比类型(`sameTypeOnly`),这些块当场都放得进去;直到盘面填满才被判错 ——
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

/**
 * 走到练习部分的完整路径:走完简单部分 → **直接**进困难部分 → 走完 → **直接**进练习部分
 * (部分间过场已取消)。
 *
 * 练习题源 = 本单元「<3 星」的题(封顶 `PRACTICE_MAX`),**不再**由错题池决定 ——
 * 所以这条路径不必先在简单部分点错什么。
 */
async function reachPracticePart(stars: Record<string, number> = {}) {
  const mounted = mountUnitEntry({ unitIndex: 0, stars })
  // 部分末不再等 1.2s 遮罩 —— 上一部分最后一题的成功动画走完,下一部分直接上屏。
  await solvePart(U1_EASY_INDEXES) // → 困难部分
  await solvePart(U1_HARD_INDEXES) // → 练习部分
  return mounted
}

/** 本单元此刻的练习题表 —— 与宿主同一口径(`practiceLevelsOf` 是唯一题源)。 */
const practiceItemsOf = (stars: Record<string, number> = {}) =>
  practiceQuestions(UNITS[0]!, 0, practiceLevelsOf(stars, UNITS[0]!))

/**
 * 屏上被挖空的槽(练习恒整题挖空,靠它对齐题面)。
 * **排序后交回**:DOM 里声调槽画在韵腹槽上方(顺序与 `slotsFor` 不同),比顺序等于比排版。
 */
function emptySlotIds(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-slot-id]'))
    .filter((el) => el.querySelector('[data-value]') === null)
    .map((el) => el.dataset.slotId as string)
    .sort()
}

/** 把练习的一道整题拼完:它的全部槽都得填对。 */
async function solvePracticeItem(levelIndex: number) {
  for (const slot of slotsFor(UNITS[0]!.levels[levelIndex]!)) {
    const pick = trayBlocks().find((el) => canPlace(blockOf(el), slot))
    expect(pick, `练习题的槽 ${slot.id} 在托盘里找不到可放块`).toBeDefined()
    fireEvent.keyDown(pick as HTMLElement, { key: 'Enter' })
  }
  await settle()
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

  it('一部分拼成且没有奖励弹层接手 → word 档撒花', async () => {
    const { celebrate, onSettle } = mountUnitEntry()
    await solvePart(U1_EASY_INDEXES)
    expect(onSettle).toHaveBeenCalled()
    expect(celebrate.play).toHaveBeenCalledWith('word')
  })

  it('有成就接手时 word 档不撒 —— 一次成功只撒一次花', async () => {
    const { celebrate, onSettle } = mountUnitEntry({
      earned: [{ id: 'perfect_level', name: '完美主义', description: 'x', emoji: '💎', reward: 50 }],
    })
    await solvePart(U1_EASY_INDEXES)
    expect(onSettle).toHaveBeenCalled()
    expect(celebrate.play).not.toHaveBeenCalledWith('word')
  })

  it('有幸运奖励接手时 word 档不撒', async () => {
    const { celebrate, onSettle } = mountUnitEntry({ luckyReward: 50 })
    await solvePart(U1_EASY_INDEXES)
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

describe('UnitEntry · 部分推进与交账', () => {
  // 题内错数由 `QuestionRun` 交给 `starsFor` 折算成星级 —— 3 次点错足够跨出 2 星的档界。
  it('简单部分:一题错 3 次 ⇒ 该题按 starsFor(3) = 1 星落库', async () => {
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

  it('困难部分:填满一套值错的块 ⇒ 判错撤块后重来,照样推进下一题', async () => {
    mountUnitEntry({ stars: easySolved() })
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
  it('部分内中途连点两次回地图:结算与撒花仍各只发一次', async () => {
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

describe('UnitEntry —— 部分状态机与练习题源', () => {
  // 部分间的 1.2s 遮罩已取消(`StageTransition` 退休):上一部分走完,下一部分**直接**上屏。
  it('简单部分走完直接落到困难部分 —— 过场取消了', async () => {
    mountUnitEntry({ unitIndex: 0 })
    await solvePart(U1_EASY_INDEXES)
    expect(document.body.textContent, '困难部分第一题该上屏').toContain(U1_HARD_LEVELS[0]!.emoji)
    // 光有图不算数:页头的部分进度得换成困难部分的分母(每道题都一次不错 ⇒ 已通 0)。
    expect(document.querySelector('[data-part-progress]')?.textContent, '页头已在困难部分').toBe(
      `0/${U1_HARD_LEVELS.length}`,
    )
  })

  // `Math.max(0, …)`(UnitEntry.tsx)的守卫:本部分的题**全部已通**时 `findIndex` 返回 -1,
  // 少了那层 Math.max,`QuestionRun` 收到 startIndex = -1 ⇒ `items[-1]` 是 undefined ⇒ 直接白屏。
  // 单元全通 ⇒ 起点回到简单部分(整单元重玩),正好走到这条路径上。
  it('单元全部已通时进来:不白屏,从第一题开始走', () => {
    const stars = Object.fromEntries(
      [...U1_EASY_LEVELS, ...U1_HARD_LEVELS].map((level) => [level.id, 3]),
    )
    mountUnitEntry({ unitIndex: 0, stars })
    expect(document.body.textContent, '第一题该上屏(不是白屏)').toContain(U1_EASY_LEVELS[0]!.emoji)
    // 光有图不算数:盘面上得真有槽 —— 「图在、盘面空」是另一种坏形态。
    expect(document.querySelectorAll('[data-slot-id]').length, '盘面上该有槽').toBeGreaterThan(0)
  })

  it('部分内两道题之间直接换题(拼完直接上屏下一题)', async () => {
    mountUnitEntry({ unitIndex: 0 })
    solveCorrectly(0)
    await settle()
    expect(document.body.textContent).toContain(UNITS[0]!.levels[1]!.emoji)
  })

  it('简单部分全通时进来,直接落在困难部分', () => {
    mountUnitEntry({ unitIndex: 0, stars: easySolved() })
    expect(document.body.textContent).toContain(UNITS[0]!.levels[U1_HARD_START]!.emoji)
  })

  // Review Focus #1:部分走到一半退出,欠着的账必须**当场**交出去 —— 不是等部分末。
  it('中途退出到地图:先把已落库的那笔账交出去,且只交一次', async () => {
    const { onSettle } = mountUnitEntry({ unitIndex: 0 })
    solveCorrectly(0)
    await settle()
    fireEvent.click(document.querySelector<HTMLElement>('[aria-label="回地图"]')!)
    expect(onSettle, '退出时把这一笔交出去').toHaveBeenCalledTimes(1)
  })

  it('部分末交账一次;部分末之后按回地图不再重复交', async () => {
    const { onSettle } = mountUnitEntry({ unitIndex: 0 })
    await solvePart(U1_EASY_INDEXES)
    expect(onSettle, '部分末交账').toHaveBeenCalledTimes(1)
    fireEvent.click(document.querySelector<HTMLElement>('[aria-label="回地图"]')!)
    expect(onSettle, '已经交过的账不许再交一次(弹层会重放)').toHaveBeenCalledTimes(1)
  })

  // 练习题源 = 本单元「<3 星」的题(封顶 PRACTICE_MAX)—— 不再由错题池当场决定(§8)。
  it('练习部分的题数 = 本单元「<3 星」的题,封顶 PRACTICE_MAX', async () => {
    await reachPracticePart()
    const dots = document.querySelector<HTMLElement>('[data-review-dots]')
    expect(dots, '练习部分没上屏').not.toBeNull()
    // 一条题都没打过 ⇒ 本单元 12 题全部 <3 星 ⇒ 该撞上限。
    expect(practiceLevelsOf({}, UNITS[0]!).length, 'u1 全 0 星 ⇒ 该封顶').toBe(PRACTICE_MAX)
    expect(
      dots!.querySelectorAll('.pstage-dot').length,
      '练习题数按 practiceLevelsOf 算',
    ).toBe(practiceLevelsOf({}, UNITS[0]!).length)
  })

  // 练习是**多题**部分:依次走完、进度点 1/N → 2/N,且第二题换一道题(换了新实例)。
  it('练习逐题走完:进度点 1/N → 2/N,第二题换新题面', async () => {
    await reachPracticePart()
    const items = practiceItemsOf()
    expect(items.length, 'u1 全 0 星 ⇒ 该封顶').toBe(PRACTICE_MAX)

    const dots = () => document.querySelector<HTMLElement>('[data-review-dots]')!
    expect(dots().dataset.reviewDone, '第一题:进度 1/N').toBe('1')
    // 屏上的盘面必须就是题源里的第一题 —— 对不上,下面解的就不是这一题。
    expect(emptySlotIds(), '屏上是题源里的第一题').toEqual([...items[0]!.question.slotIds].sort())

    await solvePracticeItem(items[0]!.levelIndex)

    expect(dots().dataset.reviewDone, '第二题:进度推到 2/N').toBe('2')
    expect(dots().querySelectorAll('.pstage-dot--on').length, '两颗进度点都亮').toBe(2)
    // 第二题是**新实例**:换成题源里第二道题的题面(两层都要断,免得「图换了但盘面没换」混过去)。
    const first = UNITS[0]!.levels[items[0]!.levelIndex]!
    const second = UNITS[0]!.levels[items[1]!.levelIndex]!
    expect(document.body.textContent, '第二题该换新题面').toContain(second.emoji)
    expect(document.body.textContent, '第一题的题面该下去了').not.toContain(first.emoji)
    expect(emptySlotIds(), '第二题的盘面按第二道题挖空').toEqual([...items[1]!.question.slotIds].sort())
  })
})

describe('UnitEntry · 练习部分不落库', () => {
  // spec §8 的不变量:练习只重考、不产生任何账目 —— 不落库、不记 miss、不交账。
  //
  // 这条守卫值钱在于**练习题借用了真实课程的 `levelIndex`**:`endQuestion` 若在练习里被调用,
  // 写进库的会是那些题的星级与星尘,而且会顺带扫成就 —— 是产品可见的坏账。
  // 所以「练习全走完也不写」必须被钉住。
  it('练习部分:全部题走完也不落库、不交账', async () => {
    const { progressService, onSettle } = await reachPracticePart()
    // 走到练习部分时,简单部分末与困难部分末**各交过一次账**(onSettle 已 2 次),
    // 简单部分 + 困难部分共 20 道题**各落过一次库**——
    // 不清这两笔记数,下面的 not.toHaveBeenCalled() 会被存量污染(假红)。
    progressService.recordClear.mockClear()
    onSettle.mockClear()

    const items = practiceItemsOf()
    expect(items.length, 'u1 全 0 星 ⇒ 该封顶').toBe(PRACTICE_MAX)
    // 每一题都要走完:全部走完才会到 onDone ⇒ flush() 真的被调一次 ⇒ 「不交账」那条不是空过。
    for (const item of items) {
      await solvePracticeItem(item.levelIndex)
    }

    expect(progressService.recordClear, '练习部分不落库').not.toHaveBeenCalled()
    expect(onSettle, '练习部分不交账').not.toHaveBeenCalled()
  })
})
