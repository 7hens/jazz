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

/**
 * 成就可见性总开关。**关着 = 成就完全不给孩子面看**(路径页徽章栏 / 结算弹层 / 家长面板目录三处),
 * 但**成就照常在后台扫描、照常入账、照常发星尘奖励**(settle 那条链一个字不动)。
 *
 * 2026-10-13 产品口径「徽章列表放在首页有点丑,先把徽章相关的功能都隐藏吧」。
 * 留常量而不是删代码:形态还没定稿(那一排圆图的形态至今没通过人眼裁定),
 * 定稿后改一个字面量就能回来。
 *
 * ⚠️ 三处读它的地方**不是对等关系**:徽章栏与家长面板是纯渲染,关掉即消失;
 * 成就弹层那个开关**必须在 `handleSettle` 入口生效**(见 `src/app/App.tsx` 那里的注释)——
 * 在渲染层藏弹层会让庆祝队列排不空,后续弹层全部静默失效。
 *
 * ⚠️ **这是临时隐藏,不是成就功能下线**:扫描、入账、星尘奖励都在照跑,半年后有人看到
 * 这个 `false` 当成「成就已废弃」而删掉整条链,那就误伤了。
 */
export const ACHIEVEMENTS_VISIBLE = false

export interface AchievementService {
  scan(state: AchievementState, earned: readonly string[]): readonly Achievement[]
}

export const AchievementService = Symbol('AchievementService') as unknown as ServiceToken<AchievementService>
