import { describe, expect, it } from 'vitest'
import { ACHIEVEMENTS, checkAchievements, type AchievementState } from './achievements'

const base = (): AchievementState => ({
  completedWords: 0, categoryDone: 0, maxCombo: 0, firstCompleteToday: 0,
  perfectWords: 0, consecutiveDays: 0, hour: 12, totalWords: 100,
})

describe('成就集', () => {
  it('无重复 id', () => {
    const ids = new Set(ACHIEVEMENTS.map((a) => a.id))
    expect(ids.size).toBe(ACHIEVEMENTS.length)
  })
  it('不依赖绘画/复习字段(裁剪验证)', () => {
    const names = ACHIEVEMENTS.map((a) => a.id)
    expect(names).not.toContain('painter_10')
  })
  it('checkAchievements:新达成的发出,已达成不重发', () => {
    const s: AchievementState = { ...base(), completedWords: 100, perfectWords: 1 }
    const got = checkAchievements(s, [])
    expect(got.map((a) => a.id)).toContain('grand_master')
    expect(got.map((a) => a.id)).toContain('perfect_word')
    expect(checkAchievements(s, got.map((a) => a.id))).toHaveLength(0)
  })
  it('各成就触发口径', () => {
    const hour = (h: number): AchievementState => ({ ...base(), hour: h })
    expect(checkAchievements(hour(8), []).map((a) => a.id)).toContain('early_bird')
    expect(checkAchievements(hour(22), []).map((a) => a.id)).toContain('night_owl')
    expect(checkAchievements({ ...base(), maxCombo: 15 }, []).map((a) => a.id)).toContain('combo_15')
    expect(checkAchievements({ ...base(), firstCompleteToday: 5 }, []).map((a) => a.id)).toContain('marathon')
    expect(checkAchievements({ ...base(), categoryDone: 1 }, []).map((a) => a.id)).toContain('collector')
    expect(checkAchievements({ ...base(), consecutiveDays: 7 }, []).map((a) => a.id)).toContain('dedicated')
    expect(checkAchievements({ ...base(), completedWords: 50 }, []).map((a) => a.id)).not.toContain('grand_master')
  })
})
