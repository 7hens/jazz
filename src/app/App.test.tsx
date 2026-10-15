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
  Achievement,
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
  /**
   * `AchievementService.scan` 的返回值。默认空数组 = 一个成就都不得。
   * 需要「结算确实产出了成就」的用例用它非空(见庆祝态那条承重用例)。
   */
  scanResult?: readonly Achievement[]
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
  const achievements: AchievementService = { scan: () => opts.scanResult ?? [] }
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

/**
 * 把**当前这一遍**里还空着的槽按托盘里能放的正确块一个个点进去(点选路径 = 自动落位),一次不错。
 *
 * **只填空槽** —— 简单部分每道题跑两遍(脚手架遍 + 全拼遍,见 spec §2.1),脚手架遍的非目标槽
 * 是**预填锁定**的:那些块不在托盘里(`liveBlocks` 滤掉了),所以按 `slotsFor(level)` 无差别地点
 * 会撞上「托盘里找不到可放块」。空槽的判据是槽的 `aria-label`(空槽 / 已给 X / 已放 X)。
 */
function solveOnce(level: Level) {
  const emptySlotIds = new Set(
    Array.from(document.querySelectorAll<HTMLElement>('[data-slot-id]'))
      .filter((el) => el.getAttribute('aria-label') === '空槽')
      .map((el) => el.dataset.slotId),
  )
  for (const slot of slotsFor(level).filter((s) => emptySlotIds.has(s.id))) {
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

/**
 * 走完**第一节**(3~5 题)。题内一律拼对 ⇒ 没有错题、节末 `flush` 交账。
 *
 * **每道题跑两遍**:第 1 遍脚手架遍(只填空槽)、第 2 遍全拼遍(spec §2.1)。
 * 少跑一遍节就走不完,节末交账那条断言会跟着失真。
 */
async function solveFirstLesson() {
  for (const id of pathLessons()[0]!.levelIds) {
    solveOnce(levelById(id))
    await settleQuestion()
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

  // 2026-10-15:路径页不再是「零汉字」—— 每枚徽标下面加了一行**单元名**
  // (产品裁定「路径徽章标记下面要加上章节标题」)。不变量本身没被推翻,改的是它的**边界**:
  // 从「整页零汉字」收窄成「**白名单 + 范围契约**」——路径页里带汉字的元素**恰好**是那 12 行标题。
  // 完整理由与判据在 `LearningPath.test.tsx` 那条同名用例里,这里是同一契约在整页视角下的一次复核
  // (这一条守的是「渲染进真实应用后落点没变」——挂错宿主的话徽标会被算进别的页面去)。
  it('路径汉字白名单:页面里带汉字的元素恰好是 12 行单元标题', async () => {
    const { container } = mountApp()

    await waitFor(() => expect(container.querySelector('[data-learning-path]')).not.toBeNull())
    const path = container.querySelector('[data-learning-path]')!
    // 扫「元素自身的文本子节点」而不是整棵树的 textContent —— 否则根节点永远"含汉字"。
    const carriers = [...path.querySelectorAll<HTMLElement>('*')].filter((el) =>
      [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && HAN_TEXT.test(n.textContent ?? '')),
    )
    expect(carriers.map((el) => el.dataset.unitTitle)).toEqual(UNITS.map((u) => u.id))
    expect(carriers.map((el) => el.textContent)).toEqual(UNITS.map((u) => u.name))
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
    // 本节题数读的是**遍数** —— 简单部分每道题跑两遍(脚手架遍 + 全拼遍,见 spec §2.1),
    // 故分母是 items 的遍数而不是道题数;课程切分线挪动时断言跟着走,不钉死数字。
    // (2026-10-14 那排画出来的题位条已删,观测点搬到 `data-question-total`;分母的**语义不许
    //  因为「不再显示」就被改成道题数** —— 那会把脚手架遍这条线悄悄改没。)
    const game = document.querySelector('[data-game-area]') as HTMLElement
    expect(game.dataset.questionTotal).toBe(String(pathLessons()[0]!.levelIds.length * 2))
    expect(game.dataset.questionDone).toBe('1')
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

  // ── 徽章栏:settings 就绪与否都**恒不出现** ─────────────────────────────────
  // 2026-10-13 产品口径「徽章列表放在首页有点丑」⇒ `ACHIEVEMENTS_VISIBLE = false`。
  // 原先这两条钉的是「settings 没到位时整条不出现 / 就绪后出现且全暗」;
  // 现在钉的是**两种 settings 状态下都不出现**。保留用例而不是删 —— 删了就再没人守它不会偷偷回来。
  it('settings 未就绪时路径上不出现徽章栏', async () => {
    const { container } = mountApp({ settingsPublishes: false })

    await waitFor(() => expect(container.querySelector('[data-learning-path]')).not.toBeNull())
    expect(document.querySelectorAll('[data-achievement-badges]')).toHaveLength(0)
    expect(document.querySelectorAll('[data-badge-id]')).toHaveLength(0)
  })

  it('settings 就绪后徽章栏仍不出现(成就总开关关着)', async () => {
    const { container } = mountApp()

    await waitFor(() => expect(container.querySelector('[data-learning-path]')).not.toBeNull())
    expect(document.querySelectorAll('[data-achievement-badges]')).toHaveLength(0)
    expect(document.querySelectorAll('[data-badge-id]')).toHaveLength(0)
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

  /**
   * **承重用例**:成就总开关关着时,结算**同时**产出成就与幸运奖励,幸运弹层仍必须弹出来。
   *
   * 它挡的是「在渲染层藏 `AchievementPopup`」那个坑:成就弹层的 `onDone` 是
   * `advanceCelebration` 的**唯一**调用点,庆祝队列靠它一条条排空。渲染层藏掉弹层 ⇒
   * 队列头一条成就永远出不去 ⇒ `celebration` 永远非 null ⇒ **之后每一个弹层都不再出现**。
   * 那是**静默失效**(屏幕上只是「什么也不弹」,没有任何报错),不是「隐藏」。
   *
   * 所以正确的藏法在 `handleSettle` **入口**:开关关着就把成就从队列里摘掉,
   * `achievements` 变空数组 ⇒ `advanceCelebration` 直接落到 LuckyBonus 分支 ⇒ 队列排得空、
   * 幸运弹层照常出、不留残状态。
   *
   * 判据只用 LuckyBonus 独占的 🍀 与注入的 `celebrateService.play` 收到的档位(同上一条),
   * 不用实现耦合。`scan` 这里**必须**返非空 —— scan 恒空的话即便把弹层在渲染层藏掉,
   * 队列首格本来就是 LuckyBonus,这条会假绿。
   */
  it('成就隐藏(开关关)时,结算出成就 + 幸运奖励,庆祝队列照样排空:幸运弹层仍弹出来', async () => {
    const { svc, container } = mountApp({
      luckyReward: 50,
      scanResult: ACHIEVEMENTS.slice(0, 1),
    })
    expect(ACHIEVEMENTS.length, '成就目录空了,上面那条 scan 非空的承重前提就不成立').toBeGreaterThan(0)

    await waitFor(() => expect(container.querySelector('[data-learning-path]')).not.toBeNull())
    expandToFirstLesson()
    fireEvent.click(currentNode())
    await screen.findByRole('button', { name: '回路径' })

    vi.useFakeTimers()
    try {
      await solveFirstLesson()

      // 正向:确实走到了幸运弹层。🍀 只属于 LuckyBonus;成就弹层被开关摘掉了不该出现。
      expect(screen.getByText('🍀'), '成就隐藏后幸运弹层没弹出来 —— 庆祝队列被卡死了(成就弹层的 onDone 是 advanceCelebration 的唯一调用点)').toBeInTheDocument()
      // 成就照常入账 ⇒ `flush` 看见 achievements 非空 ⇒ 不撒 word 档;luckyReward > 0 ⇒ 也不撒别的
      expect(svc.celebratePlay.mock.calls.map(([level]) => level)).toEqual(['lucky'])
    } finally {
      vi.useRealTimers()
    }
  })
})
