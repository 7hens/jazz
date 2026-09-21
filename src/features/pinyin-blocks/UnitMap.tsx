import { Settings, Star } from 'lucide-react'
import type { LevelStars } from '@/shared/services'
import { cn } from '@/shared/ui/utils'
import { BlockChip } from './BlockChip'
import { UNITS } from './levels'
import { cleared, isUnitUnlocked } from './progress-stats'

export type UnitMapProps = {
  stars: LevelStars
  totalStars: number
  onPick(unitIndex: number): void
  onOpenParent(): void
}

/**
 * 格子里名片的块尺寸:比游戏内小一档。尺寸由全场最宽的 u7 名片(5 块)定,算一遍就够:
 * - 需要宽 5×32(w-8) + 4×4(gap-1) = **176px**;
 * - 格子内宽最宽时 =(672(max-w-2xl) − 32(2 条 gap-4)) / 3(sm:grid-cols-3) − 32(格子 p-4) − 4(border-2)= **177.3px** → 176 ≤ 177.3 ✓ 单行(余量仅 1.3px);
 * - 640px 视口内宽 160px → 折行 4+1(4×32+12 = 140 ✓);375px 手机(grid-cols-2)内宽 131.5px → 折行 3+2(3×32+8 = 104 ✓)。
 * 所以还配了 `flex-wrap`:光缩盒子不够 —— 36px 那档(5×36+16 = 196)在任何断点都超标,
 * 撑不破也只是被 flex 默认的 flex-shrink 压成歪条,「小一档」就成了假的。
 * 字号同理要缩,但**必须带 `!`**:BlockChip 自己也在这个元素上写死了 `text-[1.75rem]`,
 * 同特异性(0-1-0)下谁赢只由 Tailwind 的样式表顺序定,而任意 rem 值是按字典序排的
 * (`.85rem` 排在 `1.75rem` **之前** → 不加 `!` 就会被块自己的大字号盖掉,且没有任何测试会红)。
 */
const BADGE_BOX = 'h-8 w-8 text-[0.85rem]!'

/**
 * 单元地图。**零文本** —— 格子靠名片积木自表意,不写「单韵母」这类字:
 * 4-8 岁的孩子读不出它们,而积木是他刚在游戏里摸过的东西。
 */
export function UnitMap({ stars, totalStars, onPick, onOpenParent }: UnitMapProps) {
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
