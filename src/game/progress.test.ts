import { describe, expect, it } from 'vitest'
import { emptyProgress, isValidWordProgress, mergeProgress, settleWord, titleForStars } from './progress'
import { fullComplete } from './lesson'
import type { UserSettings, WordProgress } from '../types'

const allOn = (): UserSettings => ({ enablePinyin: true, enableHanzi: true, enableEnglish: true, updatedAt: '' })

describe('progress 纯态', () => {
  it('空态与校验', () => {
    const e = emptyProgress(5)
    expect(e.wordId).toBe(5)
    expect(e.completed).toEqual({ pinyin: false, hanzi: false, english: false })
    expect(isValidWordProgress(e)).toBe(true)
    expect(isValidWordProgress(null)).toBe(false)
    expect(isValidWordProgress({ ...e, completed: { pinyin: true } })).toBe(false)
  })

  it('合并:completed 升、stars 取大', () => {
    const a = emptyProgress(1)
    const b: WordProgress = { ...emptyProgress(1), completed: { pinyin: true, hanzi: false, english: true }, starsEarned: 60 }
    const m = mergeProgress(a, b)
    expect(m.completed.pinyin).toBe(true)
    expect(m.completed.hanzi).toBe(false)
    expect(m.starsEarned).toBe(60)
  })

  it('称号阈值与等级', () => {
    expect(titleForStars(0).name).toBe('语言初学者')
    expect(titleForStars(299).level).toBe(1)
    expect(titleForStars(300).name).toBe('小画家')
    expect(titleForStars(12000).name).toBe('语言大法师')
  })

  it('结算:首过技能步 +30,词全完成 +20', () => {
    const r = settleWord(21, undefined, [
      { skill: 'pinyin', passed: true },
      { skill: 'pinyin', passed: true },
    ], allOn())
    expect(r.stepReward).toBe(30) // 同一技能重复 pass 只计一次
    expect(r.wordBonus).toBe(0)
    expect(r.next.completed.pinyin).toBe(true)
  })

  it('结算:三技能齐 → 词完成 +20', () => {
    const r = settleWord(21, undefined, [
      { skill: 'pinyin', passed: true },
      { skill: 'hanzi', passed: true },
      { skill: 'english', passed: true },
    ], allOn())
    expect(r.stepReward).toBe(90)
    expect(r.wordBonus).toBe(20)
    expect(fullComplete(r.next, allOn())).toBe(true)
  })

  it('结算:已领过的技能重学不重复发', () => {
    const prev: WordProgress = {
      wordId: 21,
      completed: { pinyin: true, hanzi: false, english: false },
      starsEarned: 30,
      updatedAt: '',
    }
    const r = settleWord(21, prev, [{ skill: 'pinyin', passed: true }], allOn())
    expect(r.stepReward).toBe(0)
    expect(r.next.starsEarned).toBe(30)
  })
})
