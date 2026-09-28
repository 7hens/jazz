// 积木玩法的纯逻辑:槽位生成 / 干扰块 / 放置判定。可注入 rng 保证测试确定性。
// 不引 React、不引服务 —— 组件只负责画和收手势。

import { CONFUSABLE, DUAL_VALUES, TONE_VALUES, type Block, type BlockType } from './blocks'
import { taughtBlocks, type Level } from './levels'

/** 一个凹槽。声调槽额外带 anchor —— 它骑在哪个槽上方(韵腹 / 整体块)。 */
export type Slot = {
  readonly id: string
  readonly type: BlockType
  readonly value: string
  readonly sylIdx: number
  readonly anchor?: string
  readonly weld?: boolean
}

/** 带 id 的积木(UI 需要稳定 key,故 id 由调用方在托盘构建时贴)。 */
export type TrayBlock = Block & { readonly id: string }

/** slotId → blockId。 */
export type Placement = Readonly<Record<string, string>>

export type Rng = () => number

/** 一个音节按序摊开的槽位;声调槽恒骑在韵腹(final)上方。 */
export function slotsFor(level: Level): Slot[] {
  const out: Slot[] = []
  level.syl.forEach((syl, si) => {
    const head = `s${si}`
    if (syl.initial !== undefined) {
      out.push({ id: `${head}-i`, type: 'initial', value: syl.initial, sylIdx: si, weld: syl.weld })
    }
    if (syl.medial !== undefined) {
      out.push({ id: `${head}-m`, type: 'medial', value: syl.medial, sylIdx: si })
    }
    if (syl.final !== undefined) {
      out.push({ id: `${head}-f`, type: 'final', value: syl.final, sylIdx: si })
    }
    if (syl.nasal !== undefined) {
      out.push({ id: `${head}-n`, type: 'nasal', value: syl.nasal, sylIdx: si })
    }
    out.push({ id: `${head}-t`, type: 'tone', value: String(syl.tone), sylIdx: si, anchor: `${head}-f` })
  })
  return out
}

/**
 * 块能否进这个槽:值必须相等;类型相等,或者是 i/u/ü 的介母↔韵母互换。
 * 双身份是刻意的 —— jia 里的 i 是介母,bin 里的 i 是韵腹,同一个字母两个身份。
 */
export function canPlace(block: Block, slot: Slot): boolean {
  if (block.value !== slot.value) return false
  if (block.type === slot.type) return true
  return (
    DUAL_VALUES.has(block.value) &&
    (block.type === 'medial' || block.type === 'final') &&
    (slot.type === 'medial' || slot.type === 'final')
  )
}

/**
 * 困难段的门禁:只比类型。值错了也放得进去 —— 这正是那一段的全部考点(spec §3.6)。
 *
 * 这是**第三个**判定函数,不是修改 canPlace(canPlace 一个字不动)。
 * 双身份块在这里**不通用**:介母槽只收介母块(青),韵母槽只收韵母块(绿),颜色上分得开。
 */
export function sameTypeOnly(block: Block, slot: Slot): boolean {
  return block.type === slot.type
}

/** 困难段每关允许的判错重试次数。用尽即本段失败 —— 但**不阻塞**,继续往下走(spec §3.6)。 */
export const HARD_RETRIES = 2

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

const keyOf = (b: Block): string => `${b.type}:${b.value}`

/**
 * 家族键:i / u / ü 只按值算,其余仍按「类型 + 值」。
 *
 * canPlace 对双身份块明确允许介母 ↔ 韵母互换 —— 也就是说 `medial:u` 与 `final:u`
 * 在孩子手里是**同一块积木**。按 keyOf 去重会留下两块一模一样的「u」,其中一块拖到
 * 某个槽上是「对」、另一块拖到同一个槽上也是「对」(spec §3.3)。
 *
 * **不能一律按值去重**:`initial:n`(声母 n,读「讷」)与 `nasal:n`(鼻尾 n,读「恩」)
 * 值相同但 canPlace 判它们**不通用**,是两个真身份 —— 它们同时出现在托盘里是刻意设计。
 * **困难段是例外**:那一段按类型严格比,介母块与韵母块是两个真身份,一律走 keyOf。
 */
export const familyKey = (b: Block): string => (DUAL_VALUES.has(b.value) ? b.value : keyOf(b))

