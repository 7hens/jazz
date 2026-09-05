export type CelebrateLevel = 'step' | 'word' | 'achievement' | 'combo10'

export interface CelebrateService {
  play(level: CelebrateLevel): void
}
