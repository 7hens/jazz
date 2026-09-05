export interface SpeechService {
  speak(text: string, lang?: string): boolean
  stop(): void
}
