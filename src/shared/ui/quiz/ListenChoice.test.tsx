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

describe('ListenChoice(自动读 · 整块重听 · 透传 Choice 确认制)', () => {
  beforeEach(() => { speak.mockClear(); onAnswer.mockClear() })
  afterEach(cleanup)

  it('进题自动朗读 promptSpeak 一次', () => {
    renderListen()
    expect(speak).toHaveBeenCalledTimes(1)
    expect(speak).toHaveBeenCalledWith('xiao ming', 'en-US')
  })

  it('顶部整块重听区点击重读(无喇叭图标)', () => {
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

  it('requireVisitAll 透传:点齐才可确认', () => {
    renderListen({ requireVisitAll: true })
    expect(screen.getByRole('button', { name: '确定' })).toBeDisabled()
    expect(screen.getByText('把每个都点一点、听一听,再选答案')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'A' }))
    fireEvent.click(screen.getByRole('button', { name: 'B' }))
    expect(screen.getByRole('button', { name: '确定' })).not.toBeDisabled()
  })
})
