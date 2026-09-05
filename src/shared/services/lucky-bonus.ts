import type { Rng } from './question-engine'
import type { ServiceToken } from './manager'

export interface LuckyBonusService {
  roll(rng?: Rng): number
}

export const LuckyBonusService = Symbol('LuckyBonusService') as unknown as ServiceToken<LuckyBonusService>
