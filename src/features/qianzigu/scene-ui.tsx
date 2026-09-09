import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Moon } from 'lucide-react'
import { cn } from '@/shared/ui/utils'
import type { AudioCue, Question, SkillKey, SpeechRole, WordUnit } from '@/shared/services'
import { Button } from '@/shared/ui/button'
import { Choice } from '@/shared/ui/quiz/Choice'
import { ListenChoice } from '@/shared/ui/quiz/ListenChoice'
import { MatchGame } from '@/shared/ui/quiz/MatchGame'
import type { ChapterLine, SceneOption, TaskScene as TaskSceneData } from './chapter'

export const ROLE_META: Record<SpeechRole, { name: string; emoji: string }> = {
  lingling: { name: '灵灵', emoji: '🦊' },
  sun: { name: '太阳', emoji: '☀️' },
  moon: { name: '月亮', emoji: '🌙' },
  jingmo: { name: '静默', emoji: '🖤' },
  narrator: { name: '旁白', emoji: '📖' },
  villager: { name: '居民', emoji: '🐰' },
}

export type SpeakFn = (text: string, language?: string) => boolean
export type SpeakRoleFn = (text: string, role: SpeechRole, opts?: { rate?: number; pitch?: number }) => boolean

/** 台词角色气泡(供 LineScene 显示当前一句)。 */
function LineBubble({ line }: { line: ChapterLine }) {
  const meta = ROLE_META[line.role]
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface-2 text-xl" aria-hidden>
        {meta.emoji}
      </span>
      <div className="min-w-0 max-w-[85%]">
        <p className="text-xs font-bold text-ink-3">{meta.name}</p>
        <p className="mt-1 rounded-2xl rounded-tl-sm border border-hairline bg-surface px-4 py-2.5 text-[15px] font-semibold leading-relaxed text-ink shadow-card">
          {line.text}
        </p>
      </div>
    </div>
  )
}

/**
 * 逐句台词面板:进入自动朗读当前句,「继续」逐条推进;末句再点触发 onDone(场景推进)。
 * 用于 dialogue/ending/断点后叙事/恢复收尾 onDone/onGood/BOSS win 等台词承载。
 */
export function LineScene({
  lines,
  speakRole,
  onDone,
  doneLabel = '继续',
  ariaLabel,
}: {
  lines: readonly ChapterLine[]
  speakRole: SpeakRoleFn
  onDone(): void
  doneLabel?: string
  ariaLabel?: string
}) {
  const [index, setIndex] = useState(0)
  const saidRef = useRef<number | null>(null)
  const line = lines[Math.min(index, lines.length - 1)]

  useEffect(() => {
    if (saidRef.current === index && line) return
    saidRef.current = index
    if (line) speakRole(line.text, line.role)
  }, [index, line, speakRole])

  // 空台词列表:直接呈现一颗推进按钮,不卡死。
  if (!line) {
    return (
      <div className="flex flex-col items-center py-10">
        <Button size="lg" onClick={onDone}>{doneLabel}</Button>
      </div>
    )
  }

  const isLast = index >= lines.length - 1
  return (
    <div role={ariaLabel} className="flex flex-col">
      <div className="flex min-h-40 flex-col justify-center px-1 py-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
          >
            <LineBubble line={line} />
          </motion.div>
        </AnimatePresence>
      </div>
      <Button size="lg" className="w-full" onClick={() => (isLast ? onDone() : setIndex((i) => i + 1))}>
        {isLast ? doneLabel : '继续'}
        {isLast ? <ArrowRight className="ml-1 h-4 w-4" /> : null}
      </Button>
    </div>
  )
}

/** 自然断点:「继续拯救」→ advance;「明天再来」→ 落库并回地图。
 *  外层 surface 卡:断点屏叠在夜景天空浮层上,需不透明底才可读(旧 <main> 白底已删)。 */
