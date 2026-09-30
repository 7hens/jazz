import { act, cleanup, fireEvent, render } from '@testing-library/react'
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
  type Achievement,
  type AnswerKind,
} from '@/shared/services'
import { registry } from '@/shared/services/core'
import { UNITS } from './levels'
import { canPlace, slotsFor } from './rules'
import { SPEAK_OF, type Block, type BlockType } from './blocks'
import { PracticeEntry } from './PracticeEntry'

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

/** 只登记 PracticeEntry 真正取用的服务 —— 未注册的服务会当场抛错,那本身也是断言。 */
function mountPracticeEntry(opts: { unitId: string; stars?: Record<string, number>; onExit?: () => void }) {
  const { stars = {}, onExit = vi.fn() } = opts
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
    data: { earnedAchievements: [] as readonly Achievement[], consecutiveDays: 0, lastActiveDate: '', updatedAt: '' },
  })

  registry.register(PinyinProgressService, progress as never)
  registry.register(
    SettingsService,
    {
      getSnapshot: settingsStore.get,
      subscribe: settingsStore.subscribe,
      load: vi.fn(async () => undefined),
      save: vi.fn(async () => undefined),
    } as never,
  )
  registry.register(
    ComboService,
    {
      getSnapshot: () => ({ combo: 0, maxCombo: 0 }),
      subscribe: () => () => {},
      answer: vi.fn((_kind: AnswerKind) => 0),
      reset: vi.fn(),
      getBonus: vi.fn(() => 0),
    } as never,
  )
  registry.register(CelebrateService, { play: vi.fn() } as never)
  registry.register(AchievementService, { scan: vi.fn(() => []) } as never)
  registry.register(LuckyBonusService, { roll: vi.fn(() => 0) } as never)
  registry.register(SpeechService, { speak: () => true, speakRole: () => true, stop: () => undefined } as never)
  registry.register(
    AudioService,
    {
      getSnapshot: () => true,
      subscribe: () => () => {},
      isOn: () => true,
      setOn: () => {},
      play: vi.fn(),
      unlock: () => undefined,
    } as never,
  )

  const utils = render(<PracticeEntry unitId={opts.unitId} onExitToPath={onExit} />)
  return { ...utils, onExit, progressService: progress }
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

/** 练习恒整题挖空:把本单元第一道题的全部槽依次填对,走完这一道。 */
async function finishOneQuestion() {
  const level = UNITS[0]!.levels[0]!
  for (const slot of slotsFor(level)) {
    const fits = trayBlocks().filter((el) => canPlace(blockOf(el), slot))
    const pick = fits.find((el) => blockOf(el).type === slot.type) ?? fits[0]
    expect(pick, `${slot.id} 在托盘里找不到可放块`).toBeDefined()
    fireEvent.keyDown(pick as HTMLElement, { key: 'Enter' })
  }
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
})

describe('一次练习', () => {
  it('题数 = 本单元 <3 星的题（封顶 5），进度点跟它走', () => {
    const unit = UNITS[0]!
    // 全部做成 3 星,再把第一题压回 2 星 —— 池子里**只剩**这一道。
    // (不能只写一条 2 星:没做过的题默认 0 星、同样算「<3 星」,那样池子会被封顶成 5 道。)
    const stars: Record<string, number> = Object.fromEntries(unit.levels.map((level) => [level.id, 3]))
    stars[unit.levels[0]!.id] = 2
    mountPracticeEntry({ unitId: unit.id, stars })
    expect(document.querySelectorAll('.pstage-dot')).toHaveLength(1)
  })

  it('不落库:走完一道题 progress.recordClear 一次都没调', async () => {
    const unit = UNITS[0]!
    const { progressService } = mountPracticeEntry({ unitId: unit.id, stars: {} })
    await finishOneQuestion()
    expect(progressService.recordClear).not.toHaveBeenCalled()
  })

  it('无题可练 ⇒ 立刻交回宿主，不画白屏', () => {
    const unit = UNITS[0]!
    const stars = Object.fromEntries(unit.levels.map((level) => [level.id, 3]))
    const onExit = vi.fn()
    mountPracticeEntry({ unitId: unit.id, stars, onExit })
    expect(onExit).toHaveBeenCalled()
  })
})
