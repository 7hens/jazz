// 章结构护栏。**这一份的两条前提别搞混**:
// ① 「题长在本单元里 ⇒ 块必然在已教池里」是同一句话说两遍(`taughtBlocks(本单元)` 覆盖本单元全部题),
//    所以「块在已教范围内」要**重新定义** = 「前面各单元的全部题 + 本单元**简单章**」;
// ② 困难题分批录入,所以下面的遍历一律取「HARD_LEVELS 里已有条目的单元」——
//    最后一批(T6)再补一条总账,保证 12 个单元一个不缺。
import { describe, expect, it } from 'vitest'
import { INITIALS_ALL, MEDIALS, NASALS, WELD_INITIALS } from './blocks'
import { HARD_LEVELS } from './hard-levels'
import { UNITS, type Level } from './levels'
import { slotsFor } from './rules'

/** 到 unitIndex 为止**已经录完**的单元(含本单元简单章)里出现过的块。 */
function taughtUpTo(unitIndex: number): Set<string> {
  const out = new Set<string>()
  const add = (levels: readonly Level[]) => {
    for (const level of levels) {
      for (const slot of slotsFor(level)) out.add(`${slot.type}:${slot.value}`)
    }
  }
  for (const unit of UNITS.slice(0, unitIndex)) {
    add(unit.levels)
    add(HARD_LEVELS[unit.id] ?? [])
  }
  add(UNITS[unitIndex]!.levels.filter((level) => level.stage !== 'hard'))
  return out
}

/** 已录完的单元(困难章有题的)。 */
const recorded = UNITS.filter((unit) => (HARD_LEVELS[unit.id] ?? []).length > 0)

/**
 * 整体认读 16 个音节的形状,**硬写在这里** —— 从被测数据里反推出来的期望值会自满足,等于没测。
 * 键 = `initial+final+nasal`(用 `+` 连接,缺位不补);拼写形式的对照见行末注释。
 *
 * `yuan` 在数据里带介母 ü,被下面「无介母」那条前提天然挡在扫描之外(与 `levels.ts` 里
 * 「yuan 带介母 → **不焊**」同口径),所以它的键写成带介母的四段,永远取不到,只是把 16 个写全。
 */
const WELD_SHAPES: ReadonlySet<string> = new Set([
  'zh+i', 'ch+i', 'sh+i', 'r+i', 'z+i', 'c+i', 's+i', // zhi chi shi ri zi ci si
  'y+i', 'w+u', 'y+ü', 'y+ie', 'y+üe', // yi wu yu ye yue
  'y+i+n', 'y+ü+n', 'y+i+ng', // yin yun ying
  'y+ü+a+n', // yuan(带介母,永不命中)
])

