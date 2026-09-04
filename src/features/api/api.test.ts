import { describe, expect, it, vi } from 'vitest'
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
  enablePinyin: true,
  enableHanzi: false,
  enableEnglish: true,
  earnedAchievements: ['first-word'],
  consecutiveDays: 3,
  lastActiveDate: '2026-09-04',
  updatedAt: '2026-09-04T00:00:00.000Z',
}
const workerSettings = {
  enablePinyin: true,
  enableHanzi: false,
  enableEnglish: true,
  earnedAchievements: ['first-word'],
  consecutiveDays: 3,
  lastActiveDate: '2026-09-04',
}

describe('HTTP API service', () => {
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

  it('serializes settings without the client-only updatedAt field', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))

    await createHttpApiService(fetcher).putSettings(settings)

    expect(fetcher).toHaveBeenCalledWith('/api/settings', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settings: {
          enablePinyin: true,
          enableHanzi: false,
          enableEnglish: true,
          earnedAchievements: ['first-word'],
          consecutiveDays: 3,
          lastActiveDate: '2026-09-04',
        },
      }),
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
})
