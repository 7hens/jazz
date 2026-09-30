import { describe, expect, it } from 'vitest'
import { UNITS } from './levels'
import { practiceQuestions, wholeReviewQuestion } from './practice'
import { canPlace, slotsFor, type Rng } from './rules'

const unit = UNITS[0]!
const level = unit.levels[0]!

/** 固定种子的 rng —— 与 PinyinBlocksGame 同源的 LCG,只为让发牌可复现。 */
function makeRng(seed: number): Rng {
  let s = (seed * 2654435761) >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

describe('练习的整题', () => {
  it('全部槽都挖空,且每一槽都有一块放得进去的正解', () => {
    const q = wholeReviewQuestion(level, 0, makeRng(0))
    expect(q.slotIds).toEqual(slotsFor(level).map((s) => s.id))
    for (const slot of slotsFor(level)) {
      expect(q.tray.some((b) => canPlace(b, slot)), slot.id).toBe(true)
    }
  })

  it('同一 rng 种子恒产出等值对象（宿主 useMemo 重跑不该换一副牌）', () => {
    const a = wholeReviewQuestion(level, 0, makeRng(7))
    const b = wholeReviewQuestion(level, 0, makeRng(7))
    expect(a).toEqual(b)
  })

  it('tray 的块 id 形如 q0-N,且不重复', () => {
    const q = wholeReviewQuestion(level, 0, makeRng(3))
    const ids = q.tray.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((id) => /^q0-\d+$/.test(id))).toBe(true)
  })
})

describe('一个单元的练习题表', () => {
  it('一道题一项,levelIndex 是在 unit.levels 里的下标', () => {
    const picked = [unit.levels[1]!, unit.levels[3]!]
    const items = practiceQuestions(unit, 0, picked, makeRng(5))
    expect(items.map((i) => i.levelIndex)).toEqual([
      unit.levels.indexOf(picked[0]!),
      unit.levels.indexOf(picked[1]!),
    ])
  })

  it('空题表 ⇒ 空数组（练习入口据此不亮）', () => {
    expect(practiceQuestions(unit, 0, [], makeRng(1))).toEqual([])
  })
})
