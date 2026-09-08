import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createProgressRulesService } from '@/features/lesson'
import type {
  AudioService,
  CelebrateService,
  ChapterProgressRow,
  ChapterService,
  ProgressService,
  ProgressData,
  QuestionEngineService,
  SettingsService,
  SpeechService,
  UserSettings,
  VocabularyService,
  WordProgress,
  WordUnit,
} from '@/shared/services'
import type { Chapter } from './chapter'
import { ChapterRunnerView, type ChapterRunnerServices } from './ChapterRunnerView'

const word: WordUnit = {
  id: 1,
  emoji: '☀️',
  pinyin: 'tài yáng',
  hanzi: '太阳',
  english: 'sun',
  category: 'shape',
}

const settings: UserSettings = {
  enableChinese: true,
  enableEnglish: false,
  earnedAchievements: [],
  consecutiveDays: 0,
  lastActiveDate: '',
  updatedAt: '2026-09-05T00:00:00.000Z',
}

function makeStore<T>(initial: T) {
  let snapshot = initial
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    publish(next: T) { snapshot = next; listeners.forEach((l) => l()) },
  }
}

function flowChapter(): Chapter {
  return {
    id: 1,
    title: '太阳的求救',
    subtitle: '测试章',
    emoji: '🌅',
    wordIds: [1],
    restoreOrder: [1],
    scenes: [
      { id: 'open', kind: 'dialogue', lines: [{ role: 'lingling', text: '你好,太阳!' }] },
      { id: 't1', kind: 'task', title: '拯救声音', intro: [], task: { wordId: 1, layer: 'sound', minCorrect: 2 }, onDone: [] },
      { id: 'settle', kind: 'settle', summary: [{ role: 'lingling', text: '大山那边有什么呢?' }] },
    ],
  }
}

function bossChapter(): Chapter {
  return {
    id: 1,
    title: '太阳的求救',
    subtitle: 'BOSS 测试',
    emoji: '🌅',
    wordIds: [1],
    restoreOrder: [1],
    scenes: [
      { id: 't1', kind: 'task', title: '拯救声音', intro: [], task: { wordId: 1, layer: 'sound', minCorrect: 2 }, onDone: [] },
      {
        id: 'boss',
        kind: 'boss',
        intro: [],
        maxWrong: 2,
        questionCount: 2,
        win: [{ role: 'jingmo', text: '不可能...!' }],
        lose: [
          { role: 'lingling', text: '已经很棒了!太阳、月亮都被你救了!' },
          { role: 'lingling', text: '我们先回去休息,下次再来挑战静默!' },
        ],
      },
    ],
  }
}

function breakChapter(): Chapter {
  return {
    id: 1,
    title: '太阳的求救',
    subtitle: '断点测试',
    emoji: '🌅',
    wordIds: [1],
    restoreOrder: [1],
    scenes: [
      { id: 'open', kind: 'dialogue', lines: [{ role: 'lingling', text: '出发!' }] },
      { id: 't1', kind: 'task', title: '拯救声音', intro: [], task: { wordId: 1, layer: 'sound', minCorrect: 2 }, onDone: [] },
      { id: 'br1', kind: 'break' },
      { id: 'settle', kind: 'settle', summary: [] },
    ],
  }
}

const choiceQ = {
  kind: 'choice' as const,
  prompt: '选出太阳的拼音',
  options: [
    { id: 'a', text: '太阳' },
    { id: 'b', text: '月亮' },
  ],
  answerId: 'a',
}

function makeFakes(progressData: ProgressData = {}, row: ChapterProgressRow | null = null) {
  const progressStore = makeStore({ status: 'ready', data: progressData } as const)
  const saveStep = vi.fn(async (_row: WordProgress) => undefined)
  const progress: ProgressService = {
    getSnapshot: progressStore.getSnapshot,
    subscribe: progressStore.subscribe,
    load: vi.fn(async () => undefined),
    seed: vi.fn(),
    saveStep,
    saveAll: vi.fn(async () => undefined),
    resetAll: vi.fn(async () => undefined),
  }
  const settingsStore = makeStore({ status: 'ready', data: settings } as const)
  const settingsService: SettingsService = {
    getSnapshot: settingsStore.getSnapshot,
    subscribe: settingsStore.subscribe,
    load: vi.fn(async () => undefined),
    save: vi.fn(async () => undefined),
  }
  const chapterStore = makeStore({ status: 'ready', data: { row } } as const)
  const chapterSave = vi.fn(async (_row: ChapterProgressRow) => undefined)
  const chapterClear = vi.fn(async () => undefined)
  const chapter: ChapterService = {
    getSnapshot: chapterStore.getSnapshot,
    subscribe: chapterStore.subscribe,
    load: vi.fn(async () => undefined),
    save: chapterSave,
    clear: chapterClear,
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
    makeChoice: () => choiceQ,
    makeListen: () => ({ kind: 'listen-choice', prompt: 'x', promptSpeak: 'x', options: [], answerId: 'a' }),
    makeMatch: () => ({ kind: 'match', prompt: 'x', left: [], right: [], answerMap: {} }),
    makeStepQuestions: vi.fn(() => [choiceQ]),
  }
  const audio: AudioService = {
    getSnapshot: () => true,
    subscribe: () => () => undefined,
    isOn: () => true,
    setOn: vi.fn(),
    play: vi.fn(),
    unlock: vi.fn(),
  }
  const speech: SpeechService = {
    speak: vi.fn(() => true),
    speakRole: vi.fn(() => true),
    stop: vi.fn(),
  }
  const celebrate: CelebrateService = { play: vi.fn() }

  const services: ChapterRunnerServices = {
    progress,
    chapter,
    vocabulary,
    questionEngine,
    settings: settingsService,
    rules: createProgressRulesService(),
    speech,
    audio,
    celebrate,
  }
  return { services, saveStep, chapterSave, chapterClear, speech, audio }
}

