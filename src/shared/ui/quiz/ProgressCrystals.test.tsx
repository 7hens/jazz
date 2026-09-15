import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { ProgressCrystals } from './ProgressCrystals'

describe('ProgressCrystals 水晶进度条', () => {
  afterEach(cleanup)

  it('按 total 渲染格数,按 current 标记已过/当前/未到', () => {
    const { container } = render(<ProgressCrystals total={4} current={2} />)
    const cells = Array.from(container.querySelectorAll('[data-crystal]'))
    expect(cells.map((c) => c.getAttribute('data-crystal'))).toEqual(['done', 'done', 'active', 'todo'])
  })

  it('current=0 时首格是 active、其余未到', () => {
    const { container } = render(<ProgressCrystals total={3} current={0} />)
    const cells = Array.from(container.querySelectorAll('[data-crystal]'))
    expect(cells.map((c) => c.getAttribute('data-crystal'))).toEqual(['active', 'todo', 'todo'])
  })

  it('纯装饰:整行不进 a11y 树(进度语义由既有文本承载)', () => {
    const { container } = render(<ProgressCrystals total={2} current={1} />)
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2)
  })
})
