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

  it('does not let an older failed save roll back a newer successful save', async () => {
    let rejectFirst!: (error: Error) => void
    let resolveSecond!: () => void
    const putSettings = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { rejectFirst = reject }))
      .mockImplementationOnce(() => new Promise<void>(resolve => { resolveSecond = resolve }))
    const service = createSettingsService(fakeApi({ putSettings }), {
      onUnauthorized: vi.fn(),
      onError: vi.fn(),
    })
    const newest = settings({ enablePinyin: false, enableEnglish: false })

    const first = service.save(settings({ enablePinyin: false }))
    const second = service.save(newest)
    resolveSecond()
    await second
    rejectFirst(new Error('first failed'))
    await expect(first).rejects.toThrow('first failed')

    expect(service.getSnapshot()).toEqual({ status: 'ready', data: newest })
  })

  it('returns to the persisted base when overlapping saves both fail newest first', async () => {
    let rejectFirst!: (error: Error) => void
    let rejectSecond!: (error: Error) => void
    const putSettings = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { rejectFirst = reject }))
      .mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { rejectSecond = reject }))
    const service = createSettingsService(fakeApi({ putSettings }), {
      onUnauthorized: vi.fn(),
      onError: vi.fn(),
    })
    const base = service.getSnapshot()

    const first = service.save(settings({ enablePinyin: false }))
    const second = service.save(settings({ enablePinyin: false, enableEnglish: false }))
    rejectSecond(new Error('second failed'))
    await expect(second).rejects.toThrow('second failed')
    rejectFirst(new Error('first failed'))
    await expect(first).rejects.toThrow('first failed')

    expect(service.getSnapshot()).toEqual(base)
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

  it('ignores a stale successful load when settings are saved while it is pending', async () => {
    let resolveLoad!: (value: Awaited<ReturnType<ApiService['getSettings']>>) => void
    const service = createSettingsService(fakeApi({
      getSettings: () => new Promise(resolve => { resolveLoad = resolve }),
    }), { onUnauthorized: vi.fn(), onError: vi.fn() })
    const saved = settings({ enablePinyin: false })

    const loading = service.load()
    await service.save(saved)
    resolveLoad({
      enablePinyin: true,
      enableHanzi: true,
      enableEnglish: true,
      earnedAchievements: [],
      consecutiveDays: 0,
      lastActiveDate: '',
    })
    await loading

    expect(service.getSnapshot()).toEqual({ status: 'ready', data: saved })
  })

  it('ignores a stale failed load when settings are saved while it is pending', async () => {
    let rejectLoad!: (error: Error) => void
    const onError = vi.fn()
    const service = createSettingsService(fakeApi({
      getSettings: () => new Promise((_resolve, reject) => { rejectLoad = reject }),
    }), { onUnauthorized: vi.fn(), onError })
    const saved = settings({ enablePinyin: false })

    const loading = service.load()
    await service.save(saved)
    rejectLoad(new Error('stale load failed'))
    await loading

    expect(service.getSnapshot()).toEqual({ status: 'ready', data: saved })
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
