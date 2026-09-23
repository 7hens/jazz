import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/shared/services'
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

// 每条用例一份新 mock:模块级单例下,谁先调用谁就成了别人的「证据」——
// 删掉 report 也照样绿(断言收到的是别的用例的回声),且「文案各不相同」这种约定
// 没有任何东西在守,一次复制粘贴就漏回去。故连记录都不共享。
function makeCallbacks() {
  return { onUnauthorized: vi.fn(), onError: vi.fn() }
}

let callbacks: ReturnType<typeof makeCallbacks>

beforeEach(() => {
  callbacks = makeCallbacks()
})

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
    expect(callbacks.onError).toHaveBeenCalledWith('boom')
  })

  // 进度接口是最后一道(旧服务删光后还是唯一一道)—— 401 必须回登录态,不能只弹个红 toast。
  // 断言用计数 + 「一次都没调 onError」:`.not.toHaveBeenCalledWith(某文案)` 挡不住
  // 「既报 401 又顺手报一次别的错」这种双发,计数与 not 一起才把这一类堵死。
  it('401 走 onUnauthorized,不走普通报错,且只走一次', async () => {
    const api = fakeApi({
      getPinyinProgress: vi.fn().mockRejectedValue(new ApiError(401, 'unauthorized-401')),
    })
    const service = createPinyinProgressService(api, callbacks)
    const reportsBefore = callbacks.onUnauthorized.mock.calls.length
    await service.load()
    expect(callbacks.onUnauthorized).toHaveBeenCalledTimes(reportsBefore + 1)
    expect(callbacks.onError).not.toHaveBeenCalled()
    expect(service.getSnapshot().status).toBe('error')
  })

  // 失败的写只剩「历史」这一重身份:它若漏进可见值,孩子会看见一笔根本没存下来的星尘。
  // 此处刻意让失败那笔的数字**大于**在飞那笔 —— MAX 掩盖不了漏掉的那行 `continue`。
  it('失败的写躲在 pending 之后时不污染可见值', async () => {
    const puts: Array<{ resolve: () => void; reject: (error: unknown) => void }> = []
    const api = fakeApi({
      putPinyinProgress: vi.fn(() => new Promise<void>((resolve, reject) => { puts.push({ resolve, reject }) })),
    })
    const service = createPinyinProgressService(api, callbacks)
    const first = service.recordClear({ levelId: 'u1-0', stars: 3, starDust: 10 })
    const second = service.recordClear({ levelId: 'u1-1', stars: 1, starDust: 5 })
    puts[1]?.reject(new Error('second-boom'))
    await expect(second).rejects.toThrow('second-boom')
    expect(service.getSnapshot().data).toEqual({ stars: { 'u1-0': 3 }, totalStars: 10 })
    puts[0]?.resolve()
    await first
    expect(service.getSnapshot().data).toEqual({ stars: { 'u1-0': 3 }, totalStars: 10 })
  })

  // 累加基准必须是**含在飞乐观值**的可见值:两笔未落地时连通的第二关,两笔星尘都得在。
  // 换成 settled 基准 → 后一笔把前一笔的星尘冲掉,提交出去的也就少了一笔(且 MAX 救不回来)。
  it('乐观累加基准是可见值,不是在飞未落地的 settled', async () => {
    const puts: Array<() => void> = []
    // 显式标参数类型:否则 mock.calls 是零元 tuple,取 [1][0] 过不了 tsc。
    const put = vi.fn((_data: PinyinProgressData) => new Promise<void>((resolve) => { puts.push(resolve) }))
    const api = fakeApi({ putPinyinProgress: put })
    const service = createPinyinProgressService(api, callbacks)
    const first = service.recordClear({ levelId: 'u1-0', stars: 3, starDust: 10 })
    const second = service.recordClear({ levelId: 'u1-1', stars: 2, starDust: 50 })
    expect(put.mock.calls[1]?.[0]).toEqual({ stars: { 'u1-0': 3, 'u1-1': 2 }, totalStars: 60 })
    expect(service.getSnapshot().data).toEqual({ stars: { 'u1-0': 3, 'u1-1': 2 }, totalStars: 60 })
    puts.forEach((resolve) => resolve())
    await Promise.all([first, second])
    expect(service.getSnapshot().data).toEqual({ stars: { 'u1-0': 3, 'u1-1': 2 }, totalStars: 60 })
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

  // 失败要有人知道:静默吞掉的 reset 会让孩子以为存档清了,实际一条没删。
  it('resetAll 失败要报错', async () => {
    const api = fakeApi({ deletePinyinProgress: vi.fn().mockRejectedValue(new Error('reset-boom')) })
    const service = createPinyinProgressService(api, callbacks)
    await expect(service.resetAll()).rejects.toThrow('reset-boom')
    expect(callbacks.onError).toHaveBeenCalledWith('reset-boom')
  })
})
