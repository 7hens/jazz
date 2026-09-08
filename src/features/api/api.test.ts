import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import type { ApiService, ApiUserSettings, ApiWordProgress } from '@/shared/services/api'
import type { ApiBasicsProgressRow, ApiChapterProgressRow, BasicsProgressRow, ChapterProgressRow, UserSettings, WordProgress } from '@/shared/services'
import { createHttpApiService } from './api'

const user = { id: 'u', email: 'e', name: 'n' }
const progress = [{
  wordId: 1,
  completed: { pinyin: true, hanzi: false, english: false },
  starsEarned: 30,
  updatedAt: '2026-09-04T00:00:00.000Z',
}]
const workerProgress = [{
  wordId: 1,
  completed: { pinyin: true, hanzi: false, english: false },
  starsEarned: 30,
}]
const settings = {
  enableChinese: true,
  enableEnglish: true,
  earnedAchievements: ['first-word'],
  consecutiveDays: 3,
  lastActiveDate: '2026-09-04',
  updatedAt: '2026-09-04T00:00:00.000Z',
}
const workerSettings = {
  enableChinese: true,
  enableEnglish: true,
  earnedAchievements: ['first-word'],
  consecutiveDays: 3,
  lastActiveDate: '2026-09-04',
}
const basicsRows: BasicsProgressRow[] = [{
  unitKey: 'pinyin:b',
  state: 'known',
  correctStreak: 2,
  taughtCount: 3,
  updatedAt: '2026-09-04T00:00:00.000Z',
}]
const workerBasicsRows = [{
  unitKey: 'pinyin:b',
  state: 'known',
  correctStreak: 2,
  taughtCount: 3,
}]
const workerChapterRow: ApiChapterProgressRow = {
  chapterId: 1,
  resumeSceneId: 't1-core',
  restoreState: '[]',
}
const chapterRow: ChapterProgressRow = {
  ...workerChapterRow,
  updatedAt: '2026-09-08T00:00:00.000Z',
}

