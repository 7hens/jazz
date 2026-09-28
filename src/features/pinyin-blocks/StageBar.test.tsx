import { cleanup, render } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StageBar, StageDots } from './StageBar'
import { STAGE_TRANSITION_MS, StageTransition } from './StageTransition'

/** 亮起来的格子数(未亮的格子没有 --on / --cool 类)。 */
const litCount = (el: HTMLElement) => el.querySelectorAll('.pstage-step--on, .pstage-step--cool').length
const coolCount = (el: HTMLElement) => el.querySelectorAll('.pstage-step--cool').length

afterEach(cleanup)

describe('段标(台阶条)', () => {
  it('三段各自的亮法:简单 1 格 / 困难 2 格 / 复习 2 格橙 + 1 格灰蓝', () => {
    const easy = render(<StageBar stage="easy" />).container.firstElementChild as HTMLElement
    expect(litCount(easy)).toBe(1)
    expect(coolCount(easy)).toBe(0)

    cleanup()
    const hard = render(<StageBar stage="hard" />).container.firstElementChild as HTMLElement
    expect(litCount(hard)).toBe(2)
    expect(coolCount(hard)).toBe(0)

    cleanup()
    const review = render(<StageBar stage="review" />).container.firstElementChild as HTMLElement
    expect(litCount(review)).toBe(3)
    expect(coolCount(review)).toBe(1)
    expect(review.dataset.stage).toBe('review')
  })

  it('三格恒存在(形状先给,颜色后给 —— 减动效用户看到的也是一样的两个状态)', () => {
    const { container } = render(<StageBar stage="easy" />)
    expect(container.querySelectorAll('.pstage-step')).toHaveLength(3)
  })
})

describe('复习段的小题进度点', () => {
  const dotCount = () => document.querySelectorAll('.pstage-dot').length
  const onCount = () => document.querySelectorAll('.pstage-dot--on').length

  it('有几道题就画几个点,当前第几道就亮几颗', () => {
    const { rerender } = render(<StageDots total={3} done={1} />)
    expect(dotCount()).toBe(3)
    expect(onCount()).toBe(1)
    rerender(<StageDots total={3} done={2} />)
    expect(onCount()).toBe(2)
  })

  it('池空时的整题小题只有一颗点', () => {
    render(<StageDots total={1} done={1} />)
    expect(dotCount()).toBe(1)
    expect(onCount()).toBe(1)
  })
})

describe('换段过场', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('停 1.2s 后才交回,且期间台阶条已经是目标段的样子', () => {
    const onDone = vi.fn()
    const { container } = render(<StageTransition stage="hard" onDone={onDone} />)
    expect(container.querySelector('[data-stage-transition="hard"]')).not.toBeNull()
    expect(litCount(container.querySelector('.pstage-bar') as HTMLElement)).toBe(2)

    act(() => vi.advanceTimersByTime(STAGE_TRANSITION_MS - 1))
    expect(onDone).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  // onDone 每次渲染都是新的内联箭头函数 —— 挂进 effect 的 deps 会把计时器反复重置,过场永远走不完。
  it('中途重渲染不会重置计时器', () => {
    const onDone = vi.fn()
    const { rerender } = render(<StageTransition stage="review" onDone={onDone} />)
    act(() => vi.advanceTimersByTime(1000))
    rerender(<StageTransition stage="review" onDone={() => onDone()} />)
    act(() => vi.advanceTimersByTime(200))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  // 反向守卫:计时器里直接闭包捕获 onDone 也能让「调用次数 === 1」成立,
  // 但那样交回的是挂载时的旧闭包,父组件会拿旧 state 推进/关闭。必须断调的是最新那个 spy。
  it('中途换了 onDone,交回时走的是最新那个而不是挂载时捕获的旧闭包', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = render(<StageTransition stage="review" onDone={first} />)
    act(() => vi.advanceTimersByTime(STAGE_TRANSITION_MS - 200))
    rerender(<StageTransition stage="review" onDone={second} />)
    act(() => vi.advanceTimersByTime(200))
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()
  })

  it('进复习那一处遮罩里,第三格已经是灰蓝', () => {
    const { container } = render(<StageTransition stage="review" onDone={vi.fn()} />)
    expect(coolCount(container.querySelector('.pstage-bar') as HTMLElement)).toBe(1)
  })
})
