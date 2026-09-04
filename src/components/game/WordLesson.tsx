import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft } from 'lucide-react'
import { cn } from '../../lib/utils'
import { makeStepQuestions } from '../../game/engine'
import { play } from '../../game/sfx'
import { stepsFor } from '../../game/lesson'
import { celebrate } from '../../game/confetti'
import type { AnswerKind } from '../../game/combo'
import type { Question, SkillKey, UserSettings, WordUnit } from '../../types'
import { ComboDisplay, comboText } from './ComboDisplay'
import { Button } from '../ui/button'
import { Choice } from './quiz/Choice'
import { ListenChoice } from './quiz/ListenChoice'
import { MatchGame } from './quiz/MatchGame'

export type WordLessonProps = {
  word: WordUnit
  settings: UserSettings
  combo: number
  onAnswer: (kind: AnswerKind) => void
  onStepPass: (skill: SkillKey) => void
  onLessonComplete: () => void
  onExit: () => void
}

const SKILL_LABEL: Record<SkillKey, string> = { pinyin: '拼音', hanzi: '汉字', english: '英语' }

const CORRECT_DELAY_MS = 650

// 连击阈值(与 combo.ts 星级无关,纯展示档位);跨过任一档即弹字
const COMBO_HITS = [1, 2, 3, 5, 8, 10]
function crossedLevel(prev: number, next: number): boolean {
  return COMBO_HITS.some((h) => prev < h && next >= h)
}

