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

/** 直接判分作答:选 target → 点「就它了!」。 */
function answerTarget(target: string) {
  fireEvent.click(screen.getByText(target))
  fireEvent.click(screen.getByRole('button', { name: '就它了!' }))
}

/** 直接判分作答:选干扰项 wrong → 点「就它了!」。 */
function answerWrong(wrong: string) {
  fireEvent.click(screen.getByText(wrong))
  fireEvent.click(screen.getByRole('button', { name: '就它了!' }))
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
    const { basics, onDone, container } = renderOverlay()

    await screen.findByText(/开头的声母/)
    answerTarget('p')
    // quiet 分档护栏(spec §6):短教教学期不迸星、不上光柱。
    // 正控在前 —— 若时机不对(压根没答对 / 已推进到下一题),正控先红,
    // 免得下面两条 null 断言在一个什么都没渲染的窗口里真空通过。
    expect(container.querySelector('[data-state="correct"]')).not.toBeNull()
    expect(container.querySelector('[data-spark-burst]')).toBeNull()
    expect(container.querySelector('.quiz-beam')).toBeNull()
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

  it('教学期挂「📖 演示」卷轴头且用虚线边框(与真答题区分,不单靠颜色)', () => {
    renderOverlay()
    // 通道 2:卷轴头(显式文字)
    const header = screen.getByText('📖 演示')
    expect(header).toBeTruthy()
    // 通道 1:同一壳体上的虚线边框 —— 删掉 `border-dashed` 本断言即红
    // (header 是 renderQuestion 内 motion.div 壳体的首个子节点,parentElement 即该壳)
    expect(header.parentElement?.className).toContain('border-dashed')
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

  // 短教的进度**没有**可读等价文本(标题栏只写词与技能),水晶条是唯一的进度呈现 ——
  // 删掉 renderQuiz 里那行 <ProgressCrystals/> 不会有别的断言红,故在此钉死。
  it('判分进度:水晶条格数 = quiz 题数(units 2 → 2 格),qi 推进后转 done', async () => {
    const { container } = renderOverlay()
    const states = () => Array.from(container.querySelectorAll('[data-crystal]')).map((c) => c.getAttribute('data-crystal'))

    expect(states()).toEqual(['active', 'todo'])
    await screen.findByText(/开头的声母/)
    answerTarget('p')
    await screen.findByText('g') // 已自动推进到第 2 题
    expect(states()).toEqual(['done', 'active'])
  })
})
