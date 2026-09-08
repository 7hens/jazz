import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/shared/services'
import type { ApiService, ChapterProgressRow } from '@/shared/services'
import { createChapterService, emptyRow } from './chapter-progress'

function row(overrides: Partial<ChapterProgressRow> = {}): ChapterProgressRow {
  return {
    chapterId: 1,
    resumeSceneId: 't1-core',
    restoreState: '[]',
    updatedAt: '2026-09-08T00:00:00.000Z',
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
      enableChinese: true,
      enableEnglish: true,
      earnedAchievements: [],
      consecutiveDays: 0,
      lastActiveDate: '',
    }),
    putSettings: async () => undefined,
    getBasicsProgress: async () => [],
    putBasicsProgress: async () => undefined,
    getChapterProgress: async () => null,
    putChapterProgress: async () => undefined,
    ...overrides,
  }
}

describe('ChapterService', () => {
  it('starts idle with no persisted row', () => {
    const service = createChapterService(fakeApi(), { onUnauthorized: vi.fn(), onError: vi.fn() })

    expect(service.getSnapshot()).toMatchObject({ status: 'idle', data: { row: null } })
  })

  it('emptyRow 给出全新的第 1 章起始行', () => {
    const fresh = emptyRow()

    expect(fresh.chapterId).toBe(1)
    expect(fresh.resumeSceneId).toBeNull()
    expect(fresh.restoreState).toBe('[]')
    expect(fresh.updatedAt).not.toBe('')
  })

  it('publishes loading before normalizing the API row into a ready snapshot', async () => {
    let resolveLoad!: (value: Awaited<ReturnType<ApiService['getChapterProgress']>>) => void
    const service = createChapterService(fakeApi({
      getChapterProgress: () => new Promise(resolve => { resolveLoad = resolve }),
    }), { onUnauthorized: vi.fn(), onError: vi.fn() })

    const loading = service.load()
    expect(service.getSnapshot().status).toBe('loading')

    resolveLoad({ chapterId: 1, resumeSceneId: 'br1', restoreState: '[{"wordId":1,"layer":"sound"}]' })
    await loading

    expect(service.getSnapshot()).toMatchObject({
      status: 'ready',
      data: { row: { chapterId: 1, resumeSceneId: 'br1', restoreState: '[{"wordId":1,"layer":"sound"}]' } },
    })
    expect(service.getSnapshot().data.row?.updatedAt).not.toBe('')
  })

  it('load 无服务端行时暴露 ready null', async () => {
    const service = createChapterService(fakeApi({ getChapterProgress: async () => null }), {
      onUnauthorized: vi.fn(),
      onError: vi.fn(),
    })

    await service.load()

    expect(service.getSnapshot()).toMatchObject({ status: 'ready', data: { row: null } })
  })

  it('save 乐观置行、成功后 stable,并给 api 传不带 updatedAt 的行', async () => {
    let resolvePut!: () => void
    const putChapterProgress = vi.fn(() => new Promise<void>(resolve => { resolvePut = resolve }))
    const service = createChapterService(fakeApi({ putChapterProgress }), {
      onUnauthorized: vi.fn(),
      onError: vi.fn(),
    })
    const next = row({ resumeSceneId: 'br2', restoreState: '[{"wordId":1,"layer":"sound"}]' })

    const saving = service.save(next)
    expect(service.getSnapshot()).toEqual({ status: 'ready', data: { row: next } })

    resolvePut()
    await saving

    expect(service.getSnapshot()).toEqual({ status: 'ready', data: { row: next } })
    expect(putChapterProgress).toHaveBeenCalledWith({
      chapterId: 1,
      resumeSceneId: 'br2',
      restoreState: '[{"wordId":1,"layer":"sound"}]',
    })
  })

  it('rolls back an optimistic save, reports the failure, and rethrows', async () => {
    const onError = vi.fn()
    const service = createChapterService(fakeApi({
      putChapterProgress: async () => { throw new Error('offline') },
    }), { onUnauthorized: vi.fn(), onError })
    const before = service.getSnapshot()

    await expect(service.save(row({ resumeSceneId: 'br2' }))).rejects.toThrow('offline')

    expect(service.getSnapshot()).toEqual(before)
    expect(onError).toHaveBeenCalledWith('offline')
  })

  it('routes load 401 to onUnauthorized and reports the error snapshot', async () => {
    const onUnauthorized = vi.fn()
    const onError = vi.fn()
    const service = createChapterService(fakeApi({
      getChapterProgress: async () => { throw new ApiError(401, 'Session expired') },
    }), { onUnauthorized, onError })
    const before = service.getSnapshot().data

    await service.load()

    expect(service.getSnapshot()).toEqual({ status: 'error', data: before, error: 'Session expired' })
    expect(onUnauthorized).toHaveBeenCalledOnce()
    expect(onError).not.toHaveBeenCalled()
  })

  it('clear 清空行(null)并持久化第 1 章起始行', async () => {
    const putChapterProgress = vi.fn(async () => undefined)
    const service = createChapterService(fakeApi({
      getChapterProgress: async () => ({ chapterId: 1, resumeSceneId: 'boss', restoreState: '[{"wordId":1,"layer":"shape"}]' }),
      putChapterProgress,
    }), { onUnauthorized: vi.fn(), onError: vi.fn() })
    await service.load()
    expect(service.getSnapshot().data.row).not.toBeNull()

    const clearing = service.clear()
    expect(service.getSnapshot()).toEqual({ status: 'ready', data: { row: null } })

    await clearing
    expect(service.getSnapshot().data.row).toBeNull()
    expect(putChapterProgress).toHaveBeenCalledWith({ chapterId: 1, resumeSceneId: null, restoreState: '[]' })
  })

  it('clear 失败时滚回并报错', async () => {
    const onError = vi.fn()
    const service = createChapterService(fakeApi({
      getChapterProgress: async () => ({ chapterId: 1, resumeSceneId: 'br3', restoreState: '[]' }),
      putChapterProgress: async () => { throw new ApiError(500, 'db down') },
    }), { onUnauthorized: vi.fn(), onError })
    await service.load()
    const before = service.getSnapshot()

    await expect(service.clear()).rejects.toMatchObject({ status: 500, message: 'db down' })

    expect(service.getSnapshot()).toEqual(before)
    expect(onError).toHaveBeenCalledWith('db down')
  })

  it('freezes published snapshots and keeps row data immutable', () => {
    const service = createChapterService(fakeApi(), { onUnauthorized: vi.fn(), onError: vi.fn() })
    const initial = service.getSnapshot()

    expect(Object.isFrozen(initial)).toBe(true)
    expect(Object.isFrozen(initial.data)).toBe(true)
    expect(service.getSnapshot()).toBe(initial)
  })
})
