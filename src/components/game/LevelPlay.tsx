import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft } from 'lucide-react'
import { cn } from '../../lib/utils'
import { scoreAttempt, type LevelRun } from '../../game/scoring'
import { play } from '../../game/sfx'
import type { Level, Question } from '../../types'
import { Button } from '../ui/button'
import { Choice } from './quiz/Choice'
import { ListenChoice } from './quiz/ListenChoice'
import { MatchGame } from './quiz/MatchGame'

type Phase = 'answering' | 'feedback' | 'reveal'

type LevelPlayProps = {
  level: Level
  onFinish: (runs: LevelRun[]) => void
  onExit: () => void
}

const CORRECT_DELAY_MS = 650

export function LevelPlay({ level, onFinish, onExit }: LevelPlayProps) {
  const total = level.questions.length
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('answering')
  const [attempt, setAttempt] = useState<1 | 2>(1)
  const [streak, setStreak] = useState(0)
  const [revealId, setRevealId] = useState<string | null>(null)
  const [wrongId, setWrongId] = useState<string | null>(null)
  const [correctId, setCorrectId] = useState<string | null>(null)
  const [lastGain, setLastGain] = useState<number | null>(null)
  const runsRef = useRef<LevelRun[]>([])
  const timerRef = useRef<number | null>(null)
  const onFinishRef = useRef(onFinish)

  useEffect(() => {
    onFinishRef.current = onFinish
  }, [onFinish])

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    },
    [],
  )

  const q: Question = level.questions[index]

  function later(fn: () => void, ms: number) {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      fn()
    }, ms)
  }

  function pushRun(question: Question, selectedId: string, attemptN: 1 | 2, prevStreak: number) {
    runsRef.current = [...runsRef.current, { question, selectedId, attempt: attemptN, prevStreak }]
  }

  function resetForNext() {
    setAttempt(1)
    setRevealId(null)
    setWrongId(null)
    setCorrectId(null)
    setLastGain(null)
    setPhase('answering')
  }

  function advance() {
    const isLast = index === total - 1
    if (isLast) {
      onFinishRef.current(runsRef.current)
      return
    }
    setIndex(index + 1)
    resetForNext()
  }

  function handleAnswer(selectedId: string) {
    if (!q || phase !== 'answering') return
    const prevStreak = streak

    if (q.kind === 'match') {
      // 匹配题为整组完成事件:全部配对成功后由 MatchGame 触发,selectedId 为任一正确 left id。
      const res = scoreAttempt(q, selectedId, 1, prevStreak)
      if (!res.correct) return // 防御:非 left id 不应发生
      pushRun(q, selectedId, 1, prevStreak)
      play(prevStreak >= 1 ? 'streak' : 'correct')
      setStreak(res.streak)
      setLastGain(res.points)
      setPhase('feedback')
      later(advance, CORRECT_DELAY_MS)
      return
    }

    const res = scoreAttempt(q, selectedId, attempt, prevStreak)
    pushRun(q, selectedId, attempt, prevStreak)

    if (res.correct) {
      play(attempt === 1 && prevStreak >= 1 ? 'streak' : 'correct')
      setStreak(res.streak)
      setCorrectId(selectedId)
      setWrongId(null)
      setLastGain(res.points)
      setPhase('feedback')
      later(advance, CORRECT_DELAY_MS)
    } else if (attempt === 1) {
      play('wrong')
      setStreak(0)
      setWrongId(selectedId)
      setAttempt(2)
    } else {
      // 两次均错:亮出正确答案,需点「下一题/看结果」继续。
      play('wrong')
      setStreak(0)
      setWrongId(selectedId)
      setRevealId(q.answerId)
      setPhase('reveal')
    }
  }

  function renderQuestion(question: Question) {
    const shared = {
      kingdom: level.kingdom,
      disabled: phase !== 'answering',
      revealId,
      correctId,
      wrongId,
      onAnswer: handleAnswer,
    }
    switch (question.kind) {
      case 'listen-choice':
        return <ListenChoice prompt={question.prompt} promptSpeak={question.promptSpeak} options={question.options} {...shared} />
      case 'choice':
        return <Choice prompt={question.prompt} promptSpeak={question.speak} options={question.options} {...shared} />
      case 'match':
        return (
          <MatchGame
            prompt={question.prompt}
            left={question.left}
            right={question.right}
            answerMap={question.answerMap}
            kingdom={level.kingdom}
            onComplete={handleAnswer}
          />
        )
    }
  }

  const isLast = index === total - 1

  return (
    <div className="min-h-screen text-ink">
      <header className="glass-strong sticky top-0 z-30 border-b border-hairline">
        <div className="mx-auto flex h-14 max-w-xl items-center gap-2 px-4">
          <Button variant="ghost" size="icon" onClick={onExit} aria-label="返回地图">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="truncate text-[15px] font-bold">
            第 {level.id} 关 · {level.title}
          </span>
          <span className="ml-auto shrink-0 rounded-full border border-hairline bg-surface px-2.5 py-1 text-xs font-semibold text-ink-2">
            {index + 1}/{total}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 pb-24 pt-5">
        {/* 进度点 */}
        <div className="flex items-center justify-center gap-1.5 pb-4">
          {level.questions.map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-2 rounded-full transition-all',
                i < index ? 'w-2 bg-emerald' : i === index ? 'w-5 bg-accent' : 'w-2 bg-ink-3/25',
              )}
            />
          ))}
        </div>

        <div className="rounded-[1.75rem] border border-hairline bg-surface p-4 shadow-card sm:p-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={index}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.32 }}
            >
              {renderQuestion(q)}
            </motion.div>
          </AnimatePresence>

          {/* 反馈徽标 / 提示 */}
          <div className="flex min-h-[52px] items-center justify-center pt-3">
            <AnimatePresence mode="wait">
              {phase === 'feedback' && lastGain !== null ? (
                <motion.div
                  key="ok"
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5 rounded-full bg-emerald/10 px-4 py-1.5 text-sm font-bold text-emerald"
                >
                  ✓ 答对啦 +{lastGain} 分
                </motion.div>
              ) : null}
              {phase === 'reveal' ? (
                <motion.div
                  key="reveal"
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5 rounded-full bg-red-tint px-4 py-1.5 text-sm font-bold text-red"
                >
                  ✗ 正确答案已亮出
                </motion.div>
              ) : null}
              {phase === 'answering' && attempt === 2 ? (
                <motion.div
                  key="retry"
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5 rounded-full bg-accent-tint px-4 py-1.5 text-sm font-bold text-accent"
                >
                  再试一次吧 ✨
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          {phase === 'reveal' ? (
            <Button size="lg" className="mt-1 w-full" onClick={advance}>
              {isLast ? '看结果' : '下一题'}
            </Button>
          ) : null}
        </div>
      </main>
    </div>
  )
}
