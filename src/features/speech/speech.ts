import type { SpeakRoleOptions, SpeechRole, SpeechService } from '@/shared/services'

const HEAD_PROTECT_MS = 30

type UtteranceFactory = ((text: string) => SpeechSynthesisUtterance) | null

// 角色 → {rate,pitch}(spec §3.6 数值)。
const SPEECH_ROLE_VOICE: Record<SpeechRole, { rate: number; pitch: number }> = {
  lingling: { rate: 0.75, pitch: 1.2 },
  sun: { rate: 0.65, pitch: 0.8 },
  moon: { rate: 0.7, pitch: 1 },
  jingmo: { rate: 0.6, pitch: 0.5 },
  narrator: { rate: 0.8, pitch: 1 },
  villager: { rate: 0.8, pitch: 1 },
}

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
  // --- Voice cache: Chrome returns [] on the first getVoices() and fills in asynchronously, so
  // prime at creation, refresh on voiceschanged, and keep the last non-empty table — an empty
  // poll must never wipe a good cache. ---
  let cached: SpeechSynthesisVoice[] = []
  function refresh(): SpeechSynthesisVoice[] {
    if (synthesis) {
      const list = synthesis.getVoices()
      if (list.length > 0) cached = list
    }
    return cached
  }

  // The one utterance held back while the engine is still loading its voices.
  type QueueItem = { text: string; language: string; rate: number; pitch?: number }
  let queued: QueueItem | null = null
  let token = 0
  let deferId: ReturnType<typeof setTimeout> | null = null

  // A real engine exposes addEventListener (EventTarget); test fakes may not. Only an engine that
  // can emit `voiceschanged` is worth queueing for — otherwise a held phrase would never play.
  const canWaitForVoices = !!synthesis?.addEventListener

  function play(text: string, language: string, voice: SpeechSynthesisVoice | null, rate: number, pitch?: number): void {
    const s = synthesis!
    const mk = createUtterance!
    const utterance = mk(text)
    utterance.rate = rate
    if (pitch !== undefined) utterance.pitch = pitch
    if (voice) {
      utterance.voice = voice
      utterance.lang = voice.lang
    } else {
      utterance.lang = normalizedLanguage(language)
    }
    const mine = ++token
    if (s.speaking || deferId !== null) {
      // Engine is mid-phrase: stop it, then start the replacement one tick later so the cancel
      // settles — speaking again in the same tick makes Chrome swallow the new utterance head.
      s.cancel()
      if (deferId !== null) clearTimeout(deferId)
      deferId = setTimeout(() => {
        deferId = null
        if (token === mine) s.speak(utterance)
      }, HEAD_PROTECT_MS)
    } else {
      // Idle cold start: speak immediately with no cancel, so nothing delays the first word.
      s.speak(utterance)
    }
  }

  function attempt(text: string, language: string, rate: number, pitch?: number): boolean {
    const voices = refresh()
    const voice = findVoice(voices, language)
    if (voice || voices.length > 0) {
      // Matched voice, or the engine has voices to fall back to its default speaker.
      queued = null
      play(text, language, voice, rate, pitch)
      return true
    }
    if (canWaitForVoices) {
      // Voices are still loading — hold the latest request instead of silently dropping it.
      queued = { text, language, rate, pitch }
      return true
    }
    return false
  }

  function flushQueued(): void {
    if (!queued) return
    const { text, language, rate, pitch } = queued
    const voices = refresh()
    const voice = findVoice(voices, language)
    if (voice || voices.length > 0) {
      queued = null
      play(text, language, voice, rate, pitch)
    }
  }

  // 注:不做引擎预热(放弃 volume=0「无声暖机」)—— Firefox/Chrome 平台 TTS 后端未遵守
  // utterance.volume=0,暖机句 `'a'` 会真实发声(会话首次交互即突兀响一声)。首次朗读的引擎
  // 冷启动延迟/掐头代价换取无无关声音(取舍见 spec §3.6 / PLAN)。
  function onVoicesChanged(): void {
    refresh()
    flushQueued()
  }

  synthesis?.addEventListener?.('voiceschanged', onVoicesChanged)
  refresh() // kick off the async voice load as early as possible

  const service: SpeechService = {
    speak(text, language = 'zh-CN') {
      if (!synthesis || !createUtterance) return false
      return attempt(text, language, 0.9)
    },
    speakRole(text, role, opts?: SpeakRoleOptions) {
      if (!synthesis || !createUtterance) return false
      const base = SPEECH_ROLE_VOICE[role]
      const rate = opts?.rate ?? base.rate
      const pitch = opts?.pitch ?? base.pitch
      return attempt(text, 'zh-CN', rate, pitch)
    },
    stop() {
      token++
      if (deferId !== null) {
        clearTimeout(deferId)
        deferId = null
      }
      queued = null
      synthesis?.cancel()
    },
  }
  return service
}
