import { describe, expect, it } from 'vitest'
import type { ChapterLine } from './chapter'
import { castFor, defaultAtmosphere, isNarrator, progressFraction, restoreCount, skySplit } from './stage-meta'

const L = (role: ChapterLine['role']): ChapterLine => ({ role, text: 'x' })

describe('stage-meta', () => {
  it('isNarrator: 仅 narrator 为真', () => {
    expect(isNarrator('narrator')).toBe(true)
    expect(isNarrator('lingling')).toBe(false)
  })

  it('castFor: 无 presets 时按台词首现序推角色(滤 narrator、去重)', () => {
    const lines = [L('lingling'), L('narrator'), L('xuwannian'), L('lingling'), L('xuwannian')]
    expect(castFor(lines)).toEqual(['lingling', 'xuwannian'])
  })

  it('castFor: presets 常驻且优先,台词新角色按序补入,重复与 narrator 均滤除', () => {
    const lines = [L('xuwannian'), L('changmo')]
    expect(castFor(lines, ['lingling', 'pixiaonao', 'pixiaonao', 'narrator'])).toEqual(['lingling', 'pixiaonao', 'xuwannian', 'changmo'])
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

describe('天空体 / 进度', () => {
  it('skySplit:只保留出现在 cast 的天空体;narrator 不进 sky', () => {
    const cast = ['lingling', 'xuwannian', 'pixiaonao'] as const
    expect(skySplit([...cast], ['xuwannian', 'narrator'])).toEqual({ ground: ['lingling', 'pixiaonao'], sky: ['xuwannian'] })
    expect(skySplit([...cast], undefined)).toEqual({ ground: ['lingling', 'xuwannian', 'pixiaonao'], sky: [] })
  })
  it('progressFraction 夹 [0,1]', () => {
    expect(progressFraction(0, 10)).toBe(0)
    expect(progressFraction(5, 10)).toBe(0.5)
    expect(progressFraction(10, 10)).toBe(1)
    expect(progressFraction(12, 10)).toBe(1)
  })
})
