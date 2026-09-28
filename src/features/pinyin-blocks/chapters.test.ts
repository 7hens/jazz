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
})
