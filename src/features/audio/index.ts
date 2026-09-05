import { registry } from '@/shared/registry'
import { AudioService } from '@/shared/services'
import type { AudioCue } from '@/shared/services'

export { createAudioService, SOUND_KEY } from './audio'
export type { AudioServiceOptions } from './audio'

// Compatibility for the current App and views; Tasks 9 and 11 replace these with Entry-provided values.
export function getSoundOn(): boolean {
  return registry.get(AudioService).isOn()
}

export function setSoundOn(on: boolean): void {
  registry.get(AudioService).setOn(on)
}

export function play(cue: AudioCue): void {
  registry.get(AudioService).play(cue)
}

export function unlockAudio(): void {
  registry.get(AudioService).unlock()
}
