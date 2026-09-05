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
  ChoiceQuestion,
  ComboSnapshot,
  ProgressSnapshot,
  SettingsSnapshot,
  ToastData,
  User,
  UserSettings,
  WordUnit,
} from '@/shared/services'
import { createProgressRulesService } from '@/features/lesson'
import App from './App'

const user: User = { id: 'u', email: '', name: '' }

const settings: UserSettings = {
  enablePinyin: true,
  enableHanzi: true,
  enableEnglish: true,
  earnedAchievements: [],
  consecutiveDays: 0,
  lastActiveDate: '',
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

  const speech: SpeechService = { speak: () => true, stop: () => undefined }
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

  registry.register(AuthService, auth)
  registry.register(ProgressService, progress)
  registry.register(SettingsService, settingsService)
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

  return { auth, authStore, check, progressLoad, settingsLoad, celebrate, play: audio.play }
}

/** 挂载后立即显示群岛主页(登录 + 并行加载完成)。 */
async function renderAuthenticatedHome() {
  const svc = registerAll()
  svc.check.mockImplementation((): Promise<undefined> => {
    svc.authStore.publish({ status: 'authenticated', user })
    return Promise.resolve(undefined)
  })
  render(<App />)
  await waitFor(() => expect(screen.getByRole('heading', { name: '收集 100 个词的星尘' })).toBeInTheDocument())
  return svc
}

beforeEach(() => registry.clear())

describe('App 路由', () => {
  it('boot → login:认证返回匿名时显示登录门', async () => {
    const svc = registerAll()
    svc.authStore.publish({ status: 'anonymous' })
    render(<App />)

    expect(await screen.findByRole('button', { name: /进入魔法岛/ })).toBeInTheDocument()
  })

  it('boot → home:认证成功后加载 progress/settings 并显示主页', async () => {
    const svc = await renderAuthenticatedHome()

    expect(await screen.findByText(/收集 100 个词的星尘/)).toBeInTheDocument()
    await waitFor(() => expect(svc.progressLoad).toHaveBeenCalled())
    await waitFor(() => expect(svc.settingsLoad).toHaveBeenCalled())
  })

  it('401 → login:会话转为匿名后回到登录门', async () => {
    const svc = await renderAuthenticatedHome()

    act(() => svc.authStore.publish({ status: 'anonymous' }))

    expect(await screen.findByRole('button', { name: /进入魔法岛/ })).toBeInTheDocument()
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
    expect(await screen.findByRole('switch', { name: /拼音/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '完成' }))
    expect(await screen.findByRole('heading', { name: '收集 100 个词的星尘' })).toBeInTheDocument()
  })
})
