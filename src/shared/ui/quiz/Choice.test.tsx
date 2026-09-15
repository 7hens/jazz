import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { BaseOption } from '@/shared/services'
import { Choice, type ChoiceProps } from './Choice'
import { CAST_LABEL } from './CastButton'

const options: BaseOption[] = [
  { id: 'a', text: 'A' },
  { id: 'b', text: 'B' },
]
const speak = vi.fn(() => true)
const onAnswer = vi.fn()

function renderChoice(over: Partial<ChoiceProps> = {}) {
  const base: ChoiceProps = { prompt: '选出正确的一个', skill: 'pinyin', options, speak, onAnswer, ...over }
  return render(<Choice {...base} />)
}

describe('Choice 确认制(点听 · 施法钮提交)', () => {
  beforeEach(() => { speak.mockClear(); onAnswer.mockClear() })
  afterEach(cleanup)

  it('题卡左上角渲染「选一选」题型徽章', () => {
    renderChoice()
    expect(screen.getByText('选一选')).toBeTruthy()
  })

  it('showBadge=false(内嵌复用)不渲染徽章', () => {
    renderChoice({ showBadge: false })
    expect(screen.queryByText('选一选')).toBeNull()
  })

  it('未选中「就它了!」禁用;点卡先念(缺 speak 读文本)再放开', () => {
    renderChoice()
    expect(screen.getByRole('button', { name: CAST_LABEL })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'A' }))
    expect(speak).toHaveBeenCalledWith('A', 'zh-CN')
    expect(screen.getByRole('button', { name: CAST_LABEL })).not.toBeDisabled()
  })

  it('「就它了!」才提交;提交后清空选中,须重选再答', () => {
    renderChoice()
    fireEvent.click(screen.getByRole('button', { name: 'A' }))
    fireEvent.click(screen.getByRole('button', { name: CAST_LABEL }))
    expect(onAnswer).toHaveBeenCalledWith('a')
    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: CAST_LABEL })).toBeDisabled() // 已清空
  })

  it('点另一卡改选;提交的是当前选中', () => {
    renderChoice()
    fireEvent.click(screen.getByRole('button', { name: 'A' }))
    fireEvent.click(screen.getByRole('button', { name: 'B' }))
    fireEvent.click(screen.getByRole('button', { name: CAST_LABEL }))
    expect(onAnswer).toHaveBeenCalledWith('b')
    expect(onAnswer).toHaveBeenCalledTimes(1)
  })

  it('重复点已选卡:重念 + 保持选中', () => {
    renderChoice()
    fireEvent.click(screen.getByRole('button', { name: 'A' }))
    fireEvent.click(screen.getByRole('button', { name: 'A' }))
    expect(speak).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('button', { name: CAST_LABEL }))
    expect(onAnswer).toHaveBeenCalledWith('a')
  })

  it('promptSpeak:题干整块为「再听一遍」重听区(纯 choice 无独立喇叭)', () => {
    renderChoice({ promptSpeak: 'xiao ming' })
    fireEvent.click(screen.getByRole('button', { name: '再听一遍' }))
    expect(speak).toHaveBeenCalledWith('xiao ming', 'zh-CN')
    expect(screen.queryByRole('button', { name: '朗读题目' })).toBeNull()
  })

  it('disabled:不渲染「就它了!」,选项禁用', () => {
    renderChoice({ disabled: true })
    expect(screen.queryByRole('button', { name: CAST_LABEL })).toBeNull()
    expect(screen.getByRole('button', { name: 'A' })).toHaveAttribute('aria-disabled', 'true')
  })

  it('对错带形状冗余角标(data-state 可测,色彩冗余的可测化)', () => {
    const { rerender } = renderChoice()
    fireEvent.click(screen.getByRole('button', { name: 'A' }))
    fireEvent.click(screen.getByRole('button', { name: CAST_LABEL }))
    rerender(<Choice prompt="选出正确的一个" skill="pinyin" options={options} speak={speak} onAnswer={onAnswer} correctId="a" />)
    expect(screen.getByRole('button', { name: 'A' })).toHaveAttribute('data-state', 'correct')
    expect(screen.getByRole('button', { name: 'A' })).toHaveTextContent('✓')
  })

  it('答错态挂 ✗ 冗余且不靠透明度压暗', () => {
    renderChoice({ wrongId: 'a' })
    const btn = screen.getByRole('button', { name: 'A' })
    expect(btn).toHaveAttribute('data-state', 'wrong')
    expect(btn).toHaveTextContent('✗')
    expect(btn.className).not.toMatch(/\bopacity-/)
  })

  it('答对迸星 + 光柱,且装饰不改变 accessible name', () => {
    const { container } = renderChoice({ correctId: 'a' })
    expect(container.querySelector('[data-spark-burst]')).not.toBeNull()
    expect(container.querySelector('.quiz-beam')).not.toBeNull()
    // 装饰不进 accessible name:getByRole 的字符串 name 是**整串精确匹配**,
    // 迸星/光柱一旦漏进名字(如 SparkBurst 根节点丢了 aria-hidden)这一行即抛 —— 抛出即断言。
    screen.getByRole('button', { name: 'A' })
  })

  it('两次答错后揭晓答案:绿底 + ✓ 保留,但不迸星、不上光柱(庆祝 ≠ 正确答案在此)', () => {
    // revealId 只在「两次均错 → 揭晓」路径上设置(WordLesson.tsx:202 / scene-ui.tsx:100),
    // 与 correctId(用户真答对)互斥;此处 disabled=true 与两个生产点的
    // `disabled: phase !== 'answering'` 一致。阳性对照是上面「答对迸星 + 光柱」用例:
    // 同一块词石、同一套装饰,只有 correctId 时迸星、只有 revealId 时不迸 —— 两条合起来
    // 才说明 juice 认的是「答对」而非「绿色」。本用例前两行是空转防线:少了它们,
    // 「揭晓态压根没生效」的实现照样绿。
    const { container } = renderChoice({ revealId: 'a', disabled: true })
    const stone = screen.getByRole('button', { name: 'A' })
    expect(stone).toHaveAttribute('data-state', 'correct')
    expect(stone).toHaveTextContent('✓')
    expect(container.querySelector('[data-spark-burst]')).toBeNull()
    expect(container.querySelector('.quiz-beam')).toBeNull()
  })

  it('quiet 为真时不迸星、不上光柱(听一听 / 短教分档)', () => {
    const { container } = renderChoice({ correctId: 'a', quiet: true })
    expect(container.querySelector('[data-spark-burst]')).toBeNull()
    expect(container.querySelector('.quiz-beam')).toBeNull()
    expect(screen.getByRole('button', { name: 'A' })).toHaveTextContent('✓') // 形状冗余不受影响
  })
})
