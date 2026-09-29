// 一部分的推进机:部分内一道接一道自动走,部分末把决定权交回宿主(进下一部分 / 回地图)。
// 复用 PinyinBlocksGame,只换入参 —— 不写第二套拼装台。
// **按 (部分, 题号) 换 key 重挂** —— 换题即清空,不在 effect 里 setState 补重置。

import { useCallback, useState } from 'react'
import type { AnswerKind } from '@/shared/services'
import type { Block } from './blocks'
import type { Part } from './part'
import type { Unit } from './levels'
import type { ReviewQuestion } from './mistakes'
import { PinyinBlocksGame, type PartResult } from './PinyinBlocksGame'
import { starsFor } from './rules'

/** 本部分要走的题。简单 / 困难部分两种都是一道整题;复习部分是一道挖空小题。 */
export type PartItem =
  | Readonly<{ kind: 'level'; levelIndex: number }>
  | Readonly<{ kind: 'review'; levelIndex: number; question: ReviewQuestion }>

/** 一道题结束的账目。宿主据此落库(简单 / 困难部分)与把错块记进池。 */
export type QuestionEnd = Readonly<{
  levelId: string
  /** 本题星级(0~3,`starsFor` 给的)。 */
  stars: number
  /** 本题新错的块。 */
  wrongBlocks: readonly Block[]
  /** 错块是否按**精确身份**记账 —— 困难部分的门禁只比类型,介母块与韵母块是两个真身份。 */
  exact: boolean
}>

export type PartRunProps = {
  unit: Unit
  unitIndex: number
  part: Part
  items: readonly PartItem[]
  /** 从这一项开始走(部分内「接着上次」)。省略 = 从第 0 项。 */
  startIndex?: number
  speak: (text: string) => void
  playSound?: (cue: 'correct' | 'wrong' | 'victory' | 'tap') => void
  onBlock?: (kind: AnswerKind) => void
  /** 一道题结束。**不传 = 这一部分不落库**(复习部分)。 */
  onQuestionEnd?: (end: QuestionEnd) => Promise<void>
  /** 本部分走完 —— 宿主据此进下一部分或回地图。 */
  onDone: () => void
}

export function PartRun({
  unit,
  unitIndex,
  part,
  items,
  startIndex = 0,
  speak,
  playSound,
  onBlock,
  onQuestionEnd,
  onDone,
}: PartRunProps) {
  // 起始题号在这里**冻结**:宿主每次渲染都会重算「本部分第一道未通的题」,
  // 而走题过程中星级一直在变 —— 现算会把进度往回拽。本组件按 part 换 key 重挂,
  // 所以这个初值每部分只取一次,正是要的语义。
  const [index, setIndex] = useState(startIndex)
  const item = items[index]

  const advance = useCallback(() => {
    if (index + 1 >= items.length) onDone()
    else setIndex(index + 1)
  }, [index, items.length, onDone])

  const onPartEnd = useCallback(
    async (result: PartResult) => {
      if (item?.kind === 'level' && onQuestionEnd) {
        const level = unit.levels[item.levelIndex]
        if (level) {
          // **先 await 再推进**:孩子在这一题的庆祝动画里按「回地图」,那时这一题必须已经落库。
          await onQuestionEnd({
            levelId: level.id,
            stars: starsFor(result.missCount),
            wrongBlocks: result.wrongBlocks,
            exact: part === 'hard',
          })
        }
      }
      advance()
    },
    [item, unit, part, onQuestionEnd, advance],
  )

  if (!item) return null

  return (
    <PinyinBlocksGame
      // 换题即换 key ⇒ 盘面、提示、错题池全部重来。
      key={`${part}-${index}`}
      unitIndex={unitIndex}
      levelIndex={item.levelIndex}
      stage={part === 'hard' ? 'hard' : 'easy'}
      review={item.kind === 'review' ? item.question : null}
      reviewProgress={item.kind === 'review' ? { done: index + 1, total: items.length } : undefined}
      speak={speak}
      playSound={playSound}
      onBlock={onBlock}
      onPartEnd={onPartEnd}
    />
  )
}
