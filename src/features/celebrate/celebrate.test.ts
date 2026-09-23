import { describe, expect, it, vi } from 'vitest'
import { celebrationFor } from '@/shared/services'
import { createCelebrateService } from './celebrate'

describe('CelebrateService', () => {
  it('preserves confetti configurations for every celebration level', () => {
    const confetti = vi.fn()
    const service = createCelebrateService(confetti)

    service.play('combo5')
    service.play('word')
    service.play('achievement')
    service.play('combo10')

    expect(confetti.mock.calls.map(([options]) => options)).toEqual([
      { particleCount: 30, spread: 50 },
      { particleCount: 100, spread: 80, origin: { y: 0.6 } },
      { particleCount: 200, spread: 120 },
      { particleCount: 150, spread: 90 },
    ])
  })

  it('silently falls back when confetti is unavailable', () => {
    expect(() => createCelebrateService(null).play('word')).not.toThrow()
  })
})

describe('celebrationFor:连击数 → 撒花档', () => {
  // 逐值穷举 1..16,而不是只点 5 与 10:边界写错成 `>= 5` 时,
  // 只测 5/10 两条断言照样全绿 —— 那时「连到第 6 块」会跟着撒一次花。
  it('只有 5 与 10 命中,其余一律不撒', () => {
    const hit = (n: number) => celebrationFor(n)
    expect([1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16].map(hit)).toEqual(
      Array.from({ length: 14 }, () => null),
    )
    expect(hit(5)).toBe('combo5')
    expect(hit(10)).toBe('combo10')
    expect(hit(0)).toBeNull()
  })
})
