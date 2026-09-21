// 由星级表派生的统计:解锁、通关数、三星数、完美单元数。
// 地图与成就都从这一份口径取数 —— 两处各算一遍必然漂移。
// 纯函数,不引 React、不引服务。

import type { LevelStars } from '@/shared/services'
import { UNITS, type Unit } from './levels'

/** 一关算不算通:有 key 且星数 ≥ 1。「0 星」与「没这个 key」是同一件事。 */
function cleared(stars: LevelStars, levelId: string): boolean {
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
 * 单元是否解锁:u1 恒开,其余要求**前一单元全关通关**。
 * 一星即可 —— 「过了」是解锁的门槛,「打好」是星级的事,两件事不能混。
 */
export function isUnitUnlocked(
  unitIndex: number,
  stars: LevelStars,
  units: readonly Unit[] = UNITS,
): boolean {
  if (unitIndex <= 0) return true
  const previous = units[unitIndex - 1]
  if (!previous) return false
  return previous.levels.every((level) => cleared(stars, level.id))
}
