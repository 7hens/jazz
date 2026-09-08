import type { ProgressRulesService, SkillKey, UserSettings, WordProgress } from '@/shared/services'
import type { WordLayer } from './chapter'

/** 技能步星尘与整词加成(与 lesson/settleWord 同值;千字谷镜像避免跨 feature 引用)。 */
export const SKILL_STEP_REWARD = 30
export const WORD_COMPLETE_BONUS = 20

export type RestoredEntry = Readonly<{ wordId: number; layer: WordLayer }>

/** 章节任务层 → 技能键:sound=拼音恢复,shape=汉字恢复。 */
export function layerToSkill(layer: WordLayer): SkillKey {
  return layer === 'sound' ? 'pinyin' : 'hanzi'
}

/** 词在「千字谷语义」下完成 = pinyin+hanzi 双技能完成(不掺英语域)。 */
export function chapterWordDone(row: WordProgress | undefined): boolean {
  return !!row && row.completed.pinyin && row.completed.hanzi
}

export function restoredKey(wordId: number, layer: WordLayer): string {
  return `${wordId}:${layer}`
}

export function emptyWordProgress(wordId: number): WordProgress {
  return {
    wordId,
    completed: { pinyin: false, hanzi: false, english: false },
    starsEarned: 0,
    updatedAt: new Date().toISOString(),
  }
}

/** 解析落库的 restoreState JSON(非法/非数组一律空)。 */
export function parseRestoreState(json: string | undefined): RestoredEntry[] {
  if (!json) return []
  try {
    const parsed: unknown = JSON.parse(json)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((entry): entry is RestoredEntry => {
      const e = entry as { wordId?: unknown; layer?: unknown }
      return typeof e?.wordId === 'number' && (e.layer === 'sound' || e.layer === 'shape')
    }).map(e => ({ wordId: e.wordId, layer: e.layer }))
  } catch {
    return []
  }
}

export function serializeRestoreState(entries: ReadonlyArray<RestoredEntry>): string {
  return JSON.stringify(entries.map(({ wordId, layer }) => ({ wordId, layer })))
}

/**
 * 单技能恢复结算(镜像 lesson/settleWord 的「新完成增量」幂等规则):
 *  - 该技能首过 +30(已在 completed 则 0);
 *  - 若本轮推进使词在 settings 下整词首通,再 +20(整词加成只发一次);
 *  - 返回 new-completion delta,消费方只在该 delta 确实推进时 saveStep(幂等已保)。
 */
export function settleChapterStep(
  wordId: number,
  prev: WordProgress | undefined,
  layer: WordLayer,
  rules: ProgressRulesService,
  settings: UserSettings,
): { next: WordProgress; stepReward: number; wordBonus: number } {
  const base = prev ?? emptyWordProgress(wordId)
  const skill = layerToSkill(layer)
  const wasComplete = rules.fullComplete(base, settings)
  const completed = { ...base.completed }
  let stepReward = 0
  if (!completed[skill]) {
    completed[skill] = true
    stepReward = SKILL_STEP_REWARD
  }
  const next: WordProgress = {
    wordId: base.wordId,
    completed,
    starsEarned: base.starsEarned,
    updatedAt: new Date().toISOString(),
  }
  const isComplete = rules.fullComplete(next, settings)
  const wordBonus = isComplete && !wasComplete ? WORD_COMPLETE_BONUS : 0
  next.starsEarned += stepReward + wordBonus
  return { next, stepReward, wordBonus }
}
