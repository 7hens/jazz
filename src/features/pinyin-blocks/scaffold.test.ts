// 脚手架遍题源(`scaffold.ts`)的纯逻辑测试。
// 覆盖 spec §5 的「纯逻辑」与「声调型专有」两节 + 一条「无解即退单遍」的防御守卫。
// 组件层(prefill 锁定的三处门禁 / `.pslot--given` / 落库键)在各自 lane 的测试里。

import { describe, expect, it } from 'vitest'

import type { Block } from './blocks'
import { focusTypeOf, taughtBlocks, type Level, UNITS } from './levels'
import { practiceQuestions } from './practice'
import { canPlace, slotsFor, toneBlocks, type Rng } from './rules'
import { scaffoldKindOf, scaffoldLevelIdOf, scaffoldQuestion, SCAFFOLD_TRAY_CAP, type ScaffoldQuestion } from './scaffold'

/** 确定性 rng:同一个种子恒等值(可复现性那条靠它)。 */
const seeded = (seed: number): Rng => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

/** 所有单元的简单题,带单元序号 —— 题源遍历的入口。 */
const EASY: readonly { unitIndex: number; level: Level }[] = UNITS.flatMap((unit, unitIndex) =>
  unit.levels.filter((l) => l.stage !== 'hard').map((level) => ({ unitIndex, level })),
)

const keyOf = (b: Block): string => `${b.type}:${b.value}`

const findLevel = (id: string) => {
  const hit = EASY.find((e) => e.level.id === id)
  if (!hit) throw new Error(`没有简单题 ${id}`)
  return hit
}

/**
 * 托盘里**不是预填**的那些块 —— 即孩子真正能拿起来的那几块。
 * 预填块也住在 `tray` 里(spec §2.5:组件靠 `tray.find` 反查),但它们被 `liveBlocks` 滤掉,
 * 不出现在托盘可视列表上,所以托盘算法相关的断言一律要在扣掉它们之后数。
 */
const trayOf = (q: ScaffoldQuestion) => {
  const given = new Set(Object.values(q.prefill))
  return q.tray.filter((b) => !given.has(b.id))
}

describe('focusTypeOf', () => {
  // 逐单元实测(spec §2.2 那张表):u1–u9 各有新教类型,u10–u12 的 badge 块全部更早教过。
  it('12 个单元逐个断言', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(focusTypeOf)).toEqual([
      'final',
      'initial',
      'initial',
      'initial',
      'final',
      'nasal',
      'nasal',
      'medial',
      'final',
      null,
      null,
      null,
    ])
  })

  it('越界单元返 null(而不是崩)', () => {
    expect(focusTypeOf(-1)).toBeNull()
    expect(focusTypeOf(UNITS.length)).toBeNull()
  })

  it('badge 含更早已教块时取新教的那个,而非「出现最多的类型」', () => {
    // 口径跑一遍:badge ∩ 本单元之前没教过的块,取第一个。
    // 假 badge = [已教过的 final: a, 新教的 nasal: ng] —— 用 u1 之后当「之前」的口径。
    const before = new Set(taughtBlocks(0).map(keyOf))
    const fake = [
      { type: 'final', value: 'a' },
      { type: 'nasal', value: 'ng' },
    ] as const
    expect(fake.filter((b) => !before.has(keyOf(b))).map((b) => b.type)).toEqual(['nasal'])
    // 反面:badge 全旧 ⇒ null(u10/u11/u12 就是这一类,上一条已实测)。
    expect(fake.filter((b) => before.has(keyOf(b))).map((b) => b.type)).toEqual(['final'])
    expect(taughtBlocks(9).filter((b) => UNITS[9]!.badge.some((x) => keyOf(x) === keyOf(b)))).not.toHaveLength(0)
    // 而「出现最多的类型」在这道假单元里会答 final(u2 顺带复习了一堆 final: a,
    // 但 u2 新教的是 initial: b)—— 差集口径与它天然分道扬镳,故 focusTypeOf(u2) 必须是 initial。
    expect(focusTypeOf(1)).toBe('initial')
  })
})

