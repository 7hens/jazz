import type { UserSettings, WordProgress } from '../types'

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
}
