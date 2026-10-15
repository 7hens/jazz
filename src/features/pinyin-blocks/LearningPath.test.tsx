import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
// 开关的字面量锚:从被测源码原文取,不 import 常量本身(理由见下面那条用例的注释)
import sharedAchievementsSource from '@/shared/services/achievements.ts?raw'
import { ACHIEVEMENTS } from '@/features/achievements'
import type { LevelStars } from '@/shared/services'
import { HAN_TEXT } from '@/shared/testing/han-text'
import { UNITS, SECTIONS, pathLessons } from './levels'
import { LearningPath } from './LearningPath'

const base = {
  stars: {} as LevelStars,
  totalStars: 0,
  badges: ACHIEVEMENTS,
  earned: null as readonly string[] | null,
  onPickLesson: vi.fn(),
  onPickPractice: vi.fn(),
  onOpenParent: vi.fn(),
}

const renderPath = (stars: LevelStars = {}) => render(<LearningPath {...base} stars={stars} />)

/**
 * 徽标落在半圆的圆心上（`LearningPath` 的设计：x = STAGE_W/2，y = 该单元弧心高度），
 * 于是徽标的定位坐标本身就是「圆心在哪」的答案 —— 拿它当基准去校验节点是否在弧上。
 */
function circleCenters(container: HTMLElement): { cx: number; cyByUnit: Map<string, number> } {
  const badges = [...container.querySelectorAll<HTMLElement>('[data-unit-badge]')]
  expect(badges.length, '取不到单元徽标,下面的圆心基准就无从谈起').toBe(UNITS.length)
  const cx = parseFloat(badges[0]!.style.left)
  const cyByUnit = new Map(badges.map((b) => [b.dataset.unitBadge!, parseFloat(b.style.top)]))
  return { cx, cyByUnit }
}

/**
 * 单元徽标 + 标题这一整块的**排版契约**(2026-10-15 起标题也进算)。
 *
 * 抽出成一个函数而不是就地断言,是为了让下面那条**注入验证**能用同一把尺子量两次:
 * 断言里若把算式写在 `expect` 里,"红"这件事就只能靠人手改源码复现;抽出来之后,
 * 注入用例直接把渲染结果的字号改大再量一次 —— 那才是真的证明这把尺子量到了标题。
 *
 * 三条,都从**有限的量**推出来(舞台宽 / 弧间距 / 弧半径),没有任何对比度或像素阈值:
 *   ① **横向**:徽标或标题的半宽,都不许越过中心到舞台边缘的距离。
 *   ② **纵向**:「徽标 + 留白 + 标题」这一整块的高度,不许吃掉相邻两枚之间的间距。
 *      ⚠️ 改前这条只量徽标(96px),净空 194px;加了标题之后**它才是那个真正的约束**
 *      —— 标题是这两条里唯一还在长的一项(徽标翻倍过一次,标题迟早也会调)。
 *   ③ **标题不许压到轨道**:半圆在标题那一高度的横坐标是 `sqrt(r² - Δy²)`,
 *      轨道从那里再往里吃半个轨宽。徽标不受这条约束(它落在**圆心**上,与弧相距一个半径),
 *      标题却正落在弧下缘那一带 —— 所以这一条是**加标题之后才有的**新约束。
 *
 * **标题宽度怎么估**:jsdom 没有排版引擎,量不出字形宽。取**上界**:一个字符最宽是一个全宽字,
 * 于是「字符数 × 字号」是它真实宽度的上界。中文单元名(「ü 行韵母 · 两点去留」)几乎全是全宽,
 * 这个上界离真值只差一点;拉丁字母与空格窄于全宽,所以上界永远偏保守 —— 宁可判红不可放过。
 */
function layoutFaults(container: HTMLElement): string[] {
  const { cx, cyByUnit } = circleCenters(container)
  const faults: string[] = []
  const titles = [...container.querySelectorAll<HTMLElement>('[data-unit-title]')]
  const badge = container.querySelector<HTMLElement>('[data-unit-badge]')!

  // 舞台宽:从徽标往上找第一个写了 inline width 的祖先。
  let stage: HTMLElement | null = badge.parentElement
  while (stage && !stage.style.width) stage = stage.parentElement
  if (!stage) return ['找不到舞台容器 —— 徽标不该被挪出舞台,否则定位基准全变了']
  const stageW = parseFloat(stage.style.width)

  const badgeBox = parseFloat(badge.style.fontSize) * 16
  if (!(badgeBox > 0)) return ['徽标字形盒算不出来 —— 字号那行被改了?']

  // 标题的三个数:字号(rem→px)、上沿(px)、**每一行各自的**宽度上界。
  const titleBox = parseFloat(titles[0]!.style.fontSize) * 16
  const titleTop = parseFloat(titles[0]!.style.top)
  // ⚠️ **半宽必须逐行算,不许拿第一行套全部** —— 12 个单元名长度差得很远
  // (「单韵母」3 字 vs「ü 行韵母 · 两点去留」11 字,差 3.7 倍)。拿最短那行当全体的上界,
  // 最长那行的压轨道余量会被**低估三倍多**,哨兵就成了摆设:它照样绿,而图已经撞上了。
  // 这不是洁癖 —— 下面 ③ 正是靠半宽判「标题有没有压到轨道」。
  const halfOf = (t: HTMLElement) => ((t.textContent ?? '').length * titleBox) / 2
  // leading-none ⇒ 单行盒高 = 字号。`whitespace-nowrap` 保证它永远只有这一行
  // (一旦折行,盒高变成两倍,下面三条算的就全错了)。
  const titleH = titleBox
  // 徽标下沿 → 标题上沿的留白,从两者的定位坐标反推(**不写死数字**:改组件里的
  // TITLE_GAP 会带着这里一起走,只量得出一处就够)。
  const gap = titleTop - (cyByUnit.get(badge.dataset.unitBadge!)! + badgeBox / 2)

  // ① 横向
  const roomX = Math.min(cx, stageW - cx)
  if (badgeBox / 2 > roomX) faults.push(`徽标横向溢出舞台(半宽 ${badgeBox / 2} > ${roomX})`)
  // 横向同样逐行算 —— 最长那行才是会溢出的那一行。
  const widest = titles.reduce((acc, t) => Math.max(acc, halfOf(t)), 0)
  if (widest > roomX) faults.push(`单元标题横向溢出舞台(最宽半宽 ${widest} > ${roomX})`)

  // ② 纵向:整块(徽标 + 留白 + 标题)不许吃掉相邻两枚之间的间距。
  const blockH = badgeBox / 2 + gap + titleH
  const tops = [...cyByUnit.values()].sort((a, b) => a - b)
  const spacing = Math.min(...tops.slice(1).map((t, i) => t - tops[i]!))
  if (blockH > spacing) faults.push(`徽标+标题这一整块纵向重叠(占 ${blockH} > 间距 ${spacing})`)

  // ③ 标题不许压到轨道:取它最靠下的那枚单元,量弧在该高度的横坐标。
  const d = container.querySelector('path.lp-track')?.getAttribute('d') ?? ''
  const r = parseFloat(d.match(/A ([\d.]+) [\d.]+/)![1] ?? '')
  const trackW = parseFloat(container.querySelector('path.lp-track')!.getAttribute('stroke-width') ?? '')
  const worst = titles.reduce((acc, t) => {
    const cy = cyByUnit.get(t.dataset.unitTitle!)!
    // 标题盒的下沿离圆心最远 —— 弧在那儿收得最窄,是最紧的一处。
    const dy = Math.max(0, parseFloat(t.style.top) + titleH - cy)
    return Math.max(acc, halfOf(t) - (Math.sqrt(Math.max(0, r * r - dy * dy)) - trackW / 2))
  }, 0)
  if (worst > 0) faults.push(`单元标题压到了轨道上(超出 ${worst}px)`)

  return faults
}

