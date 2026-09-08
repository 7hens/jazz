import { describe, expect, it } from 'vitest'
import type { CategoryKey, PartOfSpeech } from '@/shared/services'
import { CATEGORY_LABELS } from '@/shared/services'
import { WORDS, wordById } from './words'

// story 类词不进 letter-forest 主题网格(千字谷章节用),「每类 ≥ 8」只约束原 5 主题
const CATS = (Object.keys(CATEGORY_LABELS) as CategoryKey[]).filter((c) => c !== 'story')

describe('词库数据完整性', () => {
  it('恰好 103 词且 id 与下标连续一致', () => {
    expect(WORDS).toHaveLength(103)
    WORDS.forEach((w, i) => expect(w.id).toBe(i + 1))
  })

  it('关键字段非空且汉字/英文全局唯一', () => {
    const hanzi = new Set(WORDS.map((w) => w.hanzi))
    const en = new Set(WORDS.map((w) => w.english))
    expect(hanzi.size).toBe(103)
    expect(en.size).toBe(103)
    for (const w of WORDS) {
      expect(w.emoji).toBeTruthy()
      expect(w.pinyin).toBeTruthy()
      expect(w.hanzi).toBeTruthy()
      expect(w.english).toBeTruthy()
    }
  })

  it('story 恰 3 词、partOfSpeech/chapterId 齐、emoji 唯一', () => {
    const story = WORDS.filter((w) => w.category === 'story')
    expect(story).toHaveLength(3)
    for (const w of story) {
      const pos: PartOfSpeech | undefined = w.partOfSpeech
      expect(pos).toMatch(/^(noun|verb|adjective|social)$/)
      expect(w.chapterId).toBe(1)
    }
    const emojis = new Set(story.map((w) => w.emoji))
    expect(emojis.size).toBe(3)
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
    // 101-103 已为 story 词(wordById 全量含 story),真越界为 104
    expect(wordById(104)).toBeUndefined()
  })
})

describe('词库 teaser', () => {
  it('每词 teaser 非空且长度上限 40', () => {
    for (const w of WORDS) {
      expect(typeof w.teaser, `${w.id} 缺 teaser`).toBe('string')
      expect((w.teaser ?? '').length).toBeGreaterThan(0)
      expect((w.teaser ?? '').length).toBeLessThanOrEqual(40)
    }
  })
  it('相邻词 teaser 不逐字雷同(去标点后不同)', () => {
    for (let i = 0; i + 1 < WORDS.length; i += 1) {
      const clean = (s: string) => s.replace(/[\s，。！？、「」……,.!?]/g, '')
      expect(clean(WORDS[i].teaser ?? '')).not.toBe(clean(WORDS[i + 1].teaser ?? ''))
    }
  })
})
