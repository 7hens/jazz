import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { BaseOption } from '@/shared/services'
import { MatchGame } from './MatchGame'

const left: BaseOption[] = [
  { id: 'l1', text: '太阳', speak: '太阳' },
  { id: 'l2', text: '月亮', speak: '月亮' },
]
const right: BaseOption[] = [
  { id: 'r1', emoji: '☀️', text: '☀️', speak: '太阳' },
  { id: 'r2', emoji: '🌙', text: '🌙', speak: '月亮' },
]

describe('MatchGame 点读语义(纯选择才读,配对/取消不读)', () => {
  afterEach(cleanup)

  it('题卡左上角渲染「连连看」题型徽章', () => {
    render(
      <MatchGame
        prompt="配对"
        left={left}
        right={right}
        answerMap={{ l1: 'r1', l2: 'r2' }}
        skill="hanzi"
        playSound={vi.fn()}
        speak={() => true}
        onComplete={vi.fn()}
      />,
    )
    expect(screen.getByText('连连看')).toBeTruthy()
  })

  it('选中读一次、取消选择不读、再选再读', () => {
    const speak = vi.fn(() => true)
    const onComplete = vi.fn()
    render(
      <MatchGame
        prompt="配对"
        left={left}
        right={right}
        answerMap={{ l1: 'r1', l2: 'r2' }}
        skill="hanzi"
        playSound={vi.fn()}
        speak={speak}
        onComplete={onComplete}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '太阳' }))
    expect(speak).toHaveBeenCalledTimes(1)
    expect(speak).toHaveBeenLastCalledWith('太阳', 'zh-CN')
    fireEvent.click(screen.getByRole('button', { name: '太阳' })) // 取消选择
    expect(speak).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: '太阳' })) // 重新选中
    expect(speak).toHaveBeenCalledTimes(2)
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('配对判合不朗读;整组对 → onComplete(left id)', () => {
    const speak = vi.fn(() => true)
    const onComplete = vi.fn()
    render(
      <MatchGame
        prompt="配对"
        left={[{ id: 'l1', text: '太阳', speak: '太阳' }]}
        right={[{ id: 'r1', emoji: '☀️', text: '☀️', speak: '太阳' }]}
        answerMap={{ l1: 'r1' }}
        skill="hanzi"
        playSound={vi.fn()}
        speak={speak}
        onComplete={onComplete}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '太阳' }))
    expect(speak).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: '☀️' })) // 判合,不读
    expect(speak).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith('l1')
  })

  it('错配不朗读,出 wrong 音', () => {
    const speak = vi.fn(() => true)
    const playSound = vi.fn()
    render(
      <MatchGame
        prompt="配对"
        left={left}
        right={right}
        answerMap={{ l1: 'r1', l2: 'r2' }}
        skill="hanzi"
        playSound={playSound}
        speak={speak}
        onComplete={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '太阳' }))
    expect(speak).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: '🌙' })) // 错配判合,不读
    expect(speak).toHaveBeenCalledTimes(1)
    expect(playSound).toHaveBeenCalledWith('wrong')
  })

  it('配错态挂 ✗ 形状冗余(data-state 可测)', () => {
    render(
      <MatchGame
        prompt="配对"
        left={left}
        right={right}
        answerMap={{ l1: 'r1', l2: 'r2' }}
        skill="hanzi"
        playSound={vi.fn()}
        speak={() => true}
        onComplete={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '太阳' })) // l1
    fireEvent.click(screen.getByRole('button', { name: '🌙' })) // r2 → 与 l1 不配对
    expect(screen.getByRole('button', { name: '太阳' })).toHaveAttribute('data-state', 'wrong')
    expect(screen.getByRole('button', { name: '太阳' })).toHaveTextContent('✗')
  })

  it('炼金:配对成功后左块变金石(含两侧内容),右位留空凹槽', () => {
    const { container } = render(
      <MatchGame
        prompt="配对"
        left={[{ id: 'l1', emoji: '🍎', text: '苹果', speak: '苹果' }]}
        right={[{ id: 'r1', text: 'píng guǒ', speak: '苹果' }]}
        answerMap={{ l1: 'r1' }}
        skill="hanzi"
        playSound={vi.fn()}
        speak={() => true}
        onComplete={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '苹果' }))
    fireEvent.click(screen.getByRole('button', { name: 'píng guǒ' }))

    const gold = container.querySelector('[data-state="gold"]')
    expect(gold).not.toBeNull()
    expect(gold).toHaveTextContent('苹果')
    expect(gold).toHaveTextContent('píng guǒ')
    expect(gold).toHaveTextContent('⭐')

    const slot = container.querySelector('[data-state="slot"]')
    expect(slot).not.toBeNull()
    expect(slot!.textContent).toBe('')
  })

  it('爆点:配对瞬间渲染冲击波与拟声词,且均为 aria-hidden 装饰', async () => {
    const { container } = render(
      <MatchGame
        prompt="配对"
        left={[{ id: 'l1', text: '苹果', speak: '苹果' }]}
        right={[{ id: 'r1', text: 'píng guǒ', speak: '苹果' }]}
        answerMap={{ l1: 'r1' }}
        skill="hanzi"
        playSound={vi.fn()}
        speak={() => true}
        onComplete={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '苹果' }))
    fireEvent.click(screen.getByRole('button', { name: 'píng guǒ' }))

    const layer = container.querySelector('[data-match-burst]')
    expect(layer).not.toBeNull()
    expect(layer).toHaveAttribute('aria-hidden', 'true')
    expect(layer).toHaveTextContent('啪!')

    await waitFor(() => expect(container.querySelector('[data-match-burst]')).toBeNull(), { timeout: 2000 })
  })

  it('对撞:配对的两块各挂一侧 pop 类,爆点结束后一起摘掉', async () => {
    const { container } = render(
      <MatchGame
        prompt="配对"
        left={[{ id: 'l1', text: '苹果', speak: '苹果' }]}
        right={[{ id: 'r1', text: 'píng guǒ', speak: '苹果' }]}
        answerMap={{ l1: 'r1' }}
        skill="hanzi"
        playSound={vi.fn()}
        speak={() => true}
        onComplete={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '苹果' }))
    fireEvent.click(screen.getByRole('button', { name: 'píng guǒ' }))

    // 名字必须具体到「哪一侧」:两侧写反(或都写 l)在肉眼之外无法发现。
    expect(container.querySelector('[data-state="gold"]')).toHaveClass('stone--pop-l')
    expect(container.querySelector('[data-state="slot"]')).toHaveClass('stone--pop-r')

    await waitFor(() => expect(container.querySelector('[data-match-burst]')).toBeNull(), { timeout: 2000 })
    expect(container.querySelector('[data-state="gold"]')).not.toHaveClass('stone--pop-l')
    expect(container.querySelector('[data-state="slot"]')).not.toHaveClass('stone--pop-r')
  })

  it('爆点与错配可叠加:爆点存活期间错配,爆点仍按时清空(两 timer ref 不得合并)', async () => {
    const { container } = render(
      <MatchGame
        prompt="配对"
        left={[
          { id: 'l1', text: '苹果', speak: '苹果' },
          { id: 'l2', text: '月亮', speak: '月亮' },
        ]}
        right={[
          { id: 'r1', text: 'píng guǒ', speak: '苹果' },
          { id: 'r2', text: 'yuè liàng', speak: '月亮' },
          { id: 'r3', text: 'shān', speak: '山' },
        ]}
        answerMap={{ l1: 'r1', l2: 'r2' }}
        skill="hanzi"
        playSound={vi.fn()}
        speak={() => true}
        onComplete={vi.fn()}
      />,
    )
    // 先炼成一对 → 爆点存活
    fireEvent.click(screen.getByRole('button', { name: '苹果' }))
    fireEvent.click(screen.getByRole('button', { name: 'píng guǒ' }))
    expect(container.querySelector('[data-match-burst]')).not.toBeNull()

    // 爆点不锁输入:存活期间立刻错配一次(共用 timerRef 时,这一句会 clearTimeout 掉爆点的计时器)
    fireEvent.click(screen.getByRole('button', { name: '月亮' }))
    fireEvent.click(screen.getByRole('button', { name: 'shān' }))
    expect(container.querySelector('[data-state="wrong"]')).not.toBeNull()

    await waitFor(() => expect(container.querySelector('[data-match-burst]')).toBeNull(), { timeout: 2000 })
  })
})
