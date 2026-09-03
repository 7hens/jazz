// src/game/words.test.ts
import { describe, expect, it } from 'vitest'
import { CATEGORY_LABELS, WORDS, wordById } from '../data/words'
import type { CategoryKey } from '../types'

const CATS = Object.keys(CATEGORY_LABELS) as CategoryKey[]

describe('词库数据完整性', () => {
  it('恰好 100 词且 id 与下标连续一致', () => {
    expect(WORDS).toHaveLength(100)
    WORDS.forEach((w, i) => expect(w.id).toBe(i + 1))
  })

  it('关键字段非空且汉字/英文全局唯一', () => {
    const hanzi = new Set(WORDS.map((w) => w.hanzi))
    const en = new Set(WORDS.map((w) => w.english))
    expect(hanzi.size).toBe(100)
    expect(en.size).toBe(100)
    for (const w of WORDS) {
      expect(w.emoji).toBeTruthy()
      expect(w.pinyin).toBeTruthy()
      expect(w.hanzi).toBeTruthy()
      expect(w.english).toBeTruthy()
    }
  })

  it('分类合法且每类 ≥ 8 词(保证同类别干扰项基数)', () => {
    for (const c of CATS) {
      expect(WORDS.filter((w) => w.category === c).length).toBeGreaterThanOrEqual(8)
    }
  })

  it('已知笔误已修正:饼干拼音为 bǐng gān', () => {
    const cookie = wordById(35)
    expect(cookie?.hanzi).toBe('饼干')
    expect(cookie?.pinyin).toBe('bǐng gān')
    expect(cookie?.english).toBe('cookie')
  })

  it('wordById 越界返回 undefined', () => {
    expect(wordById(0)).toBeUndefined()
    expect(wordById(101)).toBeUndefined()
  })
})
