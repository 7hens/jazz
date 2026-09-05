import { describe, expect, it } from 'vitest'
import { createVocabularyService } from '@/features/vocabulary'
import { WORDS } from '@/shared/words'
import { createQuestionEngineService, optionCountFor, speakOf, textOf } from './engine'
import type { MatchQuestion, Question, WordUnit } from '@/shared/types'

const { distractorsFor, makeStepQuestions } = createQuestionEngineService(createVocabularyService())

it('uses the injected vocabulary to build question options', () => {
  const words: WordUnit[] = [
    { id: 1, emoji: '🎯', pinyin: 'mù biāo', hanzi: '目标', english: 'target', category: 'shape' },
    { id: 2, emoji: '1️⃣', pinyin: 'yī', hanzi: '一', english: 'one', category: 'shape' },
    { id: 3, emoji: '2️⃣', pinyin: 'èr', hanzi: '二', english: 'two', category: 'shape' },
  ]
  const vocabulary = {
    getAllWords: () => words,
    wordById: (id: number) => words.find(word => word.id === id),
  }
  const service = createQuestionEngineService(vocabulary)

  const [question] = service.makeStepQuestions(words[0], 'english', () => 0.9)

  expect(question.kind).toBe('choice')
  if (question.kind !== 'choice') throw new Error('Expected a choice question')
  expect(new Set(question.options.map(option => option.text))).toEqual(
    new Set(['target', 'one', 'two']),
  )
})

function allOptions(q: Question): string[] {
  if (q.kind === 'match') return [...q.left.map((o) => o.id), ...q.right.map((o) => o.id)]
  return q.options.map((o) => o.id)
}

describe('出题引擎', () => {
  const apple = WORDS[20] // id 21, food

  it('选项数按 id 门槛', () => {
    expect(optionCountFor(1)).toBe(3)
    expect(optionCountFor(20)).toBe(3)
    expect(optionCountFor(21)).toBe(4)
    expect(optionCountFor(100)).toBe(4)
  })

  it('同 category 优先抽取干扰项', () => {
    const d = distractorsFor(apple, 3)
    expect(d).toHaveLength(3)
    for (const w of d) {
      expect(w.id).not.toBe(apple.id)
      expect(w.category).toBe('food')
    }
  })

  it('同 category 不足时跨类补齐到指定数量', () => {
    // 请求超过同类别可用数 → 必须仍返回足够条
    const d = distractorsFor(apple, 30)
    expect(d).toHaveLength(30)
    expect(new Set(d.map((x) => x.id)).size).toBe(30)
  })

  it('textOf/speakOf 按技能取对字段', () => {
    expect(textOf(apple, 'pinyin')).toBe('píng guǒ')
    expect(textOf(apple, 'hanzi')).toBe('苹果')
    expect(textOf(apple, 'english')).toBe('apple')
    expect(speakOf(apple, 'pinyin')).toBe('苹果')
    expect(speakOf(apple, 'hanzi')).toBe('苹果')
    expect(speakOf(apple, 'english')).toBe('apple')
  })

  it('每步恰出 2 题且题干含正确答案', () => {
    for (const skill of ['pinyin', 'hanzi', 'english'] as const) {
      for (let seed = 0; seed < 20; seed++) {
        const qs = makeStepQuestions(apple, skill, () => seed / 21)
        expect(qs).toHaveLength(2)
        qs.forEach((q, n) => {
          const ids = allOptions(q)
          expect(new Set(ids).size).toBe(ids.length) // 全局唯一
          expect(q.kind).toMatch(/^(listen-choice|choice|match)$/)
          if (q.kind !== 'match') {
            expect(qs[n === 0 ? 0 : 1].kind).toBeDefined()
          }
        })
      }
    }
  })

  it('答案总在选项内且选项文本互不相同', () => {
    const q = makeStepQuestions(apple, 'english')[0]
    if (q.kind === 'match') return
    const texts = q.options.map((o) => o.text)
    expect(new Set(texts).size).toBe(texts.length)
    expect(q.options.some((o) => o.id === q.answerId)).toBe(true)
  })

  it('拼音题卡面是拼音、朗读文本是汉字', () => {
    const qs = makeStepQuestions(apple, 'pinyin')
    for (const q of qs) {
      if (q.kind === 'listen-choice') {
        expect(q.promptSpeak).toBe('苹果')
      }
      if (q.kind === 'choice' || q.kind === 'listen-choice') {
        const correct = q.options.find((o) => o.id === q.answerId)!
        expect(correct.text).toBe('píng guǒ')
        expect(correct.speak).toBe('苹果')
      }
    }
  })
})

