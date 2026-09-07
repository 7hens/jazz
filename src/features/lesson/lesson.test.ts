import { describe, expect, it } from 'vitest'
import { firstTargetId, fullComplete, stepsFor } from './lesson'
import type { UserSettings, WordProgress } from '@/shared/services'

const allOn = (): UserSettings => ({ enableChinese: true, enableEnglish: true, earnedAchievements: [], consecutiveDays: 0, lastActiveDate: '', updatedAt: '' })
const p = (over: Partial<WordProgress> = {}): WordProgress => ({
  wordId: 1, completed: { pinyin: false, hanzi: false, english: false }, starsEarned: 0, updatedAt: '', ...over,
})
const vocabulary = Array.from({ length: 100 }, (_, index) => ({ id: index + 1 }))

describe('lesson 步序与完成', () => {
  it('stepsFor 双域开 → 三技能按序', () => {
    expect(stepsFor(allOn())).toEqual(['pinyin', 'hanzi', 'english'])
  })

  it('只开汉语 → 两中文层;只开英语 → 英语一步', () => {
    expect(stepsFor({ ...allOn(), enableEnglish: false })).toEqual(['pinyin', 'hanzi'])
    expect(stepsFor({ ...allOn(), enableChinese: false })).toEqual(['english'])
  })

  it('全关强制英语兜底', () => {
    expect(stepsFor({ enableChinese: false, enableEnglish: false, earnedAchievements: [], consecutiveDays: 0, lastActiveDate: '', updatedAt: '' })).toEqual(['english'])
  })

  it('fullComplete 只看启用领域内技能', () => {
    const donePy = p({ completed: { pinyin: true, hanzi: false, english: false } })
    // 汉语域开 → 拼音+汉字都过才算全
    expect(fullComplete(donePy, allOn())).toBe(false)
    expect(fullComplete(donePy, { ...allOn(), enableEnglish: false })).toBe(false)
    const doneZh = p({ completed: { pinyin: true, hanzi: true, english: false } })
    expect(fullComplete(doneZh, { ...allOn(), enableEnglish: false })).toBe(true)
    // 英语-only 域:英语过即全
    expect(fullComplete(p({ completed: { pinyin: false, hanzi: false, english: true } }), { ...allOn(), enableChinese: false })).toBe(true)
    expect(fullComplete(undefined, allOn())).toBe(false)
  })

  it('firstTargetId 找到首个未完成词', () => {
    const words: Record<number, WordProgress> = {}
    for (const w of vocabulary.slice(0, 5)) {
      words[w.id] = p({ wordId: w.id, completed: { pinyin: true, hanzi: true, english: true } })
    }
    expect(firstTargetId(words, allOn(), vocabulary)).toBe(6)
    expect(firstTargetId({}, allOn(), vocabulary)).toBe(1)
  })

  it('全部完成返回 101', () => {
    const words: Record<number, WordProgress> = {}
    for (const w of vocabulary) words[w.id] = p({ wordId: w.id, completed: { pinyin: true, hanzi: true, english: true } })
    expect(firstTargetId(words, allOn(), vocabulary)).toBe(101)
  })
})
