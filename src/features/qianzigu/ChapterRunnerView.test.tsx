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
import { CHAPTER_1 } from './ch1'
import { ChapterRunnerView, type ChapterRunnerServices } from './ChapterRunnerView'
import { resolveDebugRow } from './debug-jump'

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

function socialChapter(): Chapter {
  return {
    id: 1,
    title: '太阳的求救',
    subtitle: '社交测试',
    emoji: '🌅',
    wordIds: [1],
    restoreOrder: [1],
    scenes: [
      {
        id: 'soc',
        kind: 'social',
        lines: [{ role: 'moon', text: '好孤单...' }],
        options: [
          { id: 'a', text: '你哭起来真难看。', emoji: '😠', consequence: 'bad', response: '月亮哭得更伤心了...' },
          { id: 'b', text: '我也喜欢你!', emoji: '💕', consequence: 'good', response: '月亮笑了!' },
        ],
        goodOptionId: 'b',
        loop: [{ role: 'lingling', text: '月亮更难过了...我们想想怎么安慰它?' }],
        onGood: [{ role: 'moon', text: '真的吗?谢谢你!' }],
      },
      { id: 'after', kind: 'dialogue', lines: [{ role: 'lingling', text: '继续前进!' }] },
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
  it('debug 直达 ?s=1.1.16:伪 initialRow 快进落在 boss 幕(不回头卡在开场)', async () => {
    const row = resolveDebugRow(CHAPTER_1, '1.1.16')
    expect(row).not.toBeNull()
    renderRunner(CHAPTER_1, row)
    // boss intro 首句整屏对白出现 = resumeFromRow 已穿场快进(open/t1..t5 全跳过)
    expect(await screen.findByText('你们...居然唤醒了太阳...')).toBeInTheDocument()
    expect(screen.queryByText(/欢迎来到千字谷/)).not.toBeInTheDocument()
  })

  it('dialogue 屏渲染为舞台屏:cast 站队 + 台词泡;点继续推进到下一屏', async () => {
    renderRunner(flowChapter())
    expect(await screen.findByText('你好,太阳!')).toBeInTheDocument()
    // 整屏舞台帧:dialogue 屏真的挂在 StageFrame/StageSky 上(旧 Shell 标题头已删)
    expect(document.querySelector('.stage-sky')).not.toBeNull()
    expect(screen.getByText('灵灵')).toBeInTheDocument() // 名字牌(cast 推导)
    fireEvent.click(screen.getByRole('button', { name: '继续' }))
    expect(await screen.findByText('拯救声音')).toBeInTheDocument() // task 屏(旧 UI 过渡)
  })

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

  it('task 屏整屏舞台化:氛围=scene.stage.atmosphere;答对后布景太阳随进度复原', async () => {
    const chapter: Chapter = {
      ...flowChapter(),
      scenes: [
        {
          id: 't1', kind: 'task', title: '拯救声音', intro: [],
          task: { wordId: 1, layer: 'sound', minCorrect: 2 }, onDone: [],
          stage: { atmosphere: 'dusk' as const, cast: ['lingling'] },
        },
        { id: 'settle', kind: 'settle', summary: [] },
      ],
    }
    renderRunner(chapter)
    // 场景 0 = task → 已走统一舞台壳,天空氛围 class 出现(dusk ≠ task 默认 dawn → 证明 override)
    expect(document.querySelector('.stage-sky--dusk')).not.toBeNull()
    // 词点灯条退役:布景层不再渲染任何 .stage-word
    expect(document.querySelector('.stage-word')).toBeNull()
    // 进度 0 → 太阳位 = 烧焦蛋档(非 dusk 真夜,太阳仍挂天幕)
    expect(document.querySelector('.stage-sun--burnt')).not.toBeNull()
    answer('太阳') // 现有 helper:点选项 → 确定
    answer('太阳')
    // 引擎仅记一层恢复(task 场景 1 层)→ fraction=restored/总层=1 → 太阳复原到 full 档
    expect(document.querySelector('.stage-sun--full')).not.toBeNull()
  })

  it('task 屏:先整屏台词演出 intro,点继续才出题', async () => {
    const chapter: Chapter = {
      ...flowChapter(),
      scenes: [
        {
          id: 't1', kind: 'task', title: '拯救声音',
          intro: [{ role: 'lingling', text: '听!这是太阳的声音…' }],
          task: { wordId: 1, layer: 'sound', minCorrect: 2 }, onDone: [],
        },
        { id: 'settle', kind: 'settle', summary: [] },
      ],
    }
    renderRunner(chapter)
    expect(screen.getByText('听!这是太阳的声音…')).toBeInTheDocument()
    // 整屏舞台判别:DialoguePresenter/StageCast 才渲染角色旁泡(data-stage-bubble);旧卡片 LineScene 无此物
    expect(document.querySelector('[data-stage-bubble]')).not.toBeNull()
    expect(screen.queryByText('选出太阳的拼音')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '继续' }))
    expect(await screen.findByText('选出太阳的拼音')).toBeInTheDocument()
  })

  it('task onDone 台词整屏对白,点继续进结算', async () => {
    const chapter: Chapter = {
      ...flowChapter(),
      scenes: [
        { id: 't1', kind: 'task', title: '拯救声音', intro: [], task: { wordId: 1, layer: 'sound', minCorrect: 2 },
          onDone: [{ role: 'lingling', text: '太棒了!' }] },
        { id: 'settle', kind: 'settle', summary: [] },
      ],
    }
    renderRunner(chapter)
    answer('太阳')
    answer('太阳')
    expect(await screen.findByText('太棒了!')).toBeInTheDocument()
    // onDone 收尾也是整屏 DialoguePresenter(角色旁泡 data-stage-bubble),非旧卡片 LineScene
    expect(document.querySelector('[data-stage-bubble]')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '继续' }))
    expect(await screen.findByText('第1章完成!')).toBeInTheDocument()
  })

  it('BOSS 错满 → 勇气台词逐句出现、末句「回地图」;不再写后续词进度', async () => {
    const fakes = renderRunner(bossChapter())

    // 先完成词 1 pinyin(saveStep 1 次)
    answer('太阳')
    answer('太阳')

    // BOSS:intro 空 → 直接出题;连错满 maxWrong(2)
    expect(screen.getByText('BOSS · 静默')).toBeInTheDocument()

    bossWrong()
    bossWrong()

    // BOSS 失败走整屏对白:首句勇气台词即现;逐句推进后末句 doneLabel=「回地图」
    expect(await screen.findByText(/已经很棒了/)).toBeInTheDocument()
    // 前面任务已保留;BOSS 本身不写任何词进度
    expect(fakes.saveStep).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: '继续' }))
    expect(screen.getByText(/我们先回去休息/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '回地图' })).toBeInTheDocument()
  })

  it('boss:静默 intro 整屏登台对白 → 点继续出题卡 → 全对播 win 收尾 → 进入下一屏', async () => {
    const chapter: Chapter = {
      ...bossChapter(),
      scenes: [
        {
          id: 'boss', kind: 'boss',
          intro: [{ role: 'jingmo', text: '我是静默!' }],
          maxWrong: 2,
          questionCount: 1,
          win: [{ role: 'jingmo', text: '不可能...!' }],
          lose: [{ role: 'lingling', text: '下次再来!' }],
        },
        { id: 'end', kind: 'dialogue', lines: [{ role: 'lingling', text: '继续前进!' }] },
      ],
    }
    renderRunner(chapter)
    // intro 是整屏舞台对白:仅 DialoguePresenter/StageCast 渲染角色旁泡(data-stage-bubble),
    // 旧卡片 LineScene 无此物 → 判别真实舞台化(boss intro 行角色=静默,非 narrator → 泡渲染)。
    expect(await screen.findByText('我是静默!')).toBeInTheDocument()
    expect(document.querySelector('[data-stage-bubble]')).not.toBeNull()
    expect(screen.queryByText('BOSS · 静默')).not.toBeInTheDocument() // 题卡尚未浮出
    fireEvent.click(screen.getByRole('button', { name: '继续' }))
    // 放行后交浮层:BOSS 题卡徽章 + 出题
    expect(await screen.findByText('BOSS · 静默')).toBeInTheDocument()
    expect(screen.getByText('选出太阳的拼音')).toBeInTheDocument()
    answer('太阳') // questionCount:1 → 一次全对即 bossWon
    // win overlay:整屏对白(非卡)
    expect(await screen.findByText('不可能...!')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '继续' }))
    expect(await screen.findByText('继续前进!')).toBeInTheDocument()
  })
})

