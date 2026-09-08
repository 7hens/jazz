import type { ApiBasicsProgressRow, BasicsProgressRow } from './basics-progress'
import type { ApiChapterProgressRow } from './chapter-progress'
import type { ServiceToken } from './core'
import type { WordProgress } from './progress'
import type { UserSettings } from './settings'

/** Api 层错误:携带 HTTP status,由各 fetch 封装 catch 后抛出。 */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export interface User {
  id: string
  email: string
  name: string
}

export type ApiWordProgress = Omit<WordProgress, 'updatedAt'>
export type ApiUserSettings = Omit<UserSettings, 'updatedAt'>

export interface ApiService {
  me(): Promise<User>
  login(token: string): Promise<User>
  logout(): Promise<void>
  getProgress(): Promise<ApiWordProgress[]>
  putProgress(progress: WordProgress[]): Promise<void>
  deleteProgress(): Promise<void>
  getSettings(): Promise<ApiUserSettings>
  putSettings(settings: UserSettings): Promise<void>
  getBasicsProgress(): Promise<ApiBasicsProgressRow[]>
  putBasicsProgress(rows: BasicsProgressRow[]): Promise<void>
  getChapterProgress(): Promise<ApiChapterProgressRow | null>
  putChapterProgress(row: ApiChapterProgressRow): Promise<void>
}

export const ApiService = Symbol('ApiService') as unknown as ServiceToken<ApiService>
