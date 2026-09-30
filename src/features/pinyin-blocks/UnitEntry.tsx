import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { QuestionRun, type QuestionEnd, type QuestionItem } from './QuestionRun'
import type { Part } from './part'
import { UNITS } from './levels'
import { practiceQuestions } from './practice'
import {
  firstIncompletePart,
  nextPartOf,
  partClearedCount,
  partLevels,
  partTotal,
  practiceLevelsOf,
} from './progress-stats'
import { EMPTY_PART_SETTLEMENT, mergeSettlement, settleLevel, type PartSettlement } from './settle'

/** 连击圆点:5 颗封顶 —— 再多也读不出来,而 5 正好对上第一个撒花档。 */
const COMBO_DOTS = [0, 1, 2, 3, 4] as const

/**
 * 单元页入口。一个单元三部分(简单 / 困难 / 复习),部分内一道接一道自动走,
 * 部分末交账并进下一部分,最后一部分走完自动回地图(都不是按钮 —— 屏幕上没有「继续」)。
 *
 * **起点不由孩子选**:地图上每个单元只有一个入口,进来就从**第一个还没全通的部分**接着走
 * (`firstIncompletePart`);全通则整单元重玩。
 *
 * **落库与 onSettle 的关系**(spec §7):每道题一结束就落库(`endQuestion`),
 * 但 `onSettle`(弹层 + 撒花)是**一部分一笔** —— 部分末与中途退出共用同一条 `flush`。
 */
