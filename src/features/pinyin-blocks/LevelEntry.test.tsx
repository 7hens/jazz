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
import { LevelEntry } from './LevelEntry'

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

/** 只登记 LevelEntry 真正取用的服务 —— 未注册的服务会当场抛错,那本身也是断言。 */
function mountLevelEntry(opts: {
  comboAnswers?: number[]
  earned?: readonly Achievement[]
  luckyReward?: number
} = {}) {
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
  const utils = render(<LevelEntry unitIndex={0} onExitToMap={vi.fn()} onSettle={onSettle} />)
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

/** 按题目要求把正确块一个个点进去(点选路径 = 自动落位),一次不错。 */
function solveCorrectly() {
  for (const slot of slotsFor(UNITS[0]!.levels[0]!)) {
    const fits = trayBlocks().filter((el) => canPlace(blockOf(el), slot))
    const pick = fits.find((el) => blockOf(el).type === slot.type) ?? fits[0]
    expect(pick, `${slot.type}:${slot.value} 在托盘里找不到可放块`).toBeDefined()
    fireEvent.keyDown(pick as HTMLElement, { key: 'Enter' })
  }
}

/**
 * 困难段:给每个槽放一块**类型对、值错**的块。
 * 困难段的门禁只比类型(`sameTypeOnly`),这些块当场都放得进去;直到盘面填满才被判错 ——
 * 于是**恰好记 1 次 miss**,随后 720ms 撤块重来。
 */
function fillWrongOnce() {
  for (const slot of slotsFor(UNITS[0]!.levels[0]!)) {
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

/** 过场停 1.2s 才交回(STAGE_TRANSITION_MS)—— 推时钟越过它。 */
async function transition() {
  await act(async () => {
    vi.advanceTimersByTime(1300)
  })
}

/**
 * 走完一整关:简单段 → 过场 A → 困难段 →(落库)→ 过场 B → 复习段 → 推进。
 * 段内一律拼对 ⇒ 错题池为空 ⇒ 复习段是「本关整题重做」,求解方式与简单段相同。
 *
 * **只在 u1-0 上成立** —— `solveCorrectly()` 写死了 `UNITS[0]!.levels[0]`,而 `mountLevelEntry`
 * 恒以 `unitIndex={0}` 挂载;推进下一关发生在复习段交账之后,solveLevel 连点三段也还在 u1-0。
 * 要换关就得先把 `solveCorrectly` 参数化,别指望它自己跟着走。
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

describe('关卡页 · 撒花接线', () => {
  // 只落一块:阈值判定在 celebrationFor(纯函数,用例在 celebrate.test.ts),
  // 这里证的是「combo.answer() 的返回值真的被接线了」—— 此前它被直接丢弃。
  it('落一块后 combo 返 5 → combo5 档撒花', () => {
    const { celebrate } = mountLevelEntry({ comboAnswers: [5] })
    placeOneFitting()
    expect(celebrate.play).toHaveBeenCalledWith('combo5')
    expect(celebrate.play).not.toHaveBeenCalledWith('combo10')
  })

  it('落一块后 combo 返 10 → combo10 档撒花', () => {
    const { celebrate } = mountLevelEntry({ comboAnswers: [10] })
    placeOneFitting()
    expect(celebrate.play).toHaveBeenCalledWith('combo10')
  })

  it('落一块后 combo 返 3 → 不撒花(不是每个数都撒)', () => {
    const { celebrate } = mountLevelEntry({ comboAnswers: [3] })
    placeOneFitting()
    expect(celebrate.play).not.toHaveBeenCalled()
  })

  it('一关拼成且没有奖励弹层接手 → word 档撒花', async () => {
    const { celebrate, onSettle } = mountLevelEntry()
    await solveLevel()
    expect(onSettle).toHaveBeenCalled()
    expect(celebrate.play).toHaveBeenCalledWith('word')
  })

  it('有成就接手时 word 档不撒 —— 一次成功只撒一次花', async () => {
    const { celebrate, onSettle } = mountLevelEntry({
      earned: [{ id: 'perfect_level', name: '完美主义', description: 'x', emoji: '💎', reward: 50 }],
    })
    await solveLevel()
    expect(onSettle).toHaveBeenCalled()
    expect(celebrate.play).not.toHaveBeenCalledWith('word')
  })

  it('有幸运奖励接手时 word 档不撒', async () => {
    const { celebrate, onSettle } = mountLevelEntry({ luckyReward: 50 })
    await solveLevel()
    expect(onSettle).toHaveBeenCalled()
    expect(celebrate.play).not.toHaveBeenCalledWith('word')
  })
})

describe('关卡页 · 连击圆点', () => {
  const litCount = () => document.querySelectorAll('[data-combo-dots] .bg-accent').length
  const announced = () =>
    Number(document.querySelector<HTMLElement>('[data-combo-dots]')?.dataset.comboLit)

  it('会话连击 0 → 一颗不亮', () => {
    mountLevelEntry()
    expect(announced()).toBe(0)
    expect(litCount()).toBe(0)
  })

  it('会话连击 3 → 亮 3 颗', () => {
    const { comboStore } = mountLevelEntry()
    act(() => comboStore.set({ combo: 3, maxCombo: 3 }))
    expect(announced()).toBe(3)
    expect(litCount()).toBe(3)
  })

  it('会话连击 7 → 封顶 5 颗', () => {
    const { comboStore } = mountLevelEntry()
    act(() => comboStore.set({ combo: 7, maxCombo: 7 }))
    expect(announced()).toBe(5)
    expect(litCount()).toBe(5)
  })

  // 断的是**填色**这一态,不写动画:App.tsx 的 MotionConfig reducedMotion="user" 全局生效,
  // 纯动画表达对减动效用户等于不存在。
  it('答错归零 → 全部熄灭(填色态跟着快照走)', () => {
    const { comboStore } = mountLevelEntry()
    act(() => comboStore.set({ combo: 4, maxCombo: 4 }))
    expect(litCount()).toBe(4)
    act(() => comboStore.set({ combo: 0, maxCombo: 4 }))
    expect(litCount()).toBe(0)
  })
})

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

  // Minor 2:`flush` 发完必须清账(`pending.current = null`)。
  // 少了那一行,pending 就一直在那儿 —— 回地图被连点两次(头部的按钮在退出动画里仍可点)
  // 会把同一笔结算**发两次**:星尘算两遍、撒花两遍。这里点两次、断言各一次。
  it('复习段中途连点两次回地图:结算与撒花仍各只发一次', async () => {
    const { onSettle, celebrate } = mountLevelEntry()
    solveCorrectly()
    await settle()
    await transition()
    solveCorrectly()
    await settle()
    await transition()
    const back = screen.getByLabelText('回地图')
    fireEvent.click(back)
    // 树的父层只是 vi.fn(onExitToMap),组件没被卸载 —— 第二下会真的再走一次 handleExit。
    expect(back).toBeInTheDocument()
    fireEvent.click(back)
    expect(onSettle).toHaveBeenCalledTimes(1)
    expect(celebrate.play).toHaveBeenCalledTimes(1)
  })

  // Review Focus #4 / F1:组件内推进下一关(levelIndex 0→1)靠 LevelEntry 的 `key={level.id}` 重挂 ——
  // 没有 key,React 复用同一个 LevelRun 实例,相位会卡在 review、错题池与发牌也一并残留。
  // 旧写法是 unmount() + mountLevelEntry():整棵树重建,key 有没有都一样,是恒真断言(给了假信心),
  // 故删掉,改成真正会因缺 key 而坏的那条路 —— 三段走完(`handleDone` 把 levelIndex 推到 1)后
  // 断言相位回到简单段。
  it('走完一关推进到下一关:相位回到简单段(靠 key 重挂,不残留上一轮)', async () => {
    const { onSettle } = mountLevelEntry()
    await solveLevel()
    expect(onSettle).toHaveBeenCalledTimes(1)
    // u1-0 → u1-1:换了关,相位必须从简单段重来(有 key ⇒ 重挂;无 key ⇒ 停在 review)。
    expect(document.querySelector('[data-stage="easy"]')).not.toBeNull()
  })

  // F2(spec §3.9 裁定 M):本关 miss = 简单段 + 困难段的错之和 —— 两段各记在自己的 missRef 里,
  // 交账时由 LevelRun 相加。两个加数都必须真的进账,故把和推到 starsFor 的档界之外:
  // 合 3 错 ⇒ starsFor(3) = 1;丢掉简单段(starsFor(1))或丢掉困难段(starsFor(2))都会得到 2 星。
  // 注:派单原提案是「各错 1 次 ⇒ 2 星」,但那区分不开 —— starsFor(1) 本来就是 2,与 starsFor(2) 同档。
  it('星级按简单段 + 困难段的错相加:两段合 3 错 ⇒ 1 星', async () => {
    const { progressService } = mountLevelEntry()
    // 简单段:点同一块无处可落的托盘块 2 次(u1-0 是 é = e + 二声,四声块恒无处可落)⇒ 2 错。
    fireEvent.keyDown(screen.getByLabelText('声调块 4'), { key: 'Enter' })
    fireEvent.keyDown(screen.getByLabelText('声调块 4'), { key: 'Enter' })
    solveCorrectly()
    await settle()
    await transition()

    // 困难段:填一整套「类型对、值错」的块 ⇒ 填满后判错 1 次,撤块后重来 ⇒ 1 错。
    fillWrongOnce()
    await act(async () => {
      vi.advanceTimersByTime(800)
    })
    solveCorrectly()
    await settle()

    // 2 + 1 = 3 ⇒ starsFor(3) = 1。
    expect(progressService.recordClear).toHaveBeenCalledWith(
      expect.objectContaining({ levelId: UNITS[0]!.levels[0]!.id, stars: 1 }),
    )
  })
})

// 三段整链 —— 简单段的错题池真的接进复习段,且复习段**一道一道**走。
// 此前这两个接头只有孤立的单元用例(LevelRun 的相位 / mistakes 的纯函数),
// 中间那段接线(onEasyEnd 的 setPool、onReviewEnd 的步进、复习 key 的重挂)没有用例压着。
describe('关卡页 · 复习段错题池接线(三段整链)', () => {
  const reviewDots = () => document.querySelector<HTMLElement>('[data-review-dots]')
  const prefilled = () => document.querySelector<HTMLElement>('[data-slot-id].pslot--filled')
  const filledSlotIds = () =>
    Array.from(document.querySelectorAll<HTMLElement>('[data-slot-id].pslot--filled')).map(
      (el) => el.dataset.slotId!,
    )
  /** 空槽(要孩子自己填的那些)的 id,按 DOM 顺序。 */
  const emptySlotIds = () =>
    Array.from(document.querySelectorAll<HTMLElement>('[data-slot-id]'))
      .filter((el) => !el.classList.contains('pslot--filled'))
      .map((el) => el.dataset.slotId!)

  /** 简单段:把选中的那块**点错两次**(阈值 N = 2)⇒ 入错题池。 */
  function pickWrongTwice(match: (b: Block) => boolean) {
    const host = trayBlocks().find((el) => match(blockOf(el)))
    expect(host, '托盘中找不到要故意点错的块').toBeDefined()
    fireEvent.keyDown(host as HTMLElement, { key: 'Enter' })
    fireEvent.keyDown(host as HTMLElement, { key: 'Enter' })
  }

  /** 复习小题:用放得下的正解填掉唯一的空槽(点选路径 = 自动落位)。 */
  function solveReviewStep() {
    const emptyId = emptySlotIds()[0]
    const slot = slotsFor(UNITS[0]!.levels[0]!).find((s) => s.id === emptyId)
    expect(slot, `复习段找不到空槽 ${emptyId ?? '(没有空槽)'}`).toBeDefined()
    const pick = trayBlocks().find((el) => canPlace(blockOf(el), slot!))
    expect(pick, `${slot!.type}:${slot!.value} 在复习托盘里没有正解`).toBeDefined()
    fireEvent.keyDown(pick as HTMLElement, { key: 'Enter' })
  }

  /**
   * 简单段点错**两类**块各两次 ⇒ 池里两个类型 ⇒ 复习段恰好两道小题(定序:最近点错的先考)。
   * u1-0 = é(e + 二声):四声/一声块、o/u 韵母块都无处可落,点两次就入池。
   */
  function makeTwoTypePool() {
    pickWrongTwice((b) => b.type === 'final' && b.value !== 'e') // 先点错:韵母类
    pickWrongTwice((b) => b.type === 'tone' && b.value === '1') // 后点错:声调类
  }

  it('两道复习小题:进度点 1/2 → 2/2、第二题换新实例、两次交账只推进一步', async () => {
    const { onSettle } = mountLevelEntry()

    makeTwoTypePool()
    solveCorrectly() // 简单段拼对
    await settle() // → 过场 A
    await transition()
    solveCorrectly() // 困难段一次不错 ⇒ 池只来自简单段那两类
    await settle() // → 过场 B
    await transition()

    // 第 1 道小题:进度点报 1/2,且真的画了两颗点。
    expect(reviewDots()?.getAttribute('aria-label')).toBe('复习 1/2')
    expect(reviewDots()?.querySelectorAll('.pstage-dot')).toHaveLength(2)
    // 第 1 题是「声调」小题:声调槽挖空,韵母槽被正解预填。
    expect(emptySlotIds()).toEqual(['s0-t'])
    expect(filledSlotIds()).toEqual(['s0-f'])
    const q0Block = prefilled()!.querySelector<HTMLElement>('[data-block-id]')!.dataset.blockId!

    solveReviewStep()
    await settle() // 成功动画 → onSectionEnd → 换下一道小题

    // 第 2 道小题:进度点走到 2/2;**换了一组块**(q1-*)与**另一个槽被挖空** ——
    // 少了 `${reviewIdx}` 这个 key 就不会重挂,placement 会黏着第 1 题的块,这里当场空掉。
    expect(reviewDots()?.getAttribute('aria-label')).toBe('复习 2/2')
    expect(prefilled(), '第二题没有预填槽 —— 组件没换新实例(key 少了 reviewIdx?)').not.toBeNull()
    expect(emptySlotIds()).toEqual(['s0-f'])
    expect(prefilled()!.dataset.slotId).toBe('s0-t')
    const q1Block = prefilled()!.querySelector<HTMLElement>('[data-block-id]')!.dataset.blockId!
    expect(q1Block).toMatch(/^q1-/)
    expect(document.querySelector(`[data-block-id="${q0Block}"]`), '第一题的块还留在第二题的盘上').toBeNull()

    solveReviewStep()
    await settle() // → onDone → 交账 + 推进一关

    // 两次交账**只推进一步**:onSettle 恰好一次,关卡号 1/6 → 2/6,且相位回到简单段。
    expect(onSettle).toHaveBeenCalledTimes(1)
    expect(screen.getByText(`2/${UNITS[0]!.levels.length}`)).toBeInTheDocument()
    expect(document.querySelector('[data-stage="easy"]')).not.toBeNull()
  })

  // 简单段点错的那一类块,决定了复习段挖哪个槽 —— 即 onEasyEnd 里 `addToPool(cur, result.wrongBlocks)`
  // 真的把错块并进了池(cur ⇒ 池恒空)。
  // 池被吞掉 ⇒ 复习退化成「本关整题重做」:两个槽**都**挖空,声调槽不再被预填。
  it('简单段点错的韵母类块,进了复习段(只挖韵母槽,声调槽被预填)', async () => {
    mountLevelEntry()

    pickWrongTwice((b) => b.type === 'final' && b.value !== 'e')
    solveCorrectly()
    await settle()
    await transition()
    solveCorrectly() // 困难段不错 ⇒ 池不再添块
    await settle()
    await transition()

    expect(emptySlotIds()).toEqual(['s0-f'])
    expect(filledSlotIds()).toEqual(['s0-t'])
    expect(prefilled()!.querySelector<HTMLElement>('[data-block-id]')!.dataset.blockId).toMatch(/^q0-/)
  })
})
