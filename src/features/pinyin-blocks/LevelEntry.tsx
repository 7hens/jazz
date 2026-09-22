import { useCallback, useState } from 'react'
import {
  AchievementService,
  AudioService,
  ComboService,
  LuckyBonusService,
  PinyinProgressService,
  SettingsService,
  SpeechService,
} from '@/shared/services'
import { useService, useServiceSnapshot } from '@/shared/services/core'
import { UNITS } from './levels'
import { PinyinBlocksGame } from './PinyinBlocksGame'
import { settleLevel, type LevelSettlement } from './settle'

/**
 * 关卡页入口。一关拼完 → 结算 → 继续下一关(单元最后一关的「继续」回地图)。
 *
 * 本关是单元内第几关由 unitIndex 决定,恒从该单元**第一个未通关**的关口进 ——
 * 地图上点的是单元,不是具体某一关。
 */
export function LevelEntry({
  unitIndex,
  onExitToMap,
  onSettle,
}: {
  unitIndex: number
  onExitToMap(): void
  onSettle(result: LevelSettlement): void
}) {
  const progress = useService(PinyinProgressService)
  const settings = useService(SettingsService)
  const combo = useService(ComboService)
  const lucky = useService(LuckyBonusService)
  const achievements = useService(AchievementService)
  const speech = useService(SpeechService)
  const audio = useService(AudioService)
  const progressSnap = useServiceSnapshot(progress)
  const settingsSnap = useServiceSnapshot(settings)

  const [sessionCleared, setSessionCleared] = useState(0)
  const unit = UNITS[unitIndex] ?? UNITS[0]!
  const firstUncleared = unit.levels.findIndex((level) => (progressSnap.data.stars[level.id] ?? 0) === 0)
  const [levelIndex, setLevelIndex] = useState(firstUncleared < 0 ? 0 : firstUncleared)

  const speak = useCallback((text: string) => speech.speak(text, 'zh-CN'), [speech])

  const handleSolved = useCallback(
    async (stars: number) => {
      const level = unit.levels[levelIndex]
      if (!level) return
      const result = await settleLevel(
        {
          levelId: level.id,
          stars,
          currentStars: progressSnap.data.stars,
          totalStars: progressSnap.data.totalStars,
          settings: settingsSnap.data,
          sessionCleared,
          // 连击存在 sessionStorage,是浏览器会话的账;结算把它带过来一次用掉
          maxCombo: combo.getSnapshot().maxCombo,
        },
        { progress, settings, combo, lucky, achievements },
      )
      // 用结算交回的**结果**,不是自己 +1 —— 重玩一关不该让首通数虚增
      setSessionCleared(result.sessionCleared)
      onSettle(result)
      if (levelIndex + 1 < unit.levels.length) setLevelIndex(levelIndex + 1)
      else onExitToMap()
    },
    [unit, levelIndex, progressSnap, settingsSnap, sessionCleared, progress, settings, combo, lucky, achievements, onSettle, onExitToMap],
  )

  // 游戏把 onSolved 收进 useCallback 的依赖链(PinyinBlocksGame 的 succeed → placeBlock → onUp
  // → 指针监听 effect),每次渲染换一个新引用就会重挂监听。所以这里必须是稳定引用。
  const handleSolvedProp = useCallback((stars: number) => { void handleSolved(stars) }, [handleSolved])

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={onExitToMap}
          aria-label="回地图"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-surface/70 text-ink-2"
        >
          ←
        </button>
        <span className="text-sm font-bold text-ink-3 tabular-nums">
          {levelIndex + 1}/{unit.levels.length}
        </span>
      </div>
      <PinyinBlocksGame
        key={unit.levels[levelIndex]?.id}
        unitIndex={unitIndex}
        levelIndex={levelIndex}
        speak={speak}
        playSound={audio.play}
        // 连击的落点:每放一块上报一次。放对 'first'、放错 'wrong'
        onBlock={(kind) => { combo.answer(kind) }}
        onSolved={handleSolvedProp}
      />
    </div>
  )
}
