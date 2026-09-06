import { describe, expect, it } from 'vitest'
import type { BasicsProgressData } from '@/shared/services'
import { applyCorrect, applyWrong, emptyUnit, needFor, toRow, withTaught } from './estimator'

describe('estimator', () => {
  it('correct: streak 累积,2 连对升 known,known 保持', () => {
    expect(applyCorrect(emptyUnit())).toEqual({ state: 'learning', correctStreak: 1, taughtCount: 0 })
    const once = applyCorrect(emptyUnit())
    expect(applyCorrect(once)).toEqual({ state: 'known', correctStreak: 2, taughtCount: 0 })
    const known = { state: 'known' as const, correctStreak: 2, taughtCount: 1 }
    expect(applyCorrect(known)).toEqual({ state: 'known', correctStreak: 3, taughtCount: 1 })
  })

  it('wrong: 回落 learning 且清零,known 也降', () => {
    const known = { state: 'known' as const, correctStreak: 2, taughtCount: 1 }
    expect(applyWrong(known)).toEqual({ state: 'learning', correctStreak: 0, taughtCount: 1 })
  })

  it('taught: taughtCount +1,其余不变', () => {
    expect(withTaught(emptyUnit())).toEqual({ state: 'learning', correctStreak: 0, taughtCount: 1 })
  })

  it('toRow 补 updatedAt', () => {
    const row = toRow('pinyin:p', emptyUnit())
    expect(row.unitKey).toBe('pinyin:p')
    expect(typeof row.updatedAt).toBe('string')
    expect(new Date(row.updatedAt).getTime()).not.toBeNaN()
  })

  it('needFor: 无单元 → none', () => {
    expect(needFor([], {})).toBe('none')
  })

  it('needFor: 未教 learning → mandatory', () => {
    const models: BasicsProgressData = { 'pinyin:p': toRow('pinyin:p', { state: 'learning', correctStreak: 0, taughtCount: 0 }) }
    expect(needFor(['pinyin:p'], models)).toBe('mandatory')
  })

  it('needFor: 缺失单元按未教 learning 处理 → mandatory', () => {
    expect(needFor(['pinyin:ing'], {})).toBe('mandatory')
  })

  it('needFor: 教过仍 learning → soft', () => {
    const models: BasicsProgressData = { 'pinyin:p': toRow('pinyin:p', { state: 'learning', correctStreak: 1, taughtCount: 1 }) }
    expect(needFor(['pinyin:p'], models)).toBe('soft')
  })

  it('needFor: 任一 mandatory 压过 soft', () => {
    const models: BasicsProgressData = {
      'pinyin:p': toRow('pinyin:p', { state: 'learning', correctStreak: 0, taughtCount: 1 }), // soft
      'pinyin:ing': toRow('pinyin:ing', { state: 'learning', correctStreak: 0, taughtCount: 0 }), // mandatory
    }
    expect(needFor(['pinyin:p', 'pinyin:ing'], models)).toBe('mandatory')
  })

  it('needFor: 全 known → none', () => {
    const models: BasicsProgressData = {
      'pinyin:p': toRow('pinyin:p', { state: 'known', correctStreak: 2, taughtCount: 1 }),
      'pinyin:ing': toRow('pinyin:ing', { state: 'known', correctStreak: 3, taughtCount: 1 }),
    }
    expect(needFor(['pinyin:p', 'pinyin:ing'], models)).toBe('none')
  })
})
