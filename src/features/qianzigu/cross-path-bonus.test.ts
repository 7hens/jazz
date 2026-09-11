import { describe, expect, it } from 'vitest'
import { createProgressRulesService, settleWord } from '@/features/lesson'
import type { UserSettings } from '@/shared/services'
import { emptyWordProgress, settleChapterStep } from './word-progress'

// 跨路径整词 +20 回归:字母林(settleWord)与千字谷(settleChapterStep)写同一行 WordProgress,
// 两条完成语义不同(字母林 = 启用领域内技能齐;千字谷 = 拼音 + 汉字 + 句型三层)。
// 「+20 是否已发」无法从完成谓词无损反推(汉语-only 下千字谷 sound+shape 即让 fullComplete 成真),
// 故 guard 用持久化支付位 WordProgress.bonusGranted;trigger 各保留本地语义。
//
// 双语双路径每词上限 = 字母林 3 技能 90 + 整词 +20 + 千字谷补句步 +30 = 140。
// (spec §8 的 110 是「千字谷内 3 步」口径:30+30+30+20;两路径合计不是 110。)

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

describe('跨路径整词 +20(支付位)', () => {
  it('★ 汉语-only · 纯千字谷:sound 30 → shape 30 → sentence 30 + 20 = 110', () => {
    // 上一轮回归判据:汉语-only 下 guard 若从完成谓词派生,sound+shape 后 fullComplete 已成真,
    // 句步会被误判「已发」→ 90。支付位修复后必须发满 110。
    const s1 = settleChapterStep(13, undefined, 'sound', rules, chineseOnly)
    const s2 = settleChapterStep(13, s1.next, 'shape', rules, chineseOnly)
    const s3 = settleChapterStep(13, s2.next, 'sentence', rules, chineseOnly)

    expect([s1.stepReward, s1.wordBonus]).toEqual([30, 0])
    expect([s2.stepReward, s2.wordBonus]).toEqual([30, 0])
    expect([s3.stepReward, s3.wordBonus]).toEqual([30, 20])
    expect(s2.next.starsEarned).toBe(60)
    expect(s3.next.starsEarned).toBe(110)
    expect(s3.next.bonusGranted).toBe(true)
  })

  it('双语 · 纯千字谷:三层做满发 +20,回字母林补 english 只发 30(不重发 +20)', () => {
    const s1 = settleChapterStep(13, undefined, 'sound', rules, allOn)
    const s2 = settleChapterStep(13, s1.next, 'shape', rules, allOn)
    const s3 = settleChapterStep(13, s2.next, 'sentence', rules, allOn)
    expect(s3.stepReward).toBe(30)
    expect(s3.wordBonus).toBe(20)
    expect(s3.next.starsEarned).toBe(110)
    expect(s3.next.bonusGranted).toBe(true)

    // 反向次序:千字谷三层 → 字母林 english。english 是第 4 个不同技能步(+30 合法),
    // 但支付位已置 → 不得出现第二个 +20。
    const letter = settleWord(13, s3.next, [{ skill: 'english', passed: true }], allOn)
    expect(letter.stepReward).toBe(30)
    expect(letter.wordBonus).toBe(0)
    expect(letter.next.starsEarned).toBe(140)
    expect(letter.next.bonusGranted).toBe(true)
  })

  it('双语 · 字母林先行:三技能发 +20;再进千字谷 sentence 只发 30', () => {
    const letter = settleWord(13, undefined, [
      { skill: 'pinyin', passed: true },
      { skill: 'hanzi', passed: true },
      { skill: 'english', passed: true },
    ], allOn)
    expect(letter.stepReward).toBe(90)
    expect(letter.wordBonus).toBe(20)
    expect(letter.next.starsEarned).toBe(110)
    expect(letter.next.bonusGranted).toBe(true)

    // 千字谷句步:新技能步 +30,整词 +20 已发 → wordBonus 0。
    const sentence = settleChapterStep(13, letter.next, 'sentence', rules, allOn)
    expect(sentence.stepReward).toBe(30)
    expect(sentence.wordBonus).toBe(0)
    expect(sentence.next.starsEarned).toBe(140)
  })

  it('bonusGranted 一旦为 true 永不复位', () => {
    const paid = {
      ...emptyWordProgress(13),
      completed: { pinyin: true, hanzi: true, english: false },
      sentenceLevel: 3,
      bonusGranted: true,
      starsEarned: 110,
    }

    // 重过已满句步:step 0 / bonus 0,支付位不动。
    const repeat = settleChapterStep(13, paid, 'sentence', rules, chineseOnly)
    expect([repeat.stepReward, repeat.wordBonus]).toEqual([0, 0])
    expect(repeat.next.starsEarned).toBe(110)
    expect(repeat.next.bonusGranted).toBe(true)

    // 已发状态下字母林补新技能(此处 english):fullComplete 变真,但仍不发第二个 +20。
    const letter = settleWord(13, paid, [{ skill: 'english', passed: true }], allOn)
    expect(letter.stepReward).toBe(30)
    expect(letter.wordBonus).toBe(0)
    expect(letter.next.starsEarned).toBe(140)
    expect(letter.next.bonusGranted).toBe(true)
  })
})
