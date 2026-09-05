import { describe, expect, it, vi } from 'vitest'
import type { ApiBasicsProgressRow, ApiService } from '@/shared/services'
import { createBasicsService } from './basics-service'

function fakeApi(): ApiService {
  return {
    me: vi.fn(), login: vi.fn(), logout: vi.fn(),
    getProgress: vi.fn(async () => []), putProgress: vi.fn(), deleteProgress: vi.fn(),
    getSettings: vi.fn(async () => ({ enablePinyin: true, enableHanzi: true, enableEnglish: true, earnedAchievements: [], consecutiveDays: 0, lastActiveDate: '' })),
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
})
