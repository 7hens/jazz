import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { UNITS } from './levels'
import { UnitMap } from './UnitMap'

describe('拼音单元地图', () => {
  it('七个单元各占一格,名片用真积木渲染', () => {
    render(<UnitMap stars={{}} totalStars={0} onPick={vi.fn()} onOpenParent={vi.fn()} />)
    const cells = document.querySelectorAll('[data-unit-id]')
    expect(cells).toHaveLength(UNITS.length)
    // 名片是块本体,不是 emoji、不是文字
    expect(cells[0]?.querySelectorAll('.pblock').length).toBe(UNITS[0]!.badge.length)
  })

  // 零文本:孩子读不出「单韵母」三个字,格子只能靠块自表意。
  it('标题与单元名等汉字不出现在地图上', () => {
    const { container } = render(<UnitMap stars={{}} totalStars={0} onPick={vi.fn()} onOpenParent={vi.fn()} />)
    const map = container.querySelector('[data-unit-map]')
    expect(map?.textContent ?? '').not.toMatch(/[一-鿿]/)
  })

  it('只解锁 u1:其余格子锁上且点不动', () => {
    const onPick = vi.fn()
    render(<UnitMap stars={{}} totalStars={0} onPick={onPick} onOpenParent={vi.fn()} />)
    const cells = document.querySelectorAll<HTMLElement>('[data-unit-id]')
    expect(cells[0]?.dataset.locked).toBe('false')
    expect(cells[1]?.dataset.locked).toBe('true')
    fireEvent.click(cells[1] as HTMLElement)
    expect(onPick).not.toHaveBeenCalled()
    fireEvent.click(cells[0] as HTMLElement)
    expect(onPick).toHaveBeenCalledWith(0)
  })

  // 一格里的星位 = 该单元的关卡数;亮几颗 = 通了几关。
  // 不画「本关几星」—— 格子放不下 3-7 组三星,而且地图该答的是「这格过了多少」。
  it('通关的格子亮起对应颗数,没通的留着暗星位', () => {
    const unit = UNITS[0]!
    const stars = { [unit.levels[0]!.id]: 2, [unit.levels[1]!.id]: 1 }
    render(<UnitMap stars={stars} totalStars={20} onPick={vi.fn()} onOpenParent={vi.fn()} />)
    const cell = document.querySelector<HTMLElement>('[data-unit-id="u1"]')
    expect(cell?.querySelectorAll('.pstar')).toHaveLength(unit.levels.length)
    expect(cell?.querySelectorAll('.pstar--on')).toHaveLength(2)
    // 进度数字与亮星数一致
    expect(cell?.textContent).toContain(`2/${unit.levels.length}`)
  })

  it('零星的关只留暗星位', () => {
    const unit = UNITS[0]!
    render(<UnitMap stars={{ [unit.levels[0]!.id]: 0 }} totalStars={0} onPick={vi.fn()} onOpenParent={vi.fn()} />)
    const cell = document.querySelector<HTMLElement>('[data-unit-id="u1"]')
    expect(cell?.querySelectorAll('.pstar--on')).toHaveLength(0)
    expect(cell?.textContent).toContain(`0/${unit.levels.length}`)
  })

  it('星尘计数显示在顶部', () => {
    render(<UnitMap stars={{}} totalStars={340} onPick={vi.fn()} onOpenParent={vi.fn()} />)
    expect(screen.getByLabelText('星尘 340')).toBeInTheDocument()
  })

  it('齿轮开家长面板', () => {
    const onOpenParent = vi.fn()
    render(<UnitMap stars={{}} totalStars={0} onPick={vi.fn()} onOpenParent={onOpenParent} />)
    fireEvent.click(screen.getByLabelText('家长'))
    expect(onOpenParent).toHaveBeenCalled()
  })
})
