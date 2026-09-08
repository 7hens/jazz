import type { LoadState, ReactiveService, ServiceToken } from './core'

/** 学习领域(启用粒度;汉语域内部恒捆绑 拼音+汉字 两技能步)。 */
export type DomainKey = 'chinese' | 'english'

export const DOMAIN_ORDER: readonly DomainKey[] = ['chinese', 'english']

export function enableKeyOf(domain: DomainKey): 'enableChinese' | 'enableEnglish' {
  return domain === 'chinese' ? 'enableChinese' : 'enableEnglish'
}

/** 每 user 学习设置(启用领域 + 趣味字段)。 */
export type UserSettings = {
  enableChinese: boolean
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
