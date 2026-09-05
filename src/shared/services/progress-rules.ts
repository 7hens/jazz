import type { ServiceToken } from './core'
import type { ProgressData, SkillKey, WordProgress } from './progress'
import type { UserSettings } from './settings'

/**
 * 进阶/称号规则(完成判定/目标词/称号档位,语义属主 lesson)。
 * 纯逻辑体与工厂在 features/lesson/progress-rules.ts;跨 feature 消费
 * (archipelago 主页 / settings 面板 / app 组装)统一经本注册服务取用。
 */
export interface ProgressRulesService {
  skillOrder(): readonly SkillKey[]
  enabledSkills(settings: UserSettings): SkillKey[]
  fullComplete(progress: WordProgress | undefined, settings: UserSettings): boolean
  firstTargetId(
    words: ProgressData,
    settings: UserSettings,
    vocabulary: readonly { id: number }[],
  ): number
  titleForStars(total: number): { name: string; level: number }
}

export const ProgressRulesService = Symbol('ProgressRulesService') as unknown as ServiceToken<ProgressRulesService>
