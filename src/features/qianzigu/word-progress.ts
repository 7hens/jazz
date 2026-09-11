import type { ProgressRulesService, SkillKey, UserSettings, WordProgress } from '@/shared/services'
import { MAX_SENTENCE_LEVEL, sentenceTrackComplete } from '@/shared/services'
import type { WordLayer } from './chapter'

/** 技能步星尘与整词加成(与 lesson/settleWord 同值;千字谷镜像避免跨 feature 引用)。 */
export const SKILL_STEP_REWARD = 30
export const WORD_COMPLETE_BONUS = 20

export type RestoredEntry = Readonly<{ wordId: number; layer: WordLayer }>

/** 章节任务层 → 技能键:sound=拼音恢复,shape=汉字恢复;sentence 按汉字文本通道渲染与朗读。 */
export function layerToSkill(layer: WordLayer): SkillKey {
  return layer === 'sound' ? 'pinyin' : 'hanzi'
}

/** 整词在「千字谷语义」下完成 = 拼音 + 汉字双技能 + 句型三档全过(不掺英语域)。 */
export const chapterWordDone = sentenceTrackComplete

export function restoredKey(wordId: number, layer: WordLayer): string {
  return `${wordId}:${layer}`
}

export function emptyWordProgress(wordId: number): WordProgress {
  return {
    wordId,
    completed: { pinyin: false, hanzi: false, english: false },
    sentenceLevel: 0,
    bonusGranted: false,
    starsEarned: 0,
    updatedAt: new Date().toISOString(),
  }
}

const LAYERS: readonly WordLayer[] = ['sound', 'shape', 'sentence']

/** 解析落库的 restoreState JSON(非法/非数组一律空)。 */
export function parseRestoreState(json: string | undefined): RestoredEntry[] {
  if (!json) return []
  try {
    const parsed: unknown = JSON.parse(json)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((entry): entry is RestoredEntry => {
      const e = entry as { wordId?: unknown; layer?: unknown }
      return typeof e?.wordId === 'number' && LAYERS.includes(e.layer as WordLayer)
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
 *  - 技能步首过 +30(已在 completed 则 0);句步首过 +30 并把 sentenceLevel 记满;
 *  - 若本轮推进使词在「千字谷语义」(pinyin + hanzi + sentenceLevel>=3)下整词完成,再 +20
 *    —— 是否「已发过」看支付位 base.bonusGranted(两路径共用,跨路径不重发);
 *  - 返回 new-completion delta,消费方只在该 delta 确实推进时 saveStep(幂等已保)。
 */
export function settleChapterStep(
  wordId: number,
  prev: WordProgress | undefined,
  layer: WordLayer,
  _rules: ProgressRulesService,
  _settings: UserSettings,
): { next: WordProgress; stepReward: number; wordBonus: number } {
  const base = prev ?? emptyWordProgress(wordId)
  // guard:支付历史,不是完成状态;trigger 仍是 chapterWordDone —— 本路径的整词完成语义(三层齐)不掺英语域。
  const wasComplete = base.bonusGranted
  const completed = { ...base.completed }
  let sentenceLevel = base.sentenceLevel
  let stepReward = 0

  if (layer === 'sentence') {
    if (sentenceLevel < MAX_SENTENCE_LEVEL) {
      sentenceLevel = MAX_SENTENCE_LEVEL
      stepReward = SKILL_STEP_REWARD
    }
  } else {
    const skill = layerToSkill(layer)
    if (!completed[skill]) {
      completed[skill] = true
      stepReward = SKILL_STEP_REWARD
    }
  }

  const next: WordProgress = {
    wordId: base.wordId,
    completed,
    sentenceLevel,
    bonusGranted: base.bonusGranted,
    starsEarned: base.starsEarned,
    updatedAt: new Date().toISOString(),
  }
  const wordBonus = chapterWordDone(next) && !wasComplete ? WORD_COMPLETE_BONUS : 0
  next.bonusGranted = base.bonusGranted || wordBonus > 0
  next.starsEarned += stepReward + wordBonus
  return { next, stepReward, wordBonus }
}
