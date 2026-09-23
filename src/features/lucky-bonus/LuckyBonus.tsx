import { useEffect } from 'react'
import { motion } from 'motion/react'
import { REWARD_CARD } from '@/shared/ui/reward-card'
import { cn } from '@/shared/ui/utils'

export function LuckyBonus({ amount, onDone }: { amount: number; onDone: () => void }) {
  useEffect(() => {
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
        className={cn(REWARD_CARD, 'border-amber/50 bg-amber-100')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-5xl" aria-hidden>🍀</div>
        <p className="mt-3 text-lg font-extrabold text-amber">+{amount} ⭐</p>
      </motion.div>
    </div>
  )
}
