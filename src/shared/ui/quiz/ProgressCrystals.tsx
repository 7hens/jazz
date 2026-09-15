import { cn } from '@/shared/ui/utils'

export type ProgressCrystalsProps = {
  total: number
  /** 当前所在格(0 基)。小于它的格为已过。 */
  current: number
  className?: string
}

/** 水晶进度条:替代三处逐字重复的圆点行。
 *  纯装饰 —— 每格 aria-hidden,进度语义仍由消费点既有的文本承担(勿以为它可读)。 */
export function ProgressCrystals({ total, current, className }: ProgressCrystalsProps) {
  return (
    <div data-crystals className={cn('flex items-center justify-center gap-1.5', className)}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          aria-hidden
          data-crystal={i < current ? 'done' : i === current ? 'active' : 'todo'}
          className={cn(
            'h-2.5 rounded-full transition-all',
            i < current ? 'crystal crystal--done w-2.5' : i === current ? 'crystal crystal--active w-6' : 'crystal crystal--todo w-2.5',
          )}
        />
      ))}
    </div>
  )
}
