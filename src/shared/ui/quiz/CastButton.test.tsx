import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CAST_LABEL, CastButton } from './CastButton'

describe('CastButton 施法钮', () => {
  afterEach(cleanup)

  it('文案逐字为「就它了!」(半角感叹号,见 spec D4)', () => {
    render(<CastButton disabled={false} onClick={() => {}} />)
    expect(CAST_LABEL).toBe('就它了!')
    expect(screen.getByRole('button', { name: CAST_LABEL })).toBeTruthy()
  })

  it('disabled 透传:禁用时不触发 onClick', () => {
    const onClick = vi.fn()
    render(<CastButton disabled onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: CAST_LABEL }))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('可用时触发 onClick', () => {
    const onClick = vi.fn()
    render(<CastButton disabled={false} onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: CAST_LABEL }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
