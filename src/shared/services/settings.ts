import type { UserSettings } from '../types'
import type { LoadState } from '../load-state'
import type { ReactiveService, ServiceToken } from './core'

export type SettingsSnapshot = LoadState<UserSettings>

export interface SettingsService extends ReactiveService<SettingsSnapshot> {
  load(): Promise<void>
  save(settings: UserSettings): Promise<void>
}

export const SettingsService = Symbol('SettingsService') as unknown as ServiceToken<SettingsService>
