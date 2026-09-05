import { useEffect } from 'react'
import { motion } from 'motion/react'
import { celebrate } from '../../features/celebrate'
import type { Achievement } from '../../game/achievements'

export function AchievementPopup({ list, onDone }: { list: Achievement[]; onDone: () => void }) {
  const a = list[0]
  useEffect(() => {
    if (!a) { onDone(); return }
    celebrate('achievement')
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
        className="w-full max-w-xs rounded-[2rem] border border-hairline bg-surface p-6 text-center shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-5xl" aria-hidden>{a.emoji}</div>
        <p className="mt-3 text-lg font-extrabold text-accent">解锁成就</p>
        <h2 className="text-xl font-extrabold">{a.name}</h2>
        <p className="mt-1 text-sm text-ink-2">{a.description}</p>
        <p className="mt-2 text-sm font-bold text-emerald">+{a.reward} 星尘</p>
      </motion.div>
    </div>
  )
}
