import confetti from 'canvas-confetti'
import { CELEBRATE_CUE, type AudioCue, type CelebrateLevel, type CelebrateService } from '@/shared/services'

type Confetti = (options: confetti.Options) => unknown
type Cue = (cue: AudioCue) => void

// 档位即撒花规模。`combo5` 这一档是「放对一块就撒花」的替代 ——
// 一关要落好几块,每块都撒孩子很快就不看了;单块放对**已有**反馈:槽位填色 +
// **落块音效**那一档(`'tap'`,出处 `PinyinBlocksGame.tsx` 的 `placeBlock`)。
// 不写死块数:落块次数 = 该关槽位数、托盘块数另算,任何写死的乘积都会随关卡增删变假。(设计 §3.4)
// `lucky` 夹在 `combo5` 与 `word` 之间:幸运是白捡的,规模不该压过关卡本身。
const CONFIGS: Record<CelebrateLevel, confetti.Options> = {
  combo5: { particleCount: 30, spread: 50 },
  word: { particleCount: 100, spread: 80, origin: { y: 0.6 } },
  combo10: { particleCount: 150, spread: 90 },
  achievement: { particleCount: 200, spread: 120 },
  lucky: { particleCount: 60, spread: 70 },
}

/**
 * `playCue` 是本设计(2026-09-24)加的第二个面。
 *
 * **一个 `play(level)` = 撒花 + 声音**,是刻意的:2026-09-23 那支的「四档声明了没人调」
 * 与 2026-09-24 盘点出的「四档全静音」是同一个成因 —— 两个面分处两地、靠人记得都接。
 * 沉进这里之后,调用点只调一次,结构上不可能只做一半。
 */
export function createCelebrateService(
  playConfetti: Confetti | null = confetti,
  playCue: Cue | null = null,
): CelebrateService {
  return {
    play(level) {
      if (typeof playCue === 'function') playCue(CELEBRATE_CUE[level])
      if (typeof playConfetti !== 'function') return
      void playConfetti(CONFIGS[level])
    },
  }
}
