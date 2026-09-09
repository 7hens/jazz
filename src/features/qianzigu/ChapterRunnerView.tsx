import { Fragment, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
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
import { Button } from '@/shared/ui/button'
import type { Chapter, ChapterLine, Scene, SceneKind, WordLayer } from './chapter'
import { DialoguePresenter } from './DialoguePresenter'
import { ScenePanel, StageFrame, StageSky } from './stage'
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
  // task 屏首幕台词放行记录(key=scene.id):intro 整屏演出一次,不落引擎。
  const [introPassed, setIntroPassed] = useState<Record<string, boolean>>({})
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

  /** 取本章词序的舞台词元素(dialogue/ending 整屏天空点灯用)。 */
  function skyWordsOf(): { id: number; emoji: string }[] {
    return chapter.wordIds
      .map((id) => services.vocabulary.wordById(id))
      .filter((w): w is WordUnit => w !== undefined)
      .map((w) => ({ id: w.id, emoji: w.emoji }))
  }

  /** 整屏对话演出(自带 StageFrame):dialogue/ending/pendingLines/各 scene intro/收尾 overlay 共用。 */
  function renderDialogue(lines: readonly ChapterLine[], opts: { onDone: () => void; doneLabel?: string; onExit?: () => void }) {
    return (
      <DialoguePresenter
        key={scene.id}
        lines={lines}
        atmosphere={scene.stage?.atmosphere ?? defaultAtmosphere(scene.kind)}
        restored={runState.restored}
        skyWords={skyWordsOf()}
        cast={scene.stage?.cast}
        speakRole={speakRole}
        onDone={opts.onDone}
        onExit={opts.onExit}
        doneLabel={opts.doneLabel}
      />
    )
  }

  /** 非对白屏统一舞台壳:天空氛围 + 词点亮 + 右上退出 + 浮层面板。 */
  function renderStage(body: ReactNode, kind: SceneKind) {
    return (
      <StageFrame>
        <StageSky
          atmosphere={scene.stage?.atmosphere ?? defaultAtmosphere(kind)}
          words={skyWordsOf()}
          restored={runState.restored}
        />
        <Button variant="ghost" size="icon" aria-label="返回地图" onClick={handleExit} className="absolute right-3 top-3 z-30">
          <X className="h-5 w-5" />
        </Button>
        {/* 浮层体按 scene.id 重挂:连续同 kind(task/social/boss…)场景不串内部 UI 态(题面/session)。 */}
        <ScenePanel key={scene.id}>{body}</ScenePanel>
      </StageFrame>
    )
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

  // BOSS 失败:保留已恢复进度,播勇气台词后回地图(整屏;doneLabel 即「回地图」)。
  if (runState.finished && !runState.bossWon && scene.kind === 'boss') {
    const lose = scene.lose.length > 0
      ? scene.lose
      : [{ role: 'lingling' as const, text: '已经很棒了!我们先回去休息,下次再来挑战!' }]
    return renderDialogue(lose, { doneLabel: '回地图', onDone: handleExit, onExit: handleExit })
  }

  // 收尾/叙事台词(pendingLines = task.onDone / boss.win)整屏优先于当前 scene —— 它们属上一幕叙事。
  // 外层 Fragment 固定 key:与下文的 scene 整屏对白区分根节点,清 overlay 后 DialoguePresenter 重挂(防台词 index 串场)。
  if (pendingLines) {
    return (
      <Fragment key="overlay">
        {renderDialogue(pendingLines, { onDone: () => setPendingLines(null) })}
      </Fragment>
    )
  }

  switch (scene.kind) {
    case 'dialogue':
    case 'ending':
      return renderDialogue(scene.lines, { onDone: () => step({ type: 'advance' }), onExit: handleExit })
    // task 首幕台词:intro 整屏舞台演出(本地放行记录,不入引擎);通过后才交 sceneBody 出答题卡。
    case 'task': {
      if (scene.intro.length > 0 && !introPassed[scene.id]) {
        return renderDialogue(scene.intro, {
          onDone: () => setIntroPassed((m) => ({ ...m, [scene.id]: true })),
          onExit: handleExit,
        })
      }
      return renderStage(sceneBody(scene), scene.kind)
    }
    // social/boss/break/settle:统一舞台壳;body 由 sceneBody 给裸内容(不加 frame)。
    default:
      return renderStage(sceneBody(scene), scene.kind)
  }
}
