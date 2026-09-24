import type { ServiceToken } from './core'
import type { AudioCue } from './audio'

export const CELEBRATE_LEVELS = ['combo5', 'word', 'combo10', 'achievement', 'lucky'] as const

export type CelebrateLevel = (typeof CELEBRATE_LEVELS)[number]

/**
 * 档 → 声音。**一档一音,同一件事的两个量级共用一串音**:
 * `combo5` / `combo10` 都是 `streak` —— 差别在撒花规模(30 vs 150 粒),
 * 不在音高。再开第三个连击 cue 对孩子只是噪声(同 2026-09-23 spec §3.3「不设第三连击档」)。
 *
 * `word` 那一格用 `'correct'`:`'correct'` 的语义是「对了」,从单块升到整关是一次
 * **语义扩张**,不是新造一个词 —— 换掉的是它「生产零调用点」那个登记面
 * (登记见 `docs/dev-reference.md`)。**这是一次有意的取舍,不是巧合**:
 * 再开一个 `settle` 之类的 cue 会让音效表继续长大,而 4–8 岁要分辨的音越少越好。
 */
export const CELEBRATE_CUE: Record<CelebrateLevel, AudioCue> = {
  combo5: 'streak',
  combo10: 'streak',
  word: 'correct',
  achievement: 'achievement',
  lucky: 'lucky',
}

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
