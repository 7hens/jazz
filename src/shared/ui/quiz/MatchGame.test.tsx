import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { BaseOption } from '@/shared/services'
import { MatchGame } from './MatchGame'

const left: BaseOption[] = [
  { id: 'l1', text: '太阳', speak: '太阳' },
  { id: 'l2', text: '月亮', speak: '月亮' },
]
const right: BaseOption[] = [
  { id: 'r1', emoji: '☀️', text: '☀️', speak: '太阳' },
  { id: 'r2', emoji: '🌙', text: '🌙', speak: '月亮' },
]

describe('MatchGame 点读语义(纯选择才读,配对/取消不读)', () => {
  afterEach(cleanup)

  it('题卡左上角渲染「连连看」题型徽章', () => {
    render(
      <MatchGame
        prompt="配对"
        left={left}
        right={right}
        answerMap={{ l1: 'r1', l2: 'r2' }}
        skill="hanzi"
        playSound={vi.fn()}
        speak={() => true}
        onComplete={vi.fn()}
      />,
    )
    expect(screen.getByText('连连看')).toBeTruthy()
  })

  it('选中读一次、取消选择不读、再选再读', () => {
    const speak = vi.fn(() => true)
    const onComplete = vi.fn()
    render(
      <MatchGame
        prompt="配对"
        left={left}
        right={right}
        answerMap={{ l1: 'r1', l2: 'r2' }}
        skill="hanzi"
        playSound={vi.fn()}
        speak={speak}
        onComplete={onComplete}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '太阳' }))
    expect(speak).toHaveBeenCalledTimes(1)
    expect(speak).toHaveBeenLastCalledWith('太阳', 'zh-CN')
    fireEvent.click(screen.getByRole('button', { name: '太阳' })) // 取消选择
    expect(speak).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: '太阳' })) // 重新选中
    expect(speak).toHaveBeenCalledTimes(2)
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('配对判合不朗读;整组对 → onComplete(left id)', () => {
    const speak = vi.fn(() => true)
    const onComplete = vi.fn()
    render(
      <MatchGame
        prompt="配对"
        left={[{ id: 'l1', text: '太阳', speak: '太阳' }]}
        right={[{ id: 'r1', emoji: '☀️', text: '☀️', speak: '太阳' }]}
        answerMap={{ l1: 'r1' }}
        skill="hanzi"
        playSound={vi.fn()}
        speak={speak}
        onComplete={onComplete}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '太阳' }))
    expect(speak).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: '☀️' })) // 判合,不读
    expect(speak).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith('l1')
  })

  it('错配不朗读,出 wrong 音', () => {
    const speak = vi.fn(() => true)
    const playSound = vi.fn()
    render(
      <MatchGame
        prompt="配对"
        left={left}
        right={right}
        answerMap={{ l1: 'r1', l2: 'r2' }}
        skill="hanzi"
        playSound={playSound}
        speak={speak}
        onComplete={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '太阳' }))
    expect(speak).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: '🌙' })) // 错配判合,不读
    expect(speak).toHaveBeenCalledTimes(1)
    expect(playSound).toHaveBeenCalledWith('wrong')
  })

  it('配错态挂 ✗ 形状冗余(data-state 可测)', () => {
    render(
      <MatchGame
        prompt="配对"
        left={left}
        right={right}
        answerMap={{ l1: 'r1', l2: 'r2' }}
        skill="hanzi"
        playSound={vi.fn()}
        speak={() => true}
        onComplete={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '太阳' })) // l1
    fireEvent.click(screen.getByRole('button', { name: '🌙' })) // r2 → 与 l1 不配对
    expect(screen.getByRole('button', { name: '太阳' })).toHaveAttribute('data-state', 'wrong')
    expect(screen.getByRole('button', { name: '太阳' })).toHaveTextContent('✗')
  })

  it('炼金:配对成功后左块变金石(含两侧内容),右位留空凹槽', () => {
    const { container } = render(
      <MatchGame
        prompt="配对"
        left={[{ id: 'l1', emoji: '🍎', text: '苹果', speak: '苹果' }]}
        right={[{ id: 'r1', text: 'píng guǒ', speak: '苹果' }]}
        answerMap={{ l1: 'r1' }}
        skill="hanzi"
        playSound={vi.fn()}
        speak={() => true}
        onComplete={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '苹果' }))
    fireEvent.click(screen.getByRole('button', { name: 'píng guǒ' }))

    const gold = container.querySelector('[data-state="gold"]')
    expect(gold).not.toBeNull()
    expect(gold).toHaveTextContent('苹果')
    expect(gold).toHaveTextContent('píng guǒ')
    expect(gold).toHaveTextContent('⭐')

    const slot = container.querySelector('[data-state="slot"]')
    expect(slot).not.toBeNull()
    expect(slot!.textContent).toBe('')
  })

  it('爆点:配对瞬间渲染冲击波与拟声词,且均为 aria-hidden 装饰', async () => {
    const { container } = render(
      <MatchGame
        prompt="配对"
        left={[{ id: 'l1', text: '苹果', speak: '苹果' }]}
        right={[{ id: 'r1', text: 'píng guǒ', speak: '苹果' }]}
        answerMap={{ l1: 'r1' }}
        skill="hanzi"
        playSound={vi.fn()}
        speak={() => true}
        onComplete={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '苹果' }))
    fireEvent.click(screen.getByRole('button', { name: 'píng guǒ' }))

    const layer = container.querySelector('[data-match-burst]')
    expect(layer).not.toBeNull()
    expect(layer).toHaveAttribute('aria-hidden', 'true')
    expect(layer).toHaveTextContent('啪!')

    await waitFor(() => expect(container.querySelector('[data-match-burst]')).toBeNull(), { timeout: 2000 })
  })

  it('对撞:配对的两块各挂一侧 pop 类,爆点结束后一起摘掉', async () => {
    const { container } = render(
      <MatchGame
        prompt="配对"
        left={[{ id: 'l1', text: '苹果', speak: '苹果' }]}
        right={[{ id: 'r1', text: 'píng guǒ', speak: '苹果' }]}
        answerMap={{ l1: 'r1' }}
        skill="hanzi"
        playSound={vi.fn()}
        speak={() => true}
        onComplete={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '苹果' }))
    fireEvent.click(screen.getByRole('button', { name: 'píng guǒ' }))

    // 名字必须具体到「哪一侧」:两侧写反(或都写 l)在肉眼之外无法发现。
    expect(container.querySelector('[data-state="gold"]')).toHaveClass('stone--pop-l')
    expect(container.querySelector('[data-state="slot"]')).toHaveClass('stone--pop-r')

    await waitFor(() => expect(container.querySelector('[data-match-burst]')).toBeNull(), { timeout: 2000 })
    expect(container.querySelector('[data-state="gold"]')).not.toHaveClass('stone--pop-l')
    expect(container.querySelector('[data-state="slot"]')).not.toHaveClass('stone--pop-r')
  })

  it('爆点与错配可叠加:爆点存活期间错配,爆点仍按时清空(两 timer ref 不得合并)', async () => {
    const { container } = render(
      <MatchGame
        prompt="配对"
        left={[
          { id: 'l1', text: '苹果', speak: '苹果' },
          { id: 'l2', text: '月亮', speak: '月亮' },
        ]}
        right={[
          { id: 'r1', text: 'píng guǒ', speak: '苹果' },
          { id: 'r2', text: 'yuè liàng', speak: '月亮' },
          { id: 'r3', text: 'shān', speak: '山' },
        ]}
        answerMap={{ l1: 'r1', l2: 'r2' }}
        skill="hanzi"
        playSound={vi.fn()}
        speak={() => true}
        onComplete={vi.fn()}
      />,
    )
    // 先炼成一对 → 爆点存活
    fireEvent.click(screen.getByRole('button', { name: '苹果' }))
    fireEvent.click(screen.getByRole('button', { name: 'píng guǒ' }))
    expect(container.querySelector('[data-match-burst]')).not.toBeNull()

    // 爆点不锁输入:存活期间立刻错配一次(共用 timerRef 时,这一句会 clearTimeout 掉爆点的计时器)
    fireEvent.click(screen.getByRole('button', { name: '月亮' }))
    fireEvent.click(screen.getByRole('button', { name: 'shān' }))
    expect(container.querySelector('[data-state="wrong"]')).not.toBeNull()

    await waitFor(() => expect(container.querySelector('[data-match-burst]')).toBeNull(), { timeout: 2000 })
  })
})

