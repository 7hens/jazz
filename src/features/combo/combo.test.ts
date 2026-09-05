import { describe, expect, it, vi } from 'vitest'
import { COMBO_KEY, MAX_COMBO_KEY, comboBonus, createComboService, loadCombo, loadMaxCombo, nextCombo, saveCombo, saveMaxCombo } from './combo'
import type { KeyValueStore } from './storage'

function fakeStore(): KeyValueStore {
  const values = new Map<string, string>()
  return { get: key => values.get(key) ?? null, set: (key, value) => { values.set(key, value) } }
}

function storage(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial))
  return {
    get length() { return values.size },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => [...values.keys()][index] ?? null,
    removeItem: key => { values.delete(key) },
    setItem: (key, value) => { values.set(key, value) },
  }
}

describe('combo pure behavior', () => {
  it('increments only first-try answers and caps bonus at 50', () => {
    expect(nextCombo(3, 'first')).toBe(4)
    expect(nextCombo(3, 'retry')).toBe(0)
    expect(nextCombo(3, 'wrong')).toBe(0)
    expect(comboBonus(1)).toBe(5)
    expect(comboBonus(10)).toBe(50)
    expect(comboBonus(20)).toBe(50)
  })

  it('keeps the legacy injectable key-value helpers', () => {
    const store = fakeStore()
    expect(loadCombo(store)).toBe(0)
    saveCombo(7, store)
    saveMaxCombo(12, store)
    expect(loadCombo(store)).toBe(7)
    expect(loadMaxCombo(store)).toBe(12)
  })
})

describe('ComboService', () => {
  it('retains mgp_combo and mgp_max_combo and publishes answers', () => {
    const store = storage({ mgp_combo: '2', mgp_max_combo: '4' })
    const service = createComboService(store)
    const listener = vi.fn()
    service.subscribe(listener)

    expect(service.getSnapshot()).toEqual({ combo: 2, maxCombo: 4 })
    expect(service.answer('first')).toBe(3)
    expect(store.getItem(COMBO_KEY)).toBe('3')
    expect(store.getItem(MAX_COMBO_KEY)).toBe('4')
    expect(service.getBonus()).toBe(15)

    expect(service.answer('retry')).toBe(0)
    expect(store.getItem(COMBO_KEY)).toBe('0')
    expect(store.getItem(MAX_COMBO_KEY)).toBe('4')
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('updates maximum combo and resets both stored values', () => {
    const store = storage({ mgp_combo: '9', mgp_max_combo: '9' })
    const service = createComboService(store)

    service.answer('first')
    expect(service.getSnapshot()).toEqual({ combo: 10, maxCombo: 10 })
    service.reset()

    expect(service.getSnapshot()).toEqual({ combo: 0, maxCombo: 0 })
    expect(store.getItem(COMBO_KEY)).toBe('0')
    expect(store.getItem(MAX_COMBO_KEY)).toBe('0')
  })

  it('normalizes invalid stored values and silently handles unavailable storage', () => {
    const broken = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    } as unknown as Storage
    const service = createComboService(broken)

    expect(service.getSnapshot()).toEqual({ combo: 0, maxCombo: 0 })
    expect(() => service.answer('first')).not.toThrow()
  })
})
