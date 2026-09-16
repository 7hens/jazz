import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { SparkBurst } from './SparkBurst'

describe('SparkBurst 答对迸星', () => {
  afterEach(cleanup)

  it('粒子数 ≤5 且整块 aria-hidden(不得改变宿主按钮的 accessible name)', () => {
    const { container } = render(<SparkBurst />)
    const wrap = container.querySelector('[data-spark-burst]')
    expect(wrap).not.toBeNull()
    expect(wrap).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelectorAll('[data-spark]').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('[data-spark]').length).toBeLessThanOrEqual(5)
  })
})
