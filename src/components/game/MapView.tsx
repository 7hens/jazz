import { Fragment, useEffect, useState } from 'react'
import { LogOut, RotateCcw, Volume2, VolumeX, Wrench } from 'lucide-react'
import { motion } from 'motion/react'
import { LEVELS } from '../../data/levels'
import { LEVELS_PER_KINGDOM, levelOfExp } from '../../game/state'
import type { GameState, KingdomKey, Level } from '../../types'
import { Button } from '../ui/button'

type MapViewProps = {
  state: GameState
  onPlay: (levelId: number) => void
  onReset: () => void
  onLogout: () => void
  soundOn: boolean
  onToggleSound: () => void
}

const KINGDOM_META: Array<{
  key: KingdomKey
  label: string
  glyph: string
  glyphCls: string
  barCls: string
}> = [
  { key: 'pinyin', label: '拼音王国', glyph: 'a', glyphCls: 'bg-pinyin/15 text-pinyin', barCls: 'bg-pinyin' },
  { key: 'hanzi', label: '汉字王国', glyph: '字', glyphCls: 'bg-hanzi/15 text-hanzi', barCls: 'bg-hanzi' },
  { key: 'english', label: '英语王国', glyph: 'A', glyphCls: 'bg-english/15 text-english', barCls: 'bg-english' },
]

function LevelNode({
  level,
  stars,
  locked,
  active,
  onPlay,
}: {
  level: Level
  stars: number
  locked: boolean
  active: boolean
  onPlay: () => void
}) {
  const subtitle = stars > 0 ? `${'★'.repeat(stars)} 已通关,可再玩` : active ? '开始冒险!' : '先通过上一关吧'
  const glyph = locked ? '🔒' : level.id === 10 ? '👑' : '⭐'.repeat(stars) || '▶'
  return (
    <motion.button
      type="button"
      onClick={onPlay}
      disabled={locked}
      whileHover={locked ? undefined : { y: -2, scale: 1.02 }}
      whileTap={locked ? undefined : { scale: 0.97 }}
      animate={active ? { scale: [1, 1.035, 1] } : { scale: 1 }}
      transition={
        active
          ? { repeat: Infinity, duration: 1.6, ease: 'easeInOut' }
          : { type: 'spring', bounce: 0, duration: 0.35 }
      }
      aria-label={`第 ${level.id} 关 ${level.title}${locked ? ',未解锁' : ''}`}
      className={`flex w-64 items-center gap-3 rounded-2xl border px-4 py-3 text-left shadow-card transition-colors ${
        locked
          ? 'border-hairline bg-surface-3 opacity-60'
          : active
            ? 'border-accent bg-surface ring-2 ring-accent/25'
            : 'border-hairline bg-surface hover:border-accent/40'
      }`}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${
          locked
            ? 'bg-surface-3'
            : active
              ? 'bg-accent text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.3)]'
              : 'bg-amber-100 text-amber-600'
        }`}
      >
        {glyph}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">第 {level.id} 关 · {level.title}</span>
        <span className="block text-xs text-ink-3">{subtitle}</span>
      </span>
    </motion.button>
  )
}

export function MapView({ state, onPlay, onReset, onLogout, soundOn, onToggleSound }: MapViewProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const level = levelOfExp(state.exp)

  // Escape 关闭菜单;a11y
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  function closeMenu() {
    setMenuOpen(false)
  }

  return (
    <div className="min-h-screen text-ink">
      {/* 全屏点击遮罩:放在 glass-strong header 之外,避免 header backdrop-filter 使其仅覆盖顶栏 */}
      {menuOpen ? <div className="fixed inset-0 z-20" onClick={closeMenu} aria-hidden="true" /> : null}

      {/* 顶部状态条:星尘 / Lv / 声音开关 / 家长菜单 */}
      <header className="glass-strong sticky top-0 z-30 border-b border-hairline">
        <div className="mx-auto flex max-w-xl items-center gap-1.5 px-4 py-2.5">
          <span className="mr-auto flex items-center gap-2 text-[15px] font-bold tracking-tight">
            <span className="text-xl" aria-hidden>
              🏰
            </span>
            魔法语言岛
          </span>
          <span className="flex items-center gap-1 rounded-full border border-hairline bg-surface/80 px-2.5 py-1 text-sm font-semibold shadow-card">
            <span aria-hidden>⭐</span>
            {state.stars}
          </span>
          <span className="rounded-full border border-hairline bg-surface/80 px-2.5 py-1 text-sm font-semibold shadow-card">
            Lv.{level}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label={soundOn ? '关闭声音' : '开启声音'}
            onClick={onToggleSound}
          >
            {soundOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5 text-ink-3" />}
          </Button>
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              aria-label="家长菜单"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <Wrench className="h-5 w-5" />
            </Button>
            {menuOpen ? (
              <div
                className="absolute right-0 top-full z-30 mt-2 w-48 rounded-2xl border border-hairline bg-surface p-1.5 shadow-pop"
                role="menu"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    closeMenu()
                    onReset()
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-surface-2"
                >
                  <RotateCcw className="h-4 w-4 text-ink-3" /> 重置进度
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    closeMenu()
                    onLogout()
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-red transition-colors hover:bg-red-tint"
                >
                  <LogOut className="h-4 w-4" /> 退出登录
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 pb-20 pt-6">
        {/* 标题区 */}
        <section className="mb-6 text-center">
          <p className="text-sm font-semibold text-accent">新手村 · 拼音 → 汉字 → 英语</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight">踏上收集星尘的冒险</h1>
          <p className="mx-auto mt-1 max-w-xs text-sm text-ink-2">点亮 10 个魔法节点,成为语言小魔法师!</p>
        </section>

        {/* 中部:新手村 10 节点线性路径 */}
        <div className="flex flex-col items-center">
          {LEVELS.map((lv, idx) => {
            const stars = state.levels[lv.id]?.stars ?? 0
            const locked = lv.id > state.unlocked
            const active = lv.id === state.unlocked
            return (
              <Fragment key={lv.id}>
                <LevelNode
                  level={lv}
                  stars={stars}
                  locked={locked}
                  active={active}
                  onPlay={() => onPlay(lv.id)}
                />
                {idx < LEVELS.length - 1 ? (
                  <div
                    aria-hidden
                    className={`h-7 w-1 rounded-full ${stars > 0 ? 'bg-emerald/50' : 'bg-hairline'}`}
                  />
                ) : null}
              </Fragment>
            )
          })}
        </div>

        {/* 底部:三王国进度徽章 */}
        <section className="mt-10">
          <h2 className="mb-3 text-center text-xs font-bold uppercase tracking-widest text-ink-3">王国进度</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {KINGDOM_META.map((meta) => {
              const earned = state.kingdom[meta.key]
              const total = LEVELS_PER_KINGDOM[meta.key].length * 3
              const pct = total ? Math.round((earned / total) * 100) : 0
              return (
                <div
                  key={meta.key}
                  className="flex items-center gap-3 rounded-2xl border border-hairline bg-surface px-3.5 py-3 shadow-card"
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg font-bold ${meta.glyphCls}`}
                  >
                    {meta.glyph}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-1">
                      <span className="truncate text-[13px] font-semibold">{meta.label}</span>
                      <span className="text-xs font-medium text-ink-3">
                        {earned}/{total}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                      <motion.div
                        className={`h-full rounded-full ${meta.barCls}`}
                        initial={false}
                        animate={{ width: `${pct}%` }}
                        transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </main>
    </div>
  )
}
