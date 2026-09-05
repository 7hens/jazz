import type { ServiceToken } from './token'

export type CelebrateLevel = 'step' | 'word' | 'achievement' | 'combo10'

export interface CelebrateService {
  play(level: CelebrateLevel): void
}

export const CelebrateService = Symbol('CelebrateService') as unknown as ServiceToken<CelebrateService>