describe('scaffoldKindOf', () => {
  it('u1–u9 恒 focus、u10–u12 恒 tone(spec §2.2b 的口径锚)', () => {
    for (const { unitIndex, level } of EASY) {
      expect(scaffoldKindOf(level, unitIndex)).toBe(unitIndex <= 8 ? 'focus' : 'tone')
    }
  })

  it('判据是「题里有该类槽」,不是单元序号', () => {
    const first = UNITS[0]!.levels[0]!
    expect(scaffoldKindOf(first, 0)).toBe('focus')
    // 越界单元没有 focus 类型 ⇒ 落声调遍。
    expect(scaffoldKindOf(first, UNITS.length)).toBe('tone')
  })
})

describe('scaffoldQuestion 通用不变量', () => {
  for (const { unitIndex, level } of EASY) {
    describe(`${level.id}(${UNITS[unitIndex]!.id})`, () => {
      const q = scaffoldQuestion(level, unitIndex, seeded(12345))!
      const kind = scaffoldKindOf(level, unitIndex)
      const slots = slotsFor(level)
      const focus = kind === 'focus' ? focusTypeOf(unitIndex) : 'tone'
      const open = slots.filter((s) => s.type === focus)

      it('恒非 null:今天每一道简单题都跑脚手架遍', () => {
        expect(scaffoldKindOf(level, unitIndex)).not.toBeNull()
        expect(q).not.toBeNull()
      })

      it('slotIds ∪ prefill 的键 恒等于全部槽(不多不少)', () => {
        const all = slots.map((s) => s.id).sort()
        expect([...q.slotIds, ...Object.keys(q.prefill)].sort()).toEqual(all)
      })

      it('slotIds 恒只含挖空类型的槽;其余恒全部预填', () => {
        expect(q.slotIds).toEqual(open.map((s) => s.id))
        for (const s of slots) {
          if (s.type === focus) expect(q.prefill[s.id]).toBeUndefined()
          else expect(q.prefill[s.id]).toBeDefined()
        }
        expect(Object.keys(q.prefill)).toHaveLength(slots.length - open.length)
      })

      it('托盘恒含全部正解块:每个空槽都有一个能落进去的块', () => {
        for (const s of open) expect(q.tray.some((b) => canPlace(b, s))).toBe(true)
      })

      it('每一块**可操作**托盘块的类型都在盘面存在(不变量 3 的可落性那一半)', () => {
        // 干扰块**故意**放不进任何槽(canPlace 比值)—— 它们就是「点错会弹回」的那个东西,
        // 那正是 §1 说最小对立对「这时才开始起作用」的机制。但它们的**类型**必须在空槽里
        // 有对应槽,否则托盘上就是一块无处可落的块 —— 那是 spec §2.5 说的坏题。
        // 预填块不在此列:它们已经坐在槽上,压根不参与落位。
        for (const b of trayOf(q)) expect(open.some((s) => s.type === b.type)).toBe(true)
      })

      it('预填块在托盘里(组件靠 tray 反查),且每个都放得进它那个槽', () => {
        for (const [slotId, blockId] of Object.entries(q.prefill)) {
          const slot = slots.find((s) => s.id === slotId)!
          const block = q.tray.find((b) => b.id === blockId)
          expect(block).toBeDefined()
          expect(canPlace(block!, slot)).toBe(true)
        }
        expect(trayOf(q).length).toBeGreaterThanOrEqual(q.slotIds.length)
      })

      it('块 id 唯一;预填块走 p{i} 段、其余走 q0-{j} 段(不混)', () => {
        expect(new Set(q.tray.map((b) => b.id)).size).toBe(q.tray.length)
        for (const blockId of Object.values(q.prefill)) expect(blockId).toMatch(/^p\d+$/)
        for (const b of trayOf(q)) expect(b.id).toMatch(/^q0-\d+$/)
      })

      it('干扰块恒在 taughtBlocks(unitIndex) 内(声调型除外:声调块不是课程块)', () => {
        // 声调块的池子另有出处(`TONE_VALUES` 恒全出,`taughtBlocks` 里恒没有声调块),
        // 那条纪律属于声调型自己的「恒不产干扰块」,见下面那一节。
        if (kind !== 'focus') return
        const taught = taughtBlocks(unitIndex)
        for (const b of trayOf(q)) expect(taught.some((t) => keyOf(t) === keyOf(b))).toBe(true)
      })

      it('可复现:同一入参 + 同一种子恒等值', () => {
        const a = scaffoldQuestion(level, unitIndex, seeded(777))
        const b = scaffoldQuestion(level, unitIndex, seeded(777))
        expect(b).toEqual(a)
        expect(b!.tray.map((x) => x.id)).toEqual(a!.tray.map((x) => x.id))
      })
    })
  }
})

