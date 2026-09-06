import { describe, expect, it } from 'vitest'
import { PINYIN_FINALS } from './catalogs'
import { decomposeWord } from './decompose'
import { questionForUnit } from './teach-questions'

describe('questionForUnit', () => {
  it('声母题:题干带锚点,answerId 指向 target 选项,干扰不含 target', () => {
    const q = questionForUnit('pinyin:b')
    expect(q).not.toBeNull()
    if (!q) return
    if (q.kind !== 'choice') throw new Error('声母题应为 choice')
    const target = q.options.find((o) => o.id === q.answerId)
    expect(target?.text).toBe('b')
    expect(q.options).toHaveLength(4)
    const texts = q.options.map((o) => o.text)
    expect(texts.filter((t) => t === 'b')).toHaveLength(1)
    expect(q.promptEmoji.length).toBeGreaterThan(0)
    expect(q.options.every((o) => o.speak)).toBe(true) // 每选项可点读(锚点)
  })

  it('韵母题 symbol 全形文本', () => {
    const q = questionForUnit('pinyin:ing')
    expect(q?.options.find((o) => o.id === q?.answerId)?.text).toBe('ing')
  })

  it('声调题选项为中文调名(一声/二声/三声)', () => {
    const q = questionForUnit('pinyin:ton1')
    const ans = q?.options.find((o) => o.id === q?.answerId)
    expect(ans?.text).toBe('一声')
  })

  it('退役轻声键 ton0 不在 4 调目录,返回 null', () => {
    expect(questionForUnit('pinyin:ton0')).toBeNull()
  })

  it('ch/r/s 锚点词首即该声母,题干诚实不误导', () => {
    const cases: Array<[string, string]> = [
      ['pinyin:ch', '车'],
      ['pinyin:r', '日'],
      ['pinyin:s', '伞'],
    ]
    for (const [key, hanzi] of cases) {
      const q = questionForUnit(key)
      expect(q).not.toBeNull()
      if (!q) return
      if (q.kind !== 'choice') throw new Error(`${key} 应为 choice`)
      expect(q.prompt).toContain(hanzi)
    }
  })

  it('英语字母题 = listen-choice,听字母名选大写字母,干扰含近形优先', () => {
    const q = questionForUnit('english:a')
    expect(q?.kind).toBe('listen-choice')
    const ans = q && q.kind === 'listen-choice' ? q.options.find((o) => o.id === q.answerId) : null
    expect(ans?.text).toBe('A')
    expect(q?.promptSpeak).toBe('a') // 字母名朗读
  })

  it('目录外 unitKey 返回 null', () => {
    expect(questionForUnit('pinyin:zz')).toBeNull()
    expect(questionForUnit('english:1')).toBeNull()
  })

  it('题/选项 id 全局唯一且稳定前缀', () => {
    const ids: string[] = []
    for (const key of ['pinyin:b', 'pinyin:ing', 'english:m', 'english:a']) {
      const q = questionForUnit(key)
      if (q) ids.push(...q.options.map((o) => o.id))
    }
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids[0]).toMatch(/^teach-pinyin-b-c-\d+$/) // 稳定前缀:teach-{unitKey 冒号转连字符}-{kind 标记}-{i};i 为 shuffle 后下标(可漂移)
  })
})

// —— 锚点诚实性整库扫描 ——
// 韵母题形是「「锚词」里的韵母是哪个?」:若锚词本身含第二个「会被出题」的韵母(即出现在该题任一选项里),
// 则双答案歧义——孩子答那个「真在词里但不是目标」的选项会被判错。典型 = iang 曾锚「大象 dà xiàng」,
// 其首音节韵母 a 恰在该题干扰池里 → 修锚为单音节「象 xiàng」。
// 扫描口径 = 真实引擎:对每个韵母单元出题,读实际选项;锚词(经 decomposeWord)不得含任一非目标选项韵母。
// (声母/声调题形问「开头的声母/第几声」,锚词里其它韵母不会成为选项,故扫描对象为韵母目录。)
function pseudoWordFor(anchorPinyin: string, anchorHanzi: string, anchorEmoji: string) {
  return { id: -1, pinyin: anchorPinyin, hanzi: anchorHanzi, emoji: anchorEmoji, english: '', category: 'shape' as const }
}

describe('锚点诚实性:韵母锚词不得夹带会被出题的第二个韵母', () => {
  it('每个韵母锚词都只含目标一个「会成为选项」的韵母', () => {
    for (const f of PINYIN_FINALS) {
      const key = `pinyin:${f.symbol}`
      const q = questionForUnit(key)
      expect(q, `${f.symbol}(${f.anchorHanzi}) 应能出题`).not.toBeNull()
      if (!q || q.kind !== 'choice') continue
      // 实际会摆上桌的「其它韵母」选项 = 全部选项文本 ∩ 韵母目录 − 目标
      const offered = new Set(
        q.options
          .map((o) => o.text)
          .filter((t) => PINYIN_FINALS.some((x) => x.symbol === t && x.symbol !== f.symbol)),
      )
      const { pinyin } = decomposeWord(pseudoWordFor(f.anchorPinyin, f.anchorHanzi, f.anchorEmoji))
      const finalsInWord = pinyin.map((s) => s.final)
      // 正:锚词确实含目标韵母(题目有诚实答案)
      expect(finalsInWord, `${f.symbol}(${f.anchorHanzi}) 锚词应含目标韵母 ${f.symbol}`).toContain(f.symbol)
      // 反:锚词不得夹带任何会被出题的其它韵母(多韵母锚词 → 双答案歧义)
      const smuggled = finalsInWord.filter((final) => offered.has(final))
      expect(smuggled, `${f.symbol}(${f.anchorHanzi}) 锚词夹带会被出题的韵母 ${smuggled.join(',')}`).toEqual([])
    }
  })
})
