import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { HAN_TEXT } from '@/shared/testing/han-text'
import { LuckyBonus } from './LuckyBonus'

describe('幸运奖励弹层', () => {
  afterEach(cleanup)

  // 原文案是「好运来了!」+「灵灵在草丛里找到了一颗隐藏星尘!」——
  // 后半句的「灵灵」(苏灵灵)已随「拼音积木取代全游戏」整批删除,那句今天没有指称对象。
  it('孩子面零汉字:只有 🍀 与 +N ⭐', () => {
    const { container } = render(<LuckyBonus amount={50} onDone={vi.fn()} />)
    expect(container.querySelector('[data-reward-card]'), '缺少 data-reward-card 锚点').not.toBeNull()
    expect(container.textContent ?? '').not.toMatch(HAN_TEXT)
    expect(screen.getByText('+50 ⭐')).toBeInTheDocument()
  })

  it('数字走 amount,不写死', () => {
    render(<LuckyBonus amount={20} onDone={vi.fn()} />)
    expect(screen.getByText('+20 ⭐')).toBeInTheDocument()
  })

  it('挂上 celebrate 时发的是 lucky 那一档', () => {
    const celebrate = vi.fn()
    render(<LuckyBonus amount={30} onDone={vi.fn()} celebrate={celebrate} />)
    expect(celebrate.mock.calls.map(([level]) => level)).toEqual(['lucky'])
  })

  it('不挂 celebrate 时静默,不抛', () => {
    expect(() => render(<LuckyBonus amount={30} onDone={vi.fn()} />)).not.toThrow()
  })
})
