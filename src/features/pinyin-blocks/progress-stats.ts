// 由星级表派生的统计:解锁、通关数、三星数、完美单元数。
// 地图与成就都从这一份口径取数 —— 两处各算一遍必然漂移。
// 纯函数,不引 React、不引服务。

import type { LevelStars } from '@/shared/services'
import { PARTS, type Part } from './part'
import {
  easyLevelsOf,
  hardLevelsOf,
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
 * 旧口径「前一单元简单部分全通」(见 `isUnitUnlocked`)被它**蕴含**,故旧的那条退休(spec §5.1)。
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
 * 全 3 星 ⇒ 空数组 ⇒ 地图上该单元的练习入口**不亮**(spec §8.2,今天那套「复习部分恒存在」
 * 的裁定随之作废:伪造一道题是往屏幕上放假话)。
 *
 * ⚠ 星级只记得**哪道题**错过,记不得「他错的是声母还是韵母」—— 故练习重考**整题**
 * (`wholeReviewQuestion`),不再按类型挖空(spec §8.1)。
 */
export function practiceLevelsOf(stars: LevelStars, unit: Unit): readonly Level[] {
  return unit.levels.filter((level) => (stars[level.id] ?? 0) < 3).slice(0, PRACTICE_MAX)
}
