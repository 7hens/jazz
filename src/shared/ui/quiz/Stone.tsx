import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/shared/ui/utils'
import { STONE_LIFT, stoneClass, stoneMark, stoneMarkClass, stoneOffset, type StoneState } from './stone'

export type StoneProps = {
  state: StoneState
  /** 造型序号:0 / 1 两套圆角(见 stone.ts STONE_SHAPE)。默认 0。 */
  index?: number
  /** 石面主行文字 */
  text?: string
  /** 石面第二行小字 —— 仅 gold 态(炼成后 词 / 拼音 两行) */
  subText?: string
  emoji?: string
  /** 横排(连连看)vs 竖排(选一选)。默认竖排。 */
  horizontal?: boolean
  disabled?: boolean
  pressed?: boolean
  /** 抖动(错配)。上浮由 state 自动决定,不由此控制。 */
  shake?: boolean
  onClick?: () => void
  className?: string
  /** 插槽:迸星 / 光柱等装饰由消费方决定要不要装(分档落在消费点,不在组件内做开关)。 */
  children?: ReactNode
}

/** 词石的**唯一渲染点**。布局走 Tailwind,材质走 index.css 的 .stone--<态>(见 stone.ts 注)。
 *  任何新增装饰节点都必须 aria-hidden —— 测试靠 accessible name 定位选项。 */
export function Stone({
  state,
  index = 0,
  text,
  subText,
  emoji,
  horizontal = false,
  disabled = false,
  pressed,
  shake = false,
  onClick,
  className,
  children,
}: StoneProps) {
  const mark = stoneMark(state)
  const lifts = state === 'selected' || state === 'correct'
  return (
    <motion.button
      type="button"
      aria-disabled={disabled}
      aria-pressed={pressed}
      data-state={state}
      onClick={onClick}
      animate={shake ? { x: [0, -9, 9, -6, 6, 0], y: 0 } : { x: 0, y: lifts ? STONE_LIFT : 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={cn(
        stoneClass(state, index),
        horizontal ? 'gap-2 flex-row min-h-[64px]' : stoneOffset(index),
        !disabled && 'cursor-pointer active:scale-[0.96]',
        className,
      )}
    >
      {children}
      {emoji ? (
        <span aria-hidden data-halo className={cn('stone-halo leading-none', horizontal ? 'text-2xl' : 'text-3xl')}>
          {emoji}
        </span>
      ) : null}
      {subText ? (
        <span className="flex flex-col leading-tight">
          <span className={cn('font-bold', emoji ? 'text-[15px]' : 'text-xl')}>{text}</span>
          <span className="stone-sub text-base font-bold">{subText}</span>
        </span>
      ) : text ? (
        <span className={cn('font-bold leading-tight', emoji ? 'text-[15px]' : 'text-xl')}>{text}</span>
      ) : null}
      {mark ? (
        <span
          aria-hidden
          className={cn(
            'absolute -right-1.5 -top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold shadow-card',
            stoneMarkClass(state),
          )}
        >
          {mark}
        </span>
      ) : null}
    </motion.button>
  )
}
