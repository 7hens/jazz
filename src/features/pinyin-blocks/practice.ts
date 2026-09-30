// 练习入口的题源:本单元「<3 星」的题,每题一道**整题**(全槽挖空)。
// 不落库、不记 miss、不上报连击 —— 练习做得再差也不掉星(spec §8)。
// 纯函数 + 注入 rng,不引 React、不引服务 —— 组件只负责画。

import type { Level, Unit } from './levels'
import { buildBlocks, slotsFor, type Rng, type TrayBlock } from './rules'

/**
 * 练习里的一道题。**恒是全槽挖空、无预填。**
 *
 * 为什么不再按类型挖空:错题池存的是**块**,而星级只记得**哪道题**错过 ——
 * 「他错的是声母还是韵母」推不出来。故产品裁定练习重考整题,连带整个错题池机制退休(spec §8.1)。
 */
export type PracticeQuestion = Readonly<{
  /** 要挖空的槽。练习恒是全部槽。 */
  slotIds: readonly string[]
  /** 本小题的托盘:同简单部分(正解 + `taughtBlocks` 里挑得出的干扰块)。 */
  tray: readonly TrayBlock[]
}>

/**
 * 一道整题(全部槽挖空、托盘同简单部分)。**纯函数**(除注入的 rng)—— 同一批入参 + 同一种子恒等值。
 *
 * 这一点是**承重的**:宿主在进练习时算一次,之后不再重算;万一被重算(React 的 `useMemo`
 * 不保证不重跑),块 id 与托盘必须与旧的一致,否则盘面(只初始化一次的 `placement`)会与托盘失配 ——
 * 屏幕上就是「块放不进去」。
 */
export function wholeReviewQuestion(level: Level, unitIndex: number, rng: Rng = Math.random): PracticeQuestion {
  const tray: TrayBlock[] = buildBlocks(level, unitIndex, rng).map((b, i) => ({ ...b, id: `q0-${i}` }))
  return { slotIds: slotsFor(level).map((s) => s.id), tray }
}

/** 练习里的一道题,以及它挂在哪道题上(`levelIndex` = 在 `Unit.levels` 里的下标)。 */
export type PracticeItem = Readonly<{
  levelIndex: number
  question: PracticeQuestion
}>

/** 一个单元的练习题表 —— 题源由调用方给(口径在 `practiceLevelsOf`,唯一一处)。 */
export function practiceQuestions(
  unit: Unit,
  unitIndex: number,
  levels: readonly Level[],
  rng?: Rng,
): PracticeItem[] {
  return levels.map((level) => ({
    levelIndex: unit.levels.indexOf(level),
    question: wholeReviewQuestion(level, unitIndex, rng),
  }))
}
