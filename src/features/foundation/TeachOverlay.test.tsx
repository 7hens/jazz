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

/** 当前 quiz 题的选项按钮(首个含 button 的 div.grid;确认行/标题行为 flex,不会误抓)。 */
function optionButtons(container: HTMLElement): HTMLElement[] {
  const grid = Array.from(container.querySelectorAll('div.grid')).find((el) => el.querySelectorAll('button').length > 0)
  if (!grid) return []
  return Array.from(grid.querySelectorAll('button'))
}

/** 直接判分作答:选 target → 确定。 */
function answerTarget(target: string) {
  fireEvent.click(screen.getByText(target))
  fireEvent.click(screen.getByRole('button', { name: '确定' }))
}

/** 直接判分作答:选干扰项 wrong → 确定。 */
function answerWrong(wrong: string) {
  fireEvent.click(screen.getByText(wrong))
  fireEvent.click(screen.getByRole('button', { name: '确定' }))
}

function renderOverlay(over: { onDone?: () => void; onExit?: () => void } = {}) {
  const basics = fakeBasics()
  const onDone = over.onDone ?? vi.fn()
  const onExit = over.onExit ?? vi.fn()
  const utils = render(
    <TeachOverlay
      word={apple}
      skill="pinyin"
      units={['pinyin:p', 'pinyin:g']}
      basics={basics}
      speak={speak}
      playSound={playSound}
      onDone={onDone}
      onExit={onExit}
    />,
  )
  return { basics, onDone, onExit, ...utils }
}

describe('TeachOverlay 纯判分题(直接答题,无听齐)', () => {
  it('入题即首题(无 demo/tap 步),首题 4 选项,左上角题型徽章', async () => {
    const { container } = renderOverlay()
    expect(await screen.findByText(/开头的声母/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /下一步/ })).toBeNull()
    expect(optionButtons(container)).toHaveLength(4)
    expect(screen.getByText('选一选')).toBeTruthy()
  })

  it('按 units 逐题判分,答对 recordAnswer(true) 且全过 markTaught + onDone', async () => {
    const { basics, onDone } = renderOverlay()

    await screen.findByText(/开头的声母/)
    answerTarget('p')
    await screen.findByText('g') // 已自动推进到第 2 题
    expect(basics.markTaught).not.toHaveBeenCalled() // 未全过,教学记录此时不落
    answerTarget('g')

    fireEvent.click(await screen.findByRole('button', { name: /开始答题/ }))

    expect(basics.recordAnswer).toHaveBeenCalled()
    expect(basics.markTaught).toHaveBeenCalledWith(['pinyin:p', 'pinyin:g'])
    expect(onDone).toHaveBeenCalled()
  })

  it('答错 → recordAnswer(false) + 复演示反馈,点「再试一次」后答对继续,不 markTaught', async () => {
    const { basics, onDone } = renderOverlay()

    await screen.findByText(/开头的声母/)
    answerWrong('b')
    expect(basics.recordAnswer).toHaveBeenCalledWith('pinyin:p', false)
    fireEvent.click(await screen.findByRole('button', { name: /再试一次/ }))

    answerTarget('p')
    await screen.findByText('g')
    answerTarget('g')

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

  it('onExit:标题栏「返回」离教(quiz 期)', async () => {
    const onExit = vi.fn()
    const onDone = vi.fn()
    renderOverlay({ onDone, onExit })
    await screen.findByText(/开头的声母/)
    fireEvent.click(screen.getByRole('button', { name: '返回' }))
    expect(onExit).toHaveBeenCalledTimes(1)
    expect(onDone).not.toHaveBeenCalled()
  })

  it('onExit:praise 结课「返回地图」离教(未点「开始答题」不 onDone)', async () => {
    const onExit = vi.fn()
    const onDone = vi.fn()
    renderOverlay({ onDone, onExit })

    await screen.findByText(/开头的声母/)
    answerTarget('p')
    await screen.findByText('g')
    answerTarget('g')

    fireEvent.click(await screen.findByRole('button', { name: '返回地图' }))
    expect(onExit).toHaveBeenCalledTimes(1)
    expect(onDone).not.toHaveBeenCalled()
  })
})
