import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StageCast, StageSky } from './stage'

describe('StageSky', () => {
  it('按 atmosphere 出 class;词 emoji 随 restored 档位点亮', () => {
    const { container } = render(
      <StageSky
        atmosphere="dawn"
        words={[
          { id: 1, emoji: '☀️' },
          { id: 2, emoji: '⭐' },
        ]}
        restored={[{ wordId: 1 }, { wordId: 1 }]}
      />,
    )
    expect(container.querySelector('.stage-sky--dawn')).not.toBeNull()
    const [sun, star] = Array.from(container.querySelectorAll('.stage-word'))
    expect(sun!.className).toContain('opacity-100')
    expect(star!.className).toContain('grayscale')
  })
})

describe('StageCast', () => {
  it('按 cast 站队出名字牌;说者高亮 accent,听者灰', () => {
    const { container } = render(
      <StageCast cast={['lingling', 'sun']} speaker="sun" />,
    )
    const names = Array.from(container.querySelectorAll('span')).map((n) => n.textContent)
    expect(names).toContain('灵灵')
    expect(names).toContain('太阳')
    // sun 说者高亮 class(accent),灵灵听者灰
    const badges = container.querySelectorAll('span')
    const speakerTag = Array.from(badges).find((b) => b.textContent === '太阳')!
    const listenerTag = Array.from(badges).find((b) => b.textContent === '灵灵')!
    expect(speakerTag.className).toContain('bg-accent')
    expect(listenerTag.className).toContain('bg-ink/60')
  })

  it('bubble 仅渲染在当前说话者上方', () => {
    const { container } = render(
      <StageCast cast={['lingling', 'sun']} speaker="sun" bubble={<span>救救我</span>} />,
    )
    expect(screen.getByText('救救我')).toBeInTheDocument()
    // 气泡数量 = 1(只在说话者列)
    expect(container.querySelectorAll('[data-stage-bubble]').length).toBe(1)
  })
})
