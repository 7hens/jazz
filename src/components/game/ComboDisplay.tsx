import { motion } from 'motion/react'
import { cn } from '../../lib/utils'

const LEVELS: ReadonlyArray<{ threshold: number; text: string; className: string }> = [
  { threshold: 1, text: '🔥 太棒了!', className: 'text-orange-500' },
  { threshold: 2, text: '🔥🔥 连击!', className: 'text-orange-600' },
  { threshold: 3, text: '🔥🔥🔥 三连击!', className: 'text-red-500' },
  { threshold: 5, text: '⚡ 五连击!无敌!', className: 'text-purple-500' },
  { threshold: 8, text: '🌟 八连击!小法师!', className: 'text-blue-500' },
  { threshold: 10, text: '👑 十连击!大法师!', className: 'text-yellow-500' },
]

export function comboText(combo: number): { text: string; className: string } {
  let hit = LEVELS[0]
  for (const l of LEVELS) if (combo >= l.threshold) hit = l
  return { text: hit.text, className: hit.className }
}

export function ComboDisplay({ text, className }: { text: string; className: string }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={cn('pointer-events-none pb-2 text-center text-lg font-extrabold', className)}
    >
      {text}
    </motion.p>
  )
}
