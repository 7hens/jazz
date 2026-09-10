import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registry } from '@/shared/services/core'
import {
  AchievementService,
  AudioService,
  AuthService,
  BasicsService,
  CelebrateService,
  ChapterService,
  ComboService,
  FoundationService,
  LuckyBonusService,
  ProgressRulesService,
  ProgressService,
  QuestionEngineService,
  SettingsService,
  SpeechService,
  ToastService,
  VocabularyService,
} from '@/shared/services'
import type {
  AuthSnapshot,
  BasicsProgressRow,
  BasicsProgressSnapshot,
  ChapterProgressSnapshot,
  ChoiceQuestion,
  ComboSnapshot,
  ProgressSnapshot,
  SettingsSnapshot,
  ToastData,
  User,
  UserSettings,
  WordProgress,
  WordUnit,
} from '@/shared/services'
import { createProgressRulesService } from '@/features/lesson'
import App from './App'

const user: User = { id: 'u', email: '', name: '' }

const settings: UserSettings = {
  enableChinese: true,
  enableEnglish: true,
  earnedAchievements: [],
  consecutiveDays: 0,
  lastActiveDate: '',
  updatedAt: '2026-09-05T00:00:00.000Z',
}

// 老用户进度:词 1 已有一行(未整词完成,仍可进词课);任何 progress 有行即不触发冷启动小测。
const partialRow: WordProgress = {
  wordId: 1,
  completed: { pinyin: false, hanzi: false, english: false },
  starsEarned: 0,
  updatedAt: '2026-09-05T00:00:00.000Z',
}

const word: WordUnit = {
  id: 1,
  emoji: '☀️',
  pinyin: 'tài yáng',
  hanzi: '太阳',
  english: 'sun',
  category: 'nature',
}

const firstChoice: ChoiceQuestion = {
  kind: 'choice',
  prompt: '选出太阳的汉字',
  options: [
    { id: 'a', text: '太阳' },
    { id: 'b', text: '月亮' },
  ],
  answerId: 'a',
}

