import { describe, expect, it, vi } from 'vitest'
import { createPinyinProgressService, mergeClear } from './pinyin-progress'
import type { ApiService, PinyinProgressData } from '@/shared/services'

const EMPTY: PinyinProgressData = { stars: {}, totalStars: 0 }

function fakeApi(overrides: Partial<ApiService> = {}): ApiService {
  return {
    getPinyinProgress: vi.fn().mockResolvedValue(EMPTY),
    putPinyinProgress: vi.fn().mockResolvedValue(undefined),
    deletePinyinProgress: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as ApiService
}

const callbacks = { onUnauthorized: vi.fn(), onError: vi.fn() }

describe('拼音进度服务', () => {
  // 重玩拿一星不该把三星冲掉 —— 服务端取 max,本地这一层也必须先取 max。
  it('mergeClear 星级取 max、星尘累加', () => {
    const base: PinyinProgressData = { stars: { 'u1-0': 3 }, totalStars: 10 }
    expect(mergeClear(base, { levelId: 'u1-0', stars: 1, starDust: 5 }))
      .toEqual({ stars: { 'u1-0': 3 }, totalStars: 15 })
    expect(mergeClear(base, { levelId: 'u1-1', stars: 2, starDust: 0 }))
      .toEqual({ stars: { 'u1-0': 3, 'u1-1': 2 }, totalStars: 10 })
  })

  // 服务端确认前就该显示为已通关 —— 孩子拼完抬头看,星星必须已经在那。
  it('recordClear 立刻可见,不必等服务端', async () => {
    let resolvePut: (() => void) | undefined
    const api = fakeApi({
      putPinyinProgress: vi.fn(() => new Promise<void>((resolve) => { resolvePut = () => resolve() })),
    })
    const service = createPinyinProgressService(api, callbacks)
    const pending = service.recordClear({ levelId: 'u1-0', stars: 3, starDust: 10 })
    expect(service.getSnapshot().data.stars['u1-0']).toBe(3)
    expect(service.getSnapshot().data.totalStars).toBe(10)
    resolvePut?.()
    await pending
    expect(service.getSnapshot().data.totalStars).toBe(10)
  })

  it('写失败要报错且乐观值回退', async () => {
    const api = fakeApi({ putPinyinProgress: vi.fn().mockRejectedValue(new Error('boom')) })
    const service = createPinyinProgressService(api, callbacks)
    await expect(service.recordClear({ levelId: 'u1-0', stars: 3, starDust: 10 })).rejects.toThrow('boom')
    expect(service.getSnapshot().data.stars).toEqual({})
  })

  // 星尘只增不减且服务端只取 MAX —— 同一笔星尘被计两次就**永久**多出来,只有 DELETE 能救。
  // 提交的是「已 merge 本地的全量」:重试提交的字节与首次完全相同,MAX 下重放是幂等的。
  it('写失败回退后重试,同一笔星尘只计一次', async () => {
    const put = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined)
    const api = fakeApi({ putPinyinProgress: put })
    const service = createPinyinProgressService(api, callbacks)
    await expect(service.recordClear({ levelId: 'u1-0', stars: 3, starDust: 10 })).rejects.toThrow('boom')
    expect(service.getSnapshot().data).toEqual({ stars: {}, totalStars: 0 })
    await service.recordClear({ levelId: 'u1-0', stars: 3, starDust: 10 })
    expect(put.mock.calls[1]?.[0]).toEqual(put.mock.calls[0]?.[0])
    expect(service.getSnapshot().data).toEqual({ stars: { 'u1-0': 3 }, totalStars: 10 })
  })

  // 重置与 in-flight 的 GET 抢跑:reset 之后落地的旧响应不能把数据复活。
  it('resetAll 之后,抢跑的 load 结果不复活旧数据', async () => {
    let resolveGet: ((data: PinyinProgressData) => void) | undefined
    const api = fakeApi({
      getPinyinProgress: vi.fn(() => new Promise<PinyinProgressData>((resolve) => { resolveGet = resolve })),
    })
    const service = createPinyinProgressService(api, callbacks)
    const loading = service.load()
    await service.resetAll()
    resolveGet?.({ stars: { 'u1-0': 3 }, totalStars: 100 })
    await loading
    expect(service.getSnapshot().data).toEqual({ stars: {}, totalStars: 0 })
  })
})