export function BreakScene({ onContinue, onExit }: { onContinue(): void; onExit(): void }) {
  return (
    <div className="rounded-[1.75rem] border border-hairline bg-surface p-5 text-center shadow-card">
      <div className="flex flex-col items-center">
        <p className="text-5xl" aria-hidden>🌙</p>
        <p className="mt-4 text-lg font-extrabold text-ink">天黑了,先休息一下吧?</p>
        <p className="mt-2 max-w-60 text-sm text-ink-2">进度会自动保存,下次从这里继续!</p>
        <Button size="lg" className="mt-6 w-full" onClick={onContinue}>
          继续拯救 <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
        <Button variant="outline" size="lg" className="mt-2.5 w-full" onClick={onExit}>
          <Moon className="mr-2 h-4 w-4" /> 明天再来
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 题目判分(复用 WordLesson 的 2 次作答/reveal 语义;答案正确 → onPass) */
/* ------------------------------------------------------------------ */

function QuestionCard({
  word,
  skill,
  question,
  speak,
  playSound,
  onPass,
  onDoubleWrong,
  retryLabel = '再练一次',
}: {
  word: WordUnit
  skill: SkillKey
  question: Question
  speak: SpeakFn
  playSound(cue: AudioCue): void
  onPass(): void
  onDoubleWrong(): void
  retryLabel?: string
}) {
  const [attempt, setAttempt] = useState<1 | 2>(1)
  const [phase, setPhase] = useState<'answering' | 'reveal'>('answering')
  const [revealId, setRevealId] = useState<string | null>(null)
  const [correctId, setCorrectId] = useState<string | null>(null)
  const [wrongId, setWrongId] = useState<string | null>(null)

  function resetFeedback() {
    setRevealId(null)
    setCorrectId(null)
    setWrongId(null)
    setAttempt(1)
    setPhase('answering')
  }

  function handleAnswer(selectedId: string) {
    if (phase !== 'answering') return
    if (question.kind === 'match') {
      // MatchGame 整组配对成功即视为本题通过(attempt 恒 1)
      playSound('correct')
      onPass()
      return
    }
    const correct = selectedId === question.answerId
    if (correct) {
      // 对:立即放行(答对推进由父级处理;卡随 key 重挂载复位)
      playSound('correct')
      onPass()
    } else if (attempt === 1) {
      playSound('wrong')
      setWrongId(selectedId)
      setAttempt(2)
    } else {
      playSound('wrong')
      setWrongId(selectedId)
      setRevealId(question.answerId)
      setPhase('reveal')
    }
  }

  function renderQuestion() {
    const shared = {
      skill,
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
            speak={speak}
            {...shared}
          />
        )
      case 'choice':
        return (
          <Choice
            prompt={question.prompt}
            promptEmoji={word.emoji}
            options={question.options}
            speak={speak}
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
            skill={skill}
            playSound={playSound}
            speak={speak}
            onComplete={handleAnswer}
          />
        )
    }
  }

  return (
    <div className="rounded-[1.75rem] border border-hairline bg-surface p-4 shadow-card sm:p-6">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key="q"
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -18 }}
          transition={{ type: 'spring', bounce: 0, duration: 0.28 }}
        >
          {renderQuestion()}
        </motion.div>
      </AnimatePresence>

      <div className="flex min-h-[40px] items-center justify-center pt-3">
        <AnimatePresence mode="wait">
          {phase === 'reveal' ? (
            <motion.p key="reveal" className="rounded-full bg-red-tint px-4 py-1.5 text-sm font-bold text-red">
              ✗ 再试一次吧
            </motion.p>
          ) : null}
          {phase === 'answering' && attempt === 2 ? (
            <motion.p key="retry" className="rounded-full bg-accent-tint px-4 py-1.5 text-sm font-bold text-accent">
              再试一次吧 ✨
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>

      {phase === 'reveal' ? (
        <Button size="lg" className="mt-1 w-full" onClick={() => { resetFeedback(); onDoubleWrong() }}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  )
}

/* ------------------------------- Task ------------------------------- */

export type TaskSceneProps = {
  scene: TaskSceneData
  word: WordUnit
  skill: SkillKey
  makeQuestions(): Question[]
  speak: SpeakFn
  speakRole: SpeakRoleFn
  playSound(cue: AudioCue): void
  /** 答对满 minCorrect 后引擎推进 → 返回 true;false 表示还需在同层继续积累。 */
  onCorrect(wordId: number, layer: TaskSceneData['task']['layer']): boolean
}

export function TaskScene({
  scene,
  word,
  skill,
  makeQuestions,
  speak,
  speakRole,
  playSound,
  onCorrect,
}: TaskSceneProps) {
  const [introDone, setIntroDone] = useState(scene.intro.length === 0)
  const [round, setRound] = useState(0)
  const [questions, setQuestions] = useState<Question[]>(() => makeQuestions())
  const [qIndex, setQIndex] = useState(0)

  if (!introDone) {
    return (
      <div className="rounded-[1.75rem] border border-hairline bg-surface p-5 shadow-card">
        <p className="text-center text-lg font-extrabold">{scene.title}</p>
        <LineScene lines={scene.intro} speakRole={speakRole} onDone={() => setIntroDone(true)} />
      </div>
    )
  }

  const question = questions[qIndex]

  function handlePass() {
    const advanced = onCorrect(scene.task.wordId, scene.task.layer)
    if (advanced) return
    if (qIndex + 1 < questions.length) {
      setQIndex(qIndex + 1)
    } else {
      setQuestions(makeQuestions())
      setQIndex(0)
      setRound((r) => r + 1)
    }
  }

  function handleRetry() {
    setQuestions(makeQuestions())
    setQIndex(0)
    setRound((r) => r + 1)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-extrabold tracking-tight">{scene.title}</h2>
        <span className="shrink-0 rounded-full border border-hairline bg-surface px-2.5 py-1 text-xs font-semibold text-ink-2">
          {word.emoji} {word.hanzi}
        </span>
      </div>
      {question ? (
        <QuestionCard
          key={`${round}-${qIndex}`}
          word={word}
          skill={skill}
          question={question}
          speak={speak}
          playSound={playSound}
          onPass={handlePass}
          onDoubleWrong={handleRetry}
        />
      ) : null}
    </div>
  )
}

/* ------------------------------ Social ------------------------------ */

export type SocialSceneProps = {
  lines: readonly ChapterLine[]
  options: readonly SceneOption[]
  goodOptionId: string
  loop: readonly ChapterLine[]
  onGood: readonly ChapterLine[]
  speakRole: SpeakRoleFn
  playSound(cue: AudioCue): void
  /** 选对后收尾台词放行 → 引擎推进。 */
  onChooseGood(): void
}

export function SocialScene({
  lines,
  options,
  goodOptionId,
  loop,
  onGood,
  speakRole,
  playSound,
  onChooseGood,
}: SocialSceneProps) {
  const [introDone, setIntroDone] = useState(lines.length === 0)
  const [feedback, setFeedback] = useState<readonly ChapterLine[] | null>(null)
  const [goodOverlay, setGoodOverlay] = useState(false)
  // 两段式选:首点=朗读选项文本进入「待确认」,再点同一项=确认选择。
  const [pendingId, setPendingId] = useState<string | null>(null)
  const saidRef = useRef<string | null>(null)

  useEffect(() => {
    if (!feedback || saidRef.current === feedback.map((l) => l.text).join('|')) return
    saidRef.current = feedback.map((l) => l.text).join('|')
    for (const line of feedback) speakRole(line.text, line.role)
  }, [feedback, speakRole])

  if (!introDone) {
    return (
      <div className="rounded-[1.75rem] border border-hairline bg-surface p-5 shadow-card">
        <p className="text-center text-lg font-extrabold">安慰月亮</p>
        <LineScene lines={lines} speakRole={speakRole} onDone={() => setIntroDone(true)} />
      </div>
    )
  }

  if (goodOverlay) {
    // 收尾台词走完 → 引擎放行 social-choose(good)
    const overlayLines = [...onGood]
    return (
      <div className="rounded-[1.75rem] border border-emerald/40 bg-surface p-5 shadow-card">
        <LineScene lines={overlayLines} speakRole={speakRole} doneLabel="继续" onDone={onChooseGood} />
      </div>
    )
  }

  function choose(option: SceneOption) {
    if (option.id === goodOptionId) {
      playSound('correct')
      speakRole(option.response, 'moon')
      setGoodOverlay(true)
      return
    }
    // 非 good:读后果 + 依情景取 loop 引导,停留重弹选项(引擎保持在 social scene)
    playSound('wrong')
    const guideIndex = option.consequence === 'neutral' ? 1 : 0
    const guide = loop[guideIndex]
    const linesToShow: ChapterLine[] = [{ role: 'moon', text: option.response }]
    if (guide) linesToShow.push(guide)
    setFeedback(linesToShow)
  }

  /** 两段式:首点仅朗读(灵灵代读选项文案)并高亮待确认;再点同一项才走 choose。 */
  function handleOptionTap(option: SceneOption) {
    if (pendingId === option.id) {
      setPendingId(null)
      choose(option)
      return
    }
    setPendingId(option.id)
    speakRole(option.text, 'lingling')
  }

  return (
    <div className="space-y-4">
      {feedback ? (
        <div className="space-y-2.5 rounded-2xl border border-hairline bg-surface-2 p-4">
          {feedback.map((l, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-2xl" aria-hidden>{ROLE_META[l.role].emoji}</span>
              <p className="text-sm font-semibold leading-relaxed text-ink-2">{l.text}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="rounded-[1.75rem] border border-hairline bg-surface p-5 shadow-card">
        <h2 className="text-center text-lg font-extrabold">你想怎么做?</h2>
        <div className="mt-4 space-y-2.5">
          {options.map((option) => {
            const pending = pendingId === option.id
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => handleOptionTap(option)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-[15px] font-bold text-ink transition-colors active:scale-[0.99]',
                  pending
                    ? 'border-accent bg-accent-tint shadow-card hover:bg-accent-tint'
                    : 'border-hairline bg-surface hover:border-accent/60 hover:bg-accent-tint/50',
                )}
              >
                {option.emoji ? <span className="text-2xl" aria-hidden>{option.emoji}</span> : null}
                <span className="min-w-0 flex-1">{option.text}</span>
                {pending ? <span className="shrink-0 text-xs font-semibold text-accent">再点一下选它</span> : null}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------- BOSS ------------------------------- */

export type BossSceneProps = {
  intro: readonly ChapterLine[]
  wordPool: readonly WordUnit[]
  makeQuestion(word: WordUnit, skill: SkillKey): Question
  speak: SpeakFn
  speakRole: SpeakRoleFn
  playSound(cue: AudioCue): void
  /** 每答对一题;BossWon 时返回 true(引擎推进离开 boss)。 */
  onBossCorrect(): boolean
  /** 每双错一题;达 maxWrong 失败时返回 true。 */
  onBossWrong(): boolean
}

const BOSS_SKILLS: readonly SkillKey[] = ['pinyin', 'hanzi']

export function BossScene({
  intro,
  wordPool,
  makeQuestion,
  speak,
  speakRole,
  playSound,
  onBossCorrect,
  onBossWrong,
}: BossSceneProps) {
  const [introDone, setIntroDone] = useState(intro.length === 0)
  const [pick, setPick] = useState(() => 0)
  const [session, setSession] = useState(0)

  if (!introDone) {
    return (
      <div className="rounded-[1.75rem] border border-hairline bg-surface p-5 shadow-card">
        <p className="text-center text-4xl" aria-hidden>🖤</p>
        <p className="mt-1 text-center text-lg font-extrabold">静默的挑战</p>
        <LineScene lines={intro} speakRole={speakRole} doneLabel="开始挑战" onDone={() => setIntroDone(true)} />
      </div>
    )
  }

  const word = wordPool[pick % wordPool.length] ?? wordPool[0]
  if (!word) return null
  const skill = BOSS_SKILLS[pick % BOSS_SKILLS.length]
  const question = makeQuestion(word, skill)

  function nextPick() {
    setSession((s) => s + 1)
    setPick((p) => p + 1)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center">
        <span className="rounded-full bg-ink px-3.5 py-1.5 text-sm font-bold text-white">BOSS · 静默</span>
      </div>
      <QuestionCard
        key={`boss-${session}`}
        word={word}
        skill={skill}
        question={question}
        speak={speak}
        playSound={playSound}
        retryLabel="下一题"
        onPass={() => {
          if (onBossCorrect()) return
          nextPick()
        }}
        onDoubleWrong={() => {
          if (onBossWrong()) return
          nextPick()
        }}
      />
    </div>
  )
}

/* ------------------------------ Settle ------------------------------ */

export type SettleCardProps = {
  emoji: string
  heading: string
  subtitle: string
  words: readonly WordUnit[]
  gainedStars: number
  totalStars: number
  summary: readonly ChapterLine[]
  speakRole: SpeakRoleFn
  onBack(): void
}

export function SettleCard({
  emoji,
  heading,
  subtitle,
  words,
  gainedStars,
  totalStars,
  summary,
  speakRole,
  onBack,
}: SettleCardProps) {
  const saidRef = useRef(false)
  useEffect(() => {
    if (saidRef.current || summary.length === 0) return
    saidRef.current = true
    for (const line of summary) speakRole(line.text, line.role)
  }, [summary, speakRole])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[2rem] border-2 border-emerald/50 bg-surface p-6 text-center shadow-pop sm:p-8"
    >
      <p className="text-sm font-semibold uppercase tracking-widest text-ink-3">章节完成</p>
      <div className="mt-3 text-6xl" aria-hidden>{emoji}</div>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight">{heading}</h1>
      <p className="mt-1 text-sm font-medium text-ink-2">{subtitle}</p>

      <div className="mt-5 rounded-2xl border border-hairline bg-surface-2 px-4 py-3 text-left">
        <p className="text-xs font-bold uppercase tracking-widest text-ink-3">📖 学会的词</p>
        <ul className="mt-2 space-y-1.5">
          {words.map((w) => (
            <li key={w.id} className="flex items-center gap-2 text-sm font-semibold text-ink">
              <span className="text-xl" aria-hidden>{w.emoji}</span>
              <span>{w.hanzi}</span>
              <span className="font-normal text-ink-2">{w.pinyin}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 flex items-center justify-center gap-3">
        <div className="rounded-2xl border border-amber/50 bg-amber-100 px-4 py-2">
          <p className="text-xs font-semibold text-ink-3">本次星尘</p>
          <p className="text-xl font-extrabold text-amber">+{gainedStars}</p>
        </div>
        <div className="rounded-2xl border border-hairline bg-surface px-4 py-2">
          <p className="text-xs font-semibold text-ink-3">星尘累计</p>
          <p className="text-xl font-extrabold text-ink">{totalStars}</p>
        </div>
      </div>

      {summary.length > 0 ? (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-hairline bg-surface-2 px-4 py-3 text-left">
          <span className="text-3xl" aria-hidden>🦊</span>
          <div className="space-y-1 text-left">
            {summary.map((line, i) => (
              <p key={i} className="text-sm leading-relaxed text-ink-2">{line.text}</p>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-6 space-y-2.5">
        <Button variant="outline" size="lg" className="w-full" onClick={onBack}>
          回地图
        </Button>
      </div>
    </motion.div>
  )
}
