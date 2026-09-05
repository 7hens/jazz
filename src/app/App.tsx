import { useEffect, useRef, useState } from 'react'
import { MotionConfig } from 'motion/react'
import { Loader2 } from 'lucide-react'
import { AchievementPopup } from '@/features/achievements'
import { AuthEntry } from '@/features/auth'
import { HomeEntry } from '@/features/archipelago'
import { LingLing } from '@/features/lingling'
import { LessonEntry, type LessonCelebration } from '@/features/lesson'
import { LuckyBonus } from '@/features/lucky-bonus'
import { SettingsEntry } from '@/features/settings'
import { useService } from '@/shared/useService'
import { useServiceSnapshot } from '@/shared/useServiceSnapshot'
import type { Achievement } from '@/shared/services'
import { useAppState } from './useAppState'
import { useCompletedWords } from './useCompletedWords'

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
  const auth = useService('auth')
  const progress = useService('progress')
  const settingsService = useService('settings-state')
  const celebrateService = useService('celebrate')
  const authSnap = useServiceSnapshot(auth)

  const { phase, currentWordId, actions } = useAppState()
  const completedWords = useCompletedWords()
  const [celebration, setCelebration] = useState<Celebration | null>(null)
  const previousAuthStatus = useRef(authSnap.status)

  // 挂载探测登录态:auth 快照自身驱动 boot → login/home 的渲染分支。
  useEffect(() => {
    void auth.check()
  }, [auth])

  // 从非认证态进入已登录态:回主页并拉取进度与设置。
  // actions 每次渲染新建引用,不进依赖;服务实例稳定。
  useEffect(() => {
    const previous = previousAuthStatus.current
    previousAuthStatus.current = authSnap.status
    if (authSnap.status !== 'authenticated' || previous === 'authenticated') return
    actions.exitToHome()
    void progress.load()
    void settingsService.load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authSnap])

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

  let content
  if (authSnap.status === 'checking') {
    content = <BootScreen />
  } else if (authSnap.status !== 'authenticated') {
    content = <AuthEntry />
  } else if (phase === 'lesson' && currentWordId !== null) {
    content = (
      <LessonEntry
        wordId={currentWordId}
        onExit={actions.exitToHome}
        onNextWord={actions.nextWord}
        onCelebrate={handleLessonCelebration}
      />
    )
  } else if (phase === 'settings') {
    content = <SettingsEntry onClose={actions.closeSettings} />
  } else {
    // 认证后的 boot 与 home 阶段都派生为群岛主页。
    content = (
      <HomeEntry
        lingling={<LingLing completedWords={completedWords} />}
        onEnterLesson={actions.enterLesson}
        onOpenSettings={actions.openSettings}
        onLogout={() => { void auth.logout() }}
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
