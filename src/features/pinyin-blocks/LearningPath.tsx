import { Check, Lock, Play, RotateCcw, Settings, Star } from 'lucide-react'
import type { Achievement, LevelStars } from '@/shared/services'
import { cn } from '@/shared/ui/utils'
import { BlockChip } from './BlockChip'
import type { Block } from './blocks'
import { SECTIONS, pathLessons, type Lesson, type Section, type Unit } from './levels'
import {
  lessonState,
  practiceLevelsOf,
  sectionClearedCount,
  sectionTotal,
  unitClearedCount,
  unitLessonsOf,
  unitTotal,
  unitsOfSection,
} from './progress-stats'

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

/**
 * 名片行的块尺寸:比游戏内小一档(段头与簇头共用这一档)。尺寸由全场最宽的名片定,算一遍就够:
 * - 需要宽 5×32(w-8) + 4×4(gap-1) = **176px**;
 * - 路径内容列封顶 `max-w-2xl` = **672px**,名片行是它下面的一整行(flex 列,不再切格子) → 176 ≤ 672 ✓ 单行;
 * - 375px 手机内宽 = 375 − 32(px-4) = 343px → 单行也放得下(176 ✓)。
 * 所以还配了 `flex-wrap`:光缩盒子不够 —— 加宽的名片撑不破也只是被 flex 默认的 flex-shrink 压成歪条,
 * 「小一档」就成了假的。
 * 字号同理要缩,并且带 `!`:这里比的是 **`cn`(= tailwind-merge)的参数顺序**,不是样式表顺序 ——
 * `cn` 把同类里排在后面的留下、把输家**从 class 里删掉**。现序(调用方 className 在末位)下不带 `!`
 * 也赢;但有人把 className 提到 `cn` 参数前面(自然的「调用方优先」重构)就会静默回退到 1.75rem。
 * `!` 让两个类共存、由 `!important` 决胜,顺序怎么变都成立。
 * 级联与像素 jsdom 里都测不出(环境无 CSS、无布局引擎):`!` 的顺序无关性由 `LearningPath.test.tsx` 的
 * 「名片字号覆盖不依赖 cn 的参数顺序」钉住;这一格的**已知的预算输入**(块 / 名片行 / 内容列的类)
 * 由同文件的「u7 名片的布局预算:已知的输入都在(不验证布局,只钉输入)」钉住;剩下的(字是否顶格、折行好不好看)只能在浏览器里看,
 * 由构建产物与人工冒烟兜底。
 */
const BADGE_BOX = 'h-8 w-8 text-[0.85rem]!'

