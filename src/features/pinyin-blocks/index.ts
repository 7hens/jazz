// 拼音积木组合游戏 —— 公共面。
// 玩法:看图 → 从积木盘挑块 → 拼进凹槽 → 声调块盖在韵腹上方。
// 块按类型着色:声母蓝 / 介母青 / 韵母绿 / 鼻音紫 / 声调金。
export { MapEntry } from './MapEntry'
export { UnitEntry } from './UnitEntry'
export { PartRun, type PartItem, type PartRunProps, type QuestionEnd } from './PartRun'
export { UnitMap } from './UnitMap'
export { PinyinBlocksGame, type PinyinBlocksGameProps, type PartResult } from './PinyinBlocksGame'
export { BlockChip } from './BlockChip'
export { UNITS, easyLevelsOf, hardLevelsOf, LESSON_MAX, lessonsOf, pathLessons, SECTIONS } from './levels'
export { PARTS, type Part } from './part'
export type { Level, Lesson, Section, Syllable, Unit } from './levels'
export type { Block, BlockType, Hint } from './blocks'
export { hintFor, HINT_BY_UNIT } from './blocks'
export {
  EMPTY_PART_SETTLEMENT,
  mergeSettlement,
  type PartSettlement,
  type LevelSettlement,
} from './settle'
export { StageBar, StageDots } from './StageBar'
export {
  completedLevelCount,
  isUnitUnlocked,
  lessonCleared,
  lessonClearedCount,
  lessonIndex,
  lessonState,
  lessonsOfSection,
  nextLessonOf,
  perfectLevelCount,
  perfectUnitCount,
  PRACTICE_MAX,
  practiceLevelsOf,
  sectionCleared,
  sectionClearedCount,
  sectionTotal,
  totalLevelCount,
  unitClearedCount,
  unitLessonsOf,
  unitTotal,
  unitUnlockedByPath,
  unitsOfSection,
  type LessonState,
} from './progress-stats'
export {
  autoTargetId,
  autoTypeTargetId,
  buildBlocks,
  canPlace,
  familyKey,
  HARD_RETRIES,
  HARD_TRAY_PER_TYPE,
  isComplete,
  requiredBlocks,
  sameTypeOnly,
  slotsFor,
  starsFor,
  toneBlocks,
  type BuildOptions,
  wrongSlotIds,
} from './rules'
export type { Placement, Rng, Slot, TrayBlock } from './rules'
export {
  addToPool,
  partReviewQuestions,
  MAX_REVIEW_QUESTIONS,
  notePick,
  reviewQuestionFor,
  REVIEW_TRAY_CAP,
  WRONG_PICK_THRESHOLD,
  type PartReviewItem,
  type MistakePool,
  type PickCounts,
  type PoolKey,
  type ReviewQuestion,
} from './mistakes'
export { practiceQuestions, wholeReviewQuestion, type PracticeItem, type PracticeQuestion } from './practice'