// 材质类失守时 npm test 与 npm run lint 都不会红(只有人眼能发现)—— stone.test.ts:57 的同一教训。
// 这里钉的是「.quiz-pop 只能用独立属性定位」:它挂在 motion.span 上、motion 会往行内 style 写
// transform,行内永远赢 —— 类里再写 transform 就是死代码(居中与 -8° 倾斜静默失效,「啪!」右偏下偏)。
// 同文件 .quiz-ring 用 margin 居中、.stone--pop-* 用独立 translate/scale,都是绕开这个坑的先例。
const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')

describe('index.css .quiz-pop 定位不吃 transform', () => {
  it('用独立 translate/rotate,不写 transform(会被 motion 的行内 transform 整个吞掉)', () => {
    // 锚点先断言再切片 —— 否则 indexOf 返回 -1 时 slice(-1) 只取末字符,断言静默空转(stone.test.ts:78 的坑)。
    const anchor = '.quiz-pop {'
    expect(css).toContain(anchor)
    const start = css.indexOf(anchor)
    const rule = css.slice(start, css.indexOf('}', start))
    // 先断言「没有 transform」:它才是这条护栏要抓的缺陷(写在这里的任何 transform 都是死代码),
    // 失败消息才会直指病根,而不是被「缺 translate」抢先。用正则而非字面量,连 `transform :` 这种
    // 带空格的写法也拦(该写法同样覆盖整条 transform 属性;`transform-origin:` 之类中间隔着 `-`,不会误伤)。
    expect(rule).not.toMatch(/transform\s*:/)
    // 两个独立属性各钉一条:只钉 translate 的话,`rotate: -8deg;` 被单独删掉会静默全绿
    // —— 那正是这条护栏要防的「视觉定位悄悄失效」。
    expect(rule).toContain('rotate: -8deg')
    expect(rule).toContain('translate:')
  })
})