/** focus 型的托盘算法:总块数封顶、易混伙伴优先、池子浅时如实少给。 */
describe('focus 型托盘', () => {
  it('干扰块恒 ≥1,托盘总块数封顶 SCAFFOLD_TRAY_CAP', () => {
    for (const { unitIndex, level } of EASY) {
      if (scaffoldKindOf(level, unitIndex) !== 'focus') continue
      const q = scaffoldQuestion(level, unitIndex, seeded(9))!
      const distractors = trayOf(q).length - q.slotIds.length
      expect(trayOf(q).length).toBeLessThanOrEqual(SCAFFOLD_TRAY_CAP)
      // 池子本身只有 1 个值时如实给 1 块(spec §2.5:不为凑数造没教过的块)。
      const focus = focusTypeOf(unitIndex)!
      const pool = new Set(taughtBlocks(unitIndex).filter((b) => b.type === focus).map((b) => b.value))
      if (pool.size > 1) expect(distractors).toBeGreaterThanOrEqual(1)
    }
  })

  it('u2-0 的干扰块优先取易混伙伴(b 的伙伴 p)', () => {
    const { unitIndex, level } = findLevel('u2-0')
    const q = scaffoldQuestion(level, unitIndex, seeded(1))!
    expect(q.slotIds).toEqual(['s0-i'])
    expect(trayOf(q).filter((b) => b.value !== 'b').map((b) => b.value)).toContain('p')
  })
})

describe('声调型专有(spec §2.2b)', () => {
  const tone = (id: string) => {
    const { unitIndex, level } = findLevel(id)
    expect(scaffoldKindOf(level, unitIndex)).toBe('tone')
    return { level, q: scaffoldQuestion(level, unitIndex, seeded(3))! }
  }
  const toneLevels = EASY.filter((e) => scaffoldKindOf(e.level, e.unitIndex) === 'tone')

  it('u10/u11 的 17 道 + u12 的 6 道 = 23 道走声调遍(它们没有新教类型)', () => {
    expect(toneLevels).toHaveLength(23)
    expect(toneLevels.filter((e) => e.unitIndex === 9)).toHaveLength(8)
    expect(toneLevels.filter((e) => e.unitIndex === 10)).toHaveLength(9)
    expect(toneLevels.filter((e) => e.unitIndex === 11)).toHaveLength(6)
  })

  it('托盘恒等于 toneBlocks(level):块数与值序列一字不差', () => {
    for (const { unitIndex, level } of toneLevels) {
      const q = scaffoldQuestion(level, unitIndex, seeded(4))!
      expect(trayOf(q).map((b) => b.value)).toEqual(toneBlocks(level).map((b) => b.value))
      expect(trayOf(q).map((b) => b.type)).toEqual(toneBlocks(level).map(() => 'tone'))
    }
  })

  it('同调双音节题恒 5 块:u7-0(xī guā)、u7-3(hú dié)、u12-50(dà shù)', () => {
    // ⚠ spec §2.2b / §5 把 u12-50 归在「异调 ⇒ 4 块」那侧。**实测是同调**:
    // `dà shù` 两个音节都是第四声,toneBlocks 的 need 计数出 1 2 3 4 4(5 块)。
    // 少给一块四声 ⇒ 后一个音节永远填不满(不变量 6)。**以实测为准**。
    for (const [id, expected] of [
      ['u7-0', '11234'],
      ['u7-3', '12234'],
      ['u12-50', '12344'],
    ] as const) {
      const { level, q } = tone(id)
      expect(trayOf(q).map((b) => b.value).join('')).toBe(expected)
      expect(trayOf(q)).toHaveLength(5)
      expect(trayOf(q)).toHaveLength(toneBlocks(level).length)
    }
  })

  it('异调双音节题恒 4 块:u7-1 / u7-2 / u7-4', () => {
    for (const [id, expected] of [
      ['u7-1', '1234'],
      ['u7-2', '1234'],
      ['u7-4', '1234'],
    ] as const) {
      const { q } = tone(id)
      expect(trayOf(q)).toHaveLength(4)
      expect(trayOf(q).map((b) => b.value).join('')).toBe(expected)
    }
  })

  it('单音节题恒 4 块(四声恒全出)', () => {
    for (const { unitIndex, level } of toneLevels) {
      if (level.syl.length !== 1) continue
      expect(trayOf(scaffoldQuestion(level, unitIndex, seeded(11))!)).toHaveLength(4)
    }
  })

  it('恒不套 SCAFFOLD_TRAY_CAP:u7-0 仍是 5 块(被 cap 截到 4 会正好切掉一块一声 ⇒ 无解)', () => {
    const { q } = tone('u7-0')
    expect(trayOf(q)).toHaveLength(5)
    expect(trayOf(q).length).toBeGreaterThan(SCAFFOLD_TRAY_CAP)
  })

  it('正解块数恒 ≥ 空槽数(不变量 6,逐题断言):按槽逐个消耗正解块', () => {
    for (const { unitIndex, level } of toneLevels) {
      const q = scaffoldQuestion(level, unitIndex, seeded(5))!
      const left = [...q.tray]
      for (const s of slotsFor(level).filter((x) => x.type === 'tone')) {
        const i = left.findIndex((b) => canPlace(b, s))
        expect(i, `${level.id} 的 ${s.id} 无块可放`).toBeGreaterThanOrEqual(0)
        left.splice(i, 1)
      }
    }
  })

  it('声调型恒不产干扰块:非正解块没有重复值', () => {
    // CONFUSABLE.tone 恒空 ⇒ 非正解的那几块恒定互不相同。
    // 双音节同调题里多出来的那块是**正解**(第二块一声),两个 id 的两块,不是一块重复。
    for (const { unitIndex, level } of toneLevels) {
      const q = scaffoldQuestion(level, unitIndex, seeded(6))!
      const correct = new Set(slotsFor(level).filter((s) => s.type === 'tone').map((s) => s.value))
      const extras = trayOf(q).filter((b) => !correct.has(b.value))
      expect(new Set(extras.map((b) => b.value)).size).toBe(extras.length)
      // 同调题的重复值恰好多出「空槽数 - 不同调数」块。
      expect(trayOf(q).filter((b) => correct.has(b.value))).toHaveLength(q.slotIds.length)
    }
  })

  it('slotIds 恒等于该题全部 tone 槽(单音节 1 个、双音节 2 个)', () => {
    for (const { unitIndex, level } of toneLevels) {
      const q = scaffoldQuestion(level, unitIndex, seeded(7))!
      expect(q.slotIds).toEqual(slotsFor(level).filter((s) => s.type === 'tone').map((s) => s.id))
      expect(q.slotIds).toHaveLength(level.syl.length)
    }
  })
})

