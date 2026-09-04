import { ApiError } from '@/shared/api-error'
import type { ApiService, User } from '@/shared/services/api'
import type { UserSettings, WordProgress } from '@/types'

type JsonObject = Record<string, unknown>
type Validator<T> = (payload: unknown) => payload is T

type UserResponse = { user: User }
type LoginResponse = { ok: true; user: User }
type ProgressResponse = { progress: WordProgress[] }
type SettingsResponse = { settings: UserSettings }
type OkResponse = { ok: true }

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isUser(value: unknown): value is User {
  return isObject(value)
    && typeof value.id === 'string'
    && typeof value.email === 'string'
    && typeof value.name === 'string'
}

function isWordProgress(value: unknown): value is WordProgress {
  if (!isObject(value) || typeof value.wordId !== 'number' || !Number.isInteger(value.wordId)) return false
  if (!isObject(value.completed) || typeof value.starsEarned !== 'number' || !Number.isFinite(value.starsEarned)) return false

  return typeof value.completed.pinyin === 'boolean'
    && typeof value.completed.hanzi === 'boolean'
    && typeof value.completed.english === 'boolean'
}

function isSettings(value: unknown): value is UserSettings {
  if (!isObject(value)) return false

  return typeof value.enablePinyin === 'boolean'
    && typeof value.enableHanzi === 'boolean'
    && typeof value.enableEnglish === 'boolean'
    && Array.isArray(value.earnedAchievements)
    && value.earnedAchievements.every((achievement) => typeof achievement === 'string')
    && typeof value.consecutiveDays === 'number'
    && Number.isFinite(value.consecutiveDays)
    && typeof value.lastActiveDate === 'string'
}

function isUserResponse(value: unknown): value is UserResponse {
  return isObject(value) && isUser(value.user)
}

function isLoginResponse(value: unknown): value is LoginResponse {
  return isObject(value) && value.ok === true && isUser(value.user)
}

function isProgressResponse(value: unknown): value is ProgressResponse {
  return isObject(value) && Array.isArray(value.progress) && value.progress.every(isWordProgress)
}

function isSettingsResponse(value: unknown): value is SettingsResponse {
  return isObject(value) && isSettings(value.settings)
}

function isOkResponse(value: unknown): value is OkResponse {
  return isObject(value) && value.ok === true
}

function errorMessage(payload: unknown): string | undefined {
  return isObject(payload) && typeof payload.message === 'string' ? payload.message : undefined
}

export function createHttpApiService(fetcher: typeof fetch = fetch): ApiService {
  async function request<T>(path: string, init: RequestInit, isValid: Validator<T>): Promise<T> {
    const requestInit = init.body === undefined
      ? { ...init, credentials: 'include' as const }
      : {
          ...init,
          credentials: 'include' as const,
          headers: { 'Content-Type': 'application/json' },
        }
    const response = await fetcher(path, requestInit)
    const payload: unknown = await response.json().catch(() => undefined)

    if (!response.ok) {
      throw new ApiError(response.status, errorMessage(payload) ?? `Request failed with status ${response.status}`)
    }
    if (!isValid(payload)) throw new ApiError(response.status, 'Invalid API response')

    return payload
  }

  return {
    async me() {
      return (await request('/api/me', {}, isUserResponse)).user
    },
    async login(token) {
      return (await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ token }),
      }, isLoginResponse)).user
    },
    async logout() {
      await request('/api/auth/logout', { method: 'POST' }, isOkResponse)
    },
    async getProgress() {
      return (await request('/api/progress', {}, isProgressResponse)).progress
    },
    async putProgress(progress) {
      await request('/api/progress', {
        method: 'PUT',
        body: JSON.stringify({ progress }),
      }, isOkResponse)
    },
    async deleteProgress() {
      await request('/api/progress', { method: 'DELETE' }, isOkResponse)
    },
    async getSettings() {
      return (await request('/api/settings', {}, isSettingsResponse)).settings
    },
    async putSettings(settings) {
      const {
        enablePinyin,
        enableHanzi,
        enableEnglish,
        earnedAchievements,
        consecutiveDays,
        lastActiveDate,
      } = settings
      await request('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({
          settings: {
            enablePinyin,
            enableHanzi,
            enableEnglish,
            earnedAchievements,
            consecutiveDays,
            lastActiveDate,
          },
        }),
      }, isOkResponse)
    },
  }
}
