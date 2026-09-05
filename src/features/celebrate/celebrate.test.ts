import { describe, expect, it, vi } from 'vitest'
import { createCelebrateService } from './celebrate'

describe('CelebrateService', () => {
  it('preserves confetti configurations for every celebration level', () => {
    const confetti = vi.fn()
    const service = createCelebrateService(confetti)

    service.play('step')
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
