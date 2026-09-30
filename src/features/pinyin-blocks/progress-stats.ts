// 由星级表派生的统计:节级解锁、段/单元计数、通关数、三星数、完美单元数。
// 路径与成就都从这一份口径取数 —— 两处各算一遍必然漂移。
// 纯函数,不引 React、不引服务。

import type { LevelStars } from '@/shared/services'
import {
  pathLessons,
  UNITS,
  type Level,
  type Lesson,
  type Section,
  type Unit,
} from './levels'

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

/** 单元的总题数 / 已通题数 —— 路径上那一簇的「完成计数」的唯一口径。 */
export function unitTotal(unit: Unit): number {
  return unit.levels.length
}

export function unitClearedCount(stars: LevelStars, unit: Unit): number {
  return unit.levels.filter((level) => cleared(stars, level.id)).length
}

/* ----------------------------------------------------- 学习路径:节级解锁与计数 */

/** 本节是否全通:节内**每一题**都 ≥1 星(1 星即通关,与 `cleared` 同义)。 */
export function lessonCleared(stars: LevelStars, lesson: Lesson): boolean {
  return lesson.levelIds.every((id) => cleared(stars, id))
}

export function lessonClearedCount(stars: LevelStars, lesson: Lesson): number {
  return lesson.levelIds.filter((id) => cleared(stars, id)).length
}

/**
 * 路径上第一个**还没全通**的节;全部通过 ⇒ `null`。
 *
 * **只有它那一个节点可进**(`lessonState` 的 'current');它前面已通的随时可重玩,它后面全是锁
 * (spec §5.1 严格逐节线性)。全部现算,不落库。
 */
export function nextLessonOf(stars: LevelStars, lessons: readonly Lesson[] = pathLessons()): Lesson | null {
  return lessons.find((lesson) => !lessonCleared(stars, lesson)) ?? null
}

/** 本节在路径上的序号;不在表里 ⇒ -1。 */
export function lessonIndex(lessonId: string, lessons: readonly Lesson[] = pathLessons()): number {
  return lessons.findIndex((lesson) => lesson.id === lessonId)
}

/** 节点三态。'current' 恒唯一;全部通过时**不存在** current。 */
export type LessonState = 'cleared' | 'current' | 'locked'

/**
 * 地图上那一个节点画什么。**唯一口径** —— 地图不许自己拿星级再算一遍。
 *
 * 课表外的 id 一律 `'locked'`:少了下面那道 `at < 0` 的闸,下标 -1 会让它落进
 * `at < frontier` 被判成「已通」,地图上就多出一个点得进去、进去却什么都没有的节点。
 */
export function lessonState(
  stars: LevelStars,
  lesson: Lesson,
  lessons: readonly Lesson[] = pathLessons(),
): LessonState {
  const at = lessonIndex(lesson.id, lessons)
  if (at < 0) return 'locked'
  const next = nextLessonOf(stars, lessons)
  if (next && next.id === lesson.id) return 'current'
  const frontier = next ? lessonIndex(next.id, lessons) : lessons.length
  return at < frontier ? 'cleared' : 'locked'
}

/** 本单元的节,按路径顺序。地图一个单元只画一条节点串,取数就靠它。 */
export function unitLessonsOf(unitId: string, lessons: readonly Lesson[] = pathLessons()): readonly Lesson[] {
  return lessons.filter((lesson) => lesson.unitId === unitId)
}

/**
 * 单元是否解锁。严格逐节线性下它就是「本单元第一节不是 locked」——
 * 旧口径「前一单元简单部分全通」被它**蕴含**,故旧的那条已随改造退休(spec §5.1)。
 */
export function unitUnlockedByPath(
  stars: LevelStars,
  unitId: string,
  lessons: readonly Lesson[] = pathLessons(),
): boolean {
  const first = unitLessonsOf(unitId, lessons)[0]
  if (!first) return false
  return lessonState(stars, first, lessons) !== 'locked'
}

/** 本段内的全部节,按路径顺序。段只是一组单元,节仍来自 `lessons`。 */
export function lessonsOfSection(section: Section, lessons: readonly Lesson[] = pathLessons()): readonly Lesson[] {
  return lessons.filter((lesson) => section.unitIds.includes(lesson.unitId))
}

export function sectionTotal(section: Section, lessons: readonly Lesson[] = pathLessons()): number {
  return lessonsOfSection(section, lessons).length
}

export function sectionClearedCount(
  stars: LevelStars,
  section: Section,
  lessons: readonly Lesson[] = pathLessons(),
): number {
  return lessonsOfSection(section, lessons).filter((lesson) => lessonCleared(stars, lesson)).length
}

export function sectionCleared(
  stars: LevelStars,
  section: Section,
  lessons: readonly Lesson[] = pathLessons(),
): boolean {
  return lessonsOfSection(section, lessons).every((lesson) => lessonCleared(stars, lesson))
}

/** 一段的全部单元(按 `unitIds` 顺序)。地图画段头 / 簇头用。 */
export function unitsOfSection(section: Section, units: readonly Unit[] = UNITS): readonly Unit[] {
  return section.unitIds.flatMap((id) => {
    const unit = units.find((u) => u.id === id)
    return unit ? [unit] : []
  })
}

/* ------------------------------------------------------------ 练习题源 */

/** 一次练习最多几道题(≈ 一节长度)。产品裁定值 5(spec §8)。 */
export const PRACTICE_MAX = 5

/**
 * 练习的题源:本单元里**「<3 星」的题**,按 `unit.levels` 顺序,**封顶 `PRACTICE_MAX`**。
 *
 * 为什么要 `< 3` 而不是 `< 1`:练习是**回炉** —— 通关了但没打好的题才是要练的题。
 * 全 3 星 ⇒ 空数组 ⇒ 路径上该单元的练习入口**不亮**(spec §8.2 —— 早先「练习恒存在、
 * 池空则兜底造一题」的裁定随之作废:伪造一道题是往屏幕上放假话)。
 *
 * ⚠ 星级只记得**哪道题**错过,记不得「他错的是声母还是韵母」—— 故练习重考**整题**
 * (`wholeReviewQuestion`),不再按类型挖空(spec §8.1)。
 */
export function practiceLevelsOf(stars: LevelStars, unit: Unit): readonly Level[] {
  return unit.levels.filter((level) => (stars[level.id] ?? 0) < 3).slice(0, PRACTICE_MAX)
}
