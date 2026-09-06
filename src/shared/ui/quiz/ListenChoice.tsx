import { useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { Volume2 } from 'lucide-react'
import { speakCard } from './speech'
import { TypeBadge } from './TypeBadge'
import { Choice, type ChoiceProps } from './Choice'

export type ListenChoiceProps = Omit<ChoiceProps, 'promptSpeak'> & {
  /** 进题自动朗读、点击喇叭重播的文本 */
  promptSpeak: string
}

export function ListenChoice({ promptSpeak, skill, options, onAnswer, speak, ...rest }: ListenChoiceProps) {
  // 进题自动朗读一次(promptSpeak)。React StrictMode 开发模式会重放 effect(setup→cleanup→setup),
  // 若不拦,第二次 speak 会先 cancel 掉第一次正在合成的 utterance,speech-dispatcher 后端下该句
  // 直接丢失 → 无声。ref 去重保证同一组件实例只自动读一次;每题按 key 重挂载 → 新实例 → 新题仍会读。
  const saidRef = useRef(false)
  useEffect(() => {
    if (saidRef.current) return
    saidRef.current = true
    speakCard(speak, skill, promptSpeak)
  }, [skill, promptSpeak, speak])

  return (
    <div className="space-y-5">
      {/* 标题行:左徽章「听一听」,右喇叭 = 点击重听(补回标题行喇叭图标,方便复听) */}
      <div className="flex items-center justify-between gap-2">
        <TypeBadge kind="listen-choice" />
        <motion.button
          type="button"
          aria-label="再听一遍"
          whileTap={{ scale: 0.9 }}
          onClick={() => speakCard(speak, skill, promptSpeak)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-ink-2 transition-colors hover:bg-accent-tint hover:text-accent"
        >
          <Volume2 className="h-5 w-5" />
        </motion.button>
      </div>
      <Choice
        {...rest}
        skill={skill}
        options={options}
        speak={speak}
        onAnswer={onAnswer}
        showBadge={false}
      />
    </div>
  )
}
