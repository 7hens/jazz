import type { UserSettings } from '../../types'
import type { LoadState } from '../load-state'
import type { ReactiveService } from '../useServiceSnapshot'

export type SettingsSnapshot = LoadState<UserSettings>

export interface SettingsService extends ReactiveService<SettingsSnapshot> {
  load(): Promise<void>
  save(settings: UserSettings): Promise<void>
}
