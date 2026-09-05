import type { LoadState, ReactiveService, ServiceToken } from './core'

/** 基础单元状态:known 为已掌握,learning 为学习中(行缺失 = 未评估)。 */
export type BasicsUnitState = 'learning' | 'known'

/** 每 user × 每基础单元一行(updatedAt 为前端本地时间戳)。unitKey 形如 'pinyin:b'/'pinyin:ing'/'pinyin:ton2'/'english:a'。 */
export type BasicsProgressRow = {
  unitKey: string
  state: BasicsUnitState
  correctStreak: number
  taughtCount: number
  updatedAt: string
}

/** 服务端行(不含 updatedAt,由前端本地盖戳)。 */
export type ApiBasicsProgressRow = Omit<BasicsProgressRow, 'updatedAt'>

export type BasicsProgressData = Record<string, BasicsProgressRow>
export type BasicsProgressSnapshot = LoadState<BasicsProgressData>

/** unit_key 白名单字符集:声母/韵母/声调/英文字母 + ü 韵母;worker 与本模式镜像同步。 */
export const BASICS_UNIT_KEY_PATTERN = /^[a-z]+:[a-z0-9ü]+$/

export interface BasicsService extends ReactiveService<BasicsProgressSnapshot> {
  load(): Promise<void>
  /** 一次作答(短教轻测/软提示跟测/诊断):内部经估计器更新该单元后持久化。 */
  recordAnswer(unitKey: string, correct: boolean): Promise<void>
  /** 短教完成:这些单元 taughtCount+1 并持久化。 */
  markTaught(unitKeys: readonly string[]): Promise<void>
  /** 批量权威写入(冷启动诊断基线 / 全量重估),行级 upsert。 */
  saveAll(rows: readonly BasicsProgressRow[]): Promise<void>
}

export const BasicsService = Symbol('BasicsService') as unknown as ServiceToken<BasicsService>
