import { Check, Lock, Play, RotateCcw, Settings, Star } from 'lucide-react'
import type { Achievement, LevelStars } from '@/shared/services'
import { cn } from '@/shared/ui/utils'
import { BlockChip } from './BlockChip'
import type { Block } from './blocks'
import { SECTIONS, pathLessons, type Lesson, type Section, type Unit } from './levels'
import {
  lessonState,
  practiceLevelsOf,
  unitLessonsOf,
  unitsOfSection,
} from './progress-stats'

/** 总进度:已通关节数 / 总节数 */
function totalProgress(stars: LevelStars, lessons: readonly Lesson[]): { cleared: number; total: number } {
  let cleared = 0
  for (const lesson of lessons) {
    if (lessonState(stars, lesson, lessons) === 'cleared') cleared++
  }
  return { cleared, total: lessons.length }
}

export type LearningPathProps = {
  stars: LevelStars
  totalStars: number
  /** 成就目录(emoji 是孩子唯一看得懂的那一列)。由 app 组装层注入 —— features 之间禁互引。 */
  badges: readonly Achievement[]
  /**
   * 已得的成就 id。**`null` = 还不知道**(settings 未就绪)→ 整条徽章栏不渲染。
   *
   * 为什么不是空数组:`App.tsx` 的路径分支只等 `progressSnap.status === 'ready'`,**不等 settings**。
   * 用 `[]` 冒充的话,徽章栏会先显示成「一个都没拿到」再跳变 —— 那是屏幕上出现的一句假话。
   */
  earned: readonly string[] | null
  onPickLesson(lessonId: string): void
  onPickPractice(unitId: string): void
  onOpenParent(): void
}

/** 蛇形排布:节点在 4 个横向档位间来回,读起来是一条向左下折返的路。 */
const ZIGZAG = ['ml-0', 'ml-10', 'ml-20', 'ml-10'] as const

/** zigzag 档位的水平偏移量(rem)。 */
const ZIGZAG_X = [0, 2.5, 5, 2.5] as const

/**
 * 根据相邻节点的 zigzag 位置计算连接线的角度和位置。
 * 连接线从前一个节点的底部中心指向当前节点的顶部中心。
 */
function connectorStyle(i: number): React.CSSProperties {
  const prev = (i - 1) % 4
  const curr = i % 4
  const dx = ZIGZAG_X[curr]! - ZIGZAG_X[prev]!
  // 角度:水平偏移差决定旋转角度
  const angle = dx * 15
  return {
    left: `calc(50% + ${dx * 1.25}rem)`,
    transform: `rotate(${angle}deg)`,
  }
}

/** 段头 / 簇头的名片:段头 = 段内单元 badge 的并集(按 `type:value` 去重),簇头 = 本单元的 badge。 */
function badgesOf(units: readonly Unit[]): readonly Block[] {
  const seen = new Set<string>()
  const out: Block[] = []
  for (const unit of units) {
    for (const block of unit.badge) {
      const key = `${block.type}:${block.value}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(block)
    }
  }
  return out
}

/**
 * 学习路径 —— 现代蛇形。
 *
 * 所有节点可见,用一条渐变的「路」串起来。
 * 视觉层次:当前节点(最大+呼吸) > 已完成(中等) > 锁定(最小最淡)。
 */
export function LearningPath({
  stars,
  totalStars,
  badges,
  earned,
  onPickLesson,
  onPickPractice,
  onOpenParent,
}: LearningPathProps) {
  const lessons = pathLessons()
  const progress = totalProgress(stars, lessons)

  return (
    <div data-learning-path className="min-h-screen px-4 pb-10 pt-4">
      <div className="mx-auto flex max-w-2xl flex-col gap-3">
        <div className="flex items-center justify-between">
          {/* 星尘 */}
          <span
            aria-label={`星尘 ${totalStars}`}
            className="flex items-center gap-1.5 rounded-full bg-surface-container-low px-3 py-1.5"
          >
            <Star className="h-4 w-4 text-gold" aria-hidden />
            <span className="text-base font-extrabold tabular-nums">{totalStars}</span>
          </span>
          {/* 家长 */}
          <button
            type="button"
            onClick={onOpenParent}
            aria-label="家长"
            className="m3-state flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-surface-container-low text-ink-2 [--m3-state-color:var(--color-ink-2)]"
          >
            <Settings className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {/* 总进度条 */}
        <div data-total-progress className="flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-container-high">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${progress.total > 0 ? (progress.cleared / progress.total) * 100 : 0}%` }}
            />
          </div>
          <span className="text-xs font-bold text-ink-2 tabular-nums">
            {progress.cleared}/{progress.total}
          </span>
        </div>
      </div>

      {/* 成就徽章栏 */}
      {earned === null ? null : (
        <div
          data-achievement-badges
          className="mx-auto mt-4 flex max-w-2xl flex-wrap items-center justify-center gap-1.5"
        >
          {badges.map((badge) => {
            const got = earned.includes(badge.id)
            return (
              <span
                key={badge.id}
                data-badge-id={badge.id}
                data-badge-earned={got ? 'true' : 'false'}
                aria-label={`成就 ${badge.name}${got ? '(已得)' : '(未得)'}`}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border border-ink-2 text-base',
                  got ? 'bg-surface' : 'bg-surface-container-high',
                )}
              >
                {got ? <span aria-hidden>{badge.emoji}</span> : null}
              </span>
            )
          })}
        </div>
      )}

      {/* 蛇形路径 */}
      <div className="mx-auto mt-6 flex max-w-2xl flex-col gap-8">
        {SECTIONS.map((section) => (
          <SectionGroup
            key={section.id}
            section={section}
            stars={stars}
            lessons={lessons}
            onPickLesson={onPickLesson}
            onPickPractice={onPickPractice}
          />
        ))}
      </div>
    </div>
  )
}

