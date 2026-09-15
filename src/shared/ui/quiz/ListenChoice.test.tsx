import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { BaseOption } from '@/shared/services'
import { ListenChoice, type ListenChoiceProps } from './ListenChoice'
import { CAST_LABEL } from './CastButton'

const options: BaseOption[] = [
  { id: 'a', text: 'A' },
  { id: 'b', text: 'B' },
]
const speak = vi.fn(() => true)
const onAnswer = vi.fn()

function renderListen(over: Partial<ListenChoiceProps> = {}) {
  const base: ListenChoiceProps = {
    prompt: '听一听,选出你听到的',
    promptSpeak: 'xiao ming',
    skill: 'english',
    options,
    speak,
    onAnswer,
    ...over,
  }
  return render(<ListenChoice {...base} />)
}

describe('ListenChoice(自动读 · 标题行喇叭重听 · 透传 Choice 确认制)', () => {
  beforeEach(() => { speak.mockClear(); onAnswer.mockClear() })
  afterEach(cleanup)

  it('进题自动朗读 promptSpeak 一次;左上角渲染「听一听」徽章且内嵌 Choice 不重复徽章', () => {
    renderListen()
    expect(speak).toHaveBeenCalledTimes(1)
    expect(speak).toHaveBeenCalledWith('xiao ming', 'en-US')
    expect(screen.getByText('听一听')).toBeTruthy()
    expect(screen.queryAllByText('听一听')).toHaveLength(1)
    expect(screen.queryByText('选一选')).toBeNull()
  })

  it('标题行喇叭点击重读', () => {
    renderListen()
    expect(speak).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: '再听一遍' }))
    expect(speak).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('button', { name: '朗读题目' })).toBeNull()
  })

  it('点选项即念 + 「就它了!」透传提交;选项朗读语言随 skill', () => {
    renderListen()
    fireEvent.click(screen.getByRole('button', { name: 'A' }))
    expect(speak).toHaveBeenLastCalledWith('A', 'en-US')
    fireEvent.click(screen.getByRole('button', { name: CAST_LABEL }))
    expect(onAnswer).toHaveBeenCalledWith('a')
  })

  it('D9:听一听不迸星、不上光柱(通路是耳朵,不抢注意力)', () => {
    // ✓ 那一行是**阳性对照**:它证明这题确实走到了答对态(correctId 真透传进了 Choice)。
    // 少了它,这条用例在「答对态压根没生效」的实现下照样绿 —— 那时两条 toBeNull 对 quiet
    // 一言未发,只是恰好没东西可渲染。而 Choice「答对迸星 + 光柱」用例是同一个
    // [data-spark-burst] 选择器的阳性对照(该渲染时必须找得到),两条合起来才排掉
    // 「选择器写错」这类假绿。
    const { container } = renderListen({ correctId: 'a' })
    expect(container.querySelector('[data-spark-burst]')).toBeNull()
    expect(container.querySelector('.quiz-beam')).toBeNull()
    expect(screen.getByRole('button', { name: 'A' })).toHaveTextContent('✓')
  })
})
