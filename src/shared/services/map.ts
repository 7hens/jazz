import type { ApiService } from './api'
import type { AuthService } from './auth'

export interface ServiceMap {
  api: ApiService
  auth: AuthService
}
