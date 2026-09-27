import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { HAN_TEXT } from '@/shared/testing/han-text'
import { ACHIEVEMENTS } from './achievements'
import { AchievementPopup } from './AchievementPopup'

const perfect = ACHIEVEMENTS.find((a) => a.id === 'perfect_level')!

describe('成就弹层', () => {
  afterEach(cleanup)

  // 4-8 岁读不出「解锁成就」,也不需要读它 —— 图标已经说明这是什么(设计 §3.1)。
  it('孩子面零汉字:只有图标与 +N ⭐', () => {
    const { container } = render(<AchievementPopup list={[perfect]} onDone={vi.fn()} />)
    // 先断言锚点:取不到时下面的断言会对着空白容器恒绿。
    expect(container.querySelector('[data-reward-card]'), '缺少 data-reward-card 锚点').not.toBeNull()
    expect(container.textContent ?? '').not.toMatch(HAN_TEXT)
    expect(screen.getByText(`+${perfect.reward} ⭐`)).toBeInTheDocument()
  })

  it('拿到成就时请求 achievement 档撒花', () => {
    const celebrate = vi.fn()
    render(<AchievementPopup list={[perfect]} onDone={vi.fn()} celebrate={celebrate} />)
    expect(celebrate).toHaveBeenCalledWith('achievement')
  })
})
