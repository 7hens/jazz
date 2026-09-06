import type { BasicsProgressData, BasicsProgressRow, FoundationNeed } from '@/shared/services'

export type UnitModel = Pick<BasicsProgressRow, 'state' | 'correctStreak' | 'taughtCount'>

export function emptyUnit(): UnitModel {
  return { state: 'learning', correctStreak: 0, taughtCount: 0 }
}

export function applyCorrect(u: UnitModel): UnitModel {
  const correctStreak = u.correctStreak + 1
  return { ...u, state: correctStreak >= 2 ? 'known' : u.state, correctStreak }
}

export function applyWrong(u: UnitModel): UnitModel {
  return { ...u, state: 'learning', correctStreak: 0 }
}

export function withTaught(u: UnitModel): UnitModel {
  return { ...u, taughtCount: u.taughtCount + 1 }
}

export function needFor(units: readonly string[], models: Readonly<BasicsProgressData>): FoundationNeed {
  let hasSoft = false
  for (const unit of units) {
    const model = models[unit]
    const u = model ? { state: model.state, correctStreak: model.correctStreak, taughtCount: model.taughtCount } : emptyUnit()
    if (u.state !== 'known' && u.taughtCount === 0) return 'mandatory'
    if (u.state !== 'known') hasSoft = true
  }
  return hasSoft ? 'soft' : 'none'
}

export function toRow(unitKey: string, model: UnitModel): BasicsProgressRow {
  return { unitKey, state: model.state, correctStreak: model.correctStreak, taughtCount: model.taughtCount, updatedAt: new Date().toISOString() }
}
