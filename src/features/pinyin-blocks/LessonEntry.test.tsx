import { cleanup, render } from '@testing-library/react'
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
import { UNITS, pathLessons, type Level } from './levels'
import { LessonEntry } from './LessonEntry'

/** 按存档键找关卡 —— 题面靠它的 emoji 定位(与同目录 Entry 测试同一手法)。 */
function levelById(id: string): Level {
  for (const unit of UNITS) {
    const found = unit.levels.find((level) => level.id === id)
    if (found) return found
  }
  throw new Error(`课表里没有关卡 ${id}`)
}

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

/** 只登记 LessonEntry 真正取用的服务 —— 未注册的服务会当场抛错,那本身也是断言。 */
function mountLessonEntry(opts: { lessonId: string; stars?: Record<string, number> } ) {
  const { stars = {} } = opts
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
  const settings = {
    getSnapshot: settingsStore.get,
    subscribe: settingsStore.subscribe,
    load: vi.fn(async () => undefined),
    save: vi.fn(async () => undefined),
  }

  const comboStore = makeStore({ combo: 0, maxCombo: 0 })
  const comboService = {
    getSnapshot: comboStore.get,
    subscribe: comboStore.subscribe,
    answer: vi.fn((_kind: AnswerKind) => comboStore.get().combo),
    reset: vi.fn(),
    getBonus: vi.fn(() => 0),
  }

  const celebrate = { play: vi.fn() }
  const achievements = { scan: vi.fn(() => [] as readonly Achievement[]) }
  const lucky = { roll: vi.fn(() => 0) }

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
  const utils = render(<LessonEntry lessonId={opts.lessonId} onExitToPath={vi.fn()} onSettle={onSettle} />)
  return { ...utils, onSettle, progressService: progress }
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

describe('一节课', () => {
  it('起点 = 本节第一道未通的题（不是本节第 0 题）', () => {
    const lesson = pathLessons()[0]!
    const first = lesson.levelIds[0]!
    const second = lesson.levelIds[1]!
    const { container } = mountLessonEntry({ lessonId: lesson.id, stars: { [first]: 1 } })
    // 第 0 题已通 ⇒ 落在第 1 题:题面是该题 emoji
    expect(container.textContent).toContain(levelById(second).emoji)
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
