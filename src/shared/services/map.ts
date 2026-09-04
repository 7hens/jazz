import type { ApiService } from './api'
import type { AuthService } from './auth'
import type { ProgressService } from './progress'
import type { SettingsService } from './settings'

export interface ServiceMap {
  api: ApiService
  auth: AuthService
  progress: ProgressService
  'settings-state': SettingsService
}
