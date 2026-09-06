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

/** 当前 quiz 题的选项按钮(首个含 button 的 div.grid;确认行/重听区为 flex,不会误抓)。 */
function optionButtons(container: HTMLElement): HTMLElement[] {
  const grid = Array.from(container.querySelectorAll('div.grid')).find((el) => el.querySelectorAll('button').length > 0)
  if (!grid) return []
  return Array.from(grid.querySelectorAll('button'))
}

/** 答对:全部选项点听一遍(听齐 + 满足 requireVisitAll)→ 选 target → 确定。 */
function answerTarget(container: HTMLElement, target: string) {
  optionButtons(container).forEach((b) => fireEvent.click(b))
  fireEvent.click(screen.getByText(target))
  fireEvent.click(screen.getByRole('button', { name: '确定' }))
}

/** 答错:同上,但最终选 wrong。 */
function answerWrong(container: HTMLElement, wrong: string) {
  optionButtons(container).forEach((b) => fireEvent.click(b))
  fireEvent.click(screen.getByText(wrong))
  fireEvent.click(screen.getByRole('button', { name: '确定' }))
}

function renderOverlay(over: { onDone?: () => void } = {}) {
  const basics = fakeBasics()
  const onDone = over.onDone ?? vi.fn()
  const utils = render(
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
  return { basics, onDone, ...utils }
}

describe('TeachOverlay', () => {
  it('按 units 逐题轻测,答对 recordAnswer(true) 且全过 markTaught + onDone', async () => {
    const { basics, onDone, container } = renderOverlay()

    await enterQuiz()

    // 两题逐题「听齐 + 选对 + 确定」
    answerTarget(container, 'p')
    // 第 1 题答对已推进到第 2 题(尚未全过)→ 教学记录此时不应落
    const second = await screen.findByText('g')
    expect(basics.markTaught).not.toHaveBeenCalled()
    answerTarget(container, 'g')

    // 全对 → praise 步「开始答题!」→ onDone
    fireEvent.click(await screen.findByRole('button', { name: /开始答题/ }))

    expect(basics.recordAnswer).toHaveBeenCalled()
    expect(basics.markTaught).toHaveBeenCalledWith(['pinyin:p', 'pinyin:g'])
    expect(onDone).toHaveBeenCalled()
  })

  it('答错 → recordAnswer(false) + 复演示反馈,点「再试一次」后答对继续,不 markTaught', async () => {
    const { basics, onDone, container } = renderOverlay()

    await enterQuiz()

    // 第 1 题听齐后选干扰项 'b' → 答错(复演示 overlay 替代题卡,Choice 卸载 → 重试时 visited 复位)
    answerWrong(container, 'b')
    expect(basics.recordAnswer).toHaveBeenCalledWith('pinyin:p', false)
    fireEvent.click(await screen.findByRole('button', { name: /再试一次/ }))

    // 重试第 1 题听齐答对,再答第 2 题
    answerTarget(container, 'p')
    const second = await screen.findByText('g')
    answerTarget(container, 'g')

    fireEvent.click(await screen.findByRole('button', { name: /开始答题/ }))

    expect(basics.recordAnswer).toHaveBeenCalledWith('pinyin:p', true)
    expect(basics.markTaught).toHaveBeenCalledWith(['pinyin:p', 'pinyin:g'])
    expect(onDone).toHaveBeenCalled()
  })

  it('「直接答题」跳过:onDone 即触发且不 markTaught', () => {
    const { basics, onDone } = renderOverlay()
    fireEvent.click(screen.getByRole('button', { name: /直接答题/ }))
    expect(onDone).toHaveBeenCalled()
    expect(basics.markTaught).not.toHaveBeenCalled()
  })
})
