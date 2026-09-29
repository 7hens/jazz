import { Lock, Play, Settings, Star } from 'lucide-react'
import type { Achievement, LevelStars } from '@/shared/services'
import { cn } from '@/shared/ui/utils'
import { BlockChip } from './BlockChip'
import { UNITS, type Unit } from './levels'
import { isUnitUnlocked, unitClearedCount, unitTotal } from './progress-stats'

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
  /**
   * 地图上的单元。默认就是课程(`UNITS`)—— 留成入参只为测试能喂合成单元
   * (例如「困难部分一道题都没有」的边界),生产路径永远不传它。
   */
  units?: readonly Unit[]
}

/**
 * 格子里名片的块尺寸:比游戏内小一档。尺寸由全场最宽的 u7 名片(5 块)定,算一遍就够:
 * - 需要宽 5×32(w-8) + 4×4(gap-1) = **176px**(**宽度**是约束轴: 5×36 那档就是 196);
 * - 格子内宽最宽时 =(672(max-w-2xl) − 32(2 条 gap-4)) / 3(sm:grid-cols-3) − 32(格子 p-4) = **181.3px** → 176 ≤ 181.3 ✓ 单行(余量 5.3px);
 * - 640px 视口内宽 =(640−32−32)/3 − 32 = 160px → 折行 4+1(4×32+12 = 140 ✓);
 * - 375px 手机(grid-cols-2)内宽 =(375−32−16)/2 − 32 = 131.5px → 折行 3+2(3×32+8 = 104 ✓)。
 * (M3 改造前卡片自带一条 `border-2`,那 4px 也在可用宽里扣 —— 现在卡片无描边,三档各多 4px 余量。
 * 再给卡片加回描边 / 加任何消耗宽的类,都要回来重算这一段。)
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
 *
 * **视觉语言 = Material 3**(2026-09-29 改版,产品口径「卡片的样式不好看,重新设计,要符合 material-3 风格」):
 * 三件事一次换完 —— 卡片走 M3 的 **elevated** 变体(`surface-container-low` 填充 + elevation-1 影,
 * 无描边)、形状回 M3 规范档(卡片 16dp = `rounded-m3-lg`,内部 chip 走 full)、
 * 状态层走 `m3-state`(悬停 8% / 按下 12% 叠色,**不换底色**)。token 与 `m3-state` 在 `src/index.css`。
 *
 * **天空渐变背景保留**:M3 不要求底色是中性的,而这片天空是「魔法语言岛」的世界本身 ——
 * 换成平的 surface 会把游戏感一起换掉,那不是这次要改的东西。卡片与它的 1.27:1 色差靠 elevation-1 的影分开。
 */
