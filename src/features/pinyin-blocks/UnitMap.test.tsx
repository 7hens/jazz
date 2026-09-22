import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { cn } from '@/shared/ui/utils'
import { UNITS } from './levels'
import { UnitMap } from './UnitMap'

/**
 * 「零文本」要拦的是**读不出的汉字文本**,不只是 CJK 基本区:
 * 只写 [一-鿿](= U+4E00–9FFF)时,中文标点「，。」、扩展 A「㐀」、全角「Ａ」、兼容表意整类漏过。逐段对应:
 *   \p{Script=Han}  → 基本区 + 扩展 A–H + 兼容表意(繁体「單」同区,一并拦,且无需枚举扩展区码位)
 *   U+3000–303F     → CJK 标点(。「」)
 *   U+FF00–FFEF     → 全角/半角形式(Ａ，ａ)
 *   U+2E80–2EFF / U+31C0–31EF → CJK 部首 / 笔画
 * ★(U+2605)与 🔒(U+1F512)刻意落在所有区间之外 —— 它们是地图自己的形状语义,不是文字。
 */
const HAN_TEXT = /[\p{Script=Han}\u3000-\u303f\uff00-\uffef\u{2e80}-\u{2eff}\u{31c0}-\u{31ef}]/u

describe('拼音单元地图', () => {
  it('七个单元各占一格,名片用真积木渲染', () => {
    render(<UnitMap stars={{}} totalStars={0} onPick={vi.fn()} onOpenParent={vi.fn()} />)
    const cells = document.querySelectorAll('[data-unit-id]')
    expect(cells).toHaveLength(UNITS.length)
    // 名片是块本体,不是 emoji、不是文字
    expect(cells[0]?.querySelectorAll('.pblock').length).toBe(UNITS[0]!.badge.length)
  })

  // 零文本:孩子读不出「单韵母」三个字,格子只能靠块自表意。
  it('标题与单元名等汉字不出现在地图上', () => {
    const { container } = render(<UnitMap stars={{}} totalStars={0} onPick={vi.fn()} onOpenParent={vi.fn()} />)
    const map = container.querySelector('[data-unit-map]')
    // 先断言锚点存在:取不到时下面那句 `?? ''` 会把「锚点被删掉」判成「通过」——
    // 同样的坑在 stone.test.ts 里写着(那里是先断言 marker 存在,免得 indexOf 返回 -1 让断言静默空转)。
    expect(map, 'data-unit-map 锚点没了,下面的零文本断言就恒绿').not.toBeNull()
    expect(map?.textContent ?? '').not.toMatch(HAN_TEXT)
  })

  it('只解锁 u1:其余格子锁上且点不动', () => {
    const onPick = vi.fn()
    render(<UnitMap stars={{}} totalStars={0} onPick={onPick} onOpenParent={vi.fn()} />)
    const cells = document.querySelectorAll<HTMLElement>('[data-unit-id]')
    expect(cells[0]?.dataset.locked).toBe('false')
    expect(cells[1]?.dataset.locked).toBe('true')
    fireEvent.click(cells[1] as HTMLElement)
    expect(onPick).not.toHaveBeenCalled()
    fireEvent.click(cells[0] as HTMLElement)
    expect(onPick).toHaveBeenCalledWith(0)
  })

  // 一格里的星位 = 该单元的关卡数;亮几颗 = 通了几关。
  // 不画「本关几星」—— 格子放不下 3-7 组三星,而且地图该答的是「这格过了多少」。
  it('通关的格子亮起对应颗数,没通的留着暗星位', () => {
    const unit = UNITS[0]!
    const stars = { [unit.levels[0]!.id]: 2, [unit.levels[1]!.id]: 1 }
    render(<UnitMap stars={stars} totalStars={20} onPick={vi.fn()} onOpenParent={vi.fn()} />)
    const cell = document.querySelector<HTMLElement>('[data-unit-id="u1"]')
    expect(cell?.querySelectorAll('.pstar')).toHaveLength(unit.levels.length)
    expect(cell?.querySelectorAll('.pstar--on')).toHaveLength(2)
    // 进度数字与亮星数一致
    expect(cell?.textContent).toContain(`2/${unit.levels.length}`)
  })

  it('零星的关只留暗星位', () => {
    const unit = UNITS[0]!
    render(<UnitMap stars={{ [unit.levels[0]!.id]: 0 }} totalStars={0} onPick={vi.fn()} onOpenParent={vi.fn()} />)
    const cell = document.querySelector<HTMLElement>('[data-unit-id="u1"]')
    expect(cell?.querySelectorAll('.pstar--on')).toHaveLength(0)
    expect(cell?.textContent).toContain(`0/${unit.levels.length}`)
  })

  it('星尘计数显示在顶部', () => {
    render(<UnitMap stars={{}} totalStars={340} onPick={vi.fn()} onOpenParent={vi.fn()} />)
    expect(screen.getByLabelText('星尘 340')).toBeInTheDocument()
  })

  it('齿轮开家长面板', () => {
    const onOpenParent = vi.fn()
    render(<UnitMap stars={{}} totalStars={0} onPick={vi.fn()} onOpenParent={onOpenParent} />)
    fireEvent.click(screen.getByLabelText('家长'))
    expect(onOpenParent).toHaveBeenCalled()
  })

  // 常量**值**可以是对的而**接线**是断的:把 className={BADGE_BOX} 的传参删掉,
  // 常量还在、源码形态没变,名片却回到 BlockChip 自带的 1.75rem —— u7 溢出回归,全套仍绿。
  // 这条从渲染结果里读,同时钉住宽度轴(w-8 才是布局预算的约束轴,h-8 不是)。
  it('名片尺寸真的挂到了块上(宽度轴 + 字号覆盖)', () => {
    render(<UnitMap stars={{}} totalStars={0} onPick={vi.fn()} onOpenParent={vi.fn()} />)
    const badge = document.querySelector('[data-unit-id="u7"] .pblock')
    expect(badge, '取不到 u7 的名片块,下面的断言会静默空转').not.toBeNull()
    const cls = badge!.className
    expect(cls, '盒子宽度跑了:5×32+4×4=176 是那句预算算术的约束轴').toContain('w-8')
    expect(cls, '盒子高度跑了:预算算术的输入之一是 h-8').toContain('h-8')
    expect(cls, '字号覆盖没接到块上:会回落到 BlockChip 自带的 1.75rem').toMatch(/text-\[[^\]]+\]!/)
  })

  // `!` 不是为了当前的参数顺序(twMerge 自己就会删掉输家),而是为了**顺序变了也成立**。
  // 读源码里实际的字号类再喂进 cn,才能在源码丢掉 `!` 时真的红。
  it('名片字号覆盖不依赖 cn 的参数顺序', () => {
    const badge = readFileSync(join(process.cwd(), 'src/features/pinyin-blocks/UnitMap.tsx'), 'utf8')
      .match(/const BADGE_BOX = '([^']*)'/)?.[1]
    expect(badge, 'BADGE_BOX 没了,下面的断言会静默空转').toBeDefined()
    const size = badge!.match(/text-\[[^\]]+\]!?/)?.[0]
    expect(size, 'BADGE_BOX 里没有字号类').toBeDefined()
    // 倒序 = 调用方 className 排在块自己写死的 text-[1.75rem] 之前。这正是没有 `!` 会失守的那一格。
    expect(
      cn(badge!, 'pblock font-extrabold text-[1.75rem]'),
      '调用方字号被块自己写死的字号盖掉了',
    ).toContain(size)
  })
})
