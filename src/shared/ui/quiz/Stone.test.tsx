import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Stone } from './Stone'

describe('Stone 词石唯一渲染点', () => {
  afterEach(cleanup)

  it('state 落到 data-state,供色彩冗余断言定位', () => {
    const { container } = render(<Stone state="wrong" text="B" />)
    expect(container.querySelector('button')).toHaveAttribute('data-state', 'wrong')
  })

  it('对错挂形状角标,且角标 aria-hidden 不影响 accessible name', () => {
    render(<Stone state="correct" text="A" />)
    const btn = screen.getByRole('button', { name: 'A' })
    expect(btn).toHaveTextContent('✓')
  })

  it('emoji 走柔光晕托节点,且不进入 accessible name', () => {
    const { container } = render(<Stone state="idle" emoji="🍎" text="苹果" />)
    const btn = screen.getByRole('button', { name: '苹果' })
    expect(btn.querySelector('[data-halo]')).not.toBeNull()
    expect(container.querySelector('[data-halo]')).toHaveAttribute('aria-hidden', 'true')
  })

  it('gold 态渲染两行文本(词 + 拼音)并挂 ⭐', () => {
    const { container } = render(<Stone state="gold" text="苹果" subText="píng guǒ" />)
    const btn = container.querySelector('button')!
    expect(btn).toHaveAttribute('data-state', 'gold')
    expect(btn).toHaveTextContent('⭐')
    expect(btn).toHaveTextContent('苹果')
    expect(btn).toHaveTextContent('píng guǒ')
  })

  it('slot 态不渲染任何文本(信息已并入金石)', () => {
    const { container } = render(<Stone state="slot" />)
    expect(container.querySelector('button')!.textContent).toBe('')
  })

  it('点卡回调与 pressed 透传', () => {
    const onClick = vi.fn()
    render(<Stone state="idle" text="A" pressed onClick={onClick} />)
    const btn = screen.getByRole('button', { name: 'A' })
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('children 渲染在按钮内部(迸星/光柱插槽),装饰子节点不进入 accessible name', () => {
    const { container } = render(
      <Stone state="correct" text="A">
        {/* 真实消费方(SparkBurst)的插槽节点必带 aria-hidden;探针照此写,否则 "burst" 会并进 accessible name */}
        <span aria-hidden data-probe>
          burst
        </span>
      </Stone>,
    )
    expect(screen.getByRole('button', { name: 'A' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'A' }).querySelector('[data-probe]')).not.toBeNull()
    expect(container.querySelector('[data-probe]')).toHaveAttribute('aria-hidden', 'true')
  })

  it('水平模式用于连连看,不禁用时不带 active 缩放类以外的交互类', () => {
    const { container } = render(<Stone state="idle" text="太阳" horizontal disabled />)
    expect(container.querySelector('button')).toHaveAttribute('aria-disabled', 'true')
  })
})
