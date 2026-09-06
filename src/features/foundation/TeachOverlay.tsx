// TeachOverlay:词前短教「演示拆合 → 点读 → 轻测」三步(0 星、不触发 fun 系统)。
// 组件不自取服务(不 useService):教学回调经 props 注入 basics,逐题/成组直写 BasicsService。
// 只 import ./、@/shared/* 与外部包 —— architecture 边界测试强制。
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { ArrowLeft, Volume2 } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import type { AudioCue, WordUnit } from '@/shared/services'
import type { BasicsService } from '@/shared/services'
import { Choice } from '@/shared/ui/quiz/Choice'
import { ListenChoice } from '@/shared/ui/quiz/ListenChoice'
import { langFor, type Speak } from '@/shared/ui/quiz/speech'
import { demoBlocksFor } from './demo-blocks'
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

type Phase = 'demo' | 'tap' | 'quiz' | 'praise'
type QuizItem = { unit: string; q: TeachQuestion }

const TEACH_QUIZ_MAX = 3 // 词单元 > 3 只轻测前 3(演示仍全量)
const CORRECT_DELAY_MS = 420 // 答对绿闪后推进,让儿童看到正确反馈

const SKILL_LABEL = { pinyin: '拼音', english: '英语' } as const

export function TeachOverlay({ word, skill, units, basics, speak, playSound, onDone, onExit }: TeachOverlayProps) {
  const lang = langFor(skill)
  const demo = useMemo(() => demoBlocksFor(word, skill), [word, skill])

  const [phase, setPhase] = useState<Phase>('demo')
  const [replayKey, setReplayKey] = useState(0)
  const [quiz, setQuiz] = useState<QuizItem[] | null>(null)
  const [qi, setQi] = useState(0)
  const [qState, setQState] = useState<'answer' | 'correct' | 'wrong'>('answer')
  const [correctId, setCorrectId] = useState<string | null>(null)

  const timerRef = useRef<number | null>(null)
  const titleReadRef = useRef(false)

  // 卸载时清定时器,防滞后 setState。
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    },
    [],
  )

  // demo 步整词自动朗读一次(回放时经 replayKey 重读)。
  useEffect(() => {
    if (phase !== 'demo' || titleReadRef.current) return
    titleReadRef.current = true
    speak(demo.speakTitle, lang)
  }, [phase, replayKey, demo.speakTitle, lang, speak])

  function later(fn: () => void, ms: number) {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      fn()
    }, ms)
  }

  function replayDemo() {
    titleReadRef.current = false
    setReplayKey((k) => k + 1)
    setPhase('demo')
  }

  function skip() {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    onDone()
  }

  function goTap() {
    playSound('tap')
    setPhase('tap')
  }

  function enterQuiz() {
    playSound('tap')
    const items: QuizItem[] = []
    for (const unit of units.slice(0, TEACH_QUIZ_MAX)) {
      const q = questionForUnit(unit)
      if (q) items.push({ unit, q })
    }
    setQuiz(items)
    setQi(0)
    setQState('answer')
    setCorrectId(null)
    if (items.length === 0) {
      // 全部无可出题单元(目录缺/多音节轻声锚点):演示 + 点读已构成短教 → 直接夸奖结课。
      void basics.markTaught(units).catch(() => {})
      playSound('correct')
      setPhase('praise')
      return
    }
    setPhase('quiz')
  }

  function handleQuizAnswer(answerId: string) {
    const item = quiz && qi < quiz.length ? quiz[qi] : null
    if (!item || qState !== 'answer') return
    if (answerId === item.q.answerId) {
      playSound('correct')
      void basics.recordAnswer(item.unit, true).catch(() => {})
      const last = quiz !== null && qi >= quiz.length - 1
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

  function tapBlock(b: { text: string; speak: string }) {
    speak(b.speak, lang)
  }

  const item: QuizItem | null = quiz && qi < quiz.length ? quiz[qi] : null

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
          {phase === 'demo' ? renderDemo() : null}
          {phase === 'tap' ? renderTap() : null}
          {phase === 'quiz' ? renderQuiz() : null}
          {phase === 'praise' ? renderPraise() : null}
        </main>
      </div>
    </div>
  )

  /** 演示步:逐组砖动画入场,随后「合体」成大音节/字母 chip。 */
  function renderDemo() {
    return (
      <div key={`demo-${replayKey}`} className="flex w-full flex-col items-center gap-5">
        <div className="flex items-center gap-2">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-5xl leading-none"
            aria-hidden
          >
            {word.emoji}
          </motion.div>
          <div className="flex flex-col">
            <span className="text-2xl font-extrabold text-ink">{demo.title}</span>
            <span className="text-xs font-semibold text-ink-2">跟着小魔法师读一读吧</span>
          </div>
          <button
            type="button"
            aria-label="朗读整词"
            onClick={() => speak(demo.speakTitle, lang)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-ink-2 transition-colors hover:bg-accent-tint hover:text-accent"
          >
            <Volume2 className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-start justify-center gap-x-6 gap-y-4">
          {demo.groups.map((g, gi) => {
            const blk = g.blockIds.map((id) => demo.blocks.find((b) => b.id === id)!)
            return (
              <div key={gi} className="flex flex-col items-center gap-1.5">
                <div className="flex items-center gap-1.5">
                  {blk.map((b, bi) => (
                    <motion.button
                      key={b.id}
                      type="button"
                      aria-label={`朗读 ${b.text}`}
                      onClick={() => tapBlock(b)}
                      initial={{ opacity: 0, scale: 0.5, y: 12 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ delay: gi * 0.45 + bi * 0.15, type: 'spring', bounce: 0.45 }}
                      className="flex h-[4.25rem] w-[4.25rem] flex-col items-center justify-center gap-0.5 rounded-2xl border-2 border-hairline bg-surface text-ink shadow-card transition-transform active:scale-90"
                    >
                      <span aria-hidden className="text-2xl leading-none">
                        {b.emoji}
                      </span>
                      <span className="text-sm font-bold">{b.text}</span>
                    </motion.button>
                  ))}
                </div>
                <motion.div
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: gi * 0.45 + blk.length * 0.15 + 0.3, type: 'spring', bounce: 0.4 }}
                  className="flex items-center gap-1 rounded-full bg-accent-tint px-3 py-1"
                >
                  <span className="text-xl font-extrabold tracking-wide text-accent-ink">{g.text}</span>
                  <button
                    type="button"
                    aria-label={`朗读 ${g.text}`}
                    onClick={() => speak(g.speak, lang)}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-white/70 text-accent"
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                  </button>
                </motion.div>
              </div>
            )
          })}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button variant="outline" onClick={replayDemo}>
            回放
          </Button>
          <Button onClick={goTap}>下一步:听一听</Button>
        </div>
      </div>
    )
  }

  /** 点读步:全部砖平铺成点读卡。 */
  function renderTap() {
    return (
      <div className="flex w-full flex-col items-center gap-4">
        <p className="text-lg font-bold text-ink">
          点一点,听一听{skill === 'pinyin' ? '声母和韵母' : '每个字母'}吧!
        </p>
        <div className="grid w-full grid-cols-3 gap-3 sm:grid-cols-4">
          {demo.blocks.map((b) => (
            <motion.button
              key={b.id}
              type="button"
              aria-label={`朗读 ${b.text}`}
              onClick={() => tapBlock(b)}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.04 }}
              className="flex flex-col items-center justify-center gap-1 rounded-3xl border-2 border-hairline bg-surface p-3 text-ink shadow-card transition-all hover:border-accent/60 active:scale-90"
            >
              <span aria-hidden className="text-3xl leading-none">
                {b.emoji}
              </span>
              <span className="font-bold">{b.text}</span>
            </motion.button>
          ))}
        </div>
        <Button onClick={enterQuiz}>下一步:小测验</Button>
      </div>
    )
  }

  /** 轻测步:逐题考刚拆的代表单元;答错给正确反馈 + 复演示 + 再试一次。 */
  function renderQuiz() {
    if (!item) return null
    const q = item.q
    const progress = quiz ? quiz.length : 0
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
      requireVisitAll: true, // 短教学习化:目标+干扰全点听一遍才可确认(仍判分)
      disabled: qState === 'correct',
      correctId: qState === 'correct' ? correctId : null,
      onAnswer: handleQuizAnswer,
    }
    if (q.kind === 'choice') {
      return (
        <motion.div
          key={`q-${qi}`}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
          className="rounded-[1.75rem] border-2 border-accent/30 bg-accent/10 p-4 sm:p-5"
        >
          <Choice prompt={q.prompt} promptSpeak={q.promptSpeak} promptEmoji={q.promptEmoji} {...shared} />
        </motion.div>
      )
    }
    return (
      <motion.div
        key={`q-${qi}`}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
        className="rounded-[1.75rem] border-2 border-accent/30 bg-accent/10 p-4 sm:p-5"
      >
        <ListenChoice prompt={q.prompt} promptSpeak={q.promptSpeak} {...shared} />
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
          <Button variant="ghost" onClick={replayDemo}>
            再看一遍演示
          </Button>
          <Button size="lg" onClick={onDone}>
            开始答题!
          </Button>
        </div>
      </div>
    )
  }
}
