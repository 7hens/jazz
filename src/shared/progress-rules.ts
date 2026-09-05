import type { SkillKey, UserSettings, WordProgress } from './types'

// 进阶规则(完成判定/目标词/称号档位):lesson、archipelago 与 app 组装共用,
// 且只依赖 shared 类型,故放在 shared;feature 间禁止编译期 import。
export const SKILL_ORDER: readonly SkillKey[] = ['pinyin', 'hanzi', 'english']

export function enabledSkills(settings: UserSettings): SkillKey[] {
  return SKILL_ORDER.filter((s) => settings[`enable${s[0].toUpperCase()}${s.slice(1)}` as 'enablePinyin'])
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
