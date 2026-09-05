import { describe, expect, it } from 'vitest'
import { createLuckyBonusService, LUCKY_AMOUNT, LUCKY_RATE, rollLucky } from './lucky-bonus'

describe('幸运星尘', () => {
  it('rollLucky 10%→50,否则 0', () => {
    expect(LUCKY_RATE).toBe(0.1)
    expect(LUCKY_AMOUNT).toBe(50)
    expect(rollLucky(() => 0.05)).toBe(50)
    expect(rollLucky(() => 0.5)).toBe(0)
  })
  it('roll 边界恰在 LUCKY_RATE', () => {
    expect(rollLucky(() => LUCKY_RATE - 0.0001)).toBe(LUCKY_AMOUNT)
    expect(rollLucky(() => LUCKY_RATE)).toBe(0)
  })
  it('服务 roll 同口径', () => {
    const svc = createLuckyBonusService()
    expect(svc.roll(() => 0.05)).toBe(50)
    expect(svc.roll(() => 0.5)).toBe(0)
  })
})
