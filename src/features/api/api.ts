import { ApiError } from '@/shared/services'
import type { ApiBasicsProgressRow, ApiChapterProgressRow } from '@/shared/services'
import type { PinyinProgressData } from '@/shared/services'
import type { ApiService, ApiUserSettings, ApiWordProgress, User } from '@/shared/services/api'

type JsonObject = Record<string, unknown>
type Validator<T> = (payload: unknown) => payload is T

type UserResponse = { user: User }
type LoginResponse = { ok: true; user: User }
type ProgressResponse = { progress: ApiWordProgress[] }
type SettingsResponse = { settings: ApiUserSettings }
type OkResponse = { ok: true }
type BasicsProgressResponse = { rows: ApiBasicsProgressRow[] }
type ChapterProgressResponse = { row: ApiChapterProgressRow | null }
type PinyinProgressResponse = { stars: Record<string, number>; totalStars: number }

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isUser(value: unknown): value is User {
  return isObject(value)
    && typeof value.id === 'string'
    && typeof value.email === 'string'
    && typeof value.name === 'string'
}

function isWordProgress(value: unknown): value is ApiWordProgress {
  if (!isObject(value) || typeof value.wordId !== 'number' || !Number.isInteger(value.wordId) || value.wordId < 1 || value.wordId > 103) return false
  if (!isObject(value.completed) || typeof value.starsEarned !== 'number' || !Number.isFinite(value.starsEarned)) return false

  // sentenceLevel 上限与 shared MAX_SENTENCE_LEVEL 对齐:此处独立保留字面量(线格式校验,不跨端 import),
  // api.test.ts 有锚定测试(上限接受 / +1 拒绝)防漂移。失效模式:判非法 → 整包响应被拒 → 静默丢进度。
  return typeof value.completed.pinyin === 'boolean'
    && typeof value.completed.hanzi === 'boolean'
    && typeof value.completed.english === 'boolean'
    && typeof value.bonusGranted === 'boolean'
    && typeof value.sentenceLevel === 'number'
    && Number.isInteger(value.sentenceLevel)
    && value.sentenceLevel >= 0
    && value.sentenceLevel <= 3
}

function isSettings(value: unknown): value is ApiUserSettings {
  if (!isObject(value)) return false

  return typeof value.enableChinese === 'boolean'
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

function isBasicsRow(value: unknown): value is ApiBasicsProgressRow {
  return isObject(value)
    && typeof value.unitKey === 'string'
    && (value.state === 'learning' || value.state === 'known')
    && typeof value.correctStreak === 'number' && Number.isFinite(value.correctStreak)
    && typeof value.taughtCount === 'number' && Number.isFinite(value.taughtCount)
}

function isBasicsProgressResponse(value: unknown): value is BasicsProgressResponse {
  return isObject(value) && Array.isArray(value.rows) && value.rows.every(isBasicsRow)
}

function isChapterProgressRow(value: unknown): value is ApiChapterProgressRow {
  if (!isObject(value)) return false
  const resumeSceneId = value.resumeSceneId
  const restoreState = value.restoreState
  return typeof value.chapterId === 'number' && Number.isInteger(value.chapterId) && value.chapterId >= 1
    && (resumeSceneId === null || typeof resumeSceneId === 'string')
    && typeof restoreState === 'string'
}

function isChapterProgressResponse(value: unknown): value is ChapterProgressResponse {
  return isObject(value) && (value.row === null || isChapterProgressRow(value.row))
}

/** 星数上限与前端星级判定(1..3)、worker 的 LEVEL_ID/上限三处对齐,有锚定测试防漂移。 */
export const LEVEL_ID = /^u\d+-\d+$/

function isLevelStars(value: unknown): value is Record<string, number> {
  if (!isObject(value)) return false
  return Object.entries(value).every(([key, stars]) =>
    LEVEL_ID.test(key) && (stars === 1 || stars === 2 || stars === 3))
}

function isPinyinProgressResponse(value: unknown): value is PinyinProgressResponse {
  return isObject(value)
    && isLevelStars(value.stars)
    && typeof value.totalStars === 'number'
    && Number.isInteger(value.totalStars)
    && value.totalStars >= 0
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
        enableChinese,
        enableEnglish,
        earnedAchievements,
        consecutiveDays,
        lastActiveDate,
      } = settings
      await request('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({
          settings: {
            enableChinese,
            enableEnglish,
            earnedAchievements,
            consecutiveDays,
            lastActiveDate,
          },
        }),
      }, isOkResponse)
    },
    async getBasicsProgress() {
      return (await request('/api/basics-progress', {}, isBasicsProgressResponse)).rows
    },
    async putBasicsProgress(rows) {
      await request('/api/basics-progress', {
        method: 'PUT',
        body: JSON.stringify({ rows }),
      }, isOkResponse)
    },
    async getChapterProgress() {
      return (await request('/api/chapter-progress', {}, isChapterProgressResponse)).row
    },
    async putChapterProgress(row) {
      await request('/api/chapter-progress', {
        method: 'PUT',
        body: JSON.stringify({
          row: {
            chapterId: row.chapterId,
            resumeSceneId: row.resumeSceneId,
            restoreState: row.restoreState,
          },
        }),
      }, isOkResponse)
    },
    async getPinyinProgress() {
      const payload = await request('/api/pinyin-progress', {}, isPinyinProgressResponse)
      return { stars: payload.stars, totalStars: payload.totalStars } satisfies PinyinProgressData
    },
    async putPinyinProgress(data) {
      await request('/api/pinyin-progress', {
        method: 'PUT',
        body: JSON.stringify({ stars: data.stars, totalStars: data.totalStars }),
      }, isOkResponse)
    },
    async deletePinyinProgress() {
      await request('/api/pinyin-progress', { method: 'DELETE' }, isOkResponse)
    },
  }
}
