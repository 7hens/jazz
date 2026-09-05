import { describe, expect, it } from 'vitest'
import { lingLingStage, LINGLING_STAGES } from './stages'

describe('灵灵档位', () => {
  it('分档阈值', () => {
    expect(lingLingStage(0)).toBe(0)
    expect(lingLingStage(9)).toBe(0)
    expect(lingLingStage(10)).toBe(1)
    expect(lingLingStage(30)).toBe(2)
    expect(lingLingStage(50)).toBe(3)
    expect(lingLingStage(80)).toBe(4)
    expect(lingLingStage(100)).toBe(4)
  })
  it('五档元数据齐全(文案/表情保留)', () => {
    expect(LINGLING_STAGES).toHaveLength(5)
    LINGLING_STAGES.forEach((meta) => {
      expect(meta.emoji).toBeTruthy()
      expect(meta.label).toBeTruthy()
      expect(meta.className).toContain('animate-[ll-')
    })
    // 抽验文案未被破坏
    expect(LINGLING_STAGES[0].label).toBe('灵灵在睡觉…快醒醒!')
    expect(LINGLING_STAGES[0].emoji).toBe('😴')
    expect(LINGLING_STAGES[4].label).toBe('你是我的英雄!')
    expect(LINGLING_STAGES[4].emoji).toBe('🦊👑')
  })
})
