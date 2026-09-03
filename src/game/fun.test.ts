import { describe, expect, it } from 'vitest'
import {
  lingLingStage, LUCKY_AMOUNT, LUCKY_RATE, nextConsecutive, rollLucky, shiftDate, todayKey,
} from './fun'

describe('fun 本地日与连续天数', () => {
  it('todayKey 本地 YYYY-MM-DD', () => {
    expect(todayKey(new Date(2026, 8, 4, 23, 30))).toBe('2026-09-04')
    expect(todayKey(new Date(2026, 0, 1))).toBe('2026-01-01')
  })
  it('shiftDate 跨月/跨年', () => {
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftDate('2026-01-01', -1)).toBe('2025-12-31')
    expect(shiftDate('2026-09-04', 1)).toBe('2026-09-05')
  })
  it('nextConsecutive:首日=1,昨日+1,同日不变,断档重置', () => {
    expect(nextConsecutive(0, '', '2026-09-04')).toBe(1)
    expect(nextConsecutive(3, '2026-09-03', '2026-09-04')).toBe(4)
    expect(nextConsecutive(4, '2026-09-04', '2026-09-04')).toBe(4)
    expect(nextConsecutive(5, '2026-09-01', '2026-09-04')).toBe(1)
  })
})

describe('fun 幸运', () => {
  it('rollLucky 10%→50,否则 0', () => {
    expect(LUCKY_RATE).toBe(0.1)
    expect(LUCKY_AMOUNT).toBe(50)
    expect(rollLucky(() => 0.05)).toBe(50)
    expect(rollLucky(() => 0.5)).toBe(0)
  })
})

describe('fun 灵灵档位', () => {
  it('分档阈值', () => {
    expect(lingLingStage(0)).toBe(0)
    expect(lingLingStage(9)).toBe(0)
    expect(lingLingStage(10)).toBe(1)
    expect(lingLingStage(30)).toBe(2)
    expect(lingLingStage(50)).toBe(3)
    expect(lingLingStage(80)).toBe(4)
    expect(lingLingStage(100)).toBe(4)
  })
})
