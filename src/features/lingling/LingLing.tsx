import { motion } from 'motion/react'
import { lingLingStage, LINGLING_STAGES } from './stages'

export function LingLing({ completedWords, totalWords = 100 }: { completedWords: number; totalWords?: number }) {
  const meta = LINGLING_STAGES[lingLingStage(completedWords, totalWords)]
  return (
    <div className="mb-5 flex items-center justify-center gap-3 rounded-2xl border border-hairline bg-surface/70 px-4 py-3 shadow-card">
      <motion.span className={`text-4xl ${meta.className}`} aria-hidden>{meta.emoji}</motion.span>
      <p className="text-sm font-bold text-ink-2">{meta.label}</p>
    </div>
  )
}
