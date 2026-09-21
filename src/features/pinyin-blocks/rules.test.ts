import { describe, expect, it } from 'vitest'
import { TONE_VALUES, poolFor, type Block } from './blocks'
import { UNITS } from './levels'
import {
  autoTargetId,
  buildBlocks,
  canPlace,
  isComplete,
  requiredBlocks,
  slotsFor,
  solutionValues,
  toneBlocks,
  wrongSlotIds,
  type Placement,
  type Rng,
  type Slot,
  type TrayBlock,
} from './rules'

/** 固定序列 rng,保证洗牌可控。 */
const seq = (values: number[]): Rng => {
  let i = 0
  return () => values[i++ % values.length] as number
}

const lv = (unit: number, index: number) => UNITS[unit]!.levels[index]!
const GUĀ = lv(4, 0) // 🍉 guā = g + 介母 u + a
const ZHĪ = lv(5, 0) // 🕷️ zhī = zh + i(焊死)
const XĪGUĀ = lv(6, 0) // 🍉 xī guā = 双音节

const slot = (type: Slot['type'], value: string): Slot => ({ id: 'x', type, value, sylIdx: 0 })
const withId = (b: Block, id: string): TrayBlock => ({ ...b, id })

describe('slotsFor', () => {
  it('按 声母 → 介母 → 韵母 → 鼻音 排,声调槽骑在韵腹上方', () => {
    const slots = slotsFor(lv(4, 2)) // 🐻 xióng = x + 介母 i + o + ng
    expect(slots.map((s) => s.type)).toEqual(['initial', 'medial', 'final', 'nasal', 'tone'])
    expect(slots.find((s) => s.type === 'tone')?.anchor).toBe('s0-f')
  })

  it('y + ü 合成的音节(整体认读)照样摊成两块,声调仍骑韵腹', () => {
    const slots = slotsFor(lv(5, 4)) // 🐟 yú = y + ü
    expect(slots.map((s) => s.type)).toEqual(['initial', 'final', 'tone'])
    expect(slots.find((s) => s.type === 'tone')?.anchor).toBe('s0-f')
  })

  it('零声母音节不摆空声母槽', () => {
    const slots = slotsFor(lv(2, 2)) // ❤️ ài
    expect(slots.map((s) => s.type)).toEqual(['final', 'tone'])
  })

  it('双音节词给两组槽,各自带自己的声调槽', () => {
    const slots = slotsFor(XĪGUĀ)
    expect(slots.filter((s) => s.type === 'tone')).toHaveLength(2)
    expect(new Set(slots.map((s) => s.sylIdx))).toEqual(new Set([0, 1]))
  })

  it('每个非声调槽的 value 都能在自己类型里找到同类槽位语义', () => {
    for (const u of UNITS) {
      for (const level of u.levels) {
        for (const s of slotsFor(level)) {
          expect(s.value.length, `${level.pinyin}/${s.id}`).toBeGreaterThan(0)
        }
      }
    }
  })
})

describe('canPlace', () => {
  it('同类型同值放行', () => {
    expect(canPlace({ type: 'initial', value: 'g' }, slot('initial', 'g'))).toBe(true)
    expect(canPlace({ type: 'tone', value: '3' }, slot('tone', '3'))).toBe(true)
  })

  it('值不等一律拒绝', () => {
    expect(canPlace({ type: 'initial', value: 'g' }, slot('initial', 'k'))).toBe(false)
    expect(canPlace({ type: 'tone', value: '1' }, slot('tone', '3'))).toBe(false)
    expect(canPlace({ type: 'final', value: 'a' }, slot('medial', 'u'))).toBe(false)
  })

  it('i/u/ü 是双身份块:介母槽与韵母槽互换放行', () => {
    expect(canPlace({ type: 'final', value: 'u' }, slot('medial', 'u'))).toBe(true)
    expect(canPlace({ type: 'medial', value: 'i' }, slot('final', 'i'))).toBe(true)
  })

  it('双身份只限介母↔韵母,不扩散到其它类型', () => {
    expect(canPlace({ type: 'initial', value: 'g' }, slot('final', 'g'))).toBe(false)
    expect(canPlace({ type: 'final', value: 'a' }, slot('medial', 'a'))).toBe(false) // a 不是双身份
  })
})

