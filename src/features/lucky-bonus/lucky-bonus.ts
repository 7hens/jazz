// 幸运星尘:概率与金额常量 + 掷骰。rng 可注入便于单测与确定性。

import type { LuckyBonusService, Rng } from '@/shared/services'

export const LUCKY_RATE = 0.1
export const LUCKY_AMOUNT = 50

export function rollLucky(rng: Rng = Math.random): number {
  return rng() < LUCKY_RATE ? LUCKY_AMOUNT : 0
}

export function createLuckyBonusService(): LuckyBonusService {
  return { roll: rollLucky }
}
