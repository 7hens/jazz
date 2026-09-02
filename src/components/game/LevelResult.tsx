import { useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { ArrowLeft, Home, RotateCcw } from 'lucide-react'
import { cn } from '../../lib/utils'
import { play } from '../../game/sfx'
import type { LevelOutcome } from '../../game/scoring'
import { Button } from '../ui/button'

export type LevelResultProps = {
  levelId: number
  title: string
  outcome: LevelOutcome
  starDelta: number
  expDelta: number
  unlockedNew: boolean
  onAgain: () => void
  onMap: () => void
  onNext?: () => void
}

const HEADLINES: Record<number, string> = {
  0: '差一点就通关了,再试一次吧!',
  1: '过关啦!',
  2: '真厉害!',
  3: '太棒了,满分魔法师!',
}

const STAR_TONES = [
  { color: '#f59e0b', delay: 0.15 },
  { color: '#f59e0b', delay: 0.3 },
  { color: '#f59e0b', delay: 0.45 },
]

export function LevelResult({
  levelId,
  title,
  outcome,
  starDelta,
  expDelta,
  unlockedNew,
  onAgain,
  onMap,
  onNext,
}: LevelResultProps) {
  const stars = outcome.stars
  const playedRef = useRef(false)

  useEffect(() => {
    if (stars >= 1 && !playedRef.current) {
      playedRef.current = true
      play('victory')
    }
  }, [stars])

  return (
    <div className="min-h-screen text-ink">
      <header className="glass-strong sticky top-0 z-30 border-b border-hairline">
        <div className="mx-auto flex h-14 max-w-xl items-center gap-2 px-4">
          <Button variant="ghost" size="icon" onClick={onMap} aria-label="回到地图">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="truncate text-[15px] font-bold">第 {levelId} 关 · {title} · 结算</span>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 pb-24 pt-6">
        <div className="rounded-[2rem] border border-hairline bg-surface p-6 text-center shadow-pop sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-ink-3">闯关结果</p>

          {/* 大星 */}
          <div className="mt-4 flex items-end justify-center gap-3" aria-label={`${stars} 星`}>
            {STAR_TONES.map((tone, i) => {
              const filled = i < stars
              return (
                <motion.span
                  key={i}
                  initial={{ scale: 0, rotate: -30, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  transition={{ delay: tone.delay, type: 'spring', bounce: 0.6, duration: 0.5 }}
                  className={cn('leading-none', i === 1 && 'text-6xl sm:text-7xl', i !== 1 && 'text-5xl sm:text-6xl')}
                  style={filled ? { color: tone.color } : undefined}
                >
                  {filled ? '★' : <span className="text-ink-3/40">★</span>}
                </motion.span>
              )
            })}
          </div>

          <h1 className="mt-3 text-2xl font-extrabold tracking-tight">{HEADLINES[stars]}</h1>
          <p className="mt-1 text-sm text-ink-2">
            得分 {outcome.rawScore} / {outcome.baseMax} · 最高连击 {outcome.maxStreak} · 首对 {outcome.firstTryCorrect} 题
          </p>

          {/* 收获 */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-hairline bg-surface-2 px-3 py-3">
              <p className="text-xs font-semibold text-ink-3">星尘</p>
              <p className="mt-0.5 text-xl font-extrabold text-amber">
                {starDelta > 0 ? `+${starDelta}` : starDelta === 0 && stars > 0 ? '+0' : '—'}
              </p>
            </div>
            <div className="rounded-2xl border border-hairline bg-surface-2 px-3 py-3">
              <p className="text-xs font-semibold text-ink-3">魔法经验</p>
              <p className="mt-0.5 text-xl font-extrabold text-violet">
                {expDelta > 0 ? `+${expDelta}` : expDelta === 0 && stars > 0 ? '+0' : '—'}
              </p>
            </div>
          </div>

          {unlockedNew ? (
            <p className="mt-4 flex items-center justify-center gap-1.5 rounded-2xl bg-emerald/10 px-3 py-2 text-sm font-bold text-emerald">
              🔓 太棒了,已解锁下一关!
            </p>
          ) : null}

          <div className="mt-6 space-y-2.5">
            {unlockedNew && levelId < 10 && onNext ? (
              <Button size="lg" className="w-full" onClick={onNext}>
                下一关 · 出发!
              </Button>
            ) : null}
            <Button variant="secondary" size="lg" className="w-full" onClick={onAgain}>
              <RotateCcw className="mr-2 h-4 w-4" /> 再玩一次
            </Button>
            <Button variant="outline" size="lg" className="w-full" onClick={onMap}>
              <Home className="mr-2 h-4 w-4" /> 回到地图
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