/** 一段:段头 + 段内各单元(簇头 + 节点 + 练习入口)。 */
function SectionGroup({
  section,
  stars,
  lessons,
  onPickLesson,
  onPickPractice,
}: {
  section: Section
  stars: LevelStars
  lessons: readonly Lesson[]
  onPickLesson(lessonId: string): void
  onPickPractice(unitId: string): void
}) {
  const units = unitsOfSection(section)
  return (
    <section data-section-id={section.id} className="flex flex-col gap-4">
      {/* 段头:本段新教块的积木名片行 */}
      <div className="flex justify-center">
        <span className="flex min-h-9 flex-wrap items-center justify-center gap-1.5">
          {badgesOf(units).map((block, i) => (
            <BlockChip
              key={`${block.type}-${block.value}-${i}`}
              type={block.type}
              value={block.value}
              className="h-9 w-9 text-[0.95rem]!"
            />
          ))}
        </span>
      </div>

      {units.map((unit) => (
        <UnitCluster
          key={unit.id}
          unit={unit}
          showHeader={units.length > 1}
          stars={stars}
          lessons={lessons}
          onPickLesson={onPickLesson}
          onPickPractice={onPickPractice}
        />
      ))}
    </section>
  )
}

/** 一个单元:簇头(可选)+ 本单元各节 + 练习入口(挂在簇末)。 */
function UnitCluster({
  unit,
  showHeader,
  stars,
  lessons,
  onPickLesson,
  onPickPractice,
}: {
  unit: Unit
  showHeader: boolean
  stars: LevelStars
  lessons: readonly Lesson[]
  onPickLesson(lessonId: string): void
  onPickPractice(unitId: string): void
}) {
  const own = unitLessonsOf(unit.id, lessons)
  const practice = practiceLevelsOf(stars, unit)
  const practiceLit = practice.length > 0
  return (
    <div data-unit-cluster={unit.id} className="flex flex-col items-center gap-3">
      {showHeader ? (
        <div data-unit-header={unit.id} className="flex justify-center">
          <span className="flex min-h-6 flex-wrap items-center justify-center gap-1">
            {unit.badge.map((block, i) => (
              <BlockChip
                key={`${block.type}-${block.value}-${i}`}
                type={block.type}
                value={block.value}
                className="h-6 w-6 text-[0.7rem]!"
              />
            ))}
          </span>
        </div>
      ) : null}

      {own.map((lesson, i) => {
        const state = lessonState(stars, lesson, lessons)
        const locked = state === 'locked'
        return (
          <div key={lesson.id} className="relative">
            {/* 路径连接线 */}
            {i > 0 && <div className="path-connector" style={connectorStyle(i)} aria-hidden />}
            <button
              type="button"
              data-lesson-id={lesson.id}
              data-lesson-state={state}
              aria-disabled={locked}
              aria-label={`第 ${i + 1} 节`}
              onClick={() => {
                if (locked) return
                onPickLesson(lesson.id)
              }}
              className={cn(
                'flex items-center justify-center rounded-full transition-all duration-200 ease-out',
                ZIGZAG[i % ZIGZAG.length],
                state === 'current' && 'node-glow m3-state h-16 w-16 cursor-pointer bg-accent text-accent-ink shadow-m3-2 animate-[pulse-soft_2s_ease-in-out_infinite]',
                state === 'cleared' && 'm3-state h-10 w-10 cursor-pointer bg-surface text-ink-2 shadow-m3-1 opacity-70 hover:opacity-100',
                locked && 'h-8 w-8 cursor-not-allowed bg-surface-container-high text-ink-3 opacity-40',
              )}
            >
              {locked ? (
                <Lock aria-hidden className="h-3.5 w-3.5" />
              ) : state === 'current' ? (
                <Play aria-hidden className="h-6 w-6" />
              ) : (
                <Check aria-hidden className="h-5 w-5" />
              )}
            </button>
          </div>
        )
      })}

      {/* 练习入口 */}
      <button
        type="button"
        data-practice-unit={unit.id}
        data-practice-lit={practiceLit ? 'true' : 'false'}
        aria-disabled={!practiceLit}
        aria-label={`练习 ${practice.length} 题`}
        onClick={() => {
          if (!practiceLit) return
          onPickPractice(unit.id)
        }}
        className={cn(
          'mt-1 flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed transition-all duration-200',
          practiceLit
            ? 'm3-state cursor-pointer border-ink-3 text-ink-2 hover:border-ink-2 hover:text-ink'
            : 'border-ink-3/30 text-ink-3/40',
        )}
      >
        <RotateCcw aria-hidden className="h-4 w-4" />
      </button>
    </div>
  )
}
