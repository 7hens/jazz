import { useEffect, useState } from 'react'
import { LogOut, RotateCcw, Volume2, VolumeX, Wrench } from 'lucide-react'
import { motion } from 'motion/react'
import { CATEGORY_LABELS, WORDS } from '../../data/words'
import { firstTargetId, fullComplete } from '../../game/lesson'
import { titleForStars } from '../../game/progress'
import { cn } from '../../lib/utils'
import { play } from '../../game/sfx'
import { LingLing } from './LingLing'
import type { CategoryKey, UserSettings, WordProgress } from '../../types'
import { Button } from '../ui/button'

export type WordMapViewProps = {
  words: Record<number, WordProgress>
  totalStars: number
  settings: UserSettings
  soundOn: boolean
  onToggleSound: () => void
  onPlay: (wordId: number) => void
  onOpenSettings: () => void
  onLogout: () => void
  onReset: () => void
}

const CATEGORY_ORDER: CategoryKey[] = ['shape', 'food', 'animal', 'nature', 'object']

export function WordMapView({
  words,
  totalStars,
  settings,
  soundOn,
  onToggleSound,
  onPlay,
  onOpenSettings,
  onLogout,
  onReset,
}: WordMapViewProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const target = firstTargetId(words, settings)
  const title = titleForStars(totalStars)
  const doneCount = WORDS.filter((w) => fullComplete(words[w.id], settings)).length

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  return (
    <div className="min-h-screen text-ink">
      {menuOpen ? <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} aria-hidden="true" /> : null}

      <header className="glass-strong sticky top-0 z-30 border-b border-hairline">
        <div className="mx-auto flex max-w-xl items-center gap-1.5 px-4 py-2.5">
          <span className="mr-auto flex items-center gap-2 text-[15px] font-bold tracking-tight">
            <span className="text-xl" aria-hidden>🏰</span>魔法语言岛
          </span>
          <span className="flex items-center gap-1 rounded-full border border-hairline bg-surface/80 px-2.5 py-1 text-sm font-semibold shadow-card">
            <span aria-hidden>⭐</span>{totalStars}
          </span>
          <span className="rounded-full border border-hairline bg-surface/80 px-2.5 py-1 text-sm font-semibold shadow-card">
            🎖{title.name}
          </span>
          <Button variant="ghost" size="icon" aria-label={soundOn ? '关闭声音' : '开启声音'} onClick={onToggleSound}>
            {soundOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5 text-ink-3" />}
          </Button>
          <div className="relative">
            <Button
              variant="ghost" size="icon" aria-label="家长菜单" aria-haspopup="menu" aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <Wrench className="h-5 w-5" />
            </Button>
            {menuOpen ? (
              <div className="absolute right-0 top-full z-30 mt-2 w-48 rounded-2xl border border-hairline bg-surface p-1.5 shadow-pop" role="menu">
                <button
                  type="button" role="menuitem"
                  onClick={() => { setMenuOpen(false); onOpenSettings() }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-surface-2"
                >
                  ⚙️ 学习设置
                </button>
                <button
                  type="button" role="menuitem"
                  onClick={() => { setMenuOpen(false); onReset() }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-surface-2"
                >
                  <RotateCcw className="h-4 w-4 text-ink-3" /> 重置进度
                </button>
                <button
                  type="button" role="menuitem"
                  onClick={() => { setMenuOpen(false); onLogout() }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-red transition-colors hover:bg-red-tint"
                >
                  <LogOut className="h-4 w-4" /> 退出登录
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 pb-24 pt-6">
        <section className="mb-6 text-center">
          <p className="text-sm font-semibold text-accent">魔法语言岛 · 词库王国</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight">收集 100 个词的星尘</h1>
          <p className="mx-auto mt-1 max-w-xs text-sm text-ink-2">
            已全完成 {doneCount}/100 · 当前称号 🎖{title.name}
          </p>
        </section>

        <LingLing completedWords={doneCount} />

        {target > WORDS.length ? (
          <div className="mb-6 rounded-2xl border border-emerald/40 bg-emerald/10 px-4 py-3 text-center text-sm font-bold text-emerald">
            🎉 太棒了,100 词全部学完!
          </div>
        ) : null}

        {CATEGORY_ORDER.map((cat) => {
          const items = WORDS.filter((w) => w.category === cat)
          const doneInCat = items.filter((w) => fullComplete(words[w.id], settings)).length
          return (
            <section key={cat} className="mb-7">
              <div className="mb-2.5 flex items-baseline justify-between">
                <h2 className="text-sm font-bold">{CATEGORY_LABELS[cat]}</h2>
                <span className="text-xs font-semibold text-ink-3">{doneInCat}/{items.length}</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {items.map((w) => {
                  const isDone = fullComplete(words[w.id], settings)
                  const isTarget = w.id === target
                  const locked = w.id > target
                  return (
                    <motion.button
                      key={w.id}
                      type="button"
                      aria-label={`词 ${w.id} ${w.hanzi}${locked ? ',未解锁' : ''}`}
                      disabled={locked}
                      onClick={() => { if (!locked) { void play('tap'); onPlay(w.id) } }}
                      whileHover={locked ? undefined : { y: -2, scale: 1.04 }}
                      whileTap={locked ? undefined : { scale: 0.94 }}
                      animate={isTarget ? { scale: [1, 1.05, 1] } : { scale: 1 }}
                      transition={isTarget ? { repeat: Infinity, duration: 1.4, ease: 'easeInOut' } : { type: 'spring', bounce: 0, duration: 0.3 }}
                      className={cn(
                        'relative flex aspect-square flex-col items-center justify-center rounded-2xl border-2 transition-colors',
                        locked
                          ? 'border-hairline bg-surface-2 opacity-45'
                          : isDone
                            ? 'border-emerald/50 bg-emerald/10'
                            : isTarget
                              ? 'border-accent bg-accent/10 ring-2 ring-accent/25'
                              : 'border-hairline bg-surface hover:border-accent/50',
                      )}
                    >
                      <span className="text-2xl leading-none" aria-hidden>{locked ? '🔒' : w.emoji}</span>
                      <span className={cn('mt-0.5 text-[11px] font-semibold', isDone ? 'text-emerald' : 'text-ink-2')}>
                        {isDone ? '✓' : isTarget ? '开始' : `${w.id}`}
                      </span>
                    </motion.button>
                  )
                })}
              </div>
            </section>
          )
        })}
      </main>
    </div>
  )
}
