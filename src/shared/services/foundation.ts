import type { SkillKey } from './progress'
import type { BasicsProgressData } from './basics-progress'
import type { ServiceToken } from './core'

/** 词课插入判定:强制先学 / 软提示 / 不出现。 */
export type FoundationNeed = 'mandatory' | 'soft' | 'none'

/** 基础教学门面(无状态纯查询,与 ProgressRulesService 同款):跨 feature 消费经 bootstrap 注册。 */
export interface FoundationService {
  /** 词 × 技能 → 涉及的基础单元 key 序列(拼音拆声母/韵母/声调,英语拆字母;汉字技能恒 [])。 */
  unitsFor(wordId: number, skill: SkillKey): readonly string[]
  /** 判定插入档:mandatory(含未评估或 learning 且从未教过)/ soft(learning 且教过)/ none。 */
  needFor(units: readonly string[], models: Readonly<BasicsProgressData>): FoundationNeed
}

export const FoundationService = Symbol('FoundationService') as unknown as ServiceToken<FoundationService>
