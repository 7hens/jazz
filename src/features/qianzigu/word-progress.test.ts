import { describe, expect, it } from 'vitest'
import { layerToSkill, parseRestoreState } from './word-progress'

describe('restoreState 支持 sentence 层', () => {
  it('parseRestoreState 保留 sentence 条目', () => {
    const json = JSON.stringify([{ wordId: 13, layer: 'sound' }, { wordId: 13, layer: 'sentence' }])
    expect(parseRestoreState(json)).toEqual([
      { wordId: 13, layer: 'sound' },
      { wordId: 13, layer: 'sentence' },
    ])
  })

  it('未知 layer 仍被过滤', () => {
    expect(parseRestoreState(JSON.stringify([{ wordId: 13, layer: 'bogus' }]))).toEqual([])
  })

  it('layerToSkill 把 sentence 走汉字通道', () => {
    expect(layerToSkill('sound')).toBe('pinyin')
    expect(layerToSkill('shape')).toBe('hanzi')
    expect(layerToSkill('sentence')).toBe('hanzi')
  })
})
