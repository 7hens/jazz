import { Settings, Star } from 'lucide-react'
import type { Achievement, LevelStars } from '@/shared/services'
import { cn } from '@/shared/ui/utils'
import { BlockChip } from './BlockChip'
import { UNITS } from './levels'
import { cleared, isUnitUnlocked } from './progress-stats'

export type UnitMapProps = {
  stars: LevelStars
  totalStars: number
  /** 成就目录(emoji 是孩子唯一看得懂的那一列)。由 app 组装层注入 —— features 之间禁互引。 */
  badges: readonly Achievement[]
  /**
   * 已得的成就 id。**`null` = 还不知道**(settings 未就绪)→ 整条徽章栏不渲染。
   *
   * 为什么不是空数组:`App.tsx` 的地图分支只等 `progressSnap.status === 'ready'`,**不等 settings**。
   * 用 `[]` 冒充的话,徽章栏会先显示成「一个都没拿到」再跳变 —— 那是屏幕上出现的一句假话。
   */
  earned: readonly string[] | null
  onPick(unitIndex: number): void
  onOpenParent(): void
}

/**
 * 格子里名片的块尺寸:比游戏内小一档。尺寸由全场最宽的 u7 名片(5 块)定,算一遍就够:
 * - 需要宽 5×32(w-8) + 4×4(gap-1) = **176px**(**宽度**是约束轴: 5×36 那档就是 196);
 * - 格子内宽最宽时 =(672(max-w-2xl) − 32(2 条 gap-4)) / 3(sm:grid-cols-3) − 32(格子 p-4) − 4(border-2)= **177.3px** → 176 ≤ 177.3 ✓ 单行(余量仅 1.3px);
 * - 640px 视口内宽 =(640−32−32)/3 − 32 − 4 = 156px → 折行 4+1(4×32+12 = 140 ✓);
 * - 375px 手机(grid-cols-2)内宽 =(375−32−16)/2 − 32 − 4 = 127.5px → 折行 3+2(3×32+8 = 104 ✓)。
 * 所以还配了 `flex-wrap`:光缩盒子不够 —— 36px 那档(5×36+16 = 196)在任何断点都超标,
 * 撑不破也只是被 flex 默认的 flex-shrink 压成歪条,「小一档」就成了假的。
 * 字号同理要缩,并且带 `!`:这里比的是 **`cn`(= tailwind-merge)的参数顺序**,不是样式表顺序 ——
 * `cn` 把同类里排在后面的留下、把输家**从 class 里删掉**。现序(调用方 className 在末位)下不带 `!`
 * 也赢;但有人把 className 提到 `cn` 参数前面(自然的「调用方优先」重构)就会静默回退到 1.75rem。
 * `!` 让两个类共存、由 `!important` 决胜,顺序怎么变都成立。
 * 级联与像素 jsdom 里都测不出(环境无 CSS、无布局引擎):`!` 的顺序无关性由 `UnitMap.test.tsx` 的
 * 「名片字号覆盖不依赖 cn 的参数顺序」钉住;这一格的**已知的预算输入**(网格 / 格子 / 块 / 名片行的类)
 * 由同文件的「u7 名片的布局预算:已知的输入都在(不验证布局,只钉输入)」钉住;剩下的(字是否顶格、折行好不好看)只能在浏览器里看,
 * 由构建产物与 T15 人工冒烟兜底。
 */
const BADGE_BOX = 'h-8 w-8 text-[0.85rem]!'

/**
 * 单元地图。**零文本** —— 格子靠名片积木自表意,不写「单韵母」这类字:
 * 4-8 岁的孩子读不出它们,而积木是他刚在游戏里摸过的东西。
 */
