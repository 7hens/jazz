import { describe, expect, it, vi } from 'vitest'
import { CELEBRATE_LEVELS, celebrationFor } from '@/shared/services'
import { createCelebrateService } from './celebrate'

describe('CelebrateService', () => {
  it('每一档都有撒花配置,数值逐个钉住', () => {
    const confetti = vi.fn()
    const service = createCelebrateService(confetti)

    CELEBRATE_LEVELS.forEach(level => service.play(level))

    expect(confetti.mock.calls.map(([options]) => options)).toEqual([
      { particleCount: 30, spread: 50 },
      { particleCount: 100, spread: 80, origin: { y: 0.6 } },
      { particleCount: 150, spread: 90 },
      { particleCount: 200, spread: 120 },
      { particleCount: 60, spread: 70 },
    ])
  })

  it('每一档都发出它那一档的声音(档→音表逐个钉住)', () => {
    const cue = vi.fn()
    const service = createCelebrateService(null, cue)

    CELEBRATE_LEVELS.forEach(level => service.play(level))

    expect(cue.mock.calls.map(([c]) => c)).toEqual(['streak', 'correct', 'streak', 'achievement', 'lucky'])
  })

  it('没有撒花 / 没有声音回调时各自静默,互不牵连', () => {
    expect(() => createCelebrateService(null, null).play('word')).not.toThrow()
    const confetti = vi.fn()
    expect(() => createCelebrateService(confetti, null).play('lucky')).not.toThrow()
    expect(confetti).toHaveBeenCalledOnce()
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
