// 由星级表派生的统计:解锁、通关数、三星数、完美单元数。
// 地图与成就都从这一份口径取数 —— 两处各算一遍必然漂移。
// 纯函数,不引 React、不引服务。

import type { LevelStars } from '@/shared/services'
import { PARTS, type Part } from './part'
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
 * 本部分的题。复习部分恒返回 `[]` —— **它的题由错题池当场决定,不是课程数据**。
 * 想数复习部分有几道题,得先有池;想在它上面求「通没通」,答案是「不进这个口径」(见 `partCleared`)。
 */
export function partLevels(unit: Unit, part: Part): readonly Level[] {
  if (part === 'easy') return easyLevelsOf(unit)
  if (part === 'hard') return hardLevelsOf(unit)
  return []
}

export function partTotal(unit: Unit, part: Part): number {
  return partLevels(unit, part).length
}

export function partClearedCount(stars: LevelStars, unit: Unit, part: Part): number {
  return partLevels(unit, part).filter((level) => cleared(stars, level.id)).length
}

/**
 * 本部分做完了没:该部分**全部题都 ≥1 星**。1 星即通关,不要求满星。
 *
 * **空部分恒为 true** —— 这不是巧合,是「困难部分还没录题时复习部分仍要解锁」的机制所在
 * (`every([]) === true`)。别把它「修」成 `length > 0 && every(...)`,那会让空部分永远锁着。
 */
export function partCleared(stars: LevelStars, unit: Unit, part: Part): boolean {
  return partLevels(unit, part).every((level) => cleared(stars, level.id))
}

/**
 * 这一部分有没有可进的题。**空部分不进** —— 进去就是一块白屏。
 *
 * 复习部分恒可进:它压根不从课程数据取题,池空也有「照考本单元第一道整题」的兜底(spec §5)。
 */
export function partEnterable(unit: Unit, part: Part): boolean {
  if (part === 'review') return true
  return partLevels(unit, part).length > 0
}

/**
 * 单元是否解锁:u1 恒开,其余要求**前一单元简单部分全通**。
 *
 * **困难部分与复习部分不参与解锁** —— 孩子不该因为卡在困难部分而看不到新单元。
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
  return partCleared(stars, previous, 'easy')
}

/** 单元的总题数 / 已通题数 —— 地图那一格上的「进度数字」的唯一口径。 */
export function unitTotal(unit: Unit): number {
  return unit.levels.length
}

export function unitClearedCount(stars: LevelStars, unit: Unit): number {
  return unit.levels.filter((level) => cleared(stars, level.id)).length
}

/**
 * 进这个单元该从哪一部分起:第一个**还没全通**的部分;全通则回到第一部分(整单元重玩)。
 *
 * 复习部分恒算已通(`partCleared` 对空题表返 true),所以它永远不是「起点」——
 * 它是流程的终点,只能由 `nextPartOf` 在困难部分走完后送达。
 * 地图上一个单元只有一个入口,起点就由这里定,不由孩子选。
 */
export function firstIncompletePart(unit: Unit, stars: LevelStars): Part {
  return PARTS.find((part) => !partCleared(stars, unit, part)) ?? (PARTS[0] as Part)
}

/**
 * 本部分走完后该去哪一部分。**没有下一部分、或下一部分是空部分 ⇒ null**(宿主据此回地图)。
 *
 * 不读 stars:能调到这儿就意味着本部分刚走完,而「本部分走完」正是下一部分解锁的全部条件。
 * 唯一的例外是空部分 —— 它永远不该被进(一块白屏),所以在这里就掐掉。
 */
export function nextPartOf(unit: Unit, part: Part): Part | null {
  const next = PARTS[PARTS.indexOf(part) + 1]
  if (!next) return null
  return partEnterable(unit, next) ? next : null
}
