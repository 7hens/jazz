// 冷启动诊断向导:零进度新档案登录后、进群岛前,跑一段探针短测,按三档基线写 BasicsService。
// 0 星、不进群岛、不触发 fun 系统;中途「跳过/退出」零写——逐题只做本地记录(answersRef),
// 「开始游戏」才一次性 saveAll 基线;不做逐题 recordAnswer,避免「答几题就跳」提前落库导致下次登录不再诊断。
// 非 Entry 不自取服务:settings/basics/speak/playSound 全由 app 组装层注入。
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Button } from '@/shared/ui/button'
import type { AudioCue, BasicsService, UserSettings } from '@/shared/services'
import { Choice } from '@/shared/ui/quiz/Choice'
import { ListenChoice } from '@/shared/ui/quiz/ListenChoice'
import type { Speak } from '@/shared/ui/quiz/speech'
import { COLDSTART_PROBES, buildDiagnosisRows, type DiagnosisAnswer } from './coldstart'
import { questionForUnit } from './teach-questions'
import type { TeachQuestion } from './teach-questions'

export type ColdStartWizardProps = {
  settings: UserSettings // 家长启用的轨才抽题
  basics: BasicsService
  speak: Speak
  playSound: (cue: AudioCue) => void
  onClose: () => void // 完成(已写基线)或中途退出(未写)都调
}

type Phase = 'intro' | 'question' | 'done'
type WizardItem = { track: 'pinyin' | 'english'; unitKey: string; q: TeachQuestion }

const ADVANCE_DELAY_MS = 650 // 答后短暂反馈停顿再自动下一题/收尾

export function ColdStartWizard({ settings, basics, speak, playSound, onClose }: ColdStartWizardProps) {
  // 题队列 = 各启轨探针 flatten;questionForUnit 返 null(无法公平出题)的探针跳过。
  const items = useMemo<WizardItem[]>(() => {
    const out: WizardItem[] = []
    const tracks: Array<'pinyin' | 'english'> = []
    if (settings.enableChinese) tracks.push('pinyin') // 汉语域(拼音+汉字捆绑,汉字无独立诊断轨)→ pinyin 探针
    if (settings.enableEnglish) tracks.push('english')
    for (const track of tracks) {
      for (const probe of COLDSTART_PROBES[track]) {
        const q = questionForUnit(probe)
        if (q) out.push({ track, unitKey: probe, q })
      }
    }
    return out
  }, [settings.enableChinese, settings.enableEnglish])

  const [phase, setPhase] = useState<Phase>('intro')
  const [qi, setQi] = useState(0)
  const [qState, setQState] = useState<'answer' | 'correct' | 'wrong'>('answer')
  const [pickedId, setPickedId] = useState<string | null>(null)
  const answersRef = useRef<DiagnosisAnswer[]>([])
  const timerRef = useRef<number | null>(null)

  // 卸载时清定时器,防滞后 setState 打在已卸载组件上(含跳过路径)。
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    },
    [],
  )

  // 家长把汉语/英语两域都关(面板防全关,此处为防御兜底)→ 无探针可抽 → 无诊断可言,直接收尾回群岛。
  useEffect(() => {
    if (items.length === 0) onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function later(fn: () => void, ms: number) {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      fn()
    }, ms)
  }

  function skip() {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    onClose()
  }

  function start() {
    playSound('tap')
    setPhase('question')
  }

  function handleAnswer(answerId: string) {
    const item = qi < items.length ? items[qi] : null
    if (!item || qState !== 'answer') return
    const correct = answerId === item.q.answerId
    if (correct) playSound('correct')
    else playSound('wrong')
    answersRef.current.push({ track: item.track, unitKey: item.unitKey, correct })
    setQState(correct ? 'correct' : 'wrong')
    setPickedId(answerId)
    const last = qi >= items.length - 1
    later(() => {
      if (last) {
        setPhase('done')
      } else {
        setQi(qi + 1)
        setQState('answer')
        setPickedId(null)
      }
    }, ADVANCE_DELAY_MS)
  }

  function finish() {
    const rows = buildDiagnosisRows(answersRef.current)
    if (rows.length > 0) void basics.saveAll(rows).catch(() => {})
    onClose()
  }

  const item: WizardItem | null = qi < items.length ? items[qi] : null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-surface/95 backdrop-blur-sm">
      <div className="mx-auto flex min-h-full max-w-xl flex-col px-4 py-5">
        <header className="flex items-center justify-end">
          {phase !== 'done' ? (
            <Button variant="ghost" size="sm" onClick={skip} aria-label="跳过小测">
              跳过
            </Button>
          ) : null}
        </header>

        <main className="flex flex-1 flex-col items-center justify-center gap-6 py-5">
          {phase === 'intro' ? renderIntro() : null}
          {phase === 'question' ? renderQuestion() : null}
          {phase === 'done' ? renderDone() : null}
        </main>
      </div>
    </div>
  )

  function renderIntro() {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', bounce: 0.35 }}
        className="flex w-full flex-col items-center gap-5 text-center"
      >
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.08, type: 'spring', bounce: 0.5 }}
          className="text-6xl leading-none"
          aria-hidden
        >
          🧙
        </motion.div>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-extrabold text-ink">魔法入门小测</h1>
          <p className="text-sm font-medium leading-relaxed text-ink-2">猜一猜、点一点,帮你找到最合适的学习起点</p>
        </div>
        <Button size="lg" onClick={start}>
          开始
        </Button>
      </motion.div>
    )
  }

  function renderQuestion() {
    if (!item) return null
    const q = item.q
    const shared = {
      skill: item.track,
      options: q.options,
      speak,
      disabled: qState !== 'answer',
      correctId: qState === 'correct' ? pickedId : null,
      wrongId: qState === 'wrong' ? pickedId : null,
      onAnswer: handleAnswer,
    }
    return (
      <div className="w-full">
        <div className="flex items-center justify-center gap-1.5 pb-3">
          {items.map((_, i) => (
            <span
              key={i}
              className={`h-2 rounded-full transition-all ${
                i < qi ? 'w-2 bg-emerald' : i === qi ? 'w-5 bg-accent' : 'w-2 bg-ink-3/25'
              }`}
            />
          ))}
        </div>
        {q.kind === 'choice' ? (
          <motion.div
            key={`q-${qi}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
            className="rounded-[1.75rem] border border-hairline bg-surface p-4 shadow-card sm:p-5"
          >
            <Choice prompt={q.prompt} promptSpeak={q.promptSpeak} promptEmoji={q.promptEmoji} {...shared} />
          </motion.div>
        ) : (
          <motion.div
            key={`q-${qi}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
            className="rounded-[1.75rem] border border-hairline bg-surface p-4 shadow-card sm:p-5"
          >
            <ListenChoice prompt={q.prompt} promptSpeak={q.promptSpeak} {...shared} />
          </motion.div>
        )}
      </div>
    )
  }

  function renderDone() {
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
            真棒!小测完成,开始你的魔法旅程吧!
          </motion.p>
        </div>
        <Button size="lg" onClick={finish}>
          开始游戏
        </Button>
      </div>
    )
  }
}
