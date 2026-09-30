// 错题池与复习部分的出题逻辑。不引 React、不引服务 —— 组件只负责画。
// 池是**单元内状态**:不持久化、不跨单元(简单部分与困难部分的错合并进同一个池),
// 由 `UnitEntry` 持有;退出到地图即随组件卸载丢弃。

import type { Block, BlockType } from './blocks'
import type { Level, Unit } from './levels'
import { wholeReviewQuestion } from './practice'
import { familyKey, slotsFor, type Placement, type Rng, type TrayBlock } from './rules'

/** 简单部分同一块被点错几次才进错题池。产品裁定值 N = 2(见 spec §3.5)。 */
export const WRONG_PICK_THRESHOLD = 2

/** 复习部分最多几道小题。产品裁定值(见 spec §3.7)。 */
export const MAX_REVIEW_QUESTIONS = 3

/** 复习部分托盘的块数上限 —— 正解与错解一起数。 */
export const REVIEW_TRAY_CAP = 4

/** 错题池:按入池顺序追加,后面的是最近点错的。 */
export type MistakePool = readonly Block[]

/** 块 id → 被点错的次数。 */
export type PickCounts = Readonly<Record<string, number>>

/** 入池去重的判据。 */
export type PoolKey = (b: Block) => string

/** 简单部分与复习部分:双身份块算同一块(canPlace 判它们通用)。 */
export const familyPoolKey: PoolKey = familyKey

/** 困难部分:那一部分的门禁只比类型,介母块与韵母块是两个真身份(spec §3.3 的例外)。 */
export const exactPoolKey: PoolKey = (b) => `${b.type}:${b.value}`

/**
 * 记一次「选中了错块」。计数按**块 id** —— 托盘里那一块,一轮之内身份稳定;
 * 这样「同一块被点两次」才算数,而不是「同样点错两块不同的 p」凑数。
 * `reached` 只在那一次为真(阈值上取等),避免同一块被反复入池。
 */
export function notePick(counts: PickCounts, blockId: string): { counts: PickCounts; reached: boolean } {
  const n = (counts[blockId] ?? 0) + 1
  return { counts: { ...counts, [blockId]: n }, reached: n === WRONG_PICK_THRESHOLD }
}

/** 把块加进错题池(按 key 去重,保序:后进的在后 = 最近点错的)。 */
export function addToPool(pool: MistakePool, blocks: readonly Block[], key: PoolKey = familyPoolKey): MistakePool {
  const seen = new Set(pool.map(key))
  const out = [...pool]
  for (const block of blocks) {
    const k = key(block)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(block)
  }
  return out
}

/** 复习部分的一道小题。 */
export type ReviewQuestion = Readonly<{
  /** `'block'` = 考某一类块(挖空该类型的槽);`'whole'` = 池空时照考本关整题(所有槽挖空)。 */
  kind: 'block' | 'whole'
  /** `kind === 'block'` 时考的是哪一类。单测与调试用,UI 不读。 */
  blockType?: BlockType
  /** 要挖空的槽。其余槽用 `prefill` 里的正确块预填。 */
  slotIds: readonly string[]
  /** slotId → blockId。**这些槽在复习部分不能拿回**(不绑 onClick,见 spec §3.7)。 */
  prefill: Placement
  /** 本小题的托盘:含全部正解,以及(尽量)至少一块错解。 */
  tray: readonly TrayBlock[]
}>

/** 复习部分的一道小题,以及它挂在哪道题上(`levelIndex` = 在 `Unit.levels` 里的下标)。 */
export type PartReviewItem = Readonly<{
  levelIndex: number
  question: ReviewQuestion
}>

/**
 * 一道「挖空某一题某一类型」的小题。纯函数、**不掷骰子** —— 同一批入参恒产出等值对象。
 *
 * 这一点是**承重的**:宿主把整部分的小题在进部分时算一次(见 `partReviewQuestions`),
 * 之后不再重算;万一被重算(React 的 `useMemo` 不保证不重跑),块 id 与 prefill 必须与旧的一致,
 * 否则盘面(只初始化一次的 `placement`)会与托盘失配 —— 屏幕上就是「块放不进去」。
 *
 * - 挖空该题里**该类型的全部**槽,其余槽用正确块预填(预填槽在复习部分里拿不回来);
 * - 托盘 = 这些槽的正解(含重复,少一块就无解)+ 池里该类型的错块(家族去重);
 * - 预填块也在 `tray` 里(渲染层靠它找块),但**不计入** `REVIEW_TRAY_CAP` —— 上限管的是屏上看得见的那几块;
 * - 某错块的家族键与该小题的可见块相同时**不进托盘** —— 两块一模一样不是难度,是坏题。
 */
