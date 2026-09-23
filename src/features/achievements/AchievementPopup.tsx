import { useEffect } from 'react'
import { motion } from 'motion/react'
import type { Achievement, CelebrateLevel } from '@/shared/services'
import { REWARD_CARD } from '@/shared/ui/reward-card'
import { cn } from '@/shared/ui/utils'

type Props = {
  list: readonly Achievement[]
  onDone: () => void
  // 由组合层注入(旧 App 经 bootstrap 的 celebrate 服务传入);不传则静默(测试/纯预览)。
  celebrate?: (level: CelebrateLevel) => void
}

export function AchievementPopup({ list, onDone, celebrate }: Props) {
  const a = list[0]
  useEffect(() => {
    if (!a) { onDone(); return }
    if (typeof celebrate === 'function') celebrate('achievement')
    const t = window.setTimeout(() => onDone(), 2600)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a])
  if (!a) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 px-4" onClick={onDone}>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        data-reward-card
        className={cn(REWARD_CARD, 'border-hairline bg-surface')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-5xl" aria-hidden>{a.emoji}</div>
        <p className="mt-3 text-lg font-extrabold text-emerald">+{a.reward} ⭐</p>
      </motion.div>
    </div>
  )
}
