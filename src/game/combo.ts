import { sessionStore, type KeyValueStore } from './storage'

export type AnswerKind = 'first' | 'retry' | 'wrong'

export const COMBO_KEY = 'mgp_combo'
export const MAX_COMBO_KEY = 'mgp_max_combo'

export function nextCombo(combo: number, kind: AnswerKind): number {
  return kind === 'first' ? combo + 1 : 0
}

export function comboBonus(combo: number): number {
  return Math.min(combo * 5, 50)
}

export function loadCombo(store: KeyValueStore = sessionStore): number {
  const n = Number(store.get(COMBO_KEY) ?? '0')
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
}

export function saveCombo(v: number, store: KeyValueStore = sessionStore): void {
  store.set(COMBO_KEY, String(Math.max(0, Math.floor(v))))
}

export function loadMaxCombo(store: KeyValueStore = sessionStore): number {
  const n = Number(store.get(MAX_COMBO_KEY) ?? '0')
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
}

export function saveMaxCombo(v: number, store: KeyValueStore = sessionStore): void {
  store.set(MAX_COMBO_KEY, String(Math.max(0, Math.floor(v))))
}
