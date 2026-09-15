import { describe, expect, it } from 'vitest'
import { stoneClass, stoneMark, stoneMarkClass, stoneOffset } from './stone'

describe('stone 词石纯函数', () => {
  it('对错态各自给出形状冗余角标(色彩冗余:红绿之外给形状)', () => {
    expect(stoneMark('correct')).toBe('✓')
    expect(stoneMark('wrong')).toBe('✗')
  })

  it('无冗余态不挂角标', () => {
    expect(stoneMark('idle')).toBeNull()
    expect(stoneMark('selected')).toBeNull()
    expect(stoneMark('muted')).toBeNull()
  })

  it('角标底色随对错取 token', () => {
    expect(stoneMarkClass('correct')).toContain('bg-emerald')
    expect(stoneMarkClass('wrong')).toContain('bg-red')
    expect(stoneMarkClass('idle')).toBe('')
  })

  it('对/错/选中各自用 token 色,且不出现 opacity 压暗', () => {
    expect(stoneClass('correct')).toContain('border-emerald/70')
    expect(stoneClass('wrong')).toContain('border-red')
    expect(stoneClass('selected')).toContain('border-accent')
    for (const s of ['idle', 'selected', 'correct', 'wrong', 'muted'] as const) {
      expect(stoneClass(s)).not.toMatch(/\bopacity-/)
    }
  })

  it('错落:奇数列下移,偶数列不偏移', () => {
    expect(stoneOffset(1)).toContain('translate-y')
    expect(stoneOffset(0)).toBe('')
    expect(stoneOffset(2)).toBe('')
  })

  it('两列圆角半径不同,破等距方阵感', () => {
    expect(stoneClass('idle', 0)).not.toBe(stoneClass('idle', 1))
  })
})
