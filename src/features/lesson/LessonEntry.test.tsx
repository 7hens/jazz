import { render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { registry } from '@/shared/registry'
import type {
  AudioService,
  CelebrateService,
  ComboService,
  ProgressService,
  QuestionEngineService,
  SettingsService,
  SpeechService,
  ToastService,
  VocabularyService,
} from '@/shared/services'
import type { ChoiceQuestion, UserSettings, WordUnit } from '@/shared/types'
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
  prompt: '选出太阳的汉字',
  options: [
    { id: 'sun', text: '太阳' },
    { id: 'moon', text: '月亮' },
  ],
  answerId: 'sun',
}

const settings: UserSettings = {
  enablePinyin: false,
  enableHanzi: true,
  enableEnglish: true,
  earnedAchievements: [],
  consecutiveDays: 0,
  lastActiveDate: '',
  updatedAt: '2026-09-05T00:00:00.000Z',
}

beforeEach(() => registry.clear())

it('renders the first enabled skill using only registered service composition', () => {
  const vocabulary: VocabularyService = {
    getAllWords: () => [word],
    wordById: id => id === word.id ? word : undefined,
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
  }
  const progressSnapshot = { status: 'ready', data: {} } as const
  const progress: ProgressService = {
    getSnapshot: () => progressSnapshot,
    subscribe: () => () => undefined,
    load: async () => undefined,
    seed: () => undefined,
    saveStep: async () => undefined,
    saveAll: async () => undefined,
    resetAll: async () => undefined,
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
  const speech: SpeechService = { speak: () => true, stop: () => undefined }
  const celebrate: CelebrateService = { play: () => undefined }
  const toast: ToastService = {
    getSnapshot: () => [],
    subscribe: () => () => undefined,
    show: () => 1,
    dismiss: () => undefined,
  }

  registry.register('vocabulary', vocabulary)
  registry.register('question-engine', questionEngine)
  registry.register('progress', progress)
  registry.register('settings-state', settingsService)
  registry.register('combo', combo)
  registry.register('audio', audio)
  registry.register('speech', speech)
  registry.register('celebrate', celebrate)
  registry.register('toast', toast)

  render(<LessonEntry wordId={1} onExit={vi.fn()} onNextWord={vi.fn()} />)

  expect(screen.getByText('选出太阳的汉字')).toBeInTheDocument()
  expect(screen.getByText(/^☀️ 太阳 · 汉字$/)).toBeInTheDocument()
})

it('keeps WordLesson free of direct service lookup', () => {
  expect(wordLessonSource).not.toMatch(/\buseService\s*\(/)
})
