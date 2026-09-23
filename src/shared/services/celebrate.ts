import type { ServiceToken } from './core'

export type CelebrateLevel = 'combo5' | 'word' | 'combo10' | 'achievement'

/**
 * 连击数 → 撒花档。**只有 5 与 10 两档**,其余返回 `null`(不撒)。
 *
 * 15 连走的是成就 `combo_15`(由 `achievement` 档撒花),**故意不设第三档** ——
 * 三个连击档对孩子只是噪声(设计 §3.3 的表)。
 *
 * 放在 shared 而不是 features/combo:`LevelEntry` 在 features/pinyin-blocks,
 * 引 features/combo 就是跨 feature 编译期互引(architecture.test.ts 守的边界)。
 */
export function celebrationFor(combo: number): CelebrateLevel | null {
  if (combo === 5) return 'combo5'
  if (combo === 10) return 'combo10'
  return null
}

export interface CelebrateService {
  play(level: CelebrateLevel): void
}

export const CelebrateService = Symbol('CelebrateService') as unknown as ServiceToken<CelebrateService>