/** 造成一次 BOSS 双错(boss-wrong):选错两次 + 点「下一题」放行。 */
function bossWrong() {
  answer('月亮')
  answer('月亮')
  fireEvent.click(screen.getByRole('button', { name: '下一题' }))
}

describe('ChapterRunnerView 社交选项两段式(先听后选)', () => {
  function openOptions() {
    // 社交 intro 一句 → 点继续进入选项区
    expect(screen.getByText('好孤单...')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '继续' }))
  }

  it('非 good:首点仅朗读选项文本(lingling),不触发后果;再点确认 → 后果反馈停留可再选', async () => {
    const fakes = renderRunner(socialChapter())
    openOptions()

    const bad = /你哭起来真难看。/
    fireEvent.click(screen.getByRole('button', { name: bad }))

    // 首点:朗读选项文本(灵灵),未确认 → 无后果 / 未推进
    expect(fakes.speech.speakRole).toHaveBeenCalledWith('你哭起来真难看。', 'lingling')
    expect(screen.queryByText('月亮哭得更伤心了...')).not.toBeInTheDocument()
    expect(screen.queryByText('继续前进!')).not.toBeInTheDocument()

    // 再点同一项:确认 → consequence feedback 出现,仍停留(选项可重选、未推进)
    fireEvent.click(screen.getByRole('button', { name: bad }))
    expect(screen.getByText('月亮哭得更伤心了...')).toBeInTheDocument()
    expect(screen.getByText('月亮更难过了...我们想想怎么安慰它?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: bad })).toBeInTheDocument()
    expect(screen.queryByText('继续前进!')).not.toBeInTheDocument()
  })

  it('good:首点仅朗读;再点确认 → onGood 收尾台词,走完放行推进下一 scene', async () => {
    const fakes = renderRunner(socialChapter())
    openOptions()

    const good = /我也喜欢你!/
    fireEvent.click(screen.getByRole('button', { name: good }))

    // 首点仅朗读,未放行 onGood / 未推进
    expect(fakes.speech.speakRole).toHaveBeenCalledWith('我也喜欢你!', 'lingling')
    expect(screen.queryByText('真的吗?谢谢你!')).not.toBeInTheDocument()
    expect(screen.queryByText('继续前进!')).not.toBeInTheDocument()

    // 再点确认 → onGood 收尾台词(overlay)
    fireEvent.click(screen.getByRole('button', { name: good }))
    expect(screen.getByText('真的吗?谢谢你!')).toBeInTheDocument()

    // 走完收尾 → social-choose 放行 → 推进到下一 scene
    fireEvent.click(screen.getByRole('button', { name: '继续' }))
    expect(await screen.findByText('继续前进!')).toBeInTheDocument()
  })

  it('social:哭诉首幕整屏对白 → 点继续出选项 → 两段确认 good → 播 onGood 收尾 → advance', async () => {
    renderRunner(socialChapter())
    // 首幕(lines)是整屏 DialoguePresenter(角色旁泡 data-stage-bubble),非旧卡片 intro
    expect(await screen.findByText('好孤单...')).toBeInTheDocument()
    expect(document.querySelector('[data-stage-bubble]')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '继续' }))
    expect(await screen.findByText('你想怎么做?')).toBeInTheDocument()
    const good = /我也喜欢你!/
    fireEvent.click(screen.getByRole('button', { name: good })) // 首点=朗读/待确认
    fireEvent.click(screen.getByRole('button', { name: good })) // 再点=确认 good
    // onGood 收尾也是整屏 DialoguePresenter(角色旁泡),走完才 advance
    expect(await screen.findByText('真的吗?谢谢你!')).toBeInTheDocument()
    expect(document.querySelector('[data-stage-bubble]')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '继续' }))
    expect(await screen.findByText('继续前进!')).toBeInTheDocument() // 下一 dialogue
  })
})
