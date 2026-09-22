import { describe, expect, it, vi } from 'vitest'
import type { UserSettings, WordProgress, WordUnit } from '@/shared/services'
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
  sentenceLevel: 0,
  bonusGranted: true,
  starsEarned: 110,
  updatedAt: '2026-09-04T00:00:00.000Z',
}

const settings: UserSettings = {
  enableChinese: true,
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
    const roll = vi.fn(() => {
      events.push('lucky')
      return 50
    })
    const enqueue = vi.fn(() => events.push('overlay'))
    const services: SettlementServices = {
      lucky: { roll },
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

    // 成就扫描已短路(旧词课口径无来源),事件流里不再有 'achievement'。
    expect(events).toEqual(['lucky', 'progress:start', 'settings:start'])
    expect(navigationAvailable).toBe(false)

    finishProgress()
    await Promise.resolve()
    expect(navigationAvailable).toBe(false)
    expect(events).not.toContain('overlay')

    finishSettings()
    const result = await settling

    expect(events).toEqual([
      'lucky',
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
      extraReward: 56,
      luckyReward: 50,
      session: { firstCompleteToday: 1, perfectWords: 1 },
    })
    expect(result.progress[1]).toMatchObject({ starsEarned: 166 })
    expect(result.settings).toMatchObject({
      earnedAchievements: [],
      consecutiveDays: 1,
      lastActiveDate: '2026-09-05',
    })
    expect(roll).toHaveBeenCalledOnce()
    expect(enqueue).toHaveBeenCalledOnce()
    expect(enqueue).toHaveBeenCalledWith([], 50)
  })

  it('keeps combo and lucky rewards gated to a newly completed word', async () => {
    const roll = vi.fn(() => 50)
    const saveStep = vi.fn(async () => undefined)
    const saveSettings = vi.fn(async () => undefined)
    const enqueue = vi.fn()
    const services: SettlementServices = {
      lucky: { roll },
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
    expect(result).toMatchObject({
      newlyComplete: false,
      extraReward: 0,
      luckyReward: 0,
      session: { firstCompleteToday: 2, perfectWords: 5 },
    })
    expect(enqueue).toHaveBeenCalledOnce()
  })
})
