import type { UserSettings } from '../types'
import type { LoadState } from '../load-state'
import type { ReactiveService } from '../useServiceSnapshot'
import type { ServiceToken } from './token'

export type SettingsSnapshot = LoadState<UserSettings>

export interface SettingsService extends ReactiveService<SettingsSnapshot> {
  load(): Promise<void>
  save(settings: UserSettings): Promise<void>
}

export const SettingsService = Symbol('SettingsService') as unknown as ServiceToken<SettingsService>
