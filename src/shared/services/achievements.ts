import type { ServiceToken } from './core'

export type Achievement = Readonly<{
  id: string
  name: string
  description: string
  emoji: string
  reward: number
}>

/**
 * 成就判定的输入。没有一项来自词库:关卡统计来自关卡结算,连击来自 combo 服务,
 * 连续天数来自设置,`hour` 取自当前时刻。
 */
export type AchievementState = Readonly<{
  /** 全部关卡数。 */
  totalLevels: number
  /** 通过的关数(星数 ≥ 1)。 */
  completedLevels: number
  /** 三星关数。 */
  perfectLevels: number
  /** 单元内全三星的单元数。 */
  perfectUnits: number
  maxCombo: number
  /** 本次会话首通的关数。 */
  firstCompleteToday: number
  consecutiveDays: number
  /** 当前小时(0..23),给早晚成就用。 */
  hour: number
}>

export interface AchievementService {
  scan(state: AchievementState, earned: readonly string[]): readonly Achievement[]
}

export const AchievementService = Symbol('AchievementService') as unknown as ServiceToken<AchievementService>
