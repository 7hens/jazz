import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Check, Volume2 } from 'lucide-react'
import { cn } from '@/shared/utils'
import type { AudioCue } from '@/shared/services'
import { speakCard, type Speak } from './speech'
import type { BaseOption, KingdomKey } from '@/shared/types'

type MatchGameProps = {
  prompt: string
  left: BaseOption[]
  right: BaseOption[]
  answerMap: Record<string, string>
  kingdom: KingdomKey | 'mixed'
  playSound: (cue: AudioCue) => void
  speak: Speak
  /** 全部配对成功时触发,传任一正确 left id(语义上整题 +10)。 */
  onComplete: (leftId: string) => void
}

export function MatchGame({
  prompt,
  left,
  right,
  answerMap,
  kingdom,
  playSound,
  speak,
  onComplete,
}: MatchGameProps) {
  const [selL, setSelL] = useState<string | null>(null)
  const [selR, setSelR] = useState<string | null>(null)
  const [matched, setMatched] = useState<Record<string, string>>({})
  const [mismatch, setMismatch] = useState<[string, string] | null>(null)
  const [done, setDone] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    },
    [],
  )

  function settlePair(l: string, r: string) {
    if (done) return
    if (answerMap[l] === r) {
      const next = { ...matched, [l]: r }
      setMatched(next)
      setSelL(null)
      setSelR(null)
      if (Object.keys(next).length === left.length) {
        setDone(true)
        onComplete(left[0]?.id ?? '')
      } else {
        playSound('tap')
      }
    } else {
      playSound('wrong')
      setSelL(null)
      setSelR(null)
      setMismatch([l, r])
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => setMismatch(null), 420)
    }
  }

  function pickLeft(id: string) {
    if (matched[id] || mismatch || done) return
    if (selR) settlePair(id, selR)
    else setSelL((p) => (p === id ? null : id))
  }

  function pickRight(id: string) {
    const matchedRightIds = Object.values(matched)
    if (matchedRightIds.includes(id) || mismatch || done) return
    if (selL) settlePair(selL, id)
    else setSelR((p) => (p === id ? null : id))
  }

  function renderCard(o: BaseOption, isLeft: boolean) {
    const matchedRightIds = Object.values(matched)
    const isMatched = isLeft ? matched[o.id] !== undefined : matchedRightIds.includes(o.id)
    const isSel = isLeft ? selL === o.id : selR === o.id
    const isMis = mismatch ? (isLeft ? mismatch[0] === o.id : mismatch[1] === o.id) : false
    const speakText = o.speak
    return (
      <motion.button
        key={o.id}
        type="button"
        aria-disabled={Boolean(isMatched || mismatch || done)}
        onClick={() => (isLeft ? pickLeft(o.id) : pickRight(o.id))}
        animate={isMis ? { x: [0, -9, 9, -6, 6, 0] } : { x: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className={cn(
          'relative flex min-h-[64px] w-full items-center justify-center gap-2 rounded-2xl border-2 px-3 py-3 text-center transition-colors',
          isMatched
            ? 'border-emerald/60 bg-emerald/10 opacity-80'
            : isMis
              ? 'border-red bg-red-tint'
              : isSel
                ? 'border-accent bg-accent-tint shadow-card'
                : 'border-hairline bg-surface hover:border-accent/60',
          !isMatched && !mismatch && !done && 'cursor-pointer active:scale-[0.96]',
        )}
      >
        {o.emoji ? (
          <span aria-hidden className="text-2xl leading-none">
            {o.emoji}
          </span>
        ) : null}
        <span className={cn('font-bold leading-tight', o.emoji ? 'text-base' : 'text-xl')}>{o.text}</span>
        {isMatched ? (
          <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald text-white">
            <Check className="h-3.5 w-3.5" />
          </span>
        ) : null}
        {speakText ? (
          <span
            role="button"
            tabIndex={0}
            aria-label={`朗读 ${o.text}`}
            onClick={(e) => {
              e.stopPropagation()
              speakCard(speak, kingdom, speakText)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                e.stopPropagation()
                speakCard(speak, kingdom, speakText)
              }
            }}
            className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/75 text-accent shadow-card transition-transform hover:scale-110"
          >
            <Volume2 className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </motion.button>
    )
  }

  return (
    <div className="space-y-5">
      <p className="text-center text-lg font-bold leading-snug text-ink">{prompt}</p>
      <div className="grid grid-cols-2 items-start gap-3">
        <div className="space-y-2.5">{left.map((o) => renderCard(o, true))}</div>
        <div className="space-y-2.5">{right.map((o) => renderCard(o, false))}</div>
      </div>
    </div>
  )
}