export function reviewQuestionFor(
  level: Level,
  type: BlockType,
  pool: MistakePool,
  qi: number,
): ReviewQuestion {
  const slots = slotsFor(level)
  const empty = slots.filter((s) => s.type === type)
  const rest = slots.filter((s) => s.type !== type)

  const tray: TrayBlock[] = empty.map((s, i) => ({ type: s.type, value: s.value, id: `q${qi}-c${i}` }))
  // 显式记下哪些块是**可见**的(正解与错解),不去反查 prefill —— 后者是同形块更容易出错。
  const visible = new Set(tray.map((t) => t.id))
  const prefill: Record<string, string> = {}
  rest.forEach((s, i) => {
    const id = `q${qi}-p${i}`
    tray.push({ type: s.type, value: s.value, id })
    prefill[s.id] = id
  })

  const taken = new Set(tray.filter((t) => visible.has(t.id)).map(familyKey))
  const room = Math.max(0, REVIEW_TRAY_CAP - empty.length)
  let added = 0
  // 池是追加的 ⇒ 倒序取 = 最近点错的优先。
  for (let i = pool.length - 1; i >= 0; i--) {
    if (added >= room) break
    const block = pool[i] as Block
    if (block.type !== type) continue
    if (taken.has(familyKey(block))) continue
    taken.add(familyKey(block))
    tray.push({ ...block, id: `q${qi}-w${added}` })
    added += 1
  }

  return { kind: 'block', blockType: type, slotIds: empty.map((s) => s.id), prefill, tray }
}

/**
 * 一个单元的复习部分:从池里取类型,**一个类型一道小题**,最多 `MAX_REVIEW_QUESTIONS` 道。
 *
 * 一道小题挂在哪道题上 = **本单元第一道含该类型槽的题**(`unit.levels` 顺序,含困难题)。
 * 今天「复习关自己就是那道题」,部分化后池跨整个单元,必须重定这条;取「第一道含该槽的题」
 * 让题面选择可预期,而且**不必在池里存题号**(池只存块)。
 *
 * 池空 ⇒ 照考本单元第一道题的整题。池里的类型在本单元找不到槽 ⇒ 跳过它(不产出半道题)。
 */
export function partReviewQuestions(
  unit: Unit,
  unitIndex: number,
  pool: MistakePool,
  rng: Rng = Math.random,
): PartReviewItem[] {
  const levels = unit.levels
  const first = levels[0]
  if (!first) return []

  // 最近点错的类型排前面 —— 池是追加的,故倒序;同一家族只留最近那一次。
  const recent: Block[] = []
  const seenFamily = new Set<string>()
  for (let i = pool.length - 1; i >= 0; i--) {
    const block = pool[i] as Block
    const key = familyKey(block)
    if (seenFamily.has(key)) continue
    seenFamily.add(key)
    recent.push(block)
  }

  const out: PartReviewItem[] = []
  for (const block of recent) {
    if (out.length >= MAX_REVIEW_QUESTIONS) break
    if (out.some((item) => item.question.blockType === block.type)) continue
    const levelIndex = levels.findIndex((level) => slotsFor(level).some((s) => s.type === block.type))
    if (levelIndex < 0) continue
    out.push({ levelIndex, question: reviewQuestionFor(levels[levelIndex] as Level, block.type, pool, out.length) })
  }

  // 兜底只在**池本身为空**时触发:池非空但类型在本单元全表里都找不到槽 ⇒ 返回空数组(不产出半道题)。
  if (recent.length === 0) {
    return [{ levelIndex: 0, question: { kind: 'whole', prefill: {}, ...wholeReviewQuestion(first, unitIndex, rng) } }]
  }
  return out
}
