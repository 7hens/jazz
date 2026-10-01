import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registry } from '@/shared/services/core'
import {
  AchievementService,
  AudioService,
  AuthService,
  CelebrateService,
  ComboService,
  LuckyBonusService,
  PinyinProgressService,
  SettingsService,
  SpeechService,
} from '@/shared/services'
import type {
  AuthSnapshot,
  CelebrateLevel,
  ComboSnapshot,
  PinyinProgressSnapshot,
  SettingsSnapshot,
  User,
  UserSettings,
} from '@/shared/services'
import { HAN_TEXT } from '@/shared/testing/han-text'
import { ACHIEVEMENTS } from '@/features/achievements'
import { UNITS, canPlace, pathLessons, slotsFor, type Block, type BlockType, type Level } from '@/features/pinyin-blocks'
import App from './App'

const user: User = { id: 'u', email: '', name: '' }

const settings: UserSettings = {
  earnedAchievements: [],
  consecutiveDays: 0,
  lastActiveDate: '',
  updatedAt: '2026-09-05T00:00:00.000Z',
}

// 快照需稳定引用(useSyncExternalStore 要求);publish 替换为新对象并通知订阅。
function createStore<T>(initial: T) {
  let snapshot = initial
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    publish(next: T) {
      snapshot = next
      listeners.forEach((listener) => listener())
    },
  }
}

type RegisterOpts = {
  settingsPublishes?: boolean
  /** 幸运奖励掷出的数。默认 0 = 不掷中,只有走庆祝态的用例需要它非 0。 */
  luckyReward?: number
}

/** 只登记 App 相位机真正取用的服务 —— 未注册的服务会当场抛错,那本身也是断言。 */
function registerAll(opts: RegisterOpts = {}) {
  registry.clear()

  const authStore = createStore<AuthSnapshot>({ status: 'checking' })
  const check = vi.fn(async () => undefined)
  const auth: AuthService = {
    getSnapshot: authStore.getSnapshot,
    subscribe: authStore.subscribe,
    check,
    login: vi.fn(async () => undefined),
    logout: vi.fn(async () => undefined),
    markAnonymous: () => authStore.publish({ status: 'anonymous' }),
  }

  const progressStore = createStore<PinyinProgressSnapshot>({ status: 'idle', data: { stars: {}, totalStars: 0 } })
  const progressLoad = vi.fn(async () => {
    progressStore.publish({ status: 'ready', data: progressStore.getSnapshot().data })
  })
  const progress: PinyinProgressService = {
    getSnapshot: progressStore.getSnapshot,
    subscribe: progressStore.subscribe,
    load: progressLoad,
    recordClear: vi.fn(async () => undefined),
    resetAll: vi.fn(async () => undefined),
  }

  const settingsStore = createStore<SettingsSnapshot>({ status: 'idle', data: settings })
  const settingsLoad = vi.fn(async () => {
    // settingsPublishes: false 用来复现「设置没拉回来就进了课」那一格。
    if (opts.settingsPublishes === false) return
    settingsStore.publish({ status: 'ready', data: settingsStore.getSnapshot().data })
  })
  const settingsService: SettingsService = {
    getSnapshot: settingsStore.getSnapshot,
    subscribe: settingsStore.subscribe,
    load: settingsLoad,
    save: vi.fn(async () => undefined),
  }

  const comboStore = createStore<ComboSnapshot>({ combo: 0, maxCombo: 0 })
  const combo: ComboService = {
    getSnapshot: comboStore.getSnapshot,
    subscribe: comboStore.subscribe,
    answer: vi.fn(() => 0),
    reset: vi.fn(),
    getBonus: vi.fn(() => 0),
  }

  const audioStore = createStore(true)
  const audio: AudioService = {
    getSnapshot: audioStore.getSnapshot,
    subscribe: audioStore.subscribe,
    isOn: audioStore.getSnapshot,
    setOn: (on) => audioStore.publish(on),
    play: vi.fn(),
    unlock: () => undefined,
  }

  const speech: SpeechService = { speak: () => true, speakRole: () => true, stop: () => undefined }
  // 与 check / progressLoad 同形:mock 单独具名,接口对象只引用它 —— 断言才拿得到 `.mock`
  const celebratePlay = vi.fn((_level: CelebrateLevel) => undefined)
  const celebrate: CelebrateService = { play: celebratePlay }
  const achievements: AchievementService = { scan: () => [] }
  const lucky: LuckyBonusService = { roll: () => opts.luckyReward ?? 0 }

  registry.register(AuthService, auth)
  registry.register(PinyinProgressService, progress)
  registry.register(SettingsService, settingsService)
  registry.register(ComboService, combo)
  registry.register(AudioService, audio)
  registry.register(SpeechService, speech)
  registry.register(CelebrateService, celebrate)
  registry.register(AchievementService, achievements)
  registry.register(LuckyBonusService, lucky)

  return { authStore, check, progressLoad, progressStore, settingsLoad, settingsStore, celebratePlay }
}

