import { cn } from '@/shared/ui/utils'

/**
 * 三段身份。**与课程数据里的 `Level.review`(复习**关**)是两个独立的东西** ——
 * 一个复习关里也有三段,三段里的第三段才叫复习段(spec §3.0 的命名撞车说明)。
 */
export type StageId = 'easy' | 'hard' | 'review'

/** 只进无障碍树,不上屏 —— 游戏区零可见文字。 */
const LABEL: Record<StageId, string> = {
  easy: '第一段 简单',
  hard: '第二段 困难',
  review: '第三段 复习',
}

/**
 * 段标(台阶条):三格并排、越右越高,亮到第几格就是第几段。
 * 复习段的第三格是灰蓝而不是橙 —— 复习不是第三级难度,是回炉(spec §3.8)。
 */
export function StageBar({ stage, big = false, pop = false }: { stage: StageId; big?: boolean; pop?: boolean }) {
  const cells: ('on' | 'off' | 'cool')[] = ['on', stage === 'easy' ? 'off' : 'on', stage === 'review' ? 'cool' : 'off']
  return (
    <span data-stage={stage} aria-label={LABEL[stage]} className={cn('pstage-bar', big && 'pstage-bar--big')}>
      {cells.map((cell, index) => (
        <span
          key={index}
          aria-hidden
          className={cn(
            'pstage-step',
            cell === 'on' && 'pstage-step--on',
            cell === 'cool' && 'pstage-step--cool',
            pop && cell !== 'off' && 'pstage-step--pop',
          )}
          // 逐格点亮:只在过场里排延迟。减动效下动画被压成 0.01ms,延迟仍在 ⇒ 两态依然可读。
          style={pop && cell !== 'off' ? { animationDelay: `${index * 180}ms` } : undefined}
        />
      ))}
    </span>
  )
}

/**
 * 复习段的小题进度点:最多 3 个,当前第几道就亮几颗(`done` 从 1 起)。
 * 颜色与台阶条第三格同源(同一支灰蓝),放错只抖不动它。
 */
export function StageDots({ total, done }: { total: number; done: number }) {
  return (
    <span data-review-dots data-review-done={done} aria-label={`复习 ${done}/${total}`} className="pstage-dots">
      {Array.from({ length: total }, (_, index) => (
        <span key={index} aria-hidden className={cn('pstage-dot', index < done && 'pstage-dot--on')} />
      ))}
    </span>
  )
}
