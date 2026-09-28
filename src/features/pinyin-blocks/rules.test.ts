import { describe, expect, it } from 'vitest'
import { CONFUSABLE, TONE_VALUES, type Block } from './blocks'
import { UNITS, taughtBlocks, type Level } from './levels'
import {
  autoTargetId,
  autoTypeTargetId,
  buildBlocks,
  canPlace,
  familyKey,
  HARD_RETRIES,
  HARD_TRAY_PER_TYPE,
  isComplete,
  requiredBlocks,
  sameTypeOnly,
  slotsFor,
  solutionValues,
  starsFor,
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

/** 按存档键取关。关卡顺序会变,**id 不会** —— 按序号取关在挪关后会静默指错题。 */
function byId(id: string): Level {
  for (const u of UNITS) for (const level of u.levels) if (level.id === id) return level
  throw new Error(`没有这一关:${id}`)
}

/** 关所属单元的下标 —— `buildBlocks` 要它。 */
function unitIdxOf(id: string): number {
  const index = UNITS.findIndex((u) => u.levels.some((level) => level.id === id))
  if (index < 0) throw new Error(`没有这一关:${id}`)
  return index
}

/** `buildBlocks` 的单元下标参数一律由关卡自己的 id 推 —— 测试里不再手写「第几个单元」。 */
const build = (level: Level, rng: Rng) => buildBlocks(level, unitIdxOf(level.id), rng)

/**
 * 与 `PinyinBlocksGame` 里那支**同源**的轮次 rng(同乘同加同位移),种子 0 ——
 * 要的就是「生产里 round 0 发的那副牌」。两边要一起改;改了那边,这条哨子就失去依据。
 */
function roundZero(): Rng {
  // 种子 0:`(0 * 2654435761) >>> 0` 就是 0,故直接写 0(写成乘法 oxlint 会抓「恒零运算」)。
  let s = 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const GUĀ = byId('u5-0') // 🍉 guā = g + 介母 u + a
const ZHĪ = byId('u6-0') // 🕷️ zhī = zh + i(焊死)
const XĪGUĀ = byId('u7-0') // 🍉 xī guā = 双音节

/**
 * 该单元及之前课程里出现过的某类块值 —— **独立于 `levels.ts` 的 `taughtBlocks` 重算一遍**。
 * 拿被测代码当判据的断言永不会红,所以这里宁可多写十行。
 */
function seenIn(type: Block['type'], unit: number): string[] {
  const out = new Set<string>()
  for (const u of UNITS.slice(0, unit + 1)) {
    for (const level of u.levels) {
      for (const s of level.syl) {
        if (type === 'initial' && s.initial !== undefined) out.add(s.initial)
        if (type === 'medial' && s.medial !== undefined) out.add(s.medial)
        if (type === 'final' && s.final !== undefined) out.add(s.final)
        if (type === 'nasal' && s.nasal !== undefined) out.add(s.nasal)
      }
    }
  }
  return [...out]
}

const slot = (type: Slot['type'], value: string): Slot => ({ id: 'x', type, value, sylIdx: 0 })
const withId = (b: Block, id: string): TrayBlock => ({ ...b, id })

describe('slotsFor', () => {
  it('按 声母 → 介母 → 韵母 → 鼻音 排,声调槽骑在韵腹上方', () => {
    const slots = slotsFor(byId('u5-2')) // 🐻 xióng = x + 介母 i + o + ng
    expect(slots.map((s) => s.type)).toEqual(['initial', 'medial', 'final', 'nasal', 'tone'])
    expect(slots.find((s) => s.type === 'tone')?.anchor).toBe('s0-f')
  })

  it('y + ü 合成的音节(整体认读)照样摊成两块,声调仍骑韵腹', () => {
    const slots = slotsFor(byId('u6-4')) // 🐟 yú = y + ü
    expect(slots.map((s) => s.type)).toEqual(['initial', 'final', 'tone'])
    expect(slots.find((s) => s.type === 'tone')?.anchor).toBe('s0-f')
  })

  it('零声母音节不摆空声母槽', () => {
    const slots = slotsFor(byId('u3-2')) // ❤️ ài
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
    const niuNai = byId('u7-2') // 🥛 niú nǎi:两个 n 声母
    const nCount = requiredBlocks(niuNai).filter((b) => b.type === 'initial' && b.value === 'n').length
    expect(nCount).toBe(2)

    const huaDuo = byId('u7-4') // 🌸 huā duǒ:两个介母 u
    const uCount = requiredBlocks(huaDuo).filter((b) => b.type === 'medial' && b.value === 'u').length
    expect(uCount).toBe(2)
  })

  // iu(← iou)、ui(← uei)是独立韵母。拆成 i+ou 会拼出 niou、拆成 u+ei 会拼出 guei —— 两个不存在的音。
  it('iu / ui 是整块韵母,不摊成介母 + 韵母', () => {
    const guī = byId('u3-5') // 🐢 guī
    expect(requiredBlocks(guī).map((b) => `${b.type}:${b.value}`)).toEqual(['initial:g', 'final:ui'])

    const niú = byId('u7-2').syl[0]! // 🥛 niú
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

describe('familyKey', () => {
  // 双身份块(i/u/ü)在介母槽和韵母槽都放得下,入槽后颜色跟着槽位走 —— 所以「同一块」的
  // 判据是值本身,而不是 类型:值。否则简单段的托盘会同时出现 medial:u 与 final:u 两块一样的 u。
  it('双身份块按值成族,与它挂在哪个类型下无关', () => {
    expect(familyKey({ type: 'medial', value: 'u' })).toBe(familyKey({ type: 'final', value: 'u' }))
    expect(familyKey({ type: 'medial', value: 'ü' })).toBe(familyKey({ type: 'final', value: 'ü' }))
    expect(familyKey({ type: 'medial', value: 'i' })).toBe(familyKey({ type: 'final', value: 'i' }))
  })

  // 声母 n 与鼻尾 n 是两个不同的块(块 id 不同、颜色不同),不是同一个身份。
  it('其余块按 类型:值 成族 —— initial:n 与 nasal:n 是两个身份', () => {
    expect(familyKey({ type: 'initial', value: 'n' })).not.toBe(familyKey({ type: 'nasal', value: 'n' }))
  })
})

describe('buildBlocks', () => {
  it('所需块与声调块一块不少', () => {
    const blocks = build(GUĀ, seq([0.1, 0.7, 0.3, 0.9]))
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
          expect(seenIn(block.type, unit), `${level.pinyin} 干扰块 ${key}`).toContain(block.value)
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
    const unit = unitIdxOf('u7-0') // 双音节单元 —— 批二之后 UNITS[6] 不再是它
    for (const level of UNITS[unit]!.levels) {
      const cap = 2
      expect(build(level, seq([0.5])).length).toBeLessThanOrEqual(
        requiredBlocks(level).length + toneBlocks(level).length + cap,
      )
    }
  })

  // 易混伙伴优先取:把伙伴放在候选游标**尾部**(取块走 pop,取尾),于是有已教伙伴时先取它。
  it('有已教伙伴时,干扰块优先取伙伴', () => {
    const bà = byId('u2-0') // 爸 bà = b + a
    const extra = build(bà, seq([0.42, 0.13, 0.87, 0.24])).filter(
      (b) => b.type === 'initial' && b.value !== 'b',
    )
    expect(extra.map((b) => b.value)).toContain('p') // b 的易混伙伴
  })

  it('没教过的伙伴不会进托盘 —— u1 的题面块一个伙伴都没有,且托盘里只有教过的块', () => {
    const level = byId('u1-0')
    const unit = unitIdxOf('u1-0')
    const required = requiredBlocks(level)
    const friends = new Set(required.flatMap((b) => CONFUSABLE[b.type][b.value] ?? []))
    expect(friends.size, 'u1 的题面块不该有易混伙伴 —— 刚认字母的孩子那里不设陷阱').toBe(0)

    const taught = new Set(taughtBlocks(unit).map((b) => `${b.type}:${b.value}`))
    for (const block of buildBlocks(level, unit, seq([0.2, 0.6, 0.4]))) {
      if (block.type === 'tone') continue // 声调四调恒全出,不经课程池(见 toneBlocks)
      expect(taught.has(`${block.type}:${block.value}`), `托盘里的 ${block.type}:${block.value} 不是 u1 教过的块`).toBe(true)
    }
  })

  // 困难段的全部手感在托盘:干扰不够就不构成难度(spec §3.6)。
  // 与简单段的 cap 是**两个旋钮** —— 这里拧的是「每个用到的类型都给一块对手」。
  it('困难段:每个用到的类型都有对手(给到至少一块,除非池子实在没得给)', () => {
    for (let unit = 0; unit < UNITS.length; unit++) {
      for (const level of UNITS[unit]!.levels) {
        const blocks = buildBlocks(level, unit, seq([0.23, 0.71, 0.44, 0.09]), { hard: true })
        const types = [...new Set(requiredBlocks(level).map((b) => b.type))]
        for (const type of types) {
          const values = new Set(blocks.filter((b) => b.type === type).map((b) => b.value))
          // 正确块的去重值数 + 1(至少一块对手);池子没那么多值时只能给到池子的上限。
          // 按下限写成「至少 2 块」会在多音节关失真:那里一个类型可能已经要用两块正确块。
          const need = new Set(requiredBlocks(level).filter((b) => b.type === type).map((b) => b.value)).size
          expect(values.size, `${level.pinyin} 的 ${type} 只给了 ${values.size} 块`).toBeGreaterThanOrEqual(
            Math.min(need + 1, seenIn(type, unit).length),
          )
        }
        for (const t of TONE_VALUES) {
          expect(blocks.some((b) => b.type === 'tone' && b.value === t), `${level.pinyin} 少了声调 ${t}`).toBe(true)
        }
      }
    }
  })

  // Minor 6:`HARD_TRAY_PER_TYPE` 的**值**必须直接钉住 —— 行为侧**压不出来**。
  // 它只出现在 `Math.max(1, HARD_TRAY_PER_TYPE - need)` 里,而 need 恒 ≥ 1(只有要用的类型才发牌),
  // 于是 2 与 1 得到同一个 want,把 2 改成 1 所有关卡的托盘**一模一样**。
  // 但值 1 让「need = 2 的类型只发 2 块正解、零对手」成为**合法**,下一个多音节关会悄悄失去难度 ——
  // 所以这里钉的是旋钮本身,不是它今天恰好产出的那几张牌。
  it('困难段:HARD_TRAY_PER_TYPE 钉死在 2(行为侧不可观测,只能钉值)', () => {
    expect(HARD_TRAY_PER_TYPE).toBe(2)
    // 语义侧旁证:u7-0 的声母要 x / g 两块 ⇒ 该类型共 3 块(2 正解 + 1 对手)。
    const hard = buildBlocks(byId('u7-0'), unitIdxOf('u7-0'), seq([0.4, 0.8]), { hard: true })
    expect(hard.filter((b) => b.type === 'initial')).toHaveLength(3)
  })

  // 困难段的错题池按**精确身份**记账(`exactPoolKey`),简单段/复习段按**家族**记账。
  // 这个差别只有在「某一关 round-0 的困难托盘里同时含一对同家族、不同类型的**可放错块**」
  //(典型是 medial:u 与 final:u,或 medial:i 与 final:i)时才会在 UI 上显形 ——
  // 那时池的条数、复习小题的条数都会不同。
  //
  // 今天的 91 关**一关都没有**这种托盘(rng 取的就是生产里 round 0 那支,见 roundZero):
  //  - 反例锚 u7-0 的 round-0 困难托盘里确实有 medial:u,但那是 s1-m 的正解(恒放不错),
  //    而 final:u 要到第 2 / 5 轮才进托盘;
  //  - 真正出现同家族跨类型对的轮次是 u5-0 / u5-3 / u7-0 / u7-4 / u8-51 / u8-52 / u9-54 的
  //    第 3、5 轮 —— 而唯一能看见池的路径(给了 `onSectionEnd`)会让 `round` 恒为 0
  //    (`advance()` 那条老路被关掉,见 `PinyinBlocksGame` 的 onSolved 分支),轮次推不动。
  // 于是针对那条差别的行为断言写不出来(写出来也是恒真)。这条哨子锁的是「不可观测」这个事实:
  // 哪天它变红,正确的动作是**补上那条行为断言**(困难段接一对同家族跨类型错块 ⇒ 池的两条
  // 都留下),不是删哨子 —— 删掉等于把「池键的口径已经变得可见」这件事埋掉。
  it('没有一关的 round-0 困难托盘含同家族、不同类型的可放错块(池键差别因此不可观测)', () => {
    for (let unit = 0; unit < UNITS.length; unit++) {
      for (const level of UNITS[unit]!.levels) {
        const slots = slotsFor(level)
        const hard = buildBlocks(level, unit, roundZero(), { hard: true })
        const wrongable = hard.filter((b) => slots.some((s) => s.type === b.type && s.value !== b.value))
        for (let i = 0; i < wrongable.length; i++) {
          for (let j = i + 1; j < wrongable.length; j++) {
            const a = wrongable[i]!
            const b = wrongable[j]!
            expect(
              familyKey(a) === familyKey(b) && a.type !== b.type,
              `${level.id} 的困难托盘里 ${a.type}:${a.value} 与 ${b.type}:${b.value} 撞了家族`,
            ).toBe(false)
          }
        }
      }
    }
  })

  it('困难段:全部正确块都在托盘里(少一块孩子就无解)', () => {
    for (let unit = 0; unit < UNITS.length; unit++) {
      for (const level of UNITS[unit]!.levels) {
        const blocks = buildBlocks(level, unit, seq([0.5, 0.25]), { hard: true })
        for (const need of requiredBlocks(level)) {
          expect(
            blocks.filter((b) => b.type === need.type && b.value === need.value).length,
            `${level.pinyin} 少了正确块 ${need.type}:${need.value}`,
          ).toBeGreaterThanOrEqual(1)
        }
      }
    }
  })

  // 困难段的门禁只比类型,介母与韵母在那一段是**两个真身份**(青色进介母槽、绿色进韵母槽),
  // 所以按 keyOf 去重 —— 同值的两块要能同时出现。
  //
  // 构造题面,单元下标从真实关卡 u8-50(⬇️ xià = x + i + a)派生 —— 下标写死会随
  // 单元挪位静默指错关。u8 只教了 i / u 两个介母;题面已用掉 medial:u,
  // 游标里就只剩 i,于是 medial 的对手**恒为 i** —— 与种子无关,
  // 与必需的 final:i 同值不同类。这正是 familyKey 去重会误杀的那一块。
  it('困难段:双身份块不被家族合并,medial:i 与 final:i 两块都在', () => {
    const dual: Level = {
      id: 'test-hard-dual',
      emoji: '🧪',
      pinyin: 'xī guā',
      read: '西瓜',
      syl: [
        { initial: 'x', final: 'i', tone: 1 },
        { initial: 'g', medial: 'u', final: 'a', tone: 1 },
      ],
    }
    const blocks = buildBlocks(dual, unitIdxOf('u8-50'), seq([0.12, 0.34, 0.56, 0.78]), { hard: true })
    const identifiers = blocks.filter((b) => b.value === 'i').map((b) => `${b.type}:${b.value}`)
    expect(identifiers).toContain('final:i') // 必需的韵腹
    expect(identifiers).toContain('medial:i') // 对手:同值,另一个身份
  })

  // u2-0(爸 bà):困难段 = b/p + a/o + 四声 = 8 块。
  it('困难段:u2-0 是 8 块(两个类型各给一块对手)', () => {
    const bà = byId('u2-0')
    const unit = unitIdxOf('u2-0')
    expect(buildBlocks(bà, unit, seq([0.4, 0.8]), { hard: true })).toHaveLength(8)
  })

  // 多音节关的困难段确实比简单段大 —— 整段设计的手感就在这个差额上(u7-0:13 > 12)。
  it('困难段的托盘比简单段大:u7-0 困难 13 块 / 简单 12 块', () => {
    const xigua = byId('u7-0')
    const unit = unitIdxOf('u7-0')
    const hard = buildBlocks(xigua, unit, seq([0.4, 0.8]), { hard: true })
    const easy = buildBlocks(xigua, unit, seq([0.4, 0.8]))
    expect(hard).toHaveLength(13)
    expect(easy).toHaveLength(12)
    expect(hard.length).toBeGreaterThan(easy.length)
  })
})

describe('sameTypeOnly(困难段的门禁)', () => {
  it('值错但类型对:放得进去 —— 这正是困难段的全部考点', () => {
    expect(sameTypeOnly({ type: 'initial', value: 'p' }, slot('initial', 'b'))).toBe(true)
    expect(sameTypeOnly({ type: 'final', value: 'o' }, slot('final', 'a'))).toBe(true)
    expect(sameTypeOnly({ type: 'tone', value: '3' }, slot('tone', '1'))).toBe(true)
  })

  it('类型不对就放不进去 —— 声母进不了韵母槽', () => {
    expect(sameTypeOnly({ type: 'initial', value: 'a' }, slot('final', 'a'))).toBe(false)
    expect(sameTypeOnly({ type: 'nasal', value: 'n' }, slot('initial', 'n'))).toBe(false)
  })

  // 与 canPlace 的分水岭:双身份块在困难段**不通用**(介母块青、韵母块绿,颜色上分得开)。
  it('介母与韵母在困难段不通用,尽管 canPlace 允许互换', () => {
    expect(canPlace({ type: 'medial', value: 'u' }, slot('final', 'u'))).toBe(true)
    expect(sameTypeOnly({ type: 'medial', value: 'u' }, slot('final', 'u'))).toBe(false)
    expect(sameTypeOnly({ type: 'final', value: 'u' }, slot('medial', 'u'))).toBe(false)
  })
})

describe('autoTypeTargetId(困难段的点选落位)', () => {
  // 槽必须用**不同 id** —— 复用 slot helper(恒 id 'x')时「永远取第一个空槽」的实现也全绿,
  // 类型过滤(`s.type === block.type`)就永远测不到。
  const slots: Slot[] = [
    { id: 's0-i', type: 'initial', value: 'b', sylIdx: 0 },
    { id: 's0-f', type: 'final', value: 'a', sylIdx: 0 },
  ]

  it('落到同类型的第一个空槽,不看值(声母块进声母槽、韵母块进韵母槽)', () => {
    expect(autoTypeTargetId({ type: 'initial', value: 'p' }, slots, {})).toBe('s0-i')
    expect(autoTypeTargetId({ type: 'final', value: 'o' }, slots, {})).toBe('s0-f')
  })

  it('同类型的槽都占满了就没有落点(不跨类型找)', () => {
    expect(autoTypeTargetId({ type: 'initial', value: 'p' }, slots, { 's0-i': 'b0' })).toBe(null)
    expect(autoTypeTargetId({ type: 'final', value: 'o' }, slots, { 's0-f': 'b1' })).toBe(null)
  })
})

describe('困难段的重试上限', () => {
  it('每关 2 次(用尽即本段失败,不阻塞)', () => {
    expect(HARD_RETRIES).toBe(2)
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

  it('wrongSlotIds 的判据可注入:困难段传 sameTypeOnly,值错不算错', () => {
    const hard: TrayBlock[] = [withId({ type: 'initial', value: 'p' }, 'b0'), withId({ type: 'final', value: 'a' }, 'b1')]
    const placements: Placement = { x: 'b0' }
    expect(wrongSlotIds([slot('initial', 'b')], placements, hard)).toHaveLength(1) // canPlace:值错 ⇒ 错
    expect(wrongSlotIds([slot('initial', 'b')], placements, hard, sameTypeOnly)).toHaveLength(0)
  })
})

describe('autoTargetId', () => {
  const slots = slotsFor(GUĀ)

  it('优先落到类型完全相同的空槽', () => {
    expect(autoTargetId({ type: 'medial', value: 'u' }, slots, {})).toBe('s0-m')
  })

  it('没有同类型空槽时,双身份块退到另一类槽', () => {
    // 🍐 lí = l + 韵母 i,题面没有介母槽 → 托盘里的介母 i 应能落进韵母槽
    const liSlots = slotsFor(byId('u2-3'))
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
            seenIn(b.type, unit)
              .filter((v) => !solution.has(`${b.type}:${v}`))
              .map(() => b.type),
          ),
        )
        if (spare.size > 0) expect(extra.length, `${level.pinyin} 缺干扰块`).toBeGreaterThan(0)
      }
    }
  })
})

describe('starsFor', () => {
  // 0 错才给三星 —— 「一次就对」与「错一次再对」是两件事,差在有没有真听出来。
  it('星级按本关错误次数判:0 错三星 / 1-2 错二星 / 更多一星', () => {
    expect(starsFor(0)).toBe(3)
    expect(starsFor(1)).toBe(2)
    expect(starsFor(2)).toBe(2)
    expect(starsFor(3)).toBe(1)
    expect(starsFor(99)).toBe(1)
  })

  // 一星也是通关。孩子不该因为「拿不到三星」而觉得这一关没过。
  it('再错也保底一星,不会出现 0 星', () => {
    for (const miss of [0, 1, 5, 1000]) expect(starsFor(miss)).toBeGreaterThanOrEqual(1)
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
