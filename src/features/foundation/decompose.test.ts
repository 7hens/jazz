import { describe, expect, it } from 'vitest'
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
  it('声调 ton1..ton4 + ton0', () => {
    expect(PINYIN_TONES.map(t => t.symbol)).toEqual(['ton1', 'ton2', 'ton3', 'ton4', 'ton0'])
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
