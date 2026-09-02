// TTS 封装：文本转语音。无该语言语音时静默降级（返回 false），绝不抛错。
//
// 注意:speak 前先 synth.cancel() 打断前句。若某文本在极短时间内被连续请求两次
// (如 React StrictMode 重放 effect),第二次 cancel 会丢掉第一次正在合成的 utterance
// (speech-dispatcher 后端下实际无声)——调用方需自行去重(见 ListenChoice 的 saidRef)。

function normLang(l: string): string {
  return l.toLowerCase().replace('_', '-')
}

export function speak(text: string, lang = 'zh-CN'): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false
  const synth = window.speechSynthesis
  // 每次实时枚举,不用模块级 cache:Linux speech-dispatcher 后端语音列表加载晚,
  // stale cache 会误判“无语音”。
  const voices = synth.getVoices()
  const needle = normLang(lang)

  // 1) 精确匹配请求语言(zh-CN / en-US 标准系统)
  let voice = voices.find((v) => normLang(v.lang) === needle) ?? null

  if (!voice) {
    // 2) 中文请求:语音码可能是 espeak-ng 的 ISO 639-3 `cmn`(普通话)/`yue`(粤语),
    //    而非 BCP-47 `zh-CN`。优先普通话 base voice(名字无 “+变体” 后缀)。
    if (/^(zh|cmn|yue)(-|$)/i.test(lang)) {
      voice =
        voices.find((v) => /^cmn(-|$)/i.test(v.lang) && !v.name.includes('+')) ??
        voices.find((v) => /^cmn(-|$)/i.test(v.lang)) ??
        voices.find((v) => /^zh(-|$)/i.test(v.lang)) ??
        voices.find((v) => /^yue(-|$)/i.test(v.lang)) ??
        null
    }
    // 3) 其它语言:按主语言前缀匹配首可用语音(en-US → 任意 en-*)
    if (!voice) {
      const main = needle.split('-')[0]
      voice = voices.find((v) => normLang(v.lang).split('-')[0] === main) ?? null
    }
  }

  if (!voice) return false // 无该语言语音 → 静音降级(答题不阻断)
  const u = new SpeechSynthesisUtterance(text)
  u.voice = voice
  u.lang = voice.lang
  u.rate = 0.9
  synth.cancel()
  synth.speak(u)
  return true
}
