import { useEffect } from 'react'
import { motion } from 'motion/react'
import { Volume2 } from 'lucide-react'
import { speakCard } from './speech'
import { Choice, type ChoiceProps } from './Choice'

export type ListenChoiceProps = Omit<ChoiceProps, 'promptSpeak'> & {
  /** 进题自动朗读、点击大钮重播的文本 */
  promptSpeak: string
}

export function ListenChoice({ promptSpeak, kingdom, options, onAnswer, ...rest }: ListenChoiceProps) {
  // 进题自动朗读一次(promptSpeak);每题组件按 key 重挂载,故触发时机即"进题"。
  useEffect(() => {
    speakCard(kingdom, promptSpeak)
  }, [kingdom, promptSpeak])

  return (
    <div className="space-y-5">
      <div className="flex justify-center">
        <motion.button
          type="button"
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => speakCard(kingdom, promptSpeak)}
          aria-label="再听一遍"
          className="flex h-20 w-20 items-center justify-center rounded-full bg-accent text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_8px_24px_-12px_rgb(0_0_0/0.4)]"
        >
          <Volume2 className="h-9 w-9" />
        </motion.button>
      </div>
      <Choice
        kingdom={kingdom}
        options={options}
        onAnswer={onAnswer}
        {...rest}
      />
    </div>
  )
}
