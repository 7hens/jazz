import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { AchievementState } from '@/shared/services'
import { ACHIEVEMENTS, checkAchievements, createAchievementService } from './achievements'

const BASE: AchievementState = {
  totalLevels: 37,
  completedLevels: 0,
  perfectLevels: 0,
  perfectUnits: 0,
  maxCombo: 0,
  firstCompleteToday: 0,
  consecutiveDays: 0,
  hour: 12,
}

describe('成就集', () => {
  it('无重复 id', () => {
    const ids = new Set(ACHIEVEMENTS.map((a) => a.id))
    expect(ids.size).toBe(ACHIEVEMENTS.length)
  })
  it('不依赖绘画/复习字段(裁剪验证)', () => {
    const names = ACHIEVEMENTS.map((a) => a.id)
    expect(names).not.toContain('painter_10')
  })
  it('早晚与连续天数口径', () => {
    expect(checkAchievements({ ...BASE, hour: 9 }, []).map((a) => a.id)).toContain('early_bird')
    expect(checkAchievements({ ...BASE, hour: 10 }, []).map((a) => a.id)).not.toContain('early_bird')
    expect(checkAchievements({ ...BASE, hour: 21 }, []).map((a) => a.id)).toContain('night_owl')
    expect(checkAchievements({ ...BASE, hour: 20 }, []).map((a) => a.id)).not.toContain('night_owl')
    expect(checkAchievements({ ...BASE, consecutiveDays: 7 }, []).map((a) => a.id)).toContain('dedicated')
    expect(checkAchievements({ ...BASE, consecutiveDays: 6 }, []).map((a) => a.id)).not.toContain('dedicated')
  })
})

describe('成就目录 · 换锚到关卡', () => {
  it('目录里没有一条依赖词库口径(词数 / 分类)', () => {
    const source = readFileSync(join(process.cwd(), 'src/features/achievements/achievements.ts'), 'utf8')
    for (const banned of ['completedWords', 'totalWords', 'categoryDone', 'perfectWords']) {
      expect(source, `成就目录还在引用词课字段 ${banned}`).not.toContain(banned)
    }
  })

  it('零错一关解锁「完美主义」', () => {
    expect(checkAchievements({ ...BASE, perfectLevels: 1 }, []).map((a) => a.id)).toContain('perfect_level')
    expect(checkAchievements({ ...BASE, perfectLevels: 0 }, []).map((a) => a.id)).not.toContain('perfect_level')
  })

  it('连击 15 仍然原样可解锁', () => {
    expect(checkAchievements({ ...BASE, maxCombo: 15 }, []).map((a) => a.id)).toContain('combo_15')
    expect(checkAchievements({ ...BASE, maxCombo: 14 }, []).map((a) => a.id)).not.toContain('combo_15')
  })

  it('一次会话首通 5 关解锁「马拉松」', () => {
    expect(checkAchievements({ ...BASE, firstCompleteToday: 5 }, []).map((a) => a.id)).toContain('marathon')
    expect(checkAchievements({ ...BASE, firstCompleteToday: 4 }, []).map((a) => a.id)).not.toContain('marathon')
  })

  it('一个单元全三星解锁「收集者」', () => {
    expect(checkAchievements({ ...BASE, perfectUnits: 1 }, []).map((a) => a.id)).toContain('collector')
    // 零单元全三星不该白送 —— 与大法师的 36/37 边界同形。
    expect(checkAchievements({ ...BASE, perfectUnits: 0 }, []).map((a) => a.id)).not.toContain('collector')
  })

  it('全部关卡通关解锁「大法师」', () => {
    expect(checkAchievements({ ...BASE, completedLevels: 37 }, []).map((a) => a.id)).toContain('grand_master')
    expect(checkAchievements({ ...BASE, completedLevels: 36 }, []).map((a) => a.id)).not.toContain('grand_master')
  })

  it('已领过的不重发', () => {
    expect(checkAchievements({ ...BASE, perfectLevels: 1 }, ['perfect_level'])).toEqual([])
  })
})

describe('成就服务', () => {
  it('scan 单调:同 earned 集不重发', () => {
    const svc = createAchievementService()
    const state: AchievementState = { ...BASE, completedLevels: 37, perfectLevels: 1 }
    const first = svc.scan(state, [])
    expect(first.length).toBeGreaterThan(0)
    expect(svc.scan(state, first.map((a) => a.id))).toHaveLength(0)
  })
})