const secondChoice: ChoiceQuestion = {
  kind: 'choice',
  prompt: '选出太阳的拼音',
  options: [
    { id: 'c', text: 'tài yáng' },
    { id: 'd', text: 'yuè liang' },
  ],
  answerId: 'c',
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

function registerAll() {
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

  const progressStore = createStore<ProgressSnapshot>({ status: 'idle', data: {} })
  const progressLoad = vi.fn(async () => {
    progressStore.publish({ status: 'ready', data: progressStore.getSnapshot().data })
  })
  const progress: ProgressService = {
    getSnapshot: progressStore.getSnapshot,
    subscribe: progressStore.subscribe,
    load: progressLoad,
    seed: () => undefined,
    saveStep: async () => undefined,
    saveAll: async () => undefined,
    resetAll: async () => undefined,
  }

  const settingsStore = createStore<SettingsSnapshot>({ status: 'idle', data: settings })
  const settingsLoad = vi.fn(async () => {
    settingsStore.publish({ status: 'ready', data: settingsStore.getSnapshot().data })
  })
  const settingsService: SettingsService = {
    getSnapshot: settingsStore.getSnapshot,
    subscribe: settingsStore.subscribe,
    load: settingsLoad,
    save: async () => undefined,
  }

  const vocabulary: VocabularyService = {
    getAllWords: () => [word],
    wordById: (id) => (id === word.id ? word : undefined),
  }

  const chapterStore = createStore<ChapterProgressSnapshot>({ status: 'idle', data: { row: null } })
  const chapterLoad = vi.fn(async () => {
    chapterStore.publish({ status: 'ready', data: chapterStore.getSnapshot().data })
  })
  const chapter: ChapterService = {
    getSnapshot: chapterStore.getSnapshot,
    subscribe: chapterStore.subscribe,
    load: chapterLoad,
    save: vi.fn(async () => undefined),
    clear: vi.fn(async () => undefined),
  }

  const questionEngine: QuestionEngineService = {
    optionCountFor: () => 2,
    textOf: (w) => w.hanzi,
    speakOf: (w) => w.hanzi,
    distractorsFor: () => [],
    makeChoice: () => firstChoice,
    makeListen: () => ({
      kind: 'listen-choice',
      prompt: '听一听,选一选',
      promptSpeak: word.hanzi,
      options: [{ id: 'a', text: word.hanzi }],
      answerId: 'a',
    }),
    makeMatch: () => ({
      kind: 'match',
      prompt: '配对',
      left: [{ id: 'a', text: word.hanzi }],
      right: [{ id: 'a', text: word.emoji }],
      answerMap: { a: 'a' },
    }),
    makeStepQuestions: () => [firstChoice, secondChoice],
  }

  const comboStore = createStore<ComboSnapshot>({ combo: 0, maxCombo: 0 })
  const combo: ComboService = {
    getSnapshot: comboStore.getSnapshot,
    subscribe: comboStore.subscribe,
    answer: vi.fn(() => 0),
    reset: () => undefined,
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
  const celebrate: CelebrateService = { play: vi.fn() }
  const toastStore = createStore<readonly ToastData[]>([])
  const toast: ToastService = {
    getSnapshot: toastStore.getSnapshot,
    subscribe: toastStore.subscribe,
    show: vi.fn(() => 1),
    dismiss: () => undefined,
  }
  const achievements: AchievementService = { scan: () => [] }
  const lucky: LuckyBonusService = { roll: () => 0 }

  // 基础教学门:测试沿用旧行为 —— 空单元列表 → stepGate.judge 恒 false,词课不进教学门。
  const basicsStore = createStore<BasicsProgressSnapshot>({ status: 'idle', data: {} })
  const basicsLoad = vi.fn(async () => {
    basicsStore.publish({ status: 'ready', data: basicsStore.getSnapshot().data })
  })
  const basicsRecord = vi.fn(async () => undefined)
  const basicsSaveAll = vi.fn(async (_rows: readonly BasicsProgressRow[]) => {})
  const basics: BasicsService = {
    getSnapshot: basicsStore.getSnapshot,
    subscribe: basicsStore.subscribe,
    load: basicsLoad,
    recordAnswer: basicsRecord,
    markTaught: async () => undefined,
    saveAll: basicsSaveAll,
  }
  const foundation: FoundationService = {
    unitsFor: () => [],
    needFor: () => 'none',
  }

  registry.register(AuthService, auth)
  registry.register(ProgressService, progress)
  registry.register(SettingsService, settingsService)
  registry.register(ChapterService, chapter)
  registry.register(VocabularyService, vocabulary)
  registry.register(QuestionEngineService, questionEngine)
  registry.register(ComboService, combo)
  registry.register(AudioService, audio)
  registry.register(SpeechService, speech)
  registry.register(CelebrateService, celebrate)
  registry.register(ToastService, toast)
  registry.register(AchievementService, achievements)
  registry.register(LuckyBonusService, lucky)
  registry.register(ProgressRulesService, createProgressRulesService())
  registry.register(FoundationService, foundation)
  registry.register(BasicsService, basics)

  return {
    auth,
    authStore,
    check,
    progressLoad,
    settingsLoad,
    basicsLoad,
    basicsRecord,
    basicsSaveAll,
    celebrate,
    chapter,
    chapterLoad,
    chapterStore,
    play: audio.play,
    progressStore,
    settingsStore,
    basicsStore,
  }
}

/** 认证登录;fresh 不预置 progress 行(→触发冷启动小测),默认预置 1 行 = 老用户(→直达群岛)。 */
function mountApp(opts: { returning?: boolean } = {}) {
  const svc = registerAll()
  svc.check.mockImplementation((): Promise<undefined> => {
    svc.authStore.publish({ status: 'authenticated', user })
    return Promise.resolve(undefined)
  })
  if (opts.returning !== false) {
    svc.progressStore.publish({ status: 'idle', data: { 1: partialRow } })
  }
  const utils = render(<App />)
  return { svc, ...utils }
}

/** 老用户登录 → 双世界壳 → 点「字母林」直达群岛(主页标题出现)。 */
async function renderAuthenticatedHome() {
  const { svc } = mountApp({ returning: true })
  // 登录后首落世界壳
  await waitFor(() => expect(screen.getByRole('heading', { name: '选择你的世界' })).toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: /字母林/ }))
  await waitFor(() => expect(screen.getByRole('heading', { name: '收集 100 个词的星尘' })).toBeInTheDocument())
  return svc
}

/** 点当前小测题首个选项(题面 shuffle 随机;对错都推进,故任选即可)。 */
function clickAnyOption(container: HTMLElement) {
  const grid = Array.from(container.querySelectorAll('div.grid')).find((el) => el.querySelectorAll('button').length > 0)
  expect(grid, '应存在选项 grid').toBeTruthy()
  const btn = grid!.querySelectorAll('button')[0] as HTMLElement
  fireEvent.click(btn)
}

/** 提交当前题(新确认制:点选项后再点「确定」才判)。 */
function confirmAnswer() {
  fireEvent.click(screen.getByRole('button', { name: '确定' }))
}

beforeEach(() => registry.clear())

