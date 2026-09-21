import { useState } from 'react'
import { AudioService, SpeechService } from '@/shared/services'
import { useService } from '@/shared/services/core'
import { UNITS } from './levels'
import { PinyinBlocksGame } from './PinyinBlocksGame'
import { cn } from '@/shared/ui/utils'

type Hint = 'strong' | 'mid' | 'weak'

/**
 * 拼音积木页面入口。useService 只允许出现在 <Name>Entry.tsx,故服务在这里取、以 props 下传。
 *
 * 顶部那条是**试玩控制台**(切单元 / 换提示强度 / 重来),正式版会删掉 ——
 * 4-8 岁的孩子不看字,更没有「关卡选择」的概念,路径应当是线性解锁。
 */
export function PinyinBlocksEntry({ onExit }: { onExit?: () => void }) {
  const speech = useService(SpeechService)
  const audio = useService(AudioService)

  const [unit, setUnit] = useState(0)
  const [level, setLevel] = useState(0)
  const [hint, setHint] = useState<Hint>('strong')
  /** 「重来」靠换 key 重挂游戏 —— 把重置换算状态清空比在游戏里补一个重置通道干净。 */
  const [round, setRound] = useState(0)

  const speak = (text: string) => {
    speech.speak(text, 'zh-CN')
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 text-xs">
        <span className="text-ink-3">试玩控制台 · 正式版无此栏</span>
        <span className="mx-1 h-4 w-px bg-hairline-strong" />
        {UNITS.map((u, i) => (
          <button
            key={u.id}
            type="button"
            data-unit={i}
            aria-pressed={i === unit}
            onClick={() => {
              setUnit(i)
              setLevel(0)
            }}
            className={cn(
              'rounded-full border px-3 py-1 transition-colors',
              i === unit
                ? 'border-ink bg-ink text-surface'
                : 'border-hairline bg-surface/70 text-ink-2 hover:border-ink-3',
            )}
          >
            {i + 1}.{u.name}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-hairline-strong" />
        <span className="text-ink-3">提示</span>
        {(['strong', 'mid', 'weak'] as const).map((h) => (
          <button
            key={h}
            type="button"
            aria-pressed={h === hint}
            onClick={() => setHint(h)}
            className={cn(
              'rounded-full border px-3 py-1 transition-colors',
              h === hint
                ? 'border-ink bg-ink text-surface'
                : 'border-hairline bg-surface/70 text-ink-2 hover:border-ink-3',
            )}
          >
            {h === 'strong' ? '强' : h === 'mid' ? '中' : '弱'}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-hairline-strong" />
        <button
          type="button"
          onClick={() => setRound((r) => r + 1)}
          className="rounded-full border border-hairline bg-surface/70 px-3 py-1 text-ink-2 hover:border-ink-3"
        >
          重来
        </button>
        {onExit ? (
          <button
            type="button"
            onClick={onExit}
            className="rounded-full border border-hairline bg-surface/70 px-3 py-1 text-ink-2 hover:border-ink-3"
          >
            返回
          </button>
        ) : null}
      </div>

      <PinyinBlocksGame
        key={`${unit}-${level}-${round}`}
        speak={speak}
        playSound={audio.play}
        unitIndex={unit}
        levelIndex={level}
        hint={hint}
        onAdvance={(u, l) => {
          setUnit(u)
          setLevel(l)
        }}
      />
    </div>
  )
}
