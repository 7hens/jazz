import { describe, expect, it } from 'vitest'
import type { Block } from './blocks'
import { UNITS, type Level } from './levels'
import { slotsFor, type Rng } from './rules'
import {
  addToPool,
  partReviewQuestions,
  exactPoolKey,
  MAX_REVIEW_QUESTIONS,
  notePick,
  reviewQuestionFor,
  REVIEW_TRAY_CAP,
  wholeReviewQuestion,
  WRONG_PICK_THRESHOLD,
} from './mistakes'

const seq = (values: number[]): Rng => {
  let i = 0
  return () => values[i++ % values.length] as number
}

const b = (type: Block['type'], value: string): Block => ({ type, value })

describe('notePick(简单部分的点错计数)', () => {
  it('同一块点到第 2 次才算数(N = 2)', () => {
    expect(WRONG_PICK_THRESHOLD).toBe(2)
    const first = notePick({}, 'b3')
    expect(first.reached).toBe(false)
    expect(first.counts).toEqual({ b3: 1 })
    const second = notePick(first.counts, 'b3')
    expect(second.reached).toBe(true)
    expect(second.counts).toEqual({ b3: 2 })
  })

  it('计数按块 id 分开:点错两块不同的 p 不算「同一块两次」', () => {
    const a = notePick({}, 'b1')
    const c = notePick(a.counts, 'b2')
    expect(c.reached).toBe(false)
    expect(c.counts).toEqual({ b1: 1, b2: 1 })
  })
})

describe('addToPool', () => {
  it('按家族去重:同一块加两次只进一次', () => {
    const pool = addToPool([], [b('initial', 'p')])
    expect(addToPool(pool, [b('initial', 'p')])).toHaveLength(1)
  })

  // 双身份块按家族算同一块(简单部分与复习部分的门禁是 canPlace,它们真能混用)。
  it('默认按家族去重:final:u 与 medial:u 算同一块', () => {
    const pool = addToPool([], [b('medial', 'u')])
    expect(addToPool(pool, [b('final', 'u')])).toHaveLength(1)
  })

  // 困难部分的门禁只比类型,那两个身份是真的 —— 那里按 keyOf 记账。
  it('传 exactPoolKey 时按精确身份去重:两块都留下', () => {
    const pool = addToPool([], [b('medial', 'u')], exactPoolKey)
    expect(addToPool(pool, [b('final', 'u')], exactPoolKey)).toHaveLength(2)
  })

  it('声母 n 与鼻尾 n 是两个身份,永远不被家族合并', () => {
    const pool = addToPool([], [b('initial', 'n')])
    expect(addToPool(pool, [b('nasal', 'n')])).toHaveLength(2)
  })
})

describe('partReviewQuestions', () => {
  /** 本单元全部题(简单 + 困难)拼起来的视图 —— 合成池时要按它喂错块。 */
  const levelsOf = (unitIndex: number): readonly Level[] => UNITS[unitIndex]!.levels

  it('池空:照考本单元第一道题的整题', () => {
    const unit = UNITS[0]!
    const out = partReviewQuestions(unit, 0, [])
    expect(out).toHaveLength(1)
    expect(out[0]!.levelIndex).toBe(0)
    expect(out[0]!.question.kind).toBe('whole')
    expect([...out[0]!.question.slotIds].sort()).toEqual(slotsFor(unit.levels[0]!).map((s) => s.id).sort())
  })

  it('一个类型一道小题,且每题挂在本单元第一道含该类型槽的题上', () => {
    const unitIndex = 0
    const unit = UNITS[unitIndex]!
    // 拿第一道题的真错块喂池:它只有 final / tone 两类槽。
    const pool = addToPool([], [{ type: 'final', value: 'zzz' }, { type: 'tone', value: '9' }])
    const out = partReviewQuestions(unit, unitIndex, pool)
    expect(out).toHaveLength(2)
    expect(out.map((item) => item.question.blockType).sort()).toEqual(['final', 'tone'])
    for (const item of out) {
      const host = levelsOf(unitIndex)[item.levelIndex]!
      expect(slotsFor(host).some((s) => s.type === item.question.blockType), `${host.id} 不含该类型槽`).toBe(true)
      // 「第一道含该类型槽」—— 换句话说是它前面那些题都不含
      for (const earlier of levelsOf(unitIndex).slice(0, item.levelIndex)) {
        expect(slotsFor(earlier).some((s) => s.type === item.question.blockType)).toBe(false)
      }
    }
  })

  it('挂题用的是**本单元全表**(含困难题),不是只到简单部分为止', () => {
    // u9 的简单部分第一道题是 jú(声母 + 韵母 + 声调),没有鼻尾槽;
    // 鼻尾要到 u9-53(qún)才出现 —— 它在本单元全表里的下标是 3(0 号是 u9-50)。
    const unit = UNITS.find((u) => u.id === 'u9')!
    const unitIndex = UNITS.indexOf(unit)
    const withNasal = unit.levels.findIndex((level) => slotsFor(level).some((s) => s.type === 'nasal'))
    expect(withNasal, 'u9 里没有含鼻尾槽的题 —— 这条用例的前提没了').toBeGreaterThan(0)
    const pool = addToPool([], [{ type: 'nasal', value: 'zz' }])
    const out = partReviewQuestions(unit, unitIndex, pool)
    expect(out).toHaveLength(1)
    expect(out[0]!.levelIndex).toBe(withNasal)
  })

  it('最多 MAX_REVIEW_QUESTIONS 道,最近的类型优先', () => {
    // 用 u8(三拼·介母)—— initial / medial / final / tone 四类槽俱全的单元。
    // 换成 u1(只有 final / tone 槽)的话,medial 会被「找不到槽就跳过」剔掉,
    // 只出 2 道题,「cap = 3」这个前提就没了。
    const unitIndex = 7
    const unit = UNITS[unitIndex]!
    // 四类都喂进池,池内顺序决定优先 —— 最后一个进来的排最前。
    let pool = addToPool([], [{ type: 'initial', value: 'zz' }])
    pool = addToPool(pool, [{ type: 'final', value: 'zz' }])
    pool = addToPool(pool, [{ type: 'tone', value: '9' }])
    pool = addToPool(pool, [{ type: 'medial', value: 'z' }])
    const out = partReviewQuestions(unit, unitIndex, pool)
    expect(out).toHaveLength(MAX_REVIEW_QUESTIONS)
    // 最近的三类:medial / tone / final(initial 被挤出)
    expect(out.map((item) => item.question.blockType)).toEqual(['medial', 'tone', 'final'])
  })

  it('池里的类型在本单元全表里找不到槽时跳过它,不产出半道题', () => {
    const unit = UNITS[0]!
    const pool = addToPool([], [{ type: 'medial', value: 'z' }])
    // u1 全是单韵母,没有任何介母槽 —— 该被跳过而不是抛错
    expect(partReviewQuestions(unit, 0, pool)).toEqual([])
  })
})

