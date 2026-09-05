import { describe, expect, it } from 'vitest'
import { BASICS_UNIT_KEY_PATTERN } from '@/shared/services'
import {
  ENGLISH_LETTERS,
  PINYIN_FINALS,
  PINYIN_INITIALS,
  PINYIN_TONES,
  unitKey,
} from './catalogs'

// 审计:基础单元目录每个 symbol 产出的 unit_key 必须落在 worker 端白名单字符集
// (BASICS_UNIT_KEY_PATTERN)内,否则含该单元的 PUT 会被 worker 400 拒收,整条持久化缝断掉。
describe('unit_key 字符集审计', () => {
  it('声母 symbol → unit_key 命中白名单', () => {
    for (const u of PINYIN_INITIALS) {
      expect(BASICS_UNIT_KEY_PATTERN.test(unitKey('pinyin', u.symbol))).toBe(true)
    }
  })

  it('韵母 symbol(含 ü 系)→ unit_key 命中白名单', () => {
    for (const u of PINYIN_FINALS) {
      expect(BASICS_UNIT_KEY_PATTERN.test(unitKey('pinyin', u.symbol))).toBe(true)
    }
  })

  it('声调 symbol → unit_key 命中白名单', () => {
    for (const u of PINYIN_TONES) {
      expect(BASICS_UNIT_KEY_PATTERN.test(unitKey('pinyin', u.symbol))).toBe(true)
    }
  })

  it('英文字母 symbol → unit_key 命中白名单', () => {
    for (const u of ENGLISH_LETTERS) {
      expect(BASICS_UNIT_KEY_PATTERN.test(unitKey('english', u.symbol))).toBe(true)
    }
  })

  it('白名单直检:ü 系韵母被收、大写符号被拒', () => {
    expect(BASICS_UNIT_KEY_PATTERN.test('pinyin:ü')).toBe(true)
    expect(BASICS_UNIT_KEY_PATTERN.test('pinyin:üe')).toBe(true)
    expect(BASICS_UNIT_KEY_PATTERN.test('pinyin:üan')).toBe(true)
    expect(BASICS_UNIT_KEY_PATTERN.test('pinyin:ün')).toBe(true)
    expect(BASICS_UNIT_KEY_PATTERN.test('pinyin:ton2')).toBe(true)
    expect(BASICS_UNIT_KEY_PATTERN.test('english:z')).toBe(true)
    expect(BASICS_UNIT_KEY_PATTERN.test('pinyin:A')).toBe(false)
    expect(BASICS_UNIT_KEY_PATTERN.test('pinyin:-')).toBe(false)
  })
})