describe('App 路由', () => {
  it('boot → login:认证返回匿名时显示登录门', async () => {
    const svc = registerAll()
    svc.authStore.publish({ status: 'anonymous' })
    render(<App />)

    expect(await screen.findByRole('button', { name: /进入魔法岛/ })).toBeInTheDocument()
  })

  it('boot → home(老用户):认证成功后加载 progress/settings 并直达主页,不弹小测', async () => {
    const svc = await renderAuthenticatedHome()

    expect(await screen.findByText(/收集 100 个词的星尘/)).toBeInTheDocument()
    await waitFor(() => expect(svc.progressLoad).toHaveBeenCalled())
    await waitFor(() => expect(svc.settingsLoad).toHaveBeenCalled())
    await waitFor(() => expect(svc.basicsLoad).toHaveBeenCalled())
    await waitFor(() => expect(svc.chapterLoad).toHaveBeenCalled())
    expect(screen.queryByRole('heading', { name: '魔法入门小测' })).not.toBeInTheDocument()
  })

  it('401 → login:会话转为匿名后回到登录门', async () => {
    const svc = await renderAuthenticatedHome()

    act(() => svc.authStore.publish({ status: 'anonymous' }))

    expect(await screen.findByRole('button', { name: /进入魔法岛/ })).toBeInTheDocument()
  })

  it('world → qianzigu-map:世界壳点千字谷进章节地图,返回回世界壳', async () => {
    const { svc } = mountApp({ returning: true })
    await waitFor(() => expect(screen.getByRole('heading', { name: '选择你的世界' })).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /千字谷/ }))
    expect(await screen.findByRole('heading', { name: '千字谷 · 章节地图' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '返回世界' }))
    expect(await screen.findByRole('heading', { name: '选择你的世界' })).toBeInTheDocument()
    await waitFor(() => expect(svc.chapterLoad).toHaveBeenCalled())
  })

  it('world → qianzigu-map → ch1 开始 → chapter 相位跑首幕,返回回地图', async () => {
    const { svc } = mountApp({ returning: true })
    await waitFor(() => expect(screen.getByRole('heading', { name: '选择你的世界' })).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /千字谷/ }))
    expect(await screen.findByRole('heading', { name: '千字谷 · 章节地图' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '开始' }))
    // 首幕标记:open 以旁白起头(ch1.ts),故断言首行。
    expect(await screen.findByText(/早上的千字谷镇/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '返回地图' }))
    expect(await screen.findByRole('heading', { name: '千字谷 · 章节地图' })).toBeInTheDocument()
    await waitFor(() => expect(svc.chapterLoad).toHaveBeenCalled())
  })

  it('home → lesson:点可用词进入对应词的答题屏', async () => {
    await renderAuthenticatedHome()

    fireEvent.click(screen.getByRole('button', { name: /^词 1 / }))

    expect(await screen.findByRole('button', { name: '返回地图' })).toBeInTheDocument()
  })

  it('settings:开合家长设置面板后回到主页', async () => {
    await renderAuthenticatedHome()

    fireEvent.click(screen.getByRole('button', { name: '家长菜单' }))
    fireEvent.click(screen.getByRole('menuitem', { name: /学习设置/ }))
    expect(await screen.findByRole('switch', { name: /汉语/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '完成' }))
    expect(await screen.findByRole('heading', { name: '收集 100 个词的星尘' })).toBeInTheDocument()
  })
})

describe('App 冷启动诊断', () => {
  it('fresh 零进度 → 登录后进小测,不进群岛', async () => {
    mountApp({ returning: false })

    expect(await screen.findByRole('heading', { name: '魔法入门小测' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '收集 100 个词的星尘' })).not.toBeInTheDocument()
  })

  it('fresh 跳过小测 → 回群岛,会话内不再弹(空基础/空进度空转 publish 也不重弹)', async () => {
    const { svc } = mountApp({ returning: false })

    await screen.findByRole('heading', { name: '魔法入门小测' })
    fireEvent.click(screen.getByRole('button', { name: '跳过小测' }))

    expect(await screen.findByRole('heading', { name: '选择你的世界' })).toBeInTheDocument()

    act(() => { svc.progressStore.publish({ status: 'ready', data: {} }) })
    act(() => { svc.basicsStore.publish({ status: 'ready', data: {} }) })
    expect(screen.queryByRole('heading', { name: '魔法入门小测' })).not.toBeInTheDocument()
  })

  it('fresh 答完小测 → saveAll 写基线,回群岛', async () => {
    vi.useFakeTimers()
    try {
      const { svc, container } = mountApp({ returning: false })
      await act(async () => {})

      expect(screen.getByRole('heading', { name: '魔法入门小测' })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: '开始' }))

      for (let i = 0; i < 6; i++) {
        clickAnyOption(container)
        confirmAnswer()
        act(() => { vi.advanceTimersByTime(700) })
      }

      expect(screen.getByRole('button', { name: '开始游戏' })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: '开始游戏' }))

      expect(svc.basicsSaveAll).toHaveBeenCalledTimes(1)
      const rows = svc.basicsSaveAll.mock.calls[0][0] as readonly BasicsProgressRow[]
      expect(rows.length).toBeGreaterThan(0)
      expect(svc.basicsRecord).not.toHaveBeenCalled() // 逐题零写,基线只在「开始游戏」一次性落库
      expect(screen.getByRole('heading', { name: '选择你的世界' })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})
