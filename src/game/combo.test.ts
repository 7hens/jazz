import { describe, expect, it } from 'vitest'
import type { KeyValueStore } from './storage'
import { comboBonus, loadCombo, loadMaxCombo, nextCombo, saveCombo, saveMaxCombo } from './combo'

function fakeStore(): KeyValueStore {
  const m = new Map<string, string>()
  return { get: (k) => m.get(k) ?? null, set: (k, v) => { m.set(k, v) } }
}

describe('combo 纯逻辑', () => {
  it('nextCombo:首答对 +1,重试对/错归零', () => {
    expect(nextCombo(3, 'first')).toBe(4)
    expect(nextCombo(3, 'retry')).toBe(0)
    expect(nextCombo(3, 'wrong')).toBe(0)
    expect(nextCombo(0, 'first')).toBe(1)
  })
  it('comboBonus 封顶 50', () => {
    expect(comboBonus(1)).toBe(5)
    expect(comboBonus(10)).toBe(50)
    expect(comboBonus(20)).toBe(50)
  })
  it('存取走注入 store(默认空=0)', () => {
    const st = fakeStore()
    expect(loadCombo(st)).toBe(0)
    saveCombo(7, st)
    expect(loadCombo(st)).toBe(7)
    saveMaxCombo(12, st)
    expect(loadMaxCombo(st)).toBe(12)
  })
})
