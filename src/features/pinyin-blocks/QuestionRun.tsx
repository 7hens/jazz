// 一串题的推进机:一道接一道自动走,走完把决定权交回宿主(回路径)。
// 复用 PinyinBlocksGame,只换入参 —— 不写第二套拼装台。
// **按题号换 key 重挂** —— 换题即清空,不在 effect 里 setState 补重置。

import { useCallback, useState } from 'react'
import type { AnswerKind } from '@/shared/services'
import type { Unit } from './levels'
import type { PracticeQuestion } from './practice'
import { PinyinBlocksGame } from './PinyinBlocksGame'
import { starsFor } from './rules'

/** 一串题里的一项。简单 / 困难节都是整题;练习也是一道**整题**(全槽挖空)。 */
export type QuestionItem =
  | Readonly<{ kind: 'level'; levelIndex: number }>
  | Readonly<{ kind: 'practice'; levelIndex: number; question: PracticeQuestion }>

/** 一道题结束的账目。宿主据此落库。 */
export type QuestionEnd = Readonly<{
  levelId: string
  /** 本题星级(0~3,`starsFor` 给的)。 */
  stars: number
}>

export type QuestionRunProps = {
  unit: Unit
  unitIndex: number
  /** 本题面身份:'easy' 走今天的玩法,'hard' 只比类型。练习由 `QuestionItem` 自己带。 */
  mode: 'easy' | 'hard'
  items: readonly QuestionItem[]
  /** 从这一项开始走(「接着上次」)。省略 = 从第 0 项。 */
  startIndex?: number
  speak: (text: string) => void
  playSound?: (cue: 'correct' | 'wrong' | 'victory' | 'tap') => void
  onBlock?: (kind: AnswerKind) => void
  /** 一道题结束。**不传 = 这一串不落库**(练习)。 */
  onQuestionEnd?: (end: QuestionEnd) => Promise<void>
  /** 本串走完 —— 宿主据此回路径。 */
  onDone: () => void
}

export function QuestionRun({
  unit,
  unitIndex,
  mode,
  items,
  startIndex = 0,
  speak,
  playSound,
  onBlock,
  onQuestionEnd,
  onDone,
}: QuestionRunProps) {
  // 起始题号在这里**冻结**:宿主每次渲染都会重算「本节第一道未通的题」,
  // 而走题过程中星级一直在变 —— 现算会把进度往回拽。本组件每次挂载只取一次初值。
  const [index, setIndex] = useState(startIndex)
  const item = items[index]

  const advance = useCallback(() => {
    if (index + 1 >= items.length) onDone()
    else setIndex(index + 1)
  }, [index, items.length, onDone])

  const onQuestionFinished = useCallback(
    async (missCount: number) => {
      const level = item ? unit.levels[item.levelIndex] : undefined
      if (item?.kind === 'level' && onQuestionEnd && level) {
        // **先 await 再推进**:孩子在这一题的庆祝动画里按「回路径」,那时这一题必须已经落库。
        await onQuestionEnd({ levelId: level.id, stars: starsFor(missCount) })
      }
      advance()
    },
    [item, unit, onQuestionEnd, advance],
  )

  if (!item) return null

  return (
    <PinyinBlocksGame
      // 换题即换 key ⇒ 盘面、提示全部重来。
      key={`${item.kind}-${index}`}
      unitIndex={unitIndex}
      levelIndex={item.levelIndex}
      stage={mode}
      practice={item.kind === 'practice' ? item.question : null}
      position={{ done: index + 1, total: items.length }}
      speak={speak}
      playSound={playSound}
      onBlock={onBlock}
      onQuestionEnd={(result) => { void onQuestionFinished(result.missCount) }}
    />
  )
}
