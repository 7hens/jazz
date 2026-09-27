import { describe, expect, it } from 'vitest'
import { CONFUSABLE, FINAL_BASIC, FINAL_COMPOUND, INITIALS_ALL, MEDIALS, NASALS, type BlockType } from './blocks'

/** 每一类块真实存在的值域 —— 表里写错一个字母不会有别的东西红,只有这里能拦。 */
const DOMAIN: Record<BlockType, readonly string[]> = {
  initial: INITIALS_ALL,
  medial: MEDIALS,
  final: [...FINAL_BASIC, ...FINAL_COMPOUND],
  nasal: NASALS,
  tone: [],
}

describe('CONFUSABLE', () => {
  it('每个键与每个伙伴值都是该类型下真实存在的块值', () => {
    for (const [type, table] of Object.entries(CONFUSABLE) as [BlockType, Record<string, readonly string[]>][]) {
      for (const [key, friends] of Object.entries(table)) {
        expect(DOMAIN[type], `${type} 里的键 ${key} 不是真实块值`).toContain(key)
        for (const friend of friends) {
          expect(DOMAIN[type], `${type}:${key} 的伙伴 ${friend} 不是真实块值`).toContain(friend)
        }
      }
    }
  })

  it('伙伴不含自己(自己跟自己不像,也不该占掉一个干扰名额)', () => {
    for (const [type, table] of Object.entries(CONFUSABLE) as [BlockType, Record<string, readonly string[]>][]) {
      for (const [key, friends] of Object.entries(table)) {
        expect(friends, `${type}:${key}`).not.toContain(key)
      }
    }
  })

  it('声调没有这张表(四声恒全出,不需要易混对)', () => {
    expect(Object.keys(CONFUSABLE.tone)).toEqual([])
  })

  // 单韵母 a/o/e/i 与 er 不进表:u1 面对的是刚认字母的孩子,那里不该有陷阱(spec §3.1 第 3 条)。
  it('单韵母与 er 不在表里', () => {
    for (const value of ['a', 'o', 'e', 'i', 'er']) {
      expect(Object.keys(CONFUSABLE.final), `韵母 ${value} 不该有易混对`).not.toContain(value)
    }
  })
})
