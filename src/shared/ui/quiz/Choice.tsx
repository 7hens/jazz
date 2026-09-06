import { useState } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/shared/ui/utils'
import { Button } from '@/shared/ui/button'
import type { BaseOption, SkillKey } from '@/shared/services'
import { speakCard, type Speak } from './speech'
import { TypeBadge } from './TypeBadge'

export type ChoiceProps = {
  prompt: string
  promptSpeak?: string
  promptEmoji?: string
  skill: SkillKey
  options: BaseOption[]
  disabled?: boolean
  /** 两次答错后亮出的正确答案 option id */
  revealId?: string | null
  /** 刚答对(待推进)时高亮的 option id */
  correctId?: string | null
  /** 本次答错的 option id(红标 + 抖动) */
  wrongId?: string | null
  /** 内嵌复用(如 ListenChoice)时置 false,徽章由外层题型组件渲染,避免双徽章 */
  showBadge?: boolean
  speak: Speak
  onAnswer: (id: string) => void
}

function cardCls(disabled: boolean, reveal: boolean, correct: boolean, wrong: boolean, selected: boolean): string {
  if (reveal || correct) {
    return 'border-emerald/70 bg-emerald/10 text-ink ring-2 ring-emerald/30'
  }
  if (wrong) {
    return 'border-red bg-red-tint text-red'
  }
  if (disabled) {
    return 'border-hairline bg-surface-2 text-ink-2'
  }
  if (selected) {
    return 'border-accent bg-accent-tint text-ink shadow-card'
  }
  return 'border-hairline bg-surface text-ink hover:border-accent/60 hover:shadow-card'
}

export function Choice({
  prompt,
  promptSpeak,
  promptEmoji,
  skill,
  options,
  disabled = false,
  revealId = null,
  correctId = null,
  wrongId = null,
  showBadge = true,
  speak,
  onAnswer,
}: ChoiceProps) {
  // 每题/每轮由调用方 key 重挂载复位;同实例内确认提交后清空选中 → 二答须重选(attempt 语义不变)。
  const [selected, setSelected] = useState<string | null>(null)

  function handleCard(o: BaseOption) {
    if (disabled) return
    speakCard(speak, skill, o.speak ?? o.text) // 点卡 = 先念再选(缺 speak 读文本)
    setSelected(o.id)
  }

  function confirm() {
    if (selected === null) return
    onAnswer(selected)
    setSelected(null)
  }

  return (
    <div className="space-y-5">
      {showBadge ? (
        <div className="flex justify-start">
          <TypeBadge kind="choice" />
        </div>
      ) : null}
      {promptSpeak ? (
        // 题干整块可点重听区(无喇叭图标)
        <button
          type="button"
          aria-label="再听一遍"
          onClick={() => speakCard(speak, skill, promptSpeak)}
          className="mx-auto flex w-full flex-col items-center gap-1 rounded-3xl px-2 pb-2 pt-1 transition-colors hover:bg-accent-tint/60 active:scale-[0.99]"
        >
          {promptEmoji ? (
            <span aria-hidden className="text-7xl leading-none drop-shadow-sm">{promptEmoji}</span>
          ) : null}
          <p className="text-center text-lg font-bold leading-snug text-ink">{prompt}</p>
        </button>
      ) : (
        <>
          {promptEmoji ? (
            <div aria-hidden className="flex justify-center pb-1">
              <span className="text-7xl leading-none drop-shadow-sm">{promptEmoji}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-center px-2">
            <p className="text-center text-lg font-bold leading-snug text-ink">{prompt}</p>
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        {options.map((o) => {
          const reveal = revealId === o.id
          const correct = correctId === o.id
          const wrong = wrongId === o.id
          const isSelected = !disabled && !reveal && !correct && !wrong && selected === o.id
          return (
            <motion.button
              key={o.id}
              type="button"
              aria-disabled={disabled}
              aria-pressed={selected === o.id}
              onClick={() => handleCard(o)}
              animate={wrong ? { x: [0, -9, 9, -6, 6, 0] } : { x: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className={cn(
                'relative flex min-h-[84px] flex-col items-center justify-center gap-1.5 rounded-3xl border-2 px-3 py-3 text-center transition-colors',
                cardCls(disabled, reveal, correct, wrong, isSelected),
                !disabled && 'active:scale-[0.96] cursor-pointer',
              )}
            >
              {o.emoji ? (
                <span aria-hidden className="text-3xl leading-none">
                  {o.emoji}
                </span>
              ) : null}
              <span className={cn('font-bold leading-tight', o.emoji ? 'text-[15px]' : 'text-xl')}>{o.text}</span>
            </motion.button>
          )
        })}
      </div>

      {!disabled ? (
        <div className="flex flex-col items-center gap-2 pt-1">
          <Button
            size="lg"
            className="w-full sm:w-auto sm:min-w-52"
            disabled={selected === null}
            onClick={confirm}
          >
            确定
          </Button>
        </div>
      ) : null}
    </div>
  )
}
