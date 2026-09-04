import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/shared/api-error'
import type { ApiService } from '@/shared/services'
import type { UserSettings } from '@/types'
import { createSettingsService, defaultSettings } from './settings'

function settings(overrides: Partial<UserSettings> = {}): UserSettings {
  return {
    enablePinyin: true,
    enableHanzi: true,
    enableEnglish: true,
    earnedAchievements: [],
    consecutiveDays: 0,
    lastActiveDate: '',
    updatedAt: '2026-09-04T00:00:00.000Z',
    ...overrides,
  }
}

function fakeApi(overrides: Partial<ApiService> = {}): ApiService {
  return {
    me: async () => ({ id: 'u', email: 'e', name: 'n' }),
    login: async () => ({ id: 'u', email: 'e', name: 'n' }),
    logout: async () => undefined,
    getProgress: async () => [],
    putProgress: async () => undefined,
    deleteProgress: async () => undefined,
    getSettings: async () => ({
      enablePinyin: true,
      enableHanzi: true,
      enableEnglish: true,
      earnedAchievements: [],
      consecutiveDays: 0,
      lastActiveDate: '',
    }),
    putSettings: async () => undefined,
    ...overrides,
  }
}

describe('SettingsService', () => {
  it('starts idle with the existing application defaults', () => {
    const service = createSettingsService(fakeApi(), { onUnauthorized: vi.fn(), onError: vi.fn() })

    expect(service.getSnapshot()).toMatchObject({
      status: 'idle',
      data: {
        enablePinyin: true,
        enableHanzi: true,
        enableEnglish: true,
        earnedAchievements: [],
        consecutiveDays: 0,
        lastActiveDate: '',
      },
    })
    expect(defaultSettings().updatedAt).not.toBe('')
  })

  it('publishes loading before normalizing API settings into a ready snapshot', async () => {
    let resolveLoad!: (value: Awaited<ReturnType<ApiService['getSettings']>>) => void
    const service = createSettingsService(fakeApi({
      getSettings: () => new Promise(resolve => { resolveLoad = resolve }),
    }), { onUnauthorized: vi.fn(), onError: vi.fn() })

    const loading = service.load()
    expect(service.getSnapshot().status).toBe('loading')

    resolveLoad({
      enablePinyin: false,
      enableHanzi: true,
      enableEnglish: false,
      earnedAchievements: ['first'],
      consecutiveDays: 4,
      lastActiveDate: '2026-09-04',
    })
    await loading

    expect(service.getSnapshot()).toMatchObject({
      status: 'ready',
      data: {
        enablePinyin: false,
        enableHanzi: true,
        enableEnglish: false,
        earnedAchievements: ['first'],
        consecutiveDays: 4,
        lastActiveDate: '2026-09-04',
      },
    })
    expect(service.getSnapshot().data.updatedAt).not.toBe('')
  })

  it('publishes an optimistic save before PUT resolves', async () => {
    let resolvePut!: () => void
    const service = createSettingsService(fakeApi({
      putSettings: () => new Promise<void>(resolve => { resolvePut = resolve }),
    }), { onUnauthorized: vi.fn(), onError: vi.fn() })
    const next = settings({ enablePinyin: false })

    const saving = service.save(next)
    expect(service.getSnapshot()).toEqual({ status: 'ready', data: next })

    resolvePut()
    await saving
  })

  it('rolls back an optimistic save, reports the failure, and rethrows', async () => {
    const onError = vi.fn()
    const service = createSettingsService(fakeApi({
      putSettings: async () => { throw new Error('offline') },
    }), { onUnauthorized: vi.fn(), onError })
    const before = service.getSnapshot()

    await expect(service.save(settings({ enableEnglish: false }))).rejects.toThrow('offline')

    expect(service.getSnapshot()).toEqual(before)
    expect(service.getSnapshot()).not.toBe(before)
    expect(onError).toHaveBeenCalledWith('offline')
  })

  it('reports load errors while preserving data and routes 401 to onUnauthorized', async () => {
    const onUnauthorized = vi.fn()
    const onError = vi.fn()
    const service = createSettingsService(fakeApi({
      getSettings: async () => { throw new ApiError(401, 'Session expired') },
    }), { onUnauthorized, onError })
    const before = service.getSnapshot().data

    await service.load()

    expect(service.getSnapshot()).toEqual({ status: 'error', data: before, error: 'Session expired' })
    expect(onUnauthorized).toHaveBeenCalledOnce()
    expect(onError).not.toHaveBeenCalled()
  })

  it('freezes settings data including achievements and keeps snapshots stable between mutations', () => {
    const service = createSettingsService(fakeApi(), { onUnauthorized: vi.fn(), onError: vi.fn() })
    const initial = service.getSnapshot()

    expect(service.getSnapshot()).toBe(initial)
    expect(Object.isFrozen(initial)).toBe(true)
    expect(Object.isFrozen(initial.data)).toBe(true)
    expect(Object.isFrozen(initial.data.earnedAchievements)).toBe(true)
  })

  it('notifies active subscribers once for each published snapshot', () => {
    const service = createSettingsService(fakeApi(), { onUnauthorized: vi.fn(), onError: vi.fn() })
    const listener = vi.fn()
    const unsubscribe = service.subscribe(listener)

    void service.save(settings())
    unsubscribe()
    void service.save(settings({ enableHanzi: false }))

    expect(listener).toHaveBeenCalledOnce()
  })
})