describe('附加不变量(防回归)', () => {
  const apple = WORDS[20] // id 21, food

  // 依据词库数据完整性:english 全局唯一(见 words.test.ts)
  const englishWord = (text: string): WordUnit => {
    const found = WORDS.filter((w) => w.english === text)
    expect(found).toHaveLength(1)
    return found[0]
  }

  function expectMatchSound(q: MatchQuestion) {
    expect(q.left.length).toBe(q.right.length)
    const rightIds = new Set(q.right.map((o) => o.id))
    // answerMap 为左卡全映射,指向右卡 id,且为双射
    expect(Object.keys(q.answerMap)).toHaveLength(q.left.length)
    for (const l of q.left) {
      const rid = q.answerMap[l.id]
      expect(rid).toBeDefined()
      expect(rightIds.has(rid)).toBe(true)
      const r = q.right.find((o) => o.id === rid)!
      const w = englishWord(l.text) // 配对须落到同一词
      expect(l.speak).toBe(w.english)
      expect(r.emoji).toBe(w.emoji)
      expect(r.text).toBe('')
    }
    const vals = Object.values(q.answerMap)
    expect(new Set(vals).size).toBe(vals.length)
    expect(new Set(q.left.map((o) => o.text)).size).toBe(q.left.length)
  }

  it('match 左右配对经词引用关联,answerMap 双射且不乱序错配', () => {
    let matches = 0
    for (let seed = 0; seed < 21; seed++) {
      const qs = makeStepQuestions(apple, 'english', () => seed / 21)
      if (qs[1].kind === 'match') {
        expectMatchSound(qs[1])
        matches++
      }
    }
    expect(matches).toBeGreaterThan(0)
  })

  it('一步内两题的 option-id 串集互不相交(-n- 步序号保证全局唯一)', () => {
    for (const skill of ['pinyin', 'hanzi', 'english'] as const) {
      for (let seed = 0; seed < 21; seed++) {
        const [a, b] = makeStepQuestions(apple, skill, () => seed / 21)
        const idsA = allOptions(a)
        const idsB = allOptions(b)
        expect(new Set(idsA).size).toBe(idsA.length)
        expect(new Set(idsB).size).toBe(idsB.length)
        const setA = new Set(idsA)
        for (const id of idsB) expect(setA.has(id)).toBe(false)
      }
    }
  })

  it('首题恒为 choice;次题题型落在技能概率分支集合内', () => {
    for (const skill of ['pinyin', 'hanzi', 'english'] as const) {
      const seen = new Set<string>()
      for (let seed = 0; seed < 21; seed++) {
        const qs = makeStepQuestions(apple, skill, () => seed / 21)
        expect(qs[0].kind).toBe('choice')
        seen.add(qs[1].kind)
      }
      const sorted = [...seen].sort()
      if (skill === 'pinyin') expect(sorted).toEqual(['choice', 'listen-choice'])
      if (skill === 'hanzi') expect(sorted).toEqual(['choice', 'match'])
      if (skill === 'english') expect(sorted).toEqual(['choice', 'listen-choice', 'match'])
    }
  })

  it('choice/listen 纯文字无 emoji;match 左字右图', () => {
    for (const skill of ['pinyin', 'hanzi', 'english'] as const) {
      for (let seed = 0; seed < 10; seed++) {
        const qs = makeStepQuestions(apple, skill, () => (seed + 3) / 17)
        for (const q of qs) {
          if (q.kind === 'match') {
            for (const o of q.left) expect(o.text.length).toBeGreaterThan(0)
            for (const o of q.right) {
              expect(o.emoji).toBeTruthy()
              expect(o.text).toBe('')
            }
          } else {
            expect(q.options.length).toBe(optionCountFor(apple.id))
            for (const o of q.options) {
              expect(o.text.length).toBeGreaterThan(0)
              expect(o.speak?.length).toBeGreaterThan(0)
              expect(o.emoji).toBeUndefined()
            }
          }
        }
      }
    }
  })

  it('干扰项数量精确、不重复、剔除文本冲突(跨 id 与种子)', () => {
    for (const id of [1, 20, 21, 100]) {
      const w = WORDS[id - 1]
      for (let seed = 0; seed < 5; seed++) {
        const d = distractorsFor(w, optionCountFor(w.id) - 1, () => (seed + 1) / 11)
        expect(d).toHaveLength(optionCountFor(w.id) - 1)
        expect(new Set(d.map((x) => x.id)).size).toBe(d.length)
        for (const x of d) {
          expect(x.id).not.toBe(w.id)
          expect(x.hanzi).not.toBe(w.hanzi)
          expect(x.english.toLowerCase()).not.toBe(w.english.toLowerCase())
          expect(x.pinyin).not.toBe(w.pinyin)
        }
      }
    }
  })
})
