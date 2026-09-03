import confetti from 'canvas-confetti'

export type CelebrateLevel = 'step' | 'word' | 'achievement' | 'combo10'

const CONFIGS: Record<CelebrateLevel, confetti.Options> = {
  step: { particleCount: 30, spread: 50 },
  word: { particleCount: 100, spread: 80, origin: { y: 0.6 } },
  achievement: { particleCount: 200, spread: 120 },
  combo10: { particleCount: 150, spread: 90 },
}

export function celebrate(level: CelebrateLevel): void {
  if (typeof confetti !== 'function') return
  confetti(CONFIGS[level])
}
