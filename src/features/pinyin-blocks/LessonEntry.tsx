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
import { scaffoldKindOf } from './scaffold'
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

  /**
   * 本节要走的题。`levelIndex` 一律是**在 `unit.levels` 里的下标** —— `QuestionRun` 拿它直接索引。
   *
   * **一道题展开成两项** `[脚手架遍, 全拼遍]`(spec §2.1)—— 但**只有真能产出脚手架遍的题才是两项**:
   * 题里没有可挖的那一类槽时(`scaffoldKindOf` 返 null)它自动退成单遍(spec §2.3 的兜底),
   * 不硬凑第二项,否则屏上会出现「预填了却没有槽可挖」的怪盘面(不变量 7)。
   *
   * **只判 `scaffoldKindOf`,不在这里造题面**:题面(含 rng)由 `QuestionRun` 在挂载时算并冻结,
   * 那边算出来的结果才真的上屏。这里造一份等于多一处「这个题有没有脚手架遍」的口径,
   * 两处迟早分叉。`scaffoldQuestion` 返 `null` 与 `scaffoldKindOf` 返 `null` 是同一个判据
   * (`scaffold.ts` 里第一件事就是拿 kind 短路),故这里判 kind 与判题面恒等价。
   *
   * **困难题一律不排脚手架遍**(`level.stage === 'hard'`,spec §7)。这不只是一条范围裁定,
   * 是硬冲突:困难部分的门禁是 `sameTypeOnly`(值可以错),而预填槽装的是**确定的正确块** ——
   * 两者摆在一起,那一部分考的「值可以错」当场作废。判据取 `level.stage` 而不是题号后缀:
   * `levels.ts` 写明「简单 / 困难的划分只有这一个字段说了算」。
   *
   * 顺带记下 `itemStartOf`:`startIndex` 得在 **items 的坐标系**里给,而一道题现在可能是两项,
   * 题号与项号不再一一对应(见下面那条注释)。
   */
  const { items, itemStartOf } = useMemo(() => {
    const list: QuestionItem[] = []
    const start = new Map<number, number>()
    if (!lesson || !unit) return { items: list, itemStartOf: start }
    for (const id of lesson.levelIds) {
      const levelIndex = unit.levels.findIndex((level) => level.id === id)
      if (levelIndex < 0) continue
      start.set(levelIndex, list.length)
      const level = unit.levels[levelIndex]!
      // 脚手架遍在前:裁定 A 就是「先脚手架,后全拼」。
      if (level.stage !== 'hard' && scaffoldKindOf(level, unitIndex) !== null) {
        list.push({ kind: 'scaffold', levelIndex })
      }
      list.push({ kind: 'level', levelIndex })
    }
    return { items: list, itemStartOf: start }
  }, [lesson, unit, unitIndex])

  /**
   * 从本节**第一道未通的题**接着走。本节全通 ⇒ 从第 0 题起(整节重玩)。
   *
   * **换算到 items 的下标**:一道题现在可能是两项,`levelIds` 的题号直接当项号用会落到
   * 别的题上去(前面的题各带两项时,题号 n 实际指的是另一道题)。走未通的那道题时落到它的
   * **头一项** —— 脚手架遍还没做就先做脚手架遍,这正是本行的口径。
   *
   * `Math.max(0, …)` **不是多余的防御**:全通时 `findIndex` 返回 -1,少了这层,
   * `QuestionRun` 收到越界的 `startIndex` ⇒ `items[startIndex]` 是 `undefined` ⇒ `return null`
   * ⇒ 重玩全通节点白屏且不调 `onDone`(卡死)。题号查不到(课表与 `unit.levels` 打架)时同理。
   */
  const startIndex = useMemo(() => {
    if (!lesson || !unit) return 0
    const at = lesson.levelIds.findIndex((id) => !cleared(stars, id))
    if (at < 0) return 0
    const levelIndex = unit.levels.findIndex((l) => l.id === lesson.levelIds[at])
    return Math.max(0, levelIndex < 0 ? 0 : (itemStartOf.get(levelIndex) ?? 0))
  }, [lesson, unit, stars, itemStartOf])

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
