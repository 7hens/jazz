import { describe, expect, it } from 'vitest'
import type { LevelOutcome } from './scoring'
import { applyResult, emptyGameState, kingdomForLevel, levelOfExp } from './state'

function outcome(stars: 0 | 1 | 2 | 3, rawScore: number): LevelOutcome {
  return { rawScore, baseMax: 60, rate: 0, stars, maxStreak: 0, firstTryCorrect: 0 }
}

describe('emptyGameState', () => {
  it('初始:stars 0、exp 0、unlocked 1、levels {}、kingdom 三键全 0', () => {
    const s = emptyGameState()
    expect(s.stars).toBe(0)
    expect(s.exp).toBe(0)
    expect(s.unlocked).toBe(1)
    expect(s.levels).toEqual({})
    expect(s.kingdom).toEqual({ pinyin: 0, hanzi: 0, english: 0 })
    expect(typeof s.updatedAt).toBe('string')
  })
})

describe('applyResult', () => {
  it('首通 L1(3★):starDelta 60、expDelta 80、unlocked→2、kingdom.pinyin 3', () => {
    const res = applyResult(emptyGameState(), 1, outcome(3, 60))
    expect(res.starDelta).toBe(60)
    expect(res.expDelta).toBe(80)
    expect(res.unlockedNew).toBe(true)
    expect(res.state.stars).toBe(60)
    expect(res.state.exp).toBe(80)
    expect(res.state.unlocked).toBe(2)
    expect(res.state.levels[1]).toEqual({ stars: 3, bestScore: 60 })
    expect(res.state.kingdom.pinyin).toBe(3)
    expect(res.state.kingdom.hanzi).toBe(0)
    expect(res.state.kingdom.english).toBe(0)
  })

  it('复玩 L1 同 3★:starDelta 0、expDelta 0、unlocked 不变', () => {
    const s = applyResult(emptyGameState(), 1, outcome(3, 60)).state
    const res = applyResult(s, 1, outcome(3, 60))
    expect(res.starDelta).toBe(0)
    expect(res.expDelta).toBe(0)
    expect(res.unlockedNew).toBe(false)
    expect(res.state.stars).toBe(60)
    expect(res.state.exp).toBe(80)
    expect(res.state.unlocked).toBe(2)
    expect(res.state.levels[1]).toEqual({ stars: 3, bestScore: 60 })
  })

  it('首通 2★ 后复玩 3★:starDelta 补差 20、exp 不再发', () => {
    const s = applyResult(emptyGameState(), 1, outcome(2, 40)).state
    expect(s.stars).toBe(40)
    const res = applyResult(s, 1, outcome(3, 60))
    expect(res.starDelta).toBe(20)
    expect(res.expDelta).toBe(0)
    expect(res.unlockedNew).toBe(false)
    expect(res.state.stars).toBe(60)
    expect(res.state.levels[1]).toEqual({ stars: 3, bestScore: 60 })
    expect(res.state.kingdom.pinyin).toBe(3)
  })

  it('首通失败(0★):不记录、不推进、无奖励', () => {
    const res = applyResult(emptyGameState(), 1, outcome(0, 0))
    expect(res.starDelta).toBe(0)
    expect(res.expDelta).toBe(0)
    expect(res.unlockedNew).toBe(false)
    expect(res.state.stars).toBe(0)
    expect(res.state.exp).toBe(0)
    expect(res.state.unlocked).toBe(1)
    expect(res.state.levels).toEqual({})
    expect(res.state.kingdom).toEqual({ pinyin: 0, hanzi: 0, english: 0 })
  })

  it('通过 L10(混合关):kingdom 三键均不增加', () => {
    const res = applyResult(emptyGameState(), 10, outcome(3, 60))
    expect(res.starDelta).toBe(60)
    expect(res.state.stars).toBe(60)
    expect(res.state.levels[10]).toEqual({ stars: 3, bestScore: 60 })
    expect(res.state.kingdom).toEqual({ pinyin: 0, hanzi: 0, english: 0 })
  })
})

describe('levelOfExp', () => {
  it.each([
    [0, 1],
    [299, 1],
    [300, 2],
    [899, 3],
  ] as const)('levelOfExp(%s) → %s', (exp, level) => {
    expect(levelOfExp(exp)).toBe(level)
  })
})

describe('kingdomForLevel', () => {
  it.each([
    [1, 'pinyin'],
    [2, 'pinyin'],
    [3, 'pinyin'],
    [4, 'pinyin'],
    [5, 'hanzi'],
    [6, 'hanzi'],
    [7, 'hanzi'],
    [8, 'english'],
    [9, 'english'],
    [10, null],
  ] as const)('kingdomForLevel(%s) → %s', (level, kingdom) => {
    expect(kingdomForLevel(level)).toBe(kingdom)
  })
})
