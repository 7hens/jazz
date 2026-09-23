import { useEffect, useRef, useState } from 'react'
import { MotionConfig } from 'motion/react'
import { Loader2 } from 'lucide-react'
import { ACHIEVEMENTS, AchievementPopup } from '@/features/achievements'
import { AuthEntry } from '@/features/auth'
import { LuckyBonus } from '@/features/lucky-bonus'
import { LevelEntry, MapEntry, type LevelSettlement } from '@/features/pinyin-blocks'
import { AuthService, CelebrateService, PinyinProgressService, SettingsService } from '@/shared/services'
import { useService, useServiceSnapshot } from '@/shared/services/core'
import { ParentPanel } from './ParentPanel'
import { useAppState } from './useAppState'

type Celebration = Readonly<{ achievements: LevelSettlement['achievements']; luckyReward: number }>

function BootScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-ink-3" />
    </div>
  )
}

/** App 只做页面状态路由与跨 feature 组装;玩法、结算、奖励规则都在 feature 内。 */
export default function App() {
  const auth = useService(AuthService)
  const progress = useService(PinyinProgressService)
  const settingsService = useService(SettingsService)
  const celebrateService = useService(CelebrateService)
  // 快照必须先于任何读它的东西声明 —— previousAuthStatus 的初值就取自 authSnap
  const authSnap = useServiceSnapshot(auth)
  const progressSnap = useServiceSnapshot(progress)
  const settingsSnap = useServiceSnapshot(settingsService)
  const { phase, currentUnitIndex, actions } = useAppState()
  const [celebration, setCelebration] = useState<Celebration | null>(null)
  const previousAuthStatus = useRef(authSnap.status)

  // 挂载探测登录态
  useEffect(() => { void auth.check() }, [auth])

  // 登录成功后拉进度并进地图
  useEffect(() => {
    const previous = previousAuthStatus.current
    previousAuthStatus.current = authSnap.status
    if (authSnap.status !== 'authenticated' || previous === 'authenticated') return
    actions.exitToMap()
    void progress.load()
    // 设置也必须拉:**关卡页拿 settingsSnap.data 原样去结算**,
    // 没 load 过时那是个 defaultSettings() —— 存回去就把服务端的连续天数与
    // 已得成就一次抹平(见 task-12-addendum 裁决 A)。
    void settingsService.load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authSnap])

  function advanceCelebration() {
    setCelebration((current) => {
      if (!current) return current
      if (current.achievements.length > 1) return { ...current, achievements: current.achievements.slice(1) }
      if (current.luckyReward > 0) return { achievements: [], luckyReward: current.luckyReward }
      return null
    })
  }

  function handleSettle(result: LevelSettlement) {
    if (result.achievements.length === 0 && result.luckyReward <= 0) return
    setCelebration({ achievements: result.achievements, luckyReward: result.luckyReward })
  }

  let content
  if (authSnap.status === 'checking') content = <BootScreen />
  else if (authSnap.status !== 'authenticated') content = <AuthEntry />
  else if (phase === 'parent') content = <ParentPanel onClose={actions.closeParent} />
  else if (phase === 'level' && currentUnitIndex !== null) {
    // 设置没就绪就进不去 —— 宁可进不去,也不能拿默认值覆盖服务端。
    // 显式三元而非把条件并进上层 if:并进去会落到下面的地图分支(静默进地图)。
    content = settingsSnap.status === 'ready'
      ? <LevelEntry
          key={`unit-${currentUnitIndex}`}
          unitIndex={currentUnitIndex}
          onExitToMap={actions.exitToMap}
          onSettle={handleSettle}
        />
      : <BootScreen />
  // 地图要拿它渲染星星与星尘 —— 进度没到位就先停 boot,别闪一下空地图再跳
  } else if (progressSnap.status !== 'ready') {
    content = <BootScreen />
  } else {
    content = <MapEntry badges={ACHIEVEMENTS} onPick={actions.enterUnit} onOpenParent={actions.openParent} />
  }

  return (
    <MotionConfig reducedMotion="user">
      {content}
      {celebration ? (
        celebration.achievements.length > 0 ? (
          <AchievementPopup list={celebration.achievements} celebrate={celebrateService.play} onDone={advanceCelebration} />
        ) : (
          <LuckyBonus amount={celebration.luckyReward} onDone={() => setCelebration(null)} />
        )
      ) : null}
    </MotionConfig>
  )
}
