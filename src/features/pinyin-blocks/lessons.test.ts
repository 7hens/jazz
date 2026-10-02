import { describe, expect, it } from 'vitest'
import {
  LESSON_MAX,
  SECTIONS,
  UNITS,
  lessonsOf,
  pathLessons,
  type Level,
  type Unit,
} from './levels'

/** 合成单元:靠它测切分算法本身的边界,不依赖真实数据的题数。 */
const level = (id: string, hard = false): Level => ({
  id,
  emoji: '🅰️',
  pinyin: 'ā',
  read: '啊',
  syl: [{ final: 'a', tone: 1 }],
  ...(hard ? { stage: 'hard' as const } : {}),
})

const synth = (easy: number, hard: number): Unit => ({
  id: 'ux',
  name: '合成',
  emoji: '🧪',
  badge: [],
  levels: [
    ...Array.from({ length: easy }, (_, i) => level(`ux-${i}`)),
    ...Array.from({ length: hard }, (_, i) => level(`ux-${i}h`, true)),
  ],
})

describe('节的切分', () => {
  it('全表 46 节,覆盖 182 道题,零重复、零遗漏', () => {
    const lessons = pathLessons()
    expect(lessons).toHaveLength(46)
    const ids = lessons.flatMap((l) => l.levelIds)
    expect(ids).toHaveLength(182)
    expect(new Set(ids).size).toBe(182)
    expect(new Set(ids)).toEqual(new Set(UNITS.flatMap((u) => u.levels.map((l) => l.id))))
  })

  it('每节 3~5 题', () => {
    for (const lesson of pathLessons()) {
      expect(lesson.levelIds.length, lesson.id).toBeGreaterThanOrEqual(3)
      expect(lesson.levelIds.length, lesson.id).toBeLessThanOrEqual(LESSON_MAX)
    }
  })

  it('一节恒是纯简单题或纯困难题,且与 part 对上', () => {
    for (const unit of UNITS) {
      const byId = new Map(unit.levels.map((l) => [l.id, l]))
      for (const lesson of lessonsOf(unit)) {
        const hards = new Set(lesson.levelIds.map((id) => byId.get(id)!.stage === 'hard'))
        expect(hards.size, lesson.id).toBe(1)
        expect([...hards][0], lesson.id).toBe(lesson.part === 'hard')
      }
    }
  })

  it('顺序恒是「简单各节 → 困难各节」,且首尾相接覆盖全单元', () => {
    for (const unit of UNITS) {
      const lessons = lessonsOf(unit)
      const firstHard = lessons.findIndex((l) => l.part === 'hard')
      const easyCount = firstHard < 0 ? lessons.length : firstHard
      expect(lessons.slice(0, easyCount).every((l) => l.part === 'easy'), unit.id).toBe(true)
      expect(lessons.slice(easyCount).every((l) => l.part === 'hard'), unit.id).toBe(true)
      expect(lessons.flatMap((l) => l.levelIds), unit.id).toEqual(unit.levels.map((l) => l.id))
    }
  })

  it('均分而不是「每 5 题一刀」', () => {
    // n=6:每 5 题一刀会切出 5+1(末节一道题不成课),均分给 3+3
    expect(lessonsOf(synth(6, 0)).map((l) => l.levelIds.length)).toEqual([3, 3])
    expect(lessonsOf(synth(10, 0)).map((l) => l.levelIds.length)).toEqual([5, 5])
    expect(lessonsOf(synth(9, 0)).map((l) => l.levelIds.length)).toEqual([5, 4])
    expect(lessonsOf(synth(8, 0)).map((l) => l.levelIds.length)).toEqual([4, 4])
    expect(lessonsOf(synth(7, 0)).map((l) => l.levelIds.length)).toEqual([4, 3])
    expect(lessonsOf(synth(5, 0)).map((l) => l.levelIds.length)).toEqual([5])
  })

  it('困难题为空 ⇒ 0 节困难节,不产空节', () => {
    const lessons = lessonsOf(synth(4, 0))
    expect(lessons).toHaveLength(1)
    expect(lessons.every((l) => l.part === 'easy')).toBe(true)
  })

  it('节的 id 形如 ux#easy-1,且全路径唯一', () => {
    expect(lessonsOf(synth(10, 6)).map((l) => l.id)).toEqual([
      'ux#easy-0', 'ux#easy-1', 'ux#hard-0', 'ux#hard-1',
    ])
    const ids = pathLessons().map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('Section 分组', () => {
  it('7 段,划段只是分组、不重排', () => {
    expect(SECTIONS).toHaveLength(7)
    expect(SECTIONS.flatMap((s) => s.unitIds)).toEqual(UNITS.map((u) => u.id))
  })

  it('各段的节数 = 4 / 12 / 4 / 6 / 8 / 8 / 4(合计 46)', () => {
    const counts = SECTIONS.map((section) =>
      section.unitIds.reduce((sum, unitId) => {
        const unit = UNITS.find((u) => u.id === unitId)!
        return sum + lessonsOf(unit).length
      }, 0),
    )
    expect(counts).toEqual([4, 12, 4, 6, 8, 8, 4])
    expect(counts.reduce((a, b) => a + b, 0)).toBe(46)
  })
})
