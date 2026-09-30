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
import { UNITS, pathLessons, type Lesson } from './levels'
import { cleared } from './progress-stats'
import { QuestionRun, type QuestionEnd, type QuestionItem } from './QuestionRun'
import { EMPTY_PART_SETTLEMENT, mergeSettlement, settleLevel, type PartSettlement } from './settle'

/** 连击圆点:5 颗封顶 —— 再多也读不出来,而 5 正好对上第一个撒花档。 */
const COMBO_DOTS = [0, 1, 2, 3, 4] as const

/**
 * 一节课(一个路径节点)。节内一道接一道自动走,走完**回路径** —— 没有换节过场(spec §7)。
 *
 * **起点不由孩子选**:从本节**第一道还没通的题**接着走;本节全通时从第 0 题起(整节重玩)。
 * 地图上只有当前节点和它前面已通的节点进得来,这一层不做门禁 —— 门禁在 `LearningPath` 上。
 */
export function LessonEntry({
  lessonId,
  onExitToPath,
  onSettle,
}: {
  lessonId: string
  onExitToPath(): void
  /** 一节走完交一次账(或退出到路径时补交)。 */
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

  const stars = progressSnap.data.stars

  /**
   * 节点在**挂载时冻结一次**。`LessonEntry` 由宿主按 `lessonId` 换 key 重挂,
   * 故这个初值每节只取一次 —— 正是要的语义(走题过程中星级一直在变,现算会把进度往回拽)。
   */
  const [lesson] = useState<Lesson | null>(() => pathLessons().find((l) => l.id === lessonId) ?? null)
  const unitIndex = lesson ? UNITS.findIndex((u) => u.id === lesson.unitId) : -1
  const unit = unitIndex >= 0 ? UNITS[unitIndex]! : null

  const [sessionCleared, setSessionCleared] = useState(0)
  /** 已落库、还没交出去的账。**必须是 ref** —— 它跨整节活着。 */
  const pending = useRef<PartSettlement | null>(null)

  const comboLit = Math.min(comboSnap.combo, COMBO_DOTS.length)
  const speak = useCallback((text: string) => speech.speak(text, 'zh-CN'), [speech])

  /** 本节要走的题。`levelIndex` 一律是**在 `unit.levels` 里的下标** —— `QuestionRun` 拿它直接索引。 */
  const items: readonly QuestionItem[] = useMemo(() => {
    if (!lesson || !unit) return []
    return lesson.levelIds.flatMap((id) => {
      const levelIndex = unit.levels.findIndex((level) => level.id === id)
      return levelIndex < 0 ? [] : [{ kind: 'level' as const, levelIndex }]
    })
  }, [lesson, unit])

  /**
   * 从本节**第一道未通的题**接着走。本节全通 ⇒ 从第 0 题起(整节重玩)。
   *
   * `Math.max(0, …)` **不是多余的防御**:全通时 `findIndex` 返回 -1,少了这层,
   * `QuestionRun` 收到 `startIndex = -1` ⇒ `items[-1]` 是 `undefined` ⇒ `return null`
   * ⇒ 重玩全通节点白屏且不调 `onDone`(卡死)。
   */
  const startIndex = useMemo(() => {
    if (!lesson || !unit) return 0
    const at = lesson.levelIds.findIndex((id) => !cleared(stars, id))
    return at < 0 ? 0 : at
  }, [lesson, unit, stars])

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

  /** 发 onSettle + 撒花。**只发一次** —— 发完就清账,节末与中途退出共用这一条路。 */
  const flush = useCallback(() => {
    const result = pending.current
    if (!result) return
    pending.current = null
    onSettle(result)
    // 一次成功只撒一次花,而**一节只撒一次**(spec §7)—— 逐题撒花会把「拼对了」这件小事淹掉。
    if (result.achievements.length === 0 && result.luckyReward <= 0) celebrate.play('word')
  }, [onSettle, celebrate])

  /** 本节走完 → 交账 → 回路径。 */
  const handleDone = useCallback(() => {
    flush()
    onExitToPath()
  }, [flush, onExitToPath])

  /** 头部「回路径」。**先交账再走** —— 一节走到一半退出时,onSettle 还欠着。 */
  const handleExit = useCallback(() => {
    flush()
    onExitToPath()
  }, [flush, onExitToPath])

  // 连击的落点:每放一块上报一次。放对 'first'、放错 'wrong'。
  const handleBlock = useCallback(
    (kind: AnswerKind) => {
      const tier = celebrationFor(combo.answer(kind))
      if (tier) celebrate.play(tier)
    },
    [combo, celebrate],
  )

  // 课表外的 lessonId 或空题表:不进白屏,直接把决定权交回宿主。
  useEffect(() => {
    if (!lesson || !unit || items.length === 0) onExitToPath()
  }, [lesson, unit, items.length, onExitToPath])

  if (!lesson || !unit || items.length === 0) return null

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={handleExit}
          aria-label="回路径"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-surface/70 text-ink-2"
        >
          ←
        </button>
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
      </div>
      <QuestionRun
        unit={unit}
        unitIndex={unitIndex}
        mode={lesson.part === 'hard' ? 'hard' : 'easy'}
        items={items}
        startIndex={startIndex}
        speak={speak}
        playSound={audio.play}
        onBlock={handleBlock}
        onQuestionEnd={endQuestion}
        onDone={handleDone}
      />
    </div>
  )
}
