import { describe, expect, it } from 'vitest'
import { FINAL_BASIC, FINAL_COMPOUND, INITIALS_ALL, MEDIALS, NASALS, TONE_VALUES, type Block, type BlockType } from './blocks'
import { UNITS, type Level } from './levels'
import { familyKey, requiredBlocks, slotsFor, type Rng } from './rules'
import {
  addToPool,
  exactPoolKey,
  MAX_REVIEW_QUESTIONS,
  notePick,
  REVIEW_TRAY_CAP,
  reviewQuestions,
  WRONG_PICK_THRESHOLD,
  type MistakePool,
} from './mistakes'

/** 「灌满池子」用的候选值域:每一类都有几个与正解不同的值。 */
const COMMON: Record<BlockType, readonly string[]> = {
  initial: INITIALS_ALL,
  medial: MEDIALS,
  final: [...FINAL_BASIC, ...FINAL_COMPOUND],
  nasal: NASALS,
  tone: TONE_VALUES,
}

const seq = (values: number[]): Rng => {
  let i = 0
  return () => values[i++ % values.length] as number
}

function byId(id: string): Level {
  for (const u of UNITS) for (const level of u.levels) if (level.id === id) return level
  throw new Error(`没有这一关:${id}`)
}

function unitIdxOf(id: string): number {
  const index = UNITS.findIndex((u) => u.levels.some((level) => level.id === id))
  if (index < 0) throw new Error(`没有这一关:${id}`)
  return index
}

const b = (type: Block['type'], value: string): Block => ({ type, value })

