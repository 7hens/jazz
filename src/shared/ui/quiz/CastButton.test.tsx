import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CAST_LABEL, CastButton } from './CastButton'

/** ASCII `!`(U+0021)。用码点构造而非裸字面量:仓库级 `!`→全角 `！` 替换会同时改掉
 *  被测常量与裸字面量两边,那种自我比较照样绿 —— 守不住 spec D4。 */
const ASCII_BANG = String.fromCharCode(0x21)

describe('CastButton 施法钮', () => {
  afterEach(cleanup)

  it('文案逐字为「就它了!」(半角感叹号,见 spec D4)', () => {
    expect(CAST_LABEL).toBe(`就它了${ASCII_BANG}`)
    expect(CAST_LABEL.charCodeAt(CAST_LABEL.length - 1)).toBe(0x21)
    expect(CAST_LABEL).not.toMatch(/！/)
    // 渲染产物按同一显式码点比对,不借道 CAST_LABEL(否则又成自我比较)。
    render(<CastButton disabled={false} onClick={() => {}} />)
    expect(screen.getByRole('button', { name: `就它了${ASCII_BANG}` })).toBeTruthy()
  })

  it('disabled 透传:禁用时不触发 onClick', () => {
    const onClick = vi.fn()
    render(<CastButton disabled onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: `就它了${ASCII_BANG}` }))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('可用时触发 onClick', () => {
    const onClick = vi.fn()
    render(<CastButton disabled={false} onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: `就它了${ASCII_BANG}` }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
