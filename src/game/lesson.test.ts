import { describe, expect, it } from 'vitest'
import { WORDS } from '../data/words'
import { firstTargetId, fullComplete, stepsFor } from './lesson'
import type { UserSettings, WordProgress } from '../types'

const allOn = (): UserSettings => ({ enablePinyin: true, enableHanzi: true, enableEnglish: true, updatedAt: '' })
const p = (over: Partial<WordProgress> = {}): WordProgress => ({
  wordId: 1, completed: { pinyin: false, hanzi: false, english: false }, starsEarned: 0, updatedAt: '', ...over,
})

describe('lesson 步序与完成', () => {
  it('stepsFor 默认三技能顺序', () => {
    expect(stepsFor(allOn())).toEqual(['pinyin', 'hanzi', 'english'])
  })

  it('stepsFor 关闭技能即裁剪', () => {
    expect(stepsFor({ ...allOn(), enableHanzi: false })).toEqual(['pinyin', 'english'])
  })

  it('全关强制英语', () => {
    expect(stepsFor({ enablePinyin: false, enableHanzi: false, enableEnglish: false, updatedAt: '' })).toEqual(['english'])
  })

  it('fullComplete 只看启用技能', () => {
    const donePy = p({ completed: { pinyin: true, hanzi: false, english: false } })
    expect(fullComplete(donePy, allOn())).toBe(false)
    expect(fullComplete(donePy, { ...allOn(), enableHanzi: false, enableEnglish: false })).toBe(true)
    expect(fullComplete(undefined, allOn())).toBe(false)
  })

  it('firstTargetId 找到首个未完成词', () => {
    const words: Record<number, WordProgress> = {}
    for (const w of WORDS.slice(0, 5)) {
      words[w.id] = p({ wordId: w.id, completed: { pinyin: true, hanzi: true, english: true } })
    }
    expect(firstTargetId(words, allOn())).toBe(6)
    expect(firstTargetId({}, allOn())).toBe(1)
  })

  it('全部完成返回 101', () => {
    const words: Record<number, WordProgress> = {}
    for (const w of WORDS) words[w.id] = p({ wordId: w.id, completed: { pinyin: true, hanzi: true, english: true } })
    expect(firstTargetId(words, allOn())).toBe(101)
  })
})
