import { useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, X } from 'lucide-react'
import type {
  AudioService,
  CelebrateService,
  ChapterProgressRow,
  ChapterService,
  ProgressRulesService,
  ProgressService,
  ProgressData,
  QuestionEngineService,
  SettingsService,
  SpeechService,
  VocabularyService,
  WordUnit,
} from '@/shared/services'
import { cn } from '@/shared/ui/utils'
import { Button } from '@/shared/ui/button'
import type { Chapter, ChapterLine, Scene, WordLayer } from './chapter'
import { DialoguePresenter } from './DialoguePresenter'
import { defaultAtmosphere } from './stage-meta'
import { createChapterRunner, type Runner, type RunnerAction, type RunnerState } from './engine'
import {
  layerToSkill,
  parseRestoreState,
  restoredKey,
  serializeRestoreState,
  settleChapterStep,
} from './word-progress'
import {
  BossScene,
  BreakScene,
  LineScene,
  ROLE_META,
  SettleCard,
  SocialScene,
  TaskScene,
  type SpeakFn,
  type SpeakRoleFn,
} from './scene-ui'

export type ChapterRunnerServices = {
  progress: ProgressService
  chapter: ChapterService
  vocabulary: VocabularyService
  questionEngine: QuestionEngineService
  settings: SettingsService
  rules: ProgressRulesService
  speech: SpeechService
  audio: AudioService
  celebrate: CelebrateService
}

export type ChapterRunnerViewProps = {
  chapter: Chapter
  /** 断点续玩:进入时的服务端章节行(row 为 null 或起始行 = 从 scene 0 开始)。 */
  initialRow: ChapterProgressRow | null
  onExit(): void
  onSettled(): void
  services: ChapterRunnerServices
}

function totalStars(data: ProgressData): number {
  return Object.values(data).reduce((sum, row) => sum + row.starsEarned, 0)
}

/**
 * 从存的行重建引擎状态:start() 后对「已 restored 的 task」与途中的 dialogue/break/social/boss
 * 快进,停在 resumeSceneId 场景;无行/起始行则原样从 scene 0 开始。
 */
function resumeFromRow(engine: Runner, chapter: Chapter, row: ChapterProgressRow | null): RunnerState {
  let state = engine.start()
  if (!row || row.chapterId !== chapter.id) return state
  const restored = parseRestoreState(row.restoreState)
  if (!row.resumeSceneId) return state
  const target = chapter.scenes.findIndex((scene) => scene.id === row.resumeSceneId)
  if (target < 0) return state
  const restoredSet = new Set(restored.map((entry) => restoredKey(entry.wordId, entry.layer)))
  let guard = 0
  while (state.sceneIndex < target && guard++ < chapter.scenes.length * 6) {
    const scene = chapter.scenes[state.sceneIndex]
    switch (scene.kind) {
      case 'task': {
        const key = restoredKey(scene.task.wordId, scene.task.layer)
        if (!restoredSet.has(key)) return state
        for (let i = 0; i < scene.task.minCorrect; i++) {
          state = engine.next({ type: 'task-correct', wordId: scene.task.wordId, layer: scene.task.layer }).state
        }
        break
      }
      case 'social':
        state = engine.next({ type: 'social-choose', optionId: scene.goodOptionId }).state
        break
      case 'boss':
        for (let i = 0; i < state.bossNeeded; i++) state = engine.next({ type: 'boss-correct' }).state
        break
      case 'settle':
        return state
      default:
        state = engine.next({ type: 'advance' }).state
    }
  }
  return state
}

function SkyStrip({ chapter, restored, wordById }: {
  chapter: Chapter
  restored: RunnerState['restored']
  wordById(id: number): WordUnit | undefined
}) {
  const words = chapter.wordIds
    .map((id) => wordById(id))
    .filter((w): w is WordUnit => w !== undefined)
  const lit = new Map<number, number>()
  for (const entry of restored) lit.set(entry.wordId, (lit.get(entry.wordId) ?? 0) + 1)
  return (
    <div className="flex items-center justify-center gap-3 py-3" aria-hidden>
      <span className="text-2xl drop-shadow-sm">{chapter.emoji}</span>
      {words.map((word) => {
        const count = lit.get(word.id) ?? 0
        return (
          <span
            key={word.id}
            className={cn(
              'text-2xl transition-all duration-700',
              count >= 2 ? 'opacity-100' : count === 1 ? 'opacity-70 grayscale-[.55]' : 'opacity-45 grayscale',
            )}
          >
            {word.emoji}
          </span>
        )
      })}
    </div>
  )
}

