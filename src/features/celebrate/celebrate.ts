import confetti from 'canvas-confetti'
import type { CelebrateLevel, CelebrateService } from '@/shared/services'

type Confetti = (options: confetti.Options) => unknown

// 档位即撒花规模。`combo5` 这一档是「放对一块就撒花」的替代 ——
// 一关 15 块 × 30 粒 = 撒 15 次,孩子很快就不看了;单块反馈已有槽位填色 + correct 音效(设计 §3.4)。
const CONFIGS: Record<CelebrateLevel, confetti.Options> = {
  combo5: { particleCount: 30, spread: 50 },
  word: { particleCount: 100, spread: 80, origin: { y: 0.6 } },
  combo10: { particleCount: 150, spread: 90 },
  achievement: { particleCount: 200, spread: 120 },
}

export function createCelebrateService(playConfetti: Confetti | null = confetti): CelebrateService {
  return {
    play(level) {
      if (typeof playConfetti !== 'function') return
      void playConfetti(CONFIGS[level])
    },
  }
}
