import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { UNITS } from './levels'
import { canPlace, slotsFor, type Slot } from './rules'
import { SPEAK_OF, type Block, type BlockType } from './blocks'
import { reviewQuestions, type ReviewQuestion } from './mistakes'
import type { AnswerKind } from '@/shared/services'
import { HAN_TEXT } from '@/shared/testing/han-text'
import { PinyinBlocksGame, type PinyinBlocksGameProps } from './PinyinBlocksGame'

/** 游戏组件只吃 props,不碰服务注册表 —— 测试直接渲染,无需 fake service。 */
function mount(unit: number, level: number, onAdvance = vi.fn()) {
  const speak = vi.fn()
  const utils = render(<PinyinBlocksGame unitIndex={unit} levelIndex={level} speak={speak} onAdvance={onAdvance} />)
  return { ...utils, speak, onAdvance }
}

function mountWithSolved(
  unit: number,
  level: number,
  onSolved: (stars: number) => void,
  onBlock?: (kind: AnswerKind) => void,
) {
  const speak = vi.fn()
  const utils = render(
    <PinyinBlocksGame unitIndex={unit} levelIndex={level} speak={speak} onSolved={onSolved} onBlock={onBlock} />,
  )
  return { ...utils, speak }
}

/** 通关回调是在成功动画**放完之后**才发的(260ms 判定 + 1600ms 停顿),得把时钟推过去。 */
function settle() {
  act(() => vi.advanceTimersByTime(3000))
}

/** 按存档键取 [单元下标, 关下标] —— 关卡搬家 / 重排后,测试不再靠「第几个」静默指错题。 */
function at(levelId: string): [unit: number, level: number] {
  const unit = UNITS.findIndex((u) => u.levels.some((level) => level.id === levelId))
  if (unit < 0) throw new Error(`没有这一关:${levelId}`)
  const level = UNITS[unit]!.levels.findIndex((l) => l.id === levelId)
  return [unit, level]
}

/** 按单元 id 取下标 —— 提示档那几条钉的是某个单元,不是「第几格」。 */
function unitIdx(id: string): number {
  const index = UNITS.findIndex((u) => u.id === id)
  if (index < 0) throw new Error(`没有这一单元:${id}`)
  return index
}

/**
 * 读一块托盘积木的身份 —— 类型与值印在里层的 .pblock 上。
 *
 * 读不出就把 DOM 原样报出来**当场炸**:块类不是从 DOM 猜的,而是拿来当 oracle 喂给 canPlace 的,
 * 一个读错的 data-type 会让「这关无解」的假象出现在断言里,而不是出现在病因里。
 * 白名单用 SPEAK_OF 的键 —— 它按 BlockType 穷举(编译器管着不漏键),不另抄一份联合类型。
 */
function blockOf(el: HTMLElement): Block {
  const chip = el.querySelector<HTMLElement>('[data-value]')
  const type = chip?.dataset.type as BlockType | undefined
  const value = chip?.dataset.value
  if (!type || !(type in SPEAK_OF) || value === undefined) {
    throw new Error(`托盘块读不出身份:${chip?.outerHTML ?? '(没有块)'}`)
  }
  return { type, value }
}

/** 托盘里还没入槽的块。 */
function trayBlocks(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-block-id]')).filter(
    (el) => el.closest('[data-slot-id]') === null,
  )
}

/**
 * 按题目要求把正确块一个个点进去(点选路径 = 自动落位),**一次不错**。
 *
 * 只点「放得下」的那一块 —— 乱点放不下的块会自己制造错误次数(点错也算错),
 * 星级就永远只有一个值,星级测试也就无从谈起。
 */
function solveCorrectly(unit: number, level: number) {
  for (const slot of slotsFor(UNITS[unit]!.levels[level]!)) {
    const fits = trayBlocks().filter((el) => canPlace(blockOf(el), slot))
    // 优先类型完全相同的块:双身份块(i/u/ü)可能被前一个槽用掉
    const pick = fits.find((el) => blockOf(el).type === slot.type) ?? fits[0]
    expect(pick, `${slot.type}:${slot.value} 在托盘里找不到可放块`).toBeDefined()
    fireEvent.keyDown(pick as HTMLElement, { key: 'Enter' })
  }
}

