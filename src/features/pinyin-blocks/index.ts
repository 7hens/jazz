// 拼音积木组合游戏 —— 公共面。
// 玩法:看图 → 从积木盘挑块 → 拼进凹槽 → 声调块盖在韵腹上方。
// 块按类型着色:声母蓝 / 介母橙 / 韵母绿 / 鼻音紫 / 声调金。
export { PinyinBlocksEntry } from './PinyinBlocksEntry'
export { PinyinBlocksGame } from './PinyinBlocksGame'
export { BlockChip } from './BlockChip'
export { UNITS } from './levels'
export type { Level, Syllable, Unit } from './levels'
export type { Block, BlockType } from './blocks'
export {
  autoTargetId,
  buildBlocks,
  canPlace,
  isComplete,
  requiredBlocks,
  slotsFor,
  toneBlocks,
  wrongSlotIds,
} from './rules'
export type { Placement, Rng, Slot, TrayBlock } from './rules'
