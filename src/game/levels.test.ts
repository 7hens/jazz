import { describe, expect, it } from 'vitest'
import { LEVELS } from '../data/levels'

describe('题库数据完整性', () => {
  it('恰好 10 关且 id 1..10 升序唯一', () => {
    expect(LEVELS.map((l) => l.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })
  it('每关标题非空', () => {
    for (const l of LEVELS) expect(l.title.length).toBeGreaterThan(0)
  })
  it('L1-9 题数=6, L10=8', () => {
    for (const l of LEVELS) {
      expect(l.questions.length).toBe(l.id === 10 ? 8 : 6)
    }
  })
  it('listen-choice/choice:选项 4 项且 answerId 在选项内且唯一', () => {
    for (const l of LEVELS)
      for (const q of l.questions)
        if (q.kind !== 'match') {
          expect(q.options).toHaveLength(4)
          const ids = q.options.map((o) => o.id)
          expect(ids).toHaveLength(new Set(ids).size)
          expect(ids).toContain(q.answerId)
        }
  })
  it('listen-choice:正确答案卡的 speak 与 promptSpeak 一致', () => {
    for (const l of LEVELS)
      for (const q of l.questions)
        if (q.kind === 'listen-choice') {
          const answer = q.options.find((o) => o.id === q.answerId)!
          expect(answer.speak).toBe(q.promptSpeak)
        }
  })
  it('match:left/right 非空等长、answerMap 一一映射到右列且覆盖全部 left', () => {
    for (const l of LEVELS)
      for (const q of l.questions)
        if (q.kind === 'match') {
          const leftIds = q.left.map((o) => o.id)
          const rightIds = q.right.map((o) => o.id)
          expect(q.left.length).toBe(q.right.length)
          expect(q.left.length).toBeGreaterThan(0)
          for (const leftId of leftIds) expect(rightIds).toContain(q.answerMap[leftId])
          // 每个 left id 都是 answerMap 的 key
          expect(Object.keys(q.answerMap).sort()).toEqual([...leftIds].sort())
          // answerMap 的值唯一且恰好等于右列 id 集合(一一对应、不重不漏)
          const mapped = Object.values(q.answerMap)
          expect(mapped).toHaveLength(new Set(mapped).size)
          expect(new Set(mapped)).toEqual(new Set(rightIds))
        }
  })
  it('发声素材带 speak(拼音/汉字/英语朗读类)', () => {
    // 遍历 listen-choice:promptSpeak 非空;带 speak 字段的选项按需有值;L3 声调题正确卡必须带 speak
    for (const l of LEVELS)
      for (const q of l.questions) {
        if (q.kind === 'listen-choice') expect(q.promptSpeak.trim().length).toBeGreaterThan(0)
      }
  })
  it('关卡 id 与王国归属符合 spec', () => {
    const expectK: Record<number, string> = { 1: 'pinyin', 2: 'pinyin', 3: 'pinyin', 4: 'pinyin', 5: 'hanzi', 6: 'hanzi', 7: 'hanzi', 8: 'english', 9: 'english', 10: 'mixed' }
    for (const l of LEVELS) expect(l.kingdom).toBe(expectK[l.id])
  })
})

describe('内容自洽性', () => {
  it('全题库无重复 id(题/选项/左右列)', () => {
    const all: string[] = []
    for (const l of LEVELS) {
      all.push(String(l.id))
      for (const q of l.questions) {
        if (q.kind === 'match') {
          for (const o of q.left) all.push(o.id)
          for (const o of q.right) all.push(o.id)
        } else {
          for (const o of q.options) all.push(o.id)
        }
      }
    }
    expect(new Set(all).size).toBe(all.length)
  })

  it('L3 声调题:4 选项为同一音节四种声调,正确卡 speak 为对应汉字', () => {
    const l3 = LEVELS.find((l) => l.id === 3)!
    const toneGroups: Record<string, [string, string]> = {
      '妈麻马骂': ['mā', 'mà'],
      '八拔把爸': ['bā', 'bà'],
      '衣姨椅亿': ['yī', 'yì'],
    }
    for (const q of l3.questions) {
      expect(q.kind).toBe('listen-choice')
      if (q.kind !== 'listen-choice') continue
      const texts = q.options.map((o) => o.text)
      expect(new Set(texts).size).toBe(4)
      const group = toneGroups[q.options.map((o) => o.speak).join('')]
      expect(group).toBeTruthy()
      const correct = q.options.find((o) => o.id === q.answerId)!
      expect(correct.speak).toBeTruthy()
      expect(q.options.every((o) => o.speak && o.speak.length > 0)).toBe(true)
    }
  })

  it('读音类选项 speak 与文本对应(拼音卡同音汉字/汉字卡同字)', () => {
    // 汉字与英语词卡的 speak 必须等于该卡文本本身(直读);抽查不参与精确校验的拼音卡只要 speak 非空
    for (const l of LEVELS) {
      for (const q of l.questions) {
        if (q.kind === 'match') {
          for (const o of q.left) {
            if (o.speak) expect(o.speak).toBe(o.text)
          }
        } else {
          for (const o of q.options) {
            if (!o.speak) continue
            // 汉字王国/英语王国的卡 speak 即文本(直读);拼音/mixed 王国的拼音卡 speak 是同音汉字或英文词,不做等值断言
            if (l.kingdom === 'hanzi' || l.kingdom === 'english') expect(o.speak).toBe(o.text)
          }
        }
      }
    }
  })
})