describe('降级守卫', () => {
  it('focus 类型在题里无槽时返 null,不出脚手架遍(不变量 7)', () => {
    // 假题:u6 的 focus 是 nasal,但这道题只有 final + tone ⇒ 没有 nasal 槽。
    const fake: Level = { id: 'u6-60', emoji: '🚪', pinyin: 'ān', read: '安', syl: [{ final: 'a', tone: 1 }] }
    expect(scaffoldKindOf(fake, 5)).toBeNull()
    expect(scaffoldQuestion(fake, 5)).toBeNull()
    // 同一道题放进 u7(focus 也是 nasal)一样退成单遍。
    expect(scaffoldQuestion(fake, 6)).toBeNull()
    // 反面:给一道真有 nasal 槽的题,同样的题就产生脚手架遍(证明守卫没把一切掐死)。
    expect(scaffoldQuestion({ ...fake, id: 'x', pinyin: 'án', read: '俺', syl: [{ final: 'a', nasal: 'n', tone: 2 }] }, 5)).not
      .toBeNull()
  })
})

describe('scaffoldLevelIdOf', () => {
  it('脚手架遍落 ${id}s(裁定 C)', () => {
    expect(scaffoldLevelIdOf('u2-0')).toBe('u2-0s')
  })

  it('已是 h 键时照拼(困难部分不做脚手架遍,这条是防御)', () => {
    expect(scaffoldLevelIdOf('u2-0h')).toBe('u2-0hs')
  })
})

describe('与练习题源互不干扰', () => {
  it('脚手架遍的存在不改变 practice 的题源(同一条可复现要求)', () => {
    const unit = UNITS[1]!
    const easy = unit.levels.filter((l) => l.stage !== 'hard')
    expect(practiceQuestions(unit, 1, easy, seeded(42))).toEqual(practiceQuestions(unit, 1, easy, seeded(42)))
  })
})