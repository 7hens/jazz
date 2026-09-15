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
    // 数据形状照抄引擎:左列 text(无 emoji)、右列 emoji(text 恒空串)。
    // 旧版这里给右列喂了 text 顶替图,掩盖了「右列 text 恒空」这一真实形状 ——
    // 金石第二行由此读空,见下方图卡组的专项护栏。
    const { container } = render(
      <MatchGame
        prompt="配对"
        left={[{ id: 'l1', text: '苹果', speak: '苹果' }]}
        right={[{ id: 'r1', text: '', emoji: '🍎' }]}
        answerMap={{ l1: 'r1' }}
        skill="hanzi"
        playSound={vi.fn()}
        speak={() => true}
        onComplete={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '苹果' }))
    // 图卡无可读名(图 aria-hidden、text 空)→ 只能按位置点。
    fireEvent.click(container.querySelectorAll('[data-state]')[1])

    const gold = container.querySelector('[data-state="gold"]')
    expect(gold).not.toBeNull()
    expect(gold).toHaveTextContent('苹果')
    expect(gold).toHaveTextContent('🍎')
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

  // 引擎两种选项的真实形状(engine.ts 的 textOption / emojiOption):
  //   左列 = { id, text, speak },**没有 emoji 字段**;右列 = { id, text: '', emoji } —— text 恒空串。
  // 上面各组用例手写 right.text = emoji 顶替,恰好绕过了这个差异 —— 真机上右列因此全空白。
  // 下面的用例一律照抄真实形状;锚点:把 MatchGame 的 emoji 判回左列(`isLeft ? o.emoji : undefined`)
  // 或让 goldSub 读 `?.text`,两者任一都会红。
  const engineLeft: BaseOption[] = [
    { id: 'l1', text: 'clock', speak: 'clock' },
    { id: 'l2', text: 'sun', speak: 'sun' },
  ]
  const engineRight: BaseOption[] = [
    { id: 'r1', text: '', emoji: '🕐' },
    { id: 'r2', text: '', emoji: '☀️' },
  ]

  function renderEngineShaped(l = engineLeft, r = engineRight) {
    return render(
      <MatchGame
        prompt="配对"
        left={l}
        right={r}
        answerMap={{ l1: 'r1', l2: 'r2' }}
        skill="english"
        playSound={vi.fn()}
        speak={() => true}
        onComplete={vi.fn()}
      />,
    )
  }

  it('右列每一张卡都渲染出它自己的图(emoji)', () => {
    const { container } = renderEngineShaped()
    // Stone 的 [data-halo] 只在收到 emoji prop 时渲染 —— 个数 =「拿到图的卡数」。
    const halos = container.querySelectorAll('[data-halo]')
    expect(halos).toHaveLength(engineRight.length)
    expect(Array.from(halos).map((h) => h.textContent)).toEqual(engineRight.map((r) => r.emoji))
  })

  it('左列是文字卡:不出图,出自己的字', () => {
    const { container } = renderEngineShaped()
    // 左列先渲染(列内 DOM 顺序 = left 数组顺序)。
    const leftCards = Array.from(container.querySelectorAll('[data-state]')).slice(0, engineLeft.length)
    expect(leftCards).toHaveLength(engineLeft.length)
    leftCards.forEach((card, i) => {
      expect(card.querySelector('[data-halo]')).toBeNull()
      expect(card).toHaveTextContent(engineLeft[i].text)
    })
  })

  it('配对后金石两行:第一行左词,第二行是它配上那张图', () => {
    const { container } = renderEngineShaped(
      [{ id: 'l1', text: 'clock', speak: 'clock' }],
      [{ id: 'r1', text: '', emoji: '🕐' }],
    )
    const cards = Array.from(container.querySelectorAll('[data-state]'))
    fireEvent.click(cards[0]) // 左卡
    fireEvent.click(cards[1]) // 右卡 → 判合

    const gold = container.querySelector('[data-state="gold"]')
    expect(gold).not.toBeNull()
    expect(gold).toHaveTextContent('clock')
    const sub = gold!.querySelector('.stone-sub')
    expect(sub).not.toBeNull()
    expect(sub!.textContent).toBe('🕐')
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
