import type { UserSettings, WordProgress } from '../../types'

export interface User {
  id: string
  email: string
  name: string
}

export interface ApiService {
  me(): Promise<User>
  login(token: string): Promise<User>
  logout(): Promise<void>
  getProgress(): Promise<WordProgress[]>
  putProgress(progress: WordProgress[]): Promise<void>
  deleteProgress(): Promise<void>
  getSettings(): Promise<UserSettings>
  putSettings(settings: UserSettings): Promise<void>
}
