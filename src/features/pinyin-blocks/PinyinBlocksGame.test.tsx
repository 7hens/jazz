import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { UNITS } from './levels'
import { PinyinBlocksGame } from './PinyinBlocksGame'

/** 游戏组件只吃 props,不碰服务注册表 —— 测试直接渲染,无需 fake service。 */
function mount(unit: number, level: number, onAdvance = vi.fn()) {
  const speak = vi.fn()
  const utils = render(<PinyinBlocksGame unitIndex={unit} levelIndex={level} speak={speak} onAdvance={onAdvance} />)
  return { ...utils, speak, onAdvance }
}

/** 按题目要求把正确块一个个点进去(点选路径 = 自动落位)。 */
function solveCorrectly() {
  const tray = screen.getByLabelText('拼装台')
  const blocks = Array.from(tray.ownerDocument.querySelectorAll<HTMLElement>('[data-block-id]'))
  // 逐块点,点错的会被游戏拒绝(不落位),故反复扫到没有进展为止
  let progressed = true
  while (progressed) {
    progressed = false
    const slots = Array.from(tray.ownerDocument.querySelectorAll<HTMLElement>('[data-slot-id]'))
    const filled = new Set(slots.filter((s) => s.classList.contains('pslot--filled')).map((s) => s.dataset.slotId))
    for (const el of blocks) {
      const before = filled.size
      fireEvent.keyDown(el, { key: 'Enter' })
      const now = Array.from(tray.ownerDocument.querySelectorAll<HTMLElement>('[data-slot-id]')).filter((s) =>
        s.classList.contains('pslot--filled'),
      ).length
      if (now > before) {
        progressed = true
        break
      }
    }
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
    solveCorrectly()
    expect(await screen.findByText('mǎ')).toBeInTheDocument()
    expect(screen.getByText('马')).toBeInTheDocument()
  })

  /** 把介母槽填上,返回落位的那块。 */
  function placeMedial() {
    const medialSlot = document.querySelector<HTMLElement>('[data-slot-id="s0-m"]')
    expect(medialSlot).not.toBeNull()
    const tray = screen.getByLabelText('拼装台')
    for (const el of Array.from(tray.ownerDocument.querySelectorAll<HTMLElement>('[data-block-id]'))) {
      fireEvent.keyDown(el, { key: 'Enter' })
      if (medialSlot?.classList.contains('pslot--filled')) break
    }
    return { medialSlot, placed: medialSlot?.querySelector('.pblock') }
  }

  // 双身份块盘中是渐变、入槽后必须还是渐变 —— 变纯色孩子会以为换了一块。
  it('题面有介母槽时,i 块盘中入槽都是渐变', () => {
    mount(4, 1) // 🐦 niǎo = n + 介母 i + ao
    expect((screen.getByLabelText('积木 i') as HTMLElement).querySelector('.pblock--dual')).not.toBeNull()
    const { placed } = placeMedial()
    expect(placed?.classList.contains('pblock--dual')).toBe(true)
  })

  // tù 里只有韵母槽,u 就只能是韵腹。给它画渐变是在说一件不成立的事。
  it('题面没有介母槽时,u 块不带渐变', () => {
    mount(1, 2) // 🐰 tù = t + u
    expect(document.querySelectorAll('.pblock--dual')).toHaveLength(0)
    fireEvent.keyDown(screen.getByLabelText('积木 u'), { key: 'Enter' })
    const placed = document.querySelector('[data-slot-id="s0-f"] .pblock')
    expect(placed).not.toBeNull()
    expect(placed?.classList.contains('pblock--dual')).toBe(false)
  })

  it('声调块单独成行,与组合块分开', () => {
    mount(1, 1)
    const toneBlocks = document.querySelectorAll('[aria-label^="声调块"]')
    expect(toneBlocks).toHaveLength(4) // 四调恒全出
  })

  it('点对块会落位,拼齐后亮出拼音答案', async () => {
    const { speak } = mount(1, 0) // 👨 bà
    solveCorrectly()
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
    solveCorrectly()
    expect(await screen.findByText('zhī')).toBeInTheDocument()
    const weld = document.querySelector('.pweld')
    expect(weld).not.toBeNull()
    expect(weld?.classList.contains('pweld--on')).toBe(true)
  })

  it('非整体认读音节不出现焊接标记', async () => {
    mount(1, 0) // 👨 bà
    solveCorrectly()
    await screen.findByText('bà')
    expect(document.querySelector('.pweld')).toBeNull()
  })

  it('双音节词给两组拼装组', () => {
    mount(6, 0) // 🍉 xī guā
    expect(document.querySelectorAll('[data-slot-id][data-slot-id$="-t"]')).toHaveLength(2)
    expect(document.querySelectorAll('[role="group"] [data-slot-id]').length).toBeGreaterThan(3)
  })

  it('提示档「弱」撤掉凹槽的类型色线索', () => {
    render(<PinyinBlocksGame unitIndex={4} levelIndex={0} speak={vi.fn()} hint="weak" />)
    const slots = document.querySelectorAll('[data-slot-id]')
    expect(slots.length).toBeGreaterThan(0)
    for (const s of slots) expect(s.classList.contains('pslot--plain')).toBe(true)
  })

  it('提示档「强」给空槽染类型色', () => {
    render(<PinyinBlocksGame unitIndex={4} levelIndex={0} speak={vi.fn()} hint="strong" />)
    expect(document.querySelector('.pslot--initial')).not.toBeNull()
    expect(document.querySelector('.pslot--medial')).not.toBeNull()
    expect(document.querySelector('.pslot--final')).not.toBeNull()
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
})
