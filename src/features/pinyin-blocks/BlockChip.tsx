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
  /** 显示的块类。双身份块入槽后由槽位定型,故这里传的是「槽位类型」而非块自身类型。 */
  type: BlockType
  value: string
  /** 盘中未定型:斜纹提示 i/u/ü 两边都能放。 */
  dual?: boolean
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
  dual,
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
        dual && 'pblock--dual',
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
