import { useEffect } from 'react'
import { motion } from 'motion/react'

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
        className="w-full max-w-xs rounded-[2rem] border border-amber/50 bg-amber-100 p-6 text-center shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-5xl" aria-hidden>🍀</div>
        <h2 className="mt-3 text-xl font-extrabold text-amber">好运来了!</h2>
        <p className="mt-1 text-sm text-ink-2">灵灵在草丛里找到了一颗隐藏星尘!</p>
        <p className="mt-2 text-lg font-extrabold text-amber">+{amount} ⭐</p>
      </motion.div>
    </div>
  )
}
