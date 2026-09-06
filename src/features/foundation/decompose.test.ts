import { describe, expect, it } from 'vitest'
import type { WordUnit } from '@/shared/services'
import { WORDS } from '@/features/vocabulary/words'
import { decomposeWord, unitsFor } from './decompose'
import { PINYIN_FINALS, PINYIN_INITIALS, PINYIN_TONES, ENGLISH_LETTERS } from './catalogs'

const catalogSymbols = new Set<string>([
  ...PINYIN_INITIALS.map(u => `pinyin:${u.symbol}`),
  ...PINYIN_FINALS.map(u => `pinyin:${u.symbol}`),
  ...PINYIN_TONES.map(u => `pinyin:${u.symbol}`),
  ...ENGLISH_LETTERS.map(u => `english:${u.symbol}`),
])

describe('catalogs 完整性', () => {
  it('声母 23 且符号唯一', () => {
    expect(PINYIN_INITIALS).toHaveLength(23)
    expect(new Set(PINYIN_INITIALS.map(u => u.symbol)).size).toBe(23)
  })
  it('声调 ton1..ton4(轻声已退役)', () => {
    expect(PINYIN_TONES.map(t => t.symbol)).toEqual(['ton1', 'ton2', 'ton3', 'ton4'])
  })
  it('英文字母 26 唯一', () => {
    expect(ENGLISH_LETTERS).toHaveLength(26)
    expect(new Set(ENGLISH_LETTERS.map(u => u.symbol)).size).toBe(26)
  })
  it('锚点汉字/emoji 非空且不重复', () => {
    const all = [...PINYIN_INITIALS, ...PINYIN_FINALS, ...PINYIN_TONES]
    for (const u of all) {
      expect(u.anchorHanzi.length).toBeGreaterThan(0)
      expect(u.anchorEmoji.length).toBeGreaterThan(0)
    }
  })
})

const pseudoUnit = (pinyin: string, hanzi: string): WordUnit =>
  ({ id: -1, emoji: '', pinyin, hanzi, english: '', category: 'shape' })

describe('锚点不变量:声母∪韵母独立单字整音节锚', () => {
  const all = [...PINYIN_INITIALS, ...PINYIN_FINALS]

  it('锚汉字两两不同、锚 emoji 两两不同', () => {
    const hanzi = all.map((u) => u.anchorHanzi)
    const emoji = all.map((u) => u.anchorEmoji)
    expect(new Set(hanzi).size).toBe(hanzi.length)
    expect(new Set(emoji).size).toBe(emoji.length)
  })

  it('锚汉字均单字、锚拼音均单音节(无空格)', () => {
    for (const u of all) {
      expect([...u.anchorHanzi]).toHaveLength(1)
      expect(u.anchorPinyin.includes(' ')).toBe(false)
    }
  })

  it('每个韵母锚单音节自拆归口恰本单元(无第二韵母)', () => {
    for (const f of PINYIN_FINALS) {
      const { pinyin } = decomposeWord(pseudoUnit(f.anchorPinyin, f.anchorHanzi))
      expect(pinyin.map((s) => s.final), `${f.symbol}(${f.anchorHanzi})`).toEqual([f.symbol])
    }
  })

  it('声母锚以该声母开头(y/w 例外:锚字以 y/w 拼写起头)', () => {
    for (const u of PINYIN_INITIALS) {
      if (u.symbol === 'y' || u.symbol === 'w') {
        expect(u.anchorPinyin[0]).toBe(u.symbol)
        continue
      }
      const { pinyin } = decomposeWord(pseudoUnit(u.anchorPinyin, u.anchorHanzi))
      expect(pinyin[0].initial, `${u.symbol}(${u.anchorHanzi})`).toBe(u.symbol)
    }
  })
})

describe('韵母锚零声母纯整音节钉值(读感纯,禁裹声母字回滑)', () => {
  // 这批韵母有常用零声母整音节字,锚须为纯读零声母,不用「带声母的含该韵母字」(如 象/雪/蟹)污染听感。
  const pure: Record<string, { hanzi: string; pinyin: string; emoji: string }> = {
    ie: { hanzi: '叶', pinyin: 'yè', emoji: '🍃' },
    ian: { hanzi: '眼', pinyin: 'yǎn', emoji: '👀' },
    iang: { hanzi: '阳', pinyin: 'yáng', emoji: '☀️' },
    ing: { hanzi: '鹰', pinyin: 'yīng', emoji: '🦅' },
    uan: { hanzi: '碗', pinyin: 'wǎn', emoji: '🥣' },
    uang: { hanzi: '王', pinyin: 'wáng', emoji: '👑' },
    üe: { hanzi: '月', pinyin: 'yuè', emoji: '🌙' },
  }

  it('钉值:目录 字/音/emoji 与表中一致', () => {
    for (const [symbol, v] of Object.entries(pure)) {
      const u = PINYIN_FINALS.find((f) => f.symbol === symbol)
      expect(u).toBeDefined()
      expect(
        { hanzi: u!.anchorHanzi, pinyin: u!.anchorPinyin, emoji: u!.anchorEmoji },
        `${symbol} 锚值`
      ).toEqual(v)
    }
  })

  it('钉值:自拆为零声母整音节(initial null),归口恰本单元', () => {
    for (const [symbol, v] of Object.entries(pure)) {
      const { pinyin } = decomposeWord(pseudoUnit(v.pinyin, v.hanzi))
      expect(
        pinyin.map((s) => ({ initial: s.initial, final: s.final })),
        `${symbol}(${v.hanzi}) 应零声母纯读`
      ).toEqual([{ initial: null, final: symbol }])
    }
  })
})

describe('decompose 全 100 词', () => {
  it('每词可拆,拼音 round-trip == 原文本', () => {
    for (const word of WORDS) {
      const parts = decomposeWord(word)
      expect(parts.english.length).toBeGreaterThan(0)
      const joined = parts.pinyin.map(s => s.text).join(' ')
      expect(joined).toBe(word.pinyin) // 重组精确复原(含声调)
      for (const s of parts.pinyin) {
        for (const key of s.unitKeys) expect(catalogSymbols.has(key)).toBe(true)
      }
      for (const l of parts.english) expect(catalogSymbols.has(l.unitKey)).toBe(true)
    }
  })
  it('unitsFor 命中词 21 苹果拼音含声母 p/韵母 ing/声调 2', () => {
    const keys = unitsFor(21, 'pinyin', WORDS)
    expect(keys).toContain('pinyin:p')
    expect(keys).toContain('pinyin:ing')
    expect(keys).toContain('pinyin:ton2')
  })
  it('hanzi 技能恒无基础单元', () => {
    expect(unitsFor(21, 'hanzi', WORDS)).toEqual([])
  })
})

describe('decompose 音节 ↔ 词内汉字对齐', () => {
  it('逐 100 词:拼音音节数与汉字数一致,逐位 hanzi 匹配', () => {
    for (const word of WORDS) {
      const chars = [...word.hanzi]
      const { pinyin } = decomposeWord(word)
      expect(pinyin.length).toBe(chars.length)
      pinyin.forEach((s, i) => expect(s.hanzi).toBe(chars[i]))
    }
  })
})