describe('困难章题', () => {
  it('每单元困难题数 = 简单题数,id = 对应简单题 id + h,顺序一一对应', () => {
    for (const unit of recorded) {
      const hard = HARD_LEVELS[unit.id]!
      const easy = unit.levels.filter((level) => level.stage !== 'hard')
      expect(hard.length, `${unit.id} 困难题数`).toBe(easy.length)
      expect(hard.map((level) => level.id), `${unit.id} 困难题 id`).toEqual(easy.map((level) => `${level.id}h`))
      for (const level of hard) expect(level.stage, level.id).toBe('hard')
    }
  })

  // 这才是 spec §9.1 规则 1 的口径。`taughtBlocks(本单元)` 那条既有护栏在这里问不出任何东西。
  it('困难题的块全部落在「前面各单元 + 本单元简单章」的池子里', () => {
    for (const [index, unit] of UNITS.entries()) {
      const hard = HARD_LEVELS[unit.id]
      if (!hard) continue
      const allowed = taughtUpTo(index)
      for (const level of hard) {
        for (const slot of slotsFor(level)) {
          // 声调块恒四调全出(`toneBlocks`),不走课程池 —— 池里本来就没有它们。
          if (slot.type === 'tone') continue
          expect(allowed.has(`${slot.type}:${slot.value}`), `${level.id} 用了还没教过的 ${slot.type}:${slot.value}`).toBe(true)
        }
      }
    }
  })

  it('困难题的块值都在块目录定义域内,焊死规则与简单题同口径', () => {
    const finals = new Set(UNITS.flatMap((u) => u.levels.flatMap((l) => l.syl.map((s) => s.final))))
    for (const unit of recorded) {
      for (const level of HARD_LEVELS[unit.id]!) {
        for (const syl of level.syl) {
          if (syl.initial !== undefined) expect(INITIALS_ALL, level.id).toContain(syl.initial)
          if (syl.medial !== undefined) expect(MEDIALS, level.id).toContain(syl.medial)
          if (syl.nasal !== undefined) expect(NASALS, level.id).toContain(syl.nasal)
          if (syl.final !== undefined) expect(finals.has(syl.final), `${level.id} 的韵母 ${syl.final}`).toBe(true)
          if (syl.weld) {
            expect(WELD_INITIALS, `${level.id} 焊死`).toContain(syl.initial)
            expect(syl.medial, `${level.id} 三拼不该焊`).toBeUndefined()
          }
        }
      }
    }
  })

  // 上面那条焊死护栏是**单向**的(带了 weld ⇒ 合法),看不见「该带而没带」——
  // 上一批 T4/T5 录题漏标的 u4-57h / u6-5h / u6-50h 正是从这条缝里穿过去的。
  // 这条补上反向蕴含:形状命中整体认读的困难题音节,必须带 weld。
  // **有意不覆盖** u1-50h(yí) / u1-51h(wù):它们是零声母写法(没有 `initial` 字段,如
  // `{ final: 'i', tone: 2 }`),结构上没有声母块与韵母块的接缝可焊;u1 是单韵母单元,
  // 写成裸韵母是该单元的教学约定。已录困难题里语义上属整体认读的有 5 个,本护栏管的是其中 3 个。
  it('整体认读形状的困难题音节必须带 weld(漏标即红)', () => {
    const hits: string[] = []
    for (const unit of recorded) {
      for (const level of HARD_LEVELS[unit.id]!) {
        for (const syl of level.syl) {
          // 带介母的三拼不焊(介母槽要走过去,见 levels.ts 的 yuan);简单题不参与本口径。
          if (syl.medial !== undefined) continue
          // 键只由**有值**的槽拼成(缺位不补空段),故 yì 的键是 `y+i` 而不是 `y+i+`。
          const shape = [syl.initial, syl.final, syl.nasal].filter((part) => part !== undefined).join('+')
          if (!WELD_SHAPES.has(shape)) continue
          hits.push(level.id)
          expect(syl.weld, `${level.id} 是整体认读形状却漏了 weld`).toBe(true)
        }
      }
    }
    // 防空转:锚点(形状表 / 遍历口径)写错时 hits 会空,断言恒真 = 静默假绿。
    expect(hits.length, '整体认读形状一个都没扫到 —— 形状表或遍历口径写错了').toBeGreaterThan(0)
    // 点名钉住本次修的三个漏标。T6 录入后 hits 会变大,故只做包含断言,不做全等。
    expect(hits).toEqual(expect.arrayContaining(['u4-57h', 'u6-5h', 'u6-50h']))
  })

  it('困难题不与简单题、也不与其它困难题撞 emoji', () => {
    const easyEmoji = new Set(UNITS.flatMap((u) => u.levels.filter((l) => l.stage !== 'hard').map((l) => l.emoji)))
    const seen = new Map<string, string>()
    for (const unit of recorded) {
      for (const level of HARD_LEVELS[unit.id]!) {
        expect(easyEmoji.has(level.emoji), `${level.id} 的 emoji 与简单题撞了`).toBe(false)
        const owner = seen.get(level.emoji)
        expect(owner, `${level.id} 的 emoji 与 ${owner} 撞了`).toBeUndefined()
        seen.set(level.emoji, level.id)
      }
    }
  })

  // 分批录入的收口。上面四条一律只走 `recorded`(已录完的单元)—— 那是为了让每批数据
  // 加进来时护栏立刻生效、而不是等最后一批。代价是「某个单元忘了录」在上面四条里是**看不见**的,
  // 这一条就是为那件事存在:182 = 12 个单元一个不缺。
  it('总账:12 个单元全部录完,困难题总数 = 简单题总数', () => {
    const missing = UNITS.filter((unit) => (HARD_LEVELS[unit.id] ?? []).length === 0).map((unit) => unit.id)
    expect(missing, `这些单元还没录困难题:${missing.join(', ')}`).toEqual([])
    const hard = UNITS.reduce((sum, unit) => sum + (HARD_LEVELS[unit.id] ?? []).length, 0)
    const easy = UNITS.reduce((sum, unit) => sum + unit.levels.filter((l) => l.stage !== 'hard').length, 0)
    expect(hard, '困难题总数').toBe(easy)
    expect(easy, '简单题总数').toBe(91)
  })
})
