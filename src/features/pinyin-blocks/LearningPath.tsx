import { useEffect, useRef, useState } from 'react'
import { Check, Lock, Play, RotateCcw, Settings, Star } from 'lucide-react'
import type { Achievement, LevelStars } from '@/shared/services'
import { ACHIEVEMENTS_VISIBLE } from '@/shared/services'
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
 * 徽标 emoji 的字号(rem)。
 *
 * 2026-10-14:原先是「一枚 72px 的圆牌 + 3rem 的 emoji 坐在牌上」,同日产品裁定**底板整块去掉**
 * (见 `index.css` 里「单元徽标:没有任何底板」那段注)⇒ 现在是一枚**裸 emoji 直接浮在天空上**,
 * 只保留漂浮动画。这个值是**裸 emoji 的可读尺寸**,不再与任何牌面配比。
 *
 * 当日产品复看后报「**太小了**」⇒ **翻倍:3 → 6**(= 48px → 96px 的字形盒)。
 * 翻倍不会撞排版,三条依据(`LearningPath.test.tsx`「徽标放大后仍装得下」那条把它们钉住):
 *   · **横向**:徽标中心在 `STAGE_W / 2`(舞台 350px 宽),96px 的盒两侧各余 127px,不溢出舞台;
 *   · **纵向**:相邻徽标的间距是 `ARC_STEP`(= 2 × ARC_R = 290px),96px 的盒仍留 194px 净空,不重叠;
 *   · **与轨道**:徽标落在半圆的**圆心**上,轨道在半径 `ARC_R`(145px)处 —— 两者相距一个半径,
 *     **无论这块 emoji 多大都碰不到轨道**,所以这一维不需要随尺寸重算。
 * 真正会随尺寸坏掉的是前两维(舞台宽 / 弧间距),它们是**有限的**,而 emoji 不是。
 */
const BADGE_EM = 6
/** 徽标字形盒(px)。**只有这里把 rem 折成 px**,徽标与标题的排版契约都从它起算(见下面两个常量)。 */
const BADGE_PX = BADGE_EM * 16

/**
 * 徽标盒底到标题盒顶的净空(px)。
 *
 * ⚠️ **这是上限,不是口味偏好。** 约束来自**最长的那个单元名**与**半圆在那一高度的收窄**:
 * u9「ü 行韵母 · 两点去留」12 字 ⇒ 半宽 96px;而圆弧到标题所在的深度会收窄到
 * `√(145² − 91²) ≈ 112.9`,再减去半个轨宽 17px ⇒ 文字最远只能到 90.86(圆心下)。
 * 于是 `TITLE_GAP ≤ 90.86 − 48(徽标半高) − 16(标题盒高) = 26.86`,**取 26**。
 * 取 27 会超出 0.11px,哨兵当场红 —— 那不是「看起来有点挤」,是**真的压到轨道上**。
 *
 * **为什么不按比例给(曾一度写成 `BADGE_PX / 6`)**:比例暗示「徽标放大、间隔跟着放大」,
 * 而**实际恰好相反** —— 徽标半高涨的**就是这同一份预算**,徽标每大 1px,留给间隔的就少 1px。
 * 这里能给多少,取决于**名字有多长**,与徽标多大无关。⚠️ **徽标再调整时必须重算这个数。**
 *
 * **想真正放宽只有两条路**(都已被产品否掉):缩短 u9 的名字,或把标题移到徽标**上方**
 * —— 下方是唯一被弧收窄的一侧,挪到上方则空间由上一枚单元的 218px 余量决定,不受弧约束。
 *
 * **为什么不能是 0**:徽标身上挂着一支 `lp-badge-float` 无限动画,峰值时整体上抬 4px。
 * 26px 远大于那 4px,浮动被完全吃掉;否则徽标浮到顶时标题会贴上来,
 * 而「贴上来」这件事在静止的那一帧完全看不出来,只有人眼盯着才会发现。
 *
 * ⚠️ **26px 是「盒到盒」,不是眼睛看到的**。emoji 字形通常填不满行盒(`line-height: 1`
 * 下行盒 = 1em),上下各留白约 1/12,所以**眼睛看到的净空约 34px ≈ 徽标高的 35%**。
 * 那 1/12 按字形高 ≈ 5/6 盒高估,**各平台 emoji 字体渲染不同会有出入** ——
 * 真值由人眼判(`W-M6`),机器这边只守「别压轨道、别撞相邻单元」那两条几何。
 */
