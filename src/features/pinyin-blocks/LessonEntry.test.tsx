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
import { SPEAK_OF, type Block, type BlockType } from './blocks'
import { UNITS, pathLessons, type Level } from './levels'
import { canPlace, slotsFor } from './rules'
import { scaffoldQuestion } from './scaffold'
import { LessonEntry } from './LessonEntry'

/** 按存档键找关卡 —— 题面靠它的 emoji 定位(与同目录 Entry 测试同一手法)。 */
function levelById(id: string): Level {
  for (const unit of UNITS) {
    const found = unit.levels.find((level) => level.id === id)
    if (found) return found
  }
  throw new Error(`课表里没有关卡 ${id}`)
}

/** 某关所在单元的下标 —— 「这道题会不会有脚手架遍」得连单元一起给(口径是**本单元新教的那一类**)。 */
function unitIndexOf(id: string): number {
  const index = UNITS.findIndex((u) => u.levels.some((level) => level.id === id))
  if (index < 0) throw new Error(`课表里没有关卡 ${id}`)
  return index
}

/**
 * 这道题有没有脚手架遍 —— 用题源自己答(`null` = 不产生),不抄 `LessonEntry` 的口径。
 * **困难题恒 false**:spec §7 明确把困难部分排除在脚手架遍之外(那一部分门禁 `sameTypeOnly`,
 * 与「预填槽装的是确定的正确块」直接冲突)。
 */
function hasScaffoldPass(id: string): boolean {
  const level = levelById(id)
  if (level.stage === 'hard') return false
  return scaffoldQuestion(level, unitIndexOf(id), () => 0.5) !== null
}

/** 托盘里还没入槽的块(与同目录另两个测试同一手法:块的身份印在里层 `[data-value]` 上)。 */
function trayBlocks(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-block-id]')).filter(
    (el) => el.closest('[data-slot-id]') === null,
  )
}

function blockOf(el: HTMLElement): Block {
  const chip = el.querySelector<HTMLElement>('[data-value]')
  const type = chip?.dataset.type as BlockType | undefined
  const value = chip?.dataset.value
  if (!type || !(type in SPEAK_OF) || value === undefined) {
    throw new Error(`托盘块读不出身份:${chip?.outerHTML ?? '(没有块)'}`)
  }
  return { type, value }
}

/** 把屏幕上**还空着**的槽填上正解(脚手架遍里预填槽不在托盘里,点选路径一次不错)。 */
function solveOnScreen(level: Level): void {
  for (const slot of slotsFor(level)) {
    if (document.querySelector(`[data-slot-id="${slot.id}"] .pblock`)) continue
    const pick = trayBlocks().find((el) => canPlace(blockOf(el), slot))
    expect(pick, `${slot.type}:${slot.value} 在托盘里找不到可放块`).toBeDefined()
    fireEvent.keyDown(pick as HTMLElement, { key: 'Enter' })
  }
}

