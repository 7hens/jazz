import type { LoadState, ReactiveService, ServiceToken } from './core'

/** 关卡 id → 星数(1..3)。未通关的关不出现 —— 「没这个 key」就是「没通关」。 */
export type LevelStars = Readonly<Record<string, number>>

/** 每 user 一份(单档案:整表就一行)。 */
export type PinyinProgressData = Readonly<{
  stars: LevelStars
  /** 星尘累计:连击加成 / 成就奖励 / 幸运奖励都往这加,只增不减。 */
  totalStars: number
}>

export type PinyinProgressSnapshot = LoadState<PinyinProgressData>

/** 一次通关的产出,由关卡结算算出后交给服务落库。 */
export type LevelClear = Readonly<{
  levelId: string
  /** 本次拿到的星(1..3);与旧值取 max 后才入库。 */
  stars: number
  /** 本次产出的星尘(连击加成 + 幸运 + 成就),累加进 totalStars。 */
  starDust: number
}>

export interface PinyinProgressService extends ReactiveService<PinyinProgressSnapshot> {
  load(): Promise<void>
  recordClear(clear: LevelClear): Promise<void>
  resetAll(): Promise<void>
}

export const PinyinProgressService = Symbol('PinyinProgressService') as unknown as ServiceToken<PinyinProgressService>