describe('完整多邻国路径', () => {
  it('12 个单元徽标 + 46 个节点 + 12 个练习入口', () => {
    const { container } = renderPath()
    // 地图上不再按 section 分组 —— 一条连续路径贯穿全部 58 个卡位
    expect(container.querySelectorAll('[data-unit-badge]')).toHaveLength(UNITS.length)
    expect(container.querySelectorAll('[data-lesson-id]')).toHaveLength(46)
    expect(container.querySelectorAll('[data-practice-unit]')).toHaveLength(12)
  })

  it('路径是一串首尾相接的半圆：每个单元一条 A，全程没有直线段', () => {
    const { container } = renderPath()
    // 必须按 class 取:页头那颗星（lucide Star）自带 <svg><path>，它排在轨道前面
    const d = container.querySelector('path.lp-track')?.getAttribute('d') ?? ''
    expect(d, '缺少轨道路径 d').not.toBe('')
    // 只 M 一次,之后全是续写的 A：一条 d 就是一个连通子路径
    expect(d.match(/M/g), '多于一个 M ⇒ 路径断成了几截').toHaveLength(1)
    expect(d.match(/A/g), 'A 的条数应等于单元数').toHaveLength(UNITS.length)
    // 一旦出现 L/H/V,相邻两个半圆之间就不是相切的了 —— 那正是要消灭的竖直连接段
    expect(d, '路径里混进了直线段').not.toMatch(/[LHV]/)
  })

  it('三态:一道题没做时只有第 1 个节点是 current，其余全 locked', () => {
    const { container } = renderPath()
    expect(container.querySelectorAll('[data-lesson-state="current"]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-lesson-state="cleared"]')).toHaveLength(0)
    expect(container.querySelectorAll('[data-lesson-state="locked"]')).toHaveLength(45)
  })

  it('当前节点之后一律锁着：点它不回调', () => {
    const onPickLesson = vi.fn()
    const { container } = render(<LearningPath {...base} onPickLesson={onPickLesson} />)
    const locked = container.querySelector<HTMLElement>('[data-lesson-state="locked"]')!
    expect(locked, '取不到锁着的节点,下面是一次空过').not.toBeNull()
    fireEvent.click(locked)
    expect(onPickLesson).not.toHaveBeenCalled()
  })

  it('全通时没有 current，且每个节点都可重玩', () => {
    const all = Object.fromEntries(pathLessons().flatMap((l) => l.levelIds).map((id) => [id, 1]))
    const { container } = renderPath(all)
    expect(container.querySelectorAll('[data-lesson-state="current"]')).toHaveLength(0)
    expect(container.querySelectorAll('[data-lesson-state="cleared"]')).toHaveLength(46)
  })

  it('练习入口：本单元一道 <3 星的题都没有时不亮，点它不回调', () => {
    const unit = UNITS[0]!
    const stars = Object.fromEntries(unit.levels.map((l) => [l.id, 3]))
    const onPickPractice = vi.fn()
    const { container } = render(<LearningPath {...base} stars={stars} onPickPractice={onPickPractice} />)
    const entry = container.querySelector<HTMLElement>('[data-practice-unit="u1"]')!
    expect(entry, '取不到 u1 的练习入口,下面的断言会静默空转').not.toBeNull()
    expect(entry.dataset.practiceLit).toBe('false')
    fireEvent.click(entry)
    expect(onPickPractice).not.toHaveBeenCalled()

    const other = container.querySelector<HTMLElement>('[data-practice-unit="u2"]')!
    expect(other.dataset.practiceLit).toBe('true')
    fireEvent.click(other)
    expect(onPickPractice).toHaveBeenCalledWith('u2')
  })

  /**
   * 「零文本」这条不变量的**边界** —— 2026-10-15 从「零」改成「**有限白名单 + 范围契约**」。
   *
   * **为什么不写成「除这一处外不许有汉字」**:那类断言一律得靠"先挖洞再扫"实现
   * (`textContent.replace(...)`),挖掉的字符串一旦有人改文案就对不上,红得莫名其妙。
   *
   * **这里用的是更强的一种写法**:扫遍路径页里**每一个元素的自身文本子节点**,把命中汉字的
   * 那些元素**收集成一个列表**,断这个列表**恰好等于**单元标题那 12 行。
   *   · 「自身文本子节点」而不是整棵树的 `textContent` —— 否则根节点永远"含汉字",断言退化成
   *     「页面上有汉字」,等于没写(与 `PinyinBlocksGame.test.tsx` 那条是同一手)。
   *   · 这一步是**完备**的:任何一段可见汉字,必定落在某个元素的某个文本子节点里。
   *     所以"收集结果等于白名单"同时断掉了「多出别处的字」和「白名单里的字少了」。
   *
   * **白名单是什么、为什么**:单元标题(`data-unit-title`,`UNITS[].name`)。产品裁定
   * 2026-10-15「路径徽章标记下面要加上章节标题」—— 每枚徽标代表一个单元,徽标本身
   * `aria-hidden` 纯装饰,不写字的话孩子看到十二枚图却不知道自己在哪一段。
   * 它属不属于 `docs/walkthrough.md` §C 那三类除外里的**第三类「功能性文字」**:**属于** ——
   * 它只回答「这是什么」,不读照样玩得下去(路径的推进由节点三态图标与关卡页那一行承担)。
   * 已登记进 §C 的白名单,与关卡页那行「关名 · 第 n/N 遍」同类。
   *
   * **段名不在白名单里**,也不在图上:段是课程的分组,地图是一条连续的蛇形路径,
   * 屏上没有任何一处标出段的分界(段头/簇头名片行早已整族删除);凭空补一行段名等于
   * 宣称一条不存在的线,且 7 段里 5 段只含一个单元,段名与单元名同字。
   */
  it('零文本(有限白名单):路径页里的汉字恰好是 12 行单元标题,别处一个字都没有', () => {
    const { container } = renderPath()
    const path = container.querySelector('[data-learning-path]') as HTMLElement
    expect(path, 'data-learning-path 锚点没了,上面的白名单扫描就恒绿').not.toBeNull()

    // 自身文本子节点里带汉字的**全部**元素 —— 判据完备,不靠"先挖洞再扫"。
    const carriers = [...path.querySelectorAll<HTMLElement>('*')].filter((el) =>
      [...el.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && HAN_TEXT.test(node.textContent ?? '')),
    )

    // ① 恰好 12 行,一个不多一个不少(少一行 = 有单元没标题;多一行 = 别处混进了汉字)。
    expect(carriers).toHaveLength(UNITS.length)
    // ② 每一行都是单元标题,内容**逐一等于**该单元的名字。
    for (const el of carriers) {
      expect(el.dataset.unitTitle, `有个元素带汉字却不是单元标题:<${el.tagName.toLowerCase()}>「${el.textContent}」`).toBeDefined()
    }
    expect(carriers.map((el) => el.textContent)).toEqual(UNITS.map((u) => u.name))
  })

  it('点「家长」按钮请求开家长面板', () => {
    const onOpenParent = vi.fn()
    render(<LearningPath {...base} onOpenParent={onOpenParent} />)
    fireEvent.click(screen.getByLabelText('家长'))
    expect(onOpenParent).toHaveBeenCalled()
  })

  it('星尘计数带可读标签(星尘 340)', () => {
    render(<LearningPath {...base} totalStars={340} />)
    expect(screen.getByLabelText('星尘 340')).toBeInTheDocument()
  })

  // ── 徽章栏:三态下**恒不出现** ─────────────────────────────────────────────
  // 2026-10-13 产品口径「徽章列表放在首页有点丑」⇒ `ACHIEVEMENTS_VISIBLE = false`。
  // 原来那三条钉的是「怎么画」(null 不画 / 空数组全暗 / 已得亮起),现在钉的是**「压根不画」**:
  // 钉「不出现」而不是删掉用例 —— 删了就再没人守它不会偷偷回来。
  it('earned 三态(未知 / 空 / 已得)下徽章栏恒不渲染(成就总开关关着)', () => {
    for (const earned of [null, [], ['perfect_level']] as const) {
      const { container, unmount } = render(<LearningPath {...base} earned={earned} />)
      // 锚点先判在:锚点被改名的话下面那句「查不到」会恒绿,变成空过
      expect(container.querySelector('[data-learning-path]'), 'data-learning-path 锚点没了').not.toBeNull()
      expect(
        document.querySelectorAll('[data-achievement-badges]'),
        `earned = ${JSON.stringify(earned)} 时徽章栏仍出现了 —— 开关没生效?`,
      ).toHaveLength(0)
      expect(document.querySelectorAll('[data-badge-id]')).toHaveLength(0)
      unmount()
    }
  })

  /**
   * 字面量锚:把「开关确实是 false」钉死在**被测源码的文本**上。
   *
   * 写法照 `features/api/api.test.ts` 那条 `LEVEL_ID` 漂移锚:常量从 `?raw` 里**按文本正则取**,
   * 不在这里 import 也不在这里再抄一份 —— 抄一份的话,把常量改成 true 时测试里那份不会跟着动,
   * 断言就成了两处字面量在对话,锚不住任何东西。
   */
  it('成就可见性总开关当前是 false(2026-10-13 临时隐藏,成就链仍在跑)', () => {
    const declared = /export const ACHIEVEMENTS_VISIBLE = (\w+)/.exec(sharedAchievementsSource)?.[1]
    expect(
      declared,
      '没在 src/shared/services/achievements.ts 里搜到 `export const ACHIEVEMENTS_VISIBLE = ...` —— 搜法失效或常量被改名,请让本测试与源码同步',
    ).toBeDefined()
    // 只在这里比对字面量:上面那行证明源码里真是这个声明,这里证明它真的是 false
    expect(declared, '成就可见性总开关不再为 false:徽章栏/成就弹层/家长面板目录会一起冒出来 —— 若这是有意的,顺手把 docs/walkthrough.md 里那 7 条改回去').toBe('false')
  })

  // ── 顶栏固定(2026-10-13 产品口径「星尘行固定在顶部,不要随页面滚动」)──
  // jsdom 没有 CSS 引擎,渲染出来的类名**不等于**样式生效。所以分两半钉:
  // 上面那条钉 DOM 结构(满宽出血包着居中列),下面那组读 index.css 文本钉材质。
  it('顶栏固定层:满宽出血的一层包着居中列(左右留白从页面根搬进了固定层内部)', () => {
    const { container } = renderPath()
    const page = container.querySelector('[data-learning-path]')!
    const bar = page.querySelector(':scope > [data-path-topbar]')
    expect(bar, '固定层不是页面根的直接子节点 —— 它上方一旦有别的层,sticky 的参照就变了').not.toBeNull()

    // 满宽靠负 margin 抵消页面根的 px-4。**不是 100vw**:那把滚动条宽度也算进去,
    // 桌面端会多出一条横向滚动 —— 所以这里钉的是 -mx-4。
    expect(bar!.className, '固定层没出血:路径内容会从两侧那条缝里露出来').toContain('-mx-4')

    // 留白与居中列**搬进内层**:改回「只给行加 sticky」的话这两句会红,而缝就漏了。
    const inner = bar!.firstElementChild as HTMLElement
    expect(inner.className, '内层没拿回左右留白').toContain('px-4')
    expect(inner.className, '内层不是居中列,顶栏会与下面的路径对不齐').toContain('max-w-2xl')

    // 一行没被拆散:星尘胶囊 / 段计数圈 / 家长键仍然同属内层这一行
    expect(inner.querySelector('[data-total-progress]'), '段计数圈跑到固定层外面了').not.toBeNull()
    expect(inner.querySelector('[aria-label="家长"]'), '家长键跑到固定层外面了').not.toBeNull()
    expect(screen.getByLabelText('星尘 0'), '星尘胶囊不在固定层里').toBeInTheDocument()
  })

  it('顶栏抬起:没滚不加、滚了才加、回顶又收(固定住却毫无反馈 = 孩子以为页面卡住)', () => {
    const { container } = renderPath()
    const bar = () => container.querySelector('[data-path-topbar]')!
    expect(bar().className, '页面还没滚就已经抬着了 —— 顶端那一档必须和平时一模一样').not.toContain('lp-topbar--lifted')

    // jsdom 的 window.scrollY 是只读 getter,得覆写才能造出「滚下去了」;
    // 末了设回 0,别把这一档漏给后面的用例。
    const scrollTo = (y: number) => Object.defineProperty(window, 'scrollY', { value: y, configurable: true })
    scrollTo(240)
    act(() => { fireEvent.scroll(window) })
    expect(bar().className, '滚下去了顶栏没抬').toContain('lp-topbar--lifted')

    scrollTo(0)
    act(() => { fireEvent.scroll(window) })
    expect(bar().className, '滚回顶端没收').not.toContain('lp-topbar--lifted')
  })

  it('总进度读数仍是 n/m(可见数字,配整组可读标签)', () => {
    const { container } = renderPath()
    const progressEl = container.querySelector('[data-total-progress]')
    expect(progressEl).not.toBeNull()
    const progressText = progressEl!.querySelector('.tabular-nums')?.textContent
    expect(progressText).toMatch(/^\d+\/\d+$/)
    // 圆点是纯形状,读屏读不出「12/46」—— 整组的标签是这个数的唯一出口。
    expect(progressEl!.querySelector('[data-path-tally]')?.getAttribute('aria-label')).toBe(
      `总进度 ${progressText}`,
    )
  })

  /**
   * 一段一个圈、7 颗;一颗的亮面随段内完成度长满(2026-10-13 产品口径
   * 「放到星尘那一行,以圆圈的进度表示」)。钉的是**颗数 / 一段一颗 / 两态**,
   * 亮面那几度是 CSS 变量,jest/jsdom 判不出好不好看,交给走查条目人眼判。
   */
  it('段计数圈:7 颗一段一颗,一颗的空/满两态跟着段内已通节数走', () => {
    const { container } = renderPath()
    const dots = [...container.querySelectorAll<HTMLElement>('[data-section-id]')]
    expect(dots, '取不到段计数圈,下面几句会静默空转').toHaveLength(SECTIONS.length)
    // 一段一颗,顺序 = 段序。46 节若逐节画则是 46 颗 —— 这条断言就是那个决定的护栏。
    expect(dots.map((d) => d.dataset.sectionId)).toEqual(SECTIONS.map((s) => s.id))

    // 一道题没做:7 颗全空(亮面 0%),没有一颗满圈。
    for (const dot of dots) {
      expect(dot.style.getPropertyValue('--lp-tally-fill')).toBe('0%')
      expect(dot.classList.contains('lp-tally-dot--full')).toBe(false)
    }

    // 通掉第一段的每一节 ⇒ 第一颗满,其余照旧空。
    const firstSection = SECTIONS[0]!
    const stars = Object.fromEntries(
      pathLessons()
        .filter((l) => firstSection.unitIds.includes(l.unitId))
        .flatMap((l) => l.levelIds.map((id) => [id, 1])),
    )
    const { container: after } = renderPath(stars as LevelStars)
    const lit = [...after.querySelectorAll<HTMLElement>('[data-section-id]')]
    expect(lit[0]!.style.getPropertyValue('--lp-tally-fill')).toBe('100%')
    expect(lit[0]!.classList.contains('lp-tally-dot--full')).toBe(true)
    expect(lit.filter((d) => d.classList.contains('lp-tally-dot--full'))).toHaveLength(1)
  })

  it('当前节点有 lp-node--current（最大 + 跳动）', () => {
    const { container } = renderPath()
    const current = container.querySelector('[data-lesson-state="current"]')!
    expect(current.className).toContain('lp-node--current')
  })

  it('58 个卡位全部精确落在所属半圆上：到圆心的距离恒等于半径', () => {
    const { container } = renderPath()
    const d = container.querySelector('path.lp-track')?.getAttribute('d') ?? ''
    // 半径就是 d 里 A 指令的 rx
    const r = parseFloat(d.match(/A ([\d.]+) [\d.]+/)![1]!)
    expect(r).toBeGreaterThan(0)

    const { cx, cyByUnit } = circleCenters(container)
    const unitOfLesson = new Map<string, string>()
    for (const lesson of pathLessons()) unitOfLesson.set(lesson.id, lesson.unitId)

    // lesson 与练习入口共用同一套 space-around 卡位，所以一起验
    const nodes = [
      ...[...container.querySelectorAll<HTMLElement>('[data-lesson-id]')].map((n) => ({
        id: n.dataset.lessonId!,
        unitId: unitOfLesson.get(n.dataset.lessonId!),
        el: n,
      })),
      ...[...container.querySelectorAll<HTMLElement>('[data-practice-unit]')].map((n) => ({
        id: `练习 ${n.dataset.practiceUnit!}`,
        unitId: n.dataset.practiceUnit!,
        el: n,
      })),
    ]
    expect(nodes).toHaveLength(58)

    for (const { id, unitId, el } of nodes) {
      const cy = cyByUnit.get(unitId ?? '')
      expect(cy, `${id} 找不到所属单元的圆心`).toBeDefined()
      const dx = parseFloat(el.style.left) - cx
      const dy = parseFloat(el.style.top) - cy!
      // 这条断言守的是「真的是半圆」：曾经因为 viewBox 被横向压扁，
      // 弧看着像一段斜坡而节点还按圆算的距离摆,两者就对不上了。
      expect(Math.hypot(dx, dy), `${id} 不在 u${unitId} 的弧上`).toBeCloseTo(r, 6)
    }
  })

  it('已通关的对勾窄于已走过的路面：不切断那条橙金带', () => {
    // 只点亮第 1 节 ⇒ 既有 cleared 节点,又有 lp-done 路面可比。
    // 一节可能含多道题,必须整节点亮,否则 lessonState 仍判它 current。
    const firstLesson = pathLessons()[0]!
    const { container } = renderPath(Object.fromEntries(firstLesson.levelIds.map((id) => [id, 1])))
    const done = container.querySelector('path.lp-done')
    expect(done, '没有已走过的路面,这条断言会静默空转').not.toBeNull()
    const roadWidth = parseFloat(done!.getAttribute('stroke-width') ?? '')
    const cleared = container.querySelector<HTMLElement>('[data-lesson-state="cleared"]')
    expect(cleared, '没有已通关节点,这条断言会静默空转').not.toBeNull()
    expect(parseFloat(cleared!.style.width)).toBeLessThan(roadWidth)
  })

  // 2026-10-14 产品裁定「太小了」⇒ 字号翻倍(3 → 6 rem)。**尺寸本身不该被钉死**(下次还要调),
  // 真正该守的是**「装得下」**:舞台宽与弧间距是**有限的**,emoji 与标题都不是 ——
  // 放大到某个点上就会横向溢出舞台、纵向盖住相邻那枚、或(标题这一支)压到轨道上。
  // **这条是那个点的哨兵**,钉的是关系不是数值。
  //
  // 2026-10-15 标题加进来之后,它守的不再是「一枚徽标」而是「**徽标 + 标题这一整块**」。
  // 为什么必须扩:净空是 290 − 96 = 194px,标题挂在徽标**下方**直接吃这一段;
  // 只守徽标的话,标题可以是任何字号都不红 —— 那条哨兵等于对新加的那一半失明。
  //
  // 为什么不用对比度/尺寸阈值那套:判据是「排版还成立」,可从几何直接算出来,不需要人眼。
  it('徽标 + 标题放大后仍装得下:横向不溢出舞台/不压轨道,纵向不与相邻那枚重叠', () => {
    const { container } = renderPath()
    expect(layoutFaults(container)).toEqual([])
  })

  /**
   * 上面那条哨兵的**注入验证** —— 它真的量到了标题,不是只在标题缺席时恒绿。
   *
   * 做法:把渲染结果里 12 行标题的字号按倍数放大到**必然重叠**,再用**同一把尺子**量一次。
   * 「必然重叠」是算出来的,不是猜的:纵向那条要求「徽标半高 + 留白 + 标题盒高 ≤ 290」,
   * 代入徽标 96px、留白 8px ⇒ 标题字号超过 234px(≈14.6rem)就一定红;这里取 18rem
   * (=288px),远在越界那一侧。改的是**真实渲染出来的 inline style**,不是 mock。
   * 末了复原,别把这一档漏给后面的用例(与上面「顶栏抬起」那条同一纪律)。
   */
  it('哨兵注入:标题字号放大到必然重叠时,上面那条判据真的转红', () => {
    const { container } = renderPath()
    expect(layoutFaults(container), '没注入之前就红着:这条注入证明的前提没了').toEqual([])

    const titles = [...container.querySelectorAll<HTMLElement>('[data-unit-title]')]
    expect(titles, '取不到单元标题,注入的是空气').toHaveLength(UNITS.length)
    const restore = titles.map((el) => {
      const before = el.style.fontSize
      el.style.fontSize = '18rem'
      return () => { el.style.fontSize = before }
    })

    const faults = layoutFaults(container)
    restore.forEach((put) => put())
    expect(layoutFaults(container), '复原之后仍然是红的:注入过程把状态漏掉了').toEqual([])

    expect(faults, '标题放到 18rem 居然还判「装得下」—— 哨兵没把标题算进去,②③ 两条都是空转').not.toEqual([])
    // 断的是**纵向那条**:标题盒 288px + 徽标半高 48 + 留白 8 = 344 > 弧间距 290 ⇒ 相邻两枚必然重叠。
    expect(faults.some((f) => f.includes('纵向重叠')), `没红在纵向那条上,红在哪:${faults.join(' / ')}`).toBe(true)
  })

  it('每个单元徽标下面挂着一行**自己的**单元名(12 个逐一核对)', () => {
    const { container } = renderPath()
    for (const unit of UNITS) {
      const title = container.querySelector<HTMLElement>(`[data-unit-title="${unit.id}"]`)
      expect(title, `${unit.id} 徽标下面没有标题 —— 产品裁定「路径徽章标记下面要加上章节标题」`).not.toBeNull()
      expect(title!.textContent, `${unit.id} 的标题不是单元名`).toBe(unit.name)
    }
    // 逐一枚举 + 断总数:少一行会被上面那个循环抓住,多一行靠这一句。
    expect(container.querySelectorAll('[data-unit-title]')).toHaveLength(UNITS.length)
  })

  it('标题住在自己那个单元的容器里,不会串到隔壁单元', () => {
    const { container } = renderPath()
    for (const unit of UNITS) {
      const host = container.querySelector<HTMLElement>(`[data-unit-header="${unit.id}"]`)
      expect(host, `${unit.id} 没有单元容器 —— 标题就没有归属`).not.toBeNull()
      const inside = [...host!.querySelectorAll<HTMLElement>('[data-unit-title]')]
      expect(inside, `${unit.id} 的容器里挂了 ${inside.length} 行标题,应为 1 —— 标题被复制或串位了`).toHaveLength(1)
      // 两个方向都要断:标签指向自己、且内容是**自己**的名字。
      expect(inside[0]!.dataset.unitTitle).toBe(unit.id)
      expect(inside[0]!.textContent).toBe(unit.name)
      // 反向:单元名在整个路径页里只出现在这一行(串行的话必然有一行的名字出现在别的容器里)。
      const elsewhere = [...container.querySelectorAll<HTMLElement>('[data-unit-title]')].filter(
        (el) => el.dataset.unitTitle !== unit.id && el.textContent === unit.name,
      )
      expect(elsewhere, `${unit.name} 出现在别的单元下面了`).toHaveLength(0)
    }

    // 徽标与标题的**顺序**也断一下:标题跟着徽标一路往下,不会插到上一个单元里去。
    const badgeIds = [...container.querySelectorAll<HTMLElement>('[data-unit-badge]')].map((b) => b.dataset.unitBadge)
    const titleIds = [...container.querySelectorAll<HTMLElement>('[data-unit-title]')].map((t) => t.dataset.unitTitle)
    expect(titleIds).toEqual(badgeIds)
  })

  it('标题是纯文字:不挂底板(底板已随徽标整族裁定去掉,不许借标题回来)', () => {
    const { container } = renderPath()
    const title = container.querySelector<HTMLElement>('[data-unit-title]')!
    const tokens = title.className.split(/\s+/)
    // ⚠️ 按 **class token** 判,不能按子串:`lp-badge-float`(徽标的漂浮动画)含有 `lp-badge`
    // 这个子串,按子串判会把「徽标还在动」误判成「牌回来了」。
    for (const forbidden of ['lp-badge', 'bg-surface', 'rounded-full', 'shadow', 'border']) {
      expect(tokens, `标题挂了 ${forbidden} —— 徽标底板已整族裁定去掉,标题也不许自带一块托底`).not.toContain(forbidden)
    }
    expect(title.style.backgroundColor, '标题有了内联底色 —— 同上,「不托底」是这一支的形状').toBe('')
    expect(title.style.boxShadow, '标题有了内联影 —— 同上').toBe('')
  })

  it('徽标是每个单元一枚 emoji，落在圆心上', () => {
    const { container } = renderPath()
    const { cx, cyByUnit } = circleCenters(container)
    for (const unit of UNITS) {
      const badge = container.querySelector<HTMLElement>(`[data-unit-badge="${unit.id}"]`)!
      expect(parseFloat(badge.style.left), `${unit.id} 徽标没落在圆心的 x 上`).toBe(cx)
      expect(parseFloat(badge.style.top), `${unit.id} 徽标没落在圆心的 y 上`).toBe(cyByUnit.get(unit.id)!)
      expect(badge.textContent, `${unit.id} 徽标是空的`).toBe(unit.emoji)
    }
  })
})

