import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registry } from '@/shared/services/core'
import {
  ChapterService,
  ProgressService,
  SettingsService,
  VocabularyService,
  type ProgressData,
  type UserSettings,
} from '@/shared/services'
import { createVocabularyService } from '@/features/vocabulary'
import { QianziguEntry } from './QianziguEntry'

const settings: UserSettings = {
  enableChinese: true,
  enableEnglish: true,
  earnedAchievements: [],
  consecutiveDays: 0,
  lastActiveDate: '',
  updatedAt: '2026-09-05T00:00:00.000Z',
}

function makeStore<T>(initial: T) {
  let snapshot = initial
  return {
    getSnapshot: () => snapshot,
    subscribe: () => () => undefined,
    publish(next: T) { snapshot = next },
  }
}

function registerServices(progressData: ProgressData = {}) {
  const progressStore = makeStore({ status: 'ready', data: progressData } as const)
  const progress: ProgressService = {
    getSnapshot: progressStore.getSnapshot,
    subscribe: progressStore.subscribe,
    load: vi.fn(async () => undefined),
    seed: vi.fn(),
    saveStep: vi.fn(async () => undefined),
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
  const chapterStore = makeStore({ status: 'ready', data: { row: null } } as const)
  const chapterService: ChapterService = {
    getSnapshot: chapterStore.getSnapshot,
    subscribe: chapterStore.subscribe,
    load: vi.fn(async () => undefined),
    save: vi.fn(async () => undefined),
    clear: vi.fn(async () => undefined),
  }

  registry.register(ProgressService, progress)
  registry.register(SettingsService, settingsService)
  registry.register(ChapterService, chapterService)
  registry.register(VocabularyService, createVocabularyService())
  return { progress, settingsService, chapterService, chapterStore }
}

beforeEach(() => registry.clear())

describe('QianziguEntry 千字谷章节地图', () => {
  it('渲染 ch1 词名与「第1章」,并铺出锁定章占位', () => {
    registerServices()
    render(<QianziguEntry onBack={vi.fn()} onEnterChapter={vi.fn()} />)

    expect(screen.getByText('第1章 · 徐爷爷忘掉的名字')).toBeInTheDocument()
    for (const label of ['房子', '门', '钥匙', '窗户', '台灯']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(screen.getAllByText(/第\d+章/).length).toBeGreaterThan(1)
  })

  it('点 ch1「开始」→ onEnterChapter(1)', () => {
    registerServices()
    const onEnterChapter = vi.fn()
    render(<QianziguEntry onBack={vi.fn()} onEnterChapter={onEnterChapter} />)

    fireEvent.click(screen.getByRole('button', { name: /开始/ }))

    expect(onEnterChapter).toHaveBeenCalledWith(1)
  })

  it('锁定章不可点:仅有 ch1 一颗「开始」按钮', () => {
    registerServices()
    const onEnterChapter = vi.fn()
    render(<QianziguEntry onBack={vi.fn()} onEnterChapter={onEnterChapter} />)

    expect(screen.getAllByRole('button', { name: /开始/ })).toHaveLength(1)
  })

  it('ch1 五词 pinyin+hanzi 全过 → 显示「已学会」完成态', () => {
    const done: ProgressData = {}
    for (const wordId of [13, 7, 14, 8, 19]) {
      done[wordId] = {
        wordId,
        completed: { pinyin: true, hanzi: true, english: false },
        starsEarned: 60,
        updatedAt: '2026-09-08T00:00:00.000Z',
      }
    }
    registerServices(done)
    render(<QianziguEntry onBack={vi.fn()} onEnterChapter={vi.fn()} />)

    expect(screen.getByText(/已学会/)).toBeInTheDocument()
  })

  it('返回按钮触发 onBack', () => {
    registerServices()
    const onBack = vi.fn()
    render(<QianziguEntry onBack={onBack} onEnterChapter={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: '返回世界' }))

    expect(onBack).toHaveBeenCalled()
  })
})
