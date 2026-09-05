import { registry } from '@/shared/registry'

export { createSpeechService } from './speech'

// Compatibility for the current quiz components; Task 9 replaces it with Entry-provided callbacks.
export function speak(text: string, lang = 'zh-CN'): boolean {
  return registry.get('speech').speak(text, lang)
}
