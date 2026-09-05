import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { WordUnit, BasicsService, BasicsProgressSnapshot } from '@/shared/services'
import { TeachOverlay } from './TeachOverlay'

const apple: WordUnit = { id: 21, emoji: '🍎', pinyin: 'píng guǒ', hanzi: '苹果', english: 'apple', category: 'food' }
const speak = vi.fn(() => true)
const playSound = vi.fn()

function fakeBasics(): BasicsService {
  const snapshot: BasicsProgressSnapshot = { status: 'ready', data: {} }
  return {
    load: vi.fn(async () => {}),
    recordAnswer: vi.fn(async () => {}),
    markTaught: vi.fn(async () => {}),
    saveAll: vi.fn(async () => {}),
    subscribe: () => () => undefined,
    getSnapshot: () => snapshot,
  }
}

/** 前进到 quiz 步:demo → tap → quiz。 */
async function enterQuiz() {
  fireEvent.click(await screen.findByRole('button', { name: /下一步/ }))
  fireEvent.click(await screen.findByRole('button', { name: /下一步/ }))
  await screen.findByText(/开头的声母/)
}

describe('TeachOverlay', () => {
  it('按 units 逐题轻测,答对 recordAnswer(true) 且全过 markTaught + onDone', async () => {
    const basics = fakeBasics()
    const onDone = vi.fn()
    render(
      <TeachOverlay
        word={apple}
        skill="pinyin"
        units={['pinyin:p', 'pinyin:g']}
        basics={basics}
        speak={speak}
        playSound={playSound}
        onDone={onDone}
      />,
    )

    await enterQuiz()

    // 两题逐题答对:题面选项文本 = 单元符号(声母砖 'p'/'g'),干扰项不含 target → 唯一正确。
    fireEvent.click(screen.getByText('p'))
    fireEvent.click(await screen.findByText('g'))

    // 全对 → praise 步「开始答题!」→ onDone
    fireEvent.click(await screen.findByRole('button', { name: /开始答题/ }))

    expect(basics.recordAnswer).toHaveBeenCalled()
    expect(basics.markTaught).toHaveBeenCalledWith(['pinyin:p', 'pinyin:g'])
    expect(onDone).toHaveBeenCalled()
  })

  it('答错 → recordAnswer(false) + 复演示反馈,点「再试一次」后答对继续,不 markTaught', async () => {
    const basics = fakeBasics()
    const onDone = vi.fn()
    render(
      <TeachOverlay
        word={apple}
        skill="pinyin"
        units={['pinyin:p', 'pinyin:g']}
        basics={basics}
        speak={speak}
        playSound={playSound}
        onDone={onDone}
      />,
    )

    await enterQuiz()

    // 第 1 题点干扰项 'b'(两拼口径下 p 的干扰恒含 b)→ 答错
    fireEvent.click(screen.getByText('b'))
    expect(basics.recordAnswer).toHaveBeenCalledWith('pinyin:p', false)
    fireEvent.click(await screen.findByRole('button', { name: /再试一次/ }))

    // 重试第 1 题答对,再答第 2 题
    fireEvent.click(screen.getByText('p'))
    fireEvent.click(await screen.findByText('g'))

    fireEvent.click(await screen.findByRole('button', { name: /开始答题/ }))

    expect(basics.recordAnswer).toHaveBeenCalledWith('pinyin:p', true)
    expect(basics.markTaught).toHaveBeenCalledWith(['pinyin:p', 'pinyin:g'])
    expect(onDone).toHaveBeenCalled()
  })

  it('「直接答题」跳过:onDone 即触发且不 markTaught', () => {
    const basics = fakeBasics()
    const onDone = vi.fn()
    render(
      <TeachOverlay
        word={apple}
        skill="pinyin"
        units={['pinyin:p', 'pinyin:g']}
        basics={basics}
        speak={speak}
        playSound={playSound}
        onDone={onDone}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /直接答题/ }))
    expect(onDone).toHaveBeenCalled()
    expect(basics.markTaught).not.toHaveBeenCalled()
  })
})