/**
 * 每个槽各要一块 —— **含重复**。双音节词里 niú nǎi 要两块 n、huā duǒ 要两块介母 u、
 * xī guā 两个音节都是阴平要两块一声。去重会让后一个音节无块可放。
 */
export function requiredBlocks(level: Level): Block[] {
  return slotsFor(level)
    .filter((s) => s.type !== 'tone') // 声调块另行补齐(见 toneBlocks)
    .map((s) => ({ type: s.type, value: s.value }))
}

/** 去重后的正确块值集合,用于「干扰块不得与正确块重名」。 */
export function solutionValues(level: Level): Set<string> {
  return new Set(requiredBlocks(level).map(keyOf))
}

/**
 * 声调块:四种走势恒全出(让「选调」成立);某个调被要了几次就给几块。
 */
export function toneBlocks(level: Level): Block[] {
  const need = new Map<string, number>()
  for (const slot of slotsFor(level)) {
    if (slot.type !== 'tone') continue
    need.set(slot.value, (need.get(slot.value) ?? 0) + 1)
  }
  return TONE_VALUES.flatMap((value) =>
    Array.from({ length: Math.max(1, need.get(value) ?? 0) }, () => ({ type: 'tone', value })),
  )
}

/** 困难段的托盘参数:与简单段的 cap 是两个旋钮 —— 这里只拧「每个类型至少几块」。 */
export type BuildOptions = {
  /**
   * 困难段:每个用到的类型都给 ≥1 块对手,并让该类型总数至少 HARD_TRAY_PER_TYPE 块;
   * 门禁只比类型,去重按 keyOf(双身份块在那一段是两个真身份)。
   */
  readonly hard?: boolean
}

/**
 * 困难段每个用到的类型至少给几块。2 = 「正确块 + 至少一个对手」——
 * 一个类型只有一块等于没有选择,那就不是难度(spec §3.6)。
 *
 * 注意这是「该类型总数」的下限,不是「对手数」:正确块用了两块时(如 u7-0 的 x + g),
 * 仍要再给至少一块对手,取块公式 `Math.max(1, HARD_TRAY_PER_TYPE - need)` 正是为此。
 */
export const HARD_TRAY_PER_TYPE = 2

/**
 * 托盘积木 = 所需块(含重复) + 声调块 + 干扰块。
 * 干扰块总数封顶并按类型轮摊(**不是**每类各来 N 个,那样块数会炸);
 * 干扰块只从已解锁的池子里取 —— 还没教的块不该出现在题面上。
 * `opts.hard` 走另一套取块算法(每个用到的类型都给足对手),见 HARD_TRAY_PER_TYPE。
 */
