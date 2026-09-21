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

export type BlockChipProps = {
  /** 块类。入槽后传的是「槽位类型」—— 颜色跟着位置走,站在介母位才穿那身过渡色。 */
  type: BlockType
  value: string
  placed?: boolean
  dim?: boolean
  welded?: boolean
  disabled?: boolean
  className?: string
  onClick?: () => void
  'data-block-id'?: string
}

/**
 * 积木块的唯一渲染点。尺寸与间距由调用方用 Tailwind 给,颜色/厚度/圆角全在 index.css 的
 * `.pblock` 一族里(走 token,禁颜色字面量)。
 */
export function BlockChip({
  type,
  value,
  placed,
  dim,
  welded,
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
      {isTone ? <ToneGlyph value={value} /> : value}
    </div>
  )
}
