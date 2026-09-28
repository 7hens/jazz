// 一关的三段相位机:简单 → 过场 A → 困难 →(落库)→ 过场 B → 复习 → 交账。
// 复用 PinyinBlocksGame,只换入参 —— 不写第二套拼装台(spec §3.10)。
// **按 level.id 换 key 重挂** —— 换关即清空,不在 effect 里 setState 补重置。

import { useCallback, useMemo, useRef, useState } from 'react'
import type { AnswerKind } from '@/shared/services'
import type { Unit } from './levels'
import { addToPool, exactPoolKey, reviewQuestions, type MistakePool } from './mistakes'
import { PinyinBlocksGame, type SectionResult } from './PinyinBlocksGame'
import { starsFor } from './rules'
import { StageTransition } from './StageTransition'

type LevelRunProps = {
  unit: Unit
  unitIndex: number
  levelIndex: number
  speak: (text: string) => void
  playSound?: (cue: 'correct' | 'wrong' | 'victory' | 'tap') => void
  onBlock?: (kind: AnswerKind) => void
  /**
   * 落库(星级归一 / 首通 / 连续天数 / 成就 / 星尘)。**困难段一结束就调**,在复习段之前 ——
   * 复习到一半按「回地图」就走,那时这一关必须已经记上(spec §3.9)。
   */
  settle: (stars: number) => Promise<void>
  /** 复习段跑完。入口页据此发 onSettle + 撒花 + 推进下一关。 */
  onDone: () => void
}

export function LevelRun({
  unit,
  unitIndex,
  levelIndex,
  speak,
  playSound,
  onBlock,
  settle,
  onDone,
}: LevelRunProps) {
  const level = unit.levels[levelIndex]
  const [phase, setPhase] = useState<'easy' | 'transitionA' | 'hard' | 'transitionB' | 'review'>('easy')
  const [reviewIdx, setReviewIdx] = useState(0)
  const [pool, setPool] = useState<MistakePool>([])
  /** 简单段的错次数 —— 与困难段的错相加才是这一关的 miss(spec §3.9 裁定 M)。 */
  const easyMiss = useRef(0)

  // 复习小题在进复习段前后各算一次(phase 变化 ⇒ deps 变化 ⇒ 重算),这是**故意**保留的:
  // 重发牌之所以不会把托盘在中途换掉,取决于 `reviewQuestions` 的**非空池分支不掷骰子**
  //(类型按池内倒序去重、块 id 形如 q{qi}-c{i} / -p{i}、错解名额按可见块数算,全与 rng 无关),
  // 于是重算只产出等值对象、prefill 的 blockId 与旧的一致,placement(只初始化一次)不失配;
  // 池空那一支 prefill 恒为 {},无内容可失配。
  // 若将来给非空池那一支接上 rng,遮罩散去时盘面就会与托盘失配 —— 那时必须把发牌冻进 state。
  const questions = useMemo(
    () => (phase === 'transitionB' || phase === 'review' ? (level ? reviewQuestions(level, unitIndex, pool) : []) : []),
    [phase, level, unitIndex, pool],
  )

  const onEasyEnd = useCallback((result: SectionResult) => {
    easyMiss.current = result.missCount
    setPool((cur) => addToPool(cur, result.wrongBlocks))
    setPhase('transitionA')
  }, [])

  const onHardEnd = useCallback(
    async (result: SectionResult) => {
      // 困难段的池按**精确身份**记账 —— 那一段的门禁只比类型,介母块与韵母块是两个真身份。
      setPool((cur) => addToPool(cur, result.wrongBlocks, exactPoolKey))
      // 星在复习段之前落库。复习段恒不增 miss,所以这里的数就是这一关的最终星级。
      await settle(starsFor(easyMiss.current + result.missCount))
      setPhase('transitionB')
    },
    [settle],
  )

  const onReviewEnd = useCallback(() => {
    // 最后一道小题做完才交账;否则换下一道(换 reviewIdx ⇒ 换 key ⇒ 重挂)。
    if (reviewIdx + 1 >= questions.length) {
      onDone()
      return
    }
    setReviewIdx(reviewIdx + 1)
  }, [reviewIdx, questions.length, onDone])

  if (!level) return null

  // 过场期间就把目标那一段挂上(蒙在遮罩后面)—— 遮罩一散,孩子看到的就是新一段,
  // 不会有一次「空屏 → 重挂」的闪。key 不变 ⇒ 这一挂是同一个实例,状态不被重置。
  const active: 'easy' | 'hard' | 'review' =
    phase === 'easy' ? 'easy' : phase === 'hard' || phase === 'transitionA' ? 'hard' : 'review'
  const question = questions[reviewIdx]

  const game = () => {
    if (active === 'easy') {
      return (
        <PinyinBlocksGame
          key={`${level.id}-easy`}
          unitIndex={unitIndex}
          levelIndex={levelIndex}
          stage="easy"
          speak={speak}
          playSound={playSound}
          onBlock={onBlock}
          onSectionEnd={onEasyEnd}
        />
      )
    }
    if (active === 'hard') {
      return (
        <PinyinBlocksGame
          key={`${level.id}-hard`}
          unitIndex={unitIndex}
          levelIndex={levelIndex}
          stage="hard"
          speak={speak}
          playSound={playSound}
          onBlock={onBlock}
          onSectionEnd={onHardEnd}
        />
      )
    }
    if (!question) return null
    return (
      <PinyinBlocksGame
        key={`${level.id}-review-${reviewIdx}`}
        unitIndex={unitIndex}
        levelIndex={levelIndex}
        review={question}
        reviewProgress={{ done: reviewIdx + 1, total: questions.length }}
        speak={speak}
        playSound={playSound}
        onBlock={onBlock}
        onSectionEnd={onReviewEnd}
      />
    )
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {game()}
      {phase === 'transitionA' ? <StageTransition stage="hard" onDone={() => setPhase('hard')} /> : null}
      {phase === 'transitionB' ? <StageTransition stage="review" onDone={() => setPhase('review')} /> : null}
    </div>
  )
}
