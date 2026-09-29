// 一次通关的结算:星级落库 + 星尘入账 + 成就扫描 + 连续天数推进。
// 纯协调器 —— 服务由调用方注入,本文件不碰 useService。
//
// 时间与随机都可注入,保证单测确定性。

import type {
  Achievement,
  AchievementState,
  LevelStars,
  Rng,
  UserSettings,
} from '@/shared/services'
import { UNITS } from './levels'
import {
  completedLevelCount,
  perfectLevelCount,
  perfectUnitCount,
  totalLevelCount,
} from './progress-stats'

export type LevelSettlement = Readonly<{
  stars: number
  /** 本次入账的星尘(连击加成 + 幸运 + 成就奖励)。 */
  starDust: number
  luckyReward: number
  achievements: readonly Achievement[]
  /** 结算后的会话首通数 —— 交回调用方存着,下次结算再带进来。 */
  sessionCleared: number
}>

/**
 * 交回给上层的账 —— **一部分一笔**,不是一题一笔。
 *
 * 为什么不是 `LevelSettlement`:那个结构里的 `stars` 是「这一题拿了几星」,
 * 累积十道题之后这个数字没有意义(求和得到 30 星?)。上层真正要的是
 * 「这一部分新出了哪些成就、多少星尘」—— 撒花与弹层就判这两个。
 */
export type PartSettlement = Readonly<{
  /** 本部分入账的星尘合计(连击加成 + 幸运 + 成就奖励)。 */
  starDust: number
  luckyReward: number
  /** 本部分新得的成就,**按 id 去重**(同一部分里两道题各触发一次只算一条)。 */
  achievements: readonly Achievement[]
  /** 部分末的会话首通数 —— 交回调用方存着,下一部分再带进来。 */
  sessionCleared: number
}>

/** 部分开始时的那笔空账。`mergeSettlement` 拿它当加法的单位元。 */
export const EMPTY_PART_SETTLEMENT: PartSettlement = {
  starDust: 0,
  luckyReward: 0,
  achievements: [],
  sessionCleared: 0,
}

/**
 * 把一题的结算并进本部分的账。**纯函数** —— 攒账本身不碰服务、不写库(写库在 `settleLevel` 里已经做了)。
 *
 * `sessionCleared` 是**取最新**而不是相加:它是 `settleLevel` 交回的绝对量
 * *(「本次会话已首通的关数」),相加会把它翻倍。
 *
 * **调用顺序约束:`next` 必须比 `into` 更晚(按题目顺序合并)。** 乱序合并会让
 * `sessionCleared` 回退 —— 后并进来的旧账会把新账的会话首通数盖回去。
 */
export function mergeSettlement(into: PartSettlement, next: LevelSettlement): PartSettlement {
  const seen = new Set(into.achievements.map((achievement) => achievement.id))
  return {
    starDust: into.starDust + next.starDust,
    luckyReward: into.luckyReward + next.luckyReward,
    achievements: [...into.achievements, ...next.achievements.filter((a) => !seen.has(a.id))],
    sessionCleared: next.sessionCleared,
  }
}

export type SettleInput = Readonly<{
  levelId: string
  /**
   * 本次拿到的星。**接受 [0,3]**,0 = 失败;域外的值(负数/小数/NaN/超过 3)
   * 在 `settleLevel` 里被归一,下游只见归一后的值。
   */
  stars: number
  /** 结算**之前**的星级表 —— 用来判断这是不是首通。 */
  currentStars: LevelStars
  totalStars: number
  settings: UserSettings
  /** 本次会话(浏览器会话内)已首通的关数。 */
  sessionCleared: number
  /** 本次会话里的最高连击 —— 由调用方从 ComboService 快照读。 */
  maxCombo: number
  now?: () => Date
  rng?: Rng
}>

export type SettleServices = Readonly<{
  progress: { recordClear(clear: { levelId: string; stars: number; starDust: number }): Promise<void> }
  settings: { save(settings: UserSettings): Promise<void> }
  combo: { getBonus(): number }
  lucky: { roll(rng?: Rng): number }
  achievements: { scan(state: AchievementState, earned: readonly string[]): readonly Achievement[] }
}>

const pad = (value: number) => String(value).padStart(2, '0')

function todayKey(now: Date): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function shiftDate(date: string, delta: number): number {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + delta).getTime()
}

function nextConsecutive(previous: number, lastDate: string, today: string): number {
  if (lastDate === '') return 1
  if (lastDate === today) return previous
  const yesterday = todayKey(new Date(shiftDate(today, -1)))
  return yesterday === lastDate ? previous + 1 : 1
}

export async function settleLevel(input: SettleInput, services: SettleServices): Promise<LevelSettlement> {
  const clock = input.now ?? (() => new Date())
  const now = clock()
  const today = todayKey(now)

  // 信任边界:星级只接受 [0,3] 的整数。服务端落库走 MAX 合并、只升不降,
  // 混进来的 4 写进去就永远回不来(不可撤销的数据污染),所以在这里收拾干净。
  // 下界是 0 不是 1 —— 把 0 星抬成 1 星等于失败送星。
  const stars = Number.isFinite(input.stars) ? Math.min(3, Math.max(0, Math.trunc(input.stars))) : 0

  // 首通 = 这一关此前一颗星都没有,**且这次是真的过关了**。
  // `stars === 0`(失败)不是通关:不认它,否则故意输也能掷幸运、
  // 也能刷 `firstCompleteToday`(连败 5 次解锁「马拉松」)。
  const firstClear = stars > 0 && (input.currentStars[input.levelId] ?? 0) === 0

  // 重玩不再掷幸运、不再计首通 —— 否则刷同一关就能刷星尘,运气变成农活。
  const comboReward = stars > 0 ? services.combo.getBonus() : 0
  const luckyReward = firstClear ? services.lucky.roll(input.rng) : 0

  const nextStars: LevelStars = {
    ...input.currentStars,
    [input.levelId]: Math.max(input.currentStars[input.levelId] ?? 0, stars),
  }
  const settingsWithStreak: UserSettings = {
    ...input.settings,
    lastActiveDate: today,
    consecutiveDays: nextConsecutive(input.settings.consecutiveDays, input.settings.lastActiveDate, today),
  }
  const sessionCleared = input.sessionCleared + (firstClear ? 1 : 0)

  const achievements = services.achievements.scan({
    totalLevels: totalLevelCount(UNITS),
    completedLevels: completedLevelCount(nextStars, UNITS),
    perfectLevels: perfectLevelCount(nextStars, UNITS),
    perfectUnits: perfectUnitCount(nextStars, UNITS),
    maxCombo: input.maxCombo,
    firstCompleteToday: sessionCleared,
    consecutiveDays: settingsWithStreak.consecutiveDays,
    hour: now.getHours(),
  }, [...settingsWithStreak.earnedAchievements])

  const achievementReward = achievements.reduce((sum, achievement) => sum + achievement.reward, 0)
  const starDust = comboReward + luckyReward + achievementReward

  const settings: UserSettings = achievements.length === 0
    ? settingsWithStreak
    : {
        ...settingsWithStreak,
        earnedAchievements: Array.from(new Set([
          ...settingsWithStreak.earnedAchievements,
          ...achievements.map((achievement) => achievement.id),
        ])),
      }

  await Promise.allSettled([
    services.progress.recordClear({ levelId: input.levelId, stars, starDust }),
    services.settings.save(settings),
  ])

  return { stars, starDust, luckyReward, achievements, sessionCleared }
}
