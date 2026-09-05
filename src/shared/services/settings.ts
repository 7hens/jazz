import type { LoadState, ReactiveService, ServiceToken } from './core'

/** 每 user 学习设置(启用模块 + 趣味字段)。 */
export type UserSettings = {
  enablePinyin: boolean
  enableHanzi: boolean
  enableEnglish: boolean
  earnedAchievements: string[]
  consecutiveDays: number
  lastActiveDate: string
  updatedAt: string
}

export type SettingsSnapshot = LoadState<UserSettings>

export interface SettingsService extends ReactiveService<SettingsSnapshot> {
  load(): Promise<void>
  save(settings: UserSettings): Promise<void>
}

export const SettingsService = Symbol('SettingsService') as unknown as ServiceToken<SettingsService>
