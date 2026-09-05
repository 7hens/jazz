import type { AnswerKind, ComboService, ComboSnapshot } from '@/shared/services'
import { sessionStore, storageAdapter, type KeyValueStore } from './storage'

export type { AnswerKind } from '@/shared/services'

export const COMBO_KEY = 'mgp_combo'
export const MAX_COMBO_KEY = 'mgp_max_combo'

export function nextCombo(combo: number, kind: AnswerKind): number {
  return kind === 'first' ? combo + 1 : 0
}

export function comboBonus(combo: number): number {
  return Math.min(combo * 5, 50)
}

function normalizedStoredNumber(value: string | null): number {
  const number = Number(value ?? '0')
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0
}

export function loadCombo(store: KeyValueStore = sessionStore): number {
  return normalizedStoredNumber(store.get(COMBO_KEY))
}

export function saveCombo(value: number, store: KeyValueStore = sessionStore): void {
  store.set(COMBO_KEY, String(Math.max(0, Math.floor(value))))
}

export function loadMaxCombo(store: KeyValueStore = sessionStore): number {
  return normalizedStoredNumber(store.get(MAX_COMBO_KEY))
}

export function saveMaxCombo(value: number, store: KeyValueStore = sessionStore): void {
  store.set(MAX_COMBO_KEY, String(Math.max(0, Math.floor(value))))
}

function browserSessionStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

export function createComboService(storage: Storage | null = browserSessionStorage()): ComboService {
  const store = storageAdapter(storage)
  let snapshot: ComboSnapshot = Object.freeze({
    combo: loadCombo(store),
    maxCombo: loadMaxCombo(store),
  })
  const listeners = new Set<() => void>()

  function publish(combo: number, maxCombo: number) {
    snapshot = Object.freeze({ combo, maxCombo })
    listeners.forEach(listener => listener())
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    answer(kind) {
      const combo = nextCombo(snapshot.combo, kind)
      const maxCombo = Math.max(snapshot.maxCombo, combo)
      saveCombo(combo, store)
      if (maxCombo !== snapshot.maxCombo) saveMaxCombo(maxCombo, store)
      publish(combo, maxCombo)
      return combo
    },
    reset() {
      saveCombo(0, store)
      saveMaxCombo(0, store)
      publish(0, 0)
    },
    getBonus: () => comboBonus(snapshot.combo),
  }
}
