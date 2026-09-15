import { cn } from '@/shared/ui/utils'

/** 词石状态。reveal(双错后亮出正确答案)与 correct 同形 —— 视觉上都表示「这块是对的」。 */
export type StoneState = 'idle' | 'selected' | 'correct' | 'wrong' | 'muted'

const STONE_BASE =
  'relative flex min-h-[84px] flex-col items-center justify-center gap-1.5 border-2 px-3 py-3 text-center transition-colors'

const STONE_STATE: Record<StoneState, string> = {
  idle: 'border-hairline bg-surface text-ink hover:border-accent/60 hover:shadow-card',
  selected: 'border-accent bg-accent-tint text-ink shadow-card ring-2 ring-accent/40',
  correct: 'border-emerald/70 bg-emerald/10 text-ink ring-2 ring-emerald/30',
  wrong: 'border-red bg-red-tint text-red',
  muted: 'border-hairline bg-surface-2 text-ink-2',
}

/** 两列不同圆角半径:同一词石在左右两列外形不同,破「等距方阵」的答题卡感。 */
const STONE_SHAPE = ['rounded-3xl', 'rounded-[1.75rem] rounded-tr-md'] as const

export function stoneClass(state: StoneState, index = 0): string {
  return cn(STONE_BASE, STONE_SHAPE[index % STONE_SHAPE.length], STONE_STATE[state])
}

/** 错落:奇数列整体下移,破坏逐行等距。 */
export function stoneOffset(index: number): string {
  return index % 2 === 1 ? 'translate-y-1.5' : ''
}

/** 色彩冗余:对错在红绿之外再给形状(约 8% 男性红绿色盲看不出红=错)。无冗余态返回 null。 */
export function stoneMark(state: StoneState): '✓' | '✗' | null {
  if (state === 'correct') return '✓'
  if (state === 'wrong') return '✗'
  return null
}

export function stoneMarkClass(state: StoneState): string {
  if (state === 'correct') return 'bg-emerald text-white'
  if (state === 'wrong') return 'bg-red text-white'
  return ''
}
