import type { ServiceToken } from './token'

export interface SpeechService {
  speak(text: string, lang?: string): boolean
  stop(): void
}

export const SpeechService = Symbol('SpeechService') as unknown as ServiceToken<SpeechService>
