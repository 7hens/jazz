// 拼音积木组合游戏 —— 公共面。
// 玩法:看图 → 从积木盘挑块 → 拼进凹槽 → 声调块盖在韵腹上方。
// 块按类型着色:声母蓝 / 介母青 / 韵母绿 / 鼻音紫 / 声调金。
export { MapEntry } from './MapEntry'
export { LevelEntry } from './LevelEntry'
export { UnitMap } from './UnitMap'
export { PinyinBlocksGame } from './PinyinBlocksGame'
export { BlockChip } from './BlockChip'
export { UNITS } from './levels'
export type { Level, Syllable, Unit } from './levels'
export type { Block, BlockType, Hint } from './blocks'
export { hintFor, HINT_BY_UNIT } from './blocks'
export type { LevelSettlement } from './settle'
export {
  completedLevelCount,
  isUnitUnlocked,
  perfectLevelCount,
  perfectUnitCount,
  totalLevelCount,
} from './progress-stats'
export {
  autoTargetId,
  buildBlocks,
  canPlace,
  isComplete,
  requiredBlocks,
  slotsFor,
  starsFor,
  toneBlocks,
  wrongSlotIds,
} from './rules'
export type { Placement, Rng, Slot, TrayBlock } from './rules'
