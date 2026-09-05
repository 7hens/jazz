import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/shared/api-error'
import type { ApiService } from '@/shared/services'
import type { WordProgress } from '@/shared/types'
import { createProgressService } from './progress'

function progress(wordId: number, completed = false, starsEarned = 0): WordProgress {
  return {
    wordId,
    completed: { pinyin: completed, hanzi: completed, english: completed },
    starsEarned,
    updatedAt: '2026-09-04T00:00:00.000Z',
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

describe('ProgressService', () => {
  it('publishes loading before normalizing API progress into a ready snapshot', async () => {
    let resolveLoad!: (rows: Awaited<ReturnType<ApiService['getProgress']>>) => void
    const api = fakeApi({
      getProgress: () => new Promise(resolve => { resolveLoad = resolve }),
    })
    const service = createProgressService(api, { onUnauthorized: vi.fn(), onError: vi.fn() })

    const loading = service.load()
    expect(service.getSnapshot()).toEqual({ status: 'loading', data: {} })

    resolveLoad([{
      wordId: 1,
      completed: { pinyin: true, hanzi: false, english: false },
      starsEarned: 30,
    }])
    await loading

    expect(service.getSnapshot()).toMatchObject({
      status: 'ready',
      data: {
        1: {
          wordId: 1,
          completed: { pinyin: true, hanzi: false, english: false },
          starsEarned: 30,
        },
      },
    })
    expect(service.getSnapshot().data[1].updatedAt).not.toBe('')
  })

  it('publishes merged optimistic progress before PUT resolves', async () => {
    let resolvePut!: () => void
    const putProgress = vi.fn(() => new Promise<void>(resolve => { resolvePut = resolve }))
    const service = createProgressService(fakeApi({ putProgress }), {
      onUnauthorized: vi.fn(),
      onError: vi.fn(),
    })
    service.seed([{
      ...progress(1),
      completed: { pinyin: true, hanzi: false, english: false },
      starsEarned: 30,
    }])

    const saving = service.saveStep({
      ...progress(1),
      completed: { pinyin: false, hanzi: true, english: false },
      starsEarned: 20,
    })

    expect(service.getSnapshot().data[1]).toMatchObject({
      completed: { pinyin: true, hanzi: true, english: false },
      starsEarned: 30,
    })
    resolvePut()
    await saving
  })

  it('rolls back an optimistic save when PUT fails and rethrows the error', async () => {
    const onError = vi.fn()
    const service = createProgressService(fakeApi({
      putProgress: async () => { throw new Error('offline') },
    }), { onUnauthorized: vi.fn(), onError })
    const before = progress(1)
    service.seed([before])

    await expect(service.saveStep(progress(1, true, 90))).rejects.toThrow('offline')

    expect(service.getSnapshot()).toEqual({ status: 'ready', data: { 1: before } })
    expect(onError).toHaveBeenCalledWith('offline')
  })

  it('does not let an older failed save roll back a newer successful save', async () => {
    let rejectFirst!: (error: Error) => void
    let resolveSecond!: () => void
    const putProgress = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { rejectFirst = reject }))
      .mockImplementationOnce(() => new Promise<void>(resolve => { resolveSecond = resolve }))
    const service = createProgressService(fakeApi({ putProgress }), {
      onUnauthorized: vi.fn(),
      onError: vi.fn(),
    })
    service.seed([progress(1)])

    const first = service.saveStep({
      ...progress(1),
      completed: { pinyin: true, hanzi: false, english: false },
      starsEarned: 30,
    })
    const second = service.saveStep({
      ...progress(1),
      completed: { pinyin: false, hanzi: true, english: false },
      starsEarned: 60,
    })
    resolveSecond()
    await second
    rejectFirst(new Error('first failed'))
    await expect(first).rejects.toThrow('first failed')

    expect(service.getSnapshot().data[1]).toMatchObject({
      completed: { pinyin: true, hanzi: true, english: false },
      starsEarned: 60,
    })
  })

  it('returns to the persisted base when overlapping saves both fail newest first', async () => {
    let rejectFirst!: (error: Error) => void
    let rejectSecond!: (error: Error) => void
    const putProgress = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { rejectFirst = reject }))
      .mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { rejectSecond = reject }))
    const service = createProgressService(fakeApi({ putProgress }), {
      onUnauthorized: vi.fn(),
      onError: vi.fn(),
    })
    const base = progress(1)
    service.seed([base])

    const first = service.saveStep({
      ...progress(1),
      completed: { pinyin: true, hanzi: false, english: false },
      starsEarned: 30,
    })
    const second = service.saveStep({
      ...progress(1),
      completed: { pinyin: false, hanzi: true, english: false },
      starsEarned: 60,
    })
    rejectSecond(new Error('second failed'))
    await expect(second).rejects.toThrow('second failed')
    rejectFirst(new Error('first failed'))
    await expect(first).rejects.toThrow('first failed')

    expect(service.getSnapshot()).toEqual({ status: 'ready', data: { 1: base } })
  })

  it('removes failed word A when a later save for word B succeeds first', async () => {
    let rejectFirst!: (error: Error) => void
    let resolveSecond!: () => void
    const putProgress = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { rejectFirst = reject }))
      .mockImplementationOnce(() => new Promise<void>(resolve => { resolveSecond = resolve }))
    const service = createProgressService(fakeApi({ putProgress }), {
      onUnauthorized: vi.fn(),
      onError: vi.fn(),
    })
    const stableA = progress(1)
    service.seed([stableA])

    const savingA = service.saveStep(progress(1, true, 30))
    const savingB = service.saveStep(progress(2, true, 60))
    resolveSecond()
    await savingB
    rejectFirst(new Error('A failed'))
    await expect(savingA).rejects.toThrow('A failed')

    expect(service.getSnapshot().data).toEqual({
      1: stableA,
      2: progress(2, true, 60),
    })
  })

  it('removes failed word A when it rejects before a later word B save succeeds', async () => {
    let rejectFirst!: (error: Error) => void
    let resolveSecond!: () => void
    const putProgress = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { rejectFirst = reject }))
      .mockImplementationOnce(() => new Promise<void>(resolve => { resolveSecond = resolve }))
    const service = createProgressService(fakeApi({ putProgress }), {
      onUnauthorized: vi.fn(),
      onError: vi.fn(),
    })
    const stableA = progress(1)
    service.seed([stableA])

    const savingA = service.saveStep(progress(1, true, 30))
    const savingB = service.saveStep(progress(2, true, 60))
    rejectFirst(new Error('A failed'))
    await expect(savingA).rejects.toThrow('A failed')
    resolveSecond()
    await savingB

    expect(service.getSnapshot().data).toEqual({
      1: stableA,
      2: progress(2, true, 60),
    })
  })

  it('reports a load error while preserving the previously loaded data', async () => {
    const onError = vi.fn()
    const before = progress(1)
    const service = createProgressService(fakeApi({
      getProgress: async () => { throw new Error('offline') },
    }), { onUnauthorized: vi.fn(), onError })
    service.seed([before])

    await service.load()

    expect(service.getSnapshot()).toEqual({ status: 'error', data: { 1: before }, error: 'offline' })
    expect(onError).toHaveBeenCalledWith('offline')
  })

  it('ignores a stale successful load when progress is saved while it is pending', async () => {
    let resolveLoad!: (rows: Awaited<ReturnType<ApiService['getProgress']>>) => void
    const service = createProgressService(fakeApi({
      getProgress: () => new Promise(resolve => { resolveLoad = resolve }),
    }), { onUnauthorized: vi.fn(), onError: vi.fn() })

    const loading = service.load()
    await service.saveStep(progress(1, true, 90))
    resolveLoad([])
    await loading

    expect(service.getSnapshot()).toMatchObject({ status: 'ready', data: { 1: progress(1, true, 90) } })
  })

  it('ignores a stale failed load when progress is saved while it is pending', async () => {
    let rejectLoad!: (error: Error) => void
    const onError = vi.fn()
    const service = createProgressService(fakeApi({
      getProgress: () => new Promise((_resolve, reject) => { rejectLoad = reject }),
    }), { onUnauthorized: vi.fn(), onError })

    const loading = service.load()
    await service.saveStep(progress(1, true, 90))
    rejectLoad(new Error('stale load failed'))
    await loading

    expect(service.getSnapshot()).toMatchObject({ status: 'ready', data: { 1: progress(1, true, 90) } })
    expect(onError).not.toHaveBeenCalled()
  })

  it('calls onUnauthorized for API 401 errors without showing a generic error', async () => {
    const onUnauthorized = vi.fn()
    const onError = vi.fn()
    const service = createProgressService(fakeApi({
      getProgress: async () => { throw new ApiError(401, 'Session expired') },
    }), { onUnauthorized, onError })

    await service.load()

    expect(onUnauthorized).toHaveBeenCalledOnce()
    expect(onError).not.toHaveBeenCalled()
  })

  it('clears local progress only after DELETE succeeds', async () => {
    let resolveDelete!: () => void
    const deleteProgress = vi.fn(() => new Promise<void>(resolve => { resolveDelete = resolve }))
    const service = createProgressService(fakeApi({ deleteProgress }), {
      onUnauthorized: vi.fn(),
      onError: vi.fn(),
    })
    service.seed([progress(1, true, 90)])

    const resetting = service.resetAll()
    expect(service.getSnapshot().data).toHaveProperty('1')

    resolveDelete()
    await resetting
    expect(service.getSnapshot()).toEqual({ status: 'ready', data: {} })
  })

  it('does not let an older reset completion clear progress saved afterward', async () => {
    let resolveDelete!: () => void
    const service = createProgressService(fakeApi({
      deleteProgress: () => new Promise<void>(resolve => { resolveDelete = resolve }),
    }), { onUnauthorized: vi.fn(), onError: vi.fn() })
    service.seed([progress(1, true, 90)])

    const resetting = service.resetAll()
    await service.saveStep(progress(2, true, 60))
    resolveDelete()
    await resetting

    expect(service.getSnapshot().data).toMatchObject({
      1: progress(1, true, 90),
      2: progress(2, true, 60),
    })
  })

  it('clears progress when a reset starts during a load and GET resolves first', async () => {
    let resolveLoad!: (rows: Awaited<ReturnType<ApiService['getProgress']>>) => void
    let resolveDelete!: () => void
    const service = createProgressService(fakeApi({
      getProgress: () => new Promise(resolve => { resolveLoad = resolve }),
      deleteProgress: () => new Promise<void>(resolve => { resolveDelete = resolve }),
    }), { onUnauthorized: vi.fn(), onError: vi.fn() })
    service.seed([progress(1, true, 90)])

    const loading = service.load()
    const resetting = service.resetAll()
    resolveLoad([{
      wordId: 2,
      completed: { pinyin: true, hanzi: true, english: true },
      starsEarned: 60,
    }])
    await loading
    resolveDelete()
    await resetting

    expect(service.getSnapshot()).toEqual({ status: 'ready', data: {} })
  })

  it('restores stable progress after a reset fails and lets an earlier GET settle', async () => {
    let resolveLoad!: (rows: Awaited<ReturnType<ApiService['getProgress']>>) => void
    let rejectDelete!: (error: Error) => void
    const before = progress(1, true, 90)
    const service = createProgressService(fakeApi({
      getProgress: () => new Promise(resolve => { resolveLoad = resolve }),
      deleteProgress: () => new Promise<void>((_resolve, reject) => { rejectDelete = reject }),
    }), { onUnauthorized: vi.fn(), onError: vi.fn() })
    service.seed([before])

    const loading = service.load()
    const resetting = service.resetAll()
    rejectDelete(new Error('delete failed'))
    await expect(resetting).rejects.toThrow('delete failed')

    expect(service.getSnapshot()).toEqual({ status: 'ready', data: { 1: before } })

    resolveLoad([{
      wordId: 2,
      completed: { pinyin: true, hanzi: true, english: true },
      starsEarned: 60,
    }])
    await loading

    expect(service.getSnapshot()).toMatchObject({
      status: 'ready',
      data: { 2: { wordId: 2, starsEarned: 60 } },
    })
  })

  it('does not let a GET started during reset repopulate after DELETE succeeds first', async () => {
    let resolveLoad!: (rows: Awaited<ReturnType<ApiService['getProgress']>>) => void
    let resolveDelete!: () => void
    const service = createProgressService(fakeApi({
      getProgress: () => new Promise(resolve => { resolveLoad = resolve }),
      deleteProgress: () => new Promise<void>(resolve => { resolveDelete = resolve }),
    }), { onUnauthorized: vi.fn(), onError: vi.fn() })
    service.seed([progress(1, true, 90)])

    const resetting = service.resetAll()
    const loading = service.load()
    resolveDelete()
    await resetting
    resolveLoad([{
      wordId: 1,
      completed: { pinyin: true, hanzi: true, english: true },
      starsEarned: 90,
    }])
    await loading

    expect(service.getSnapshot()).toEqual({ status: 'ready', data: {} })
  })

  it('keeps local progress and rejects when DELETE fails', async () => {
    const onError = vi.fn()
    const before = progress(1, true, 90)
    const service = createProgressService(fakeApi({
      deleteProgress: async () => { throw new Error('delete failed') },
    }), { onUnauthorized: vi.fn(), onError })
    service.seed([before])

    await expect(service.resetAll()).rejects.toThrow('delete failed')

    expect(service.getSnapshot()).toEqual({ status: 'ready', data: { 1: before } })
    expect(onError).toHaveBeenCalledWith('delete failed')
  })

  it('optimistically saves a complete progress map and rolls it back on failure', async () => {
    const service = createProgressService(fakeApi({
      putProgress: async () => { throw new Error('offline') },
    }), { onUnauthorized: vi.fn(), onError: vi.fn() })
    const before = progress(1)
    service.seed([before])

    const saving = service.saveAll({ 2: progress(2, true, 90) })
    expect(service.getSnapshot().data[2]).toEqual(progress(2, true, 90))

    await expect(saving).rejects.toThrow('offline')
    expect(service.getSnapshot().data).toEqual({ 1: before })
  })

  it('keeps monotonic completion and stars when saveAll receives regressive rows', async () => {
    const service = createProgressService(fakeApi(), { onUnauthorized: vi.fn(), onError: vi.fn() })
    service.seed([progress(1, true, 90)])

    await service.saveAll({ 1: progress(1, false, 0) })

    expect(service.getSnapshot().data[1]).toMatchObject({
      completed: { pinyin: true, hanzi: true, english: true },
      starsEarned: 90,
    })
  })

  it('retains rows omitted from saveAll input', async () => {
    const service = createProgressService(fakeApi(), { onUnauthorized: vi.fn(), onError: vi.fn() })
    service.seed([progress(1, true, 90)])

    await service.saveAll({ 2: progress(2, true, 60) })

    expect(service.getSnapshot().data).toMatchObject({
      1: progress(1, true, 90),
      2: progress(2, true, 60),
    })
  })

  it('notifies active subscribers once for each published snapshot', () => {
    const service = createProgressService(fakeApi(), { onUnauthorized: vi.fn(), onError: vi.fn() })
    const listener = vi.fn()
    const unsubscribe = service.subscribe(listener)

    service.seed([progress(1)])
    unsubscribe()
    service.seed([progress(2)])

    expect(listener).toHaveBeenCalledOnce()
  })

  it('uses frozen, referentially stable snapshots and publishes a new one per mutation', () => {
    const service = createProgressService(fakeApi(), { onUnauthorized: vi.fn(), onError: vi.fn() })
    const initial = service.getSnapshot()
    expect(service.getSnapshot()).toBe(initial)
    expect(Object.isFrozen(initial)).toBe(true)

    service.seed([progress(1)])
    const seeded = service.getSnapshot()
    expect(seeded).not.toBe(initial)
    expect(Object.isFrozen(seeded.data)).toBe(true)
    expect(Object.isFrozen(seeded.data[1])).toBe(true)
    expect(Object.isFrozen(seeded.data[1].completed)).toBe(true)
  })
})
