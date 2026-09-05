// 冷启动诊断基线(纯函数,spec §7.1):零进度新档案先跑一段探针短测,
// 按「有作答的轨逐轨三档」把基线写进 BasicsService。渲染与落库由 ColdStartWizard 承担。
import type { BasicsProgressRow } from '@/shared/services'
import { ENGLISH_LETTERS, PINYIN_FINALS, PINYIN_INITIALS, PINYIN_TONES, unitKey } from './catalogs'

/** 探针单元:每轨 3 个可公平出题的代表(声母 g / 韵母 a / 声调 ton1;字母 b/s/t)。 */
export const COLDSTART_PROBES: Record<'pinyin' | 'english', string[]> = {
  pinyin: ['pinyin:g', 'pinyin:a', 'pinyin:ton1'],
  english: ['english:b', 'english:s', 'english:t'],
}

export type DiagnosisAnswer = {
  track: 'pinyin' | 'english'
  unitKey: string
  correct: boolean
}

/** pinyin 轨全目录单元 = 声母 ∪ 韵母 ∪ 声调(目录序:先声母再韵母再声调)。 */
const PINYIN_UNIT_KEYS: string[] = [
  ...PINYIN_INITIALS.map((u) => unitKey('pinyin', u.symbol)),
  ...PINYIN_FINALS.map((u) => unitKey('pinyin', u.symbol)),
  ...PINYIN_TONES.map((u) => unitKey('pinyin', u.symbol)),
]

/** english 轨全目录单元 = 26 字母(目录序)。 */
const ENGLISH_UNIT_KEYS: string[] = ENGLISH_LETTERS.map((u) => unitKey('english', u.symbol))

const CATALOG_BY_TRACK: Record<'pinyin' | 'english', readonly string[]> = {
  pinyin: PINYIN_UNIT_KEYS,
  english: ENGLISH_UNIT_KEYS,
}

function rowFor(unitKey: string, state: 'known' | 'learning', updatedAt: string): BasicsProgressRow {
  return { unitKey, state, correctStreak: state === 'known' ? 2 : 0, taughtCount: 0, updatedAt }
}

/**
 * 逐轨三档分类:有作答的轨 —— 探针全对 → 该轨全部目录单元 known;
 * 否则探针答对单元 known、轨内其余全部目录单元 learning(含答错与未考;零对 ⇒ 整轨 learning)。
 * 未作答的轨不产出行。rows 按目录序。
 */
export function buildDiagnosisRows(answers: ReadonlyArray<DiagnosisAnswer>): BasicsProgressRow[] {
  const updatedAt = new Date().toISOString()
  const rows: BasicsProgressRow[] = []
  const answeredTracks = new Set(answers.map((a) => a.track))
  for (const track of ['pinyin', 'english'] as const) {
    if (!answeredTracks.has(track)) continue
    const trackAnswers = answers.filter((a) => a.track === track)
    const allCorrect = trackAnswers.every((a) => a.correct)
    const catalog = CATALOG_BY_TRACK[track]
    if (allCorrect) {
      for (const key of catalog) rows.push(rowFor(key, 'known', updatedAt))
      continue
    }
    const correctKeys = new Set(trackAnswers.filter((a) => a.correct).map((a) => a.unitKey))
    for (const key of catalog) {
      rows.push(rowFor(key, correctKeys.has(key) ? 'known' : 'learning', updatedAt))
    }
  }
  return rows
}
