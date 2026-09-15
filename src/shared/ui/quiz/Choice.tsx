import { useState } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/shared/ui/utils'
import type { BaseOption, SkillKey } from '@/shared/services'
import { speakCard, type Speak } from './speech'
import { TypeBadge } from './TypeBadge'
import { QuestionBubble } from './QuestionBubble'
import { CastButton } from './CastButton'
import { STONE_LIFT, stoneClass, stoneMark, stoneMarkClass, stoneOffset, type StoneState } from './stone'

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

      <QuestionBubble
        prompt={prompt}
        emoji={promptEmoji}
        onReplay={promptSpeak ? () => speakCard(speak, skill, promptSpeak) : undefined}
      />

      <div className="grid grid-cols-2 gap-3">
        {options.map((o, i) => {
          const state: StoneState =
            revealId === o.id || correctId === o.id
              ? 'correct'
              : wrongId === o.id
                ? 'wrong'
                : disabled
                  ? 'muted'
                  : selected === o.id
                    ? 'selected'
                    : 'idle'
          const mark = stoneMark(state)
          return (
            <motion.button
              key={o.id}
              type="button"
              aria-disabled={disabled}
              aria-pressed={selected === o.id}
              data-state={state}
              onClick={() => handleCard(o)}
              animate={
                wrongId === o.id
                  ? { x: [0, -9, 9, -6, 6, 0], y: 0 } // 抖动期不得残留上浮位移
                  : { x: 0, y: state === 'selected' || state === 'correct' ? STONE_LIFT : 0 }
              }
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className={cn(
                stoneClass(state, i),
                stoneOffset(i),
                !disabled && 'cursor-pointer active:scale-[0.96]',
              )}
            >
              {mark ? (
                <span
                  aria-hidden
                  className={cn(
                    'absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold shadow-card',
                    stoneMarkClass(state),
                  )}
                >
                  {mark}
                </span>
              ) : null}
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
          <CastButton disabled={selected === null} onClick={confirm} />
        </div>
      ) : null}
    </div>
  )
}