/** 推一段虚拟时间(落块 → 判定 260ms → 成功动画 1600ms),顺带把 `settleLevel` 的 await 走完。 */
const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
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
  // 形参显式标型:vitest 4 按「实现」的签名推 `mock.calls` 的元素类型,零参实现会被推成 `[]`,
  // 于是 `calls[0][0].levelId` 报 TS2493(与 QuestionRun.test.ts 里那处同因)。
  const progress = {
    getSnapshot: progressStore.get,
    subscribe: progressStore.subscribe,
    load: vi.fn(async () => undefined),
    recordClear: vi.fn(async (_clear: { levelId: string; stars: number; starDust: number }) => undefined),
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

  // 题位条的格子是**遍**,不是道题(spec §3.4 里「切的是道题」讲的是 `LESSON_MAX` 怎么分节,
  // 与这条进度指示不是同一个旋钮)。分母 = 有脚手架遍的题数×2 + 其余×1。
  it('题位条 = 本节的遍数(一题两遍),走完一题亮一格', () => {
    const lesson = pathLessons()[0]!
    mountLessonEntry({ lessonId: lesson.id, stars: {} })
    const expected = lesson.levelIds.reduce((n, id) => n + (hasScaffoldPass(id) ? 2 : 1), 0)
    const bar = document.querySelector('[data-bar-total]') as HTMLElement
    expect(bar.dataset.barTotal).toBe(String(expected))
    expect(bar.dataset.barDone).toBe('1')
  })

  // 脚手架遍落 `${id}s`、全拼遍落 `${id}`(spec §2.6)。**两个不同的键**,只断一个都抓不到
  // 「写串了 / 只落了一遍」这两类回归 —— 断言全序而不是「调用过某个值」。
  it('一道题的两遍落两个键:脚手架遍 `${id}s`,全拼遍 `${id}`', async () => {
    const lesson = pathLessons()[0]!
    const { progressService } = mountLessonEntry({ lessonId: lesson.id, stars: {} })
    const level = levelById(lesson.levelIds[0]!)
    expect(hasScaffoldPass(level.id), '这道题该有脚手架遍,否则这条测不到两遍').toBe(true)

    solveOnScreen(level) // 第一遍 = 脚手架遍
    await advance(3000)
    solveOnScreen(level) // 第二遍 = 全拼遍(盘面已重挂,预填全没了)
    await advance(3000)

    expect(progressService.recordClear.mock.calls.map((c) => c[0].levelId)).toEqual([
      `${level.id}s`,
      level.id,
    ])
  })

  // 「接着上次」得落在 items 的坐标系里:一道题现在可能是两项,题号直接当项号用会落到别的题上。
  // 拿题号当项号的话,这里会停在**第 0 题的全拼遍**上(两项之后),屏上还是第 0 题的图。
  it('起点 = 本节第一道未通的题的头一项(题号 ≠ 项号,不能拿题号当项号用)', () => {
    const lesson = pathLessons()[0]!
    const second = lesson.levelIds[1]!
    expect(levelById(second).emoji, '测试前提:两道题的图必须不同').not.toBe(
      levelById(lesson.levelIds[0]!).emoji,
    )
    // 第 0 题已通 ⇒ 起点该是第 1 题的**第一项**(脚手架遍)。
    const { container } = mountLessonEntry({ lessonId: lesson.id, stars: { [lesson.levelIds[0]!]: 3 } })
    expect(container.textContent).toContain(levelById(second).emoji)
    expect(container.textContent).not.toContain(levelById(lesson.levelIds[0]!).emoji)
  })

  // 全表守一遍:46 节不变,每节的 items 长度 = 有脚手架遍的题数×2 + 其余×1,
  // 且**困难节一道也不跑脚手架遍**(spec §7)。
  // **不钉 91 / 2N 这类魔数** —— 那会把「改课程数据」变成「改测试」;这里钉的是
  // 「有 `scaffoldQuestion` 的简单题确实是两项、其余确实是一项、困难题一项」这条结构本身。
  it('每一节:items 长度 = 有脚手架遍的题数×2 + 其余×1(困难节一项不加)', () => {
    const lessons = pathLessons()
    expect(lessons, '节数变了(课表是 46 节)').toHaveLength(46)
    let doubledSomewhere = false
    for (const lesson of lessons) {
      const doubled = lesson.levelIds.filter((id) => hasScaffoldPass(id)).length
      const expected = lesson.levelIds.length + doubled
      doubledSomewhere ||= doubled > 0
      if (lesson.part === 'hard') {
        expect(doubled, `${lesson.id} 困难节不该排脚手架遍(spec §7)`).toBe(0)
      }
      const { unmount } = mountLessonEntry({ lessonId: lesson.id, stars: {} })
      expect(
        document.querySelector('[data-bar-total]')?.getAttribute('data-bar-total'),
        lesson.id,
      ).toBe(String(expected))
      unmount()
    }
    expect(doubledSomewhere, '简单节该真的排上脚手架遍,否则这条恒真').toBe(true)
  })
})
