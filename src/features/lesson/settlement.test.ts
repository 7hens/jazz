import { describe, expect, it, vi } from 'vitest'
import type { UserSettings, WordProgress, WordUnit } from '@/shared/types'
import { coordinateSettlement, type SettlementServices } from './settlement'

const word: WordUnit = {
  id: 1,
  emoji: '☀️',
  pinyin: 'tài yáng',
  hanzi: '太阳',
  english: 'sun',
  category: 'nature',
}

const completeProgress: WordProgress = {
  wordId: 1,
  completed: { pinyin: true, hanzi: true, english: true },
  starsEarned: 110,
  updatedAt: '2026-09-04T00:00:00.000Z',
}

const settings: UserSettings = {
  enablePinyin: true,
  enableHanzi: true,
  enableEnglish: true,
  earnedAchievements: [],
  consecutiveDays: 0,
  lastActiveDate: '',
  updatedAt: '2026-09-04T00:00:00.000Z',
}

describe('coordinateSettlement', () => {
  it('orders reward rules and persistence before overlays and navigation', async () => {
    const events: string[] = []
    let finishProgress!: () => void
    let finishSettings!: () => void
    const achievement = {
      id: 'first',
      name: 'First',
      description: 'First word',
      emoji: '✨',
      reward: 20,
    }
    const roll = vi.fn(() => {
      events.push('lucky')
      return 50
    })
    const scan = vi.fn((state) => {
      events.push('achievement')
      expect(state).toEqual({
        completedWords: 1,
        categoryDone: 1,
        maxCombo: 8,
        firstCompleteToday: 1,
        perfectWords: 1,
        consecutiveDays: 1,
        hour: 9,
        totalWords: 1,
      })
      return [achievement]
    })
    const enqueue = vi.fn(() => events.push('overlay'))
    const services: SettlementServices<typeof achievement> = {
      lucky: { roll },
      achievements: { scan },
      progress: {
        saveStep: vi.fn(() => {
          events.push('progress:start')
          return new Promise<void>(resolve => {
            finishProgress = () => {
              events.push('progress:finish')
              resolve()
            }
          })
        }),
      },
      settings: {
        save: vi.fn(() => {
          events.push('settings:start')
          return new Promise<void>(resolve => {
            finishSettings = () => {
              events.push('settings:finish')
              resolve()
            }
          })
        }),
      },
      overlays: { enqueue },
    }

    let navigationAvailable = false
    const settling = coordinateSettlement({
      word,
      words: [word],
      progress: { 1: completeProgress },
      settings,
      eligible: true,
      perfect: true,
      stepReward: 90,
      wordBonus: 20,
      comboReward: 6,
      maxCombo: 8,
      session: { firstCompleteToday: 0, perfectWords: 0 },
      now: () => new Date(2026, 8, 5, 9, 0, 0),
      rng: () => 0.05,
    }, services).then(result => {
      navigationAvailable = true
      return result
    })

    expect(events).toEqual(['lucky', 'achievement', 'progress:start', 'settings:start'])
    expect(navigationAvailable).toBe(false)

    finishProgress()
    await Promise.resolve()
    expect(navigationAvailable).toBe(false)
    expect(events).not.toContain('overlay')

    finishSettings()
    const result = await settling

    expect(events).toEqual([
      'lucky',
      'achievement',
      'progress:start',
      'settings:start',
      'progress:finish',
      'settings:finish',
      'overlay',
    ])
    expect(navigationAvailable).toBe(true)
    expect(result).toMatchObject({
      newlyComplete: true,
      stepReward: 90,
      wordBonus: 20,
      extraReward: 76,
      luckyReward: 50,
      session: { firstCompleteToday: 1, perfectWords: 1 },
    })
    expect(result.progress[1]).toMatchObject({ starsEarned: 186 })
    expect(result.settings).toMatchObject({
      earnedAchievements: ['first'],
      consecutiveDays: 1,
      lastActiveDate: '2026-09-05',
    })
    expect(roll).toHaveBeenCalledOnce()
    expect(scan).toHaveBeenCalledOnce()
    expect(enqueue).toHaveBeenCalledOnce()
  })

  it('keeps combo and lucky rewards gated to a newly completed word', async () => {
    const roll = vi.fn(() => 50)
    const saveStep = vi.fn(async () => undefined)
    const saveSettings = vi.fn(async () => undefined)
    const enqueue = vi.fn()
    const scan = vi.fn(() => [])
    const services: SettlementServices = {
      lucky: { roll },
      achievements: { scan },
      progress: { saveStep },
      settings: { save: saveSettings },
      overlays: { enqueue },
    }

    const result = await coordinateSettlement({
      word,
      words: [word],
      progress: { 1: completeProgress },
      settings: { ...settings, consecutiveDays: 3, lastActiveDate: '2026-09-05' },
      eligible: false,
      perfect: true,
      stepReward: 0,
      wordBonus: 0,
      comboReward: 99,
      maxCombo: 12,
      session: { firstCompleteToday: 2, perfectWords: 4 },
      now: () => new Date(2026, 8, 5, 12, 0, 0),
    }, services)

    expect(roll).not.toHaveBeenCalled()
    expect(saveStep).not.toHaveBeenCalled()
    expect(saveSettings).not.toHaveBeenCalled()
    expect(scan).toHaveBeenCalledOnce()
    expect(result).toMatchObject({
      newlyComplete: false,
      extraReward: 0,
      luckyReward: 0,
      session: { firstCompleteToday: 2, perfectWords: 5 },
    })
    expect(enqueue).toHaveBeenCalledOnce()
  })

  it('still grants a newly scanned achievement when relearning a completed word', async () => {
    const achievement = {
      id: 'night-owl',
      name: 'Night owl',
      description: 'Learn at night',
      emoji: '🌙',
      reward: 20,
    }
    const roll = vi.fn(() => 50)
    const saveStep = vi.fn(async () => undefined)
    const saveSettings = vi.fn(async () => undefined)
    const enqueue = vi.fn()

    const result = await coordinateSettlement({
      word,
      words: [word],
      progress: { 1: completeProgress },
      settings: { ...settings, consecutiveDays: 3, lastActiveDate: '2026-09-05' },
      eligible: false,
      perfect: false,
      stepReward: 0,
      wordBonus: 0,
      comboReward: 99,
      maxCombo: 12,
      session: { firstCompleteToday: 2, perfectWords: 4 },
      now: () => new Date(2026, 8, 5, 23, 0, 0),
    }, {
      lucky: { roll },
      achievements: { scan: vi.fn(() => [achievement]) },
      progress: { saveStep },
      settings: { save: saveSettings },
      overlays: { enqueue },
    })

    expect(roll).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      newlyComplete: false,
      extraReward: 20,
      luckyReward: 0,
      session: { firstCompleteToday: 2, perfectWords: 4 },
    })
    expect(result.progress[1]).toMatchObject({ starsEarned: 130 })
    expect(result.settings.earnedAchievements).toEqual(['night-owl'])
    expect(saveStep).toHaveBeenCalledExactlyOnceWith(result.progress[1])
    expect(saveSettings).toHaveBeenCalledExactlyOnceWith(result.settings)
    expect(enqueue).toHaveBeenCalledExactlyOnceWith([achievement], 0)
  })
})
