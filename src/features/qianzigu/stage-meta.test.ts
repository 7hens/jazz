import { describe, expect, it } from 'vitest'
import type { ChapterLine } from './chapter'
import { castFor, defaultAtmosphere, isNarrator, progressFraction, restoreCount, showMoonStars, skySplit, sunStage } from './stage-meta'

const L = (role: ChapterLine['role']): ChapterLine => ({ role, text: 'x' })

describe('stage-meta', () => {
  it('isNarrator: 仅 narrator 为真', () => {
    expect(isNarrator('narrator')).toBe(true)
    expect(isNarrator('lingling')).toBe(false)
  })

  it('castFor: 无 presets 时按台词首现序推角色(滤 narrator、去重)', () => {
    const lines = [L('lingling'), L('narrator'), L('sun'), L('lingling'), L('sun')]
    expect(castFor(lines)).toEqual(['lingling', 'sun'])
  })

  it('castFor: presets 常驻且优先,台词新角色按序补入,重复与 narrator 均滤除', () => {
    const lines = [L('sun'), L('villager')]
    expect(castFor(lines, ['lingling', 'moon', 'moon', 'narrator'])).toEqual(['lingling', 'moon', 'sun', 'villager'])
  })

  it('castFor: 空台词 + 无 presets → 空阵容', () => {
    expect(castFor([])).toEqual([])
  })

  it('restoreCount: 统计该词被恢复的次数(sound/shape 各计一次 → 0..2)', () => {
    const restored = [{ wordId: 1 }, { wordId: 2 }, { wordId: 1 }]
    expect(restoreCount(restored, 1)).toBe(2)
    expect(restoreCount(restored, 2)).toBe(1)
    expect(restoreCount(restored, 3)).toBe(0)
  })

  it('defaultAtmosphere: boss→dark;settle/ending→day;break→night;其余→dawn', () => {
    expect(defaultAtmosphere('boss')).toBe('dark')
    expect(defaultAtmosphere('settle')).toBe('day')
    expect(defaultAtmosphere('ending')).toBe('day')
    expect(defaultAtmosphere('break')).toBe('night')
    expect(defaultAtmosphere('dialogue')).toBe('dawn')
    expect(defaultAtmosphere('task')).toBe('dawn')
    expect(defaultAtmosphere('social')).toBe('dawn')
  })
})

describe('太阳档 / 回春 / 月星 / 天空体', () => {
  it('sunStage 按进度分档', () => {
    expect(sunStage(0)).toBe('burnt')
    expect(sunStage(0.1)).toBe('burnt')
    expect(sunStage(0.2)).toBe('crack')
    expect(sunStage(0.5)).toBe('glow')
    expect(sunStage(0.79)).toBe('glow')
    expect(sunStage(0.8)).toBe('full')
    expect(sunStage(1)).toBe('full')
  })
  it('showMoonStars:真夜(dark/night)恒显;失光(dawn 低进度)显;day 复原高进度隐', () => {
    expect(showMoonStars(0, 'night')).toBe(true)
    expect(showMoonStars(1, 'night')).toBe(true)   // 真夜不管进度
    expect(showMoonStars(0, 'dawn')).toBe(true)     // 失光才见星月
    expect(showMoonStars(0.5, 'dawn')).toBe(true)
    expect(showMoonStars(0.9, 'dawn')).toBe(false)
    expect(showMoonStars(1, 'day')).toBe(false)
  })
  it('skySplit:只保留出现在 cast 的天空体;narrator 不进 sky', () => {
    const cast = ['lingling', 'sun', 'moon'] as const
    expect(skySplit([...cast], ['sun', 'narrator'])).toEqual({ ground: ['lingling', 'moon'], sky: ['sun'] })
    expect(skySplit([...cast], undefined)).toEqual({ ground: ['lingling', 'sun', 'moon'], sky: [] })
  })
  it('progressFraction 夹 [0,1]', () => {
    expect(progressFraction(0, 10)).toBe(0)
    expect(progressFraction(5, 10)).toBe(0.5)
    expect(progressFraction(10, 10)).toBe(1)
    expect(progressFraction(12, 10)).toBe(1)
  })
})