/** 登录态挂载 App(认证在 check 内同步 publish,与生产同序)。 */
function mountApp(opts: RegisterOpts = {}) {
  const svc = registerAll(opts)
  svc.check.mockImplementation((): Promise<undefined> => {
    svc.authStore.publish({ status: 'authenticated', user })
    return Promise.resolve(undefined)
  })
  const utils = render(<App />)
  return { svc, ...utils }
}

beforeEach(() => registry.clear())

/**
 * 积木身份白名单。`Record<BlockType, true>` 让编译器管着不漏键 —— 新增一个块类,
 * 这里当场红(与 `PinyinBlocksGame.test.tsx` 用 `SPEAK_OF` 的键同一目的)。
 */
const BLOCK_TYPES: Record<BlockType, true> = { initial: true, medial: true, final: true, nasal: true, tone: true }

/** 托盘里还没入槽的块。 */
function trayBlocks(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-block-id]')).filter(
    (el) => el.closest('[data-slot-id]') === null,
  )
}

/** 读一块托盘积木的身份 —— 类型与值印在里层的 .pblock 上。读不出就当场炸,别让病因伪装成「这关无解」。 */
function blockOf(el: HTMLElement): Block {
  const chip = el.querySelector<HTMLElement>('[data-value]')
  const type = chip?.dataset.type as BlockType | undefined
  const value = chip?.dataset.value
  if (!type || !(type in BLOCK_TYPES) || value === undefined) {
    throw new Error(`托盘块读不出身份:${chip?.outerHTML ?? '(没有块)'}`)
  }
  return { type, value }
}

/** 按存档键找关卡 —— 节只给 id,题面要从课表里取。 */
function levelById(id: string): Level {
  for (const unit of UNITS) {
    const found = unit.levels.find((level) => level.id === id)
    if (found) return found
  }
  throw new Error(`课表里没有关卡 ${id}`)
}

/** 把**某一道题**按托盘里能放的正确块一个个点进去(点选路径 = 自动落位),一次不错。 */
function solveOnce(level: Level) {
  for (const slot of slotsFor(level)) {
    const fits = trayBlocks().filter((el) => canPlace(blockOf(el), slot))
    const pick = fits.find((el) => blockOf(el).type === slot.type) ?? fits[0]
    expect(pick, `${slot.type}:${slot.value} 在托盘里找不到可放块`).toBeDefined()
    fireEvent.keyDown(pick as HTMLElement, { key: 'Enter' })
  }
}

/** 推时钟越过一道题的判定与成功动画(260ms 判定 + 1600ms 停顿)并把微任务排干。 */
async function settleQuestion() {
  await act(async () => { vi.advanceTimersByTime(3000) })
}

/** 走完**第一节**(3~5 题)。题内一律拼对 ⇒ 没有错题、节末 `flush` 交账。 */
async function solveFirstLesson() {
  for (const id of pathLessons()[0]!.levelIds) {
    solveOnce(levelById(id))
    await settleQuestion()
  }
}