const TITLE_GAP = 26

/**
 * 单元标题的字号(rem)。
 *
 * 与关卡页那行「关名 · 第 n/N 遍」(`QuestionRun.tsx` 的 `text-base`)取**同一档** ——
 * 两处是同一个词(unit.name),出现在同一枚孩子会连着看到的东西上;字号分两档的话,
 * 同一句话在两页上大小不同,孩子会当成两件事。
 */
const TITLE_EM = 1

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
 * 顶栏那一排计数圈:**一个段一个圈**,7 个,不是一个节一个圈。
 *
 * 为什么不是「一节一个圈」:全表 46 节,46 个 13px 的圈加间距在 375px 上排不开
 * (单 46×13px + 45×6px ≈ 870px,是屏宽的两倍多),硬塞就得换行或缩到看不清;
 * 而地图下方本来就并排画着那 46 个节点 —— 再抄一排是重复而非信息。
 *
 * 为什么按段而不是只报一个总数:一个圈的连续填充读的是**比例**,比例在 3/46
 * 的时候看不出「我又通了一节」;而这个游戏最要紧的一拍正是结算回来看见自己往前走。
 * 按段切开之后,通一节就会让某一个圈长出一角(单节最大的一段只有 4 节 ⇒ 一节 = 90°,
 * 最粗的那段 12 节 ⇒ 一节 = 30°),连着几节都能一眼看出来;整排满圈 = 46 节全通。
 *
 * 形态照仓库既有的圆点语言(`LessonEntry` 右上角的连击点 —— 注意 2026-10-14 题位条已随
 * 「不许压在 emoji 上方」的裁定整族删除,那一族的圆点语言现在只剩连击点这一处参照):
 * 一个圆 + 亮暗两色,只多一档「亮到一半」。材质全部走 `index.css` 的普通类。
 */
function sectionTallies(
  stars: LevelStars,
  lessons: readonly Lesson[],
): readonly { id: string; cleared: number; total: number }[] {
  return SECTIONS.map((section) => {
    const inSection = lessons.filter((l) => section.unitIds.includes(l.unitId))
    let cleared = 0
    for (const lesson of inSection) {
      if (lessonState(stars, lesson, lessons) === 'cleared') cleared++
    }
    return { id: section.id, cleared, total: inSection.length }
  })
}

