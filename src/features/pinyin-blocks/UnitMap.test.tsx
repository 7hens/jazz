import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ACHIEVEMENTS } from '@/features/achievements'
import { cn } from '@/shared/ui/utils'
import { HAN_TEXT } from '@/shared/testing/han-text'
import { easyLevelsOf, UNITS } from './levels'
import { UnitMap } from './UnitMap'

// 零文本扫描用的正则与它拦什么,统一在 @/shared/testing/han-text(全仓唯一一份)。

// UnitMap 的 props 基座:各用例共用。earned 默认 null(= 还不知道),
// 需要徽章栏的用例自己覆盖 —— 这样「不小心渲染出来了」不会污染别的用例。
const base = { stars: {}, totalStars: 0, badges: ACHIEVEMENTS, earned: null, onPick: vi.fn(), onOpenParent: vi.fn() }

describe('拼音单元地图', () => {
  it('每个单元各占一格:名片用真积木渲染(u1 格为证)', () => {
    render(<UnitMap {...base} />)
    const cells = [...document.querySelectorAll<HTMLElement>('[data-unit-id]')]
    // 钉**身份序列**,不只钉数量:数量相等只是它的推论,而「复制一格 + 删一格」数量照样相等 ——
    // 那种改动下名字里的「每个单元」就是假的,这条断言必须能红。
    expect(cells.map((cell) => cell.dataset.unitId)).toEqual(UNITS.map((unit) => unit.id))
    // 名片是块本体,不是 emoji、不是文字
    expect(cells[0]?.querySelectorAll('.pblock').length).toBe(UNITS[0]!.badge.length)
  })

  // 零文本:孩子读不出「单韵母」三个字,格子只能靠块自表意。
  it('标题与单元名等汉字不出现在地图上', () => {
    const { container } = render(<UnitMap {...base} earned={[]} />)
    const map = container.querySelector('[data-unit-map]')
    // 先断言锚点存在:取不到时下面那句 `?? ''` 会把「锚点被删掉」判成「通过」——
    // 锚点缺失 → querySelector 返回 null → `?? ''` 兜成空串 → 正则恒不匹配 = 静默假绿。
    expect(map, 'data-unit-map 锚点没了,下面的零文本断言就恒绿').not.toBeNull()
    expect(map?.textContent ?? '').not.toMatch(HAN_TEXT)
  })

  it('u1 解锁可点、u2 锁上点不动(只核这两格)', () => {
    const onPick = vi.fn()
    render(<UnitMap {...base} onPick={onPick} />)
    // 按 **id** 取,不按位置取 —— 名字点的是 u1/u2,位置在 `UNITS` 前面插入单元时就会错位
    // (那时 `cells[0]` 是新单元、真正叫 u1 的那格其实是锁着的),断言与名字要的是同一件事。
    const cellOf = (id: string) => document.querySelector<HTMLElement>(`[data-unit-id="${id}"]`)
    expect(cellOf('u1')?.dataset.locked).toBe('false')
    expect(cellOf('u2')?.dataset.locked).toBe('true')
    // 点击目标就是**格子本身**(整格是一个 `<button>`)—— 先断言它真的有 onClick 该有的形状,
    // 否则「锁着点不动」会因为**点了个不响应的 `<div>`** 而通过,而不是因为锁着(空过)。
    expect(cellOf('u2')!.tagName, '格子不是按钮:下面的点击是空过').toBe('BUTTON')
    expect(cellOf('u2')!.hasAttribute('data-unit-start'), '格子不是入口').toBe(true)
    fireEvent.click(cellOf('u2')!)
    expect(onPick).not.toHaveBeenCalled()
    fireEvent.click(cellOf('u1')!)
    // 一个单元只有一个入口 ⇒ 只带单元号,不带「第几部分」—— 起点由 UnitEntry 自己算。
    expect(onPick).toHaveBeenCalledWith(0)
  })

  // 用户口径(2026-09-29):「整个卡片可以点击,而不是只有下面一小块」。
  // 与上一条不同:这里按的是**名片积木**那一带 —— 整格可点之前,这一按什么都不发生。
  it('整格都是点击目标:按在名片积木上也进单元(锁着的那格同样不响应)', () => {
    const onPick = vi.fn()
    const { container } = render(<UnitMap {...base} onPick={onPick} />)
    const badgeOf = (id: string) => container.querySelector(`[data-unit-id="${id}"] .pblock`)
    expect(badgeOf('u1'), '取不到 u1 的名片块,下面的点击会静默空转').not.toBeNull()
    expect(badgeOf('u2'), '取不到 u2 的名片块,下面的点击会静默空转').not.toBeNull()

    fireEvent.click(badgeOf('u2')!)
    expect(onPick, '锁着的单元按名片也该不响应').not.toHaveBeenCalled()

    fireEvent.click(badgeOf('u1')!)
    expect(onPick, '按在名片上没进单元:命中区又缩回底下那一小块了').toHaveBeenCalledWith(0)
  })

  // 一格一个入口,进度只给**整个单元**的一个 `n/总数` —— 这是格子里**唯一**的进度读数。
  // (单元内的三部分是一个整体,地图上不再各占一行;部分名不进地图。)
  // 不画「本关几星」—— 格子放不下 3-7 组三星,而且地图该答的是「这个单元过了几道」。
  // 期望值用 `unit.levels` 现算、不写死数字:课程增删题时断言跟着走,而不是变假绿。
  it('入口显示本单元通过数 / 本单元题数(与星级同源)', () => {
    const unit = UNITS[0]!
    const easy = easyLevelsOf(unit)
    const stars = { [easy[0]!.id]: 2, [easy[1]!.id]: 1 }
    render(<UnitMap {...base} stars={stars} totalStars={20} />)
    const cell = document.querySelector<HTMLElement>('[data-unit-id="u1"]')
    expect(cell, '取不到 u1 格子,下面的断言会静默空转').not.toBeNull()
    // 格子 === 入口(整格一个按钮),读数就在它自己的 textContent 里。
    // 前两道各给一颗以上 → 入口读 `2/单元题数`(星级与计数同源;困难题一颗没给,不进分子)。
    expect(cell!.textContent).toContain(`2/${unit.levels.length}`)
    // 反向守卫:分部分的那几行**必须不在了** —— 留着的话这条用例的上半照样绿(多一行不影响读数)。
    expect(cell!.querySelector('[data-chapter]'), '地图上不该再按部分分行').toBeNull()
  })

  // 整格是一个按钮,**而按钮里不能再套按钮** —— 嵌套的 <button> 是非法 HTML,
  // 浏览器会把 DOM 拆散,孩子点到的可能是半截元素(而且是静默的:jsdom 里查询照样找得到)。
  // 反过来说也不能是「容器 + 里面一小块」:那样命中区就只剩那一小块(见上面那条整格可点的用例)。
  it('一格一个按钮:格子自己就是入口,里面不再套 button', () => {
    const { container } = render(<UnitMap {...base} />)
    for (const unit of UNITS) {
      const cell = container.querySelector<HTMLElement>(`[data-unit-id="${unit.id}"]`)!
      expect(cell.tagName, `${unit.id} 的格子不是按钮`).toBe('BUTTON')
      expect(cell.hasAttribute('data-unit-start'), `${unit.id} 的格子不是入口`).toBe(true)
      const starts = container.querySelectorAll(`[data-unit-id="${unit.id}"] [data-unit-start]`)
      expect(starts.length, `${unit.id} 的格子里还有个「入口」:命中区被拆成两层了`).toBe(0)
      expect(cell.querySelector('button'), '入口里套了 button').toBeNull()
    }
  })

  // 锁定态与可玩态必须在屏幕上分得开 —— 孩子读不出「锁定」二字,这一格全靠那枚图标。
  // 锁是 lucide 的 lock / play:`lucide-*` 类由 lucide-react 自己贴,不是我们写的。
  it('入口:解锁的单元给播放图标,锁着的给锁图标', () => {
    const { container } = render(<UnitMap {...base} />)
    const iconOf = (id: string) => container.querySelector(`[data-unit-id="${id}"] svg`)
    const unlocked = iconOf('u1')
    const locked = iconOf('u2')
    expect(unlocked, '解锁单元的入口没有图标,两态就分不开了').not.toBeNull()
    expect(locked, '锁定单元的入口没有图标,两态就分不开了').not.toBeNull()
    expect(unlocked!.classList.contains('lucide-play'), '解锁单元该是播放图标').toBe(true)
    expect(locked!.classList.contains('lucide-lock'), '锁定单元该是锁图标').toBe(true)
  })

  it('星尘计数带可读标签(星尘 340)', () => {
    render(<UnitMap {...base} totalStars={340} />)
    expect(screen.getByLabelText('星尘 340')).toBeInTheDocument()
  })

  it('点「家长」按钮请求开家长面板', () => {
    const onOpenParent = vi.fn()
    render(<UnitMap {...base} onOpenParent={onOpenParent} />)
    fireEvent.click(screen.getByLabelText('家长'))
    expect(onOpenParent).toHaveBeenCalled()
  })

  /**
   * u7 名片那格的布局预算:**钉住它的输入(含块数这个乘数),不验证布局**。三条边界各自说清:
   *
   * 1) **覆盖什么**:那句算术的**输入**,含块数(乘数)。逐项 = 下面 `CONTRACT` 表 11 行 + 块数上界,
   *    每行注明它在那句算术里管什么(算术本体在 `UnitMap.tsx` 顶部那段注释里):
   *      可用宽 = max-w-2xl(672) − gap-4×2(32) → /列数(grid-cols-2 或 sm:grid-cols-3)
   *              − p-4(32) = 181.33;
   *      (2026-09-29 M3 改造删掉了卡片自带的那条 `border-2`,4px 还回可用宽 —— 177.33 → 181.33。
   *       再给卡片加回描边或任何消耗宽的类,这一段与 `UnitMap.tsx` 顶部那段都要重算。)
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
    render(<UnitMap {...base} />)
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
    // `.pblock` 只由 BlockChip 产出、u7 格子里只有名片行用它(进度条那行里是 lucide 图标,不是块),
    // 所以这个数就是名片块数 —— 若入口那行也换成块,这里会直接翻倍报红。
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

  /**
   * Material 3 视觉契约(2026-09-29 改版)。jsdom 判不出「好不好看」(无 CSS、无布局),
   * 但判得出**这四件还在不在** —— M3 elevated 卡片的定义就是这四条,丢任何一条都只表现为
   * 观感回退、没有任何非视觉信号:`npm test` 全绿而卡片悄悄退回「描边 + 大圆角」。
   * 像素侧(影够不够、色阶分不分得开)仍归走查 W-M2 / W-M3。
   */
  it('单元卡片走 M3 elevated:16dp 圆角 + 色阶填充 + elevation 影 + 状态层', () => {
    const { container } = render(<UnitMap {...base} />)
    const card = container.querySelector<HTMLElement>('[data-unit-id="u1"]')!
    expect(card, '取不到 u1 格子,下面的断言会静默空转').not.toBeNull()
    expect(card.className, '圆角不是 M3 那档(规范 16dp),回了老的大圆角').toContain('rounded-m3-lg')
    expect(card.className, '没走 surface-container 色阶,卡片退回「白底卡片」').toContain(
      'bg-surface-container-low',
    )
    expect(card.className, 'M3 的容器不画描边:有 border 就是又回老路了').not.toMatch(/(?:^| )border(?: |$|-)/)
    expect(card.className, '没有 elevation-1 的影,卡片就浮不起来').toContain('shadow-m3-1')
    expect(card.className, '悬停没抬到 elevation-2,M3 的「按得下去」就没了').toContain('hover:shadow-m3-2')
    expect(card.className, '没有状态层:悬停只剩影在动,底色不动').toContain('m3-state')
  })

  // 锁定态不是「整格压 opacity」—— 那会把名片一起糊掉,而名片是这一格唯一的身份。
  // M3 的 disabled 是**内容**降级、容器不动:撤影 + 图标数字退色,名片只压到 40%。
  it('锁定态撤影、退色,不是整格压 opacity', () => {
    const { container } = render(<UnitMap {...base} />)
    const locked = container.querySelector<HTMLElement>('[data-unit-id="u2"]')!
    const open = container.querySelector<HTMLElement>('[data-unit-id="u1"]')!
    expect(locked.className, '锁着的那格还带影:一眼看不出「不能点」').toContain('shadow-none')
    expect(locked.className, '锁着的那格还叠着状态层:按下去会有反馈,但它不该有反应').not.toContain('m3-state')
    expect(open.className).toContain('m3-state')
    // 名片行的压暗(40%)挂在**名片行**上,不是整格 —— 压整格会连图标数字一起糊掉。
    const badgeRowOf = (id: string) => {
      const block = container.querySelector<HTMLElement>(`[data-unit-id="${id}"] .pblock`)
      expect(block, `${id} 的名片取不到,下面的断言会静默空转`).not.toBeNull()
      return block!.parentElement!
    }
    expect(badgeRowOf('u1').className, '可玩那格的名片被压暗了:它是这一格唯一的身份').not.toContain('opacity-40')
    expect(badgeRowOf('u2').className, '锁定那格的名片没压暗,两态就只差一个图标').toContain('opacity-40')
  })

  // 进度行**没有胶囊底**(2026-09-29 第三次口径:「整个卡片都可以点击,就不需要胶囊来表示点击范围了」)。
  // 那一圈底在整格可点之后只会读成「只有这一小条能点」,正好跟事实相反 —— 它回来 = 产品口径被推翻。
  it('进度行没有胶囊:整格可点,就不再画一个「点击范围」出来', () => {
    const { container } = render(<UnitMap {...base} />)
    const row = (id: string) => {
      // 进度行 = 那枚图标的父元素(不按「第几个孩子」取:名片行数一改就取错人)。
      const icon = container.querySelector<SVGElement>(`[data-unit-id="${id}"] svg`)
      expect(icon, `${id} 的进度图标取不到,下面的断言会静默空转`).not.toBeNull()
      const el = icon!.parentElement
      expect(el, `${id} 的进度行取不到,下面的断言会静默空转`).not.toBeNull()
      return el!
    }
    for (const id of ['u1', 'u2']) {
      const cls = row(id).className
      expect(cls, `${id} 的进度行又画上圆角胶囊了`).not.toContain('rounded-full')
      expect(cls, `${id} 的进度行又有了底色`).not.toMatch(/bg-(?:primary|surface|accent|transparent)/)
      expect(cls, `${id} 的进度行又有了描边`).not.toMatch(/(?:^| )border(?: |$|-)/)
    }
  })

  // 两态的**颜色**分岔:可玩 = 深橙 ▶ + 深字;锁定 = 灰蓝 🔒(这条形状线索必须读得出)+ 更浅的数字。
  it('两态靠颜色分岔:可玩橙 ▶ + 深字,锁定灰 🔒 + 浅字', () => {
    const { container } = render(<UnitMap {...base} />)
    const iconOf = (id: string) => container.querySelector<SVGElement>(`[data-unit-id="${id}"] svg`)!
    const numOf = (id: string) =>
      container.querySelector<HTMLElement>(`[data-unit-id="${id}"] .tabular-nums`)!
    expect(numOf('u1'), '取不到进度数字,下面的断言会静默空转').not.toBeNull()
    // 可玩的橙不能是 --color-accent:它压浅底只有 2.2:1,连图形对象那条 3:1 都不到。
    expect(iconOf('u1').classList.contains('text-accent-ink'), '可玩的 ▶ 不是那个读得出的橙').toBe(true)
    expect(iconOf('u1').classList.contains('text-accent'), '▶ 退回了压浅底读不出的 --color-accent').toBe(false)
    expect(iconOf('u2').classList.contains('text-ink-2'), '锁形图标退不到可读的灰,「不能点」就没线索了').toBe(
      true,
    )
    // 两句都要:「含 text-ink」与「不含 text-ink-3」—— 只断前半句的话,把可玩那格改成 text-ink-3
    // (两格同色)照样绿,而那正是这条用例要拦的那件事(`'text-ink-3'.includes('text-ink')` 为真)。
    expect(numOf('u1').className, '可玩那格的数字不是最深的一档').toContain('text-ink')
    expect(numOf('u1').className, '两格的数字同色了,锁定的那格读起来跟能点的一样').not.toContain('text-ink-3')
    expect(numOf('u2').className, '锁定那格的数字没退浅').toContain('text-ink-3')
  })

  // 「不知道」和「知道且为空」必须在屏幕上给出不同结果 —— 否则 settings 没到位时
  // 徽章栏会先显示成「一个都没拿到」再跳变,那是屏幕上的一句假话。
  it('earned 为 null(还不知道)时整条徽章栏不渲染', () => {
    render(<UnitMap {...base} earned={null} />)
    expect(document.querySelector('[data-achievement-badges]')).toBeNull()
  })

  it('earned 为空数组(知道且为空)时渲染目录全量格、全暗', () => {
    render(<UnitMap {...base} earned={[]} />)
    const badges = [...document.querySelectorAll<HTMLElement>('[data-badge-id]')]
    expect(badges.map((badge) => badge.dataset.badgeId)).toEqual(ACHIEVEMENTS.map((a) => a.id))
    expect(badges.map((badge) => badge.dataset.badgeEarned)).toEqual(ACHIEVEMENTS.map(() => 'false'))
    // 未得格**不画字形**(空圈)。这一句与下面那条用例的第二句合起来,才锁住「两态在孩子眼里分得开」——
    // 只断 data-* 的话,把 emoji 改成无条件渲染(= 两态长得一样)照样全绿,而那正是 brief 的原始形态。
    expect(badges.map((badge) => badge.textContent)).toEqual(ACHIEVEMENTS.map(() => ''))
    // 空位的**底色**:M3 改造给它补了一档色阶填充(原来是半透明白、直接落在天空上)。
    // 这一条同时是上面 `UnitMap.tsx` 那段对比度注释的前提 —— 描边的分母从天空换成了色阶,
    // 那里的数按 `--color-surface-container-high` 重算过;这条填充没了,那些数就又不对了。
    expect(badges[0]!.className, '徽章空位没有色阶填充,描边的分母又变回天空了').toContain(
      'bg-surface-container-high',
    )
  })

  it('已得的格亮起,且只有它亮', () => {
    render(<UnitMap {...base} earned={['perfect_level']} />)
    const lit = [...document.querySelectorAll<HTMLElement>('[data-badge-earned="true"]')]
    expect(lit.map((badge) => badge.dataset.badgeId)).toEqual(['perfect_level'])
    // 「已得」这个信号今天**全靠那枚彩色 emoji**承载(两态共用同一圈描边、内芯亮度只差一点点)——
    // 用 textContent 取,不走 getByText(emoji 在 aria-hidden 的 span 里)。
    expect(lit[0], '没有已得格,下面的字形断言会静默空转').toBeDefined()
    const emoji = ACHIEVEMENTS.find((a) => a.id === 'perfect_level')!.emoji
    expect(lit[0]!.textContent, '已得格里没有那枚图标:两态在屏幕上就分不开了').toContain(emoji)
  })
})
