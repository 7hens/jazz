import { motion } from 'motion/react'
import { Volume2 } from 'lucide-react'
import { cn } from '../../../lib/utils'
import type { BaseOption, KingdomKey } from '../../../types'
import { speakCard } from './speech'

export type ChoiceProps = {
  prompt: string
  promptSpeak?: string
  kingdom: KingdomKey | 'mixed'
  options: BaseOption[]
  disabled?: boolean
  /** 两次答错后亮出的正确答案 option id */
  revealId?: string | null
  /** 刚答对(待推进)时高亮的 option id */
  correctId?: string | null
  /** 本次答错的 option id(红标 + 抖动) */
  wrongId?: string | null
  onAnswer: (id: string) => void
}

function cardCls(disabled: boolean, reveal: boolean, correct: boolean, wrong: boolean): string {
  if (reveal || correct) {
    return 'border-emerald/70 bg-emerald/10 text-ink ring-2 ring-emerald/30'
  }
  if (wrong) {
    return 'border-red bg-red-tint text-red'
  }
  if (disabled) {
    return 'border-hairline bg-surface-2 text-ink-2'
  }
  return 'border-hairline bg-surface text-ink hover:border-accent/60 hover:shadow-card'
}

function SpeakChip({ kingdom, text, label }: { kingdom: KingdomKey | 'mixed'; text: string; label: string }) {
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        speakCard(kingdom, text)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          e.stopPropagation()
          speakCard(kingdom, text)
        }
      }}
      className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/75 text-accent shadow-card transition-transform hover:scale-110 active:scale-95"
    >
      <Volume2 className="h-4 w-4" />
    </span>
  )
}

export function Choice({
  prompt,
  promptSpeak,
  kingdom,
  options,
  disabled = false,
  revealId = null,
  correctId = null,
  wrongId = null,
  onAnswer,
}: ChoiceProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-center gap-2 px-2">
        <p className="text-center text-lg font-bold leading-snug text-ink">{prompt}</p>
        {promptSpeak ? (
          <button
            type="button"
            onClick={() => speakCard(kingdom, promptSpeak)}
            aria-label="朗读题目"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-2 transition-colors hover:bg-accent-tint hover:text-accent"
          >
            <Volume2 className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {options.map((o) => {
          const reveal = revealId === o.id
          const correct = correctId === o.id
          const wrong = wrongId === o.id
          const clickable = !disabled
          return (
            <motion.button
              key={o.id}
              type="button"
              aria-disabled={disabled}
              onClick={() => {
                if (!clickable) return
                onAnswer(o.id)
              }}
              animate={wrong ? { x: [0, -9, 9, -6, 6, 0] } : { x: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className={cn(
                'relative flex min-h-[84px] flex-col items-center justify-center gap-1.5 rounded-3xl border-2 px-3 py-3 text-center transition-colors',
                cardCls(disabled, reveal, correct, wrong),
                !disabled && 'active:scale-[0.96] cursor-pointer',
              )}
            >
              {o.emoji ? (
                <span aria-hidden className="text-3xl leading-none">
                  {o.emoji}
                </span>
              ) : null}
              <span className={cn('font-bold leading-tight', o.emoji ? 'text-[15px]' : 'text-xl')}>{o.text}</span>
              {o.speak ? <SpeakChip kingdom={kingdom} text={o.speak} label={`朗读 ${o.text}`} /> : null}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