export function UnitMap({ stars, totalStars, badges, earned, onPick, onOpenParent, units = UNITS }: UnitMapProps) {
  return (
    <div data-unit-map className="min-h-screen px-4 pb-10 pt-4">
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
          未得那格的圈压在 `--color-surface-container-high` 上(2026-09-29 M3 改造后这格有了填充,
          分母不再是天空 —— 原文那句「压天空 #bfe3ff 为 3.3:1」随之作废):
          亮色 3.6:1(#5a7ba0 压 #dbe9f7);暗色 5.7:1(#9fb8d4 压 #27395a)。
          已得那格压在 `--color-surface` 上:亮 4.4:1(#ffffff)/ 暗 7.8:1(#14223d)。
          数由 token 值合成推得、**非像素裁定**;动 ink-2 / 这两档色阶后都要重算,像素侧仍归 W-V4。
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
                  got ? 'bg-surface' : 'bg-surface-container-high',
                )}
              >
                {got ? <span aria-hidden>{badge.emoji}</span> : null}
              </span>
            )
          })}
        </div>
      )}

      <div className="mx-auto mt-6 grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-3">
        {units.map((unit, index) => {
          const locked = !isUnitUnlocked(index, stars, units)
          return (
            // **一个单元一个入口** —— 单元内的三部分(简单 / 困难 / 复习)是一个整体,
            // 地图上不再各占一行:进去就从第一个还没全通的部分接着往下走(见 UnitEntry)。
            //
            // **整格就是那个入口**(一个 `<button>`,不是「容器 + 里面一小块按钮」):
            // 孩子瞄准的是积木名片,不是底下那条窄边 —— 把命中区收在窄边里,
            // 按在名片上就没反应,而名片正是这一格上最像「摁下去」的东西。
            // 于是名片行与进度条都只是**按钮的内容**(`<span>`),不再各自是点击目标。
            // data-unit-id / data-locked / data-unit-start 三件套都落在这一个元素上:
            // 地图测试与走查条目靠它们定位(格子 === 入口,不再有 parent/child 两层)。
            //
            // **M3 elevated 卡片**:填充 + 一层 elevation-1 的影,**没有描边**(M3 的容器表达高度靠
            // 色阶与影,不靠画框)。悬停只把影抬到 elevation-2 并叠 8% 状态层 —— 底色自始至终不变,
            // 所以「哪一格是什么色」这件事不会被悬停改掉。
            //
            // **锁定态不是「整格压 opacity」**:M3 的 disabled 是**内容**降级、容器不动。
            // 压整格会连名片一起糊掉,而名片是这一格唯一的身份;改成:
            // 影撤掉 + 图标转灰蓝(ink-2)+ 数字退一档(ink-3),只有**名片行**压到 40%。
            // 于是两态的差别是**有影/无影 + 橙 ▶/灰 🔒 + 数字深/浅**三条,
            // 比原来单靠一个透明度更分得开(见走查 W-M3)。
            <button
              key={unit.id}
              type="button"
              data-unit-id={unit.id}
              data-unit-start
              data-locked={locked ? 'true' : 'false'}
              aria-disabled={locked}
              aria-label={`第 ${index + 1} 单元`}
              onClick={() => {
                if (locked) return
                onPick(index)
              }}
              className={cn(
                'flex flex-col items-center gap-3 rounded-m3-lg bg-surface-container-low p-4 transition-shadow duration-150 ease-out',
                locked
                  ? 'shadow-none'
                  : 'm3-state cursor-pointer shadow-m3-1 hover:shadow-m3-2 active:shadow-m3-1',
              )}
            >
              <span
                className={cn('flex min-h-9 flex-wrap items-center justify-center gap-1', locked && 'opacity-40')}
              >
                {unit.badge.map((block, i) => (
                  <BlockChip
                    key={`${block.type}-${block.value}-${i}`}
                    type={block.type}
                    value={block.value}
                    className={BADGE_BOX}
                  />
                ))}
              </span>
              {/* 进度行(按钮里的一行内容,不是按钮)。**没有胶囊底、没有描边**(2026-09-29 第三次口径:
                  「整个卡片都可以点击,就不需要胶囊来表示点击范围了」)—— 那一圈底在整格可点之后
                  只会读成「只有这一小条能点」,正好跟事实相反。
                  **零可见文字**:进度只给数字,锁定态给锁形图标 —— 都不需要孩子认字。
                  两态靠**颜色**分开,不靠「有底/无底」:可玩 = 深橙 ▶ + 深字(10.9:1);
                  锁定 = 灰蓝 🔒(4.2:1,「不能点」的形状线索得看得见)+ 更浅的一档数字。 */}
              <span className="flex w-full items-center justify-center gap-1.5">
                {locked ? (
                  <Lock aria-hidden className="h-3.5 w-3.5 text-ink-2" />
                ) : (
                  <Play aria-hidden className="h-3.5 w-3.5 text-accent-ink" />
                )}
                <span
                  className={cn(
                    'text-xs font-bold tabular-nums',
                    locked ? 'text-ink-3' : 'text-ink',
                  )}
                >
                  {unitClearedCount(stars, unit)}/{unitTotal(unit)}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