describe('HTTP API service', () => {
  it('exposes timestamp-free Worker shapes for GET responses', () => {
    expectTypeOf<ApiService['getProgress']>().returns.toEqualTypeOf<Promise<ApiWordProgress[]>>()
    expectTypeOf<ApiService['getSettings']>().returns.toEqualTypeOf<Promise<ApiUserSettings>>()
    expectTypeOf<ApiService['getBasicsProgress']>().returns.toEqualTypeOf<Promise<ApiBasicsProgressRow[]>>()
    expectTypeOf<ApiService['getChapterProgress']>().returns.toEqualTypeOf<Promise<ApiChapterProgressRow | null>>()
    expectTypeOf<ApiWordProgress>().toEqualTypeOf<Omit<WordProgress, 'updatedAt'>>()
    expectTypeOf<ApiUserSettings>().toEqualTypeOf<Omit<UserSettings, 'updatedAt'>>()
  })

  it('sends credentials for me', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ user }), { status: 200 }))

    await createHttpApiService(fetcher).me()

    expect(fetcher).toHaveBeenCalledWith('/api/me', { credentials: 'include' })
  })

  it('normalizes JSON errors', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ message: 'unauthorized' }), { status: 401 }))

    await expect(createHttpApiService(fetcher).me()).rejects.toMatchObject({ status: 401, message: 'unauthorized' })
  })

  it('serializes the login token with credentials', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ ok: true, user }), { status: 200 }))

    await createHttpApiService(fetcher).login('secret')

    expect(fetcher).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'secret' }),
    })
  })

  it('sends the logout request with its existing method', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))

    await createHttpApiService(fetcher).logout()

    expect(fetcher).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST', credentials: 'include' })
  })

  it('returns progress from the Worker envelope', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ progress: workerProgress }), { status: 200 }))

    await expect(createHttpApiService(fetcher).getProgress()).resolves.toEqual(workerProgress)
    expect(fetcher).toHaveBeenCalledWith('/api/progress', { credentials: 'include' })
  })

  it('serializes progress under the existing envelope', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ ok: true, updated: 1 }), { status: 200 }))

    await createHttpApiService(fetcher).putProgress(progress)

    expect(fetcher).toHaveBeenCalledWith('/api/progress', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progress }),
    })
  })

  it('sends the progress reset request with its existing method', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))

    await createHttpApiService(fetcher).deleteProgress()

    expect(fetcher).toHaveBeenCalledWith('/api/progress', { method: 'DELETE', credentials: 'include' })
  })

  it('returns settings from the Worker envelope', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ settings: workerSettings }), { status: 200 }))

    await expect(createHttpApiService(fetcher).getSettings()).resolves.toEqual(workerSettings)
    expect(fetcher).toHaveBeenCalledWith('/api/settings', { credentials: 'include' })
  })

  it.each([0, 104])('rejects a progress response with out-of-range word ID %s', async (wordId) => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      progress: [{ ...workerProgress[0], wordId }],
    }), { status: 200 }))

    await expect(createHttpApiService(fetcher).getProgress()).rejects.toMatchObject({
      status: 200,
      message: 'Invalid API response',
    })
  })

  it('serializes settings without the client-only updatedAt field', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))

    await createHttpApiService(fetcher).putSettings(settings)

    expect(fetcher).toHaveBeenCalledWith('/api/settings', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settings: {
          enableChinese: true,
          enableEnglish: true,
          earnedAchievements: ['first-word'],
          consecutiveDays: 3,
          lastActiveDate: '2026-09-04',
        },
      }),
    })
  })

  it('serializes a partial-off settings body carrying an explicit false', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    const partialOff = { ...settings, enableEnglish: false }

    await createHttpApiService(fetcher).putSettings(partialOff)

    expect(fetcher).toHaveBeenCalledWith('/api/settings', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settings: {
          enableChinese: true,
          enableEnglish: false,
          earnedAchievements: ['first-word'],
          consecutiveDays: 3,
          lastActiveDate: '2026-09-04',
        },
      }),
    })
  })

  it('returns basics rows from the Worker envelope', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ rows: workerBasicsRows }), { status: 200 }))

    await expect(createHttpApiService(fetcher).getBasicsProgress()).resolves.toEqual(workerBasicsRows)
    expect(fetcher).toHaveBeenCalledWith('/api/basics-progress', { credentials: 'include' })
  })

  it('serializes basics rows under the existing envelope', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))

    await createHttpApiService(fetcher).putBasicsProgress(basicsRows)

    expect(fetcher).toHaveBeenCalledWith('/api/basics-progress', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: basicsRows }),
    })
  })

  it('throws ApiError when the basics PUT is not ok', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ message: 'boom' }), { status: 500 }))

    await expect(createHttpApiService(fetcher).putBasicsProgress(basicsRows)).rejects.toMatchObject({
      status: 500,
      message: 'boom',
    })
  })

  it('rejects a basics response with a malformed row', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      rows: [{ ...workerBasicsRows[0], state: 'mastered' }],
    }), { status: 200 }))

    await expect(createHttpApiService(fetcher).getBasicsProgress()).rejects.toMatchObject({
      status: 200,
      message: 'Invalid API response',
    })
  })

  it('rejects malformed success payloads as API errors', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ user: { id: 'u' } }), { status: 200 }))

    await expect(createHttpApiService(fetcher).me()).rejects.toMatchObject({ status: 200, message: 'Invalid API response' })
  })

  it('rejects a login response without its success envelope', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ user }), { status: 200 }))

    await expect(createHttpApiService(fetcher).login('secret')).rejects.toMatchObject({ status: 200, message: 'Invalid API response' })
  })

  it('returns the chapter progress row from the Worker envelope', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ row: workerChapterRow }), { status: 200 }))

    await expect(createHttpApiService(fetcher).getChapterProgress()).resolves.toEqual(workerChapterRow)
    expect(fetcher).toHaveBeenCalledWith('/api/chapter-progress', { credentials: 'include' })
  })

  it('resolves getChapterProgress to null when the Worker has no row', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ row: null }), { status: 200 }))

    await expect(createHttpApiService(fetcher).getChapterProgress()).resolves.toBeNull()
  })

  it('rejects a chapter progress response with a malformed row', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      row: { ...workerChapterRow, chapterId: 'one' },
    }), { status: 200 }))

    await expect(createHttpApiService(fetcher).getChapterProgress()).rejects.toMatchObject({
      status: 200,
      message: 'Invalid API response',
    })
  })

  it('serializes the chapter row under the envelope without the client timestamp', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))

    await createHttpApiService(fetcher).putChapterProgress(chapterRow)

    expect(fetcher).toHaveBeenCalledWith('/api/chapter-progress', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        row: { chapterId: 1, resumeSceneId: 't1-core', restoreState: '[]' },
      }),
    })
  })
})
