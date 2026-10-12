// 脚手架遍的题源:简单部分每道题的**第一遍** —— 非目标槽预填锁定,只挖目标那一类块。
// 与 `practice.ts`(整题重考)、`rules.ts` 的 `buildBlocks`(全拼遍)是三条各自独立的题源:
// 这里既不调 `buildBlocks`,也不改它 —— 脚手架遍只用到一类块,那个按「用到哪几类摊给哪几类」
// 分配的干扰块 cap 落不到这一类上(spec §2.5)。
// 纯函数 + 注入 rng,不引 React、不引服务 —— 组件只负责画和收手势。

import { CONFUSABLE, type Block, type BlockType } from './blocks'
import { focusTypeOf, taughtBlocks, type Level } from './levels'
import { slotsFor, toneBlocks, type Placement, type Rng, type TrayBlock } from './rules'

/**
 * focus 型托盘的**总块数**上限:1 正解 + 3 干扰,与 `CONFUSABLE` 的最小对立对密度相称。
 *
 * **不适用于 `'tone'` 型**(spec §2.5):声调托盘的块数由**正解块数**决定 ——
 * 双音节同调题(`xī guā` 两个一声)需要**两块**一声才无解,而 `SCAFFOLD_TRAY_CAP = 4`
 * 恰好会把它切到 4 块、切掉一块正解 ⇒ 那个音节永远填不满。两者是不同的旋钮,不能共用一个 cap。
 * 那条硬约束(声调型正解块数恒 ≥ 空槽数)在 `scaffold.test.ts` 里逐题断言。
 */
export const SCAFFOLD_TRAY_CAP = 4

/**
 * 脚手架遍里的一道题。与 `PracticeQuestion` 同构,但**多一个 `prefill`** ——
 * 练习恒是全槽挖空无预填(spec §3.5),预填机制只走本文件这条路。
 *
 * 挖哪一类:`'focus'` 挖本单元新教的那一类块(spec §2.2),`'tone'` 恒挖全部声调槽(spec §2.2b)。
 */
export type ScaffoldQuestion = Readonly<{
  /** 要挖空的槽:恒等于本题**全部**目标类型槽(不变量 5 的另一半在 `prefill`)。 */
  readonly slotIds: readonly string[]
  /**
   * 预填锁定:slotId → blockId。**其余全部槽**都在这里,故 `slotIds ∪ prefill 的键` 恒等于全部槽。
   *
   * 预填块恒不可拿回(组件层 `placeBlock` / `takeBack` / 槽位 `onClick` 三处门禁,spec §2.4 / §3.2)。
   */
  readonly prefill: Placement
  /**
   * 托盘。**含预填块** —— 组件靠 `tray.find(b => b.id === ...)` 反查块
   * (`renderSlot` 与 `wrongSlotIds` 都是这条),没放进去就画不出来。
   * 被 `placement` 占用的块会被 `liveBlocks` 滤掉,故它们不会出现在托盘可视列表里。
   */
  readonly tray: readonly TrayBlock[]
}>

/**
 * 这道题跑哪种脚手架遍 —— 两型共用同一个 `scaffold` 入参,差别**只在**这里算出的空槽与托盘(spec §3.1 末)。
 *
 * - `'focus'`:`focusTypeOf(unitIndex)` 有类型、且**这道题有该类型的槽**(u1–u9);
 * - `'tone'`:`focusTypeOf(unitIndex)` 返 `null` 时恒走声调遍(u10–u12,spec §2.2b);
 * - `null`:这道题**不产生脚手架遍**,只跑全拼遍。
 *
 * 返回 `null` 有两个口子:① 有 focus 类型但**题里没有该类槽** —— 「该题无该类槽的兜底」
 * (spec §2.3)。今天 u1–u9 的每一道简单题都踩不到(u6 的 nasal 5/5 是**数据碰巧**),
 * 这条是防御:将来加一关 `u6-60`(某个纯 `an` 的词)没有 nasal 槽,它必须自动退成单遍,
 * 而不是渲染出「预填了 final 却没槽可挖」的怪盘面(不变量 7)。② 连 tone 槽都没有的题 ——
 * `slotsFor` 对每个音节**无条件**产一个 tone 槽(spec §2.2b),故这一路实际不可达。
 */
export function scaffoldKindOf(level: Level, unitIndex: number): 'focus' | 'tone' | null {
  const slots = slotsFor(level)
  const focus = focusTypeOf(unitIndex)
  if (focus !== null) return slots.some((s) => s.type === focus) ? 'focus' : null
  return slots.some((s) => s.type === 'tone') ? 'tone' : null
}

/**
 * 脚手架遍的落库键 = `${levelId}s`(spec §2.6 的裁定 C)。
 *
 * 「脚手架遍落库、全拼遍覆盖」用**换键**实现,零 merge 改动 —— 三层 merge 全是 `Math.max`,
 * 改它会撞「只升不降」这条事故后的铁律。两个键的效果与「同键被覆盖」完全等价:
 * 正式那道题的星级只由全拼遍决定,脚手架遍的成绩写在别处,不遮蔽任何东西。
 *
 * 已是 `h` 键时(`u2-0h` → `u2-0hs`)**这条路径不该被走到** —— 困难部分不做脚手架遍(spec §7:
 * 那一部分的门禁是 `sameTypeOnly`,预填与「值可以错」的考点直接冲突)。这里只是防御:
 * 真走到也不会静默拼出一个认不下的键。
 */