describe('requiredBlocks(含重复)', () => {
  it('每个槽各要一块,不含声调', () => {
    const blocks = requiredBlocks(XĪGUĀ) // x i g u a
    expect(blocks.map((b) => `${b.type}:${b.value}`).sort()).toEqual(
      ['final:a', 'final:i', 'initial:g', 'initial:x', 'medial:u'].sort(),
    )
  })

  it('两个音节同块时要两块 —— 去重会让后一个音节无块可放', () => {
    const niuNai = lv(6, 2) // 🥛 niú nǎi:两个 n 声母
    const nCount = requiredBlocks(niuNai).filter((b) => b.type === 'initial' && b.value === 'n').length
    expect(nCount).toBe(2)

    const huaDuo = lv(6, 4) // 🌸 huā duǒ:两个介母 u
    const uCount = requiredBlocks(huaDuo).filter((b) => b.type === 'medial' && b.value === 'u').length
    expect(uCount).toBe(2)
  })

  // iu(← iou)、ui(← uei)是独立韵母。拆成 i+ou 会拼出 niou、拆成 u+ei 会拼出 guei —— 两个不存在的音。
  it('iu / ui 是整块韵母,不摊成介母 + 韵母', () => {
    const guī = lv(2, 5) // 🐢 guī
    expect(requiredBlocks(guī).map((b) => `${b.type}:${b.value}`)).toEqual(['initial:g', 'final:ui'])

    const niú = lv(6, 2).syl[0]! // 🥛 niú
    expect(niú).toMatchObject({ initial: 'n', final: 'iu' })
    expect(niú.medial).toBeUndefined()
  })

  it('声调块:四调恒全出,某个调被要几次就给几块', () => {
    const xigua = toneBlocks(XĪGUĀ) // xī guā 两个阴平
    expect(xigua.filter((b) => b.value === '1')).toHaveLength(2)
    for (const t of ['2', '3', '4']) {
      expect(xigua.filter((b) => b.value === t)).toHaveLength(1)
    }
    // 单音节仍出满四块
    expect(toneBlocks(GUĀ)).toHaveLength(4)
  })
})