export function ChapterRunnerView({ chapter, initialRow, onExit, onSettled, services }: ChapterRunnerViewProps) {
  const engineRef = useRef<Runner | null>(null)
  // 引擎 next() 返回值即当前态(engine.state 是创建期快照,不可作实时读);这里以 ref 镜像当前态。
  const currentStateRef = useRef<RunnerState | null>(null)
  const [runState, setRunState] = useState<RunnerState>(() => {
    const engine = createChapterRunner(chapter)
    engineRef.current = engine
    const resumed = resumeFromRow(engine, chapter, initialRow)
    currentStateRef.current = resumed
    return resumed
  })
  if (currentStateRef.current === null) currentStateRef.current = runState
  const [pendingLines, setPendingLines] = useState<readonly ChapterLine[] | null>(null)
  const localProgressRef = useRef<ProgressData>({ ...services.progress.getSnapshot().data })
  const startTotalRef = useRef<number>(totalStars(localProgressRef.current))
  const settingsRef = useRef(services.settings.getSnapshot().data)

  const scene = chapter.scenes[Math.min(runState.sceneIndex, chapter.scenes.length - 1)]

  function restoreSkill(wordId: number, layer: WordLayer) {
    const prev = localProgressRef.current[wordId]
    const { next, stepReward, wordBonus } = settleChapterStep(
      wordId,
      prev,
      layer,
      services.rules,
      settingsRef.current,
    )
    if (stepReward <= 0 && wordBonus <= 0) return // 幂等:仅新完成才写(不重复发星尘)
    localProgressRef.current = { ...localProgressRef.current, [wordId]: next }
    void services.progress.saveStep(next)
  }

  function persist(next: RunnerState) {
    const current = chapter.scenes[Math.min(next.sceneIndex, chapter.scenes.length - 1)]
    // 结算(章节完成)是终点:清空章节行 → 重进从场景 0 重玩,完成度由 per-word 进度承载。
    if (current.kind === 'settle') {
      void services.chapter.clear()
      return
    }
    void services.chapter.save({
      chapterId: chapter.id,
      resumeSceneId: current.id,
      restoreState: serializeRestoreState(next.restored),
      updatedAt: new Date().toISOString(),
    })
  }

  function step(action: RunnerAction): RunnerState {
    const engine = engineRef.current!
    const before = currentStateRef.current!
    const beforeScene = chapter.scenes[Math.min(before.sceneIndex, chapter.scenes.length - 1)]
    const { state: next, effects } = engine.next(action)
    currentStateRef.current = next
    setRunState(next)
    for (const effect of effects) {
      if (effect.type === 'restore') {
        if (beforeScene.kind === 'task' && beforeScene.onDone.length > 0) setPendingLines(beforeScene.onDone)
        restoreSkill(effect.wordId, effect.layer)
      }
    }
    if (action.type === 'boss-correct' && next.bossWon && beforeScene.kind === 'boss') {
      setPendingLines(beforeScene.win)
    }
    if (next.finished || next.sceneIndex !== before.sceneIndex) persist(next)
    return next
  }

  function handleTaskCorrect(wordId: number, layer: WordLayer): boolean {
    const before = currentStateRef.current!.sceneIndex
    const next = step({ type: 'task-correct', wordId, layer })
    return next.sceneIndex !== before
  }

  function handleBossCorrect(): boolean {
    return step({ type: 'boss-correct' }).bossWon
  }

  function handleBossWrong(): boolean {
    const next = step({ type: 'boss-wrong' })
    return next.finished && !next.bossWon
  }

  function handleExit() {
    persist(currentStateRef.current!)
    onExit()
  }

  function handleSettled() {
    onSettled()
  }

  const speakRole: SpeakRoleFn = (text, role) => services.speech.speakRole(text, role)
  const speak: SpeakFn = (text, lang) => services.speech.speak(text, lang)
  const playSound = (cue: Parameters<AudioService['play']>[0]) => services.audio.play(cue)

  /** 取本章词序的舞台词元素(dialogue/ending 整屏天空点灯用)。
   *  过渡期与旧 SkyStrip 的词点亮并存、值略异(SkyStrip 于 Plan 2 删除后自消),勿强改对齐。 */
  function skyWordsOf(): { id: number; emoji: string }[] {
    return chapter.wordIds
      .map((id) => services.vocabulary.wordById(id))
      .filter((w): w is WordUnit => w !== undefined)
      .map((w) => ({ id: w.id, emoji: w.emoji }))
  }

  function sceneBody(current: Scene) {
    switch (current.kind) {
      case 'break':
        return <BreakScene onContinue={() => step({ type: 'advance' })} onExit={handleExit} />
      case 'task': {
        const word = services.vocabulary.wordById(current.task.wordId)
        if (!word) return null
        const skill = layerToSkill(current.task.layer)
        return (
          <TaskScene
            scene={current}
            word={word}
            skill={skill}
            makeQuestions={() => services.questionEngine.makeStepQuestions(word, skill, Math.random)}
            speak={speak}
            speakRole={speakRole}
            playSound={playSound}
            onCorrect={handleTaskCorrect}
          />
        )
      }
      case 'social':
        return (
          <SocialScene
            lines={current.lines}
            options={current.options}
            goodOptionId={current.goodOptionId}
            loop={current.loop}
            onGood={current.onGood}
            speakRole={speakRole}
            playSound={playSound}
            onChooseGood={() => step({ type: 'social-choose', optionId: current.goodOptionId })}
          />
        )
      case 'boss': {
        const pool = chapter.wordIds
          .map((id) => services.vocabulary.wordById(id))
          .filter((w): w is WordUnit => w !== undefined)
        return (
          <BossScene
            intro={current.intro}
            wordPool={pool}
            makeQuestion={(word, skill) => services.questionEngine.makeStepQuestions(word, skill, Math.random)[0]}
            speak={speak}
            speakRole={speakRole}
            playSound={playSound}
            onBossCorrect={handleBossCorrect}
            onBossWrong={handleBossWrong}
          />
        )
      }
      case 'settle': {
        const words = chapter.wordIds
          .map((id) => services.vocabulary.wordById(id))
          .filter((w): w is WordUnit => w !== undefined)
        const total = totalStars(localProgressRef.current)
        return (
          <SettleCard
            emoji={chapter.emoji}
            heading={`第${chapter.id}章完成!`}
            subtitle={`${chapter.title} · ${chapter.subtitle}`}
            words={words}
            gainedStars={Math.max(0, total - startTotalRef.current)}
            totalStars={total}
            summary={current.summary}
            speakRole={speakRole}
            onBack={handleSettled}
          />
        )
      }
      default:
        return null
    }
  }

  // BOSS 失败:保留已恢复进度,播勇气台词后回地图。
  if (runState.finished && !runState.bossWon && scene.kind === 'boss') {
    const lose = scene.lose.length > 0 ? scene.lose : [{ role: 'lingling' as const, text: '已经很棒了!我们先回去休息,下次再来挑战!' }]
    return (
      <Shell chapter={chapter} onExit={handleExit}>
        <div className="rounded-[1.75rem] border border-hairline bg-surface p-5 text-center shadow-card">
          <p className="text-4xl" aria-hidden>🖤</p>
          <p className="mt-2 text-lg font-extrabold text-ink">静默太强了…先回去休息吧!</p>
          <div className="mt-4 space-y-2.5 text-left">
            {lose.map((line, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-2xl" aria-hidden>{ROLE_META[line.role].emoji}</span>
                <p className="text-sm font-semibold leading-relaxed text-ink-2">{line.text}</p>
              </div>
            ))}
          </div>
          <Button size="lg" className="mt-5 w-full" onClick={handleExit}>
            回地图
          </Button>
        </div>
      </Shell>
    )
  }

  const isStageScene = scene.kind === 'dialogue' || scene.kind === 'ending'
  // dialogue/ending 整屏舞台化(过渡态;其余仍包旧 Shell,Plan 2 再统一 StageFrame)。
  // pendingLines(任务收尾/BOSS win 台词)优先于舞台屏——它们属上一场景叙事,仍在 Shell 内承载。
  if (isStageScene && !pendingLines) {
    return (
      <DialoguePresenter
        key={scene.id}
        lines={scene.lines}
        atmosphere={scene.stage?.atmosphere ?? defaultAtmosphere(scene.kind)}
        restored={runState.restored}
        skyWords={skyWordsOf()}
        cast={scene.stage?.cast}
        speakRole={speakRole}
        onDone={() => step({ type: 'advance' })}
        onExit={handleExit}
      />
    )
  }

  const content = pendingLines
    ? <LineScene lines={pendingLines} speakRole={speakRole} onDone={() => setPendingLines(null)} />
    : sceneBody(scene)

  return (
    <Shell chapter={chapter} onExit={handleExit}>
      <SkyStrip chapter={chapter} restored={runState.restored} wordById={(id) => services.vocabulary.wordById(id)} />
      {/* 按 scene.id 键控重挂:连续同 kind(task/social/boss)不串内部 UI 态 */}
      <div key={scene.id}>{content}</div>
    </Shell>
  )
}

function Shell({ chapter, onExit, children }: { chapter: Chapter; onExit(): void; children: ReactNode }) {
  return (
    <div className="min-h-screen text-ink">
      <header className="glass-strong sticky top-0 z-30 border-b border-hairline">
        <div className="mx-auto flex h-14 max-w-xl items-center gap-2 px-4">
          <Button variant="ghost" size="icon" onClick={onExit} aria-label="返回地图">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="truncate text-[15px] font-bold">
            {chapter.emoji} 千字谷 · 第{chapter.id}章 {chapter.title}
          </span>
          <button type="button" onClick={onExit} aria-label="退出章节" className="ml-auto text-ink-3 hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 pb-24 pt-2">{children}</main>
    </div>
  )
}
