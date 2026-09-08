import { useEffect, useMemo, useRef, useState } from 'react'
import { MotionConfig } from 'motion/react'
import { Loader2 } from 'lucide-react'
import { AchievementPopup } from '@/features/achievements'
import { AuthEntry } from '@/features/auth'
import { HomeEntry } from '@/features/archipelago'
import { ColdStartWizard, FoundationStepGate } from '@/features/foundation'
import { LingLing } from '@/features/lingling'
import { LessonEntry, type LessonCelebration } from '@/features/lesson'
import { LuckyBonus } from '@/features/lucky-bonus'
import { QianziguEntry } from '@/features/qianzigu'
import { SettingsEntry } from '@/features/settings'
import {
  AudioService,
  AuthService,
  BasicsService,
  CelebrateService,
  ChapterService,
  FoundationService,
  ProgressService,
  SettingsService,
  SpeechService,
} from '@/shared/services'
import type { Achievement, SkillKey, WordUnit } from '@/shared/services'
import { useService, useServiceSnapshot } from '@/shared/services/core'
import { useAppState } from './useAppState'
import { useCompletedWords } from './useCompletedWords'
import { WorldShell } from './WorldShell'

// 覆盖层单槽:结算协调器入队的成就串行弹出,队列清空后才放幸运奖励效果。
type Celebration = Readonly<{
  achievements: readonly Achievement[]
  luckyReward: number
}>

function BootScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-ink-3" />
    </div>
  )
}

