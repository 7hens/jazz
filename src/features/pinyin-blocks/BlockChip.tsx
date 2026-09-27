import { TONE_PATH, type BlockType } from './blocks'
import { cn } from '@/shared/ui/utils'

const TYPE_CLASS: Record<BlockType, string> = {
  initial: 'pblock--initial',
  medial: 'pblock--medial',
  final: 'pblock--final',
  nasal: 'pblock--nasal',
  tone: 'pblock--tone',
}

/** 声调不印字符:ˉ ˊ ˇ ˋ 在小圆里会糊成 - ~ ^,孩子认不出。画走势线 = 课本上那个形状。 */
function ToneGlyph({ value }: { value: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={TONE_PATH[value] ?? TONE_PATH['1'] ?? ''} />
    </svg>
  )
}

/**
 * 块面字形。`dotsAway` 时写**去点后**的字形(`ü` → `u`、`üe` → `ue`),两点叠在第一个字母上飞走
 * —— 孩子看到的就是「j q x y 把两点带走了」。
 *
 * 两点不是字符(`ü` 是一个字符),故用**一个**元素画两个圆点(`box-shadow` 复制一份):
 * 少一层 DOM,也免了两个点各自对齐时的漂移。在位槽里块面尺寸由调用方的 className 定死,不随字形变。
 *
 * 减弱动效由 `index.css` 顶部那条全局 `prefers-reduced-motion` 规则接管
 * (`animation-duration: 0.01ms`),动画瞬间落到终态 = 直接显示去点后的结果,不另写一条。
 */
function renderGlyph(value: string, dotsAway: boolean | undefined) {
  if (!dotsAway || !value.startsWith('ü')) return value
  return (
    <span className="pb-glyph">
      {`u${value.slice(1)}`}
      <span className="pb-dot" aria-hidden="true" />
    </span>
  )
}

export type BlockChipProps = {
  /** 块类。入槽后传的是「槽位类型」—— 颜色跟着位置走,站在介母位才穿那身过渡色。 */
  type: BlockType
  value: string
  placed?: boolean
  dim?: boolean
  welded?: boolean
  /** 这一块的两点该飞走(j q x y 之后拼 ü)。由调用方用 `losesDots` 判 —— 组件不重算结构。 */
  dotsAway?: boolean
  disabled?: boolean
  className?: string
  onClick?: () => void
  'data-block-id'?: string
}

/**
 * 积木块的唯一渲染点。尺寸与间距**大多**由调用方用 Tailwind 给 —— 字号除外:本组件自带兜底
 * (`text-[1.75rem]`,声调块 `text-[1.35rem]`),调用方 `className` 里的字号是**覆盖**它
 * (地图名片那档就靠这个覆盖把 u7 收进格子里)。颜色/厚度/圆角全在 index.css 的
 * `.pblock` 一族里(走 token,禁颜色字面量)。
 */
export function BlockChip({
  type,
  value,
  placed,
  dim,
  welded,
  dotsAway,
  disabled,
  className,
  onClick,
  ...rest
}: BlockChipProps) {
  const isTone = type === 'tone'
  return (
    <div
      onClick={onClick}
      className={cn(
        'pblock font-extrabold',
        TYPE_CLASS[type],
        placed && 'pblock--placed',
        dim && 'pblock--dim',
        welded && 'pblock--welded',
        disabled && 'pblock--dim',
        isTone ? 'text-[1.35rem]' : 'text-[1.75rem]',
        className,
      )}
      data-type={type}
      data-value={value}
      aria-hidden={placed ? undefined : true}
      {...rest}
    >
      {isTone ? <ToneGlyph value={value} /> : renderGlyph(value, dotsAway)}
    </div>
  )
}
