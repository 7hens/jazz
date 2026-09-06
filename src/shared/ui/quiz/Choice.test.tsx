import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { BaseOption } from '@/shared/services'
import { Choice, type ChoiceProps } from './Choice'

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

describe('Choice 确认制(点听 · 确定提交)', () => {
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

  it('未选中「确定」禁用;点卡先念(缺 speak 读文本)再放开', () => {
    renderChoice()
    expect(screen.getByRole('button', { name: '确定' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'A' }))
    expect(speak).toHaveBeenCalledWith('A', 'zh-CN')
    expect(screen.getByRole('button', { name: '确定' })).not.toBeDisabled()
  })

  it('「确定」才提交;提交后清空选中,须重选再答', () => {
    renderChoice()
    fireEvent.click(screen.getByRole('button', { name: 'A' }))
    fireEvent.click(screen.getByRole('button', { name: '确定' }))
    expect(onAnswer).toHaveBeenCalledWith('a')
    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: '确定' })).toBeDisabled() // 已清空
  })

  it('点另一卡改选;提交的是当前选中', () => {
    renderChoice()
    fireEvent.click(screen.getByRole('button', { name: 'A' }))
    fireEvent.click(screen.getByRole('button', { name: 'B' }))
    fireEvent.click(screen.getByRole('button', { name: '确定' }))
    expect(onAnswer).toHaveBeenCalledWith('b')
    expect(onAnswer).toHaveBeenCalledTimes(1)
  })

  it('重复点已选卡:重念 + 保持选中', () => {
    renderChoice()
    fireEvent.click(screen.getByRole('button', { name: 'A' }))
    fireEvent.click(screen.getByRole('button', { name: 'A' }))
    expect(speak).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('button', { name: '确定' }))
    expect(onAnswer).toHaveBeenCalledWith('a')
  })

  it('promptSpeak:题干整块为「再听一遍」重听区(纯 choice 无独立喇叭)', () => {
    renderChoice({ promptSpeak: 'xiao ming' })
    fireEvent.click(screen.getByRole('button', { name: '再听一遍' }))
    expect(speak).toHaveBeenCalledWith('xiao ming', 'zh-CN')
    expect(screen.queryByRole('button', { name: '朗读题目' })).toBeNull()
  })

  it('disabled:不渲染「确定」,选项禁用', () => {
    renderChoice({ disabled: true })
    expect(screen.queryByRole('button', { name: '确定' })).toBeNull()
    expect(screen.getByRole('button', { name: 'A' })).toHaveAttribute('aria-disabled', 'true')
  })
})
