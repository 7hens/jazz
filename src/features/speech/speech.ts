import type { SpeechService } from '@/shared/services'

type UtteranceFactory = ((text: string) => SpeechSynthesisUtterance) | null

function browserSynthesis(): SpeechSynthesis | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  return window.speechSynthesis
}

function browserUtteranceFactory(): UtteranceFactory {
  if (typeof SpeechSynthesisUtterance === 'undefined') return null
  return text => new SpeechSynthesisUtterance(text)
}

function normalizedLanguage(language: string): string {
  return language.toLowerCase().replace('_', '-')
}

function findVoice(voices: readonly SpeechSynthesisVoice[], language: string): SpeechSynthesisVoice | null {
  const needle = normalizedLanguage(language)
  let voice = voices.find(candidate => normalizedLanguage(candidate.lang) === needle) ?? null

  if (!voice && /^(zh|cmn|yue)(-|$)/i.test(language)) {
    voice =
      voices.find(candidate => /^cmn(-|$)/i.test(candidate.lang) && !candidate.name.includes('+')) ??
      voices.find(candidate => /^cmn(-|$)/i.test(candidate.lang)) ??
      voices.find(candidate => /^zh(-|$)/i.test(candidate.lang)) ??
      voices.find(candidate => /^yue(-|$)/i.test(candidate.lang)) ??
      null
  }

  if (!voice) {
    const main = needle.split('-')[0]
    voice = voices.find(candidate => normalizedLanguage(candidate.lang).split('-')[0] === main) ?? null
  }

  return voice
}

export function createSpeechService(
  synthesis: SpeechSynthesis | null = browserSynthesis(),
  createUtterance: UtteranceFactory = browserUtteranceFactory(),
): SpeechService {
  return {
    speak(text, language = 'zh-CN') {
      if (!synthesis || !createUtterance) return false
      const voice = findVoice(synthesis.getVoices(), language)
      if (!voice) return false

      const utterance = createUtterance(text)
      utterance.voice = voice
      utterance.lang = voice.lang
      utterance.rate = 0.9
      synthesis.cancel()
      synthesis.speak(utterance)
      return true
    },
    stop() {
      synthesis?.cancel()
    },
  }
}
