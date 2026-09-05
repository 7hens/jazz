import confetti from 'canvas-confetti'
import type { CelebrateLevel, CelebrateService } from '@/shared/services'

type Confetti = (options: confetti.Options) => unknown

const CONFIGS: Record<CelebrateLevel, confetti.Options> = {
  step: { particleCount: 30, spread: 50 },
  word: { particleCount: 100, spread: 80, origin: { y: 0.6 } },
  achievement: { particleCount: 200, spread: 120 },
  combo10: { particleCount: 150, spread: 90 },
}

export function createCelebrateService(playConfetti: Confetti | null = confetti): CelebrateService {
  return {
    play(level) {
      if (typeof playConfetti !== 'function') return
      void playConfetti(CONFIGS[level])
    },
  }
}
