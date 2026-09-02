// TTS 封装：文本转语音。中文语音缺失时静默降级（返回 false），绝不抛错。

let voiceCache: SpeechSynthesisVoice[] | null = null

function refreshVoices(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  voiceCache = window.speechSynthesis.getVoices()
}

// 首次 getVoices() 常为空，需监听 voiceschanged 后缓存一次，避免首次 speak 误判为“无中文语音”。
refreshVoices()
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.addEventListener('voiceschanged', refreshVoices)
}

function normLang(l: string): string {
  return l.toLowerCase().replace('_', '-')
}

export function speak(text: string, lang = 'zh-CN'): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false
  const synth = window.speechSynthesis
  const voices = voiceCache ?? synth.getVoices()
  const needle = normLang(lang)
  const voice = voices.find((v) => normLang(v.lang) === needle) ?? null
  if (lang.startsWith('zh') && !voice) return false // 无中文语音 → 静音降级
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang
  if (voice) u.voice = voice
  u.rate = 0.9
  synth.cancel()
  synth.speak(u)
  return true
}
