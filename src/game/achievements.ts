// 隐藏成就(纯数据 + 扫描)。状态由 App 在词结算点装配;不重发由 earned 集保证。

export type AchievementState = {
  completedWords: number
  categoryDone: number
  maxCombo: number
  firstCompleteToday: number
  perfectWords: number
  consecutiveDays: number
  hour: number
  totalWords: number
}

export type Achievement = {
  id: string
  name: string
  description: string
  emoji: string
  reward: number
  check: (s: AchievementState) => boolean
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: 'perfect_word', name: '完美主义', description: '一个词全部题目首答就对', emoji: '💎', reward: 50,
    check: (s) => s.perfectWords >= 1 },
  { id: 'combo_15', name: '连击王者', description: '连击达到 15', emoji: '⚡', reward: 50,
    check: (s) => s.maxCombo >= 15 },
  { id: 'marathon', name: '马拉松', description: '一次学习首通 5 个词', emoji: '🏃', reward: 100,
    check: (s) => s.firstCompleteToday >= 5 },
  { id: 'early_bird', name: '早起鸟', description: '早上学习', emoji: '🌅', reward: 20,
    check: (s) => s.hour < 10 },
  { id: 'night_owl', name: '夜猫子', description: '晚上学习', emoji: '🦉', reward: 20,
    check: (s) => s.hour >= 21 },
  { id: 'collector', name: '收集者', description: '完成一个分类的全部 20 词', emoji: '📦', reward: 200,
    check: (s) => s.categoryDone >= 1 },
  { id: 'dedicated', name: '坚持者', description: '连续 7 天学习', emoji: '🔥', reward: 300,
    check: (s) => s.consecutiveDays >= 7 },
  { id: 'grand_master', name: '大法师', description: '全部 100 词完成', emoji: '👑', reward: 1000,
    check: (s) => s.completedWords >= s.totalWords },
]

export function checkAchievements(state: AchievementState, earned: string[]): Achievement[] {
  const earnedSet = new Set(earned)
  return ACHIEVEMENTS.filter((a) => !earnedSet.has(a.id) && a.check(state))
}
