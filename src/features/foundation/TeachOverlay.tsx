// TeachOverlay:词前短教「纯判分题」(0 星、不触发 fun 系统)。
// 0.2.0 起语义:删「演示→点读」两步与听齐门控(requireVisitAll 已随 Choice 移除),
// 对每个未教单元**直接出 4 选项判分题**(答对进阶、答错复演示该块后重试),全量单元出题不设上限;
// 全过 markTaught + 夸奖结课。组件不自取服务(不 useService):教学回调经 props 注入 basics 逐题直写。
// 只 import ./、@/shared/* 与外部包 —— architecture 边界测试强制。
import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import type { AudioCue, WordUnit } from '@/shared/services'
import type { BasicsService } from '@/shared/services'
import { Choice } from '@/shared/ui/quiz/Choice'
import { ListenChoice } from '@/shared/ui/quiz/ListenChoice'
import { langFor, type Speak } from '@/shared/ui/quiz/speech'
import { questionForUnit } from './teach-questions'
import type { TeachQuestion } from './teach-questions'

export type TeachOverlayProps = {
  word: WordUnit
  skill: 'pinyin' | 'english'
  units: readonly string[] // 该词该技能拆出的目标单元(TeachGate 传入;≥1)
  basics: BasicsService // 教学回调直接落库(组件不 useService,由组装方注入)
  speak: Speak
  playSound: (cue: AudioCue) => void
  onDone: () => void // 全部完成(已 record/markTaught)或中途「直接答题」跳过
  onExit?: () => void // 短教出口:标题返回 / praise「返回地图」(可选,缺省无出口)
}

type Phase = 'quiz' | 'praise'
type QuizItem = { unit: string; q: TeachQuestion }

const CORRECT_DELAY_MS = 420 // 答对绿闪后推进,让儿童看到正确反馈

const SKILL_LABEL = { pinyin: '拼音', english: '英语' } as const

