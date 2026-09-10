import { describe, expect, it } from 'vitest'
import { WORDS, wordById } from './words'
import { SENTENCES, sentenceSetFor } from './sentences'

const TIER_MAX = [6, 10, 14] as const
const body = (t: string): string => t.replace(/[^一-龥a-zA-Z0-9]/g, '')

describe('句库数据完整性', () => {
  it('每个 ch1 词恰一套,含 3 档', () => {
    for (const id of [13, 7, 14, 8, 19]) {
      const set = sentenceSetFor(id)
      expect(set, `词 ${id} 缺句集`).toBeDefined()
      expect(set!.tiers).toHaveLength(3)
    }
  })

  it('每档 1 正 3 错,且组内 4 句互不相同', () => {
    for (const set of SENTENCES) {
      for (const [i, tier] of set.tiers.entries()) {
        const all = [tier.correct, ...tier.wrong]
        expect(new Set(all).size, `词 ${set.wordId} 档 ${i + 1} 有重复句`).toBe(4)
      }
    }
  })

  it('正确句长度 ≤ 档位上限', () => {
    for (const set of SENTENCES) {
      set.tiers.forEach((tier, i) => {
        expect(body(tier.correct).length, `词 ${set.wordId} 档 ${i + 1} 过长`).toBeLessThanOrEqual(TIER_MAX[i])
      })
    }
  })

  it('全部句子 ≤ 20 汉字硬线', () => {
    for (const set of SENTENCES) {
      for (const tier of set.tiers) {
        for (const s of [tier.correct, ...tier.wrong]) {
          expect(body(s).length, `超硬线:${s}`).toBeLessThanOrEqual(20)
        }
      }
    }
  })

  it('每档正确句都含该词(题面必须对得上)', () => {
    for (const set of SENTENCES) {
      const word = wordById(set.wordId)!
      for (const tier of set.tiers) {
        expect(tier.correct, `词 ${set.wordId} 正确句不含目标词`).toContain(word.hanzi)
      }
    }
  })

  it('档 2 的替换名词必须在词库内(干扰词限定词库内)', () => {
    // 档 2 造法 = 目标词位置换成别的库内名词 → 错句必须含一个库内名词、且不含目标词
    for (const set of SENTENCES) {
      const word = wordById(set.wordId)!
      for (const wrong of set.tiers[1].wrong) {
        expect(wrong, `词 ${set.wordId} 档 2 错句混入目标词`).not.toContain(word.hanzi)
        const hits = WORDS.filter((w) => w.hanzi !== word.hanzi && wrong.includes(w.hanzi))
        expect(hits.length, `词 ${set.wordId} 档 2 错句「${wrong}」无库内替换名词`).toBeGreaterThan(0)
      }
    }
  })
})
