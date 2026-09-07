import type { ProgressRulesService, SkillKey, UserSettings, WordProgress } from '@/shared/services'

// 进阶规则(完成判定/目标词/称号档位),语义属主 = lesson(lesson 内部结算/步序直接引用;
// 跨 feature 消费走 ProgressRulesService 透传,见 createProgressRulesService)。
export const SKILL_ORDER: readonly SkillKey[] = ['pinyin', 'hanzi', 'english']

// 领域→技能 捆绑(汉语=拼音+汉字,不可拆;英语=英语)。语义属主 lesson。
export const DOMAIN_SKILLS: Record<'chinese' | 'english', readonly SkillKey[]> = {
  chinese: ['pinyin', 'hanzi'],
  english: ['english'],
}

/** 领域启用 → 技能列表,顺序恒 SKILL_ORDER(汉语两技能在前、英语在后)。双关返空,消费侧兜底。 */
export function enabledSkillsFor(on: { enableChinese: boolean; enableEnglish: boolean }): SkillKey[] {
  const out: SkillKey[] = []
  if (on.enableChinese) out.push(...DOMAIN_SKILLS.chinese)
  if (on.enableEnglish) out.push(...DOMAIN_SKILLS.english)
  return out
}

export function enabledSkills(settings: UserSettings): SkillKey[] {
  return enabledSkillsFor({ enableChinese: settings.enableChinese, enableEnglish: settings.enableEnglish })
}

export function fullComplete(p: WordProgress | undefined, settings: UserSettings): boolean {
  if (!p) return false
  return enabledSkills(settings).every((s) => p.completed[s])
}

export function firstTargetId(
  words: Record<number, WordProgress>,
  settings: UserSettings,
  vocabulary: readonly { id: number }[],
): number {
  for (const w of vocabulary) {
    if (!fullComplete(words[w.id], settings)) return w.id
  }
  return vocabulary.length + 1
}

const TITLE_STEPS: ReadonlyArray<{ threshold: number; name: string }> = [
  { threshold: 0, name: '语言初学者' },
  { threshold: 300, name: '小画家' },
  { threshold: 1000, name: '拼音小达人' },
  { threshold: 2500, name: '汉字小能手' },
  { threshold: 5000, name: '英语小明星' },
  { threshold: 8000, name: '语言小法师' },
  { threshold: 12000, name: '语言大法师' },
]

export function titleForStars(total: number): { name: string; level: number } {
  let level = 1
  let name = TITLE_STEPS[0].name
  for (const t of TITLE_STEPS) {
    if (total >= t.threshold) {
      name = t.name
      level = t.threshold === 0 ? 1 : Math.max(level, TITLE_STEPS.findIndex((x) => x.threshold === t.threshold) + 1)
    }
  }
  return { name, level }
}

/** 规则门面(无状态透传,与 VocabularyService 同款):跨 feature 取用经 bootstrap 注册。 */
export function createProgressRulesService(): ProgressRulesService {
  return {
    skillOrder: () => SKILL_ORDER,
    enabledSkills,
    fullComplete,
    firstTargetId,
    titleForStars,
  }
}
