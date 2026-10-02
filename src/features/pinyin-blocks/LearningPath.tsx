import { useEffect, useRef } from 'react'
import { Check, Lock, Play, RotateCcw, Settings, Star } from 'lucide-react'
import type { Achievement, LevelStars } from '@/shared/services'
import { cn } from '@/shared/ui/utils'
import { SECTIONS, pathLessons, type Lesson } from './levels'
import { lessonState, practiceLevelsOf, unitsOfSection } from './progress-stats'

export type LearningPathProps = {
  stars: LevelStars
  totalStars: number
  badges: readonly Achievement[]
  earned: readonly string[] | null
  onPickLesson(lessonId: string): void
  onPickPractice(unitId: string): void
  onOpenParent(): void
}

/**
 * 节点直径（px）。
 *
 * 已通关的节点必须**窄于已走过的路面**（TRACK_W - 12 = 22px）——
 * 对勾是「走过了」的标记，不是路本身；一旦盖过路面宽度，
 * 黄色带就被白圆盘切断，「路」读不出来了。当前一档不受此限：
 * 它是唯一该跳出来的一格，尺寸大正是要它跳出来。
 */
const NODE_SIZE = { current: 64, cleared: 20, locked: 20 } as const

/** 半圆半径。弧从 (0, top) 经 (R, top+R) 鼓出，到 (0, top+2R) 收口。 */
const ARC_R = 145
/** 练习节点直径。 */
const PRACTICE_SIZE = 44
/**
 * 单元纵向步进恰好等于一个弧高 2R。
 * 这样相邻两个方向相反的半圆在中心线上共享同一个接点，
 * 且该点两侧切线同为水平，于是整条路径是一串首尾相接的半圆，
 * 中间不会出现任何竖直连接段。
 */
const ARC_STEP = 2 * ARC_R
const HEADER_H = 40
const FOOTER_H = 70
const STAGE_PAD = 30
const STAGE_W = ARC_R * 2 + STAGE_PAD * 2
/** 轨道（凹槽）的描边宽度。三层路面靠它递减出层次。 */
const TRACK_W = 34
/**
 * 徽标 emoji 的字号（rem）。
 *
 * 徽标落在圆心，是这一 unit 的**身份标识**，孩子靠它认出「这一格是哪一课」，
 * 所以给得比路面宽也无妨 —— 它在弧内，不压轨道（轨道半宽 17px，
 * 3.6rem ≈ 58px 的 emoji 到弧线还有富余）。
 */
const BADGE_EM = 3.6

/** 取某个 unit 在全局 lessons 数组中的下标。 */
function unitLessonIndices(unitId: string, all: readonly Lesson[]): number[] {
  return all.reduce<number[]>((acc, l, i) => (l.unitId === unitId ? [...acc, i] : acc), [])
}

/**
 * 一个 unit 的半圆弧几何。
 *
 * 偶数单元 = ")"：弧鼓向右侧，开口朝左。
 * 奇数单元 = "("：弧鼓向左侧，开口朝右。
 *
 * 弧上共有 slots 个卡位 = n 节 lesson + 1 个复习入口，
 * 按 space-around 分布：把弧等分成 slots 段，每段安放一个节点并居中，
 * 于是弧的两端各留下半段空白，所有节点之间等距。
 * 复习入口因此融在弧上参与轮转，不会单独挤在弧的下端。
 */
function unitArc(unitIndex: number, slots: number) {
  const isRight = unitIndex % 2 === 0
  const dir = isRight ? 1 : -1
  const top = HEADER_H + unitIndex * ARC_STEP
  const points = Array.from({ length: slots }, (_, i) => {
    const angle = ((i + 0.5) / slots) * Math.PI
    return {
      x: dir * Math.sin(angle) * ARC_R,
      y: top + (1 - Math.cos(angle)) * ARC_R,
    }
  })
  return {
    isRight,
    /** 弧的上端与下端，都在中心线上；相邻单元共用下端作为接点。 */
    top,
    bottom: top + ARC_STEP,
    /** 弧心所在高度，徽标落在开口一侧的这里。 */
    middle: top + ARC_R,
    points,
  }
}

