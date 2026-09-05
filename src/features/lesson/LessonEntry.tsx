import { useEffect, useRef, useState } from 'react'
import type {
  AudioService,
  CelebrateService,
  ComboService,
  ProgressData,
  ProgressService,
  QuestionEngineService,
  SettingsService,
  SpeechService,
  ToastService,
} from '@/shared/services'
import type { SkillKey, UserSettings, WordUnit } from '@/shared/types'
import { useService } from '@/shared/useService'
import { useServiceSnapshot } from '@/shared/useServiceSnapshot'
import { fullComplete } from './lesson'
import { getRandomPraise } from './praise'
import { emptyProgress, settleWord, titleForStars } from './progress'
import {
  coordinateSettlement,
  type SettlementResult,
  type SettlementSession,
} from './settlement'
import { WordDone } from './WordDone'
import { WordLesson } from './WordLesson'

export type LessonEntryProps = {
  wordId: number
  onExit: () => void
  onNextWord: () => void
}

type LessonSessionProps = LessonEntryProps & {
  word: WordUnit
  words: readonly WordUnit[]
  progressData: ProgressData
  settingsData: UserSettings
  comboValue: number
  progress: ProgressService
  settings: SettingsService
  questionEngine: QuestionEngineService
  combo: ComboService
  audio: AudioService
  speech: SpeechService
  celebrate: CelebrateService
  toast: ToastService
  getSession: () => SettlementSession
  setSession: (session: SettlementSession) => void
}

function totalStars(progress: ProgressData): number {
  return Object.values(progress).reduce((sum, row) => sum + row.starsEarned, 0)
}

function ignoredFailure(command: () => Promise<void>): Promise<void> {
  try {
    return command().catch(() => undefined)
  } catch {
    return Promise.resolve()
  }
}

function LessonSession({
  wordId,
  onExit,
  onNextWord,
  word,
  words,
  progressData,
  settingsData,
  comboValue,
  progress,
  settings,
  questionEngine,
  combo,
  audio,
  speech,
  celebrate,
  toast,
  getSession,
  setSession,
}: LessonSessionProps) {
  const [done, setDone] = useState<SettlementResult | null>(null)
  const latestProgress = useRef(progressData)
  const gains = useRef({ stepReward: 0, wordBonus: 0 })
  const run = useRef({
    eligible: !fullComplete(progressData[wordId], settingsData),
    bonusPool: 0,
    perfect: true,
  })
  const pendingPersistence = useRef<Promise<unknown>[]>([])
  const settling = useRef(false)
  const cancelled = useRef(false)

  useEffect(() => {
    cancelled.current = false
    return () => {
      cancelled.current = true
    }
  }, [])

  useEffect(() => {
    latestProgress.current = progressData
  }, [progressData])

  function handleAnswer(kind: Parameters<ComboService['answer']>[0]) {
    if (kind !== 'first') run.current.perfect = false
    combo.answer(kind)
    if (kind === 'first' && run.current.eligible) {
      run.current.bonusPool += combo.getBonus()
    }
  }

  function handleStepPass(skill: SkillKey) {
    const current = latestProgress.current
    const previous = current[wordId] ?? emptyProgress(wordId)
    const result = settleWord(wordId, previous, [{ skill, passed: true }], settingsData)
    latestProgress.current = { ...current, [wordId]: result.next }
    gains.current = {
      stepReward: gains.current.stepReward + result.stepReward,
      wordBonus: Math.max(gains.current.wordBonus, result.wordBonus),
    }
    pendingPersistence.current.push(ignoredFailure(() => progress.saveStep(result.next)))
    celebrate.play('step')
    toast.show('success', getRandomPraise())
  }

  async function handleLessonComplete() {
    if (settling.current) return
    settling.current = true

    const result = await coordinateSettlement({
      word,
      words,
      progress: latestProgress.current,
      settings: settingsData,
      eligible: run.current.eligible,
      perfect: run.current.perfect,
      stepReward: gains.current.stepReward,
      wordBonus: gains.current.wordBonus,
      comboReward: run.current.bonusPool,
      maxCombo: combo.getSnapshot().maxCombo,
      session: getSession(),
      pendingPersistence: pendingPersistence.current,
    }, {
      progress,
      settings,
      // Task 10 supplies the reward-rule services and app-owned overlay queue.
      achievements: { scan: () => [] },
      lucky: { roll: () => 0 },
      overlays: { enqueue: () => undefined },
    })

    setSession(result.session)
    latestProgress.current = result.progress
    if (cancelled.current) return

    if (result.stepReward > 0 || result.wordBonus > 0) celebrate.play('word')
    setDone(result)
  }

  function leave(action: () => void) {
    cancelled.current = true
    action()
  }

  if (done) {
    const stars = totalStars(done.progress)
    return (
      <WordDone
        word={done.word}
        stepReward={done.stepReward}
        wordBonus={done.wordBonus}
        extraReward={done.extraReward}
        totalStars={stars}
        titleName={titleForStars(stars).name}
        nextId={done.word.id + 1}
        isLastWord={done.word.id >= words.length}
        getPraise={getRandomPraise}
        playSound={audio.play}
        onNext={() => leave(onNextWord)}
        onMap={() => leave(onExit)}
      />
    )
  }

  return (
    <WordLesson
      word={word}
      settings={settingsData}
      combo={comboValue}
      makeQuestions={questionEngine.makeStepQuestions}
      playSound={audio.play}
      speak={speech.speak}
      celebrate={celebrate.play}
      onAnswer={handleAnswer}
      onStepPass={handleStepPass}
      onLessonComplete={() => { void handleLessonComplete() }}
      onExit={() => leave(onExit)}
    />
  )
}

export function LessonEntry({ wordId, onExit, onNextWord }: LessonEntryProps) {
  const vocabulary = useService('vocabulary')
  const questionEngine = useService('question-engine')
  const progress = useService('progress')
  const settings = useService('settings-state')
  const combo = useService('combo')
  const audio = useService('audio')
  const speech = useService('speech')
  const celebrate = useService('celebrate')
  const toast = useService('toast')
  const progressSnapshot = useServiceSnapshot(progress)
  const settingsSnapshot = useServiceSnapshot(settings)
  const comboSnapshot = useServiceSnapshot(combo)
  const session = useRef<SettlementSession>({ firstCompleteToday: 0, perfectWords: 0 })
  const word = vocabulary.wordById(wordId)

  if (!word) return null

  return (
    <LessonSession
      key={wordId}
      wordId={wordId}
      onExit={onExit}
      onNextWord={onNextWord}
      word={word}
      words={vocabulary.getAllWords()}
      progressData={progressSnapshot.data}
      settingsData={settingsSnapshot.data}
      comboValue={comboSnapshot.combo}
      progress={progress}
      settings={settings}
      questionEngine={questionEngine}
      combo={combo}
      audio={audio}
      speech={speech}
      celebrate={celebrate}
      toast={toast}
      getSession={() => session.current}
      setSession={(next) => { session.current = next }}
    />
  )
}
