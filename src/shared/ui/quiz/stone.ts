import { cn } from '@/shared/ui/utils'

/** 词石状态。reveal(双错后亮出正确答案)与 correct 同形 —— 视觉上都表示「这块是对的」。 */
export type StoneState = 'idle' | 'selected' | 'correct' | 'wrong' | 'muted'

const STONE_BASE =
  'relative flex min-h-[84px] flex-col items-center justify-center gap-1.5 border-2 px-3 py-3 text-center transition-colors'

/** 选中/答对的上浮位移(px)。只能经 motion 的 `animate={{ y }}` 用 —— 裸 Tailwind `translate-y-*`
 *  会(1)逃逸 App 的 MotionConfig reducedMotion 兜底,(2)在 cn()/tailwind-merge 里与 stoneOffset 互吞。 */
export const STONE_LIFT = -3

/* 三态底色 = **不透明 tint**:把语义色按「旧 alpha 的同一比例」混进主题自身的 `--color-surface`。
 * 为什么必须不透明:`ScenePanel`(`stage.tsx:135`)与词课/冷启动的题区都没有底色,词石直接压在
 * `StageSky` 渐变上 —— alpha 底会透出舞台,night/dark 档下文字对比度随氛围漂移(与 Fix 2 的胶囊同病)。
 * 为什么用 color-mix 而非 `bg-surface`:spec §5 明写「选项-选中 = 石发光」用 `accent-tint`,
 * 抹成白底 = 拿对比度 bug 换设计回归。混进 surface 后:亮色主题下观感与旧 alpha-on-white 几乎一致,
 * 暗色主题下色相保留、底色不透明 → 对比度与舞台解耦。16% / 10% / 14% 即旧
 * `accent-tint` / `emerald/10` / `red-tint` 的亮色 alpha 值。
 * ⚠ 这三条任意值必须**逐字写在状态表里**,不得抽成函数/模板拼接 —— Tailwind 的内容扫描器只认
 * 源码里的字面量,拼出来的类名不会进 CSS(实测:抽成 helper 后产物里这三条规则数量为 0)。
 * 注意本注释本身也会被扫描:此处刻意不写出可被识别的类名写法,否则产物会多出一条用不到的规则。 */
const STONE_STATE: Record<StoneState, string> = {
  // 静止态即抬升:默认词石读作「凸起的物件」而非平贴卡;hover 只改描边,不再补阴影。
  idle: 'border-hairline bg-surface text-ink shadow-card hover:border-accent/60',
  selected:
    'border-accent bg-[color-mix(in_srgb,var(--color-accent)_16%,var(--color-surface))] text-ink shadow-card ring-2 ring-accent/40',
  correct:
    'border-emerald/70 bg-[color-mix(in_srgb,var(--color-emerald)_10%,var(--color-surface))] text-ink ring-2 ring-emerald/30',
  // 文字用 text-ink 而非 text-red:亮色主题下 text-red #ef4444 在任何比 #000 亮的底上都到不了
  // 4.5:1(上限 3.763:1,压在纯白上)—— 详见 final-fix-report.md「Fix 7」。红语义由
  // border-red + 红底 + ✗ 角标(bg-red/白字)三重承载,色彩冗余不缺。
  wrong: 'border-red bg-[color-mix(in_srgb,var(--color-red)_14%,var(--color-surface))] text-ink',
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
