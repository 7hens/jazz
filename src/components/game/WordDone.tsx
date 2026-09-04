import { motion } from 'motion/react'
import { ArrowRight, Home } from 'lucide-react'
import { play } from '../../game/sfx'
import { getRandomPraise } from '../../game/praise'
import { useEffect, useRef } from 'react'
import { cn } from '../../lib/utils'
import type { WordUnit } from '../../types'
import { Button } from '../ui/button'

export type WordDoneProps = {
  word: WordUnit
  stepReward: number
  wordBonus: number
  extraReward?: number // 趣味额外奖励(连击池+幸运+成就),仅首通词非 0
  totalStars: number
  titleName: string
  nextId: number
  isLastWord: boolean
  onNext: () => void
  onMap: () => void
}

export function WordDone({
  word, stepReward, wordBonus, extraReward, totalStars, titleName, nextId, isLastWord, onNext, onMap,
}: WordDoneProps) {
  // 词级随机夸奖:useRef 惰性 init → 每次挂载随机一次,不随重渲染变
  const praise = useRef(getRandomPraise())
  const playedRef = useRef(false)
  useEffect(() => {
    if (playedRef.current) return
    playedRef.current = true
    play(wordBonus > 0 ? 'victory' : 'correct')
  }, [wordBonus])

  return (
    <div className="min-h-screen text-ink">
      <main className="mx-auto max-w-xl px-4 pb-24 pt-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[2rem] border border-hairline bg-surface p-6 text-center shadow-pop sm:p-8"
        >
          <p className="text-sm font-semibold uppercase tracking-widest text-ink-3">学习结算</p>
          <div className="mt-3 text-6xl" aria-hidden>{word.emoji}</div>
          {/* 动态祝贺:随机夸奖 + 整词首通 vs 复查再学(已完成词重学无整词加成) */}
          <p className={cn('mt-3 text-sm font-bold', wordBonus > 0 ? 'text-emerald' : 'text-accent')}>
            {wordBonus > 0 ? `${praise.current} 整词完成!` : `${praise.current} 这一步完成啦!`}
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight">{word.hanzi}</h1>
          <p className="text-sm text-ink-2">{word.pinyin} · {word.english}</p>

          <div className="mt-5 flex items-center justify-center gap-3">
            {stepReward > 0 ? (
              <div className="rounded-2xl border border-hairline bg-amber-100 px-4 py-2">
                <p className="text-xs font-semibold text-ink-3">技能步星尘</p>
                <p className="text-xl font-extrabold text-amber">+{stepReward}</p>
              </div>
            ) : null}
            {wordBonus > 0 ? (
              <div className="rounded-2xl border border-emerald/40 bg-emerald/10 px-4 py-2">
                <p className="text-xs font-semibold text-emerald">整词完成加成</p>
                <p className="text-xl font-extrabold text-emerald">+{wordBonus}</p>
              </div>
            ) : null}
          </div>
          {/* 趣味额外奖励:连击池 + 幸运 + 本词新成就,首通词才可能非 0 */}
          {extraReward != null && extraReward > 0 ? (
            <div className="mt-3 rounded-2xl border border-amber/50 bg-amber-100 px-4 py-2">
              <p className="text-xs font-semibold text-ink-3">趣味额外奖励</p>
              <p className="text-xl font-extrabold text-amber">+{extraReward}</p>
            </div>
          ) : null}
          <p className="mt-4 text-sm text-ink-2">星尘 {totalStars} · 称号 🎖 {titleName}</p>

          {/* 灵灵 teaser 气泡:有引导语才显示,暗示下一词 */}
          {word.teaser ? (
            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-hairline bg-surface-2 px-4 py-3 text-left">
              <span className="text-3xl" aria-hidden>🦊</span>
              <p className="text-sm leading-relaxed text-ink-2">{word.teaser}</p>
            </div>
          ) : null}

          <div className="mt-6 space-y-2.5">
            {!isLastWord ? (
              <Button size="lg" className="w-full" onClick={() => { void play('tap'); onNext() }}>
                下一词 · {nextId} 号 <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button size="lg" className="w-full" onClick={onMap}>
                🎉 你已学完全部 100 词!
              </Button>
            )}
            <Button variant="outline" size="lg" className="w-full" onClick={onMap}>
              <Home className="mr-2 h-4 w-4" /> 回地图
            </Button>
          </div>
        </motion.div>
      </main>
    </div>
  )
}
