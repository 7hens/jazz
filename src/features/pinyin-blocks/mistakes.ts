// 错题池与复习小题的纯逻辑。不引 React、不引服务 —— 组件只负责画。
// 池是**关内状态**:不持久化、不跨关(产品裁定「复习段只考本关」)。

import type { Block, BlockType } from './blocks'
import type { Level } from './levels'
import { buildBlocks, familyKey, slotsFor, type Placement, type Rng, type TrayBlock } from './rules'

/** 简单段同一块被点错几次才进错题池。产品裁定值 N = 2(见 spec §3.5)。 */
export const WRONG_PICK_THRESHOLD = 2

/** 复习段最多几道小题。产品裁定值(见 spec §3.7)。 */
export const MAX_REVIEW_QUESTIONS = 3

/** 复习段托盘的块数上限 —— 正解与错解一起数。 */
export const REVIEW_TRAY_CAP = 4

/** 错题池:按入池顺序追加,后面的是最近点错的。 */
export type MistakePool = readonly Block[]

/** 块 id → 被点错的次数。 */
export type PickCounts = Readonly<Record<string, number>>

/** 入池去重的判据。 */
export type PoolKey = (b: Block) => string

/** 简单段与复习段:双身份块算同一块(canPlace 判它们通用)。 */
export const familyPoolKey: PoolKey = familyKey

/** 困难段:那一段的门禁只比类型,介母块与韵母块是两个真身份(spec §3.3 的例外)。 */
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

/** 复习段的一道小题。 */
export type ReviewQuestion = Readonly<{
  /** `'block'` = 考某一类块(挖空该类型的槽);`'whole'` = 池空时照考本关整题(所有槽挖空)。 */
  kind: 'block' | 'whole'
  /** `kind === 'block'` 时考的是哪一类。单测与调试用,UI 不读。 */
  blockType?: BlockType
  /** 要挖空的槽。其余槽用 `prefill` 里的正确块预填。 */
  slotIds: readonly string[]
  /** slotId → blockId。**这些槽在复习段不能拿回**(不绑 onClick,见 spec §3.7)。 */
  prefill: Placement
  /** 本小题的托盘:含全部正解,以及(尽量)至少一块错解。 */
  tray: readonly TrayBlock[]
}>

/**
 * 复习小题的推导(纯函数)。
 *
 * - 错块按**家族键**去重,同一类型合成一道小题,最多 MAX_REVIEW_QUESTIONS 道(最近的优先);
 * - 每道小题挖空本关中该类型的**所有**槽,其余槽用正确块预填 —— 复用本关的图与音节;
 * - 托盘 = 这些槽的正解(含重复,少一块就无解)+ 该类型下点错过的块(家族去重),
 *   预填块也在这个数组里但**不计入** REVIEW_TRAY_CAP —— 上限管的是屏上看得见的那几块;
 * - 某错块的家族键与该小题的可见块相同时**不进托盘** —— 两块一模一样不是难度,是坏题;
 * - **池空时照考整题**(产品裁定「三段结构恒定」,不存在「这一关只有两段」)。
 */
export function reviewQuestions(
  level: Level,
  unit: number,
  pool: MistakePool,
  rng: Rng = Math.random,
): ReviewQuestion[] {
  const slots = slotsFor(level)

  // 最近点错的排前面 —— 池是追加的,故倒序;同一家族只留最近那一次。
  const recent: Block[] = []
  const seenFamily = new Set<string>()
  for (let i = pool.length - 1; i >= 0; i--) {
    const block = pool[i] as Block
    const key = familyKey(block)
    if (seenFamily.has(key)) continue
    seenFamily.add(key)
    recent.push(block)
  }

  const types: BlockType[] = []
  for (const block of recent) {
    if (!types.includes(block.type)) types.push(block.type)
  }

  if (types.length === 0) {
    // 池空:照考本关整题 —— 所有槽挖空,托盘同简单段。
    const tray: TrayBlock[] = buildBlocks(level, unit, rng).map((b, i) => ({ ...b, id: `q0-${i}` }))
    return [{ kind: 'whole', slotIds: slots.map((s) => s.id), prefill: {}, tray }]
  }

  return types.slice(0, MAX_REVIEW_QUESTIONS).map((type, qi) => {
    const empty = slots.filter((s) => s.type === type)
    const rest = slots.filter((s) => s.type !== type)

    // 正解:挖空的每个槽各一块(含重复 —— 双音节两个韵母槽就要两块)。
    const tray: TrayBlock[] = empty.map((s, i) => ({ type: s.type, value: s.value, id: `q${qi}-c${i}` }))
    // 显式记下哪些块是**可见**的(正解与错解),不去反查 prefill —— 后者是同形块更容易出错。
    const visible = new Set(tray.map((t) => t.id))
    const prefill: Record<string, string> = {}
    rest.forEach((s, i) => {
      const id = `q${qi}-p${i}`
      tray.push({ type: s.type, value: s.value, id })
      prefill[s.id] = id
    })

    // 错解:同一类型、且与可见块**不同家族**(不出现两块分不开的同形块)。
    // 名额按**可见**块算 —— 预填块也在这个数组里(渲染层靠它找块),把它们算进名额就永远是负的。
    const taken = new Set(tray.filter((t) => visible.has(t.id)).map(familyKey))
    const room = Math.max(0, REVIEW_TRAY_CAP - empty.length)
    let added = 0
    for (const block of recent) {
      if (added >= room) break
      if (block.type !== type) continue
      if (taken.has(familyKey(block))) continue
      taken.add(familyKey(block))
      tray.push({ ...block, id: `q${qi}-w${added}` })
      added += 1
    }

    return { kind: 'block', blockType: type, slotIds: empty.map((s) => s.id), prefill, tray }
  })
}