export function TeachOverlay({ word, skill, units, basics, speak, playSound, onDone, onExit }: TeachOverlayProps) {
  const lang = langFor(skill)

  // 全量出题:每个能公平出题的单元一条;目录缺等无题单元不入列但仍随 markTaught 记录。
  const [quiz] = useState<QuizItem[]>(() => {
    const items: QuizItem[] = []
    for (const unit of units) {
      const q = questionForUnit(unit)
      if (q) items.push({ unit, q })
    }
    return items
  })

  const [phase, setPhase] = useState<Phase>('quiz')
  const [qi, setQi] = useState(0)
  const [qState, setQState] = useState<'answer' | 'correct' | 'wrong'>('answer')
  const [correctId, setCorrectId] = useState<string | null>(null)

  const timerRef = useRef<number | null>(null)
  const emptyBootRef = useRef(false)

  // 卸载时清定时器,防滞后 setState。
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    },
    [],
  )

  // 全部无可出题单元(目录缺兜底):无题可判,直接把整组标教过并夸奖结课。
  // ref 去重防 StrictMode 双 effect 重复 markTaught(+2 教学计数)。
  useEffect(() => {
    if (quiz.length !== 0 || emptyBootRef.current) return
    emptyBootRef.current = true
    void basics.markTaught(units).catch(() => {})
    playSound('correct')
    setPhase('praise')
  }, [quiz.length, units, basics, playSound])

  function later(fn: () => void, ms: number) {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      fn()
    }, ms)
  }

  function skip() {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    onDone()
  }

  function handleQuizAnswer(answerId: string) {
    const item = qi < quiz.length ? quiz[qi] : null
    if (!item || qState !== 'answer') return
    if (answerId === item.q.answerId) {
      playSound('correct')
      void basics.recordAnswer(item.unit, true).catch(() => {})
      const last = qi >= quiz.length - 1
      if (last) {
        // 全对立即同步落教学记录(幂等),再定时切 praise —— 防绿闪窗口点「直接答题」跳过丢教学记录。
        void basics.markTaught(units).catch(() => {})
      }
      setQState('correct')
      setCorrectId(answerId)
      later(() => {
        if (last) {
          setPhase('praise')
        } else {
          setQi(qi + 1)
          setQState('answer')
          setCorrectId(null)
        }
      }, CORRECT_DELAY_MS)
    } else {
      playSound('wrong')
      void basics.recordAnswer(item.unit, false).catch(() => {})
      // 复演示该块:朗读正确答案锚点(错后不推进,停在本题)。
      const opt = item.q.options.find((o) => o.id === item.q.answerId)
      if (opt) speak(opt.speak || opt.text, lang)
      setQState('wrong')
    }
  }

  function retryQuestion() {
    playSound('tap')
    setQState('answer')
    setCorrectId(null)
  }

  const item: QuizItem | null = qi < quiz.length ? quiz[qi] : null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-accent/10 backdrop-blur-sm">
      <div className="mx-auto flex min-h-full max-w-xl flex-col px-4 py-5">
        <header className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {onExit && phase !== 'praise' ? (
              <Button variant="ghost" size="icon" onClick={onExit} aria-label="返回">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            ) : null}
            <span className="rounded-full border border-accent/40 bg-accent-tint/60 px-2.5 py-1 text-xs font-semibold text-accent-ink">
              {word.emoji} {word.hanzi} · {SKILL_LABEL[skill]}短教
            </span>
          </div>
          {phase !== 'praise' ? (
            <Button variant="ghost" size="sm" onClick={skip} aria-label="跳过短教直接答题">
              直接答题
            </Button>
          ) : null}
        </header>

        <main className="flex flex-1 flex-col items-center justify-center gap-6 py-5">
          {phase === 'quiz' && item ? renderQuiz() : null}
          {phase === 'praise' ? renderPraise() : null}
        </main>
      </div>
    </div>
  )

  /** 判分题步:逐题考刚拆的目标单元,答对即过、答错复演示可重试。 */
  function renderQuiz() {
    if (!item) return null
    const q = item.q
    const progress = quiz.length
    return (
      <div className="w-full">
        <div className="flex items-center justify-center gap-1.5 pb-3">
          {Array.from({ length: progress }).map((_, i) => (
            <span
              key={i}
              className={`h-2 rounded-full transition-all ${
                i < qi ? 'w-2 bg-emerald' : i === qi ? 'w-5 bg-accent' : 'w-2 bg-ink-3/25'
              }`}
            />
          ))}
        </div>

        {qState === 'wrong' ? renderWrongFeedback(q) : renderQuestion(q)}
      </div>
    )
  }

  function renderWrongFeedback(q: TeachQuestion) {
    const opt = q.options.find((o) => o.id === q.answerId)
    return (
      <motion.div
        key={`wrong-${qi}`}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-[1.75rem] border-2 border-emerald/60 bg-emerald/10 p-6 text-center"
      >
        <div role="status">
          <motion.div
            animate={{ x: [0, -9, 9, -6, 6, 0] }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="flex flex-col items-center gap-2"
          >
            {opt?.emoji ? (
              <span aria-hidden className="text-5xl leading-none">
                {opt.emoji}
              </span>
            ) : null}
            <p className="text-xl font-extrabold text-ink">
              对,是 {opt?.text} !
            </p>
            <p className="text-sm font-medium text-ink-2">再听一遍,然后试一试</p>
          </motion.div>
        </div>
        <Button variant="secondary" size="lg" className="mt-4" onClick={retryQuestion}>
          再试一次
        </Button>
      </motion.div>
    )
  }

  function renderQuestion(q: TeachQuestion) {
    const shared = {
      skill,
      options: q.options,
      speak,
      disabled: qState === 'correct',
      correctId: qState === 'correct' ? correctId : null,
      onAnswer: handleQuizAnswer,
    }
    return (
      <motion.div
        key={`q-${qi}`}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
        className="rounded-[1.75rem] border-2 border-accent/30 bg-accent/10 p-4 sm:p-5"
      >
        {q.kind === 'choice' ? (
          <Choice prompt={q.prompt} promptSpeak={q.promptSpeak} promptEmoji={q.promptEmoji} {...shared} />
        ) : (
          <ListenChoice prompt={q.prompt} promptSpeak={q.promptSpeak} {...shared} />
        )}
      </motion.div>
    )
  }

  /** 结课步:全对后夸奖 + 开始正式答题。 */
  function renderPraise() {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div role="status" className="flex flex-col items-center gap-2">
          <motion.div
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', bounce: 0.5 }}
            className="text-6xl"
            aria-hidden
          >
            🎉
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xl font-extrabold text-ink"
          >
            太棒了,我们开始答题吧!
          </motion.p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {onExit ? (
            <Button variant="ghost" onClick={onExit}>
              返回地图
            </Button>
          ) : null}
          <Button size="lg" onClick={onDone}>
            开始答题!
          </Button>
        </div>
      </div>
    )
  }
}