/**
 * 材质段的读者:直接读 `src/index.css` 的文本。
 *
 * jsdom 没有 CSS 引擎,渲染出来的类名**不等于**样式生效 —— 凡是「这套材质配方还在不在」的断言
 * 都只能落到源码文本上(与 `material.test.ts` 同一套路;也因此**不能**用 `?raw` import:
 * vitest 默认把 CSS 打成空壳,读回来是空的)。
 */
const indexCss = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')

/**
 * 取**顶层**那一条规则的规则体。选择器顶格才算数 —— 玻璃档与「减少透明」降级档用的是
 * 同一个选择器、只是缩进两格嵌在 @supports / @media 里,那两条由下面那个 `ruleIn` 取。
 * 行首锚定同样是防「追加一条同选择器规则(0-1-0 后写的赢)让读到的还是第一条」那个坏法。
 */
const bodyOf = (from: number) =>
  // **剥掉注释**:规则体里的注释会提到属性名(比如兜底档那条写着「没有 backdrop-filter 的
  // 浏览器」),不剥的话「这条规则没声明过 backdrop-filter」会被自己的注释判红。
  // 与 material.test.ts 那个「材质段不写颜色字面量」用例同一手(它也先 replace 掉注释)。
  indexCss.slice(from, indexCss.indexOf('}', from)).replace(/\/\*[\s\S]*?\*\//g, '')

/** 取一条顶层规则的规则体,并**先钉住它唯一**(0-1-0 后写的赢:追加同选择器规则就能让读到的还是第一条)。 */
const ruleOf = (sel: string) => {
  const lit = `\n${sel}`
  expect(indexCss.split(lit).length - 1, `${JSON.stringify(lit)} 在 index.css 里数出来的条数不对(顶层规则的选择器顶格)`).toBe(1)
  return bodyOf(indexCss.indexOf(lit))
}

/**
 * 取某个 at-rule 块**里面**那一条规则的规则体(玻璃档 / 降级档都靠它),并带上它在文件里的位置。
 *
 * 匹配的是「at-rule 头 + 紧跟着那条选择器」这个**组合**:同名的 at-rule 头在文件里不止一处
 * (`.glass` 那两支早就有一个 `prefers-reduced-transparency` 块),只按头去 `indexOf` 会取到
 * 别人的块。组合字面全局唯一,顺带也钉了「那条规则就紧跟在块头下面」。
 */
const ruleIn = (blockHeader: string) => {
  const lit = `${blockHeader}\n  .lp-topbar {`
  const at = indexCss.indexOf(lit)
  expect(at, `index.css 里找不到「\`${blockHeader}\` 紧跟 .lp-topbar」那一处 —— 那一档被整条删了,或不再紧跟块头`).toBeGreaterThan(-1)
  expect(indexCss.split(lit).length - 1, `${JSON.stringify(lit)} 数出来不止一处 —— 同一条规则被复制到了两个 at-rule 块里`).toBe(1)
  // 从**选择器**开始取,不是从块头开始:块头自己就写着 `backdrop-filter: blur(1px)) or
  // (-webkit-backdrop-filter: …)`,把它算进规则体,「这条规则声明过 -webkit-backdrop-filter」
  // 这类断言就会被块头判绿 —— 而块头里那两个是**条件**,不是声明。
  return { body: bodyOf(indexCss.indexOf('\n  .lp-topbar {', at)), at }
}

/**
 * 单元徽标的**底板** —— 2026-10-14 产品裁定**整块去掉**,徽标现在是一枚裸 emoji 浮在天空上。
 *
 * 这一段留着的不是「牌长什么样」的断言,而是**「底板不许回来」**的守卫。理由写在
 * `index.css` 那段注里,一句话版本:
 *
 *   **判断口径错了三轮。** 此前一直用**亮度对比度**判「看不看得清」,而人眼分辨颜色主要靠
 *   **色相**。11 枚单元徽标里只有 🦢(白鹅)是**既无色相差、又无亮度差**的(压 `#bfe3ff` 仅 1.34:1,
 *   唯一真正隐形的一枚);🐱橘猫 1.77、🍉瓜绿 2.39、🍊橙 1.85 这些**按亮度全部不达标、按色相却
 *   一眼可辨**。而**任何一块平色底板都必然和 emoji 内部的某一档等亮度** —— 真实 emoji 是三档亮度
 *   (深 0.02 / 中 ~0.30 / 白 1.00),「一底托两族」这个前提从一开始就不成立。底板自己还引入了
 *   新问题(饱和蓝牌面在糖果天空里「不搭」,产品三次目视否掉)。
 *
 *   真正的修法是**换掉那只没有色相差的 emoji**(u1:🦢 → 🏡,见 `levels.ts`),不是给 11 枚各配一块底。
 */
describe('单元徽标不再有底板(2026-10-14 裁定)', () => {
  const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')

  it('`.lp-badge` 这一族已不存在:徽标上没有底色、没有光泽、没有厚度边、没有落影', () => {
    // 四层材质逐条断 —— 它们当初是为了让「一块贴纸」读成「一枚糖果」而加的,现在一律不许回来。
    expect(css, '`.lp-badge` 规则又回来了 —— 底板解决不了色相差问题,只会在天空里「不搭」')
      .not.toContain('.lp-badge {')
    expect(css, '`.lp-badge` 的变量回来了').not.toContain('--lp-badge-face')
    expect(css, '`.lp-badge` 的变量回来了').not.toContain('--lp-badge-edge')
  })

  it('徽标也不再挂任何牌类 —— 它是一枚裸 emoji,不是「一块底板 + 一只图」', () => {
    const { container } = renderPath()
    const badge = container.querySelector<HTMLElement>('[data-unit-badge]')!
    expect(badge, '徽标不见了 —— 先确认这是刻意删除,而不是渲染崩了').not.toBeNull()
    // ⚠️ 必须按 **class token** 判,不能按子串 —— `lp-badge-float`(漂浮动画)含有 `lp-badge`
    // 这个子串,按子串判会把「动画还在」误判成「牌还在」。
    const tokens = badge.className.split(/\s+/)
    expect(tokens, '徽标又挂上牌类了 —— 底板已被裁定去掉').not.toContain('lp-badge')
    // 没有底板就不需要方框尺寸;留一个 width/height 会让人以为它还是一枚牌。
    expect(badge.style.width, '徽标还有 width —— 没有底板时方框尺寸没有意义').toBe('')
    expect(badge.style.height, '徽标还有 height —— 同上').toBe('')
  })

  // ⚠️ **源码契约,不是观感断言** —— 2026-10-15 产品报「emoji 太靠左了,也没垂直对齐」。
  // 成因是**两处居中叠加**:徽标 div 挂着 Tailwind 的 `-translate-x-1/2 -translate-y-1/2`,
  // 而 Tailwind v4 把它们编译成 **`translate` 属性**(不是 `transform`);同一时刻
  // `lp-badge-float` 又在 `transform` 里写了同一个 `translate(-50%, -50%)`。
  // **`translate` 属性与 `transform` 先后施加、两者叠加** ⇒ 同一个 -50% 打了两遍。
  //
  // jsdom 没有排版,量不出偏移 —— 但**这个成因是纯源码可判的**,所以钉源码:
  // 居中只能由工具类负责,keyframes 只许做那 4px 的浮动。
  // ⚠️ **反过来(删工具类、只留 keyframes 居中)也是错的**:`prefers-reduced-motion` 把
  // `animation-iteration-count` 压到 1,动画一结束 `fill-mode: none` ⇒ transform 整个失效,
  // 减动效的用户会看到徽标失去居中。**两条要一起断**,少一条就有人改回错的那版。
  it('徽标的浮动动画不自带居中位移(与工具类的 translate 叠加会偏一格)', () => {
    const kf = ruleOf('@keyframes lp-badge-float')
    expect(
      kf,
      'keyframes 里又写上了居中位移 —— 它与 `-translate-x-1/2 -translate-y-1/2` 施加同一个 -50%,' +
        '而两者走的是 `translate` 属性与 `transform`,**叠加生效** ⇒ 徽标左上各偏一格',
    ).not.toMatch(/translate\(\s*-50%/)
    // 工具类那半边必须还在:居中不能只押在 keyframes 上(减动效时那个 transform 会失效)。
    const { container } = renderPath()
    const tokens = container.querySelector<HTMLElement>('[data-unit-badge]')!.className.split(/\s+/)
    expect(tokens, '徽标丢了 -translate-x-1/2 —— 减动效下它就再也居不中了').toContain('-translate-x-1/2')
    expect(tokens, '徽标丢了 -translate-y-1/2 —— 同上').toContain('-translate-y-1/2')
  })

  it('漂浮动画保留(它是运动,不是底板)', () => {
    const { container } = renderPath()
    const badge = container.querySelector<HTMLElement>('[data-unit-badge]')!
    expect(badge.className, '漂浮动画被一起去掉了 —— 它与底板无关').toContain('lp-badge-float')
  })
})

/**
 * 顶栏固定层的**材质**。jsdom 没有 CSS 引擎,渲染不出样式,所以这一层只能读
 * `index.css` 的文本 —— 与 `material.test.ts` 同一套路(那边比的是块面,这边比的是顶栏;
 * 也因此**不能**用 `?raw` import:vitest 默认把 CSS 打成空壳,读回来是空的)。
 *
 * 钉的是**那几个决策**,不是像素:是否真的贴顶、玻璃配方全不全(半透明 + blur + saturate +
 * `-webkit-` 前缀)、不支持时退成什么、安全区垫在哪一层、z 高不高得过路径节点、
 * 抬起态靠不靠动。这些一旦被改回去,后果在屏幕上各不相同且显眼,而本文件对它们零感知。
 */
describe('顶栏固定层的材质(index.css 文本)', () => {
  const SUPPORTS_GLASS = '@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {'
  const REDUCED_TRANSPARENCY = '@media (prefers-reduced-transparency: reduce) {'

  it('固定层:sticky 贴顶 + 安全区垫在这一层上', () => {
    const bar = ruleOf('.lp-topbar {')
    expect(bar, '没固定:那行会跟着页面一起滚走').toContain('position: sticky')
    expect(bar, '没贴顶:sticky 而不写 top 就是永远不粘').toContain('top: 0')
    // 安全区垫在**这一层**上:刘海那条要盖住,被推下来的应该是内容而不是盖板。
    expect(bar, '安全区没垫在固定层上 —— 有刘海的机器上内容会从刘海后面露出来').toContain(
      'padding-top: env(safe-area-inset-top',
    )
  })

  it('固定层的 z 高过路径节点那一档:节点要从顶栏底下穿过去,不能压在顶栏上面', () => {
    const bar = ruleOf('.lp-topbar {')
    const z = Number(bar.match(/z-index:\s*(\d+)/)?.[1])
    expect(Number.isFinite(z), '固定层没写 z-index').toBe(true)
    // 节点与练习入口那一档是 z-10(组件里的 Tailwind 类);比它低就会被节点压住顶栏。
    expect(z, '固定层压在路径节点之下:滚下去时节点会盖在顶栏上面').toBeGreaterThan(10)
  })

  // 产品裁定(2026-10-13,看过实物后):「应该是覆盖的半透明玻璃特效」。
  // 这一条钉的是**配方齐全** —— 少任何一样各有各的坏结果:少了半透明 = 实色板;
  // 少了 blur = 背后清晰内容直接压到字上;少了 saturate = 饱和色被平均成灰,读出来是脏
  // 而不是玻璃;少了 `-webkit-` 前缀 = iOS/Safari 上整层**完全透明**(比不做玻璃更糟)。
  it('玻璃配方齐全:半透明底 + blur + saturate + -webkit- 前缀', () => {
    // 「玻璃档写在 @supports 里」这件事由下面那个组合字面本身证明:`ruleIn` 找的是
    // 「@supports 头 + 紧跟 .lp-topbar」,找不到就红 —— 不支持的浏览器压根走不到这里,
    // 直接吃顶层那条不透明兜底(下一条钉)。
    const glass = ruleIn(SUPPORTS_GLASS).body
    expect(glass, '玻璃档的底色不是半透明的 —— 那是实色板,不是玻璃').toMatch(
      /background-color:\s*color-mix\(in srgb, var\(--color-canvas\) \d+%, transparent\)/,
    )
    expect(glass, '玻璃档没写 -webkit-backdrop-filter —— iOS/Safari 上这层会完全透明,背后内容糊在星尘数字上').toContain(
      '-webkit-backdrop-filter:',
    )
    expect(glass, '没写未加前缀的 backdrop-filter —— 非 Safari 的浏览器读不到').toMatch(
      /[^-\w]backdrop-filter:/,
    )
    expect(glass, '玻璃档缺 saturate —— 只模糊不提升饱和度,背后那些饱和色被平均成灰,读出来是脏不是玻璃').toMatch(
      /[^-\w]backdrop-filter:[^;]*saturate\(/,
    )
    // 半径封顶:全宽 backdrop-filter 的代价随半径涨,而 16px 已经买够「抹掉 20px 小图形」。
    const radii = [...glass.matchAll(/blur\((\d+(?:\.\d+)?)px\)/g)].map((m) => Number(m[1]))
    expect(radii.length, '读不到 blur 半径').toBeGreaterThan(0)
    expect(Math.max(...radii), 'blur 半径超过 20px:买不来更多可读性,只买更贵的中枢合成').toBeLessThanOrEqual(20)
  })

  // 降级:绝不能是「半透明底 + 没有模糊」—— 那看起来就是 bug(背后清晰内容压着字),
  // 而不是设计。这一条钉的是「退成**不透明**」,并且两条退路退到**同一个**颜色。
  it('不支持 backdrop-filter / 系统要减少透明时:都退成不透明,不是半透明没模糊', () => {
    const base = ruleOf('.lp-topbar {')
    expect(base, '兜底档不是不透明的 —— 没有 backdrop-filter 的机器上这一层会退成透明的').toMatch(
      /background-color:\s*var\(--color-canvas\)\s*;/,
    )
    expect(base, '兜底档自己带了 backdrop-filter —— 它该是「什么都没有」的那一档').not.toContain(
      'backdrop-filter',
    )

    // 这一句同时守两件事:少透明那一档在不在(不在 = 用户自己少了一条逃生口),
    // 以及它排在玻璃档的哪一边。
    const reduced = ruleIn(REDUCED_TRANSPARENCY)
    expect(reduced.at, '少透明那一档不见了 —— 用户自己就少了一条逃生口(设备卡不卡该由用户判断,不由我们猜)').toBeGreaterThan(-1)
    // 少透明档必须**排在玻璃档之后**:同特异性下后写的才赢,顺序反了等于玻璃盖掉用户的设置。
    expect(
      reduced.at,
      '少透明档排在玻璃档之前 —— 同特异性下后写的赢,顺序反了玻璃会盖掉用户的设置',
    ).toBeGreaterThan(ruleIn(SUPPORTS_GLASS).at)
    expect(reduced.body, '少透明档没把模糊撤掉 —— 只撤底色那一条不成立').toContain('backdrop-filter: none')
    // 两档退到同一个不透明色 ⇒ 两种退化看起来是同一块板,不是两种设计。
    expect(reduced.body, '少透明档与兜底档退成了两种不同的色 —— 同一种「看不清」该有同一个退路').toMatch(
      /background-color:\s*var\(--color-canvas\)\s*;/,
    )
  })

  // 「减动效下必须退化到两态可读」在这里是**结构性地**成立的:抬起态不用 animation /
  // transition / transform,两态的差别只在 box-shadow 的形状上。全局那条
  // prefers-reduced-motion 压的正是这三样,所以不需要额外的兜底分支 ——
  // 一旦有人把它改成纯动效方案(比如滚动时才淡入),减动效会把它抹平,这条会红。
  // 玻璃之后这一层更要紧了:半透明 + 模糊本来就把「浮在内容之上」这件事说弱了,
  // 抬起态是这一层**唯一**明确说「我在上面」的信号。
  it('抬起态靠形状差(一条细线 + 一层影),不靠动:减动效下两态照样可读', () => {
    const lifted = ruleOf('.lp-topbar--lifted {')
    expect(lifted, '抬起态没有形状差,两态就分不出来').toContain('box-shadow')
    // 细线那层是唯一在深浅两主题都读得出来的一半(亮色是深线、暗色是浅线)。
    expect(lifted, '抬起态缺那条随主题翻转的细线 —— 暗色主题里影近乎不可见,那一档靠它兜').toContain(
      '0 1px 0 var(--color-hairline-strong)',
    )
    for (const motion of ['animation', 'transition', 'transform', '@keyframes']) {
      expect(lifted, `抬起态用了 ${motion} —— 减动效下会被抹平,两态就分不出来`).not.toContain(motion)
    }
  })

  // 题面图那一圈 `radial-gradient` 光圈底板 —— 2026-10-14 **整块去掉**,与路径页徽标底板同批。
  //
  // 留着这段的不是「光圈长什么样」的断言,而是**「它不许回来」**的守卫。来历一句话版本:
  //
  //   **判断口径错了三轮。** 此前一直用**亮度对比度**判「看不看得清」,而人眼分辨颜色主要靠
  //   **色相**。鹅🦢/云☁️/雪❄️/米🍚/月🌙 这批**白与浅色系**在浅蓝天空上确实撞(既无色相差也无
  //   亮度差);而 🐱橘猫、🍉瓜绿、🍊橙这些**按亮度全部不达标、按色相却一眼可辨**。
  //   底板是为**全部** emoji 铺的场,却只在那一族上起作用 —— 在另外十枚上是有代价无收益。
  //
  //   **而底板解决不了色相差**:任何平色底板都必然和 emoji 内部的某一档**等亮度**。真实 emoji
  //   是**三档亮度**(深 0.02 / 中 ~0.30 / 白 1.00)不是两档 —— 「一底托两族」这个前提从一开始
  //   就不成立,深色底面让 🐱🍉 达标却让 🕷️ 垮掉。
  //
  // 曾经为它钉过的那几条(`z-index: -1` 的绘制顺序、`isolation: isolate`、`em` 尺寸无关、
  // 颜色只走 token)全是**同一个底板的不同侧面**。底板没了,它们连同那条已知的绘制顺序陷阱
  // (伪元素第 6 步会盖住行内 emoji 第 5 步 —— 产品实测报过「光晕怎么成了前景覆盖了 emoji」)
  // **一起失效**;下面改成断「这些东西都别再回来」。
  it('题面图不再有光圈底板:那一族伪元素、那圈渐变、那套层叠上下文都不许回来', () => {
    // ⚠️ **先剥掉注释再断言**:`index.css` 里那几段来历注**必然要提到** `.pemoji::before` /
    // `z-index: -1` / `isolation: isolate` 这些词(不写下来下一个人就会重新发明一遍)。
    //   断的是「**这些规则还在不在**」,不是「这些词还在不在文件里」。
    const src = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
    expect(src, '`.pemoji::before` 又回来了 —— 底板只为白/浅色那一族起作用,对另外十枚是有代价无收益')
      .not.toContain('.pemoji::before')
    expect(src, '`.pemoji` 本体又回来了').not.toContain('.pemoji {')
    expect(src, '底板回来了:那圈 radial-gradient').not.toMatch(/radial-gradient\([\s\S]{0,200}transparent 56%/)
    // ⚠️ 这两条是**同一个陷阱的两半**:`::before` 不带 z-index 时是绘制顺序第 6 步的定位元素,
    //   会盖住宿主的行内 emoji(第 5 步);`isolation` 只在有底板要压时才有意义,
    //   留着会让人以为底下还有东西要压。
    expect(src, '`z-index: -1` 又回来了 —— 它只服务于那圈已删的底板').not.toMatch(/z-index:\s*-1/)
    expect(src, '`isolation: isolate` 又回来了 —— 同上,它只服务于那圈已删的底板').not.toContain('isolation: isolate')
    // 也不要「换个名字复活」:任何伪元素垫底都要重新面对绘制顺序与三档亮度那两条。
    expect(src, '题面图又出现了伪元素垫底 —— 先读上面那段,再决定要不要它')
      .not.toMatch(/\.(level-pic|pic)[\w-]*::(before|after)/)
  })

  // 落地影**只在题面图上**,徽标身上一层 filter 都不留 —— 徽标带 `lp-badge-float` 无限动画,
  // filter 每帧重算,挂上去是白花的合成。
  // (类名 2026-10-14 从旧名改为 `.level-pic`:`.pemoji` 已随那圈光圈一并删除,
  //  留一个没有宿主的修饰类名会让人以为还有那么一条规则。)
  it('落地影是独立修饰类,只有一处 drop-shadow,且长度用 em', () => {
    const grounded = ruleOf('.level-pic {')
    expect(grounded, '落地影修饰类没了 —— 题面图改前那记朝下的影会一并消失').toContain('filter')
    expect(grounded.match(/drop-shadow\(/g)?.length ?? 0, '落地影不止一层 —— 题面图不需要更多,每多一层多一份合成').toBe(1)
    const lengths = [...grounded.matchAll(/(?<![-\w.])(\d*\.?\d+)(px|rem|em)\b/g)].map((m) => m[0])
    expect(lengths.length, '读不到落地影的尺寸').toBeGreaterThan(0)
    expect(lengths.filter((l) => !l.endsWith('em')), `这些长度不是 em:${lengths.filter((l) => !l.endsWith('em')).join(', ')}`).toEqual([])
  })

  // 性能对策的可判部分:玻璃自己**不做动画**,也不做层级提升。背后每帧都在变,再叠一层
  // 自己的动画或 will-change 是白花的合成 —— 而老平板正是我们要护的那批设备。
  // 另外两条对策不在这里判:半径上限由「玻璃配方齐全」那条钉,两条退路由降级那条钉。
  it('玻璃层自己不做动画/过渡/层级提升(性能对策①)', () => {
    const glass = ruleIn(SUPPORTS_GLASS).body
    for (const motion of ['animation', 'transition', 'will-change', 'transform']) {
      expect(glass, `玻璃层用了 ${motion} —— 背后每帧都在变,再叠一层自己的动画/提升是白花的合成`).not.toContain(motion)
    }
  })
})