/** 蛇形排布:节点在 4 个横向档位间来回,读起来是一条向左下折返的路。 */
const ZIGZAG = ['ml-0', 'ml-10', 'ml-20', 'ml-10'] as const

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
 * 学习路径。**零文本** —— 段头 / 簇头靠积木名片自表意 + 一个完成计数,节点靠三态图标:
 * 4-8 岁的孩子读不出「单韵母」这类字,而积木是他刚在游戏里摸过的东西。
 *
 * 三层可见结构(spec §6):Section 段头一行 → Unit 簇头一行(仅当段内单元 > 1)→ Lesson 圆形节点。
 * **单单元段不画簇头** —— 段头与簇头是同一套名片,画两遍是纯冗余。
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

  return (
    <div data-learning-path className="min-h-screen px-4 pb-10 pt-4">
      <div className="mx-auto flex max-w-2xl items-center justify-between">
        {/* 星尘:M3 的 assist chip 样子 —— 实底色阶 + full 圆角,不用描边也不用毛玻璃。
            **不挂影**:M3 里 chip 是平的,浮起来的只有卡片 —— 那层影是「这一格可以进去」的信号,
            洒到顶栏上就把它稀释成装饰了。
            星形图标是装饰(读数由旁边那个高对比的数字承载),所以压在浅底上的低对比不构成问题。 */}
        <span
          aria-label={`星尘 ${totalStars}`}
          className="flex items-center gap-1.5 rounded-full bg-surface-container-low px-3 py-1.5"
        >
          <Star className="h-4 w-4 text-gold" aria-hidden />
          <span className="text-base font-extrabold tabular-nums">{totalStars}</span>
        </span>
        {/* 家长:M3 的 tonal 图标按钮(full 圆角 + 实底色阶 + 状态层),不是「描边圆」,同样不挂影。
            状态层指认叠 on-surface-variant —— 图标本身就是那个色,悬停时加深的是它自己。 */}
        <button
          type="button"
          onClick={onOpenParent}
          aria-label="家长"
          className="m3-state flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-surface-container-low text-ink-2 [--m3-state-color:var(--color-ink-2)]"
        >
          <Settings className="h-5 w-5" aria-hidden />
        </button>
      </div>

      {/* 成就徽章栏:每格 = 目录里的一条,**按目录全量渲染** —— spec 的「还有几个空着」才是收集动机,
          只显已得的话它的信息量不超过成就弹层。两态:
            已得 = 白圆 + 图标;未得 = **空圈**(不画图标,圈内只填一档灰蓝色阶)。
          **未得态不压 opacity**:整块压透明度会把那圈描边连同底色一起合掉,「这是一个空位」就没了。
          这一类比(压暗压到看不见)jsdom 永远测不出(无 CSS 引擎),人眼由 W-V4 兜。
          两态**共用** `border-ink-2` 描边,它就是「这是一个空位」的承载者。**必须带主题限定**
          (照 `ParentPanel.tsx` 两态注释的格式:逐个数字给主题与分母):
          未得那格的圈压在 `--color-surface-container-high` 上:
          亮色 3.6:1(#5a7ba0 压 #dbe9f7);暗色 5.7:1(#9fb8d4 压 #27395a)。
          已得那格压在 `--color-surface` 上:亮 4.4:1(#ffffff)/ 暗 7.8:1(#14223d)。
          数由 token 值合成推得、**非像素裁定**;动 ink-2 / 这两档色阶后都要重算,像素侧仍归 W-V4。
          独立一行 + flex-wrap,不吃内容列宽:每格 h-8 w-8 + gap-1.5,乘目录条数须落在窄屏预算内(人眼由 W-V3 兜)。 */}
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

      <div className="mx-auto mt-6 flex max-w-2xl flex-col gap-10">
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
    <section data-section-id={section.id} className="flex flex-col gap-6">
      {/* 段头:本段新教块的积木名片行 + 段完成计数。**零文本**。 */}
      <div className="flex flex-col items-center gap-1">
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
        <span data-section-progress={section.id} className="text-xs font-bold text-ink-2 tabular-nums">
          {sectionClearedCount(stars, section, lessons)}/{sectionTotal(section, lessons)}
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
        <div data-unit-header={unit.id} className="flex flex-col items-center gap-1">
          <span className="flex min-h-8 flex-wrap items-center justify-center gap-1">
            {unit.badge.map((block, i) => (
              <BlockChip
                key={`${block.type}-${block.value}-${i}`}
                type={block.type}
                value={block.value}
                className={BADGE_BOX}
              />
            ))}
          </span>
          <span data-unit-progress={unit.id} className="text-xs font-bold text-ink-3 tabular-nums">
            {unitClearedCount(stars, unit)}/{unitTotal(unit)}
          </span>
        </div>
      ) : null}

      {own.map((lesson, i) => {
        const state = lessonState(stars, lesson, lessons)
        const locked = state === 'locked'
        return (
          <button
            key={lesson.id}
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
              'flex h-14 w-14 items-center justify-center rounded-full transition-shadow duration-150 ease-out',
              ZIGZAG[i % ZIGZAG.length],
              state === 'current' && 'm3-state cursor-pointer bg-accent text-accent-ink shadow-m3-2',
              state === 'cleared' && 'm3-state cursor-pointer bg-surface text-ink shadow-m3-1',
              locked && 'bg-surface-container-high text-ink-2 shadow-none',
            )}
          >
            {locked ? (
              <Lock aria-hidden className="h-5 w-5" />
            ) : state === 'current' ? (
              <Play aria-hidden className="h-5 w-5" />
            ) : (
              <Check aria-hidden className="h-6 w-6" />
            )}
          </button>
        )
      })}

      {/* 练习入口:与节点同列但形状不同(方一点 + 回炉图标)—— 它不是这条链上的一环。
          无题可练时不亮(spec §8.2):全 3 星 = 没什么可练的,伪造一道题是往屏幕上放假话。 */}
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
          'mt-1 flex h-11 w-11 items-center justify-center rounded-m3-lg',
          practiceLit
            ? 'm3-state cursor-pointer bg-surface-container-low text-ink shadow-m3-1 hover:shadow-m3-2'
            : 'bg-surface-container-high text-ink-2 shadow-none',
        )}
      >
        <RotateCcw aria-hidden className="h-5 w-5" />
      </button>
    </div>
  )
}
