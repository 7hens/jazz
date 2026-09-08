import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import type { SpeechRole } from '@/shared/services'
import { cn } from '@/shared/ui/utils'
import { Button } from '@/shared/ui/button'
import type { AtmosphereKey, ChapterLine } from './chapter'
import { StageCast, StageFrame, StageSky } from './stage'
import { castFor, isNarrator } from './stage-meta'
import { moodBorder } from './stage-visuals'

export type DialoguePresenterProps = {
  lines: readonly ChapterLine[]
  atmosphere: AtmosphereKey
  restored?: ReadonlyArray<{ wordId: number }>
  skyWords?: ReadonlyArray<{ id: number; emoji: string }>
  cast?: readonly SpeechRole[]
  speakRole(text: string, role: SpeechRole): boolean
  onDone(): void
  onExit?: () => void
  doneLabel?: string
  ariaLabel?: string
}

function tail() {
  return (
    <span aria-hidden className="mx-auto -mt-1 block h-0 w-0 border-x-8 border-t-[10px] border-x-transparent border-t-surface" />
  )
}

function Bubble({ line }: { line: ChapterLine }) {
  return (
    <div className="w-full">
      <div
        className={cn(
          'rounded-2xl rounded-tl-sm border-2 bg-surface px-4 py-2.5 text-[15px] font-bold leading-relaxed text-ink shadow-card sm:text-base',
          moodBorder(line.mood ?? 'calm'),
        )}
      >
        {line.text}
      </div>
      {tail()}
    </div>
  )
}

export function DialoguePresenter({
  lines,
  atmosphere,
  restored,
  skyWords,
  cast,
  speakRole,
  onDone,
  onExit,
  doneLabel = '继续',
}: DialoguePresenterProps) {
  const [index, setIndex] = useState(0)
  const saidRef = useRef<number | null>(null)
  const line = lines[Math.min(index, lines.length - 1)]

  useEffect(() => {
    if (!line || saidRef.current === index) return
    saidRef.current = index
    speakRole(line.text, line.role)
  }, [index, line, speakRole])

  if (!line) {
    return (
      <StageFrame>
        <div className="flex h-full items-center justify-center">
          <Button size="lg" onClick={onDone}>
            {doneLabel}
          </Button>
        </div>
      </StageFrame>
    )
  }

  const isLast = index >= lines.length - 1
  const advance = () => (isLast ? onDone() : setIndex((i) => i + 1))
  const showBubble = !isNarrator(line.role)
  const speaker = isNarrator(line.role) ? null : line.role
  const displayCast = castFor(lines, cast) // narrator 已被 castFor 滤除

  return (
    <StageFrame>
      <StageSky atmosphere={atmosphere} words={skyWords ?? []} restored={restored} />
      {onExit ? (
        <Button variant="ghost" size="icon" aria-label="返回地图" onClick={onExit} className="absolute left-3 top-3 z-20">
          <ArrowLeft className="h-5 w-5" />
        </Button>
      ) : null}

      {isNarrator(line.role) ? (
        <div className="absolute left-1/2 top-[14vh] z-10 w-[72vw] max-w-sm -translate-x-1/2">
          <p className="rounded-xl border border-dashed border-ink-3 bg-canvas-2/90 px-4 py-2 text-center text-sm font-semibold text-ink-2">
            {line.text}
          </p>
        </div>
      ) : null}

      <StageCast cast={displayCast} speaker={speaker} bubble={showBubble ? <Bubble line={line} /> : undefined} />

      <button
        type="button"
        aria-label="下一句"
        onClick={advance}
        className="absolute inset-0 z-10 cursor-pointer bg-transparent"
      />

      <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <span aria-hidden className="text-sm font-bold text-ink/70 drop-shadow">
          {isLast ? '' : '点一下继续'}
        </span>
        <Button size="lg" onClick={advance}>
          {isLast ? doneLabel : '继续'}
          {isLast ? <ArrowRight className="ml-1 h-4 w-4" /> : null}
        </Button>
      </div>
    </StageFrame>
  )
}
