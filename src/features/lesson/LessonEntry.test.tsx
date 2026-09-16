import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { registry } from '@/shared/services/core'
import {
  AchievementService,
  AudioService,
  CelebrateService,
  ComboService,
  LuckyBonusService,
  ProgressService,
  QuestionEngineService,
  SettingsService,
  SpeechService,
  ToastService,
  VocabularyService,
} from '@/shared/services'
import type { ChoiceQuestion, ProgressSnapshot, UserSettings, WordUnit } from '@/shared/services'
import { LessonEntry } from './LessonEntry'
import wordLessonSource from './WordLesson.tsx?raw'

const word: WordUnit = {
  id: 1,
  emoji: '☀️',
  pinyin: 'tài yáng',
  hanzi: '太阳',
  english: 'sun',
  category: 'nature',
}

const question: ChoiceQuestion = {
  kind: 'choice',
  prompt: '选出太阳的拼音',
  options: [
    { id: 'sun', text: 'píng guǒ' },
    { id: 'moon', text: 'yuè liang' },
  ],
  answerId: 'sun',
}

// 领域语义:中文两步(拼音+汉字)→ 首步 pinyin。原「汉字起步」技能粒度用例在领域下无等价,按断言意图重表达。
const settings: UserSettings = {
  enableChinese: true,
  enableEnglish: false,
  earnedAchievements: [],
  consecutiveDays: 0,
  lastActiveDate: '',
  updatedAt: '2026-09-05T00:00:00.000Z',
}

beforeEach(() => registry.clear())

/** 可变 + 可订阅的 ProgressService 假体:镜像真实 `features/progress` 里 `persist()` 的**乐观发布** ——
 *  saveStep 在 await 之前就同步合并新行并通知订阅者,而不是等请求回来才更新。
 *  getSnapshot 必须返回稳定引用,否则 useSyncExternalStore 会无限重渲染。 */
function makeProgressService(): ProgressService {
  let snapshot: ProgressSnapshot = { status: 'ready', data: {} }
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    load: async () => undefined,
    seed: () => undefined,
    saveStep: async (next) => {
      snapshot = { status: 'ready', data: { ...snapshot.data, [next.wordId]: next } }
      listeners.forEach((listener) => listener())
    },
    saveAll: async () => undefined,
    resetAll: async () => undefined,
  }
}

/** 注册除 Progress 以外的全部服务(Progress 由用例自备,好看发布时机)。 */
function registerFakes(progress: ProgressService, engineOverrides: Partial<QuestionEngineService> = {}) {
  const vocabulary: VocabularyService = {
    getAllWords: () => [word],
    wordById: id => id === word.id ? word : undefined,
    sentenceSetFor: () => undefined,
  }
  const questionEngine: QuestionEngineService = {
    optionCountFor: () => 2,
    textOf: value => value.hanzi,
    speakOf: value => value.hanzi,
    distractorsFor: () => [],
    makeChoice: () => question,
    makeListen: () => ({ ...question, kind: 'listen-choice', promptSpeak: word.hanzi }),
    makeMatch: () => ({ kind: 'match', prompt: 'match', left: [], right: [], answerMap: {} }),
    makeStepQuestions: vi.fn(() => [question, question]),
    makeSentenceQuestions: () => [],
    ...engineOverrides,
  }
  const settingsSnapshot = { status: 'ready', data: settings } as const
  const settingsService: SettingsService = {
    getSnapshot: () => settingsSnapshot,
    subscribe: () => () => undefined,
    load: async () => undefined,
    save: async () => undefined,
  }
  const comboSnapshot = { combo: 0, maxCombo: 0 } as const
  const combo: ComboService = {
    getSnapshot: () => comboSnapshot,
    subscribe: () => () => undefined,
    answer: () => 0,
    reset: () => undefined,
    getBonus: () => 0,
  }
  const audio: AudioService = {
    getSnapshot: () => true,
    subscribe: () => () => undefined,
    isOn: () => true,
    setOn: () => undefined,
    play: () => undefined,
    unlock: () => undefined,
  }
  const speech: SpeechService = { speak: () => true, speakRole: () => true, stop: () => undefined }
  const celebrate: CelebrateService = { play: () => undefined }
  const toast: ToastService = {
    getSnapshot: () => [],
    subscribe: () => () => undefined,
    show: () => 1,
    dismiss: () => undefined,
  }
  const achievements: AchievementService = { scan: () => [] }
  const lucky: LuckyBonusService = { roll: () => 0 }

  registry.register(VocabularyService, vocabulary)
  registry.register(QuestionEngineService, questionEngine)
  registry.register(ProgressService, progress)
  registry.register(SettingsService, settingsService)
  registry.register(ComboService, combo)
  registry.register(AudioService, audio)
  registry.register(SpeechService, speech)
  registry.register(CelebrateService, celebrate)
  registry.register(ToastService, toast)
  registry.register(AchievementService, achievements)
  registry.register(LuckyBonusService, lucky)
}

it('renders the first enabled skill using only registered service composition', () => {
  registerFakes(makeProgressService())

  render(<LessonEntry wordId={1} onExit={vi.fn()} onNextWord={vi.fn()} />)

  expect(screen.getByText('选出太阳的拼音')).toBeInTheDocument()
  expect(screen.getByText(/^☀️ 太阳 · 拼音$/)).toBeInTheDocument()
})

// spec §10 R3:「必须实测首过技能步后计数确实跳动」—— dust 之前零断言(把传参改成常数,测试照样全绿)。
// 本用例走真路径(真点题、真过步),只把数据源换成会乐观发布的假体。
const question2: ChoiceQuestion = {
  kind: 'choice',
  prompt: '选出太阳的汉字',
  options: [
    { id: 'hanzi-sun', text: '太阳' },
    { id: 'hanzi-moon', text: '月亮' },
  ],
  answerId: 'hanzi-sun',
}

it('首过技能步后顶栏星尘确实跳动(乐观合并生效,不是取到陈旧值)', async () => {
  registerFakes(makeProgressService(), { makeStepQuestions: () => [question, question2] })
  const { container } = render(<LessonEntry wordId={1} onExit={vi.fn()} onNextWord={vi.fn()} />)

  const hud = () => container.querySelector('[data-hud="dust"]')
  expect(hud()).toHaveTextContent('0') // 初值
  const before = hud()!.textContent

  // 首步两道题各一次答对 → 步过(不 fake 掉步序/判分,只喂一道不同的第二题好观察推进)。
  fireEvent.click(screen.getByText('píng guǒ'))
  fireEvent.click(screen.getByRole('button', { name: '就它了!' }))
  await waitFor(() => expect(screen.getByText('选出太阳的汉字')).toBeInTheDocument(), { timeout: 3000 })
  fireEvent.click(screen.getByText('太阳'))
  fireEvent.click(screen.getByRole('button', { name: '就它了!' }))

  // 首过技能步 +30。锚点:断言的是「数字确实变了」——取到陈旧值/接线缺失都会卡在初值 0;
  // 只断言元素存在(恒真)则测不出这里。
  await waitFor(() => expect(hud()).toHaveTextContent('30'), { timeout: 3000 })
  expect(hud()!.textContent).not.toBe(before)
})

it('keeps WordLesson free of direct service lookup', () => {
  expect(wordLessonSource).not.toMatch(/\buseService\s*\(/)
})