/** 路径上第 1 个可点节点(当前节点)。 */
const currentNode = () => document.querySelector<HTMLElement>('[data-lesson-state="current"]')!

/** 现代蛇形路径所有节点初始可见,无需展开。 */
function expandToFirstLesson() {
  // 蛇形路径布局:所有节点初始可见,无需点击展开
}

describe('App 路由', () => {
  it('boot → login:认证返回匿名时显示登录门', async () => {
    const svc = registerAll()
    svc.authStore.publish({ status: 'anonymous' })
    render(<App />)

    expect(await screen.findByRole('button', { name: /进入魔法岛/ })).toBeInTheDocument()
  })

  it('登录后直达学习路径:progress 与 settings 都拉了', async () => {
    const { svc, container } = mountApp()

    await waitFor(() => expect(container.querySelector('[data-learning-path]')).not.toBeNull())
    await waitFor(() => expect(svc.progressLoad).toHaveBeenCalled())
    // settings 不拉 = 结算会拿 defaultSettings() 覆盖服务端(连续天数/成就清零)
    await waitFor(() => expect(svc.settingsLoad).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: /进入魔法岛/ })).toBeNull()
  })

  it('登录后落在学习路径:只有第 1 个节点可点,其余 45 个带锁', async () => {
    const { container } = mountApp()

    await waitFor(() => expect(container.querySelector('[data-learning-path]')).not.toBeNull())
    expect(container.querySelectorAll('[data-lesson-state="current"]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-lesson-state="locked"]')).toHaveLength(45)
    expect(container.querySelectorAll('[data-lesson-state="cleared"]')).toHaveLength(0)
  })

  it('路径零汉字:节点靠三态图标自表意(文字部分是 aria-label,不进 textContent)', async () => {
    const { container } = mountApp()

    await waitFor(() => expect(container.querySelector('[data-learning-path]')).not.toBeNull())
    const text = container.querySelector('[data-learning-path]')!.textContent ?? ''
    expect(text).not.toMatch(HAN_TEXT)
  })

  it('401 → login:会话转为匿名后(哪怕相位还停在路径)回到登录门', async () => {
    const { svc, container } = mountApp()

    await waitFor(() => expect(container.querySelector('[data-learning-path]')).not.toBeNull())
    act(() => svc.authStore.publish({ status: 'anonymous' }))

    expect(await screen.findByRole('button', { name: /进入魔法岛/ })).toBeInTheDocument()
    // 认证分支排在最前,相位不参与决策 —— 匿名态下不该还留着路径
    expect(container.querySelector('[data-learning-path]')).toBeNull()
  })

  it('path → lesson:点当前节点进第一节,带题位条与回路径按钮', async () => {
    const { container } = mountApp()

    await waitFor(() => expect(container.querySelector('[data-learning-path]')).not.toBeNull())
    expandToFirstLesson()
    fireEvent.click(currentNode())

    expect(await screen.findByRole('button', { name: '回路径' })).toBeInTheDocument()
    expect(container.querySelector('[data-learning-path]')).toBeNull()
    // 题位条读的是**本节**题数(几道题几格)—— 课程切分线挪动时断言跟着走,不钉死数字。
    const bar = document.querySelector('[data-bar-total]') as HTMLElement
    expect(bar.dataset.barTotal).toBe(String(pathLessons()[0]!.levelIds.length))
    expect(bar.dataset.barDone).toBe('1')
  })

  it('path → parent → path:家长面板开合', async () => {
    const { container } = mountApp()

    await waitFor(() => expect(container.querySelector('[data-learning-path]')).not.toBeNull())
    fireEvent.click(screen.getByRole('button', { name: '家长' }))

    expect(await screen.findByRole('heading', { name: '家长设置' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '完成' }))
    expect(await screen.findByRole('button', { name: '家长' })).toBeInTheDocument()
  })

  it('设置没就绪时停在 boot:既不渲染课,也**不偷偷回路径**', async () => {
    // 场景:登录已成功、进度的确 ready(所以路径能画),但设置的 load 没回来 ——
    // 此时点节点进课,必须停在 BootScreen 等设置,而不是拿默认设置去结算。
    const { container } = mountApp({ settingsPublishes: false })

    await waitFor(() => expect(container.querySelector('[data-learning-path]')).not.toBeNull())
    expandToFirstLesson()
    fireEvent.click(currentNode())

    // 关键区分断在正向断言之前,失败信息才指得准「悄悄进了哪儿」:
    // `data-learning-path` 只有路径有(条件并进上层 if 会落到路径分支 → 红在这),
    // `回路径` 只有课有(把就绪门整个删掉 → 红在这)。
    // 两条都为 null 时,**并不能**说明停在 BootScreen(logout 那一格也能过)——
    // 所以下面必须再有正向断言。
    expect(document.querySelector('[data-learning-path]')).toBeNull()
    expect(screen.queryByRole('button', { name: '回路径' })).toBeNull()
    // 正向:确实停在 BootScreen(唯一渲染 `.animate-spin` 的分支),不是空白页
    await waitFor(() => expect(container.querySelector('.animate-spin')).not.toBeNull())
  })

  // settings 在路上时路径照样画得出来(App 的路径分支只等 progress),但徽章栏必须**整个不出现** ——
  // 画成「全暗」等于对孩子说「你一个成就都没拿到」,而真相是「还不知道」。
  it('settings 未就绪时路径上不出现徽章栏(而不是画成全暗)', async () => {
    const { container } = mountApp({ settingsPublishes: false })

    await waitFor(() => expect(container.querySelector('[data-learning-path]')).not.toBeNull())
    expect(document.querySelectorAll('[data-badge-id]')).toHaveLength(0)
  })

  it('settings 就绪后徽章栏出现,目录全量的格全暗(知道且为空 ≠ 不知道)', async () => {
    const { container } = mountApp()

    await waitFor(() => expect(container.querySelector('[data-learning-path]')).not.toBeNull())
    expect(document.querySelectorAll('[data-badge-id]')).toHaveLength(ACHIEVEMENTS.length)
    expect(document.querySelectorAll('[data-badge-earned="true"]')).toHaveLength(0)
  })
})

