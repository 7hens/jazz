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

const egg: WordUnit = { id: 1, emoji: '🥚', pinyin: 'jī dàn', hanzi: '鸡蛋', english: 'egg', category: 'food' }
const fish: WordUnit = { id: 2, emoji: '🐟', pinyin: 'yú', hanzi: '鱼', english: 'fish', category: 'food' }

describe('demoBlocksFor 合体 chip 读音', () => {
  it('多音节词:每音节 chip 读词内对应汉字,非整词', () => {
    const d = demoBlocksFor(egg, 'pinyin')
    expect(d.groups.map((g) => g.text)).toEqual(['jī', 'dàn'])
    expect(d.groups.map((g) => g.speak)).toEqual(['鸡', '蛋'])
  })
  it('声母 j 与韵母 i 砖卡锚点独立(emoji/读音各异)', () => {
    const d = demoBlocksFor(egg, 'pinyin')
    const j = d.blocks.find((b) => b.text === 'j')!
    const i = d.blocks.find((b) => b.text === 'i')!
    expect(j.speak).toBe('鸡')
    expect(i.speak).toBe('衣')
    expect(j.emoji).not.toBe(i.emoji)
  })
  it('单字词 chip 读音 = 该字', () => {
    const d = demoBlocksFor(fish, 'pinyin')
    expect(d.groups.map((g) => g.text)).toEqual(['yú'])
    expect(d.groups[0].speak).toBe('鱼')
  })
})
