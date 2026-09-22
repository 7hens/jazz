// 隐藏成就:纯数据 + 扫描。状态由关卡结算点装配;不重发由 earned 集保证。
// 目录里不许再出现词库口径(词数 / 分类 / 整词完美)—— 词库删除后那些锚没有来源。

import type { Achievement, AchievementService, AchievementState } from '@/shared/services'

// 内部目录项比共享契约多携带 check 判定,不入服务返回面。
type AchievementDef = Achievement & { check: (s: AchievementState) => boolean }

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'perfect_level', name: '完美主义', description: '一关一块不错,拿到三颗星', emoji: '💎', reward: 50,
    check: (s) => s.perfectLevels >= 1 },
  { id: 'combo_15', name: '连击王者', description: '连击达到 15', emoji: '⚡', reward: 50,
    check: (s) => s.maxCombo >= 15 },
  { id: 'marathon', name: '马拉松', description: '一次学习首通 5 关', emoji: '🏃', reward: 100,
    check: (s) => s.firstCompleteToday >= 5 },
  { id: 'early_bird', name: '早起鸟', description: '早上学习', emoji: '🌅', reward: 20,
    check: (s) => s.hour < 10 },
  { id: 'night_owl', name: '夜猫子', description: '晚上学习', emoji: '🦉', reward: 20,
    check: (s) => s.hour >= 21 },
  { id: 'collector', name: '收集者', description: '一个单元全部拿到三颗星', emoji: '📦', reward: 200,
    check: (s) => s.perfectUnits >= 1 },
  { id: 'dedicated', name: '坚持者', description: '连续 7 天学习', emoji: '🔥', reward: 300,
    check: (s) => s.consecutiveDays >= 7 },
  { id: 'grand_master', name: '大法师', description: '全部关卡通关', emoji: '👑', reward: 1000,
    check: (s) => s.completedLevels >= s.totalLevels },
]

export function checkAchievements(state: AchievementState, earned: readonly string[]): Achievement[] {
  const earnedSet = new Set(earned)
  return ACHIEVEMENTS.filter((a) => !earnedSet.has(a.id) && a.check(state))
}

export function createAchievementService(): AchievementService {
  return { scan: checkAchievements }
}
