import type { ServiceToken } from './core'

/** [0,1) 随机数源;可注入以保证单测确定性(旧 question-engine 契约已随词课删除,本文件是它在 shared 的唯一去向)。 */
export type Rng = () => number

export interface LuckyBonusService {
  roll(rng?: Rng): number
}

export const LuckyBonusService = Symbol('LuckyBonusService') as unknown as ServiceToken<LuckyBonusService>