describe('拼音积木 · 游戏', () => {
  // jsdom 根本没实现 document.elementFromPoint(真实浏览器都有),拖拽回调会调它。
  // 不装桩就是一条会抛环境错误的绿测试 —— 那种绿比红更糟。
  beforeAll(() => {
    Object.defineProperty(document, 'elementFromPoint', { value: () => null, configurable: true })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    // 幽灵块被 appendChild 到 document.body、不在 React 树里 —— cleanup() 清不掉它。
    // 上一条用例若漏拆,残块会污染下一条的计数:漏拆只该让**漏拆的那条**红,
    // 不该让后面每条都跟着红(那会把「红在哪」搅成噪声)。
    document.querySelectorAll('.pblock--dragging').forEach((el) => el.remove())
  })

  it('渲染题面图与拼装台,作答期间不出现汉字', () => {
    const { container } = mount(1, 1) // 🐴 mǎ
    expect(screen.getByText('🐴')).toBeInTheDocument()
    expect(screen.getByLabelText('拼装台')).toBeInTheDocument()
    // 零文本:汉字只在拼对之后作为答案出现,作答期间游戏区只有字母与声调走势线
    const gameArea = container.querySelector('[data-game-area]')
    expect(gameArea, '缺少 data-game-area 游戏区锚点').not.toBeNull()
    expect(gameArea?.textContent ?? '').not.toMatch(HAN_TEXT)
  })

  it('拼对后同时亮出拼音与对应汉字(认读要扣到字上)', async () => {
    mount(1, 1) // 🐴 mǎ
    solveCorrectly(1, 1)
    expect(await screen.findByText('mǎ')).toBeInTheDocument()
    expect(screen.getByText('马')).toBeInTheDocument()
  })

  // 零汉字在**关卡页**是假的 —— 答案行那个同音汉字是教学内容,故意留的(设计 §2)。
  // 所以这里断的不是「零」,而是「唯一 + 等值」:多出来一个汉字就红。
  it('拼对后,直接文本含汉字的元素恰好一个 —— 就是答案行的同音汉字', async () => {
    const { container } = mount(1, 1) // 🐴 mǎ
    solveCorrectly(1, 1)
    expect(await screen.findByText('mǎ')).toBeInTheDocument()

    // 「直接文本」= 该元素**自身的文本子节点**,不含后代 —— 否则整棵树的根节点永远"含汉字",
    // 断言就退化成「页面里有汉字」,等于没写。答案行今天是两个并列 span(拼音 / 汉字),只有后者命中。
    const carriers = [...container.querySelectorAll<HTMLElement>('*')].filter((el) =>
      [...el.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && HAN_TEXT.test(node.textContent ?? '')),
    )
    expect(carriers.map((el) => el.textContent)).toEqual([UNITS[1]!.levels[1]!.read])
    expect(carriers[0]?.hasAttribute('data-answer-read'), '命中汉字的那个元素不是答案行').toBe(true)
  })

  /** 点「介母 u」进介母槽,返回落位的那块 —— 题目(guā)里 u 唯一,不必猜顺序。 */
  function placeMedial() {
    const medialSlot = document.querySelector<HTMLElement>('[data-slot-id="s0-m"]')
    expect(medialSlot).not.toBeNull()
    fireEvent.keyDown(screen.getByLabelText('积木 u'), { key: 'Enter' })
    expect(medialSlot?.classList.contains('pslot--filled'), 'u 该落进介母槽').toBe(true)
    return { medialSlot, placed: medialSlot?.querySelector('.pblock') }
  }

  // 颜色跟着**位置**走:站在介母槽里才穿那身「声母蓝 → 韵母绿」的过渡色。
  // 判据不能是「值是不是 i/u/ü」—— xī guā 的 i 是 xī 的韵腹,给它画过渡色是假话。
  it('xī guā 的 i 按韵母着色,不因「i 也能当介母」而着色', () => {
    mount(...at('u7-0')) // 🍉 xī guā
    const trayType = (v: string) =>
      document.querySelector<HTMLElement>(`[aria-label="积木 ${v}"] [data-type]`)?.dataset.type

    expect(trayType('i'), 'xī 的 i 是韵腹').toBe('final')
    expect(trayType('u'), 'guā 的 u 是介母').toBe('medial')
    // 槽位一侧同样:xī 那组根本没有介母槽
    expect(document.querySelector('[data-slot-id="s0-f"]')).not.toBeNull()
    expect(document.querySelector('[data-slot-id="s0-m"]')).toBeNull()
    expect(document.querySelector('[data-slot-id="s1-m"]'), 'guā 的介母槽').not.toBeNull()
  })

  it('块入槽后按槽位定型:介母槽里是介母色,韵母槽里是韵母色', () => {
    mount(...at('u5-0')) // 🍉 guā = g + 介母 u + a
    const { placed } = placeMedial()
    expect(placed?.getAttribute('data-type')).toBe('medial')

    fireEvent.keyDown(screen.getByLabelText('积木 a'), { key: 'Enter' })
    expect(document.querySelector('[data-slot-id="s0-f"] .pblock')?.getAttribute('data-type')).toBe('final')
  })

  // 看见字母 ≠ 知道它读什么。4-8 岁孩子正是靠「按一下、听一声」建立形音联系的。
  it('点一块就念出这一块的音,念的是同音汉字', () => {
    const { speak } = mount(1, 0) // 👨 bà = b + a
    fireEvent.keyDown(screen.getByLabelText('积木 b'), { key: 'Enter' })
    // 喂 'b' 会被 TTS 按英文念成 "bee"。呼读音「玻」才是小学教的那个音。
    expect(speak).toHaveBeenCalledWith('玻')
    fireEvent.keyDown(screen.getByLabelText('积木 a'), { key: 'Enter' })
    expect(speak).toHaveBeenCalledWith('啊')
  })

  // 同一个字母两个身份,读法得跟着身份走 —— 鼻尾念的是它代表的那个鼻韵母。
  it('鼻尾 n 念「恩」(前鼻音的名字就是它自己)', () => {
    const { speak } = mount(...at('u4-0')) // 🚪 mén = m + e + 鼻尾 n
    // 托盘里可能同时有鼻尾 n 和当干扰块发的声母 n —— 按 data-type 认身份,不按字符
    const nasalN = screen
      .getAllByLabelText('积木 n')
      .find((el) => el.querySelector('[data-type="nasal"]') !== null)
    expect(nasalN, '题面该有鼻尾 n').toBeDefined()
    fireEvent.keyDown(nasalN as HTMLElement, { key: 'Enter' })
    expect(speak).toHaveBeenCalledWith('恩')
  })

  it('鼻尾 ng 念「鞥」', () => {
    const { speak } = mount(...at('u4-2')) // 🏡 fáng = f + a + ng
    fireEvent.keyDown(screen.getByLabelText('积木 ng'), { key: 'Enter' })
    expect(speak).toHaveBeenCalledWith('鞥')
  })

  it('声母 n 仍念「讷」,不跟着鼻尾走', () => {
    const { speak } = mount(...at('u7-2')) // 🥛 niú nǎi:两块 n 都是声母
    const ns = screen.getAllByLabelText('积木 n')
    expect(ns).toHaveLength(2)
    fireEvent.keyDown(ns[0] as HTMLElement, { key: 'Enter' })
    expect(speak).toHaveBeenCalledWith('讷')
  })

  it('按下的那一刻就念 —— 拖拽的起点也算', () => {
    const { speak } = mount(1, 0)
    fireEvent.pointerDown(screen.getByLabelText('积木 b'), { clientX: 10, clientY: 10 })
    expect(speak).toHaveBeenCalledWith('玻')
    fireEvent.pointerUp(window, { clientX: 10, clientY: 10 })
  })

  // 声调不是一个能念的音。硬找一个字来念(「妈麻马骂」之类)会跟题面的读音打架。
  it('声调块不发字母音', () => {
    const { speak } = mount(1, 0)
    fireEvent.keyDown(screen.getByLabelText('声调块 4'), { key: 'Enter' })
    expect(speak).not.toHaveBeenCalled()
  })

  // 「单独成行、与组合块分开」是**行容器**这件事,不是 CSS 的事:声调块与组合块各占
  // 积木盘里的一个子行(PinyinBlocksGame.tsx 积木盘那段的两个子 div)。只断「有 4 个声调块」的话,
  // 把两行并成一行照样全绿 —— 而「合成一行」正是这条用例要拦的那件事
  //(声调是另一个维度,混进字母块里只是噪音;源码里那句注释就写在那两个子行的上方)。
  it('声调块单独成行,与组合块分开', () => {
    mount(1, 1)
    const toneBlocks = Array.from(document.querySelectorAll<HTMLElement>('[aria-label^="声调块"]'))
    expect(toneBlocks).toHaveLength(4) // 四调恒全出

    const rows = (els: HTMLElement[]) => new Set(els.map((el) => el.parentElement))
    const toneRows = rows(toneBlocks)
    const comboBlocks = Array.from(document.querySelectorAll<HTMLElement>('[aria-label^="积木 "]'))
    expect(comboBlocks.length, '这一关该有组合块可断').toBeGreaterThan(0)
    const comboRows = rows(comboBlocks)

    // 先是「同类都在同一行」:否则下面那句「两行的容器不同」可能只是同类自己散成了好几行。
    expect(toneRows.size, '声调块该都在同一行').toBe(1)
    expect(comboRows.size, '组合块该都在同一行').toBe(1)
    const toneRow = [...toneRows][0]
    const comboRow = [...comboRows][0]
    expect(toneRow, '两行不该是同一个容器').not.toBe(comboRow)
    // 并列而非嵌套:两层行容器都得挂在积木盘这一层上(把声调行塞进组合行里也不算「分开」)。
    expect(toneRow?.parentElement, '两行该是积木盘的两个并列子行').toBe(comboRow?.parentElement)
  })

  it('点对块会落位,拼齐后亮出拼音答案', async () => {
    const { speak } = mount(1, 0) // 👨 bà
    solveCorrectly(1, 0)
    expect(await screen.findByText('bà')).toBeInTheDocument()
    // 朗读喂的是同音汉字 —— 喂 'bà' 会被 TTS 逐字母念出来
    expect(speak).toHaveBeenCalledWith('爸')
  })

  // data-block-id 挂在托盘的矩形 wrapper 上。克隆它 = 把 .pblock--dragging 的白高光与投影
  // 画在一个没圆角的透明矩形上,块四周就多出一圈白框。
  it('拖拽幽灵克隆的是块本体,不是外面那层矩形壳', () => {
    mount(1, 0)
    const host = document.querySelector<HTMLElement>('[data-block-id]')
    expect(host).not.toBeNull()
    fireEvent.pointerDown(host as HTMLElement, { clientX: 10, clientY: 10 })
    fireEvent.pointerMove(window, { clientX: 40, clientY: 40 })

    const ghost = document.querySelector('.pblock--dragging')
    expect(ghost).not.toBeNull()
    expect((ghost as HTMLElement).classList.contains('pblock'), '幽灵得是圆角块本身').toBe(true)

    fireEvent.pointerUp(window, { clientX: 40, clientY: 40 })
    expect(document.querySelector('.pblock--dragging')).toBeNull()
  })

  // 幽灵块挂在 document.body 上、不在 React 树里 —— 一旦漏拆,重挂组件也清不掉,只有刷新能救。
  // 4-8 岁二指同按很常见:第二指按下时必须先把第一指的幽灵块拆掉。
  it('二指同按:第二指按下时拆掉第一指的幽灵块,不留在 body 上', () => {
    mount(1, 0) // 👨 bà:任何一块都能拖出幽灵块
    const blocks = Array.from(document.querySelectorAll<HTMLElement>('[data-block-id]'))
    const [a, b] = [blocks[0] as HTMLElement, blocks[1] as HTMLElement]

    fireEvent.pointerDown(a, { clientX: 10, clientY: 10 })
    fireEvent.pointerMove(window, { clientX: 40, clientY: 40 })
    // 先钉住「幽灵块确实已挂上」——否则后面的 0 可能只是没拖起来,不是拆干净了。
    expect(document.querySelectorAll('.pblock--dragging').length, '幽灵块该已挂上').toBe(1)

    // 名字说的是「**第二指按下时**」拆掉 —— 只断末尾的 0 的话,一个「等到 pointerup 才把所有
    // 幽灵块一次性清掉」的写法也能全绿,而 A 的幽灵块会冻在屏幕上直到松手。
    fireEvent.pointerDown(b, { clientX: 100, clientY: 100 })
    expect(document.querySelectorAll('.pblock--dragging').length, '第二指一按下,A 的幽灵块就该没了').toBe(0)

    fireEvent.pointerMove(window, { clientX: 60, clientY: 60 })
    expect(document.querySelectorAll('.pblock--dragging').length, 'B 的拖拽该照常起幽灵块').toBe(1)

    fireEvent.pointerUp(window, { clientX: 60, clientY: 60 })
    expect(document.querySelectorAll('.pblock--dragging').length, 'B 的幽灵块也该拆掉').toBe(0)
  })

  // 切后台 / 浏览器抢走手势只发 pointercancel,不发 pointerup。它必须把手上这摊拆干净。
  // 「残影」有两半:**幽灵块**(挂在 body 上的节点)与**源块的压暗**(`draggingId` 的可见投影,
  // 见 PinyinBlocksGame.tsx 的 dim={draggingId === b.id})。只数幽灵块的话,漏掉
  // setDraggingId(null) 仍然全绿,而那块会永久压暗 —— 名字说的「不留残影」就不成立。
  it('pointercancel:幽灵块拆掉,源块也不再压暗(不留残影)', () => {
    mount(1, 0)
    const source = () => screen.getByLabelText('积木 b').querySelector<HTMLElement>('.pblock')
    fireEvent.pointerDown(screen.getByLabelText('积木 b'), { clientX: 10, clientY: 10 })
    fireEvent.pointerMove(window, { clientX: 40, clientY: 40 })
    expect(document.querySelectorAll('.pblock--dragging').length, '幽灵块该已挂上').toBe(1)
    expect(source()?.classList.contains('pblock--dim'), '拖拽期源块该压暗(否则下面那句是假绿)').toBe(true)

    fireEvent.pointerCancel(window, { clientX: 40, clientY: 40 })
    expect(document.querySelectorAll('.pblock--dragging').length, '幽灵块必须拆掉').toBe(0)
    expect(source()?.classList.contains('pblock--dim'), '幽灵块没了,源块的压暗也必须归零').toBe(false)
  })

  // 手势被系统收走时,孩子并没有做出「放在这里」的决定 —— 收尾之后的 pointerup 不许回头补落一块。
  // 单独立一条:与上面那条合写时,幽灵块那句会先红,这半句永远轮不到被证伪(除非拆开)。
  it('pointercancel 之后的 pointerup 不补落一块', () => {
    mount(1, 0) // 👨 bà:声母槽 s0-i 要 b,命中它会真的落位
    const slot = () => document.querySelector<HTMLElement>('[data-slot-id="s0-i"]') as HTMLElement
    expect(slot().getAttribute('aria-label'), '起始该是空槽').toBe('空槽')
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(slot())

    fireEvent.pointerDown(screen.getByLabelText('积木 b'), { clientX: 10, clientY: 10 })
    fireEvent.pointerMove(window, { clientX: 40, clientY: 40 })
    // 钉住「拖拽真的在飞」——否则下面那句空槽可能只是没拖起来。
    expect(document.querySelectorAll('.pblock--dragging').length, '幽灵块该已挂上').toBe(1)

    fireEvent.pointerCancel(window, { clientX: 40, clientY: 40 })
    fireEvent.pointerUp(window, { clientX: 40, clientY: 40 })
    expect(slot().classList.contains('pslot--filled'), '手势被系统收走后不该补落一块').toBe(false)
    expect(slot().getAttribute('aria-label')).toBe('空槽')
  })

  // 放错只有音效等于没有反馈 —— 声音关掉(或本来就是静音环境)后孩子只看到块弹回去。
  it('拖到放不下的槽:槽当场红一下,块不落位', () => {
    vi.useFakeTimers()
    try {
      mount(1, 0) // 👨 bà:声母槽要 b,韵母槽要 a
      const finalSlot = () => document.querySelector<HTMLElement>('[data-slot-id="s0-f"]') as HTMLElement
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(finalSlot())

      const host = Array.from(document.querySelectorAll<HTMLElement>('[data-block-id]')).find(
        (el) => el.getAttribute('aria-label') === '积木 b',
      )
      expect(host).toBeDefined()
      fireEvent.pointerDown(host as HTMLElement, { clientX: 10, clientY: 10 })
      fireEvent.pointerMove(window, { clientX: 40, clientY: 40 })
      fireEvent.pointerUp(window, { clientX: 40, clientY: 40 })

      expect(finalSlot().classList.contains('pslot--wrong')).toBe(true)
      expect(finalSlot().classList.contains('pslot--filled'), '放不下就不该落位').toBe(false)

      act(() => vi.advanceTimersByTime(600))
      expect(finalSlot().classList.contains('pslot--wrong'), '红圈该自己退掉').toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  // 已占的槽同样要算命中,否则「拖错块盖上去」会变成什么都没发生 —— 比报错更让人困惑。
  it('拖错的块盖到已有块上:报错,且原来的块原地不动', () => {
    vi.useFakeTimers()
    try {
      mount(1, 0) // 👨 bà:声母槽要 b,韵母槽要 a
      fireEvent.keyDown(screen.getByLabelText('积木 a'), { key: 'Enter' }) // 先正确放上 a
      const finalSlot = () => document.querySelector<HTMLElement>('[data-slot-id="s0-f"]') as HTMLElement
      expect(finalSlot().classList.contains('pslot--filled')).toBe(true)

      vi.spyOn(document, 'elementFromPoint').mockReturnValue(finalSlot())
      const host = Array.from(document.querySelectorAll<HTMLElement>('[data-block-id]')).find(
        (el) => el.getAttribute('aria-label') === '积木 b',
      )
      fireEvent.pointerDown(host as HTMLElement, { clientX: 10, clientY: 10 })
      fireEvent.pointerMove(window, { clientX: 40, clientY: 40 })
      fireEvent.pointerUp(window, { clientX: 40, clientY: 40 })

      expect(finalSlot().classList.contains('pslot--wrong')).toBe(true)
      expect(finalSlot().querySelector('.pblock')?.textContent, 'a 不该被顶掉').toBe('a')
    } finally {
      vi.useRealTimers()
    }
  })

  // 托盘块比槽大(56px 是给手指的点击目标),搬进槽时必须换成槽的尺寸 ——
  // 大出来的部分会向下溢出、压住下面那块,把它的立体感盖掉。
  it('入槽的块与槽同尺寸', () => {
    mount(1, 0) // 👨 bà
    fireEvent.keyDown(screen.getByLabelText('声调块 4'), { key: 'Enter' })
    fireEvent.keyDown(screen.getByLabelText('积木 a'), { key: 'Enter' })

    const sizeClasses = (el: Element) =>
      Array.from(el.classList)
        .filter((c) => /^[hw]-/.test(c))
        .sort()
        .join(' ')

    for (const id of ['s0-t', 's0-f']) {
      const slot = document.querySelector<HTMLElement>(`[data-slot-id="${id}"]`)
      expect(slot?.classList.contains('pslot--filled'), `${id} 没填上`).toBe(true)
      const chip = slot?.querySelector('.pblock')
      expect(chip, `${id} 里没有块`).not.toBeNull()
      expect(sizeClasses(chip as Element), id).toBe(sizeClasses(slot as Element))
    }
  })

  // 名字说的是**韵母槽**,而下面原先只查了**介母槽** —— 两个不同的槽。
  // 只查介母槽的话,「canPlace 放宽到声母块也能进韵母槽」这类回归照样全绿(注入实测);
  // 顺带把 `if (g)` 那条空转也堵上:块没找到时它会让「找不到」与「被正确拒绝」都是绿。
  it('声母块塞不进韵母槽(类型不符,值也不同)', () => {
    vi.useFakeTimers()
    try {
      mount(...at('u5-0')) // guā:g + 介母 u + a
      const trayBlocks = document.querySelectorAll<HTMLElement>('[data-block-id]')
      const g = Array.from(trayBlocks).find(
        (el) => el.dataset.value === 'g' || el.querySelector('[data-value="g"]'),
      )
      const medialSlot = document.querySelector<HTMLElement>('[data-slot-id="s0-m"]')
      expect(medialSlot).not.toBeNull()
      expect(g, '托盘里该有声母 g').toBeDefined()

      // 拖到韵母槽上:值 'g' ≠ 'a',必须被拒。
      // **拖拽放在点击前面**:块一旦落进槽,托盘里那个节点就被 React 摘掉了,
      // 再对它派发 pointerdown 不会冒泡到 root(下面的「幽灵块该已挂上」会先红)。
      const finalSlot = () => document.querySelector<HTMLElement>('[data-slot-id="s0-f"]') as HTMLElement
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(finalSlot())
      fireEvent.pointerDown(g as HTMLElement, { clientX: 10, clientY: 10 })
      fireEvent.pointerMove(window, { clientX: 40, clientY: 40 })
      // 先钉住「拖拽真的在飞」:否则下面那句「没落位」可能只是手势没起来。
      expect(document.querySelectorAll('.pblock--dragging').length, '幽灵块该已挂上').toBe(1)
      fireEvent.pointerUp(window, { clientX: 40, clientY: 40 })

      // 名字里那件事**先断** —— 「被放进去了」与「没发生」是两种不同的绿(注入实测:
      // 放行这条回归时,下面那句正控也会红,若把它写在前面,这句就永远轮不到被证伪)。
      expect(finalSlot().classList.contains('pslot--filled'), '声母块塞进韵母槽了').toBe(false)
      // 正控在下:手势真的落到 s0-f 上并被拒(少了它,上面那句可能只是手势没起来)。
      expect(finalSlot().classList.contains('pslot--wrong'), '这一次该是「试着放、被拒」而不是没发生').toBe(true)

      // 点击路径:g 只会进类型相同的声母槽,不占介母槽
      fireEvent.keyDown(g as HTMLElement, { key: 'Enter' })
      expect(document.querySelector('[data-slot-id="s0-m"]')?.classList.contains('pslot--filled')).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('韵母块 i 能落进韵母槽(lí = l + 韵母 i)', () => {
    mount(1, 3) // 🍐 lí
    const finalSlot = document.querySelector<HTMLElement>('[data-slot-id="s0-f"]')
    expect(finalSlot).not.toBeNull()
    const iBlock = Array.from(document.querySelectorAll<HTMLElement>('[data-block-id]')).find((el) =>
      el.querySelector('[data-value="i"]'),
    )
    expect(iBlock).toBeDefined()
    fireEvent.keyDown(iBlock!, { key: 'Enter' })
    expect(document.querySelector('[data-slot-id="s0-f"]')?.classList.contains('pslot--filled')).toBe(true)
  })

  // 判据接线在 PinyinBlocksGame.tsx 里(losesDots(声母, 块值)),不在 BlockChip 里 ——
  // 单测组件只能证明「给了 dotsAway 会怎样」,证明不了「哪一关真的给了」。
  // 下面两关只差一个声母,一个飞点、一个留点:把那条接线反过来(或把实参对调),两关各红一半。
  it('jú 的 ü 块落位后两点飞走,块面读 u', () => {
    mount(...at('u9-50')) // 🍊 jú = j + ü
    fireEvent.keyDown(screen.getByLabelText('积木 ü'), { key: 'Enter' })

    const chip = document.querySelector('[data-slot-id="s0-f"] .pblock')
    expect(chip, 'ü 该落进韵母槽').not.toBeNull()
    expect(chip?.querySelector('.pb-dot'), 'j 之后的 ü 该飞两点').not.toBeNull()
    expect(chip?.textContent, '块面该是去点后的 u').toBe('u')
  })

  it('nǚ 的 ü 块落位后两点不飞,块面仍读 ü', () => {
    mount(...at('u9-55')) // 👧 nǚ = n + ü
    fireEvent.keyDown(screen.getByLabelText('积木 ü'), { key: 'Enter' })

    const chip = document.querySelector('[data-slot-id="s0-f"] .pblock')
    expect(chip, 'ü 该落进韵母槽').not.toBeNull()
    expect(chip?.querySelector('.pb-dot'), 'n 之后的 ü 得留着两点').toBeNull()
    expect(chip?.textContent, '块面该原样读 ü').toBe('ü')
  })

  it('整体认读音节拼对后出现焊接标记(zhī)', async () => {
    mount(...at('u6-0')) // 🕷️ zhī
    solveCorrectly(...at('u6-0'))
    expect(await screen.findByText('zhī')).toBeInTheDocument()
    const weld = document.querySelector('.pweld')
    expect(weld).not.toBeNull()
    expect(weld?.classList.contains('pweld--on')).toBe(true)
  })

  it('非整体认读音节不出现焊接标记', async () => {
    mount(1, 0) // 👨 bà
    solveCorrectly(1, 0)
    await screen.findByText('bà')
    expect(document.querySelector('.pweld')).toBeNull()
  })

  // 「两组」= 拼装台里两个**并列**的组容器(每组的槽各归各的),不是「一堆槽塞在同一个容器里」。
  // 只数槽的话,把两个音节组塌成一组照样全绿 —— 而「塌成一组」正是这条用例要拦的那件事。
  it('双音节词给两组拼装组', () => {
    mount(...at('u7-0')) // 🍉 xī guā
    expect(document.querySelectorAll('[data-slot-id][data-slot-id$="-t"]')).toHaveLength(2)
    expect(document.querySelectorAll('[role="group"] [data-slot-id]').length).toBeGreaterThan(3)

    const stage = screen.getByLabelText('拼装台')
    const groups = Array.from(stage.children)
    expect(groups, '两个音节 = 拼装台的两个并列子组').toHaveLength(2)
    for (const group of groups) {
      // 「组」得真是一个**音节**的整套槽:自带一个声调槽,且不止一个字母槽。
      expect(group.querySelectorAll('[data-slot-id$="-t"]'), '每组各带自己的声调槽').toHaveLength(1)
      expect(
        group.querySelectorAll('[data-slot-id]:not([data-slot-id$="-t"])').length,
        '每组至少一个字母槽',
      ).toBeGreaterThan(0)
    }
  })

  it('提示档「强」:容器不带降档类,每个空槽都挂一个类型类', () => {
    render(<PinyinBlocksGame unitIndex={unitIdx('u2')} levelIndex={0} speak={vi.fn()} />) // u2 = 强档
    const stage = screen.getByLabelText('拼装台')
    expect(stage.classList.contains('pslots')).toBe(true)
    expect(stage.classList.contains('pslots--mid')).toBe(false)
    expect(stage.classList.contains('pslots--weak')).toBe(false)
    // 「每个空槽都挂」= 逐槽断,而不是「存在一个 .pslot--initial」——
    // 后者漏掉别的槽(如韵母槽)的类型类照样全绿,而那些槽的颜色正是照这个类取的。
    const TYPE_CLASSES = ['pslot--initial', 'pslot--medial', 'pslot--final', 'pslot--nasal', 'pslot--tone']
    const emptySlots = Array.from(document.querySelectorAll<HTMLElement>('[data-slot-id]')).filter(
      (el) => !el.classList.contains('pslot--filled'),
    )
    expect(emptySlots.length, '这一关该有空槽可断').toBeGreaterThan(0)
    for (const slot of emptySlots) {
      expect(
        TYPE_CLASSES.filter((c) => slot.classList.contains(c)),
        `空槽 ${slot.dataset.slotId} 的类型类`,
      ).toHaveLength(1)
    }
  })

  // 强档 = 不挂任何降档类(容器基色就是强档)。u4 在 12 单元表里从「中」升回「强」——
  // 这条钉住「升回强档时降档类真的被摘掉」,而不只是某一档还在。
  it('提示档「强」:容器不挂降档类', () => {
    render(<PinyinBlocksGame unitIndex={unitIdx('u4')} levelIndex={0} speak={vi.fn()} />) // u4 = 强档
    const stage = screen.getByLabelText('拼装台')
    expect(stage.classList.contains('pslots--mid')).toBe(false)
    expect(stage.classList.contains('pslots--weak')).toBe(false)
    // 类型类仍在(slot 的语义没变),浓淡交给 --slot-line/--slot-fill
    expect(document.querySelector('.pslot--initial, .pslot--final')).not.toBeNull()
  })

  // 中档是强/弱之间的那一格。u7 在 12 单元表里是「中」——
  // 弱档由 u9-u12 承担(见下面那条),不再靠任何一档兼差。
  it('提示档「中」:容器带中档类', () => {
    render(<PinyinBlocksGame unitIndex={unitIdx('u7')} levelIndex={0} speak={vi.fn()} />) // u7 = 中档
    const stage = screen.getByLabelText('拼装台')
    expect(stage.classList.contains('pslots--mid')).toBe(true)
    // 三档互斥:同时挂两个降档类,今天的观感全靠 CSS 里两条规则的先后 —— 那是巧合不是契约。
    expect(stage.classList.contains('pslots--weak')).toBe(false)
    // 类型类仍在(slot 的语义没变),浓淡交给 --slot-line/--slot-fill
    expect(document.querySelector('.pslot--initial, .pslot--final')).not.toBeNull()
  })

  // 弱档是脚手架撤到底的那一格:u9-u12 的提示基线恒弱。没有这条,
  // 把 PinyinBlocksGame.tsx 里 `hint === 'weak' && 'pslots--weak'` 删掉,全套仍然绿。
  it('提示档「弱」:容器带弱档类,且不带中档类', () => {
    render(<PinyinBlocksGame unitIndex={unitIdx('u9')} levelIndex={0} speak={vi.fn()} />) // u9-50 = 弱档
    const stage = screen.getByLabelText('拼装台')
    expect(stage.classList.contains('pslots--weak'), 'u9 该是弱档').toBe(true)
    // 三档互斥:弱档同时挂上中档类,浓淡就只剩 CSS 规则的先后 —— 那是巧合不是契约。
    expect(stage.classList.contains('pslots--mid')).toBe(false)
    // 类型类仍在(slot 的语义没变),浓淡交给 --slot-line/--slot-fill
    expect(document.querySelector('.pslot--initial, .pslot--final')).not.toBeNull()
  })

  // 脚手架既要会撤,也要能回来 —— 卡住的时候颜色得回来。
  it('同一关连错 2 次,容器回强档', () => {
    render(<PinyinBlocksGame unitIndex={unitIdx('u5')} levelIndex={0} speak={vi.fn()} />) // u5 = 中档
    const stage = () => screen.getByLabelText('拼装台')
    expect(stage().classList.contains('pslots--mid')).toBe(true)
    // 声调块恒四调全出,u5-0「māo」是阴平 → 「声调块 2」必定无处可落。
    // 用它而不是干扰块:干扰块由 makeRng 决定,拿它当判据等于把测试绑在发牌上。
    const wrong = screen.getByLabelText('声调块 2')
    fireEvent.keyDown(wrong, { key: 'Enter' })
    expect(stage().classList.contains('pslots--mid'), '错 1 次还不回强').toBe(true)
    fireEvent.keyDown(wrong, { key: 'Enter' })
    expect(stage().classList.contains('pslots--mid'), '错 2 次该回强').toBe(false)
    expect(stage().classList.contains('pslots--weak')).toBe(false)
  })

  it('关卡数据里每一题都能被渲染出来(不炸)', () => {
    for (let u = 0; u < UNITS.length; u++) {
      for (let l = 0; l < (UNITS[u]?.levels.length ?? 0); l++) {
        const { unmount } = render(<PinyinBlocksGame unitIndex={u} levelIndex={l} speak={vi.fn()} />)
        expect(screen.getByLabelText('拼装台')).toBeInTheDocument()
        unmount()
      }
    }
  })

  // 「错」= 触发红圈抖动的那件事。三处都要算:放错槽、点选无槽可落、全填后判出错块。
  it('一次不错通关给三星', () => {
    vi.useFakeTimers()
    try {
      const onSolved = vi.fn()
      render(<PinyinBlocksGame unitIndex={1} levelIndex={0} speak={vi.fn()} onSolved={onSolved} />)
      solveCorrectly(1, 0)
      settle()
      expect(onSolved).toHaveBeenCalledWith(3)
    } finally {
      vi.useRealTimers()
    }
  })

  it('放错拖拽算一次错,拿二星', () => {
    vi.useFakeTimers()
    try {
      const onSolved = vi.fn()
      const onBlock = vi.fn()
      mountWithSolved(1, 0, onSolved, onBlock) // 👨 bà:声母槽要 b,韵母槽要 a
      // 把 b 拖到韵母槽上 —— 放不下,红一下
      const finalSlot = document.querySelector<HTMLElement>('[data-slot-id="s0-f"]') as HTMLElement
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(finalSlot)
      const b = Array.from(document.querySelectorAll<HTMLElement>('[data-block-id]')).find(
        (el) => el.getAttribute('aria-label') === '积木 b',
      )
      fireEvent.pointerDown(b as HTMLElement, { clientX: 10, clientY: 10 })
      fireEvent.pointerMove(window, { clientX: 40, clientY: 40 })
      fireEvent.pointerUp(window, { clientX: 40, clientY: 40 })
      // 拖错槽既算一次错,也要上报一次 —— 两条手势(拖 / 点)说的是同一件事
      expect(onBlock).toHaveBeenCalledWith('wrong')
      solveCorrectly(1, 0)
      settle()
      expect(onSolved).toHaveBeenCalledWith(2)
    } finally {
      vi.useRealTimers()
    }
  })

  // 点选路径「无槽可落」与拖错槽是同一件事的另一种手势,不能只有拖拽那半边算错。
  it('点一块放不下的块也算一次错,拿二星', () => {
    vi.useFakeTimers()
    try {
      const onSolved = vi.fn()
      mountWithSolved(1, 0, onSolved) // 👨 bà 只要四声,「声调块 1」恒无处可落
      fireEvent.keyDown(screen.getByLabelText('声调块 1'), { key: 'Enter' })
      solveCorrectly(1, 0)
      settle()
      expect(onSolved).toHaveBeenCalledWith(2)
    } finally {
      vi.useRealTimers()
    }
  })

  // 判定后还有 1.6s 的成功动画,那段时间里托盘上还留着干扰块 —— 孩子会继续点。
  // 已经到手的星不该被这几下改小:星级在 succeed() 调用那一刻就冻结(HEAD 的写法)。
  it('成功动画期间点托盘块,星级不变', () => {
    vi.useFakeTimers()
    try {
      const onSolved = vi.fn()
      render(<PinyinBlocksGame unitIndex={1} levelIndex={0} speak={vi.fn()} onSolved={onSolved} />)
      solveCorrectly(1, 0)
      // 260ms 后进入成功动画(status 已是 solved),1600ms 的停顿还没走完
      act(() => vi.advanceTimersByTime(300))
      const rest = trayBlocks()
      expect(rest.length, '解完之后托盘该还剩干扰块可点').toBeGreaterThan(0)
      for (const el of rest) fireEvent.keyDown(el, { key: 'Enter' })
      settle()
      expect(onSolved).toHaveBeenCalledWith(3)
    } finally {
      vi.useRealTimers()
    }
  })

  // 最后一块落位到判定触发之间还有 260ms(`setTimeout(succeed, 260)`)。这段时间盘面已满,
  // 但 status 仍是 playing —— 只按 status 设闸会漏掉它,快速连点就能把到手的 3 星打成 1 星。
  it('最后一块落位到判定之间的 260ms 里点托盘块,星级不变', () => {
    vi.useFakeTimers()
    try {
      const onSolved = vi.fn()
      render(<PinyinBlocksGame unitIndex={1} levelIndex={0} speak={vi.fn()} onSolved={onSolved} />)
      solveCorrectly(1, 0)
      // 100ms < 260ms:还没进成功动画,succeed() 尚未跑过。
      act(() => vi.advanceTimersByTime(100))
      const rest = trayBlocks()
      expect(rest.length, '解完之后托盘该还剩干扰块可点').toBeGreaterThan(0)
      for (const el of rest) fireEvent.keyDown(el, { key: 'Enter' })
      settle()
      expect(onSolved).toHaveBeenCalledWith(3)
    } finally {
      vi.useRealTimers()
    }
  })

  // 两条推进路径只能跑一条 —— 都跑的话 advance 里那个 setRound 会把这关重挂一次
  // (表现是闪一下、发牌换一副),孩子刚拼好的题面凭空消失。
  it('给了 onSolved 就不再自走推进(关不重挂)', () => {
    vi.useFakeTimers()
    try {
      const onSolved = vi.fn()
      const onAdvance = vi.fn()
      render(
        <PinyinBlocksGame
          unitIndex={1}
          levelIndex={0}
          speak={vi.fn()}
          onSolved={onSolved}
          onAdvance={onAdvance}
        />,
      )
      solveCorrectly(1, 0)
      settle()
      expect(onSolved).toHaveBeenCalledWith(3)
      expect(onAdvance, '外层接管时不该自走').not.toHaveBeenCalled()
      // 重挂会连 placement 一起清掉 —— 槽里还是满的,说明这一关没被重挂
      expect(
        document.querySelector('[data-slot-id="s0-i"]')?.classList.contains('pslot--filled'),
        '关卡被重挂了(placement 被清空)',
      ).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  // 试玩路径:外层不管结算时,关内自己往下一关走。
  it('没给 onSolved 时关内自走推进', () => {
    vi.useFakeTimers()
    try {
      const onAdvance = vi.fn()
      mount(1, 0, onAdvance) // 👨 bà 是 u2-0
      solveCorrectly(1, 0)
      settle()
      expect(onAdvance).toHaveBeenCalledWith(1, 1)
    } finally {
      vi.useRealTimers()
    }
  })

  // 连击的粒度是「每放一块」,不是「每答一题」—— 孩子的节奏本来就是一块一块搭出来的。
  // 断言必须是**全序**而不是「调用过某值」:多报一次、顺序颠倒,连击就都算错了。
  it('每放一块上报一次,且按序:放错 wrong → 放对 first', () => {
    const onBlock = vi.fn()
    render(
      <PinyinBlocksGame unitIndex={1} levelIndex={0} speak={vi.fn()} onBlock={onBlock} />,
    )
    // 用声调块当「必定放不下」的那一块:四个调恒全出(bà 只要四声),
    // 所以「声调块 1」在任何题上都无处可落 —— 不受干扰块随机性影响。
    fireEvent.keyDown(screen.getByLabelText('声调块 1'), { key: 'Enter' })
    // 再放对一块
    fireEvent.keyDown(screen.getByLabelText('积木 b'), { key: 'Enter' })
    expect(onBlock.mock.calls).toEqual([['wrong'], ['first']])
  })

  // 盘**未满**时点已填槽必须能把块拿回托盘。`takeBack` 的闸是 `status !== 'playing' || boardFull` ——
  // 把 `||` 误写成 `&&`:盘未满时 boardFull=false ⇒ 整个条件恒假 ⇒ 早退,块拿不回。
  // 既有用例断的都是「**盘满**后拿不回」(260ms 窗口那两条),那半边在 `&&` 下照样绿 ——
  // 少了这条,`&&` 的回归全套 jsdom 静默通过。
  it('盘未满时点已填槽:块拿回托盘', () => {
    mount(1, 0) // 👨 bà:b + a + 四声
    const before = trayBlocks().length
    fireEvent.keyDown(screen.getByLabelText('积木 a'), { key: 'Enter' })
    const slot = document.querySelector<HTMLElement>('[data-slot-id="s0-f"]')
    expect(slot?.classList.contains('pslot--filled'), 'a 该落进韵母槽').toBe(true)
    expect(trayBlocks(), '入槽后托盘该少一块').toHaveLength(before - 1)

    // 声母槽与声调槽还空着 ⇒ 盘未满,takeBack 该放行。
    fireEvent.click(slot?.querySelector('.pblock') as HTMLElement)
    expect(slot?.classList.contains('pslot--filled'), '盘未满,块该能拿回').toBe(false)
    expect(trayBlocks(), '块该真的回了托盘').toHaveLength(before)
  })
})

describe('一关三段', () => {
  const SECTION_LEVEL = 'u2-0'
  /** 本关的数据对象 —— `at()` 交回的是下标元组,取关要用它。 */
  const LV = UNITS[at(SECTION_LEVEL)[0]]!.levels[at(SECTION_LEVEL)[1]]!

  // 本段的判定全靠推时钟(判错撤块 720ms / 正解演示 1200ms / 成功 1600ms),
  // 而 `vi.advanceTimersByTime` 要求先开假时钟。老 describe 是**逐条**在自己体内开的,
  // 这里段内每条都要,收在段壳上 —— 并**必须**在段末还原,否则时钟会漏给后面那些用例。
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  /** 段口径的挂载:三段入参直接喂给拼装台。 */
  function mountSection(levelId: string, props: Partial<PinyinBlocksGameProps>) {
    const [unit, level] = at(levelId)
    const speak = vi.fn()
    return render(<PinyinBlocksGame unitIndex={unit} levelIndex={level} speak={speak} {...props} />)
  }

  /**
   * 按「门禁」把一段拼对。困难段用 `sameTypeOnly`,复习段用 `canPlace` ——
   * 判据不同,但**正确块都满足两者**,所以这里传一个判据就够。
   */
  function solveStage(judge: (b: Block, s: Slot) => boolean) {
    for (const slot of slotsFor(LV)) {
      const fits = trayBlocks().filter((el) => judge(blockOf(el), slot))
      const pick = fits.find((el) => blockOf(el).type === slot.type) ?? fits[0]
      expect(pick, `${slot.type}:${slot.value} 在托盘里找不到可放块`).toBeDefined()
      fireEvent.keyDown(pick as HTMLElement, { key: 'Enter' })
    }
  }

  /** 把每个槽都填上一块**类型对、值错**的块 —— 困难段里这才会走到「填满后判错」。 */
  function fillWrongOnce() {
    for (const slot of slotsFor(LV)) {
      const pick = trayBlocks().find((el) => {
        const block = blockOf(el)
        return block.type === slot.type && block.value !== slot.value
      })
      // 声调槽在困难段四声全出,韵母池里也总有别的韵母;找不到就说明托盘算法漏了(那是 Task 3 的账)。
      expect(pick, `${slot.type} 槽找不到「类型对、值错」的块`).toBeDefined()
      fireEvent.keyDown(pick as HTMLElement, { key: 'Enter' })
    }
  }

  it('困难段:门禁只比类型 —— 值错的块放得进去,判错后撤块重试', async () => {
    const onSectionEnd = vi.fn()
    mountSection(SECTION_LEVEL, { stage: 'hard', onSectionEnd })
    // 往声母槽里放一块**值错但类型对**的声母(托盘里 b 之外的声母)。
    const initialSlot = slotsFor(LV).find((s) => s.type === 'initial')!
    const wrong = trayBlocks().find((el) => {
      const block = blockOf(el)
      return block.type === 'initial' && block.value !== initialSlot.value
    })
    expect(wrong, '困难段的托盘里必须有另一块声母').toBeDefined()
    fireEvent.keyDown(wrong as HTMLElement, { key: 'Enter' })
    // 落进去了(简单段会当场弹回)—— 这是「值可以错」的直接证据。
    expect(document.querySelector(`[data-slot-id="${initialSlot.id}"] [data-value]`)).not.toBeNull()
  })

  it('困难段:填满后判错 → 指出错误槽 → 撤块重试', async () => {
    const onSectionEnd = vi.fn()
    mountSection(SECTION_LEVEL, { stage: 'hard', onSectionEnd })
    fillWrongOnce()
    expect(document.querySelectorAll('.pslot--wrong').length).toBeGreaterThan(0)
    await act(async () => {
      vi.advanceTimersByTime(800)
    })
    // 撤块:错误槽空了,又能重来 —— 段还没结束。
    expect(document.querySelectorAll('.pslot--wrong').length).toBe(0)
    expect(onSectionEnd).not.toHaveBeenCalled()
  })

  it('困难段:2 次重试用尽 → 演示正解 → 交回「失败」但不阻塞', async () => {
    const onSectionEnd = vi.fn()
    mountSection(SECTION_LEVEL, { stage: 'hard', onSectionEnd })
    fillWrongOnce()
    await act(async () => {
      vi.advanceTimersByTime(800)
    })
    fillWrongOnce()
    await act(async () => {
      vi.advanceTimersByTime(800)
    })
    fillWrongOnce() // 第 3 次判错 = 用尽
    expect(document.querySelectorAll('.pslot--wrong').length).toBeGreaterThan(0)
    await act(async () => {
      vi.advanceTimersByTime(800)
    })
    // 演示:所有槽都填上了正确块。
    expect(document.querySelectorAll('[data-slot-id] [data-value]')).toHaveLength(slotsFor(LV).length)
    await act(async () => {
      vi.advanceTimersByTime(1400)
    })
    expect(onSectionEnd).toHaveBeenCalledTimes(1)
    expect(onSectionEnd.mock.calls[0]![0]).toMatchObject({ failed: true })
    expect(onSectionEnd.mock.calls[0]![0].missCount).toBeGreaterThanOrEqual(3)
  })

  // Review Focus #2:演示期间孩子继续点托盘块 —— 不许重复交账。
  it('重试用尽后的演示期间,继续点托盘块不会重复交账', async () => {
    const onSectionEnd = vi.fn()
    mountSection(SECTION_LEVEL, { stage: 'hard', onSectionEnd })
    for (let i = 0; i < 3; i++) {
      fillWrongOnce()
      await act(async () => {
        vi.advanceTimersByTime(800)
      })
    }
    for (const el of trayBlocks()) fireEvent.keyDown(el, { key: 'Enter' })
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })
    expect(onSectionEnd).toHaveBeenCalledTimes(1)
  })

  // 演示期槽已全满,点托盘块既无槽可落 —— **不受理**才是对的:
  // 受理了就是「白记 miss + 白进池」,画面上什么都没发生,段账目却已经被改坏。
  it('正解演示期间点托盘块:不记 miss、不进错题池', async () => {
    const onSectionEnd = vi.fn()
    mountSection(SECTION_LEVEL, { stage: 'hard', onSectionEnd })
    for (let i = 0; i < 3; i++) {
      fillWrongOnce()
      await act(async () => {
        vi.advanceTimersByTime(800)
      })
    }
    for (const el of trayBlocks()) fireEvent.keyDown(el, { key: 'Enter' })
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })
    // 3 次判错 = 3 次 miss、3 块错块(池按 key 去重);演示期那几下没有添乱。
    expect(onSectionEnd.mock.calls[0]![0]).toMatchObject({ missCount: 3, failed: true })
    expect(onSectionEnd.mock.calls[0]![0].wrongBlocks).toHaveLength(3)
  })

  // 后门:`takeBack` 若只卡 status,盘满后点一下已填槽就能把块拿回托盘 —— 盘面不再满,
  // `boardFull` 自己变 false,再点一块放不下的就白记 miss。两步把 3 星打成 2 星。
  it('260ms 窗口里先拿回一块再点放不下的块:老路星级不变', async () => {
    const onSolved = vi.fn()
    mountSection(SECTION_LEVEL, { onSolved })
    solveStage(canPlace)
    await act(async () => {
      vi.advanceTimersByTime(100)
    })
    // 点已填槽的块,想把它拿回托盘(有闸就该不动)
    const chip = document.querySelector<HTMLElement>('[data-slot-id] [data-block-id]')!
    const slotId = chip.closest<HTMLElement>('[data-slot-id]')!.dataset.slotId!
    const slot = slotsFor(LV).find((s) => s.id === slotId)!
    fireEvent.click(chip)
    // 再点一块**类型就放不进那个空槽**的托盘块 —— 无闸时它走 autoPlace 的 else 记一次 miss。
    const stray = trayBlocks().find((el) => blockOf(el).type !== slot.type)
    expect(stray, '托盘里该剩一块放不进空槽的干扰块').toBeDefined()
    fireEvent.keyDown(stray as HTMLElement, { key: 'Enter' })
    settle()
    expect(onSolved).toHaveBeenCalledWith(3)
  })

  // 段账目同样护住这 260ms:盘面已满即视为本段判完,窗口里的点击不得推高 missCount、不得进池。
  it('填满到判定之间的 260ms 里点托盘块:段账目不动', async () => {
    const onSectionEnd = vi.fn()
    mountSection(SECTION_LEVEL, { stage: 'easy', onSectionEnd })
    solveStage(canPlace)
    await act(async () => {
      vi.advanceTimersByTime(100)
    })
    const rest = trayBlocks()
    expect(rest.length, '解完之后托盘该还剩干扰块可点').toBeGreaterThan(0)
    for (const el of rest) fireEvent.keyDown(el, { key: 'Enter' })
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })
    expect(onSectionEnd).toHaveBeenCalledTimes(1)
    expect(onSectionEnd.mock.calls[0]![0]).toMatchObject({ missCount: 0, failed: false })
    expect(onSectionEnd.mock.calls[0]![0].wrongBlocks).toHaveLength(0)
  })

  // 同一手法的三段路径:段账目也不得被这条后门推高。
  it('260ms 窗口里先拿回一块再点放不下的块:段账目不动', async () => {
    const onSectionEnd = vi.fn()
    mountSection(SECTION_LEVEL, { stage: 'easy', onSectionEnd })
    solveStage(canPlace)
    await act(async () => {
      vi.advanceTimersByTime(100)
    })
    const chip = document.querySelector<HTMLElement>('[data-slot-id] [data-block-id]')!
    const slotId = chip.closest<HTMLElement>('[data-slot-id]')!.dataset.slotId!
    const slot = slotsFor(LV).find((s) => s.id === slotId)!
    fireEvent.click(chip)
    const stray = trayBlocks().find((el) => blockOf(el).type !== slot.type)
    expect(stray, '托盘里该剩一块放不进空槽的干扰块').toBeDefined()
    fireEvent.keyDown(stray as HTMLElement, { key: 'Enter' })
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })
    expect(onSectionEnd).toHaveBeenCalledTimes(1)
    expect(onSectionEnd.mock.calls[0]![0]).toMatchObject({ missCount: 0, failed: false })
    expect(onSectionEnd.mock.calls[0]![0].wrongBlocks).toHaveLength(0)
  })

  it('简单段:同一块点错 2 次才进错题池', async () => {
    const onSectionEnd = vi.fn()
    mountSection(SECTION_LEVEL, { stage: 'easy', onSectionEnd })
    const extra = trayBlocks().find((el) => {
      const block = blockOf(el)
      return block.type === 'initial' && block.value !== 'b'
    })
    expect(extra).toBeDefined()
    fireEvent.keyDown(extra as HTMLElement, { key: 'Enter' })
    solveStage(canPlace)
    await settle()
    expect(onSectionEnd).toHaveBeenCalledTimes(1)
    // 只点错一次 ⇒ 不进池(阈值 N = 2)。
    expect(onSectionEnd.mock.calls[0]![0].wrongBlocks).toHaveLength(0)
  })

  it('简单段:同一块点错 2 次 ⇒ 进错题池', async () => {
    const onSectionEnd = vi.fn()
    mountSection(SECTION_LEVEL, { stage: 'easy', onSectionEnd })
    const extra = trayBlocks().find((el) => {
      const block = blockOf(el)
      return block.type === 'initial' && block.value !== 'b'
    })
    fireEvent.keyDown(extra as HTMLElement, { key: 'Enter' })
    fireEvent.keyDown(extra as HTMLElement, { key: 'Enter' })
    const first = slotsFor(LV).find((s) => s.type === 'initial')!
    fireEvent.keyDown(trayBlocks().find((el) => canPlace(blockOf(el), first)) as HTMLElement, { key: 'Enter' })
    for (const slot of slotsFor(LV).filter((s) => s.id !== first.id)) {
      const pick = trayBlocks().find((el) => canPlace(blockOf(el), slot))
      if (pick) fireEvent.keyDown(pick, { key: 'Enter' })
    }
    await settle()
    expect(onSectionEnd.mock.calls[0]![0].wrongBlocks.map((block: Block) => `${block.type}:${block.value}`)).toContain(
      'initial:p',
    )
  })

  /**
   * 复习段的题**一律由 `reviewQuestions` 造**。手搓一个 prefill 不全的题面(比如只填 slotIds
   * 与 tray,prefill 留空)会得到一道**无解**的题:托盘里只有声母块,而屏幕上还有韵母槽与声调槽,
   * `isComplete` 永远不成立 ⇒ `onSectionEnd` 一次都不发,测试却会红在断言而不是病因上。
   */
  const reviewQuestionFor = (pool: Block[]): ReviewQuestion =>
    reviewQuestions(LV, at(SECTION_LEVEL)[0], pool, () => 0.5)[0]!

  it('复习段:预填槽拿不回(点了也不动),托盘只剩挖空槽的正解与错解', () => {
    const question = reviewQuestionFor([{ type: 'initial', value: 'p' }])
    mountSection(SECTION_LEVEL, { review: question })
    // 可见托盘 = 正解 b + 错解 p(韵母与声调都已预填,不在托盘里)。
    expect(trayBlocks()).toHaveLength(2)
    // 三个槽都在屏上,段标也照常画着。
    expect(document.querySelectorAll('[data-slot-id]')).toHaveLength(3)
    expect(document.querySelectorAll('.pstage-step')).toHaveLength(3)

    const prefilled = slotsFor(LV).find((s) => s.id !== question.slotIds[0])!
    const chip = document.querySelector(`[data-slot-id="${prefilled.id}"] [data-value]`)
    expect(chip, `${prefilled.id} 没预填`).not.toBeNull()
    fireEvent.click(chip as HTMLElement)
    // 点了还在槽里 —— 简单段点一下就会弹回托盘(那里 onClick = takeBack)。
    expect(document.querySelector(`[data-slot-id="${prefilled.id}"] [data-value]`)).not.toBeNull()
    expect(trayBlocks()).toHaveLength(2)
  })

  it('复习段:不记 miss(放错只抖)', async () => {
    const onSectionEnd = vi.fn()
    const question = reviewQuestionFor([{ type: 'initial', value: 'p' }])
    mountSection(SECTION_LEVEL, { review: question, onSectionEnd })
    const wrong = trayBlocks().find((el) => blockOf(el).value === 'p')
    fireEvent.keyDown(wrong as HTMLElement, { key: 'Enter' })
    // p 放不进 b 的槽(复习段用 canPlace)⇒ 弹回,托盘里还是两块。
    expect(trayBlocks()).toHaveLength(2)
    const right = trayBlocks().find((el) => blockOf(el).value === 'b')
    fireEvent.keyDown(right as HTMLElement, { key: 'Enter' })
    await settle()
    expect(onSectionEnd.mock.calls[0]![0]).toMatchObject({ missCount: 0, failed: false })
  })
})