describe('reviewQuestionFor / wholeReviewQuestion', () => {
  it('挖空的是该题该类型的**全部**槽,其余槽用正确块预填', () => {
    const level = UNITS[6]!.levels[0]! // u7-0 xī guā:两个音节
    const q = reviewQuestionFor(level, 'final', [], 0)
    const empty = slotsFor(level).filter((s) => s.type === 'final')
    expect([...q.slotIds].sort()).toEqual(empty.map((s) => s.id).sort())
    expect(Object.keys(q.prefill).sort()).toEqual(
      slotsFor(level).filter((s) => s.type !== 'final').map((s) => s.id).sort(),
    )
    expect(q.kind).toBe('block')
    expect(q.blockType).toBe('final')
    // 块 id 前缀带小题序号 —— 同一部分里多道小题的块 id 不许撞
    for (const block of q.tray) expect(block.id.startsWith('q0-'), block.id).toBe(true)
    const q1 = reviewQuestionFor(level, 'initial', [], 1)
    for (const block of q1.tray) expect(block.id.startsWith('q1-'), block.id).toBe(true)
  })

  it('托盘含全部正解(含重复),且至少一块错解', () => {
    const level = UNITS[6]!.levels[0]!
    const wrong = { type: 'initial' as const, value: 'zh' }
    const q = reviewQuestionFor(level, 'initial', [wrong], 0)
    const visible = q.tray.filter((t) => !Object.values(q.prefill).includes(t.id))
    // 正解:每个挖空的槽各一块
    const need = slotsFor(level).filter((s) => s.type === 'initial')
    for (const slot of need) {
      expect(visible.some((t) => t.type === 'initial' && t.value === slot.value), `缺正解 ${slot.value}`).toBe(true)
    }
    expect(visible.some((t) => t.value === 'zh'), '错解没进托盘').toBe(true)
    expect(visible.length, '可见块超了上限').toBeLessThanOrEqual(REVIEW_TRAY_CAP)
  })

  it('同形块不进托盘(两块分不开不是难度,是坏题)', () => {
    const level = UNITS[0]!.levels[0]!
    const slot = slotsFor(level).find((s) => s.type === 'final')!
    const q = reviewQuestionFor(level, 'final', [{ type: 'final', value: slot.value }], 0)
    const visible = q.tray.filter((t) => !Object.values(q.prefill).includes(t.id))
    const finals = visible.filter((t) => t.type === 'final')
    expect(finals).toHaveLength(1)
  })

  it('wholeReviewQuestion 挖空所有槽、无预填', () => {
    const unit = UNITS[0]!
    const level = unit.levels[0]!
    const q = wholeReviewQuestion(level, 0, seq([0.3, 0.7]))
    expect(q.kind).toBe('whole')
    expect(q.prefill).toEqual({})
    expect([...q.slotIds].sort()).toEqual(slotsFor(level).map((s) => s.id).sort())
    // 托盘等同简单部分的 buildBlocks —— 每题都要有块可放
    for (const slot of slotsFor(level)) {
      expect(q.tray.some((t) => t.value === slot.value), `缺 ${slot.type}:${slot.value}`).toBe(true)
    }
  })
})
