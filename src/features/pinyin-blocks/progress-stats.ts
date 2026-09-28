// 由星级表派生的统计:解锁、通关数、三星数、完美单元数。
// 地图与成就都从这一份口径取数 —— 两处各算一遍必然漂移。
// 纯函数,不引 React、不引服务。

import type { LevelStars } from '@/shared/services'
import { CHAPTERS, type Chapter } from './chapter'
import { easyLevelsOf, hardLevelsOf, UNITS, type Level, type Unit } from './levels'

/**
 * 一关算不算通:有 key 且星数 ≥ 1。「0 星」与「没这个 key」是同一件事。
 * 导出给地图用 —— 地图上「亮一颗星」与这里必须同义,否则「通关」就有了两个定义。
 */
export function cleared(stars: LevelStars, levelId: string): boolean {
  return (stars[levelId] ?? 0) >= 1
}

export function totalLevelCount(units: readonly Unit[] = UNITS): number {
  return units.reduce((sum, unit) => sum + unit.levels.length, 0)
}

export function completedLevelCount(stars: LevelStars, units: readonly Unit[] = UNITS): number {
  return units.reduce(
    (sum, unit) => sum + unit.levels.filter((level) => cleared(stars, level.id)).length,
    0,
  )
}

export function perfectLevelCount(stars: LevelStars, units: readonly Unit[] = UNITS): number {
  return units.reduce(
    (sum, unit) => sum + unit.levels.filter((level) => stars[level.id] === 3).length,
    0,
  )
}

/** 单元内每一关都三星。空单元不算完美(现在没有空单元,但不给未来的自己埋坑)。 */
export function perfectUnitCount(stars: LevelStars, units: readonly Unit[] = UNITS): number {
  return units.filter(
    (unit) => unit.levels.length > 0 && unit.levels.every((level) => stars[level.id] === 3),
  ).length
}

/**
 * 本章的题。复习章恒返回 `[]` —— **它的题由错题池当场决定,不是课程数据**。
 * 想数复习章有几道题,得先有池;想在它上面求「通没通」,答案是「不进这个口径」(见 `chapterCleared`)。
 */
export function chapterLevels(unit: Unit, chapter: Chapter): readonly Level[] {
  if (chapter === 'easy') return easyLevelsOf(unit)
  if (chapter === 'hard') return hardLevelsOf(unit)
  return []
}

export function chapterTotal(unit: Unit, chapter: Chapter): number {
  return chapterLevels(unit, chapter).length
}

export function chapterClearedCount(stars: LevelStars, unit: Unit, chapter: Chapter): number {
  return chapterLevels(unit, chapter).filter((level) => cleared(stars, level.id)).length
}

/**
 * 本章做完了没:该章**全部题都 ≥1 星**。1 星即通关,不要求满星。
 *
 * **空章恒为 true** —— 这不是巧合,是「困难章还没录题时复习章仍要解锁」的机制所在
 * (`every([]) === true`)。别把它「修」成 `length > 0 && every(...)`,那会让空章永远锁着。
 */
export function chapterCleared(stars: LevelStars, unit: Unit, chapter: Chapter): boolean {
  return chapterLevels(unit, chapter).every((level) => cleared(stars, level.id))
}

/**
 * 这一章有没有可进的题。**空章不进** —— 进去就是一块白屏。
 *
 * 复习章恒可进:它压根不从课程数据取题,池空也有「照考本单元第一道整题」的兜底(spec §5)。
 */
export function chapterEnterable(unit: Unit, chapter: Chapter): boolean {
  if (chapter === 'review') return true
  return chapterLevels(unit, chapter).length > 0
}

/**
 * 单元是否解锁:u1 恒开,其余要求**前一单元简单章全通**。
 *
 * **困难章与复习章不参与解锁** —— 孩子不该因为卡在困难章而看不到新单元。
 * 一星即可:「过了」是解锁的门槛,「打好」是星级的事,两件事不能混。
 */
export function isUnitUnlocked(
  unitIndex: number,
  stars: LevelStars,
  units: readonly Unit[] = UNITS,
): boolean {
  if (unitIndex <= 0) return true
  const previous = units[unitIndex - 1]
  if (!previous) return false
  return chapterCleared(stars, previous, 'easy')
}

/**
 * 章是否解锁:本单元**排在它前面的章**全部做完,且单元本身已解锁。
 * 简单章的解锁条件退化成「单元已解锁」—— 单元锁已经是「前一单元的简单章全通」。
 */
export function isChapterUnlocked(
  unitIndex: number,
  chapter: Chapter,
  stars: LevelStars,
  units: readonly Unit[] = UNITS,
): boolean {
  const unit = units[unitIndex]
  if (!unit) return false
  if (!isUnitUnlocked(unitIndex, stars, units)) return false
  const at = CHAPTERS.indexOf(chapter)
  for (let i = 0; i < at; i++) {
    const earlier = CHAPTERS[i]
    if (earlier && !chapterCleared(stars, unit, earlier)) return false
  }
  return true
}

/**
 * 本章走完后该去哪一章。**没有下一章、或下一章是空章 ⇒ null**(宿主据此回地图)。
 *
 * 不读 stars:能调到这儿就意味着本章刚走完,而「本章走完」正是下一章解锁的全部条件。
 * 唯一的例外是空章 —— 它永远不该被进(一块白屏),所以在这里就掐掉。
 */
export function nextChapterOf(unit: Unit, chapter: Chapter): Chapter | null {
  const next = CHAPTERS[CHAPTERS.indexOf(chapter) + 1]
  if (!next) return null
  return chapterEnterable(unit, next) ? next : null
}
