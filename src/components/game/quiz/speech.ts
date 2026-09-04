import { speak } from '../../../game/tts'
import type { KingdomKey } from '@/shared/types'

// 发音语言推导:英语王国一律 en-US;mixed(第 10 关)按朗读文本字符集判定
// (拉丁字母/单词 → en-US,汉字 → zh-CN);其余王国(pinyin/hanzi)的 speak 均为同音汉字 → zh-CN。
// speak 文本本身即发音真相:拼音卡已带同音汉字,汉字/英语卡直读文本。
export function langFor(kingdom: KingdomKey | 'mixed', text: string): 'zh-CN' | 'en-US' {
  if (kingdom === 'english') return 'en-US'
  if (kingdom === 'mixed') return /^[\x20-\x7E]+$/.test(text) ? 'en-US' : 'zh-CN'
  return 'zh-CN'
}

/** 朗读一张卡/题干;无可用语音时 tts.speak 静默返回 false,绝不抛错。 */
export function speakCard(kingdom: KingdomKey | 'mixed', text: string): boolean {
  return speak(text, langFor(kingdom, text))
}