export function WordLesson({ word, settings, combo, onAnswer, onStepPass, onLessonComplete, onExit }: WordLessonProps) {
  const steps = stepsFor(settings)
  const [stepIndex, setStepIndex] = useState(0)
  const [round, setRound] = useState(0) // 失败重建同步
  const [questions, setQuestions] = useState<Question[]>(() => makeStepQuestions(word, steps[0], Math.random))
  const [qIndex, setQIndex] = useState(0)
  const [attempt, setAttempt] = useState<1 | 2>(1)
  const [phase, setPhase] = useState<'answering' | 'feedback' | 'reveal'>('answering')
  const [revealId, setRevealId] = useState<string | null>(null)
  const [wrongId, setWrongId] = useState<string | null>(null)
  const [correctId, setCorrectId] = useState<string | null>(null)
  const [comboBurst, setComboBurst] = useState<{ text: string; className: string } | null>(null)
  const prevCombo = useRef(combo)
  const timerRef = useRef<number | null>(null)

  const skill = steps[stepIndex]
  const q: Question = questions[qIndex]
  const isLastStep = stepIndex === steps.length - 1
  const isLastQuestion = qIndex === questions.length - 1

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    },
    [],
  )

  // combo 升高且越过阈值 → 弹字 1s;combo 回落(断连)→ 立即收起;combo===10 撒花
  useEffect(() => {
    const prev = prevCombo.current
    prevCombo.current = combo
    if (combo <= prev) {
      setComboBurst(null)
      return
    }
    if (!crossedLevel(prev, combo)) return
    setComboBurst(comboText(combo))
    if (combo === 10) celebrate('combo10')
    const t = window.setTimeout(() => setComboBurst(null), 1000)
    return () => window.clearTimeout(t)
  }, [combo])

  // step/round 变化 → 重新出题并复位
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    setQuestions(makeStepQuestions(word, steps[stepIndex], Math.random))
    setQIndex(0)
    setAttempt(1)
    setPhase('answering')
    setRevealId(null)
    setWrongId(null)
    setCorrectId(null)
  }, [word, stepIndex, round]) // eslint-disable-line react-hooks/exhaustive-deps

  function later(fn: () => void, ms: number) {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      fn()
    }, ms)
  }

  function stepPassed() {
    onStepPass(skill)
    if (isLastStep) {
      onLessonComplete()
      return
    }
    setStepIndex((i) => i + 1) // 触发 effect 换题
  }

  function goNextQuestion() {
    if (isLastQuestion) {
      stepPassed()
      return
    }
    setQIndex((i) => i + 1)
    setAttempt(1)
    setPhase('answering')
    setRevealId(null)
    setWrongId(null)
    setCorrectId(null)
  }

  function handleAnswer(selectedId: string) {
    if (!q || phase !== 'answering') return
    if (q.kind === 'match') {
      // MatchGame 只在全部配对成功时 onComplete;整组对 = 该题一次通过(attempt 恒 1)
      onAnswer('first')
      play('correct')
      setCorrectId(q.left[0]?.id ?? '')
      setPhase('feedback')
      later(goNextQuestion, CORRECT_DELAY_MS)
      return
    }
    const correct = selectedId === q.answerId
    const firstTry = attempt === 1
    if (correct) {
      onAnswer(firstTry ? 'first' : 'retry')
      play('correct')
      setCorrectId(selectedId)
      setWrongId(null)
      setPhase('feedback')
      later(goNextQuestion, CORRECT_DELAY_MS)
    } else if (attempt === 1) {
      onAnswer('wrong')
      play('wrong')
      setWrongId(selectedId)
      setAttempt(2)
    } else {
      // 两次均错 → 步失败,重做整步
      onAnswer('wrong')
      play('wrong')
      setWrongId(selectedId)
      setRevealId(q.answerId)
      setPhase('reveal')
    }
  }

  function renderQuestion(question: Question) {
    const shared = {
      kingdom: skill,
      disabled: phase !== 'answering',
      revealId,
      correctId,
      wrongId,
      onAnswer: handleAnswer,
    }
    switch (question.kind) {
      case 'listen-choice':
        return (
          <ListenChoice
            prompt={question.prompt}
            promptSpeak={question.promptSpeak}
            options={question.options}
            {...shared}
          />
        )
      case 'choice':
        // 题干大图 = 当前词 emoji(选项不放图)
        return (
          <Choice
            prompt={question.prompt}
            promptEmoji={word.emoji}
            options={question.options}
            {...shared}
          />
        )
      case 'match':
        return (
          <MatchGame
            prompt={question.prompt}
            left={question.left}
            right={question.right}
            answerMap={question.answerMap}
            kingdom={skill}
            onComplete={handleAnswer}
          />
        )
    }
  }

  return (
    <div className="min-h-screen text-ink">
      <header className="glass-strong sticky top-0 z-30 border-b border-hairline">
        <div className="mx-auto flex h-14 max-w-xl items-center gap-2 px-4">
          <Button variant="ghost" size="icon" onClick={onExit} aria-label="返回地图">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="truncate text-[15px] font-bold">
            {word.emoji} {word.hanzi} · {SKILL_LABEL[skill]}
          </span>
          <span className="ml-auto shrink-0 rounded-full border border-hairline bg-surface px-2.5 py-1 text-xs font-semibold text-ink-2">
            {qIndex + 1}/{questions.length} · 第{stepIndex + 1}/{steps.length}技能
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 pb-24 pt-5">
        {/* 技能步进度点 */}
        <div className="flex items-center justify-center gap-1.5 pb-4">
          {steps.map((s, i) => (
            <span
              key={s}
              className={cn(
                'h-2 rounded-full transition-all',
                i < stepIndex ? 'w-2 bg-emerald' : i === stepIndex ? 'w-5 bg-accent' : 'w-2 bg-ink-3/25',
              )}
            />
          ))}
        </div>

        <div className="rounded-[1.75rem] border border-hairline bg-surface p-4 shadow-card sm:p-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${stepIndex}-${round}-${qIndex}`}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.32 }}
            >
              {renderQuestion(q)}
            </motion.div>
          </AnimatePresence>

          {/* 连击阈值弹字(1s 自隐) */}
          <AnimatePresence>{comboBurst ? <ComboDisplay {...comboBurst} /> : null}</AnimatePresence>

          {/* 反馈徽标 */}
          <div className="flex min-h-[52px] items-center justify-center pt-3">
            <AnimatePresence mode="wait">
              {phase === 'feedback' ? (
                <motion.div
                  key="ok"
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5 rounded-full bg-emerald/10 px-4 py-1.5 text-sm font-bold text-emerald"
                >
                  ✓ 答对啦
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
                  ✗ 这步要再练一次
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
            <Button size="lg" className="mt-1 w-full" onClick={() => setRound((r) => r + 1)}>
              再练一次
            </Button>
          ) : null}
        </div>
      </main>
    </div>
  )
}
