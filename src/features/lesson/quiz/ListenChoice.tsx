import { useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { Volume2 } from 'lucide-react'
import { speakCard } from './speech'
import { Choice, type ChoiceProps } from './Choice'

export type ListenChoiceProps = Omit<ChoiceProps, 'promptSpeak'> & {
  /** 进题自动朗读、点击大钮重播的文本 */
  promptSpeak: string
}

export function ListenChoice({ promptSpeak, kingdom, options, onAnswer, speak, ...rest }: ListenChoiceProps) {
  // 进题自动朗读一次(promptSpeak)。React StrictMode 开发模式会重放 effect(setup→cleanup→setup),
  // 若不拦,第二次 speak 会先 cancel 掉第一次正在合成的 utterance,speech-dispatcher 后端下该句
  // 直接丢失 → 无声。ref 去重保证同一组件实例只自动读一次;每题按 key 重挂载 → 新实例 → 新题仍会读。
  const saidRef = useRef(false)
  useEffect(() => {
    if (saidRef.current) return
    saidRef.current = true
    speakCard(speak, kingdom, promptSpeak)
  }, [kingdom, promptSpeak, speak])

  return (
    <div className="space-y-5">
      <div className="flex justify-center">
        <motion.button
          type="button"
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => speakCard(speak, kingdom, promptSpeak)}
          aria-label="再听一遍"
          className="flex h-20 w-20 items-center justify-center rounded-full bg-accent text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_8px_24px_-12px_rgb(0_0_0/0.4)]"
        >
          <Volume2 className="h-9 w-9" />
        </motion.button>
      </div>
      <Choice
        kingdom={kingdom}
        options={options}
        speak={speak}
        onAnswer={onAnswer}
        {...rest}
      />
    </div>
  )
}
