import type { ServiceToken } from './core'

/**
 * 音效清单。**运行期数组是唯一事实源**,`AudioCue` 由它派生。
 *
 * 为什么不是纯类型:`features/audio/audio.ts` 的分派表是 `Record<AudioCue, …>`,
 * 数组派生让「有哪些 cue」与「每个 cue 怎么响」两件事能在一处对账(见该文件的键集守卫)。
 * 原先是手写 union + 分派链末支无条件 `else`(`= 'tap'`)⇒ 加一个值而忘了实现它
 * **编译期无人报错、运行静默播成「嗒」** —— 本仓具名的静默失效族。
 */
export const AUDIO_CUES = ['correct', 'wrong', 'streak', 'victory', 'tap', 'achievement', 'lucky'] as const

export type AudioCue = (typeof AUDIO_CUES)[number]

export interface AudioService {
  getSnapshot(): boolean
  subscribe(listener: () => void): () => void
  isOn(): boolean
  setOn(on: boolean): void
  play(cue: AudioCue): void
  unlock(): void
}

export const AudioService = Symbol('AudioService') as unknown as ServiceToken<AudioService>
