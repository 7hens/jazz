import { describe, expect, it } from 'vitest'
import type { LevelStars } from '@/shared/services'
import { UNITS, easyLevelsOf, type Level, type Unit } from './levels'
import {
  chapterCleared,
  chapterClearedCount,
  chapterEnterable,
  chapterLevels,
  chapterTotal,
  completedLevelCount,
  isChapterUnlocked,
  isUnitUnlocked,
  nextChapterOf,
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
  it('u1 恒解锁,后面的要前一单元简单章全通', () => {
    expect(isUnitUnlocked(0, {})).toBe(true)
    expect(isUnitUnlocked(1, {})).toBe(false)
    expect(isUnitUnlocked(1, clearUnit(0, 3))).toBe(true)
    // 一星也算通关 —— 「过了」不等同于「打好了」,不能拿三星当前置门槛
    expect(isUnitUnlocked(1, clearUnit(0, 1))).toBe(true)
  })

  // 单元锁的口径是「前一单元**简单章**全通」—— 困难题不参与,所以漏的必须是简单题。
  it('前一单元简单章漏一题就不解锁下一单元', () => {
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

/** 合成单元:3 道简单题 + 2 道困难题。用它测章口径 —— 不依赖真实数据恰好长什么样。 */
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

/** 只有简单题的单元 —— 「空困难章」那条守卫的载体。 */
const noHard: Unit = { id: 'un', name: '无难', badge: [], levels: synth.levels.slice(0, 3) }

const star = (ids: readonly string[]): LevelStars => Object.fromEntries(ids.map((id) => [id, 1]))

describe('章级统计', () => {
  it('chapterLevels 按章切,复习章恒空', () => {
    expect(chapterLevels(synth, 'easy').map((l: Level) => l.id)).toEqual(['ux-0', 'ux-1', 'ux-2'])
    expect(chapterLevels(synth, 'hard').map((l: Level) => l.id)).toEqual(['ux-0h', 'ux-1h'])
    expect(chapterLevels(synth, 'review')).toEqual([])
    expect(chapterTotal(synth, 'easy')).toBe(3)
    expect(chapterTotal(synth, 'hard')).toBe(2)
    expect(chapterTotal(synth, 'review')).toBe(0)
    expect(chapterClearedCount(star(['ux-0', 'ux-1']), synth, 'easy')).toBe(2)
    expect(chapterClearedCount(star(['ux-0h']), synth, 'hard')).toBe(1)
  })

  it('chapterCleared 要求该章每题都 ≥1 星', () => {
    expect(chapterCleared(star(['ux-0', 'ux-1']), synth, 'easy')).toBe(false)
    expect(chapterCleared(star(['ux-0', 'ux-1', 'ux-2']), synth, 'easy')).toBe(true)
    // 空章恒「做完」—— 这是「困难章还没录入时复习章仍能解锁」的机制所在(every([]) === true)。
    expect(chapterCleared({}, noHard, 'hard')).toBe(true)
  })

  it('chapterEnterable:空章不进,复习章恒可进', () => {
    expect(chapterEnterable(synth, 'easy')).toBe(true)
    expect(chapterEnterable(synth, 'hard')).toBe(true)
    // 复习章的题由错题池当场决定,池空也有「照考整题」的兜底 ⇒ 它永远进得去。
    expect(chapterEnterable(synth, 'review')).toBe(true)
    expect(chapterEnterable(noHard, 'hard')).toBe(false)
  })
})

describe('章锁链', () => {
  it('单元锁 = 前一单元简单章全通(困难章不参与)', () => {
    const units = [synth, noHard]
    expect(isUnitUnlocked(0, {}, units)).toBe(true)
    // 前一单元的简单题只通两道 ⇒ 锁着
    expect(isUnitUnlocked(1, star(['ux-0', 'ux-1']), units)).toBe(false)
    // 简单章全通 ⇒ 解锁,即使困难章一道没碰
    expect(isUnitUnlocked(1, star(['ux-0', 'ux-1', 'ux-2']), units)).toBe(true)
  })

  it('章依次锁:简单章 → 困难章 → 复习章', () => {
    const units = [synth]
    expect(isChapterUnlocked(0, 'easy', {}, units)).toBe(true)
    expect(isChapterUnlocked(0, 'hard', {}, units)).toBe(false)
    expect(isChapterUnlocked(0, 'hard', star(['ux-0', 'ux-1', 'ux-2']), units)).toBe(true)
    expect(isChapterUnlocked(0, 'review', star(['ux-0', 'ux-1', 'ux-2']), units)).toBe(false)
    expect(isChapterUnlocked(0, 'review', star(['ux-0', 'ux-1', 'ux-2', 'ux-0h', 'ux-1h']), units)).toBe(true)
  })

  it('困难章为空时复习章直接解锁(空章不算一道没做完的章)', () => {
    const units = [noHard]
    expect(isChapterUnlocked(0, 'review', star(['ux-0', 'ux-1', 'ux-2']), units)).toBe(true)
  })

  it('nextChapterOf 只走相邻一章,空章跳过、末章回 null', () => {
    expect(nextChapterOf(synth, 'easy')).toBe('hard')
    expect(nextChapterOf(synth, 'hard')).toBe('review')
    expect(nextChapterOf(synth, 'review')).toBeNull()
    // 困难章空 ⇒ 简单章走完直接回地图(不进一块白屏)
    expect(nextChapterOf(noHard, 'easy')).toBeNull()
  })
})
