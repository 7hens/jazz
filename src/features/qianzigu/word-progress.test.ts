import { describe, expect, it } from 'vitest'
import { createProgressRulesService } from '@/features/lesson'
import type { UserSettings } from '@/shared/services'
import {
  chapterWordDone,
  emptyWordProgress,
  layerToSkill,
  parseRestoreState,
  settleChapterStep,
} from './word-progress'

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

describe('句步结算', () => {
  const rules = createProgressRulesService()
  const settings = { enableChinese: true, enableEnglish: false } as UserSettings
  const twoSkill = { ...emptyWordProgress(13), completed: { pinyin: true, hanzi: true, english: false } }

  it('句步首过 +30,且 sentenceLevel 记满', () => {
    const { next, stepReward } = settleChapterStep(13, twoSkill, 'sentence', rules, settings)
    expect(next.sentenceLevel).toBe(3)
    expect(stepReward).toBe(30)
  })

  it('句步是补全那一步时,整词 +20 同时发', () => {
    // 句步 = 三层里最后一块 → chapterWordDone 由 false 变 true,+20 应当发(spec §8)。
    const { stepReward, wordBonus } = settleChapterStep(13, twoSkill, 'sentence', rules, settings)
    expect(stepReward).toBe(30)
    expect(wordBonus).toBe(20)
  })

  it('三层未齐备时不发 +20', () => {
    // 只差句步之前:补上汉字后 sentenceLevel 仍为 0 → 不齐备 → 无 +20。
    const oneSkill = { ...emptyWordProgress(13), completed: { pinyin: true, hanzi: false, english: false } }
    const { stepReward, wordBonus } = settleChapterStep(13, oneSkill, 'shape', rules, settings)
    expect(stepReward).toBe(30)
    expect(wordBonus).toBe(0)
  })

  it('句步已满级不重复发星尘', () => {
    const done = { ...twoSkill, sentenceLevel: 3 }
    const { stepReward, wordBonus } = settleChapterStep(13, done, 'sentence', rules, settings)
    expect(stepReward).toBe(0)
    expect(wordBonus).toBe(0)
  })

  it('chapterWordDone 要求 pinyin + hanzi + sentenceLevel >= 3', () => {
    expect(chapterWordDone(twoSkill)).toBe(false)
    expect(chapterWordDone({ ...twoSkill, sentenceLevel: 3 })).toBe(true)
  })
})
