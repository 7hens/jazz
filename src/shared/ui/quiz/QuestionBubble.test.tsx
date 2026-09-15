import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DEFAULT_ASKER, QuestionBubble } from './QuestionBubble'

describe('QuestionBubble 题面气泡', () => {
  afterEach(cleanup)

  it('渲染题干与默认出题者署名', () => {
    render(<QuestionBubble prompt="这个字读什么?" />)
    expect(screen.getByText('这个字读什么?')).toBeTruthy()
    expect(screen.getByText(DEFAULT_ASKER)).toBeTruthy()
  })

  it('asker 传空串则不渲染署名行', () => {
    render(<QuestionBubble prompt="这个字读什么?" asker="" />)
    expect(screen.queryByText(DEFAULT_ASKER)).toBeNull()
  })

  it('无 onReplay 时题干不是按钮(否则会污染 a11y 树)', () => {
    render(<QuestionBubble prompt="这个字读什么?" />)
    expect(screen.queryByRole('button', { name: '再听一遍' })).toBeNull()
  })

  it('有 onReplay 时整块为「再听一遍」重听区,点击回调', () => {
    const onReplay = vi.fn()
    render(<QuestionBubble prompt="这个字读什么?" onReplay={onReplay} />)
    fireEvent.click(screen.getByRole('button', { name: '再听一遍' }))
    expect(onReplay).toHaveBeenCalledTimes(1)
  })

  it('emoji 为装饰:不贡献 accessible name', () => {
    render(<QuestionBubble prompt="太阳" emoji="☀️" onReplay={() => {}} />)
    expect(screen.getByRole('button', { name: '再听一遍' })).toBeTruthy()
  })
})
