import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ACHIEVEMENTS } from '@/features/achievements'
import type { LevelStars } from '@/shared/services'
import { HAN_TEXT } from '@/shared/testing/han-text'
import { UNITS, pathLessons } from './levels'
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

  it('零文本:除无障碍标签外没有可见字符（数字不算文字）', () => {
    const { container } = renderPath()
    const path = container.querySelector('[data-learning-path]') as HTMLElement
    expect(path, 'data-learning-path 锚点没了,上面的零文本断言就恒绿').not.toBeNull()
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

  it('earned 为 null(还不知道)时整条徽章栏不渲染', () => {
    render(<LearningPath {...base} earned={null} />)
    expect(document.querySelector('[data-achievement-badges]')).toBeNull()
  })

  it('earned 为空数组(知道且为空)时渲染目录全量格、全暗', () => {
    render(<LearningPath {...base} earned={[]} />)
    const badges = [...document.querySelectorAll<HTMLElement>('[data-badge-id]')]
    expect(badges.map((badge) => badge.dataset.badgeId)).toEqual(ACHIEVEMENTS.map((a) => a.id))
    expect(badges.map((badge) => badge.dataset.badgeEarned)).toEqual(ACHIEVEMENTS.map(() => 'false'))
    expect(badges.map((badge) => badge.textContent)).toEqual(ACHIEVEMENTS.map(() => ''))
    expect(badges[0]!.className).toContain('bg-surface-container-high')
  })

  it('已得的格亮起,且只有它亮', () => {
    render(<LearningPath {...base} earned={['perfect_level']} />)
    const lit = [...document.querySelectorAll<HTMLElement>('[data-badge-earned="true"]')]
    expect(lit.map((badge) => badge.dataset.badgeId)).toEqual(['perfect_level'])
    expect(lit[0], '没有已得格,下面的字形断言会静默空转').toBeDefined()
    const emoji = ACHIEVEMENTS.find((a) => a.id === 'perfect_level')!.emoji
    expect(lit[0]!.textContent, '已得格里没有那枚图标:两态在屏幕上就分不开了').toContain(emoji)
  })

  it('总进度条显示已通关/总节数', () => {
    const { container } = renderPath()
    const progressEl = container.querySelector('[data-total-progress]')
    expect(progressEl).not.toBeNull()
    const progressText = progressEl!.querySelector('.tabular-nums')?.textContent
    expect(progressText).toMatch(/^\d+\/\d+$/)
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
