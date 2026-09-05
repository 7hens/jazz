import { describe, expect, it } from 'vitest'
import { questionForUnit } from './teach-questions'

describe('questionForUnit', () => {
  it('声母题:题干带锚点,answerId 指向 target 选项,干扰不含 target', () => {
    const q = questionForUnit('pinyin:b')
    expect(q).not.toBeNull()
    if (!q) return
    if (q.kind !== 'choice') throw new Error('声母题应为 choice')
    const target = q.options.find((o) => o.id === q.answerId)
    expect(target?.text).toBe('b')
    expect(q.options).toHaveLength(3)
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
