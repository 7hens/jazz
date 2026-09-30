import { cn } from '@/shared/ui/utils'

/**
 * 本节题位条:这一节有几道题就几格,亮到第几格就是做到第几题(`done` 从 1 起)。
 *
 * 与旧「三格台阶条 = 三个部分」同名不同义 —— 部分这个层没有了(spec §9)。
 * 旧版「越右越高」编码的是**难度阶**,新语义是**同一节的第几题**,故格子等高、只有亮/暗两态。
 * 形状即语义:一排东西 + 亮暗两态,与连击点同源,孩子在这个游戏里已经学过。
 */
export function StageBar({ total, done, big = false }: { total: number; done: number; big?: boolean }) {
  return (
    <span
      data-bar-total={total}
      data-bar-done={done}
      aria-label={`本节 ${done}/${total}`}
      className={cn('pstage-bar', big && 'pstage-bar--big')}
    >
      {Array.from({ length: total }, (_, index) => (
        <span key={index} aria-hidden className={cn('pstage-step', index < done && 'pstage-step--on')} />
      ))}
    </span>
  )
}

/**
 * 练习的小题进度点:做完几道亮几颗(`done` 从 1 起)。与题位条同源,只是更小一号 ——
 * 练习不是一节课,不该长得像一节(它的题数还会随星级变)。
 */
export function StageDots({ total, done }: { total: number; done: number }) {
  return (
    <span data-review-dots data-review-done={done} aria-label={`练习 ${done}/${total}`} className="pstage-dots">
      {Array.from({ length: total }, (_, index) => (
        <span key={index} aria-hidden className={cn('pstage-dot', index < done && 'pstage-dot--on')} />
      ))}
    </span>
  )
}
