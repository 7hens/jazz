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

  /**
   * 整格契约:**把 u7 名片那格布局预算的每一个输入一次读齐**,每行注明它在那句算术里管什么
   * (算术本体在 `UnitMap.tsx` 顶部那段注释里):
   *   可用宽 = max-w-2xl(672) − gap-4×2(32) → /列数(grid-cols-2 或 sm:grid-cols-3)
   *            − p-4(32) − border-2(4) = 177.33;
   *   需求宽 = 5×w-8(32) + 4×gap-1(4) = 176 ≤ 177.33(**宽度**是约束轴;h-8 只管盒高)。
   * 少一个输入,那句算术就不成立 —— 这一类漏了三轮,故一次钉齐,不再一轮补一个类。
   *
   * **这条测试只钉「输入没被改动」,不验证布局**:jsdom 既没有 CSS 也没有布局引擎,
   * 像素、折行、级联都测不出来。产物侧(`npm run build` 后扫 CSS)与 T15 人工冒烟兜底。
   * 改这里任何一条 → 必须回去重算那段注释里的算术。
   */
  it('u7 名片的布局预算:每个输入都在(不验证布局,只钉输入)', () => {
    render(<UnitMap stars={{}} totalStars={0} onPick={vi.fn()} onOpenParent={vi.fn()} />)
    const cell = document.querySelector('[data-unit-id="u7"]')
    expect(cell, '取不到 u7 格子,下面的断言会静默空转').not.toBeNull()
    // 网格是格子的父元素、名片行是块的父元素:这么取才钉得住「接线」,而不是只钉常量的值。
    const grid = cell!.parentElement
    expect(grid, 'u7 格子没有父元素,取不到网格').not.toBeNull()
    const badge = cell!.querySelector('.pblock')
    expect(badge, '取不到 u7 的名片块').not.toBeNull()
    const row = badge!.parentElement
    expect(row, '取不到名片行的容器').not.toBeNull()

    // 字号覆盖:必须是带 `!` 的那一个(块自己也在这元素上写死 text-[1.75rem],别抓错人)
    const size = badge!.className.match(/text-\[[\d.]+rem\]!/)?.[0]
    expect(size, '字号覆盖没接到块上:会回落到 BlockChip 自带的 1.75rem').toBeDefined()

    const token = (t: string) => new RegExp(`(?:^| )${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?: |$)`)
    const CONTRACT: readonly (readonly [string, string, string, string])[] = [
      ['网格可用宽封顶', grid!.className, 'max-w-2xl', '177.33 的被除数 672:改小 = 可用宽变少'],
      ['网格列数(窄屏)', grid!.className, 'grid-cols-2', '375px 手机走这档'],
      ['网格列数(≥sm)', grid!.className, 'sm:grid-cols-3', '那个 /3'],
      ['网格列间距', grid!.className, 'gap-4', '可用宽里减 2×16=32'],
      ['格子内边距', cell!.className, 'p-4', '可用宽里再减 32'],
      ['格子描边', cell!.className, 'border-2', 'border-box 下再减 4(R1 就是漏了它)'],
      ['块的宽', badge!.className, 'w-8', '约束轴:5×32 + 4×4 = 176'],
      ['块的高', badge!.className, 'h-8', '盒高 32(非约束轴)'],
      ['块的字号覆盖', badge!.className, size!, '缩盒不缩字 = 28px 字塞进 32px 盒'],
      ['名片行间距', row!.className, 'gap-1', '需求宽里的 4×4'],
      ['名片行换行', row!.className, 'flex-wrap', '≤640px 的唯一安全网:176 > 156 时靠它折行,而不是被 flex-shrink 压窄'],
    ]
    for (const [what, cls, t, why] of CONTRACT) {
      expect(cls, `${what}:丢了 ${t} —— ${why}`).toMatch(token(t))
    }

    // 字号的**上界**(不是钉某个具体值:0.85→0.9rem 这种微调不该红,那是装饰)。
    // 32px 定宽盒:最长的块面值是 2 字符,粗体下约 0.575em/字符 → 1rem 时约 18px,留有余量;
    // 1.75rem(=28px,块在游戏里的字号)正好是塞不下那档。
    const rem = Number(size!.match(/text-\[([\d.]+)rem\]/)![1])
    expect(rem, '字号得写 rem').toBeGreaterThan(0)
    expect(rem, `${size} 塞进 32px 定宽盒会顶格/糊`).toBeLessThanOrEqual(1)
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
