import type { SkillKey, UserSettings, WordProgress } from '@/shared/types'

export const SKILL_ORDER: readonly SkillKey[] = ['pinyin', 'hanzi', 'english']

export function enabledSkills(settings: UserSettings): SkillKey[] {
  return SKILL_ORDER.filter((s) => settings[`enable${s[0].toUpperCase()}${s.slice(1)}` as 'enablePinyin'])
}

export function stepsFor(settings: UserSettings): SkillKey[] {
  const on = enabledSkills(settings)
  return on.length > 0 ? on : ['english']
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