function renderRunner(chapter: Chapter, row: ChapterProgressRow | null = null) {
  const fakes = makeFakes({}, row)
  const onExit = vi.fn()
  const onSettled = vi.fn()
  const utils = render(<ChapterRunnerView chapter={chapter} initialRow={row} onExit={onExit} onSettled={onSettled} services={fakes.services} />)
  return { ...fakes, onExit, onSettled, ...utils }
}

/** 当前 Choice 题作答:点选项再点确定(对/错都即时推进或进入 reveal)。 */
function answer(text: string) {
  fireEvent.click(screen.getByRole('button', { name: text }))
  fireEvent.click(screen.getByRole('button', { name: '确定' }))
}

describe('ChapterRunnerView 逐 scene 运行器', () => {
  it('dialogue → task:点继续进任务,出题;答对 2 次写 pinyin 进度到 settle', async () => {
    const { saveStep, onSettled } = renderRunner(flowChapter())

    // dialogue
    expect(screen.getByText('你好,太阳!')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '继续' }))

    // task 出题
    expect(screen.getByText('拯救声音')).toBeInTheDocument()
    expect(screen.getByText('选出太阳的拼音')).toBeInTheDocument()

    // 两次答对 → t1 restore(sound) → settle
    answer('太阳')
    answer('太阳')

    expect(await screen.findByRole('heading', { name: '第1章完成!' })).toBeInTheDocument()

    // restore effect 写 pinyin(幂等,wordId=1)
    expect(saveStep).toHaveBeenCalledTimes(1)
    const row = saveStep.mock.calls[0][0] as { wordId: number; completed: { pinyin: boolean }; starsEarned: number }
    expect(row.wordId).toBe(1)
    expect(row.completed.pinyin).toBe(true)
    expect(row.starsEarned).toBeGreaterThanOrEqual(30)

    fireEvent.click(screen.getByRole('button', { name: '回地图' }))
    expect(onSettled).toHaveBeenCalledTimes(1)
  })

  it('task 标题内层恢复:settle 卡展示学会的词与悬念台词', async () => {
    renderRunner(flowChapter())
    fireEvent.click(screen.getByRole('button', { name: '继续' }))
    answer('太阳')
    answer('太阳')

    expect(await screen.findByText('📖 学会的词')).toBeInTheDocument()
    expect(screen.getByText('太阳')).toBeInTheDocument()
    expect(screen.getByText(/大山那边有什么呢/)).toBeInTheDocument()
  })

  it('断点退出:到 break 点「明天再来」→ chapter.save 收到 resumeSceneId 行并 onExit', async () => {
    const fakes = renderRunner(breakChapter())
    fireEvent.click(screen.getByRole('button', { name: '继续' }))
    answer('太阳')
    answer('太阳')

    expect(await screen.findByRole('button', { name: /继续拯救/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '明天再来' }))

    expect(fakes.onExit).toHaveBeenCalled()
    const last = fakes.chapterSave.mock.calls.at(-1)?.[0] as { resumeSceneId: string; restoreState: string }
    expect(last.resumeSceneId).toBe('br1')
    expect(last.restoreState).toContain('"wordId":1')
    expect(last.restoreState).toContain('"layer":"sound"')
  })

  it('断点续玩:已有 word1:sound 恢复 → 渲染直接跳到 break,不再出该层题', () => {
    const row: ChapterProgressRow = {
      chapterId: 1,
      resumeSceneId: 'br1',
      restoreState: '[{"wordId":1,"layer":"sound"}]',
      updatedAt: '2026-09-08T00:00:00.000Z',
    }
    renderRunner(breakChapter(), row)

    expect(screen.getByRole('button', { name: /继续拯救/ })).toBeInTheDocument()
    expect(screen.queryByText('拯救声音')).not.toBeInTheDocument()
  })

  it('BOSS 错满 → 勇气台词出现、不再写后续词进度', async () => {
    const fakes = renderRunner(bossChapter())

    // 先完成词 1 pinyin(saveStep 1 次)
    answer('太阳')
    answer('太阳')

    // BOSS:intro 空 → 直接出题;连错满 maxWrong(2)
    expect(screen.getByText('BOSS · 静默')).toBeInTheDocument()

    bossWrong()
    bossWrong()

    expect(await screen.findByText(/已经很棒了/)).toBeInTheDocument()
    // 前面任务已保留;BOSS 本身不写任何词进度
    expect(fakes.saveStep).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: '回地图' })).toBeInTheDocument()
  })
})

/** 造成一次 BOSS 双错(boss-wrong):选错两次 + 点「下一题」放行。 */
function bossWrong() {
  answer('月亮')
  answer('月亮')
  fireEvent.click(screen.getByRole('button', { name: '下一题' }))
}