/**
 * 学习路径 —— 多邻国风格。
 *
 * 每个 unit 是一条半圆弧，左右交替且彼此相切首尾相连，全程没有竖直段。
 * lesson 节点按 space-around 落在弧上（弧的两端留空），
 * 单元徽标落在弧的开口一侧，练习入口落在两个半圆的接点上。
 * 每枚徽标**下面挂一行单元名**（2026-10-15 产品裁定）—— 徽标自己是 `aria-hidden` 的装饰，
 * 不写这行字的话，孩子看到十二枚图却不知道自己站在哪一段。
 *
 * 顶栏（星尘 + 段计数圈 + 家长键）固定在页面顶部：固定层满宽、内层保持居中列，
 * 材质是半透明玻璃（不支持 backdrop-filter 时退成不透明画布色）——
 * 配方与取舍见 `index.css` 的 `.lp-topbar`。
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
  const tallies = sectionTallies(stars, lessons)
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

  // 顶栏「抬起」态:页面滚走了才抬。必须声明在上面那个 effect 之后 —— 那一次
  // scrollIntoView 是同步发生的,声明在它前面会读到还没滚的 scrollY(0),顶栏就少抬一次。
  // `setLifted(同一个布尔)` React 会跳过重渲染,所以滚动过程中除了越过 0 的那一次,
  // 一次渲染都不发生 —— 不需要节流,也不需要 rAF。
  const [lifted, setLifted] = useState(false)
  useEffect(() => {
    const sync = () => setLifted(window.scrollY > 0)
    // 挂载就先对一次:刷新时浏览器会带着上次的滚动位置回来,不补这一次的话
    // 「已经滚下去」的首帧顶栏是没抬的。
    sync()
    window.addEventListener('scroll', sync, { passive: true })
    return () => window.removeEventListener('scroll', sync)
  }, [])

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
    // pt-4 挪进了固定层的内容行(下面):固定元素一旦停在 top:0,页面根上那 16px 的上边距
    // 就会变成一次 16px 的上跳(起手它在 16px 处,一粘它跑到 0)。把上边距交给内容行之后,
    // **顶栏的起手位置与改之前一致**,而粘住的那一刻不再动。
    // 代价只有一处、明说:内容行的 pb-3 让路径整体**下移 12px** —— 固定层需要一点下边距,
    // 否则滚过去的节点会正好贴在那几个 44px 的圆钮下沿(那一档的观感归 W-V7)。
    <div data-learning-path className="min-h-screen px-4 pb-10">
      {/* 顶栏固定层(2026-10-13 产品口径「星尘行固定在顶部」+「应该是覆盖的半透明玻璃特效」)。
          **满宽**的一层 + 内层居中列:出血靠 `-mx-4` 抵消页面根的 px-4
          (**不是 100vw**,那会把滚动条宽度算进去,多出一条横向滚动),
          左右留白由内层 px-4 原样拿回来 —— 视觉上与改之前同一列、同一位置。
          半透明玻璃 / 降级档 / 安全区 / 可读性那两个取舍,全写在 index.css 的
          `.lp-topbar` 与它下面两段注里,别在这儿复述一份。 */}
      <div data-path-topbar className={cn('lp-topbar -mx-4', lifted && 'lp-topbar--lifted')}>
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 pt-4 pb-3">
          <span
            aria-label={`星尘 ${totalStars}`}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-surface-container-low px-3 py-1.5"
          >
            <Star className="h-4 w-4 text-gold" aria-hidden />
            <span className="text-base font-extrabold tabular-nums">{totalStars}</span>
          </span>

          {/* 进度:一排段计数圈 + 精确读数,与星尘同属「我走了多远」这一簇。
              窄屏不换行 —— 换行会把顶栏撑成两行,家长键被挤到第二行;
              圈在 360px 以下等比缩小(见 index.css 的 lp-tally 窄屏档),宁可小也别断行。 */}
          <div data-total-progress className="flex min-w-0 flex-1 items-center gap-2">
            <span data-path-tally aria-label={`总进度 ${progress.cleared}/${progress.total}`} className="lp-tally">
              {tallies.map((tally, i) => (
                <span
                  key={tally.id}
                  aria-hidden
                  data-section-id={tally.id}
                  data-section-cleared={tally.cleared}
                  data-section-total={tally.total}
                  className={cn('lp-tally-dot', tally.cleared >= tally.total && 'lp-tally-dot--full')}
                  style={{
                    ['--lp-tally-fill' as string]:
                      `${tally.total > 0 ? Math.round((tally.cleared / tally.total) * 100) : 0}%`,
                    animationDelay: `${i * 40}ms`,
                  }}
                />
              ))}
            </span>
            <span className="shrink-0 text-xs font-bold text-ink-2 tabular-nums">
              {progress.cleared}/{progress.total}
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenParent}
            aria-label="家长"
            className="m3-state flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-surface-container-low text-ink-2 [--m3-state-color:var(--color-ink-2)]"
          >
            <Settings className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>

      {/* 徽章栏当前**已隐藏**(2026-10-13 产品口径「徽章列表放在首页有点丑」,开关见
          `shared/services/achievements.ts` 的 `ACHIEVEMENTS_VISIBLE`)。
          关的是**画不画**,不是成就本身:settle 照常扫描入账、照常发星尘奖励,只是不给孩子看。
          `badges` / `earned` 两个入参**刻意原样留着** —— 组件仍接受它们,开关翻回 true 时
          下面这一支原样活过来,不用重新接线。 */}
      {ACHIEVEMENTS_VISIBLE && earned !== null ? (
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
      ) : null}

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
            //
            // 2026-10-14 这一天里这块换过三样东西,记一笔免得下一个人按着过期描述去改:
            //   ① 裸 emoji → **圆形勋章牌**（`.lp-badge`,带四层材质）—— 产品目视否了三轮;
            //   ② 圆牌**整块删掉**,回到裸 emoji —— 底板只对白/浅色那一族起作用,却给另外十枚
            //      添了代价,且任何平色底板都必然与 emoji 内部的某一档**等亮度**(三档,不是两档);
            //   ③ 只把 u1 那只 🦢 换成 🏡 —— 白色是唯一与浅蓝天空既无色相差、又无亮度差的一类。
            // ①② 的完整来历在 `index.css` 那两段注里,别在这儿复述。
            //
            // ⚠️ **这个 div 上不许再挂任何背景/阴影类**(任何伪元素垫底也要先撞「绘制顺序第 6 步
            //   压住第 5 步行内 emoji」那个坑,产品实测报过)。要恢复先读 `index.css`。
            // ⚠️ `absolute` 是定位的**唯一**来源 —— 不带 `@layer` 的普通类压得过 Tailwind 工具类,
            //   在任何自定义类里写 `position` 都会把这里掀成 `relative`,整条路径排版当场塌掉。
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

                {/* 单元标题 —— 2026-10-15 产品裁定「路径徽章标记下面要加上章节标题」。
                    *
                    * **为什么挂在徽标外面而不是里面**:徽标是 `aria-hidden` 的**装饰**
                    * (那枚 emoji 纯属"认得出来"的记号),而标题是**要读的字**。塞进去就得连
                    * `aria-hidden` 一起处理 —— 要么把整块暴露给读屏(emoji 被念成"鹅"),
                    * 要么另开一个隐掉的出口(比直接摆在外面更绕)。摆在外面,读屏读到的是干净的
                    // 一行单元名,顺序也正好落在徽标之后。
                    *
                    * ⚠️ **`absolute` 与 `left/top` 是它自己的定位来源** —— 徽标那一支不许被牵动。
                    *   两者是**兄弟节点**,都直接以舞台(`relative`)为包含块,所以谁也掀不掉谁。
                    *   反过来,若把标题塞进徽标内部,徽标那支 `-translate-y-1/2` 的居中就会
                    *   连带把标题一起拽偏。(**别在带 `absolute` 的祖先里换定位**:不带 `@layer`
                    *   的普通类压得过 Tailwind 工具类,写 `position` 会掀掉。)
                    *
                    * **不显示所属段名**:段是**课程的分组**,不是屏幕上的东西 —— 地图是一条首尾相接的
                    * 蛇形路径,页面上没有任何一条线、一处留白、一块底板标出"这里起是第几段"
                    * (那些段头/簇头名片行早已整族删除)。凭空再写一个段名,等于宣称有一条不存在的
                    * 分界。而且 7 段里有 5 段**只含一个单元**(段名与单元名同字,如 s1 单韵母 = u1),
                    * 那种情况下两个字并排写出来就是同一个词写两遍。
                    */}
                <span
                  data-unit-title={arc.unit.id}
                  className="absolute -translate-x-1/2 whitespace-nowrap text-base font-bold leading-none text-ink-2"
                  style={{
                    left: `${STAGE_W / 2}px`,
                    top: `${arc.middle + BADGE_PX / 2 + TITLE_GAP}px`,
                    fontSize: `${TITLE_EM}rem`,
                  }}
                >
                  {arc.unit.name}
                </span>
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
