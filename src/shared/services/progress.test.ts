import { describe, expect, it } from 'vitest'
import workerSource from '../../../worker/progress.ts?raw'
import { MAX_SENTENCE_LEVEL, sentenceTrackComplete } from './progress'

// worker/progress.ts 独立保留字面量(Workers 侧不跨端 import),此处把字面量锚到 shared 常量:
// 改了 MAX_SENTENCE_LEVEL 而 worker 忘改 → 本测试红(worker 侧静默降级 0 = 数据丢失)。
describe('句步上限契约', () => {
  it('MAX_SENTENCE_LEVEL = 3(词表三档)', () => {
    expect(MAX_SENTENCE_LEVEL).toBe(3)
  })

  it('sentenceTrackComplete = 拼音 + 汉字 + 句型满档(不掺英语)', () => {
    const done = {
      wordId: 13,
      completed: { pinyin: true, hanzi: true, english: false },
      sentenceLevel: 3,
      starsEarned: 110,
      updatedAt: '',
    }
    expect(sentenceTrackComplete(done)).toBe(true)
    expect(sentenceTrackComplete({ ...done, sentenceLevel: 2 })).toBe(false)
    expect(sentenceTrackComplete({ ...done, completed: { ...done.completed, hanzi: false } })).toBe(false)
    expect(sentenceTrackComplete(undefined)).toBe(false)
  })

  it('worker/progress.ts 的 sentenceLevel 上限字面量与 MAX_SENTENCE_LEVEL 锚定', () => {
    expect(workerSource).toContain(`rawLevel <= ${MAX_SENTENCE_LEVEL}`)
  })
})