/**
 * 一条连续子路径串起所有半圆。
 * 每条 A 指令都从上一条的落点继续，因此接点处既无断点也无直线段。
 */
function arcsPathD(arcs: readonly { isRight: boolean; top: number; bottom: number }[]): string {
  const first = arcs[0]
  if (!first) return ''
  let d = `M 0 ${first.top}`
  for (const arc of arcs) {
    d += ` A ${ARC_R} ${ARC_R} 0 0 ${arc.isRight ? 1 : 0} 0 ${arc.bottom}`
  }
  return d
}

/**
 * 已走过的部分：从路径起点画到当前关卡所在的卡位为止。
 *
 * 当前关卡落在第 k 个 unit 的第 j 个卡位时：
 *   - 前 k 个 unit 整条弧都已走完 ⇒ 各画一条完整 A；
 *   - 第 k 个只画到该卡位对应的角度 ⇒ 用 A 的 xAxisRotation/sweep 截不到长度，
 *     故改走「起��� → 卡位点」这段子弧（仍是一条 A，半径不变，天然贴合主弧）。
 *
 * 卡位角度与 unitArc 的 space-around 公式一致（多了练习入口那一格），
 * 因此点亮段的终点正好压在当前节点上，不会差半格。
 */
function donePathD(
  arcs: readonly {
    isRight: boolean
    top: number
    bottom: number
    points: readonly { x: number; y: number }[]
  }[],
  doneUnit: number,
  doneSlot: number,
): string {
  if (doneUnit < 0 || arcs.length === 0) return ''
  const first = arcs[0]!
  let d = `M 0 ${first.top}`
  for (let i = 0; i <= doneUnit; i++) {
    const arc = arcs[i]!
    const sweep = arc.isRight ? 1 : 0
    if (i < doneUnit || doneSlot >= arc.points.length) {
      // 整条弧都走完了
      d += ` A ${ARC_R} ${ARC_R} 0 0 ${sweep} 0 ${arc.bottom}`
    } else {
      // 走到当前卡位就停：从弧的起点画一段子弧到该点
      const p = arc.points[doneSlot]
      if (!p) break
      d += ` A ${ARC_R} ${ARC_R} 0 0 ${sweep} ${p.x} ${p.y}`
      break
    }
  }
  return d
}

/** 总进度:已通关节数 / 总节数 */
function totalProgress(stars: LevelStars, lessons: readonly Lesson[]): { cleared: number; total: number } {
  let cleared = 0
  for (const lesson of lessons) {
    if (lessonState(stars, lesson, lessons) === 'cleared') cleared++
  }
  return { cleared, total: lessons.length }
}

