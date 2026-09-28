// 拼音积木组合游戏 —— 公共面。
// 玩法:看图 → 从积木盘挑块 → 拼进凹槽 → 声调块盖在韵腹上方。
// 块按类型着色:声母蓝 / 介母青 / 韵母绿 / 鼻音紫 / 声调金。
export { MapEntry } from './MapEntry'
export { LevelEntry } from './LevelEntry'
export { LevelRun } from './LevelRun'
export { ChapterRun, type ChapterItem, type ChapterRunProps, type QuestionEnd } from './ChapterRun'
export { UnitMap } from './UnitMap'
export { PinyinBlocksGame, type PinyinBlocksGameProps, type SectionResult } from './PinyinBlocksGame'
export { BlockChip } from './BlockChip'
export { UNITS, easyLevelsOf, hardLevelsOf } from './levels'
export { CHAPTERS, type Chapter } from './chapter'
export type { Level, Syllable, Unit } from './levels'
export type { Block, BlockType, Hint } from './blocks'
export { hintFor, HINT_BY_UNIT } from './blocks'
export {
  EMPTY_CHAPTER_SETTLEMENT,
  mergeSettlement,
  type ChapterSettlement,
  type LevelSettlement,
} from './settle'
export { StageBar, StageDots, type StageId } from './StageBar'
export { STAGE_TRANSITION_MS, StageTransition } from './StageTransition'
export {
  completedLevelCount,
  isUnitUnlocked,
  perfectLevelCount,
  perfectUnitCount,
  totalLevelCount,
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
  chapterReviewQuestions,
  MAX_REVIEW_QUESTIONS,
  notePick,
  reviewQuestionFor,
  REVIEW_TRAY_CAP,
  wholeReviewQuestion,
  WRONG_PICK_THRESHOLD,
  type ChapterReviewItem,
  type MistakePool,
  type PickCounts,
  type PoolKey,
  type ReviewQuestion,
} from './mistakes'
