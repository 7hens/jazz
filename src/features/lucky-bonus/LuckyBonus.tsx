import { useEffect } from 'react'
import { motion } from 'motion/react'
import type { CelebrateLevel } from '@/shared/services'
import { REWARD_CARD } from '@/shared/ui/reward-card'
import { cn } from '@/shared/ui/utils'

export function LuckyBonus({
  amount,
  onDone,
  // 由组合层注入(同 AchievementPopup);不传则静默(测试 / 纯预览)。
  celebrate,
}: {
  amount: number
  onDone: () => void
  celebrate?: (level: CelebrateLevel) => void
}) {
  useEffect(() => {
    if (typeof celebrate === 'function') celebrate('lucky')
    const t = window.setTimeout(onDone, 2600)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 px-4" onClick={onDone}>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        data-reward-card
        // 同 AchievementPopup:可见面零文本,读屏只能靠这个固定名字知道「这是幸运奖励」;
        // 卡片是无 role 的 div ⇒ 这个名字**可能不进无障碍树**(登记见 `docs/dev-reference.md` 前端 3 层明细末)。
        aria-label="幸运奖励"
        className={cn(REWARD_CARD, 'border-amber/50 bg-amber-100')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-5xl" aria-hidden>🍀</div>
        <p className="mt-3 text-lg font-extrabold text-amber">+{amount} ⭐</p>
      </motion.div>
    </div>
  )
}
