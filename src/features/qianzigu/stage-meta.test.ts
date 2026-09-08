import { describe, expect, it } from 'vitest'
import type { ChapterLine } from './chapter'
import { castFor, isNarrator, restoreCount } from './stage-meta'

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
})
