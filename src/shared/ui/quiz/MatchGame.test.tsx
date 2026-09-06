import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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
})
