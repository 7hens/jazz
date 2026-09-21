// 积木玩法的纯逻辑:槽位生成 / 干扰块 / 放置判定。可注入 rng 保证测试确定性。
// 不引 React、不引服务 —— 组件只负责画和收手势。

import { DUAL_VALUES, TONE_VALUES, poolFor, type Block, type BlockType } from './blocks'
import type { Level } from './levels'

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

/**
 * 托盘积木 = 所需块(含重复) + 声调块 + 干扰块。
 * 干扰块总数封顶并按类型轮摊(**不是**每类各来 N 个,那样块数会炸);
 * 干扰块只从已解锁的池子里取 —— 还没教的块不该出现在题面上。
 */
export function buildBlocks(level: Level, unit: number, rng: Rng = Math.random): Block[] {
  const required = requiredBlocks(level)
  const tones = toneBlocks(level)
  const takenKeys = new Set([...required, ...tones].map(keyOf))
  const types = [...new Set(required.map((b) => b.type))]
  const cap = level.syl.length > 1 ? 2 : unit <= 1 ? 2 : 3

  const cursors = new Map<BlockType, string[]>()
  for (const type of types) {
    const used = new Set(required.filter((b) => b.type === type).map((b) => b.value))
    cursors.set(
      type,
      shuffle(
        poolFor(type, unit).filter((v) => !used.has(v)),
        rng,
      ),
    )
  }

  const extra: Block[] = []
  for (let placed = 0; placed < cap; placed++) {
    // 每轮挑候选最多的那一类,避免某一类被抽空后失衡
    const candidates = types.filter((t) => (cursors.get(t)?.length ?? 0) > 0)
    if (candidates.length === 0) break
    candidates.sort((a, b) => (cursors.get(b)?.length ?? 0) - (cursors.get(a)?.length ?? 0))
    const type = candidates[0] as BlockType
    const value = cursors.get(type)?.pop()
    if (value === undefined) continue
    const block: Block = { type, value }
    if (takenKeys.has(keyOf(block))) continue
    takenKeys.add(keyOf(block))
    extra.push(block)
  }

  return shuffle([...required, ...tones, ...extra], rng)
}

/** 每个槽都放上了块。 */
export function isComplete(slots: readonly Slot[], placement: Placement): boolean {
  return slots.every((s) => placement[s.id] !== undefined)
}

/** 放错(值或类型不匹配)的槽 id。全空返回 []。 */
export function wrongSlotIds(slots: readonly Slot[], placement: Placement, tray: readonly TrayBlock[]): string[] {
  const byId = new Map(tray.map((b) => [b.id, b]))
  const bad: string[] = []
  for (const slot of slots) {
    const blockId = placement[slot.id]
    if (blockId === undefined) continue
    const block = byId.get(blockId)
    if (!block || !canPlace(block, slot)) bad.push(slot.id)
  }
  return bad
}

/** 点选路径:优先找类型完全相同的空槽,再退到双身份块的互换槽。找不到返回 null。 */
export function autoTargetId(block: Block, slots: readonly Slot[], placement: Placement): string | null {
  const empty = slots.filter((s) => placement[s.id] === undefined)
  const exact = empty.find((s) => s.type === block.type && canPlace(block, s))
  if (exact) return exact.id
  return empty.find((s) => canPlace(block, s))?.id ?? null
}
