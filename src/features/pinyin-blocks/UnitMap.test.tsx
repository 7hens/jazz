import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { cn } from '@/shared/ui/utils'
import { HAN_TEXT } from '@/shared/testing/han-text'
import { UNITS } from './levels'
import { UnitMap } from './UnitMap'

// 零文本扫描用的正则与它拦什么,统一在 @/shared/testing/han-text(全仓唯一一份)。

describe('拼音单元地图', () => {
  it('每个单元各占一格:名片用真积木渲染(u1 格为证)', () => {
    render(<UnitMap stars={{}} totalStars={0} onPick={vi.fn()} onOpenParent={vi.fn()} />)
    const cells = [...document.querySelectorAll<HTMLElement>('[data-unit-id]')]
    // 钉**身份序列**,不只钉数量:数量相等只是它的推论,而「复制一格 + 删一格」数量照样相等 ——
    // 那种改动下名字里的「每个单元」就是假的,这条断言必须能红。
    expect(cells.map((cell) => cell.dataset.unitId)).toEqual(UNITS.map((unit) => unit.id))
    // 名片是块本体,不是 emoji、不是文字
    expect(cells[0]?.querySelectorAll('.pblock').length).toBe(UNITS[0]!.badge.length)
  })

  // 零文本:孩子读不出「单韵母」三个字,格子只能靠块自表意。
  it('标题与单元名等汉字不出现在地图上', () => {
    const { container } = render(<UnitMap stars={{}} totalStars={0} onPick={vi.fn()} onOpenParent={vi.fn()} />)
    const map = container.querySelector('[data-unit-map]')
    // 先断言锚点存在:取不到时下面那句 `?? ''` 会把「锚点被删掉」判成「通过」——
    // 锚点缺失 → querySelector 返回 null → `?? ''` 兜成空串 → 正则恒不匹配 = 静默假绿。
    expect(map, 'data-unit-map 锚点没了,下面的零文本断言就恒绿').not.toBeNull()
    expect(map?.textContent ?? '').not.toMatch(HAN_TEXT)
  })

  it('u1 解锁可点、u2 锁上点不动(只核这两格)', () => {
    const onPick = vi.fn()
    render(<UnitMap stars={{}} totalStars={0} onPick={onPick} onOpenParent={vi.fn()} />)
    // 按 **id** 取,不按位置取 —— 名字点的是 u1/u2,位置在 `UNITS` 前面插入单元时就会错位
    // (那时 `cells[0]` 是新单元、真正叫 u1 的那格其实是锁着的),断言与名字要的是同一件事。
    const cellOf = (id: string) => document.querySelector<HTMLElement>(`[data-unit-id="${id}"]`)
    expect(cellOf('u1')?.dataset.locked).toBe('false')
    expect(cellOf('u2')?.dataset.locked).toBe('true')
    fireEvent.click(cellOf('u2') as HTMLElement)
    expect(onPick).not.toHaveBeenCalled()
    fireEvent.click(cellOf('u1') as HTMLElement)
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

  it('零星的关:一颗都不亮,进度数字归零', () => {
    const unit = UNITS[0]!
    render(<UnitMap stars={{ [unit.levels[0]!.id]: 0 }} totalStars={0} onPick={vi.fn()} onOpenParent={vi.fn()} />)
    const cell = document.querySelector<HTMLElement>('[data-unit-id="u1"]')
    expect(cell?.querySelectorAll('.pstar--on')).toHaveLength(0)
    expect(cell?.textContent).toContain(`0/${unit.levels.length}`)
  })

  it('星尘计数带可读标签(星尘 340)', () => {
    render(<UnitMap stars={{}} totalStars={340} onPick={vi.fn()} onOpenParent={vi.fn()} />)
    expect(screen.getByLabelText('星尘 340')).toBeInTheDocument()
  })

  it('点「家长」按钮请求开家长面板', () => {
    const onOpenParent = vi.fn()
    render(<UnitMap stars={{}} totalStars={0} onPick={vi.fn()} onOpenParent={onOpenParent} />)
    fireEvent.click(screen.getByLabelText('家长'))
    expect(onOpenParent).toHaveBeenCalled()
  })

  /**
   * u7 名片那格的布局预算:**钉住它的输入(含块数这个乘数),不验证布局**。三条边界各自说清:
   *
   * 1) **覆盖什么**:那句算术的**输入**,含块数(乘数)。逐项 = 下面 `CONTRACT` 表 11 行 + 块数上界,
   *    每行注明它在那句算术里管什么(算术本体在 `UnitMap.tsx` 顶部那段注释里):
   *      可用宽 = max-w-2xl(672) − gap-4×2(32) → /列数(grid-cols-2 或 sm:grid-cols-3)
   *              − p-4(32) − border-2(4) = 177.33;
   *      需求宽 = 5×w-8(32) + 4×gap-1(4) = 176 ≤ 177.33(**宽度**是约束轴;h-8 只管盒高)。
   *    改这里任何一条 → 必须回去重算那段注释里的算术。
   *
   * 2) **不验证什么**:jsdom 既没有 CSS 也没有布局引擎,像素、折行、级联都测不出来。
   *    产物侧(`npm run build` 后扫 CSS)与 T15 人工冒烟兜底。
   *
   * 3) **知道没守什么**(别把第 1 条读成「全覆盖」):**新加的、消耗宽度的类不在内**。
   *    实测:往格子/网格上再加 `px-8`、`mx-2` 这类消耗宽的类 → 整集全绿。这是**开放的类集合**,
   *    补不完,所以写在这里声明边界而不是往 `CONTRACT` 表里堆。后果是 u7 **折行**而非溢出
   *    (靠名片行的 `flex-wrap`,良性方向)——但「预算被悄悄吃掉」这件事确实没有断言在守。
   */
  it('u7 名片的布局预算:已知的输入都在(不验证布局,只钉输入)', () => {
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

    // 字号覆盖:必须是带 `!` 的那一个(块自己也在这元素上写死 text-[1.75rem],别抓错人)。
    // 分两步问:先只管「接上没有」(不挑单位),再单独挑单位 —— 合成一条的话,
    // 「单位不对」和「压根没接上」会报同一条消息,而后者对前者是**假因**。
    const override = badge!.className.match(/text-\[[^\]]+\]!/)?.[0]
    expect(override, '字号覆盖没接到块上:会回落到 BlockChip 自带的 1.75rem').toBeDefined()
    const size = override!.match(/^text-\[[\d.]+rem\]!$/) ? override : undefined
    expect(
      size,
      `字号覆盖 ${override} 的单位不是 rem:px 这种绝对值不随根字号缩放,孩子调大浏览器字号时这块字不跟着变大`,
    ).toBeDefined()

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

    // 乘数也是输入:上面那句「5×w-8 + 4×gap-1」里的 5 从没被断言过。钉上界而非钉死 ——
    // u7 是最宽的名片(其余单元 1/2/1/2/3/2 块),6 块需 6×32+5×4 = 212 > 177.33,单行设计即失效。
    // 数的是**渲染出来的块**(与 `CONTRACT` 表同源,不从 `UNITS` 反查以免同义反复);
    // `.pblock` 只由 BlockChip 产出、u7 格子里只有名片行用它(星位是 `.pstar`,锁是 emoji),
    // 所以这个数就是名片块数 —— 若星位也换成块,这里会直接翻倍报红。
    const blocks = cell!.querySelectorAll('.pblock')
    expect(blocks.length, '名片块数超过预算:6 块要 212px,超出 177.33 的可用宽,单行设计失效').toBeLessThanOrEqual(5)

    // 字号的**上界**(不是钉某个具体值:0.85→0.9rem 这种微调不该红,那是装饰)。
    // 32px 定宽盒:最长的块面值是 2 字符,粗体下约 0.575em/字符 → 1rem 时约 18px,留有余量;
    // 1.75rem(=28px,块在游戏里的字号)正好是塞不下那档。
    const rem = Number(size!.match(/text-\[([\d.]+)rem\]/)![1])
    expect(rem, `${size} 不是正的 rem 值:0rem 会把块面值缩成看不见`).toBeGreaterThan(0)
    expect(rem, `${size} 塞进 32px 定宽盒会顶格/糊`).toBeLessThanOrEqual(1)
  })

  // `!` 不是为了当前的参数顺序(twMerge 自己就会删掉输家),而是为了**顺序变了也成立**。
  // 参与合并的**两个来源**的字号类都得从源码里读出来 —— 硬编码哪一个,都会和它声称要模拟的那个来源脱钩:
  // 块自己那支一旦也带上 `!`,硬编码的不带 `!` 的 `text-[1.75rem]` 照样被调用方压住,用例绿着放行。
  it('名片字号覆盖不依赖 cn 的参数顺序', () => {
    const src = (file: string) =>
      readFileSync(join(process.cwd(), 'src/features/pinyin-blocks', file), 'utf8')
    const badge = src('UnitMap.tsx').match(/const BADGE_BOX = '([^']*)'/)?.[1]
    expect(badge, 'BADGE_BOX 没了,下面的断言会静默空转').toBeDefined()
    const size = badge!.match(/text-\[[^\]]+\]!?/)?.[0]
    expect(size, 'BADGE_BOX 里没有字号类').toBeDefined()
    // 块自带的字号是三元分支(`isTone ? … : …`),名片块走**非声调**那支 —— 取冒号后面那支。
    const chipBranch = src('BlockChip.tsx').match(/isTone \? '[^']*' : '([^']*)'/)?.[1]
    expect(chipBranch, 'BlockChip.tsx 的非声调字号分支没解析到,下面的断言会静默空转').toBeDefined()
    const chipSize = chipBranch!.match(/text-\[[^\]]+\]!?/)?.[0]
    expect(chipSize, 'BlockChip.tsx 非声调那支里没有字号类').toBeDefined()
    // 倒序 = 调用方 className 排在块自己写死的字号之前。这正是没有 `!` 会失守的那一格。
    expect(
      cn(badge!, `pblock font-extrabold ${chipSize}`),
      `调用方字号被块自己写死的 ${chipSize} 盖掉了`,
    ).toContain(size)
  })
})
