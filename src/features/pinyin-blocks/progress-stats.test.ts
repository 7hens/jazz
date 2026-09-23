import { describe, expect, it } from 'vitest'
import { UNITS } from './levels'
import {
  completedLevelCount,
  isUnitUnlocked,
  perfectLevelCount,
  perfectUnitCount,
  totalLevelCount,
} from './progress-stats'

const firstUnit = UNITS[0]!
const secondUnit = UNITS[1]!

/** 把某个单元的所有关都打到指定星数。 */
function clearUnit(unitIndex: number, stars: number, base: Record<string, number> = {}) {
  const out = { ...base }
  for (const level of UNITS[unitIndex]!.levels) out[level.id] = stars
  return out
}

describe('拼音进度统计', () => {
  it('u1 恒解锁,后面的要前一单元全通关', () => {
    expect(isUnitUnlocked(0, {})).toBe(true)
    expect(isUnitUnlocked(1, {})).toBe(false)
    expect(isUnitUnlocked(1, clearUnit(0, 3))).toBe(true)
    // 一星也算通关 —— 「过了」不等同于「打好了」,不能拿三星当前置门槛
    expect(isUnitUnlocked(1, clearUnit(0, 1))).toBe(true)
  })

  // 前一单元「全」通关:漏一关就不解锁。
  it('前一单元漏一关就不解锁下一单元', () => {
    const partial = clearUnit(0, 3)
    delete partial[firstUnit.levels[firstUnit.levels.length - 1]!.id]
    expect(isUnitUnlocked(1, partial)).toBe(false)
  })

  it('通关数 / 三星数只数到已通关的关', () => {
    expect(completedLevelCount({})).toBe(0)
    expect(perfectLevelCount({})).toBe(0)
    const stars = { ...clearUnit(0, 3), [secondUnit.levels[0]!.id]: 2 }
    expect(completedLevelCount(stars)).toBe(firstUnit.levels.length + 1)
    expect(perfectLevelCount(stars)).toBe(firstUnit.levels.length)
  })

  // 星数 0 或未出现的 key 都算「没通关」,不能混进计数。
  it('星数 0 视同未通关', () => {
    const id = firstUnit.levels[0]!.id
    expect(completedLevelCount({ [id]: 0 })).toBe(0)
    expect(perfectLevelCount({ [id]: 0 })).toBe(0)
  })

  it('全三星的单元才算完美单元', () => {
    expect(perfectUnitCount(clearUnit(0, 2))).toBe(0)
    expect(perfectUnitCount(clearUnit(0, 3))).toBe(1)
    expect(perfectUnitCount({ ...clearUnit(0, 3), ...clearUnit(1, 3) })).toBe(2)
  })

  it('总关卡数与 UNITS 展平后一致', () => {
    expect(totalLevelCount()).toBe(UNITS.reduce((sum, u) => sum + u.levels.length, 0))
  })
})
