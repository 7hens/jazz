import { describe, expect, it } from 'vitest'
import type { LevelStars } from '@/shared/services'
import { SECTIONS, lessonsOf, pathLessons, type Level, type Unit } from './levels'
import {
  PRACTICE_MAX,
  lessonCleared,
  lessonState,
  lessonsOfSection,
  nextLessonOf,
  practiceLevelsOf,
  sectionCleared,
  sectionClearedCount,
  sectionTotal,
  unitUnlockedByPath,
} from './progress-stats'

/** 合成单元:10 道简单题(切 5+5)+ 6 道困难题(切 3+3)⇒ 4 节。 */
const level = (id: string, hard = false): Level => ({
  id,
  emoji: '🅰️',
  pinyin: 'ā',
  read: '啊',
  syl: [{ final: 'a', tone: 1 }],
  ...(hard ? { stage: 'hard' as const } : {}),
})

const synth: Unit = {
  id: 'ux',
  name: '合成',
  emoji: '🧪',
  badge: [],
  levels: [
    ...Array.from({ length: 10 }, (_, i) => level(`ux-${i}`)),
    ...Array.from({ length: 6 }, (_, i) => level(`ux-${i}h`, true)),
  ],
}

/** 把若干题打成指定星数;省略星数 = 1 星。 */
const star = (ids: readonly string[], n = 1): LevelStars => Object.fromEntries(ids.map((id) => [id, n]))

/** 合成单元的全 0 星表 —— 显式写死,不靠「没列出就是 0 星」这条默认。 */
const allZero: LevelStars = Object.fromEntries(synth.levels.map((l) => [l.id, 0]))

const lessons = lessonsOf(synth)
const lessonIds = lessons.map((l) => l.id)

describe('节级解锁', () => {
  it('节全通 = 节内每一题都 ≥1 星;缺 key 与 0 星都不算', () => {
    const first = lessons[0]!
    expect(lessonCleared({}, first)).toBe(false)
    expect(lessonCleared(star(first.levelIds.slice(0, -1)), first)).toBe(false)
    const zero = Object.fromEntries(first.levelIds.map((id) => [id, 0]))
    expect(lessonCleared(zero, first)).toBe(false)
    expect(lessonCleared(star(first.levelIds), first)).toBe(true)
  })

  it('nextLessonOf = 路径上第一个未全通的节;全通 ⇒ null', () => {
    expect(nextLessonOf({}, lessons)?.id).toBe(lessonIds[0])
    expect(nextLessonOf(star(lessons[0]!.levelIds), lessons)?.id).toBe(lessonIds[1])
    const all = star(lessons.flatMap((l) => l.levelIds))
    expect(nextLessonOf(all, lessons)).toBeNull()
  })

  it('中间某节没通也照样是它,与后面的节无关', () => {
    const pass1 = star(lessons[0]!.levelIds)
    const pass3 = star(lessons[2]!.levelIds)
    expect(nextLessonOf({ ...pass1, ...pass3 }, lessons)?.id).toBe(lessonIds[1])
  })

  it('三态:current 恒唯一;current 之前恒 cleared、之后恒 locked', () => {
    const stars = star(lessons[0]!.levelIds)
    expect(lessons.map((l) => lessonState(stars, l, lessons))).toEqual([
      'cleared', 'current', 'locked', 'locked',
    ])
    expect(lessons.filter((l) => lessonState(stars, l, lessons) === 'current')).toHaveLength(1)
  })

  it('全通时没有 current —— 每个节都是 cleared（重玩态）', () => {
    const stars = star(lessons.flatMap((l) => l.levelIds))
    expect(lessons.every((l) => lessonState(stars, l, lessons) === 'cleared')).toBe(true)
  })

  it('课表外的节 id 一律 locked,不会因为下标 -1 被算成 cleared', () => {
    const alien = { id: 'zz#easy-0', unitId: 'zz', part: 'easy' as const, levelIds: ['zz-0'] }
    expect(lessonState({}, alien, lessons)).toBe('locked')
  })
})

describe('节级计数与单元解锁', () => {
  it('单元解锁 = 本单元第一节不是 locked（严格逐节线性的推论）', () => {
    expect(unitUnlockedByPath({}, 'ux', lessons)).toBe(true) // 第一节就是当前节点
    const stars = star(lessons.flatMap((l) => l.levelIds))
    expect(unitUnlockedByPath(stars, 'ux', lessons)).toBe(true) // 全通 ⇒ 可重玩
  })

  it('空单元（无节）不解锁 —— 进去是一块白屏', () => {
    expect(unitUnlockedByPath({}, 'nope', lessons)).toBe(false)
  })

  it('段计数用真实课程:S1 4 节 / S2 12 节', () => {
    const all = pathLessons()
    expect(sectionTotal(SECTIONS[0]!, all)).toBe(4)
    expect(sectionTotal(SECTIONS[1]!, all)).toBe(12)
    expect(sectionClearedCount({}, SECTIONS[0]!, all)).toBe(0)
    expect(sectionCleared({}, SECTIONS[0]!, all)).toBe(false)
  })

  it('段全通 = 段内每一节全通', () => {
    const all = pathLessons()
    const s1 = SECTIONS[0]!
    const s1LessonIds = all.filter((l) => l.unitId === 'u1').flatMap((l) => l.levelIds)
    expect(sectionCleared(star(s1LessonIds), s1, all)).toBe(true)
    expect(sectionClearedCount(star(s1LessonIds), s1, all)).toBe(4)
    // 少一题 ⇒ 那个节不算通,段也不算通
    const short = { ...star(s1LessonIds) }
    delete short[s1LessonIds[0]!]
    expect(sectionClearedCount(short, s1, all)).toBe(3)
    expect(sectionCleared(short, s1, all)).toBe(false)
  })

  it('每一节都属于某个 Section（段覆盖是完整的）', () => {
    const all = pathLessons()
    const covered = new Set(SECTIONS.flatMap((s) => lessonsOfSection(s, all).map((l) => l.id)))
    expect(all.every((l) => covered.has(l.id))).toBe(true)
    expect(covered.size).toBe(all.length)
  })
})

describe('练习题源', () => {
  it('只取 <3 星的题,按 unit.levels 顺序', () => {
    const all3 = Object.fromEntries(synth.levels.map((l) => [l.id, 3]))
    const stars = { ...all3, 'ux-1': 2, 'ux-2': 0, 'ux-3': 1 }
    expect(practiceLevelsOf(stars, synth).map((l) => l.id)).toEqual(['ux-1', 'ux-2', 'ux-3'])
  })

  it('全 3 星 ⇒ 无题可练（入口据此不亮）', () => {
    const all = star(synth.levels.map((l) => l.id), 3)
    expect(practiceLevelsOf(all, synth)).toEqual([])
  })

  it('多于 5 道时封顶 5 道', () => {
    expect(practiceLevelsOf(allZero, synth)).toHaveLength(PRACTICE_MAX)
    expect(practiceLevelsOf(allZero, synth).map((l) => l.id)).toEqual(['ux-0', 'ux-1', 'ux-2', 'ux-3', 'ux-4'])
  })
})