describe('App 庆祝态接线', () => {
  // App.tsx 那一行 `celebrate={celebrateService.play}` 是「幸运弹层响了」的**唯一**投递点:
  // LessonEntry 只负责结算,撒花档由组合层传下去。断的是**行为**(注入的 CelebrateService.play
  // 收到了 `'lucky'`),不是 `LuckyBonus.props.celebrate === celebrateService.play` 那种实现耦合 ——
  // 前者删掉 App 那一行必红,后者只证明「React 把 prop 传下去了」而证不了它响没响。
  it('结算出幸运奖励时,幸运弹层用组合层注入的 celebrateService.play 发出 lucky 档', async () => {
    const { svc, container } = mountApp({ luckyReward: 50 })

    await waitFor(() => expect(container.querySelector('[data-learning-path]')).not.toBeNull())
    expandToFirstLesson()
    fireEvent.click(currentNode())
    await screen.findByRole('button', { name: '回路径' })

    // 交账在一节走完时发生 —— 从落块起换成假时钟,走完第一节(3~5 题)。
    vi.useFakeTimers()
    try {
      await solveFirstLesson()

      // 正向:确实走到了幸运弹层(🍀 只属于它;假 achievements 恒空,成就弹层不会出现)
      expect(screen.getByText('🍀')).toBeInTheDocument()
      // 落块期间 combo 恒返 0 ⇒ 没有任何连击档;luckyReward > 0 ⇒ 让掉的 word 档也不发。
      // 所以这一节**唯一**该响的就是 lucky 档,逐值比对即可
      expect(svc.celebratePlay.mock.calls.map(([level]) => level)).toEqual(['lucky'])
    } finally {
      vi.useRealTimers()
    }
  })
})
