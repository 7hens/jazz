import { useCallback, useEffect, useMemo } from 'react'
import { AudioService, PinyinProgressService, SpeechService } from '@/shared/services'
import { useService, useServiceSnapshot } from '@/shared/services/core'
import { UNITS } from './levels'
import { practiceLevelsOf } from './progress-stats'
import { practiceQuestions } from './practice'
import { QuestionRun, type QuestionItem } from './QuestionRun'

/**
 * 练习入口(原「复习部分」)。**不是课,是回炉**(spec §8):
 * 题源 = 本单元「<3 星」的题(封顶 5),每题一道整题;不落库、不记 miss、不上报连击
 * —— 练习做得再差也不掉星。
 *
 * 不参与逐节线性:该单元的节点解锁了它就能进(门禁在 `LearningPath`)。
 * 无题可练时地图上它不亮;万一还是进来了,这里立刻交回宿主,不画一块白屏。
 */
export function PracticeEntry({ unitId, onExitToPath }: { unitId: string; onExitToPath(): void }) {
  const progress = useService(PinyinProgressService)
  const speech = useService(SpeechService)
  const audio = useService(AudioService)
  const progressSnap = useServiceSnapshot(progress)

  const unitIndex = UNITS.findIndex((u) => u.id === unitId)
  const unit = unitIndex >= 0 ? UNITS[unitIndex]! : null
  const stars = progressSnap.data.stars

  const items: readonly QuestionItem[] = useMemo(() => {
    if (!unit) return []
    return practiceQuestions(unit, unitIndex, practiceLevelsOf(stars, unit)).map((item) => ({
      kind: 'practice' as const,
      levelIndex: item.levelIndex,
      question: item.question,
    }))
  }, [unit, unitIndex, stars])

  const speak = useCallback((text: string) => speech.speak(text, 'zh-CN'), [speech])

  // 课表外的 unitId 或空题表:立刻交回宿主(渲染期不许调 props,故借 effect)。
  useEffect(() => {
    if (!unit || items.length === 0) onExitToPath()
  }, [unit, items.length, onExitToPath])

  if (!unit || items.length === 0) return null

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={onExitToPath}
          aria-label="回路径"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-surface/70 text-ink-2"
        >
          ←
        </button>
      </div>
      <QuestionRun
        unit={unit}
        unitIndex={unitIndex}
        mode="easy"
        items={items}
        speak={speak}
        playSound={audio.play}
        // 不传 onQuestionEnd 与 onBlock:不落库、不记 miss、不报连击(spec §8)。
        onDone={onExitToPath}
      />
    </div>
  )
}