/**
 * 学习路径 —— 多邻国风格。
 *
 * 每个 unit 是一条半圆弧，左右交替且彼此相切首尾相连，全程没有竖直段。
 * lesson 节点按 space-around 落在弧上（弧的两端留空），
 * 单元徽标落在弧的开口一侧，练习入口落在两个半圆的接点上。
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
  const states = lessons.map((l) => lessonState(stars, l, lessons))

  const allUnits = SECTIONS.flatMap((section) => unitsOfSection(section))
  // 每个 unit 的弧上多留一个卡位给复习入口。
  const arcs = allUnits.map((unit, unitIndex) => ({
    unit,
    ...unitArc(unitIndex, unitLessonIndices(unit.id, lessons).length + 1),
  }))

  const stageH = HEADER_H + arcs.length * ARC_STEP + FOOTER_H
  const pathD = arcsPathD(arcs)

  // 已点亮的路段：终点是当前关卡所在的那个卡位。
  // 找它落在第几个 unit、该 unit 的第几格（0 起）。
  const currentIdx = states.indexOf('current')
  const currentUnitIdx = currentIdx < 0 ? -1 : arcs.findIndex((a) => a.unit.id === lessons[currentIdx]!.unitId)
  const currentSlot =
    currentIdx < 0 || currentUnitIdx < 0
      ? -1
      : unitLessonIndices(lessons[currentIdx]!.unitId, lessons).indexOf(currentIdx)
  const doneD = donePathD(arcs, currentUnitIdx, currentSlot)

  // 当前关卡落在哪一节，就把它滚进视野 —— 孩子打开就看到「现在该玩哪一关」，
  // 而不是从头滚到尾。挂在 window 而非容器：整页可滚，没有内部滚动容器。
  const currentLessonId = lessons[states.indexOf('current')]?.id
  const currentRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    const el = currentRef.current
    if (!currentLessonId || !el) return
    // scrollIntoView 不是所有环境都有（jsdom 就没有，老浏览器也缺）。
    // 定位只是锦上添花，缺了就停在顶部，别把整页渲染打断。
    el.scrollIntoView?.({ block: 'center' })
  }, [currentLessonId])

  // lesson 与复习入口共享同一套 space-around 卡位
  const nodePositions = new Map<string, { x: number; y: number }>()
  const practiceNodes = arcs.map((arc) => {
    const ids = unitLessonIndices(arc.unit.id, lessons)
    ids.forEach((lessonIdx, i) => {
      const p = arc.points[i]
      const id = lessons[lessonIdx]?.id
      if (p && id) nodePositions.set(id, p)
    })
    // 复习入口取最后一个卡位，跟着一起在弧上轮转。
    const p = arc.points[ids.length] ?? { x: 0, y: arc.bottom }
    const practice = practiceLevelsOf(stars, arc.unit)
    return { unit: arc.unit, lit: practice.length > 0, x: p.x, y: p.y }
  })

  return (
    <div data-learning-path className="min-h-screen px-4 pb-10 pt-4">
      <div className="mx-auto flex max-w-2xl flex-col gap-3">
        <div className="flex items-center justify-between">
          <span
            aria-label={`星尘 ${totalStars}`}
            className="flex items-center gap-1.5 rounded-full bg-surface-container-low px-3 py-1.5"
          >
            <Star className="h-4 w-4 text-gold" aria-hidden />
            <span className="text-base font-extrabold tabular-nums">{totalStars}</span>
          </span>
          <button
            type="button"
            onClick={onOpenParent}
            aria-label="家长"
            className="m3-state flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-surface-container-low text-ink-2 [--m3-state-color:var(--color-ink-2)]"
          >
            <Settings className="h-5 w-5" aria-hidden />
          </button>
        </div>

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

      <div className="mt-6 flex justify-center">
        <div className="relative" style={{ width: `${STAGE_W}px`, height: `${stageH}px` }}>
          <svg
            className="absolute inset-0"
            width={STAGE_W}
            height={stageH}
            viewBox={`0 0 ${STAGE_W} ${stageH}`}
            aria-hidden
          >
            <defs>
              {/* 已走过的路面:橙 → 金的斜向渐变,亮的一头朝下,暗示「往前走」 */}
              <linearGradient id="lp-done-gradient" x1="0" y1="0" x2="0.35" y2="1">
                <stop offset="0%" stopColor="var(--color-accent)" />
                <stop offset="55%" stopColor="var(--color-amber)" />
                <stop offset="100%" stopColor="var(--color-gold)" />
              </linearGradient>
            </defs>

            <g transform={`translate(${STAGE_W / 2} 0)`}>
              {/* 1) 凹陷的槽 —— 最宽的一层 */}
              <path d={pathD} className="lp-track" strokeWidth={TRACK_W} />
              {/* 2) 已走过的路面 —— 只画到当前关卡 */}
              {doneD ? <path d={doneD} className="lp-done" strokeWidth={TRACK_W - 12} /> : null}
            </g>
          </svg>

          {arcs.map((arc) => {
            // 徽标落在圆弧的圆心（弧口中点）—— 不是弧线上的点。
            // 半圆的圆心就在中心线上（x=0），到弧上任一点的距离恒为 ARC_R，
            // 于是左右两侧弧长天然对称：徽标停在正中，弧从两侧包过来。
            //
            // 一枚 emoji 即可代表整个单元 —— 不用排开：本单元新教的块有多有少
            // （u12 有五块），方块横排必然溢出，emoji 与块数无关。
            return (
              <div key={arc.unit.id} data-unit-header={arc.unit.id}>
                <div
                  data-unit-badge={arc.unit.id}
                  aria-hidden
                  className="absolute -translate-x-1/2 -translate-y-1/2 animate-[lp-badge-float_3.5s_ease-in-out_infinite] leading-none"
                  style={{
                    left: `${STAGE_W / 2}px`,
                    top: `${arc.middle}px`,
                    fontSize: `${BADGE_EM}rem`,
                  }}
                >
                  {arc.unit.emoji}
                </div>
              </div>
            )
          })}

          {lessons.map((lesson, i) => {
            const state = states[i]!
            const locked = state === 'locked'
            const pos = nodePositions.get(lesson.id)
            if (!pos) return null
            const size = NODE_SIZE[state === 'current' ? 'current' : state === 'cleared' ? 'cleared' : 'locked']
            return (
              <button
                key={lesson.id}
                type="button"
                ref={state === 'current' ? currentRef : undefined}
                data-lesson-id={lesson.id}
                data-lesson-state={state}
                aria-disabled={locked}
                aria-label={`第 ${i + 1} 节`}
                onClick={() => {
                  if (locked) return
                  onPickLesson(lesson.id)
                }}
                className={cn(
                  'absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-all duration-300 ease-out',
                  'lp-node',
                  state === 'current' &&
                    'lp-node--current z-10 cursor-pointer bg-accent text-accent-ink animate-[pulse-soft_2s_ease-in-out_infinite]',
                  state === 'cleared' && 'lp-node--cleared z-10 cursor-pointer bg-surface text-ink',
                  locked && 'lp-node--locked z-10 cursor-not-allowed bg-surface-container-high text-ink-3',
                )}
                style={{
                  left: `${STAGE_W / 2 + pos.x}px`,
                  top: `${pos.y}px`,
                  width: `${size}px`,
                  height: `${size}px`,
                }}
              >
                {locked ? (
                  <Lock aria-hidden style={{ width: size * 0.4, height: size * 0.4 }} />
                ) : state === 'current' ? (
                  <Play aria-hidden style={{ width: size * 0.35, height: size * 0.35 }} />
                ) : (
                  <Check aria-hidden style={{ width: size * 0.35, height: size * 0.35 }} />
                )}
              </button>
            )
          })}

          {practiceNodes.map(({ unit, lit, x, y }) => (
            <button
              key={unit.id}
              type="button"
              data-practice-unit={unit.id}
              data-practice-lit={lit ? 'true' : 'false'}
              aria-disabled={!lit}
              aria-label="练习"
              onClick={() => {
                if (!lit) return
                onPickPractice(unit.id)
              }}
              className={cn(
                'absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-dashed transition-all duration-200',
                lit
                  ? 'z-10 cursor-pointer border-ink-3 bg-surface text-ink-2 hover:border-ink-2 hover:text-ink'
                  : 'z-10 cursor-not-allowed border-ink-3/30 text-ink-3/40',
              )}
              style={{
                left: `${STAGE_W / 2 + x}px`,
                top: `${y}px`,
                width: `${PRACTICE_SIZE}px`,
                height: `${PRACTICE_SIZE}px`,
              }}
            >
              <RotateCcw aria-hidden className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
