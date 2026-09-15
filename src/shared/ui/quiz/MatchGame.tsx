import { useEffect, useRef, useState } from 'react'
import { cn } from '@/shared/ui/utils'
import type { AudioCue } from '@/shared/services'
import { speakCard, type Speak } from './speech'
import type { BaseOption, SkillKey } from '@/shared/services'
import { TypeBadge } from './TypeBadge'
import { QuestionBubble } from './QuestionBubble'
import { Stone } from './Stone'
import type { StoneState } from './stone'

type MatchGameProps = {
  prompt: string
  left: BaseOption[]
  right: BaseOption[]
  answerMap: Record<string, string>
  skill: SkillKey
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
  skill,
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

  /** 朗读只在「纯选择」时刻(点某侧卡、对侧无待配对选中);配对判合与取消选择都不读。 */
  function speakOnPureSelect(side: 'left' | 'right', id: string) {
    const opt = (side === 'left' ? left : right).find((x) => x.id === id)
    if (opt?.speak) speakCard(speak, skill, opt.speak)
  }

  function pickLeft(id: string) {
    if (matched[id] || mismatch || done) return
    if (selR) { settlePair(id, selR); return }
    if (selL === id) { setSelL(null); return } // 取消选择不朗读
    setSelL(id)
    speakOnPureSelect('left', id)
  }

  function pickRight(id: string) {
    const matchedRightIds = Object.values(matched)
    if (matchedRightIds.includes(id) || mismatch || done) return
    if (selL) { settlePair(selL, id); return }
    if (selR === id) { setSelR(null); return } // 取消选择不朗读
    setSelR(id)
    speakOnPureSelect('right', id)
  }

  function renderCard(o: BaseOption, isLeft: boolean) {
    const matchedRightIds = Object.values(matched)
    const isMatched = isLeft ? matched[o.id] !== undefined : matchedRightIds.includes(o.id)
    const isSel = isLeft ? selL === o.id : selR === o.id
    const isMis = mismatch ? (isLeft ? mismatch[0] === o.id : mismatch[1] === o.id) : false
    const state: StoneState = isMatched ? 'correct' : isMis ? 'wrong' : isSel ? 'selected' : 'idle'
    return (
      <Stone
        key={o.id}
        state={state}
        horizontal
        emoji={o.emoji}
        text={o.text}
        disabled={Boolean(isMatched || mismatch || done)}
        shake={isMis}
        className={cn(isMatched && 'opacity-80', isMatched && 'pointer-events-none')}
        onClick={() => (isLeft ? pickLeft(o.id) : pickRight(o.id))}
      />
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-start">
        <TypeBadge kind="match" />
      </div>
      {/* 无朗读重听语义 → 不传 onReplay,QuestionBubble 渲染 div 而非 button */}
      <QuestionBubble prompt={prompt} />
      <div className="grid grid-cols-2 items-start gap-3">
        <div className="space-y-2.5">{left.map((o) => renderCard(o, true))}</div>
        <div className="space-y-2.5">{right.map((o) => renderCard(o, false))}</div>
      </div>
    </div>
  )
}
