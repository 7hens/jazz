import { describe, expect, it } from 'vitest'
import type { WordUnit } from '@/shared/services'
import { demoBlocksFor } from './demo-blocks'

const apple: WordUnit = { id: 21, emoji: '🍎', pinyin: 'píng guǒ', hanzi: '苹果', english: 'apple', category: 'food' }

describe('demoBlocksFor', () => {
  it('拼音两拼口径:每音节一组 = 声母砖 + 韵母砖,组 text 为带调音节', () => {
    const d = demoBlocksFor(apple, 'pinyin')
    expect(d.groups.map((g) => g.text)).toEqual(['píng', 'guǒ'])
    expect(d.groups[0].blockIds.map((id) => d.blocks.find((b) => b.id === id)!.text)).toEqual(['p', 'ing'])
    expect(d.groups[1].blockIds.map((id) => d.blocks.find((b) => b.id === id)!.text)).toEqual(['g', 'uo'])
  })
  it('每个拼音砖可点读(朗读该单元锚点汉字,非空)', () => {
    const d = demoBlocksFor(apple, 'pinyin')
    expect(d.blocks.every((b) => b.speak.length > 0)).toBe(true)
    expect(d.title).toBe('苹果')
  })
  it('英语逐字母成一字母组,可点读字母名', () => {
    const d = demoBlocksFor(apple, 'english')
    expect(d.groups.map((g) => g.text)).toEqual(['A', 'P', 'P', 'L', 'E'])
    expect(d.blocks.map((b) => b.text)).toEqual(['A', 'P', 'P', 'L', 'E'])
    expect(d.blocks[0].speak).toBe('a')
    expect(d.speakTitle).toBe('apple')
  })
})
