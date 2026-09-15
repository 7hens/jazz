import { useState } from 'react'
import type { BaseOption, SkillKey } from '@/shared/services'
import { speakCard, type Speak } from './speech'
import { TypeBadge } from './TypeBadge'
import { QuestionBubble } from './QuestionBubble'
import { CastButton } from './CastButton'
import { Stone } from './Stone'
import { SparkBurst } from './SparkBurst'
import type { StoneState } from './stone'

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
  /** 不迸星、不上光柱 —— 听一听(D9)与短教教学期用。缺省 false。 */
  quiet?: boolean
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
  quiet = false,
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
          // 只认「用户真答对」(correctId),不认 state 的 correct —— 后者把两次答错后的
          // 揭晓(revealId)也算进来,那会在一道失败的题上放庆祝动画。揭晓仍保留绿底 + ✓
          // (那是「正确答案在此」,由 state 表达),但不应迸星、不上光柱。
          const juice = correctId === o.id && !quiet
          return (
            <Stone
              key={o.id}
              state={state}
              index={i}
              emoji={o.emoji}
              text={o.text}
              pressed={selected === o.id}
              disabled={disabled}
              shake={wrongId === o.id}
              onClick={() => handleCard(o)}
            >
              {juice ? <span aria-hidden className="quiz-beam" /> : null}
              {juice ? <SparkBurst /> : null}
            </Stone>
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