export function UnitEntry({
  unitIndex,
  onExitToMap,
  onSettle,
}: {
  unitIndex: number
  onExitToMap(): void
  /** 一部分走完交一次账(或退出到地图时补交)。 */
  onSettle(result: PartSettlement): void
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

  const unit = UNITS[unitIndex] ?? UNITS[0]!
  const stars = progressSnap.data.stars

  const [sessionCleared, setSessionCleared] = useState(0)
  /** 起点在挂载时**冻结一次** —— 走题过程中星级一直在变,现算会把进度往回拽。 */
  const [part, setPart] = useState<Part>(() => firstIncompletePart(unit, stars))
  /** 已落库、还没交出去的账。**必须是 ref** —— 它跨整部分活着。 */
  const pending = useRef<PartSettlement | null>(null)

  const comboLit = Math.min(comboSnap.combo, COMBO_DOTS.length)
  const speak = useCallback((text: string) => speech.speak(text, 'zh-CN'), [speech])

  /**
   * 本部分的题表。练习部分取练习题源(§8),其余取课程数据。
   *
   * `levelIndex` 一律是**在 `unit.levels` 里的下标** —— `QuestionRun` 拿它直接索引。
   * `unit.levels` 里简单题全在前、困难题全在后,所以 `partLevels` 的下标与它同序。
   */
  const items: readonly QuestionItem[] = useMemo(() => {
    if (part === 'review') {
      // 练习的题源 = 本单元「<3 星」的题,封顶 5 道(口径在 `practiceLevelsOf`)。
      return practiceQuestions(unit, unitIndex, practiceLevelsOf(stars, unit)).map((item) => ({
        kind: 'practice' as const,
        levelIndex: item.levelIndex,
        question: item.question,
      }))
    }
    return partLevels(unit, part).map((level) => ({
      kind: 'level' as const,
      levelIndex: unit.levels.indexOf(level),
    }))
  }, [part, unit, unitIndex, stars])

  /**
   * 本部分从哪道题接着走 = 该部分**第一道未通的题**(§7)。
   *
   * 这一项**不是 state**:它每次渲染都重算是**有意的** —— `QuestionRun` 把它冻在自己的挂载状态里,
   * 而 `QuestionRun` 按 `part` 换了 key,所以每部分只取一次初值。
   * 练习恒从 0 起(它的题从不落库,没有「通过」这一说)。
   *
   * `Math.max(0, …)` **不是多余的防御**:该部分全部已通时 `findIndex` 返回 `-1`,
   * 少了这层,`QuestionRun` 收到 `startIndex = -1` ⇒ `items[-1]` 是 `undefined` ⇒ `return null`
   * ⇒ 重玩全通单元白屏且不调 `onDone`(卡死)。
   */
  const startIndex = part === 'review'
    ? 0
    : Math.max(0, items.findIndex((item) => item.kind === 'level' && (stars[unit.levels[item.levelIndex]!.id] ?? 0) === 0))

  /** 落库。**每道题结束时调一次**。 */
  const endQuestion = useCallback(
    async (end: QuestionEnd) => {
      const result = await settleLevel(
        {
          levelId: end.levelId,
          stars: end.stars,
          currentStars: progressSnap.data.stars,
          totalStars: progressSnap.data.totalStars,
          settings: settingsSnap.data,
          sessionCleared,
          maxCombo: combo.getSnapshot().maxCombo,
        },
        { progress, settings, combo, lucky, achievements },
      )
      setSessionCleared(result.sessionCleared)
      pending.current = mergeSettlement(pending.current ?? EMPTY_PART_SETTLEMENT, result)
    },
    [progressSnap, settingsSnap, sessionCleared, progress, settings, combo, lucky, achievements],
  )

  /** 发 onSettle + 撒花。**只发一次** —— 发完就清账,部分末与中途退出共用这一条路。 */
  const flush = useCallback(() => {
    const result = pending.current
    if (!result) return
    pending.current = null
    onSettle(result)
    // 一次成功只撒一次花,而**一部分只撒一次**(spec §7.1)—— 逐题撒花会把「拼对了」这件小事淹掉。
    // 两个分支各自弹层都有自己的档(成就 `achievement` / 幸运 `lucky`),所以「让掉 `word`」
    // 在两个分支上是同一个道理:不让就是两记撒花叠在同一个通关上,把「发生了什么」糊掉。
    if (result.achievements.length === 0 && result.luckyReward <= 0) celebrate.play('word')
  }, [onSettle, celebrate])

  /** 本部分走完 → 交账 → 直接进下一部分(过场已取消),或回地图。 */
  const handlePartDone = useCallback(() => {
    flush()
    const next = nextPartOf(unit, part)
    if (next) setPart(next)
    else onExitToMap()
  }, [flush, unit, part, onExitToMap])

  /** 头部「回地图」。**先交账再走** —— 部分走到一半退出时,onSettle 还欠着。 */
  const handleExit = useCallback(() => {
    flush()
    onExitToMap()
  }, [flush, onExitToMap])

  // 连击的落点:每放一块上报一次。放对 'first'、放错 'wrong'。
  // 练习不上报(见 PinyinBlocksGame 的 penalized),免得练习变成刷连击的通道。
  const handleBlock = useCallback(
    (kind: AnswerKind) => {
      const tier = celebrationFor(combo.answer(kind))
      if (tier) celebrate.play(tier)
    },
    [combo, celebrate],
  )

  const cleared = part === 'review' ? 0 : partClearedCount(stars, unit, part)
  const total = part === 'review' ? 0 : partTotal(unit, part)

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
          {/* 练习不显示题数 —— 它的题由星级表当场决定,不该长得像一节课。
              题内进度由台阶条下面那排点表达(StageDots)。 */}
          {part === 'review' ? null : (
            <span data-part-progress className="text-sm font-bold text-ink-3 tabular-nums">
              {cleared}/{total}
            </span>
          )}
        </span>
      </div>
      {items.length > 0 ? (
        // 换部分即换 key ⇒ 部分内题号、盘面、发牌全部重来。
        <QuestionRun
          key={part}
          unit={unit}
          unitIndex={unitIndex}
          mode={part === 'hard' ? 'hard' : 'easy'}
          items={items}
          startIndex={startIndex}
          speak={speak}
          playSound={audio.play}
          onBlock={handleBlock}
          onQuestionEnd={part === 'review' ? undefined : endQuestion}
          onDone={handlePartDone}
        />
      ) : (
        // 空部分兜底:进去就是一块白屏(`partEnterable` 已在正常路径上挡掉)。
        // 没有过场可播了 —— 直接把决定权交回宿主。
        <EmptyPartFallback onDone={handlePartDone} />
      )}
    </div>
  )
}

/** 空部分的兜底:渲染期不许调 `onDone`,故借一个 effect 把它推出去。 */
function EmptyPartFallback({ onDone }: { onDone: () => void }) {
  const done = useRef(onDone)
  useEffect(() => {
    done.current()
  }, [])
  return null
}
