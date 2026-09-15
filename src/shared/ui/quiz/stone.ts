import { cn } from '@/shared/ui/utils'

/** 词石状态。reveal(双错后亮出正确答案)与 correct 同形 —— 视觉上都表示「这块是对的」。 */
export type StoneState = 'idle' | 'selected' | 'correct' | 'wrong' | 'muted' | 'gold' | 'slot'

/** 布局/间距走 Tailwind 工具类(字面量,扫描器认);材质走 index.css 的 .stone--<态> 普通类。
 *  间距 10px / min-h 92px 见 spec D7;禁固定 height → 2× 文字缩放不截字。 */
const STONE_BASE =
  'relative flex min-h-[92px] flex-col items-center justify-center gap-2.5 px-3 py-3 text-center transition-colors'

/** 选中/答对的上浮位移(px)。只能经 motion 的 `animate={{ y }}` 用 —— 裸 Tailwind `translate-y-*`
 *  会(1)逃逸 App 的 MotionConfig reducedMotion 兜底,(2)在 cn()/tailwind-merge 里与 stoneOffset 互吞。 */
export const STONE_LIFT = -4

/* ⚠ 材质**不进这里**。上一轮把 color-mix 任意值写在此处,产物规则数与 helper 抽法有关、极易归零,
 *  而 npm test 与 npm run lint 全绿 —— 只有 npm run build 查产物 CSS 才暴露。
 *  现在这里只拼「普通类名」,颜色/厚度/发光全部在 index.css,由 token 覆盖接管暗色模式。
 *  七态各写一条字面量(不拼模板字符串):读起来即状态表,与 CSS 段一一对应。 */
const STONE_MATERIAL: Record<StoneState, string> = {
  idle: 'stone stone--idle',
  selected: 'stone stone--selected',
  correct: 'stone stone--correct',
  wrong: 'stone stone--wrong',
  muted: 'stone stone--muted',
  gold: 'stone stone--gold',
  slot: 'stone stone--slot',
}

/** 两列不同圆角半径:同一词石在左右两列外形不同,破「等距方阵」的答题卡感。 */
const STONE_SHAPE = ['rounded-3xl', 'rounded-[1.75rem] rounded-tr-md'] as const

export function stoneClass(state: StoneState, index = 0): string {
  return cn(STONE_BASE, STONE_SHAPE[index % STONE_SHAPE.length], STONE_MATERIAL[state])
}

/** 错落:奇数列整体下移,破坏逐行等距。 */
export function stoneOffset(index: number): string {
  return index % 2 === 1 ? 'translate-y-1.5' : ''
}

/** 色彩冗余:对错/炼成在红绿之外再给形状(约 8% 男性红绿色盲看不出红=错)。无冗余态返回 null。 */
export function stoneMark(state: StoneState): '✓' | '✗' | '⭐' | null {
  if (state === 'correct') return '✓'
  if (state === 'wrong') return '✗'
  if (state === 'gold') return '⭐'
  return null
}

export function stoneMarkClass(state: StoneState): string {
  if (state === 'correct') return 'bg-emerald text-white'
  if (state === 'wrong') return 'bg-red text-white'
  if (state === 'gold') return 'bg-gold text-gold-ink'
  return ''
}
