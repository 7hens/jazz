import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { StageBar, StageDots } from './StageBar'

/** 亮起来的格子数。 */
const litCount = (el: HTMLElement) => el.querySelectorAll('.pstage-step--on').length

afterEach(cleanup)

describe('本节题位条', () => {
  it('有几道题就几格 —— 3 / 4 / 5 题三档都能画', () => {
    for (const total of [3, 4, 5]) {
      const { container, unmount } = render(<StageBar total={total} done={1} />)
      expect(container.querySelectorAll('.pstage-step')).toHaveLength(total)
      unmount()
    }
  })

  it('亮到第几格就是做到第几题（done 从 1 起）', () => {
    const { rerender, container } = render(<StageBar total={4} done={1} />)
    const bar = container.firstElementChild as HTMLElement
    expect(litCount(bar)).toBe(1)
    rerender(<StageBar total={4} done={3} />)
    expect(litCount(bar)).toBe(3)
  })

  it('零文本:进度只进无障碍树', () => {
    const { container } = render(<StageBar total={5} done={2} />)
    const bar = container.firstElementChild as HTMLElement
    expect(bar.textContent).toBe('')
    expect(bar.getAttribute('aria-label')).toBe('本节 2/5')
    expect(bar.dataset.barTotal).toBe('5')
    expect(bar.dataset.barDone).toBe('2')
  })

  it('格子等高 —— 旧的「越右越高」编码的是部分难度阶，部分这个层没有了', () => {
    const { container } = render(<StageBar total={4} done={0} />)
    // 三格以上的档位不得再出现 nth-child 派生的高度差(形状必须靠 CSS 之外的东西判不出来,
    // 故这里只钉「不再有 --cool / --pop 这两支旧语汇」)。
    expect(container.querySelectorAll('.pstage-step--cool, .pstage-step--pop')).toHaveLength(0)
  })
})

describe('练习的小题进度点', () => {
  const dotCount = () => document.querySelectorAll('.pstage-dot').length
  const onCount = () => document.querySelectorAll('.pstage-dot--on').length

  it('有几道题就画几个点,当前第几道就亮几颗', () => {
    const { rerender } = render(<StageDots total={5} done={1} />)
    expect(dotCount()).toBe(5)
    expect(onCount()).toBe(1)
    rerender(<StageDots total={5} done={4} />)
    expect(onCount()).toBe(4)
  })
})
