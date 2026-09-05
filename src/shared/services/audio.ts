export type AudioCue = 'correct' | 'wrong' | 'streak' | 'victory' | 'tap'

export interface AudioService {
  getSnapshot(): boolean
  subscribe(listener: () => void): () => void
  isOn(): boolean
  setOn(on: boolean): void
  play(cue: AudioCue): void
  unlock(): void
}
