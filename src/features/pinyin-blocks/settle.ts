// 一次通关的结算:星级落库 + 星尘入账 + 成就扫描 + 连续天数推进。
// 纯协调器 —— 服务由调用方注入(照旧 settlement.ts 的做法),本文件不碰 useService。
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

export type SettleInput = Readonly<{
  levelId: string
  /** 本次拿到的星(1..3)。 */
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

  // 首通 = 这一关此前一颗星都没有,**且这次是真的过关了**。
  // `stars === 0`(失败)落在 SettleInput.stars 的域(1..3)之外:不认它,
  // 否则故意输也能掷幸运、也能刷 `firstCompleteToday`(连败 5 次解锁「马拉松」)。
  const firstClear = input.stars > 0 && (input.currentStars[input.levelId] ?? 0) === 0

  // 重玩不再掷幸运、不再计首通 —— 否则刷同一关就能刷星尘,运气变成农活。
  const comboReward = input.stars > 0 ? services.combo.getBonus() : 0
  const luckyReward = firstClear ? services.lucky.roll(input.rng) : 0

  const nextStars: LevelStars = {
    ...input.currentStars,
    [input.levelId]: Math.max(input.currentStars[input.levelId] ?? 0, input.stars),
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
    services.progress.recordClear({ levelId: input.levelId, stars: input.stars, starDust }),
    services.settings.save(settings),
  ])

  return { stars: input.stars, starDust, luckyReward, achievements, sessionCleared }
}
