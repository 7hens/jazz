// 词 → 教学演示分组 + 砖(纯函数)。砖是可点读、可动画合体的最小教学块。
// 拼音:按 decompose 两拼口径逐音节一组「声母砖 + 韵母砖」(零声母/整音节仅韵母砖);
//   group.text = 带调音节 verbatim(UI 合体目标),点读该单元 catalogs 锚点汉字。
// 英语:每字母一组(大写),块同字母,点读字母名(en-US 直读字母=字母名);speakTitle=整词。
// 声调不产独立块:调信息由 group.text 的带调音节承载;若目标含 tonN,quiz 阶段 questionForUnit 单独考。
import type { WordUnit } from '@/shared/services'
import { decomposeWord } from './decompose'
import { ENGLISH_LETTERS, PINYIN_FINALS, PINYIN_INITIALS, PINYIN_TONES, unitKey } from './catalogs'

export type DemoBlock = { id: string; text: string; emoji: string; speak: string }
export type DemoGroup = { text: string; speak: string; blockIds: string[] }
export type DemoData = { title: string; speakTitle: string; groups: DemoGroup[]; blocks: DemoBlock[] }

const anchorOf = (key: string): { hanzi: string; emoji: string } => {
  if (key.startsWith('english:')) {
    const ch = key.slice('english:'.length)
    const u = ENGLISH_LETTERS.find((e) => e.symbol === ch)
    return { hanzi: u?.anchorWord ?? ch, emoji: u?.anchorEmoji ?? '' }
  }
  if (key.startsWith('pinyin:ton')) {
    const u = PINYIN_TONES.find((t) => unitKey('pinyin', t.symbol) === key)
    return { hanzi: u?.anchorHanzi ?? '', emoji: u?.anchorEmoji ?? '' }
  }
  const sym = key.slice('pinyin:'.length)
  const ini = PINYIN_INITIALS.find((i) => i.symbol === sym)
  if (ini) return { hanzi: ini.anchorHanzi, emoji: ini.anchorEmoji }
  const fin = PINYIN_FINALS.find((f) => f.symbol === sym)
  return { hanzi: fin?.anchorHanzi ?? '', emoji: fin?.anchorEmoji ?? '' }
}

export function demoBlocksFor(word: WordUnit, skill: 'pinyin' | 'english'): DemoData {
  const blocks: DemoBlock[] = []
  const groups: DemoGroup[] = []
  let seq = 0
  const pushBlock = (text: string, key: string): string => {
    const id = `demo-${seq++}`
    const a = anchorOf(key)
    blocks.push({ id, text, emoji: a.emoji, speak: a.hanzi || text })
    return id
  }
  if (skill === 'english') {
    for (const l of decomposeWord(word).english) {
      const key = l.unitKey
      const cap = l.char.toUpperCase()
      const id = `demo-${seq++}`
      const a = anchorOf(key)
      blocks.push({ id, text: cap, emoji: a.emoji, speak: l.char })
      groups.push({ text: cap, speak: l.char, blockIds: [id] })
    }
    return { title: word.english, speakTitle: word.english, groups, blocks }
  }
  for (const s of decomposeWord(word).pinyin) {
    const ids: string[] = []
    if (s.initial) ids.push(pushBlock(s.initial, `pinyin:${s.initial}`))
    ids.push(pushBlock(s.final, `pinyin:${s.final}`))
    groups.push({ text: s.text, speak: word.hanzi, blockIds: ids })
  }
  return { title: word.hanzi, speakTitle: word.hanzi, groups, blocks }
}
