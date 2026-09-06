// 拼音/英语基础单元拆解(纯函数,词列表以入参注入;不引词库)。
// 拼音两拼口径:
//   - 按空格切音节;保留原文(text)做 round-trip。
//   - 由调号得声调;还原无调号底字母再做声母/韵母查找。
//   - y/w 起头音节一律当零声母整音节,经 Y_W_SPELLINGS 查表得底层韵母(永不产出 pinyin:y/w)。
//   - 其余先剥最长声母;残留若非 j/q/x 真 u(剥 u→ü)则归一写法缩写 iu/ui/un→iou/uei/uen。
//   - 任一残留归不了韵母目录即抛错,由测试驱动补目录/Y_W 表。

import type { SkillKey, WordUnit } from '@/shared/services'
import { PINYIN_FINALS, PINYIN_INITIALS } from './catalogs'

/** 拆出的单音节。text = 原文(带调号,verbatim);initial 空即零声母;hanzi = 词内该音节对应汉字。 */
export type PinyinSyllable = {
  text: string
  initial: string | null
  final: string
  tone: number
  unitKeys: string[]
  hanzi: string
}

/** 英语字母拆解行(char 为小写字母;unitKey = 目录键 english:<char>)。注意:与 catalogs 的 EnglishLetter(目录条目)同名不同形,故不跨文件引用。 */
export type EnglishLetter = { char: string; unitKey: string }

/** y/w 整音节 → 底层韵母(键为去调底字母)。方案全形,含词库实测 + 方案常列项。 */
export const Y_W_SPELLINGS: Readonly<Record<string, string>> = {
  yi: 'i',
  ya: 'ia',
  ye: 'ie',
  yao: 'iao',
  you: 'iou',
  yan: 'ian',
  yang: 'iang',
  yin: 'in',
  ying: 'ing',
  yong: 'iong',
  yu: 'ü',
  yue: 'üe',
  yuan: 'üan',
  yun: 'ün',
  wu: 'u',
  wa: 'ua',
  wo: 'uo',
  wan: 'uan',
  wei: 'uei',
  wen: 'uen',
  wang: 'uang',
  weng: 'ueng',
}

// 调号 → 底字母 + 声调。
const TONE_OF: Readonly<Record<string, { base: string; tone: number }>> = {
  ā: { base: 'a', tone: 1 },
  á: { base: 'a', tone: 2 },
  ǎ: { base: 'a', tone: 3 },
  à: { base: 'a', tone: 4 },
  ē: { base: 'e', tone: 1 },
  é: { base: 'e', tone: 2 },
  ě: { base: 'e', tone: 3 },
  è: { base: 'e', tone: 4 },
  ī: { base: 'i', tone: 1 },
  í: { base: 'i', tone: 2 },
  ǐ: { base: 'i', tone: 3 },
  ì: { base: 'i', tone: 4 },
  ō: { base: 'o', tone: 1 },
  ó: { base: 'o', tone: 2 },
  ǒ: { base: 'o', tone: 3 },
  ò: { base: 'o', tone: 4 },
  ū: { base: 'u', tone: 1 },
  ú: { base: 'u', tone: 2 },
  ǔ: { base: 'u', tone: 3 },
  ù: { base: 'u', tone: 4 },
  ǖ: { base: 'ü', tone: 1 },
  ǘ: { base: 'ü', tone: 2 },
  ǚ: { base: 'ü', tone: 3 },
  ǜ: { base: 'ü', tone: 4 },
}

const FINAL_SYMBOLS = new Set(PINYIN_FINALS.map((f) => f.symbol))
// 最长优先:zh/ch/sh 先于单字母。
const INITIAL_SYMBOLS = [...PINYIN_INITIALS.map((u) => u.symbol)].sort((a, b) => b.length - a.length)
const JQX = new Set(['j', 'q', 'x'])
// 声母后写法缩写 → 方案韵母全形。
const SHORT_FINALS: Readonly<Record<string, string>> = { iu: 'iou', ui: 'uei', un: 'uen' }

function stripTone(text: string): { base: string; tone: number } {
  let tone = 0
  let base = ''
  for (const ch of text) {
    const m = TONE_OF[ch]
    if (m) {
      tone = m.tone
      base += m.base
    } else {
      base += ch
    }
  }
  return { base, tone }
}

function toPinyinKey(sym: string): string {
  return `pinyin:${sym}`
}

function decomposeSyllable(text: string): PinyinSyllable {
  const { base, tone } = stripTone(text)
  const head = base[0]
  let initial: string | null
  let final: string

  if (head === 'y' || head === 'w') {
    // 零声母整音节:y/w 起头不拆声母。
    const mapped = Y_W_SPELLINGS[base]
    if (!mapped) throw new Error(`foundation/decompose: 缺 Y_W_SPELLINGS 条目 "${text}"(${base})`)
    initial = null
    final = mapped
  } else {
    const ini = INITIAL_SYMBOLS.find((s) => base.startsWith(s)) ?? null
    if (ini) {
      let residue = base.slice(ini.length)
      if (JQX.has(ini) && residue.startsWith('u')) residue = `ü${residue.slice(1)}`
      const full = SHORT_FINALS[residue] ?? residue
      if (!FINAL_SYMBOLS.has(full)) throw new Error(`foundation/decompose: 韵母未收录 "${text}" → ${ini}+${full}`)
      initial = ini
      final = full
    } else {
      // 非 y/w 零声母整音节:整音节即韵母。
      const full = SHORT_FINALS[base] ?? base
      if (!FINAL_SYMBOLS.has(full)) throw new Error(`foundation/decompose: 零声母韵母未收录 "${text}"(${full})`)
      initial = null
      final = full
    }
  }

  const unitKeys: string[] = []
  if (initial) unitKeys.push(toPinyinKey(initial))
  unitKeys.push(toPinyinKey(final))
  unitKeys.push(toPinyinKey(tone === 0 ? 'ton0' : `ton${tone}`))
  return { text, initial, final, tone, unitKeys, hanzi: '' }
}

/** 拆一词:pinyin = 逐音节(文本 verbatim 保留,逐音节按序回填词内汉字);english = 逐字母(小写,跳过非 a-z)。 */
export function decomposeWord(word: WordUnit): { pinyin: PinyinSyllable[]; english: EnglishLetter[] } {
  const chars = [...word.hanzi]
  const pinyin = word.pinyin
    .split(' ')
    .filter((s) => s.length > 0)
    .map((text, i) => ({ ...decomposeSyllable(text), hanzi: chars[i] ?? '' }))
  const english: EnglishLetter[] = []
  for (const ch of word.english) {
    const lower = ch.toLowerCase()
    if (/[a-z]/.test(lower)) english.push({ char: lower, unitKey: `english:${lower}` })
  }
  return { pinyin, english }
}

/** 词 × 技能 → 基础单元 key(去重保序)。hanzi 恒 [];拼音取各音节 unitKeys;英语取字母键。词缺失返回 []。 */
export function unitsFor(wordId: number, skill: SkillKey, words: readonly WordUnit[]): readonly string[] {
  const word = words.find((w) => w.id === wordId)
  if (!word || skill === 'hanzi') return []
  const seen = new Set<string>()
  const out: string[] = []
  const pushUnique = (key: string): void => {
    if (!seen.has(key)) {
      seen.add(key)
      out.push(key)
    }
  }
  const parts = decomposeWord(word)
  if (skill === 'english') {
    for (const l of parts.english) pushUnique(l.unitKey)
    return out
  }
  // pinyin
  for (const s of parts.pinyin) for (const key of s.unitKeys) pushUnique(key)
  return out
}
