import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BlockChip } from './BlockChip'

const chip = (props: Parameters<typeof BlockChip>[0]) => render(<BlockChip {...props} />).container.firstElementChild

describe('BlockChip 的两点飞走', () => {
  // 触发时块面渲染的是**去点后**的字形(u / ue),两点叠在上面飞走 —— 孩子看到的就是「j 把两点带走了」。
  it('dotsAway 时块面写去点后的字形,并挂上会飞走的两点', () => {
    const el = chip({ type: 'final', value: 'ü', dotsAway: true })
    expect(el?.textContent).toBe('u')
    expect(el?.querySelector('.pb-dot'), '两点没了就没得飞').not.toBeNull()
  })

  it('dotsAway 时 üe 只去第一点的两点', () => {
    const el = chip({ type: 'final', value: 'üe', dotsAway: true })
    expect(el?.textContent).toBe('ue')
  })

  // 不去点的关(nǚ / lǜ)与「两点飞走」无关 —— 判据在调用方,这里只保证不误伤。
  it('不带 dotsAway 时原样显示 ü,也没有两点元素', () => {
    const el = chip({ type: 'final', value: 'ü' })
    expect(el?.textContent).toBe('ü')
    expect(el?.querySelector('.pb-dot')).toBeNull()
  })

  // 块面尺寸由调用方给的 className 定死(h-[4.5rem] w-[4.5rem] 之类),不随字形内容变。
  it('去点前后字号类一致,块面不因换字跳动', () => {
    const before = chip({ type: 'final', value: 'ü' })
    const after = chip({ type: 'final', value: 'ü', dotsAway: true })
    expect(after?.className).toBe(before?.className)
  })
})
