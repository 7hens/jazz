import type { Rng } from './question-engine'

export interface LuckyBonusService {
  roll(rng?: Rng): number
}
