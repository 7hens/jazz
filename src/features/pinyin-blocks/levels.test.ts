import { describe, expect, it } from 'vitest'
import {
  FINAL_BASIC,
  FINAL_COMPOUND,
  INITIALS_ALL,
  MEDIALS,
  NASALS,
  WELD_INITIALS,
  poolFor,
} from './blocks'
import { UNITS, type Level, type Syllable } from './levels'

/** 摊平成「所属单元下标 + 关卡」,断言里好定位到具体是哪一题。 */
const allLevels: { unit: number; unitId: string; index: number; level: Level }[] = UNITS.flatMap((u, unit) =>
  u.levels.map((level, index) => ({ unit, unitId: u.id, index, level })),
)

const where = (l: { unitId: string; index: number }): string => `${l.unitId}#${l.index + 1}`

describe('拼音积木关卡数据', () => {
  it('单元 id 与关卡非空', () => {
    expect(UNITS.length).toBeGreaterThan(0)
    for (const u of UNITS) {
      expect(u.id).toMatch(/^u\d+$/)
      expect(u.levels.length).toBeGreaterThan(0)
    }
    expect(new Set(UNITS.map((u) => u.id)).size).toBe(UNITS.length)
  })

  it('每个音节都摊得出韵腹;声调槽靠它定位', () => {
    for (const entry of allLevels) {
      entry.level.syl.forEach((s: Syllable, i) => {
        expect(s.final, `${where(entry)} syl[${i}] 缺韵腹`).toBeDefined()
      })
    }
  })

  // 焊死标记的语义 = 这个音节拼出来读的不是「块面音相接」。只有那批声母起头才成立。
  it('焊死标记只落在焊接声母起头、且不带介母的音节上', () => {
    for (const entry of allLevels) {
      for (const [i, s] of entry.level.syl.entries()) {
        if (!s.weld) continue
        const label = `${where(entry)} syl[${i}]`
        expect(WELD_INITIALS, label).toContain(s.initial)
        expect(s.medial, `${label} 三拼不该焊`).toBeUndefined()
      }
    }
  })

  it('每个块的值都在该单元已解锁的池子里(防止教还没教的块)', () => {
    for (const { unit, level, unitId, index } of allLevels) {
      const label = `${unitId}#${index + 1}`
      for (const s of level.syl) {
        if (s.initial !== undefined) expect(poolFor('initial', unit), `${label} 声母`).toContain(s.initial)
        if (s.medial !== undefined) expect(poolFor('medial', unit), `${label} 介母`).toContain(s.medial)
        if (s.nasal !== undefined) expect(poolFor('nasal', unit), `${label} 鼻音`).toContain(s.nasal)
        if (s.final !== undefined) {
          expect(poolFor('final', unit), `${label} 韵母`).toContain(s.final)
        }
      }
    }
  })

  it('块值都在块目录的定义域内', () => {
    for (const { level, unitId, index } of allLevels) {
      const label = `${unitId}#${index + 1}`
      for (const s of level.syl) {
        if (s.initial !== undefined) expect(INITIALS_ALL, label).toContain(s.initial)
        if (s.medial !== undefined) expect(MEDIALS, label).toContain(s.medial)
        if (s.nasal !== undefined) expect(NASALS, label).toContain(s.nasal)
        if (s.final !== undefined) {
          expect([...FINAL_BASIC, ...FINAL_COMPOUND], label).toContain(s.final)
        }
      }
    }
  })

  it('每关都有图与拼音,且拼音不重复(同一题不该出现两次)', () => {
    const seen = new Map<string, string>()
    for (const entry of allLevels) {
      expect(entry.level.emoji.length, where(entry)).toBeGreaterThan(0)
      expect(entry.level.pinyin.length, where(entry)).toBeGreaterThan(0)
      const key = entry.level.pinyin
      expect(seen.has(key), `${key} 重复出现在 ${seen.get(key)} 与 ${where(entry)}`).toBe(false)
      seen.set(key, where(entry))
    }
  })

  // 朗读文本必须是汉字:把拼音串喂给系统 TTS 会被逐字母念出来,这是踩过的坑。
  it('朗读文本是汉字,且字数与音节数一致', () => {
    for (const entry of allLevels) {
      const { read } = entry.level
      const label = where(entry)
      expect(read, label).toMatch(/^[一-龥]+$/)
      expect([...read].length, `${label} 朗读「${read}」字数对不上音节数`).toBe(entry.level.syl.length)
    }
  })

  it('双音节关恒为两个音节(分组渲染的前提)', () => {
    for (const u of UNITS) {
      const sizes = u.levels.map((l) => l.syl.length)
      if (u.levels.length === 1) continue
      expect(new Set(sizes).size, `${u.id} 音节数不一致`).toBe(1)
    }
  })
})
