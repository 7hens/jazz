import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/shared/services'
import type { ApiBasicsProgressRow, ApiService } from '@/shared/services'
import { createBasicsService } from './basics-service'

function fakeApi(): ApiService {
  return {
    me: vi.fn(), login: vi.fn(), logout: vi.fn(),
    getProgress: vi.fn(async () => []), putProgress: vi.fn(), deleteProgress: vi.fn(),
    getSettings: vi.fn(async () => ({ enableChinese: true, enableEnglish: true, earnedAchievements: [], consecutiveDays: 0, lastActiveDate: '' })),
    putSettings: vi.fn(),
    getBasicsProgress: vi.fn(async () => []),
    putBasicsProgress: vi.fn(async () => undefined),
  }
}

describe('BasicsService', () => {
  it('load 拉全量入 snapshot', async () => {
    const api = fakeApi()
    const row: ApiBasicsProgressRow = { unitKey: 'pinyin:p', state: 'known', correctStreak: 2, taughtCount: 1 }
    vi.mocked(api.getBasicsProgress).mockResolvedValue([row])
    const svc = createBasicsService(api, { onUnauthorized: () => {}, onError: () => {} })
    await svc.load()
    const snap = svc.getSnapshot()
    expect(snap.status).toBe('ready')
    expect((snap as { data: Record<string, unknown> }).data['pinyin:p']).toBeDefined()
  })

  it('recordAnswer 答对后 persists 更新行并乐观入 snapshot', async () => {
    const api = fakeApi()
    const svc = createBasicsService(api, { onUnauthorized: () => {}, onError: () => {} })
    await svc.recordAnswer('pinyin:ing', true)
    const snap = svc.getSnapshot()
    const row = (snap as { data: Record<string, { state: string; correctStreak: number }> }).data['pinyin:ing']
    expect(row.state).toBe('learning')
    expect(row.correctStreak).toBe(1)
    expect(api.putBasicsProgress).toHaveBeenCalledTimes(1)
    const sent = (api.putBasicsProgress as ReturnType<typeof vi.fn>).mock.calls[0][0] as Array<{ unitKey: string }>
    expect(sent[0].unitKey).toBe('pinyin:ing')
  })

  it('markTaught 自增 taughtCount', async () => {
    const api = fakeApi()
    const svc = createBasicsService(api, { onUnauthorized: () => {}, onError: () => {} })
    await svc.markTaught(['pinyin:p', 'pinyin:ing'])
    const snap = svc.getSnapshot()
    const row = (snap as { data: Record<string, { taughtCount: number }> }).data['pinyin:ing']
    expect(row.taughtCount).toBe(1)
    expect(api.putBasicsProgress).toHaveBeenCalledTimes(1)
  })

  it('saveAll 批量基线', async () => {
    const api = fakeApi()
    const svc = createBasicsService(api, { onUnauthorized: () => {}, onError: () => {} })
    await svc.saveAll([{ unitKey: 'english:a', state: 'known', correctStreak: 2, taughtCount: 1, updatedAt: new Date().toISOString() }])
    expect(api.putBasicsProgress).toHaveBeenCalledTimes(1)
    expect(svc.getSnapshot().status).toBe('ready')
  })

  it('recordAnswer: PUT 拒收(通用错)→ 回滚到前值 + onError + 重抛', async () => {
    const api = fakeApi()
    const onError = vi.fn()
    const onUnauthorized = vi.fn()
    vi.mocked(api.getBasicsProgress).mockResolvedValue([
      { unitKey: 'pinyin:p', state: 'known', correctStreak: 2, taughtCount: 1 },
    ])
    const svc = createBasicsService(api, { onUnauthorized, onError })
    await svc.load()
    vi.mocked(api.putBasicsProgress).mockRejectedValueOnce(new Error('net down'))
    await expect(svc.recordAnswer('pinyin:p', true)).rejects.toThrow('net down')
    const row = (svc.getSnapshot().data as Record<string, { state: string; correctStreak: number }>)['pinyin:p']
    expect(row).toBeDefined()
    expect(row.state).toBe('known')
    expect(row.correctStreak).toBe(2)
    expect(onError).toHaveBeenCalledWith('net down')
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('recordAnswer: PUT 拒收 → 全新单元不残留(回滚撤乐观层)', async () => {
    const api = fakeApi()
    const onError = vi.fn()
    const svc = createBasicsService(api, { onUnauthorized: () => {}, onError })
    vi.mocked(api.putBasicsProgress).mockRejectedValueOnce(new Error('boom'))
    await expect(svc.recordAnswer('pinyin:ü', true)).rejects.toThrow('boom')
    expect(svc.getSnapshot().status).toBe('idle')
    expect((svc.getSnapshot().data as Record<string, unknown>)['pinyin:ü']).toBeUndefined()
    expect(onError).toHaveBeenCalledWith('boom')
  })

  it('recordAnswer: 401 → onUnauthorized 且不触发 onError,并重抛', async () => {
    const api = fakeApi()
    const onError = vi.fn()
    const onUnauthorized = vi.fn()
    const svc = createBasicsService(api, { onUnauthorized, onError })
    vi.mocked(api.putBasicsProgress).mockRejectedValueOnce(new ApiError(401, '未授权'))
    await expect(svc.recordAnswer('english:a', true)).rejects.toThrow('未授权')
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(onError).not.toHaveBeenCalled()
  })

  it('markTaught: PUT 拒收(通用错)→ 回滚 taughtCount 前值 + onError + 重抛', async () => {
    const api = fakeApi()
    const onError = vi.fn()
    const onUnauthorized = vi.fn()
    vi.mocked(api.getBasicsProgress).mockResolvedValue([
      { unitKey: 'english:a', state: 'learning', correctStreak: 1, taughtCount: 2 },
    ])
    const svc = createBasicsService(api, { onUnauthorized, onError })
    await svc.load()
    vi.mocked(api.putBasicsProgress).mockRejectedValueOnce(new Error('boom'))
    await expect(svc.markTaught(['english:a'])).rejects.toThrow('boom')
    const row = (svc.getSnapshot().data as Record<string, { taughtCount: number }>)['english:a']
    expect(row).toBeDefined()
    expect(row.taughtCount).toBe(2)
    expect(onError).toHaveBeenCalledWith('boom')
  })
})
