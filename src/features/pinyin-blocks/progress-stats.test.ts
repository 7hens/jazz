import { describe, expect, it } from 'vitest'
import type { LevelStars } from '@/shared/services'
import { UNITS, type Unit } from './levels'
import {
  completedLevelCount,
  perfectLevelCount,
  perfectUnitCount,
  totalLevelCount,
  unitClearedCount,
  unitTotal,
  unitUnlockedByPath,
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
  it('u1 恒解锁,后面的要前一单元的节全走完', () => {
    expect(unitUnlockedByPath({}, 'u1')).toBe(true)
    expect(unitUnlockedByPath({}, 'u2')).toBe(false)
    expect(unitUnlockedByPath(clearUnit(0, 3), 'u2')).toBe(true)
    // 一星也算通关 —— 「过了」不等同于「打好了」,不能拿三星当前置门槛
    expect(unitUnlockedByPath(clearUnit(0, 1), 'u2')).toBe(true)
  })

  // 解锁口径是「前一单元的**全部节**都通过」—— 困难节也参与,所以漏任何一题都不解锁。
  it('前一单元漏一题就不解锁下一单元', () => {
    const partial = clearUnit(0, 3)
    delete partial[firstUnit.levels.at(-1)!.id]
    expect(unitUnlockedByPath(partial, 'u2')).toBe(false)
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

  it('unitTotal / unitClearedCount 是路径上那一簇的进度数字', () => {
    expect(unitTotal(synth)).toBe(5)
    expect(unitClearedCount(star(['ux-0', 'ux-0h']), synth)).toBe(2)
    expect(unitClearedCount({}, synth)).toBe(0)
  })
})

/** 合成单元:3 道简单题 + 2 道困难题 —— 不依赖真实数据恰好长什么样。 */
const synth: Unit = {
  id: 'ux',
  name: '合成',
  badge: [],
  levels: [
    { id: 'ux-0', emoji: '🅰️', pinyin: 'ā', read: '啊', syl: [{ final: 'a', tone: 1 }] },
    { id: 'ux-1', emoji: '🅱️', pinyin: 'ō', read: '噢', syl: [{ final: 'o', tone: 1 }] },
    { id: 'ux-2', emoji: '🆎', pinyin: 'ē', read: '诶', syl: [{ final: 'e', tone: 1 }] },
    { id: 'ux-0h', emoji: '🔺', pinyin: 'á', read: '啊', syl: [{ final: 'a', tone: 2 }], stage: 'hard' },
    { id: 'ux-1h', emoji: '🔻', pinyin: 'ó', read: '哦', syl: [{ final: 'o', tone: 2 }], stage: 'hard' },
  ],
}

const star = (ids: readonly string[]): LevelStars => Object.fromEntries(ids.map((id) => [id, 1]))
