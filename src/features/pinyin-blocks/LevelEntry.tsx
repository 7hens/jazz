import { useCallback, useRef, useState } from 'react'
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
import { LevelRun } from './LevelRun'
import { UNITS } from './levels'
import { settleLevel, type LevelSettlement } from './settle'

/** 连击圆点:5 颗封顶 —— 再多也读不出来,而 5 正好对上第一个撒花档。 */
const COMBO_DOTS = [0, 1, 2, 3, 4] as const

/**
 * 关卡页入口。一关走完三段(简单 / 困难 / 复习)→ 结算 → **自动**推进到下一关;
 * 单元最后一关则自动回地图(两处都不是按钮 —— 屏幕上没有「继续」)。
 *
 * 本关是单元内第几关由 unitIndex 决定,恒从该单元**第一个未通关**的关口进 ——
 * 地图上点的是单元,不是具体某一关。
 *
 * **落库与 onSettle 被拆到复习段的两侧**(spec §3.9):
 * `settle`(写库)在困难段一结束就发生,`onSettle`(弹层 + 撒花)等复习段跑完再发 ——
 * 成就 / 幸运奖励的弹层压在复习台上就没法玩了。孩子复习到一半按「回地图」而走时,
 * 星已经安全了(`flush` 会把没发的 onSettle 补上)。
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

  /** 已落库、但还没发出去的结算结果。**必须是 ref** —— 它跨「复习段」这一整段活着。 */
  const pending = useRef<LevelSettlement | null>(null)

  /** 落库。在困难段结束时调用,早于复习段。 */
  const settle = useCallback(
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
      pending.current = result
    },
    [unit, levelIndex, progressSnap, settingsSnap, sessionCleared, progress, settings, combo, lucky, achievements],
  )

  /** 发 onSettle + 撒花。**只发一次** —— 发完就清账,复习段跑完与中途退出共用这一条路。 */
  const flush = useCallback(() => {
    const result = pending.current
    if (!result) return
    pending.current = null
    onSettle(result)
    // 一次成功只撒一次花。两个分支**各自弹层都有自己的档** —— 成就 `achievement`(200 粒)、
    // 幸运 `lucky`(60 粒),两处都在 `celebrate.ts` 的 `CONFIGS` 里(粒数照那张表核)。
    // 所以「让掉 `word`」在两边是**同一个道理**:不让就是「它自己那一记 + `word` 的 100 粒」
    // 叠在同一个通关上,把「发生了什么」糊掉 —— 这个算术对**两个分支都成立**,不再分岔。
    // 而「让掉 `word`」**不等于**「这一关一记都不出」:那一记由各自弹层的档出,只是不出 `word`。
    // 出处:spec `docs/superpowers/specs/2026-09-24-reward-flight-design.md`(幸运第五档)。
    if (result.achievements.length === 0 && result.luckyReward <= 0) celebrate.play('word')
  }, [onSettle, celebrate])

  /** 复习段跑完 → 交账 → 推进下一关 / 回地图。 */
  const handleDone = useCallback(() => {
    flush()
    if (levelIndex + 1 < unit.levels.length) setLevelIndex(levelIndex + 1)
    else onExitToMap()
  }, [flush, levelIndex, unit, onExitToMap])

  /** 头部「回地图」。**先交账再走** —— 复习段中途退出时,onSettle 还欠着。 */
  const handleExit = useCallback(() => {
    flush()
    onExitToMap()
  }, [flush, onExitToMap])

  // 连击的落点:每放一块上报一次。放对 'first'、放错 'wrong'。
  // answer() 的返回值此前被丢弃 —— 撒花档就挂在它上面(阈值判定在 celebrationFor)。
  // 复习段不上报(见 PinyinBlocksGame 的 penalized),免得复习变成刷连击的通道。
  const handleBlock = useCallback(
    (kind: AnswerKind) => {
      const tier = celebrationFor(combo.answer(kind))
      if (tier) celebrate.play(tier)
    },
    [combo, celebrate],
  )

  const level = unit.levels[levelIndex]

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={handleExit}
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
      {/* 换关即换 key ⇒ 相位、错题池、发牌全部重来 —— 不靠 effect 里 setState 补重置。 */}
      {level ? (
        <LevelRun
          key={level.id}
          unit={unit}
          unitIndex={unitIndex}
          levelIndex={levelIndex}
          speak={speak}
          playSound={audio.play}
          onBlock={handleBlock}
          settle={settle}
          onDone={handleDone}
        />
      ) : null}
    </div>
  )
}
