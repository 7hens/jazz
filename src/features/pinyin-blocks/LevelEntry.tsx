import { useCallback, useState } from 'react'
import {
  AchievementService,
  AudioService,
  CelebrateService,
  celebrationFor,
  ComboService,
  LuckyBonusService,
  PinyinProgressService,
  SettingsService,
  SpeechService,
  type AnswerKind,
} from '@/shared/services'
import { useService, useServiceSnapshot } from '@/shared/services/core'
import { cn } from '@/shared/ui/utils'
import { UNITS } from './levels'
import { PinyinBlocksGame } from './PinyinBlocksGame'
import { settleLevel, type LevelSettlement } from './settle'

/** 连击圆点:5 颗封顶 —— 再多也读不出来,而 5 正好对上第一个撒花档。 */
const COMBO_DOTS = [0, 1, 2, 3, 4] as const

/**
 * 关卡页入口。一关拼完 → 结算 → **自动**推进到下一关;单元最后一关则自动回地图
 * (两处都不是按钮 —— 屏幕上没有「继续」,后面那个 setLevelIndex / onExitToMap 就是全部)。
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
  const celebrate = useService(CelebrateService)
  const progressSnap = useServiceSnapshot(progress)
  const settingsSnap = useServiceSnapshot(settings)
  const comboSnap = useServiceSnapshot(combo)

  const [sessionCleared, setSessionCleared] = useState(0)
  const unit = UNITS[unitIndex] ?? UNITS[0]!
  const firstUncleared = unit.levels.findIndex((level) => (progressSnap.data.stars[level.id] ?? 0) === 0)
  const [levelIndex, setLevelIndex] = useState(firstUncleared < 0 ? 0 : firstUncleared)

  const comboLit = Math.min(comboSnap.combo, COMBO_DOTS.length)

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
      // 一次成功只撒一次花:成就弹层有自己的档(achievement),由它来撒;
      // 幸运弹层**没有自己的档**,故被它让掉的这一关当场不撒 —— 让掉优于
      // 两处同帧叠加 = 300 粒、把「发生了什么」糊掉(设计 §3.4)。
      if (result.achievements.length === 0 && result.luckyReward <= 0) celebrate.play('word')
      if (levelIndex + 1 < unit.levels.length) setLevelIndex(levelIndex + 1)
      else onExitToMap()
    },
    [unit, levelIndex, progressSnap, settingsSnap, sessionCleared, progress, settings, combo, lucky, achievements, celebrate, onSettle, onExitToMap],
  )

  // 外层传给游戏的回调保持引用稳定,别每次渲染新建(与下面 handleBlock 同形)。
  const handleSolvedProp = useCallback((stars: number) => { void handleSolved(stars) }, [handleSolved])

  // 连击的落点:每放一块上报一次。放对 'first'、放错 'wrong'。
  // answer() 的返回值此前被丢弃 —— 撒花档就挂在它上面(阈值判定在 celebrationFor)。
  const handleBlock = useCallback(
    (kind: AnswerKind) => {
      const tier = celebrationFor(combo.answer(kind))
      if (tier) celebrate.play(tier)
    },
    [combo, celebrate],
  )

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
        <span className="flex items-center gap-2">
          {/* 连击圆点:会话连击(见 spec §3.3 的裁定),封顶 5 颗。
              靠「亮/暗」两态表达 —— 减动效用户也必须看得见。 */}
          <span
            data-combo-dots
            data-combo-lit={comboLit}
            aria-label={`连击 ${comboLit}`}
            className="flex items-center gap-1"
          >
            {COMBO_DOTS.map((index) => (
              <span
                key={index}
                aria-hidden
                className={cn('h-2.5 w-2.5 rounded-full', index < comboLit ? 'bg-accent' : 'bg-ink-2')}
              />
            ))}
          </span>
          <span className="text-sm font-bold text-ink-3 tabular-nums">
            {levelIndex + 1}/{unit.levels.length}
          </span>
        </span>
      </div>
      <PinyinBlocksGame
        key={unit.levels[levelIndex]?.id}
        unitIndex={unitIndex}
        levelIndex={levelIndex}
        speak={speak}
        playSound={audio.play}
        // 连击的落点:每放一块上报一次。放对 'first'、放错 'wrong'
        onBlock={handleBlock}
        onSolved={handleSolvedProp}
      />
    </div>
  )
}
