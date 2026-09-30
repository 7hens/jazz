import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ACHIEVEMENTS } from '@/features/achievements'
import type { LevelStars } from '@/shared/services'
import { cn } from '@/shared/ui/utils'
import { HAN_TEXT } from '@/shared/testing/han-text'
import { UNITS, pathLessons } from './levels'
import { LearningPath } from './LearningPath'

// 零文本扫描用的正则与它拦什么,统一在 @/shared/testing/han-text(全仓唯一一份)。

// LearningPath 的 props 基座:各用例共用。earned 默认 null(= 还不知道),
// 需要徽章栏的用例自己覆盖 —— 这样「不小心渲染出来了」不会污染别的用例。
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

describe('三层路径', () => {
  it('7 个段头 + 46 个节点 + 12 个练习入口', () => {
    const { container } = renderPath()
    expect(container.querySelectorAll('[data-section-id]')).toHaveLength(7)
    expect(container.querySelectorAll('[data-lesson-id]')).toHaveLength(46)
    expect(container.querySelectorAll('[data-practice-unit]')).toHaveLength(12)
  })

  it('12 个单元簇，其中 9 个画簇头（单单元段不画）', () => {
    const { container } = renderPath()
    expect(container.querySelectorAll('[data-unit-cluster]')).toHaveLength(12)
    // S1/S3/S7 各只有一个单元 ⇒ 段头已经把本段全部名片画完了,再画一遍是纯冗余;
    // 其余 4 段共 9 个单元 ⇒ 9 个簇头。
    expect(container.querySelectorAll('[data-unit-header]')).toHaveLength(9)
    expect(container.querySelector('[data-section-id="s1"] [data-unit-header]')).toBeNull()
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
    // 只把 u1 做满 3 星 —— 其余单元的练习入口不受影响(它们的题一道没做)
    const stars = Object.fromEntries(unit.levels.map((l) => [l.id, 3]))
    const onPickPractice = vi.fn()
    const { container } = render(<LearningPath {...base} stars={stars} onPickPractice={onPickPractice} />)
    const entry = container.querySelector<HTMLElement>('[data-practice-unit="u1"]')!
    expect(entry, '取不到 u1 的练习入口,下面的断言会静默空转').not.toBeNull()
    expect(entry.dataset.practiceLit).toBe('false')
    fireEvent.click(entry)
    expect(onPickPractice).not.toHaveBeenCalled()

    // 反面:题一道没做的单元,入口是亮的、点得动
    const other = container.querySelector<HTMLElement>('[data-practice-unit="u2"]')!
    expect(other.dataset.practiceLit).toBe('true')
    fireEvent.click(other)
    expect(onPickPractice).toHaveBeenCalledWith('u2')
  })

  it('零文本:除无障碍标签外没有可见字符（数字不算文字）', () => {
    const { container } = renderPath()
    const path = container.querySelector('[data-learning-path]') as HTMLElement
    // 先断言锚点存在:取不到时下面的 `?? ''` 会把「锚点被删掉」判成「通过」——
    // 锚点缺失 → querySelector 返回 null → 兜成空串 → 正则恒不匹配 = 静默假绿。
    expect(path, 'data-learning-path 锚点没了,上面的零文本断言就恒绿').not.toBeNull()
    // 顶端星尘的数字、段/簇完成计数都是数字;任何汉字出现即红
    expect(path.textContent ?? '').not.toMatch(HAN_TEXT)
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

  // 「不知道」和「知道且为空」必须在屏幕上给出不同结果 —— 否则 settings 没到位时
  // 徽章栏会先显示成「一个都没拿到」再跳变,那是屏幕上的一句假话。
  it('earned 为 null(还不知道)时整条徽章栏不渲染', () => {
    render(<LearningPath {...base} earned={null} />)
    expect(document.querySelector('[data-achievement-badges]')).toBeNull()
  })

  it('earned 为空数组(知道且为空)时渲染目录全量格、全暗', () => {
    render(<LearningPath {...base} earned={[]} />)
    const badges = [...document.querySelectorAll<HTMLElement>('[data-badge-id]')]
    expect(badges.map((badge) => badge.dataset.badgeId)).toEqual(ACHIEVEMENTS.map((a) => a.id))
    expect(badges.map((badge) => badge.dataset.badgeEarned)).toEqual(ACHIEVEMENTS.map(() => 'false'))
    // 未得格**不画字形**(空圈)。
    expect(badges.map((badge) => badge.textContent)).toEqual(ACHIEVEMENTS.map(() => ''))
    expect(badges[0]!.className, '徽章空位没有色阶填充,描边的分母又变回天空了').toContain(
      'bg-surface-container-high',
    )
  })

  it('已得的格亮起,且只有它亮', () => {
    render(<LearningPath {...base} earned={['perfect_level']} />)
    const lit = [...document.querySelectorAll<HTMLElement>('[data-badge-earned="true"]')]
    expect(lit.map((badge) => badge.dataset.badgeId)).toEqual(['perfect_level'])
    expect(lit[0], '没有已得格,下面的字形断言会静默空转').toBeDefined()
    const emoji = ACHIEVEMENTS.find((a) => a.id === 'perfect_level')!.emoji
    expect(lit[0]!.textContent, '已得格里没有那枚图标:两态在屏幕上就分不开了').toContain(emoji)
  })

  /**
   * 名片那行的布局预算:**钉住它的输入(含块数这个乘数),不验证布局**。
   *
   * 1) **覆盖什么**:那句算术的**输入**,含块数(乘数)。逐项 = 下面 `CONTRACT` 表 + 块数上界,
   *    每行注明它在那句算术里管什么(算术本体在 `LearningPath.tsx` 顶部那段注释里):
   *      可用宽 = max-w-2xl(672)(路径内容列,名片行是它下面的一整行 flex 列);
   *      需求宽 = 5×w-8(32) + 4×gap-1(4) = 176 ≤ 672(**宽度**是约束轴;h-8 只管盒高)。
   *    改这里任何一条 → 必须回去重算那段注释里的算术。
   *
   * 2) **不验证什么**:jsdom 既没有 CSS 也没有布局引擎,像素、折行、级联都测不出来。
   *    产物侧(`npm run build` 后扫 CSS)与人工冒烟兜底。
   *
   * 3) **知道没守什么**(别把第 1 条读成「全覆盖」):**新加的、消耗宽度的类不在内**。
   *    这是**开放的类集合**,补不完,所以写在这里声明边界而不是往 `CONTRACT` 表里堆。
   */
  it('u7 名片的布局预算:已知的输入都在(不验证布局,只钉输入)', () => {
    const { container } = renderPath()
    // 内容列 = 段的父元素。可用宽封顶挂在这里,不是根节点上。
    const column = container.querySelector<HTMLElement>('[data-section-id]')?.parentElement
    expect(column, '取不到路径内容列,下面的断言会静默空转').not.toBeNull()
    const header = container.querySelector<HTMLElement>('[data-unit-header="u7"]')
    expect(header, '取不到 u7 簇头(u7 在双单元段里,应当有簇头)').not.toBeNull()
    const badge = header!.querySelector('.pblock')
    expect(badge, '取不到 u7 的名片块').not.toBeNull()
    const row = badge!.parentElement
    expect(row, '取不到名片行的容器').not.toBeNull()

    // 字号覆盖:必须是带 `!` 的那一个(块自己也在这元素上写死 text-[1.75rem],别抓错人)。
    const override = badge!.className.match(/text-\[[^\]]+\]!/)?.[0]
    expect(override, '字号覆盖没接到块上:会回落到 BlockChip 自带的 1.75rem').toBeDefined()
    const size = override!.match(/^text-\[[\d.]+rem\]!$/) ? override : undefined
    expect(
      size,
      `字号覆盖 ${override} 的单位不是 rem:px 这种绝对值不随根字号缩放,孩子调大浏览器字号时这块字不跟着变大`,
    ).toBeDefined()

    const token = (t: string) => new RegExp(`(?:^| )${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?: |$)`)
    const CONTRACT: readonly (readonly [string, string, string, string])[] = [
      ['内容列可用宽封顶', column!.className, 'max-w-2xl', '下面那句算式的被除数 672'],
      ['块的宽', badge!.className, 'w-8', '约束轴:5×32 + 4×4 = 176'],
      ['块的高', badge!.className, 'h-8', '盒高 32(非约束轴)'],
      ['块的字号覆盖', badge!.className, size!, '缩盒不缩字 = 28px 字塞进 32px 盒'],
      ['名片行间距', row!.className, 'gap-1', '需求宽里的 4×4'],
      ['名片行换行', row!.className, 'flex-wrap', '窄屏的唯一安全网:靠它折行,而不是被 flex-shrink 压窄'],
    ]
    for (const [what, cls, t, why] of CONTRACT) {
      expect(cls, `${what}:丢了 ${t} —— ${why}`).toMatch(token(t))
    }

    // 乘数也是输入:上面那句「5×w-8 + 4×gap-1」里的 5 从没被断言过。钉上界而非钉死。
    const blocks = header!.querySelectorAll('.pblock')
    expect(blocks.length, '名片块数超过预算:6 块要 212px,超出单行设计的假设').toBeLessThanOrEqual(5)

    // 字号的**上界**(不是钉某个具体值:0.85→0.9rem 这种微调不该红,那是装饰)。
    const rem = Number(size!.match(/text-\[([\d.]+)rem\]/)![1])
    expect(rem, `${size} 不是正的 rem 值:0rem 会把块面值缩成看不见`).toBeGreaterThan(0)
    expect(rem, `${size} 塞进 32px 定宽盒会顶格/糊`).toBeLessThanOrEqual(1)
  })

  // `!` 不是为了当前的参数顺序(twMerge 自己就会删掉输家),而是为了**顺序变了也成立**。
  // 参与合并的**两个来源**的字号类都得从源码里读出来 —— 硬编码哪一个,都会和它声称要模拟的那个来源脱钩。
  it('名片字号覆盖不依赖 cn 的参数顺序', () => {
    const src = (file: string) =>
      readFileSync(join(process.cwd(), 'src/features/pinyin-blocks', file), 'utf8')
    const badge = src('LearningPath.tsx').match(/const BADGE_BOX = '([^']*)'/)?.[1]
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
