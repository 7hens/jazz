import { motion } from 'motion/react'
import { lingLingStage } from '../../game/fun'

type StageMeta = {
  emoji: string; label: string; className: string
}
const STAGES: readonly StageMeta[] = [
  { emoji: '😴', label: '灵灵在睡觉…快醒醒!', className: 'animate-[ll-sleep_2.4s_ease-in-out_infinite]' },
  { emoji: '🦊', label: '好耶!继续加油!', className: 'animate-[ll-bounce_1.4s_ease-in-out_infinite]' },
  { emoji: '🦊✨', label: '你太厉害了!', className: 'animate-[ll-wiggle_1.6s_ease-in-out_infinite]' },
  { emoji: '🌟', label: '魔法快恢复了!', className: 'animate-[ll-glow_1.8s_ease-in-out_infinite]' },
  { emoji: '🦊👑', label: '你是我的英雄!', className: 'animate-[ll-fly_2s_ease-in-out_infinite]' },
]

export function LingLing({ completedWords, totalWords = 100 }: { completedWords: number; totalWords?: number }) {
  const meta = STAGES[lingLingStage(completedWords, totalWords)]
  return (
    <div className="mb-5 flex items-center justify-center gap-3 rounded-2xl border border-hairline bg-surface/70 px-4 py-3 shadow-card">
      <motion.span className={`text-4xl ${meta.className}`} aria-hidden>{meta.emoji}</motion.span>
      <p className="text-sm font-bold text-ink-2">{meta.label}</p>
    </div>
  )
}
