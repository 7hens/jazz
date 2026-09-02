import type { GameState, KingdomKey } from '../types'
import type { LevelOutcome } from './scoring'

export const LEVELS_PER_KINGDOM: Record<KingdomKey, number[]> = {
  pinyin: [1, 2, 3, 4],
  hanzi: [5, 6, 7],
  english: [8, 9],
}

export function kingdomForLevel(levelId: number): KingdomKey | null {
  for (const [key, ids] of Object.entries(LEVELS_PER_KINGDOM) as [KingdomKey, number[]][]) {
    if (ids.includes(levelId)) return key
  }
  return null
}

export function emptyGameState(): GameState {
  return {
    stars: 0,
    exp: 0,
    unlocked: 1,
    levels: {},
    kingdom: { pinyin: 0, hanzi: 0, english: 0 },
    updatedAt: new Date().toISOString(),
  }
}

export function levelOfExp(exp: number): number {
  return Math.floor(exp / 300) + 1
}

/** 载入存档前的结构校验:杜绝残缺/畸形 blob 让 MapView 渲染崩溃。容忍缺失 updatedAt。 */
export function isValidGameState(s: unknown): s is GameState {
  if (typeof s !== 'object' || s === null || Array.isArray(s)) return false
  const g = s as Record<string, unknown>
  if (typeof g.stars !== 'number' || !Number.isFinite(g.stars)) return false
  if (typeof g.exp !== 'number' || !Number.isFinite(g.exp)) return false
  if (typeof g.unlocked !== 'number' || !Number.isInteger(g.unlocked) || g.unlocked < 1) return false
  if (typeof g.levels !== 'object' || g.levels === null || Array.isArray(g.levels)) return false
  const kingdom = g.kingdom
  if (typeof kingdom !== 'object' || kingdom === null || Array.isArray(kingdom)) return false
  const k = kingdom as Record<string, unknown>
  return ['pinyin', 'hanzi', 'english'].every((key) => typeof k[key] === 'number' && Number.isFinite(k[key]))
}

const STAR_REWARDS: Record<number, number> = { 1: 20, 2: 40, 3: 60 }

export function applyResult(
  state: GameState,
  levelId: number,
  outcome: LevelOutcome,
): { state: GameState; starDelta: number; expDelta: number; unlockedNew: boolean } {
  const next: GameState = JSON.parse(JSON.stringify(state)) as GameState
  const prev = next.levels[levelId]
  const stars = outcome.stars
  let starDelta = 0
  let expDelta = 0

  // 失败不记录、不推进
  if (stars === 0) return { state: next, starDelta: 0, expDelta: 0, unlockedNew: false }

  if (!prev) {
    next.levels[levelId] = { stars, bestScore: outcome.rawScore }
    starDelta = STAR_REWARDS[stars]
    expDelta = 80
    if (levelId === next.unlocked) next.unlocked = levelId + 1
  } else if (stars > prev.stars || outcome.rawScore > prev.bestScore) {
    starDelta = Math.max(0, STAR_REWARDS[stars] - STAR_REWARDS[prev.stars])
    next.levels[levelId] = {
      stars: stars > prev.stars ? stars : prev.stars,
      bestScore: Math.max(prev.bestScore, outcome.rawScore),
    }
  }

  const k = kingdomForLevel(levelId)
  if (k) {
    next.kingdom[k] = LEVELS_PER_KINGDOM[k].reduce((sum, id) => sum + (next.levels[id]?.stars ?? 0), 0)
  }

  next.stars += starDelta
  next.exp += expDelta
  next.updatedAt = new Date().toISOString()
  return { state: next, starDelta, expDelta, unlockedNew: levelId === state.unlocked && stars > 0 }
}
