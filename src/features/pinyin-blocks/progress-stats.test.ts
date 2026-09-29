import { describe, expect, it } from 'vitest'
import type { LevelStars } from '@/shared/services'
import { UNITS, easyLevelsOf, type Level, type Unit } from './levels'
import {
  completedLevelCount,
  firstIncompletePart,
  isUnitUnlocked,
  nextPartOf,
  partCleared,
  partClearedCount,
  partEnterable,
  partLevels,
  partTotal,
  perfectLevelCount,
  perfectUnitCount,
  totalLevelCount,
  unitClearedCount,
  unitTotal,
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
  it('u1 恒解锁,后面的要前一单元简单部分全通', () => {
    expect(isUnitUnlocked(0, {})).toBe(true)
    expect(isUnitUnlocked(1, {})).toBe(false)
    expect(isUnitUnlocked(1, clearUnit(0, 3))).toBe(true)
    // 一星也算通关 —— 「过了」不等同于「打好了」,不能拿三星当前置门槛
    expect(isUnitUnlocked(1, clearUnit(0, 1))).toBe(true)
  })

  // 单元锁的口径是「前一单元**简单部分**全通」—— 困难题不参与,所以漏的必须是简单题。
  it('前一单元简单部分漏一题就不解锁下一单元', () => {
    const partial = clearUnit(0, 3)
    delete partial[easyLevelsOf(firstUnit).at(-1)!.id]
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

/** 合成单元:3 道简单题 + 2 道困难题。用它测部分口径 —— 不依赖真实数据恰好长什么样。 */
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

/** 只有简单题的单元 —— 「空困难部分」那条守卫的载体。 */
const noHard: Unit = { id: 'un', name: '无难', badge: [], levels: synth.levels.slice(0, 3) }

const star = (ids: readonly string[]): LevelStars => Object.fromEntries(ids.map((id) => [id, 1]))

describe('部分级统计', () => {
  it('partLevels 按部分切,复习部分恒空', () => {
    expect(partLevels(synth, 'easy').map((l: Level) => l.id)).toEqual(['ux-0', 'ux-1', 'ux-2'])
    expect(partLevels(synth, 'hard').map((l: Level) => l.id)).toEqual(['ux-0h', 'ux-1h'])
    expect(partLevels(synth, 'review')).toEqual([])
    expect(partTotal(synth, 'easy')).toBe(3)
    expect(partTotal(synth, 'hard')).toBe(2)
    expect(partTotal(synth, 'review')).toBe(0)
    expect(partClearedCount(star(['ux-0', 'ux-1']), synth, 'easy')).toBe(2)
    expect(partClearedCount(star(['ux-0h']), synth, 'hard')).toBe(1)
  })

  it('partCleared 要求该部分每题都 ≥1 星', () => {
    expect(partCleared(star(['ux-0', 'ux-1']), synth, 'easy')).toBe(false)
    expect(partCleared(star(['ux-0', 'ux-1', 'ux-2']), synth, 'easy')).toBe(true)
    // 空部分恒「做完」—— 这是「困难部分还没录入时复习部分仍能解锁」的机制所在(every([]) === true)。
    expect(partCleared({}, noHard, 'hard')).toBe(true)
  })

  it('partEnterable:空部分不进,复习部分恒可进', () => {
    expect(partEnterable(synth, 'easy')).toBe(true)
    expect(partEnterable(synth, 'hard')).toBe(true)
    // 复习部分的题由错题池当场决定,池空也有「照考整题」的兜底 ⇒ 它永远进得去。
    expect(partEnterable(synth, 'review')).toBe(true)
    expect(partEnterable(noHard, 'hard')).toBe(false)
  })

  it('unitTotal / unitClearedCount 是地图那一格上的进度数字', () => {
    expect(unitTotal(synth)).toBe(5)
    expect(unitClearedCount(star(['ux-0', 'ux-0h']), synth)).toBe(2)
    expect(unitClearedCount({}, synth)).toBe(0)
  })
})

describe('单元锁', () => {
  it('单元锁 = 前一单元简单部分全通(困难部分不参与)', () => {
    const units = [synth, noHard]
    expect(isUnitUnlocked(0, {}, units)).toBe(true)
    // 前一单元的简单题只通两道 ⇒ 锁着
    expect(isUnitUnlocked(1, star(['ux-0', 'ux-1']), units)).toBe(false)
    // 简单部分全通 ⇒ 解锁,即使困难部分一道没碰
    expect(isUnitUnlocked(1, star(['ux-0', 'ux-1', 'ux-2']), units)).toBe(true)
  })
})

describe('起点与推进', () => {
  it('firstIncompletePart:第一个还没全通的部分就是起点', () => {
    // 一道没碰 ⇒ 从简单部分起
    expect(firstIncompletePart(synth, {})).toBe('easy')
    // 简单部分只通两道 ⇒ 仍从简单部分起(接着把没通的走完)
    expect(firstIncompletePart(synth, star(['ux-0', 'ux-1']))).toBe('easy')
    // 简单部分全通、困难部分没碰 ⇒ 从困难部分起
    expect(firstIncompletePart(synth, star(['ux-0', 'ux-1', 'ux-2']))).toBe('hard')
    // 困难部分只通一道 ⇒ 仍从困难部分起
    expect(firstIncompletePart(synth, star(['ux-0', 'ux-1', 'ux-2', 'ux-0h']))).toBe('hard')
  })

  it('firstIncompletePart:全通时回到第一部分(整单元重玩)', () => {
    const all = star(['ux-0', 'ux-1', 'ux-2', 'ux-0h', 'ux-1h'])
    // 复习部分恒算已通(它不从课程数据取题),故它永远不是起点 —— 它是流程的终点。
    expect(firstIncompletePart(synth, all)).toBe('easy')
  })

  it('firstIncompletePart:没有任何部分算「没通」时也不返回 undefined', () => {
    // 困难部分为空 ⇒ 简单部分一通,三部分就都算已通
    expect(firstIncompletePart(noHard, star(['ux-0', 'ux-1', 'ux-2']))).toBe('easy')
  })

  it('nextPartOf 只走相邻一部分,空部分跳过、末部分回 null', () => {
    expect(nextPartOf(synth, 'easy')).toBe('hard')
    expect(nextPartOf(synth, 'hard')).toBe('review')
    expect(nextPartOf(synth, 'review')).toBeNull()
    // 困难部分空 ⇒ 简单部分走完直接回地图(不进一块白屏)
    expect(nextPartOf(noHard, 'easy')).toBeNull()
  })
})
