import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ACHIEVEMENTS } from '@/features/achievements'
import type { LevelStars } from '@/shared/services'
import { cn } from '@/shared/ui/utils'
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

describe('现代蛇形路径', () => {
  it('7 个段 + 46 个节点 + 12 个练习入口全部可见', () => {
    const { container } = renderPath()
    expect(container.querySelectorAll('[data-section-id]')).toHaveLength(7)
    expect(container.querySelectorAll('[data-lesson-id]')).toHaveLength(46)
    expect(container.querySelectorAll('[data-practice-unit]')).toHaveLength(12)
  })

  it('12 个单元簇，其中 9 个画簇头（单单元段不画）', () => {
    const { container } = renderPath()
    expect(container.querySelectorAll('[data-unit-cluster]')).toHaveLength(12)
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

  it('总进度条显示已通关/总节数', () => {
    const { container } = renderPath()
    const progressEl = container.querySelector('[data-total-progress]')
    expect(progressEl).not.toBeNull()
    const progressText = progressEl!.querySelector('.tabular-nums')?.textContent
    expect(progressText).toMatch(/^\d+\/\d+$/)
  })

  it('当前节点有 node-glow 类（发光效果）', () => {
    const { container } = renderPath()
    const current = container.querySelector('[data-lesson-state="current"]')!
    expect(current.className).toContain('node-glow')
  })

  it('节点有 SVG 连接线', () => {
    const { container } = renderPath()
    const lines = container.querySelectorAll('svg line')
    expect(lines.length).toBeGreaterThan(0)
  })
})