describe('buildBlocks', () => {
  it('所需块与声调块一块不少', () => {
    const blocks = buildBlocks(GUĀ, 4, seq([0.1, 0.7, 0.3, 0.9]))
    for (const need of [...requiredBlocks(GUĀ), ...toneBlocks(GUĀ)]) {
      expect(blocks.some((b) => b.type === need.type && b.value === need.value)).toBe(true)
    }
    for (const t of TONE_VALUES) {
      expect(blocks.some((b) => b.type === 'tone' && b.value === t)).toBe(true)
    }
  })

  it('干扰块只从该单元已解锁的池子里取', () => {
    for (let unit = 0; unit < UNITS.length; unit++) {
      for (const level of UNITS[unit]!.levels) {
        const solution = solutionValues(level)
        for (const block of buildBlocks(level, unit, seq([0.42, 0.13, 0.87]))) {
          if (block.type === 'tone') continue
          const key = `${block.type}:${block.value}`
          if (solution.has(key)) continue
          expect(poolFor(block.type, unit), `${level.pinyin} 干扰块 ${key}`).toContain(block.value)
        }
      }
    }
  })

  it('干扰块总数封顶,且不与所需块重名', () => {
    for (let unit = 0; unit < UNITS.length; unit++) {
      for (const level of UNITS[unit]!.levels) {
        const blocks = buildBlocks(level, unit, seq([0.2, 0.8, 0.5, 0.35]))
        const cap = level.syl.length > 1 ? 2 : unit <= 1 ? 2 : 3
        const extra = blocks.length - requiredBlocks(level).length - toneBlocks(level).length
        expect(extra, `${level.pinyin}`).toBeLessThanOrEqual(cap)
        expect(extra, `${level.pinyin}`).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('双音节题不超上限(块数不炸)', () => {
    for (const level of UNITS[6]!.levels) {
      expect(buildBlocks(level, 6, seq([0.5])).length).toBeLessThanOrEqual(
        requiredBlocks(level).length + toneBlocks(level).length + 2,
      )
    }
  })
})

describe('isComplete / wrongSlotIds', () => {
  const slots = slotsFor(GUĀ)
  const tray: TrayBlock[] = [
    withId({ type: 'initial', value: 'g' }, 'b0'),
    withId({ type: 'final', value: 'u' }, 'b1'), // 双身份:当介母用
    withId({ type: 'final', value: 'a' }, 'b2'),
    withId({ type: 'tone', value: '1' }, 'b3'),
    withId({ type: 'initial', value: 'k' }, 'b4'),
  ]

  it('槽没填满不算完成', () => {
    expect(isComplete(slots, {})).toBe(false)
    expect(isComplete(slots, { 's0-i': 'b0' })).toBe(false)
  })

  it('全对时没有错槽', () => {
    const placement: Placement = { 's0-i': 'b0', 's0-m': 'b1', 's0-f': 'b2', 's0-t': 'b3' }
    expect(isComplete(slots, placement)).toBe(true)
    expect(wrongSlotIds(slots, placement, tray)).toEqual([])
  })

  it('双身份块放对位置不算错', () => {
    const placement: Placement = { 's0-i': 'b0', 's0-m': 'b1', 's0-f': 'b2', 's0-t': 'b3' }
    expect(wrongSlotIds(slots, placement, tray)).toEqual([])
  })

  it('声调放错会被点出来', () => {
    const placement: Placement = { 's0-i': 'b0', 's0-m': 'b1', 's0-f': 'b2', 's0-t': 'b3' }
    const bad = wrongSlotIds(slots, { ...placement, 's0-t': 'b4' }, tray)
    expect(bad).toEqual(['s0-t'])
  })

  it('块塞进非双身份的错类型槽会被点出来', () => {
    const bad = wrongSlotIds(slots, { 's0-i': 'b4', 's0-m': 'b1', 's0-f': 'b2', 's0-t': 'b3' }, tray)
    expect(bad).toEqual(['s0-i'])
  })
})

describe('autoTargetId', () => {
  const slots = slotsFor(GUĀ)

  it('优先落到类型完全相同的空槽', () => {
    expect(autoTargetId({ type: 'medial', value: 'u' }, slots, {})).toBe('s0-m')
  })

  it('没有同类型空槽时,双身份块退到另一类槽', () => {
    // 🍐 lí = l + 韵母 i,题面没有介母槽 → 托盘里的介母 i 应能落进韵母槽
    const liSlots = slotsFor(lv(1, 3))
    expect(autoTargetId({ type: 'medial', value: 'i' }, liSlots, {})).toBe('s0-f')
  })

  it('放不下时返回 null', () => {
    expect(autoTargetId({ type: 'initial', value: 'b' }, slots, {})).toBeNull()
  })

  it('已填的槽不会被再选中', () => {
    const placement: Placement = { 's0-i': 'x', 's0-m': 'y', 's0-f': 'z', 's0-t': 'w' }
    expect(autoTargetId({ type: 'final', value: 'a' }, slots, placement)).toBeNull()
  })
})

describe('判定闭环:每关都能被正确块填满并通过', () => {
  it('全部关卡 100% 可解', () => {
    for (let unit = 0; unit < UNITS.length; unit++) {
      for (const level of UNITS[unit]!.levels) {
        const slots = slotsFor(level)
        const tray: TrayBlock[] = buildBlocks(level, unit, seq([0.37, 0.61])).map((b, i) => withId(b, `b${i}`))
        const placement: Record<string, string> = {}
        for (const slot of slots) {
          const block = tray.find((b) => canPlace(b, slot) && !Object.values(placement).includes(b.id))
          expect(block, `${level.pinyin} 的 ${slot.type}:${slot.value} 在托盘里找不到可放块`).toBeDefined()
          placement[slot.id] = block!.id
        }
        expect(isComplete(slots, placement), level.pinyin).toBe(true)
        expect(wrongSlotIds(slots, placement, tray), level.pinyin).toEqual([])
        // 每个块最多用一次
        expect(new Set(Object.values(placement)).size, `${level.pinyin} 有块被用了两次`).toBe(slots.length)
      }
    }
  })

  it('只要题面类型还有未用的同类块,托盘就该给出干扰', () => {
    for (let unit = 0; unit < UNITS.length; unit++) {
      for (const level of UNITS[unit]!.levels) {
        const solution = solutionValues(level)
        const blocks = buildBlocks(level, unit, seq([0.24, 0.76]))
        const extra = blocks.filter((b) => b.type !== 'tone' && !solution.has(`${b.type}:${b.value}`))
        // 题面类型里还有没被答案占用的同类块 → 应当摊得出干扰。
        // (整体认读的 whole 题只有 whole 一种类型,池子为空,摊不出也不需要。)
        const spare = new Set(
          requiredBlocks(level).flatMap((b) =>
            poolFor(b.type, unit)
              .filter((v) => !solution.has(`${b.type}:${v}`))
              .map(() => b.type),
          ),
        )
        if (spare.size > 0) expect(extra.length, `${level.pinyin} 缺干扰块`).toBeGreaterThan(0)
      }
    }
  })
})

describe('ZHĪ 的焊死结构', () => {
  it('拆成 声母 + i 两块,且声母槽带焊死标记', () => {
    const slots = slotsFor(ZHĪ)
    expect(slots.map((s) => s.type)).toEqual(['initial', 'final', 'tone'])
    expect(slots.find((s) => s.type === 'initial')?.weld).toBe(true)
    expect(slots.find((s) => s.type === 'final')?.value).toBe('i')
    expect(slots.find((s) => s.type === 'initial')?.value).toBe('zh')
  })
})