export function buildBlocks(
  level: Level,
  unit: number,
  rng: Rng = Math.random,
  opts: BuildOptions = {},
): Block[] {
  const required = requiredBlocks(level)
  const tones = toneBlocks(level)
  // 简单段与复习段按家族去重(双身份块算同一块);困难段的门禁只比类型,那两身份是真的,按 keyOf。
  const dedupeKey: (b: Block) => string = opts.hard ? keyOf : familyKey
  const takenKeys = new Set([...required, ...tones].map(dedupeKey))
  const types = [...new Set(required.map((b) => b.type))]
  // 复习关的干扰块拉满 —— 难度的三件事之一(另两件:池天然混入前面单元的块、提示恒弱)。
  // 这里的 cap 管的是**干扰块总数**(题面有多挤);「挤在里面的块有多像」由 CONFUSABLE 管。
  const cap = level.review ? 5 : level.syl.length > 1 ? 2 : unit <= 1 ? 2 : 3

  // 干扰块只从「该单元及之前课程里出现过的块」里取 —— 池子由课程数据派生,零硬编码。
  const taught = new Map<BlockType, string[]>()
  for (const block of taughtBlocks(unit)) {
    const values = taught.get(block.type)
    if (values) values.push(block.value)
    else taught.set(block.type, [block.value])
  }

  const cursors = new Map<BlockType, string[]>()
  for (const type of types) {
    const used = new Set(required.filter((b) => b.type === type).map((b) => b.value))
    const pool = (taught.get(type) ?? []).filter((v) => !used.has(v))
    // 易混伙伴放在游标**尾部** —— 取块走 pop()(取尾),于是伙伴先被取走(spec §3.2)。
    // 伙伴先按 taughtBlocks 过滤过一遍:没教过的伙伴不进托盘。
    const friends = new Set(
      required.filter((b) => b.type === type).flatMap((b) => CONFUSABLE[type][b.value] ?? []),
    )
    const near = pool.filter((v) => friends.has(v))
    const far = pool.filter((v) => !friends.has(v))
    cursors.set(type, [...shuffle(far, rng), ...shuffle(near, rng)])
  }

  const extra: Block[] = []
  if (opts.hard) {
    // 困难段:每个用到的类型都给 ≥1 块对手,并让该类型总数至少 HARD_TRAY_PER_TYPE 块。
    // 用 while 而不是 for —— 撞上重复值时**不消耗名额**(那个 continue 白吃一格是这里最容易漏的地方)。
    for (const type of types) {
      const need = required.filter((b) => b.type === type).length
      const want = Math.max(1, HARD_TRAY_PER_TYPE - need)
      let got = 0
      while (got < want) {
        const value = cursors.get(type)?.pop()
        if (value === undefined) break
        const block: Block = { type, value }
        if (takenKeys.has(dedupeKey(block))) continue
        takenKeys.add(dedupeKey(block))
        extra.push(block)
        got += 1
      }
    }
  } else {
    for (let placed = 0; placed < cap; placed++) {
      // 每轮挑候选最多的那一类,避免某一类被抽空后失衡
      const candidates = types.filter((t) => (cursors.get(t)?.length ?? 0) > 0)
      if (candidates.length === 0) break
      candidates.sort((a, b) => (cursors.get(b)?.length ?? 0) - (cursors.get(a)?.length ?? 0))
      const type = candidates[0] as BlockType
      const value = cursors.get(type)?.pop()
      if (value === undefined) continue
      const block: Block = { type, value }
      if (takenKeys.has(dedupeKey(block))) continue
      takenKeys.add(dedupeKey(block))
      extra.push(block)
    }
  }

  return shuffle([...required, ...tones, ...extra], rng)
}

/** 每个槽都放上了块。 */
export function isComplete(slots: readonly Slot[], placement: Placement): boolean {
  return slots.every((s) => placement[s.id] !== undefined)
}

/**
 * 放错(值或类型不匹配)的槽 id。全空返回 []。
 * `judge` 默认 `canPlace`(简单段与复习段);困难段传 `sameTypeOnly` —— 那一段值错不算错。
 */
export function wrongSlotIds(
  slots: readonly Slot[],
  placement: Placement,
  tray: readonly TrayBlock[],
  judge: (block: Block, slot: Slot) => boolean = canPlace,
): string[] {
  const byId = new Map(tray.map((b) => [b.id, b]))
  const bad: string[] = []
  for (const slot of slots) {
    const blockId = placement[slot.id]
    if (blockId === undefined) continue
    const block = byId.get(blockId)
    if (!block || !judge(block, slot)) bad.push(slot.id)
  }
  return bad
}

/**
 * 简单段的点选路径:优先找类型完全相同的空槽,再退到双身份块的互换槽。找不到返回 null。
 * 困难段不走这里 —— 那一段的点选落位是 `autoTypeTargetId`(只认同类型)。
 */
export function autoTargetId(block: Block, slots: readonly Slot[], placement: Placement): string | null {
  const empty = slots.filter((s) => placement[s.id] === undefined)
  const exact = empty.find((s) => s.type === block.type && canPlace(block, s))
  if (exact) return exact.id
  return empty.find((s) => canPlace(block, s))?.id ?? null
}

/**
 * 困难段的点选落位:同类型的第一个空槽。产品保留一键落位,它在困难段退化成
 * 「把块放进它那一类的槽里」—— 选哪一块、选得对不对仍由孩子负责,考点没有被绕过去。
 */
export function autoTypeTargetId(block: Block, slots: readonly Slot[], placement: Placement): string | null {
  return slots.find((s) => placement[s.id] === undefined && s.type === block.type)?.id ?? null
}

/**
 * 本关星级。miss = 本关累计的错误次数(放错槽 / 点选无槽可落 / 全填后判出错块)。
 *
 * 一星是**通关**不是失败 —— 判定的下限必须是 1,否则「星级」会变成一道否决题,
 * 而这一关的教学目标(拼出来)其实已经达成了。
 */
export function starsFor(missCount: number): number {
  if (missCount <= 0) return 3
  if (missCount <= 2) return 2
  return 1
}
