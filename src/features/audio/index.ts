import { registry } from '@/shared/registry'
import type { AudioCue } from '@/shared/services'

export { createAudioService, SOUND_KEY } from './audio'
export type { AudioServiceOptions } from './audio'

// Compatibility for the current App and views; Tasks 9 and 11 replace these with Entry-provided values.
export function getSoundOn(): boolean {
  return registry.get('audio').isOn()
}

export function setSoundOn(on: boolean): void {
  registry.get('audio').setOn(on)
}

export function play(cue: AudioCue): void {
  registry.get('audio').play(cue)
}

export function unlockAudio(): void {
  registry.get('audio').unlock()
}
