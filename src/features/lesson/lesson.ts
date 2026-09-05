import type { SkillKey, UserSettings } from '@/shared/services'
import { enabledSkills } from './progress-rules'

// 进阶判定与目标词规则在 lesson 内 ./progress-rules(语义属主;内部结算/步序直引)。
// 跨 feature 消费走 ProgressRulesService(工厂见 lesson/index),不越 feature 引。
export { firstTargetId, fullComplete, SKILL_ORDER } from './progress-rules'
export { enabledSkills }

export function stepsFor(settings: UserSettings): SkillKey[] {
  const on = enabledSkills(settings)
  return on.length > 0 ? on : ['english']
}
