import { describe, expect, it } from 'vitest'
import { createProgressRulesService, settleWord } from '@/features/lesson'
import type { UserSettings } from '@/shared/services'
import { settleChapterStep } from './word-progress'

// 跨路径整词 +20 回归:字母林(settleWord)与千字谷(settleChapterStep)写同一行 WordProgress,
// 两条完成语义不同(字母林 = 启用领域内技能齐;千字谷 = 拼音 + 汉字 + 句型三层),
// 若各自用本地谓词判「已发过」,同一词会在两路径各领一次 +20。
// 修法:guard 用 rules.wordBonusEarned(两语义任一成立即已发),trigger 各保留本地语义。

const chineseOnly: UserSettings = {
  enableChinese: true,
  enableEnglish: false,
  earnedAchievements: [],
  consecutiveDays: 0,
  lastActiveDate: '',
  updatedAt: '',
}

const allOn: UserSettings = { ...chineseOnly, enableEnglish: true }

const rules = createProgressRulesService()

describe('跨路径整词 +20 只发一次', () => {
  it('A:字母林先学完 13 → 千字谷补句步不再发 +20(满额 110)', () => {
    // 字母林路径:拼音 + 汉字两技能齐(汉语域配置下 fullComplete 成立)→ +20。
    const letter = settleWord(13, undefined, [
      { skill: 'pinyin', passed: true },
      { skill: 'hanzi', passed: true },
    ], chineseOnly)
    expect(letter.stepReward).toBe(60)
    expect(letter.wordBonus).toBe(20)
    expect(letter.next.starsEarned).toBe(80)

    // 千字谷路径:句步是新的 +30 步,但整词完成语义此时已由字母林满足 → 不得再发 +20。
    const qzg = settleChapterStep(13, letter.next, 'sentence', rules, chineseOnly)
    expect(qzg.stepReward).toBe(30)
    expect(qzg.wordBonus).toBe(0)
    // 三步满额 = 3×30 + 20 = 110(spec §8,汉语域三步口径)。
    expect(qzg.next.starsEarned).toBe(110)
    expect(qzg.next.starsEarned).toBeLessThanOrEqual(110)
  })

  it('B:千字谷先三层做完 → 字母林补英语不再发 +20(无第二次 +20)', () => {
    // 千字谷三层:英语启用时 fullComplete 仍缺 english,故 +20 由 chapterWordDone 触发。
    const s1 = settleChapterStep(13, undefined, 'sound', rules, allOn)
    const s2 = settleChapterStep(13, s1.next, 'shape', rules, allOn)
    const s3 = settleChapterStep(13, s2.next, 'sentence', rules, allOn)
    expect(s1.wordBonus).toBe(0)
    expect(s2.wordBonus).toBe(0)
    expect(s3.stepReward).toBe(30)
    expect(s3.wordBonus).toBe(20)
    // 千字谷三步口径满额 110(与 spec §8 一致)。
    expect(s3.next.starsEarned).toBe(110)

    // 字母林补英语:english 是第 4 个不同技能步(+30 合法),但 +20 已由千字谷发过 → 不得重发。
    const letter = settleWord(13, s3.next, [{ skill: 'english', passed: true }], allOn)
    expect(letter.stepReward).toBe(30)
    expect(letter.wordBonus).toBe(0)
    // 110(千字谷三步含 +20)+ 30(英语独立步)= 140;关键不变量是无第二次 +20。
    expect(letter.next.starsEarned).toBe(s3.next.starsEarned + 30)
    expect(letter.next.starsEarned).toBe(140)
  })

  it('wordBonusEarned:任一完成语义成立即算已发', () => {
    const sentenceDone = {
      wordId: 13,
      completed: { pinyin: true, hanzi: true, english: false },
      sentenceLevel: 3,
      starsEarned: 110,
      updatedAt: '',
    }
    const letterDone = {
      ...sentenceDone,
      completed: { pinyin: true, hanzi: true, english: true },
      sentenceLevel: 0,
    }
    const neither = { ...letterDone, completed: { pinyin: true, hanzi: false, english: false } }

    expect(rules.wordBonusEarned(sentenceDone, allOn)).toBe(true)
    expect(rules.wordBonusEarned(letterDone, allOn)).toBe(true)
    expect(rules.wordBonusEarned(neither, allOn)).toBe(false)
    expect(rules.wordBonusEarned(undefined, allOn)).toBe(false)
  })
})