export function scaffoldLevelIdOf(levelId: string): string {
  return `${levelId}s`
}

/**
 * `rules.ts` 的 `shuffle` 未导出、且那里一个字都不许改(spec §2.5),
 * 所以这里带一份自己的。**算法逐行照抄** —— 两处洗牌的口径必须一样,否则同一颗种子
 * 在全拼遍和脚手架遍洗出的顺序会不一致,那样的「可复现」只是各自可复现。
 */
function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const ai = a[i] as T
    a[i] = a[j] as T
    a[j] = ai
  }
  return a
}

/**
 * 脚手架遍的一道题。**返 `null` = 这题不跑脚手架遍**(见 `scaffoldKindOf`)。
 *
 * **纯函数**(除注入的 rng)—— 同一批入参 + 同一种子恒等值。这与 `wholeReviewQuestion`
 * 是同一条承重要求:组件把 `placement` 初始化成 `prefill` 之后**不再重算**,万一被重算
 * (React 的 `useMemo` 不保证不重跑),块 id 与托盘必须与旧的一致,否则盘面与托盘失配 ——
 * 屏幕上就是「块放不进去」。
 *
 * 块 id 分两段(照抄被删复习段的手法,spec §3.2):预填块 `p{i}`、托盘块 `q0-{j}`。
 */
export function scaffoldQuestion(
  level: Level,
  unitIndex: number,
  rng: Rng = Math.random,
): ScaffoldQuestion | null {
  const kind = scaffoldKindOf(level, unitIndex)
  if (kind === null) return null
  const focus: BlockType = kind === 'focus' ? (focusTypeOf(unitIndex) as BlockType) : 'tone'
  const slots = slotsFor(level)
  const open = slots.filter((s) => s.type === focus)
  const given = slots.filter((s) => s.type !== focus)

  // 预填块走 `p{i}` 独立段,并**同时进托盘** —— 组件要靠 tray 反查它(spec §2.5 末)。
  const prefill: Record<string, string> = {}
  const tray: TrayBlock[] = given.map((s, i) => {
    const id = `p${i}`
    prefill[s.id] = id
    return { type: s.type, value: s.value, id }
  })
  const push = (b: Block): void => void tray.push({ ...b, id: `q0-${tray.length}` })

  if (kind === 'tone') {
    // 声调型:托盘**原样**用 `toneBlocks(level)`(spec §2.5)—— 它已经是「四声恒全出 +
    // 按需重复正解块」的现成纯函数,声调**不套** `SCAFFOLD_TRAY_CAP`(见该常量注释)。
    // `CONFUSABLE.tone` 恒空:四个调是四个完全不同的形状,声调遍**没有**最小对立干扰(spec §2.2b)。
    for (const b of toneBlocks(level)) push(b)
    return { slotIds: open.map((s) => s.id), prefill, tray }
  }

  // focus 型:挖空槽各要一块正解(**含重复**,按槽序 —— 双音节词里两块 `n` 是两个槽两块块)。
  for (const s of open) push({ type: s.type, value: s.value })

  // 干扰块:只从「该单元及之前课程里出现过的块」里取 —— 池子由课程数据派生,零硬编码,
  // 没教过的块不该出现在题面上(spec §2.5)。易混伙伴优先,洗牌口径照 `buildBlocks`(rules.ts:184-189)。
  const used = new Set(open.map((s) => s.value))
  const pool: string[] = []
  const seen = new Set<string>()
  for (const b of taughtBlocks(unitIndex)) {
    if (b.type !== focus || used.has(b.value)) continue
    const key = `${focus}:${b.value}`
    if (seen.has(key)) continue
    seen.add(key)
    pool.push(b.value)
  }
  const friends = new Set(open.flatMap((s) => CONFUSABLE[focus][s.value] ?? []))
  const near = pool.filter((v) => friends.has(v))
  const far = pool.filter((v) => !friends.has(v))
  // 易混伙伴放在游标**尾部**、取块走 pop()(取尾),于是伙伴先被取走 —— 抄 `buildBlocks` 的形状,只跑一类。
  // ⚠ 必须是 pop() 而不是 slice(0, n):从头部切会全落在 far 段里,易混伙伴**永远取不到**
  // (今天 u2-0 的 b 就会拿到 d/m/f 而不是 p)—— 最小对立对正是这道题的全部难度来源。
  const cursor = [...shuffle(far, rng), ...shuffle(near, rng)]
  // 「恒 ≥1 个干扰块」(一个类型的托盘只有正解 = 没有选择,那就不是难度,spec §2.5);
  // 但**池子本身不足时如实给几块给几块**,绝不为凑数造一个没教过的块 —— 故这里是 break 而不是循环到底。
  const want = Math.max(1, SCAFFOLD_TRAY_CAP - open.length)
  for (let got = 0; got < want; got++) {
    const value = cursor.pop()
    if (value === undefined) break
    push({ type: focus, value })
  }

  return { slotIds: open.map((s) => s.id), prefill, tray }
}