/** App 只做页面状态路由与跨 feature 组装;答题、结算、奖励规则都在 feature 内。 */
export default function App() {
  const auth = useService(AuthService)
  const progress = useService(ProgressService)
  const settingsService = useService(SettingsService)
  const chapterService = useService(ChapterService)
  const celebrateService = useService(CelebrateService)
  const foundation = useService(FoundationService)
  const basics = useService(BasicsService)
  const speech = useService(SpeechService)
  const audio = useService(AudioService)
  const authSnap = useServiceSnapshot(auth)
  const progressSnap = useServiceSnapshot(progress)
  const settingsSnap = useServiceSnapshot(settingsService)
  const basicsSnap = useServiceSnapshot(basics)

  const { phase, currentWordId, currentChapterId, actions } = useAppState()
  const completedWords = useCompletedWords()
  const [celebration, setCelebration] = useState<Celebration | null>(null)
  const [showDiagnosis, setShowDiagnosis] = useState(false)
  const diagnosisOffered = useRef(false)
  const previousAuthStatus = useRef(authSnap.status)

  // 挂载探测登录态:auth 快照自身驱动 boot → login/home 的渲染分支。
  useEffect(() => {
    void auth.check()
  }, [auth])

  // 从非认证态进入已登录态:回世界壳并拉取进度/设置/章节态。
  // actions 每次渲染新建引用,不进依赖;服务实例稳定。
  useEffect(() => {
    const previous = previousAuthStatus.current
    previousAuthStatus.current = authSnap.status
    if (authSnap.status !== 'authenticated' || previous === 'authenticated') return
    actions.exitToHome()
    void progress.load()
    void settingsService.load()
    void chapterService.load()
    void basics.load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authSnap])

  // 冷启动诊断触发:新档案(progress 与 basics 均无行)登录且三快照就绪后弹一次小测。
  // ref 防同一次会话重复置位;整 app 重开(仍零进度)会再触发(零进度再触发)。
  useEffect(() => {
    if (diagnosisOffered.current) return
    if (authSnap.status !== 'authenticated') return
    if (progressSnap.status !== 'ready' || settingsSnap.status !== 'ready' || basicsSnap.status !== 'ready') return
    const progressEmpty = Object.keys(progressSnap.data ?? {}).length === 0
    const basicsEmpty = Object.keys(basicsSnap.data ?? {}).length === 0
    if (!progressEmpty || !basicsEmpty) return
    diagnosisOffered.current = true
    setShowDiagnosis(true)
  }, [authSnap, progressSnap, settingsSnap, basicsSnap])

  function advanceCelebration() {
    setCelebration((current) => {
      if (!current) return current
      if (current.achievements.length > 1) {
        return { ...current, achievements: current.achievements.slice(1) }
      }
      if (current.luckyReward > 0) {
        return { achievements: [], luckyReward: current.luckyReward }
      }
      return null
    })
  }

  function handleLessonCelebration(info: LessonCelebration) {
    if (info.achievements.length === 0 && info.luckyReward <= 0) return
    setCelebration({ achievements: info.achievements, luckyReward: info.luckyReward })
  }

  // 词课步前教学门:data 为熟度快照(ready 前兜底空表 → judge 按「未评估→mandatory」走首词首步补教一次即收敛)。
  // render 的 key 使 gate 跨词/跨技能切换时重挂 TeachOverlay。
  const data = basicsSnap.data ?? {}
  const stepGate = useMemo(
    () => ({
      judge: (w: WordUnit, s: SkillKey) =>
        s !== 'hanzi' && foundation.needFor(foundation.unitsFor(w.id, s), data) === 'mandatory',
      render: (ctx: { word: WordUnit; skill: SkillKey; cont: () => void; exit?: () => void }) => (
        <FoundationStepGate
          key={`${ctx.word.id}-${ctx.skill}`}
          word={ctx.word}
          skill={ctx.skill}
          data={data}
          foundation={foundation}
          basics={basics}
          speak={speech.speak}
          playSound={audio.play}
          onContinue={ctx.cont}
          onExit={ctx.exit}
        />
      ),
    }),
    [foundation, basics, data, speech, audio],
  )

  let content
  if (authSnap.status === 'checking') {
    content = <BootScreen />
  } else if (authSnap.status !== 'authenticated') {
    content = <AuthEntry />
  } else if (showDiagnosis) {
    // 冷启动小测盖在双世界壳前;onClose 后回落下方 world 分支,0 星不进任何世界。
    content = (
      <ColdStartWizard
        settings={settingsSnap.data}
        basics={basics}
        speak={speech.speak}
        playSound={audio.play}
        onClose={() => setShowDiagnosis(false)}
      />
    )
  } else if (phase === 'lesson' && currentWordId !== null) {
    content = (
      <LessonEntry
        wordId={currentWordId}
        onExit={actions.exitToHome}
        onNextWord={actions.nextWord}
        onCelebrate={handleLessonCelebration}
        stepGate={stepGate}
      />
    )
  } else if (phase === 'settings') {
    content = <SettingsEntry onClose={actions.closeSettings} />
  } else if (phase === 'qianzigu-map') {
    content = <QianziguEntry onBack={actions.enterWorld} onEnterChapter={actions.enterChapter} />
  } else if (phase === 'chapter') {
    // 章节运行器在 Task3/4 落地;此处分支先以轻量占位保持相位可路由。
    content = (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center text-ink">
        <p className="text-6xl" aria-hidden>🌅</p>
        <p className="mt-3 text-lg font-extrabold">千字谷 · 第{currentChapterId ?? 1}章</p>
        <p className="mt-1 text-sm text-ink-2">章节正在苏醒中…</p>
        <button
          type="button"
          onClick={actions.closeChapter}
          className="mt-6 rounded-full bg-accent px-6 py-2.5 font-bold text-white shadow-card transition-transform active:scale-95"
        >
          回地图
        </button>
      </div>
    )
  } else if (phase === 'letter-forest') {
    content = (
      <HomeEntry
        lingling={<LingLing completedWords={completedWords} />}
        onEnterLesson={actions.enterLesson}
        onOpenSettings={actions.openSettings}
        onLogout={() => { void auth.logout() }}
      />
    )
  } else {
    // 认证后的 boot 与 world 相位都派生为双世界壳首页。
    content = (
      <WorldShell
        onQianzigu={actions.enterQianziguMap}
        onLetterForest={actions.enterLetterForest}
      />
    )
  }

  return (
    <MotionConfig reducedMotion="user">
      {content}
      {celebration ? (
        celebration.achievements.length > 0 ? (
          <AchievementPopup
            list={celebration.achievements}
            celebrate={celebrateService.play}
            onDone={advanceCelebration}
          />
        ) : (
          <LuckyBonus amount={celebration.luckyReward} onDone={() => setCelebration(null)} />
        )
      ) : null}
    </MotionConfig>
  )
}