/** 按家族键计数。跨片段复用:够不够放(不变量 a)与有没有多给(不变量 b)都看它。 */
const familyCounts = (blocks: readonly { type: Block['type']; value: string }[]): Map<string, number> => {
  const counts = new Map<string, number>()
  for (const block of blocks) {
    const key = familyKey(block)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

/**
 * 灌满错题池:每个槽都补上「与正解不同家族」的错值。
 *
 * 每槽给到 6 个(该类型可用的不足 6 个就给完)—— **不能每类型只喂 1 个错族**:
 * 那样可见块永远最多 3(1 正解 + 1 错解 + 预填不算),`REVIEW_TRAY_CAP = 4` 这条上限
 * 在 91 关里一次都碰不到,把 cap 算错(如 room 忘扣正解)也照样绿。池厚了,cap 才是真约束。
 */
function saturatedPool(level: Level): MistakePool {
  const pool: Block[] = []
  for (const slot of slotsFor(level)) {
    const correct = familyKey(slot)
    const seen = new Set<string>()
    let added = 0
    for (const value of COMMON[slot.type]) {
      if (added >= 6) break
      const block = b(slot.type, value)
      const key = familyKey(block)
      if (key === correct || seen.has(key)) continue
      seen.add(key)
      pool.push(block)
      added += 1
    }
  }
  return pool
}

describe('notePick(简单段的点错计数)', () => {
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

  // 双身份块按家族算同一块(简单段与复习段的门禁是 canPlace,它们真能混用)。
  it('默认按家族去重:final:u 与 medial:u 算同一块', () => {
    const pool = addToPool([], [b('medial', 'u')])
    expect(addToPool(pool, [b('final', 'u')])).toHaveLength(1)
  })

  // 困难段的门禁只比类型,那两个身份是真的 —— 那里按 keyOf 记账。
  it('传 exactPoolKey 时按精确身份去重:两块都留下', () => {
    const pool = addToPool([], [b('medial', 'u')], exactPoolKey)
    expect(addToPool(pool, [b('final', 'u')], exactPoolKey)).toHaveLength(2)
  })

  it('声母 n 与鼻尾 n 是两个身份,永远不被家族合并', () => {
    const pool = addToPool([], [b('initial', 'n')])
    expect(addToPool(pool, [b('nasal', 'n')])).toHaveLength(2)
  })
})

describe('reviewQuestions', () => {
  const BÀ = byId('u2-0') // 爸 bà = b + a + 声调
  const unit = unitIdxOf('u2-0')

  /**
   * **可见托盘** —— 复习段的托盘数组同时驮着正解、错解与**预填块**(预填块必须在这个数组里,
   * 渲染层才找得到它、才画得进槽),而屏上看得见的是「没被预填走的那几块」。
   * 上限与「家族出现次数不超过正解所需」这两条都是对**可见的那几块**说的。
   */
  const visible = (q: { prefill: Record<string, string>; tray: readonly { id: string; value: string }[] }) => {
    const placed = new Set(Object.values(q.prefill))
    return q.tray.filter((t) => !placed.has(t.id))
  }

  it('每个错块一道小题,同一类型合成一道,最多 3 道', () => {
    expect(MAX_REVIEW_QUESTIONS).toBe(3)
    const pool: MistakePool = [b('initial', 'p'), b('initial', 'm'), b('final', 'o')]
    const questions = reviewQuestions(BÀ, unit, pool, seq([0.3, 0.6]))
    // 池按入池顺序追加(后进 = 最近点错),spec §3.7「最近的优先」,故倒序遍历:
    // [initial:p, initial:m, final:o] 倒过来先出 final,再出 initial。
    expect(questions.map((q) => q.blockType)).toEqual(['final', 'initial'])
  })

  it('超过 3 个类型时取最近点错的前 3 个', () => {
    const pool: MistakePool = [
      b('initial', 'p'),
      b('final', 'o'),
      b('tone', '3'),
      b('nasal', 'n'), // 第 4 个类型 —— 该被挤掉(题面里本来也没有鼻尾槽,这里只验序)
    ]
    const questions = reviewQuestions(BÀ, unit, pool, seq([0.3, 0.6]))
    expect(questions).toHaveLength(MAX_REVIEW_QUESTIONS)
    expect(questions.map((q) => q.blockType)).toEqual(['nasal', 'tone', 'final'])
  })

  it('挖空的是本关该类型的**所有**槽,其余槽用正确块预填', () => {
    const questions = reviewQuestions(BÀ, unit, [b('initial', 'p')], seq([0.3, 0.6]))
    const q = questions[0]!
    const slots = slotsFor(BÀ)
    expect(q.slotIds).toEqual(['s0-i'])
    // 其余槽(韵母 + 声调)都预填了,且预填的块就在托盘里 —— 渲染层靠这个找得到它。
    for (const slot of slots.filter((s) => s.id !== 's0-i')) {
      const blockId = q.prefill[slot.id]
      expect(blockId, `${slot.id} 没预填`).toBeDefined()
      const block = q.tray.find((t) => t.id === blockId)
      expect(block, `预填块 ${blockId} 不在托盘里`).toBeDefined()
      expect(block!.type).toBe(slot.type)
      expect(block!.value).toBe(slot.value)
    }
  })

  it('可见托盘 = 挖空槽的正解 + 错解', () => {
    const questions = reviewQuestions(BÀ, unit, [b('initial', 'p')], seq([0.3, 0.6]))
    expect(REVIEW_TRAY_CAP).toBe(4)
    const q = questions[0]!
    // 正解 b + 错解 p —— 与视觉稿第 3 帧一致(韵母槽与声调槽都已预填,不在可见托盘里)。
    expect(visible(q).map((t) => t.value).sort()).toEqual(['b', 'p'])
  })

  // 上限是对**可见**那几块说的。预填块也在 tray 数组里(渲染层靠它找块),把它们算进上限就永远超。
  it('可见托盘永不超过 4 块(全 91 关,池灌满)', () => {
    let most = 0
    let mostAt = ''
    for (let unit = 0; unit < UNITS.length; unit++) {
      for (const level of UNITS[unit]!.levels) {
        const slotById = new Map(slotsFor(level).map((s) => [s.id, s]))
        for (const q of reviewQuestions(level, unit, saturatedPool(level), seq([0.3, 0.6]))) {
          const shown = visible(q)
          expect(shown.length, `${level.pinyin} 的复习托盘挤了 ${shown.length} 块`).toBeLessThanOrEqual(REVIEW_TRAY_CAP)
          if (shown.length > most) {
            most = shown.length
            mostAt = `${level.pinyin} / ${q.blockType}`
          }
          // 正解块本身可以同形 —— toneBlocks 对同一调按槽数补齐(u7-0 两个 tone:1 槽就要两块同形块,
          // 少一块这关无解)。这条护栏只管「多出来的那些块」:任何家族出现的次数不得超过正解所需的次数。
          const need = familyCounts(q.slotIds.map((id) => slotById.get(id)!))
          for (const [key, n] of familyCounts(shown)) {
            expect(
              n,
              `${level.pinyin} 的复习托盘里 ${key} 出现 ${n} 次,而正解只需 ${need.get(key) ?? 0} 次`,
            ).toBeLessThanOrEqual(Math.max(1, need.get(key) ?? 0))
          }
        }
      }
    }
    // cap 得真的被压满,而不是课程里永远够不着 —— 池只喂 1 个错族时可见块最多到 3,
    // 这条「恰好等于 4」缺席,把上限算错(如 room 忘扣正解)就抓不住。
    expect(most, `可见托盘最多只到 ${most} 块(${mostAt}),cap 没被压满`).toBe(REVIEW_TRAY_CAP)
  })

  it('错块的家族键与正解相同时不进可见托盘(否则两块一模一样,孩子只能瞎猜)', () => {
    // xī guā 只有一个介母槽(s1-m,正解 u)—— 音节 xī 里的 i 是韵腹(final),不是介母。
    // 池里的 medial:u 与正解那块同家族,不进可见托盘 —— 放进去就是两块分不开的「u」,孩子只能瞎猜。
    const xīguā = byId('u7-0')
    const questions = reviewQuestions(xīguā, unitIdxOf('u7-0'), [b('medial', 'u')], seq([0.3, 0.6]))
    const q = questions[0]!
    expect(visible(q).map((t) => t.value).sort()).toEqual(['u'])
    expect(q.slotIds).toEqual(['s1-m'])
  })

  it('池空时:照考本关整题 —— 所有槽挖空,托盘同简单段', () => {
    const questions = reviewQuestions(BÀ, unit, [], seq([0.3, 0.6, 0.9]))
    expect(questions).toHaveLength(1)
    const q = questions[0]!
    expect(q.kind).toBe('whole')
    expect(q.slotIds).toEqual(slotsFor(BÀ).map((s) => s.id))
    expect(q.prefill).toEqual({})
    for (const need of requiredBlocks(BÀ)) {
      expect(q.tray.some((t) => t.type === need.type && t.value === need.value), `${need.value} 不在托盘里`).toBe(true)
    }
  })

  // Review Focus #5:双音节 + 双身份块 —— 两个同类型槽同时挖空时,托盘要给足两块正解,少一块就无解。
  it('双音节的两个同类型槽都挖空时,托盘给足两块正解', () => {
    // huā duǒ 两个音节的介母**都是 u**(双身份块):两个槽一起挖空,托盘必须给两块 u,
    // 少一块后一个槽就无块可放。
    const huāduǒ = byId('u7-4')
    const questions = reviewQuestions(huāduǒ, unitIdxOf('u7-4'), [b('medial', 'ü')], seq([0.3, 0.6]))
    const q = questions[0]!
    expect(q.slotIds).toEqual(['s0-m', 's1-m'])
    expect(
      q.tray.filter((t) => t.type === 'medial' && t.value === 'u'),
      '正解 u 只给了一块,后一个槽无块可放',
    ).toHaveLength(2)
    // 错解 ü 与正解不同家族,照样进托盘 —— 复习里总有正解与错解并排。
    expect(q.tray.some((t) => t.type === 'medial' && t.value === 'ü')).toBe(true)
  })

  // 不变量 (a):挖空的每个槽都要有一块可放的托盘块,**重数也要够**。
  // 双音节两个同值槽(u7-0 两块一声、u7-4 两块介母 u)就要两块正解 —— 少一块后一个槽无块可放。
  // 现有的单例只覆盖 u7-4,这里扫全 91 关,抓「按家族去重后少给一块正解」这类回归。
  it('每个挖空槽在托盘里都有对应家族的块,重数也够(全 91 关,池灌满)', () => {
    for (let unit = 0; unit < UNITS.length; unit++) {
      for (const level of UNITS[unit]!.levels) {
        const slotById = new Map(slotsFor(level).map((s) => [s.id, s]))
        for (const q of reviewQuestions(level, unit, saturatedPool(level), seq([0.3, 0.6]))) {
          const need = familyCounts(q.slotIds.map((id) => slotById.get(id)!))
          const got = familyCounts(q.tray)
          for (const [key, n] of need) {
            expect(
              got.get(key) ?? 0,
              `${level.pinyin} 的 ${key} 槽要 ${n} 块,托盘只给了 ${got.get(key) ?? 0} 块`,
            ).toBeGreaterThanOrEqual(n)
          }
        }
      }
    }
  })
})
