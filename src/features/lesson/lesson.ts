import type { SkillKey, UserSettings } from '@/shared/types'
import { enabledSkills } from '@/shared/progress-rules'

// 进阶判定与目标词规则已上移 shared/progress-rules(lesson、archipelago 共用)。
export { firstTargetId, fullComplete, SKILL_ORDER } from '@/shared/progress-rules'
export { enabledSkills }

export function stepsFor(settings: UserSettings): SkillKey[] {
  const on = enabledSkills(settings)
  return on.length > 0 ? on : ['english']
}
