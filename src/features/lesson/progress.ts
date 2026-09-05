import type { SkillKey, UserSettings, WordProgress } from '@/shared/types'
import { fullComplete } from './lesson'

const ALL_SKILLS: readonly SkillKey[] = ['pinyin', 'hanzi', 'english']

// 称号档位已上移 shared/progress-rules(lesson、archipelago 共用)。
export { titleForStars } from '@/shared/progress-rules'

export function emptyProgress(wordId: number): WordProgress {
  return {
    wordId,
    completed: { pinyin: false, hanzi: false, english: false },
    starsEarned: 0,
    updatedAt: new Date().toISOString(),
  }
}

export function isValidWordProgress(s: unknown): s is WordProgress {
  if (typeof s !== 'object' || s === null || Array.isArray(s)) return false
  const w = s as Record<string, unknown>
  if (typeof w.wordId !== 'number' || !Number.isInteger(w.wordId) || w.wordId < 1) return false
  const c = w.completed as Record<string, unknown> | null
  if (typeof c !== 'object' || c === null) return false
  if (!ALL_SKILLS.every((k) => typeof c[k] === 'boolean')) return false
  return typeof w.starsEarned === 'number' && Number.isFinite(w.starsEarned)
}

export function mergeProgress(local: WordProgress, server: WordProgress): WordProgress {
  return {
    wordId: local.wordId,
    completed: {
      pinyin: local.completed.pinyin || server.completed.pinyin,
      hanzi: local.completed.hanzi || server.completed.hanzi,
      english: local.completed.english || server.completed.english,
    },
    starsEarned: Math.max(local.starsEarned, server.starsEarned),
    updatedAt: new Date().toISOString(),
  }
}

export type SkillPass = { skill: SkillKey; passed: boolean }

export function settleWord(
  wordId: number,
  prev: WordProgress | undefined,
  passes: SkillPass[],
  settings: UserSettings,
): { next: WordProgress; stepReward: number; wordBonus: number } {
  const base = prev ?? emptyProgress(wordId)
  const wasComplete = fullComplete(base, settings)
  const next = {
    wordId: base.wordId,
    completed: { ...base.completed },
    starsEarned: base.starsEarned,
    updatedAt: new Date().toISOString(),
  }
  let stepReward = 0
  for (const pass of passes) {
    if (!pass.passed) continue
    if (!next.completed[pass.skill]) {
      next.completed[pass.skill] = true
      stepReward += 30
    }
  }
  const isComplete = fullComplete(next, settings)
  const wordBonus = isComplete && !wasComplete ? 20 : 0
  next.starsEarned += stepReward + wordBonus
  return { next, stepReward, wordBonus }
}
