import type { SkillKey } from '@/shared/services'

export type Speak = (text: string, language?: string) => boolean

// 发音语言推导:英语一律 en-US;拼音/汉字均为同音汉字 → zh-CN。
// speak 文本本身即发音真相:拼音卡已带同音汉字,汉字/英语卡直读文本。
export function langFor(skill: SkillKey): 'zh-CN' | 'en-US' {
  return skill === 'english' ? 'en-US' : 'zh-CN'
}

/** 朗读一张卡/题干;无可用语音时 tts.speak 静默返回 false,绝不抛错。 */
export function speakCard(speak: Speak, skill: SkillKey, text: string): boolean {
  return speak(text, langFor(skill))
}