export function UnitMap({ stars, totalStars, badges, earned, onPick, onOpenParent }: UnitMapProps) {
  return (
    <div data-unit-map className="min-h-screen px-4 pb-10 pt-4">
      <div className="mx-auto flex max-w-2xl items-center justify-between">
        <span
          aria-label={`星尘 ${totalStars}`}
          className="flex items-center gap-1.5 rounded-full border border-hairline bg-surface/70 px-3 py-1.5"
        >
          <Star className="h-4 w-4 text-gold" aria-hidden />
          <span className="text-base font-extrabold tabular-nums">{totalStars}</span>
        </span>
        <button
          type="button"
          onClick={onOpenParent}
          aria-label="家长"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-surface/70 text-ink-2"
        >
          <Settings className="h-5 w-5" aria-hidden />
        </button>
      </div>

      {/* 成就徽章栏:每格 = 目录里的一条,**按目录全量渲染** —— spec 的「还有几个空着」才是收集动机,
          只显已得的话它的信息量不超过成就弹层。两态:
            已得 = 白圆 + 图标;未得 = **空圈**(不画图标,圈内只留一层淡白)。
          **未得态不压 opacity**:整块压透明度会把那圈描边连同底色一起合进天空 —— 徽章栏自己没有底色,
          它直接落在 body 的天空渐变上,30% 合成下的圈对天空只有 1.0 上下,等于「一片空白」。
          这一类比(压暗压到看不见)jsdom 永远测不出(无 CSS 引擎),人眼由 W-V4 兜。
          两态**共用** `border-ink-2` 描边,它就是「这是一个空位」的承载者:对天空 ≈3.3:1
          (已得那格另压在白圆上,圈对白底 ≈4.4:1)。**前提:这排仍直落天空** —— 徽章栏自身与祖先
          都没有底色(`App.tsx` 的 `MotionConfig` 不套包裹 div);哪天给它包一层 `bg-surface` 的卡片,
          分母就换成 surface,这两个数要重算。数由 token 值合成推得、**非像素裁定**;
          动 ink-2 / 天空 / 这排下面那层底色后都要重算,像素侧仍归 W-V3 / W-V4。
          独立一行 + flex-wrap,不吃格子内宽:每格 h-8 w-8 + gap-1.5,乘目录条数须落在窄屏预算内(人眼由 W-V3 兜)。 */}
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
                  got ? 'bg-surface' : 'bg-surface/40',
                )}
              >
                {got ? <span aria-hidden>{badge.emoji}</span> : null}
              </span>
            )
          })}
        </div>
      )}

      <div className="mx-auto mt-6 grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-3">
        {UNITS.map((unit, index) => {
          const locked = !isUnitUnlocked(index, stars)
          const gained = unit.levels.filter((level) => cleared(stars, level.id)).length
          return (
            <button
              key={unit.id}
              type="button"
              data-unit-id={unit.id}
              data-locked={locked ? 'true' : 'false'}
              aria-label={`第 ${index + 1} 单元`}
              aria-disabled={locked}
              onClick={() => {
                if (locked) return
                onPick(index)
              }}
              className={cn(
                'flex flex-col items-center gap-2 rounded-4xl border-2 border-hairline bg-surface p-4 shadow-card transition-transform',
                locked ? 'opacity-45' : 'hover:border-accent/60 active:scale-[0.98]',
              )}
            >
              <span className="flex min-h-9 flex-wrap items-center justify-center gap-1">
                {unit.badge.map((block, i) => (
                  <BlockChip
                    key={`${block.type}-${block.value}-${i}`}
                    type={block.type}
                    value={block.value}
                    className={BADGE_BOX}
                  />
                ))}
              </span>
              {/* 星排:每一关各占一个星位(星位数 = 该单元的关卡数),通关的那几个才填色 ——
                  颜色由 .pstar / .pstar--on 给,不走块面那套 --pb 一族 */}
              <span className="flex min-h-4 items-center gap-0.5" aria-hidden>
                {unit.levels.map((level) => (
                  <span
                    key={level.id}
                    className={cn('pstar', cleared(stars, level.id) && 'pstar--on')}
                  >
                    ★
                  </span>
                ))}
              </span>
              <span className="text-xs font-bold text-ink-3 tabular-nums">
                {gained}/{unit.levels.length}
              </span>
              {locked ? <span aria-hidden className="text-lg">🔒</span> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
