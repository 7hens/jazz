import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { BaseOption } from '@/shared/services'
import { ListenChoice, type ListenChoiceProps } from './ListenChoice'

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

  it('点选项即念 + 「确定」透传提交;选项朗读语言随 skill', () => {
    renderListen()
    fireEvent.click(screen.getByRole('button', { name: 'A' }))
    expect(speak).toHaveBeenLastCalledWith('A', 'en-US')
    fireEvent.click(screen.getByRole('button', { name: '确定' }))
    expect(onAnswer).toHaveBeenCalledWith('a')
  })
})
