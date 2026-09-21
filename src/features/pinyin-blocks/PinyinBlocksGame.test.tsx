import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { UNITS } from './levels'
import { canPlace, slotsFor } from './rules'
import { SPEAK_OF, type Block, type BlockType } from './blocks'
import type { AnswerKind } from '@/shared/services'
import { PinyinBlocksGame } from './PinyinBlocksGame'

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
  })

  it('渲染题面图与拼装台,作答期间不出现汉字', () => {
    const { container } = mount(1, 1) // 🐴 mǎ
    expect(screen.getByText('🐴')).toBeInTheDocument()
    expect(screen.getByLabelText('拼装台')).toBeInTheDocument()
    // 零文本:汉字只在拼对之后作为答案出现,作答期间游戏区只有字母与声调走势线
    const gameArea = container.querySelector('.relative')
    expect(gameArea?.textContent ?? '').not.toMatch(/[一-鿿]/)
  })

  it('拼对后同时亮出拼音与对应汉字(认读要扣到字上)', async () => {
    mount(1, 1) // 🐴 mǎ
    solveCorrectly(1, 1)
    expect(await screen.findByText('mǎ')).toBeInTheDocument()
    expect(screen.getByText('马')).toBeInTheDocument()
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
    mount(6, 0) // 🍉 xī guā
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
    mount(4, 0) // 🍉 guā = g + 介母 u + a
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
    const { speak } = mount(3, 0) // 🚪 mén = m + e + 鼻尾 n
    // 托盘里可能同时有鼻尾 n 和当干扰块发的声母 n —— 按 data-type 认身份,不按字符
    const nasalN = screen
      .getAllByLabelText('积木 n')
      .find((el) => el.querySelector('[data-type="nasal"]') !== null)
    expect(nasalN, '题面该有鼻尾 n').toBeDefined()
    fireEvent.keyDown(nasalN as HTMLElement, { key: 'Enter' })
    expect(speak).toHaveBeenCalledWith('恩')
  })

  it('鼻尾 ng 念「鞥」', () => {
    const { speak } = mount(3, 2) // 🏡 fáng = f + a + ng
    fireEvent.keyDown(screen.getByLabelText('积木 ng'), { key: 'Enter' })
    expect(speak).toHaveBeenCalledWith('鞥')
  })

  it('声母 n 仍念「讷」,不跟着鼻尾走', () => {
    const { speak } = mount(6, 2) // 🥛 niú nǎi:两块 n 都是声母
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

  it('声调块单独成行,与组合块分开', () => {
    mount(1, 1)
    const toneBlocks = document.querySelectorAll('[aria-label^="声调块"]')
    expect(toneBlocks).toHaveLength(4) // 四调恒全出
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

  it('声母块塞不进韵母槽(类型不符,值也不同)', () => {
    mount(4, 0) // guā:g + 介母 u + a
    const trayBlocks = document.querySelectorAll<HTMLElement>('[data-block-id]')
    const g = Array.from(trayBlocks).find((el) => el.dataset.value === 'g' || el.querySelector('[data-value="g"]'))
    const medialSlot = document.querySelector<HTMLElement>('[data-slot-id="s0-m"]')
    expect(medialSlot).not.toBeNull()
    // 直接构造落位:点击 g 块不会占用介母槽
    if (g) fireEvent.keyDown(g, { key: 'Enter' })
    expect(document.querySelector('[data-slot-id="s0-m"]')?.classList.contains('pslot--filled')).toBe(false)
  })

  it('双身份块 i 能落进韵母槽(lí = l + 韵母 i)', () => {
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

  it('整体认读音节拼对后出现焊接标记(zhī)', async () => {
    mount(5, 0) // 🕷️ zhī
    solveCorrectly(5, 0)
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

  it('双音节词给两组拼装组', () => {
    mount(6, 0) // 🍉 xī guā
    expect(document.querySelectorAll('[data-slot-id][data-slot-id$="-t"]')).toHaveLength(2)
    expect(document.querySelectorAll('[role="group"] [data-slot-id]').length).toBeGreaterThan(3)
  })

  it('提示档「强」:容器不带降档类,空槽恒挂类型类', () => {
    render(<PinyinBlocksGame unitIndex={1} levelIndex={0} speak={vi.fn()} />) // u2 = 强档
    const stage = screen.getByLabelText('拼装台')
    expect(stage.classList.contains('pslots')).toBe(true)
    expect(stage.classList.contains('pslots--mid')).toBe(false)
    expect(stage.classList.contains('pslots--weak')).toBe(false)
    expect(document.querySelector('.pslot--initial')).not.toBeNull()
  })

  // 中档是强/弱之间的那一格。两档好写,中间那档最容易在改动里被漏掉。
  it('提示档「中」:容器带中档类', () => {
    render(<PinyinBlocksGame unitIndex={3} levelIndex={0} speak={vi.fn()} />) // u4 = 中档
    const stage = screen.getByLabelText('拼装台')
    expect(stage.classList.contains('pslots--mid')).toBe(true)
    expect(stage.classList.contains('pslots--weak')).toBe(false)
  })

  it('提示档「弱」:容器带降档类,颜色由变量归零', () => {
    render(<PinyinBlocksGame unitIndex={6} levelIndex={0} speak={vi.fn()} />) // u7 = 弱档
    const stage = screen.getByLabelText('拼装台')
    expect(stage.classList.contains('pslots--weak')).toBe(true)
    // 三档互斥:同时挂两个降档类,今天的观感全靠 CSS 里两条规则的先后 —— 那是巧合不是契约。
    expect(stage.classList.contains('pslots--mid')).toBe(false)
    // 类型类仍在(slot 的语义没变),浓淡交给 --slot-line/--slot-fill
    expect(document.querySelector('.pslot--initial, .pslot--final')).not.toBeNull()
  })

  // 脚手架既要会撤,也要能回来 —— 卡住的时候颜色得回来。
  it('同一关连错 2 次,容器回强档', () => {
    render(<PinyinBlocksGame unitIndex={6} levelIndex={0} speak={vi.fn()} />) // u7 = 弱档
    const stage = () => screen.getByLabelText('拼装台')
    expect(stage().classList.contains('pslots--weak')).toBe(true)
    // 声调块恒四调全出,xī guā 两句都是阴平 → 「声调块 2」必定无处可落。
    // 用它而不是干扰块:干扰块由 makeRng 决定,拿它当判据等于把测试绑在发牌上。
    const wrong = screen.getByLabelText('声调块 2')
    fireEvent.keyDown(wrong, { key: 'Enter' })
    expect(stage().classList.contains('pslots--weak'), '错 1 次还不回强').toBe(true)
    fireEvent.keyDown(wrong, { key: 'Enter' })
    expect(stage().classList.contains('pslots--weak'), '错 2 次该回强').toBe(false)
    expect(stage().classList.contains('pslots--mid')).toBe(false)
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
})
