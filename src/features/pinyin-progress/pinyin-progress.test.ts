import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/shared/services'
import { LOCAL_PROGRESS_KEY } from './local-store'
import { createPinyinProgressService, mergeClear } from './pinyin-progress'
import type { ApiService, PinyinProgressData } from '@/shared/services'

const EMPTY: PinyinProgressData = { stars: {}, totalStars: 0 }

/**
 * 兜底副本一律注入这份内存假货,不靠环境:在 vitest 下 `window.localStorage` 实测是
 * undefined(jsdom 裸用明明有,被 Node 26 的同名全局盖掉了)—— 靠环境就等于**测量不到**
 * 自己有没有在写副本,绿着什么都不做。顺带让每条用例的副本互不串味。
 */
function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  } as unknown as Storage
}

function seedLocal(data: PinyinProgressData) {
  return memoryStorage({ [LOCAL_PROGRESS_KEY]: JSON.stringify(data) })
}

function readLocal(storage: Storage): PinyinProgressData | null {
  const raw = storage.getItem(LOCAL_PROGRESS_KEY)
  return raw === null ? null : JSON.parse(raw)
}

let storage: Storage

function service(api: ApiService) {
  return createPinyinProgressService(api, callbacks, { storage })
}

/** 让已在飞的 promise 全部落地。 */
function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

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
  storage = memoryStorage()
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

describe('进度兜底副本', () => {
  // 这条就是那个事故的回归测试:服务端整行没了,孩子下一次打开必须还是原来那些星。
  it('服务端空了也丢不掉进度:本地副本把它捞回来', async () => {
    storage = seedLocal({ stars: { 'u1-0': 3 }, totalStars: 120 })
    const progress = service(fakeApi())
    await progress.load()
    expect(progress.getSnapshot().data).toEqual({ stars: { 'u1-0': 3 }, totalStars: 120 })
  })

  // 只救回显示还不够 —— 服务端得自己长回来,否则副本一没(换设备/清浏览器)就真没了。
  it('发现服务端落后就把并集补回去', async () => {
    storage = seedLocal({ stars: { 'u1-0': 3 }, totalStars: 120 })
    const put = vi.fn().mockResolvedValue(undefined)
    const progress = service(fakeApi({
      getPinyinProgress: vi.fn().mockResolvedValue({ stars: { 'u1-1': 2 }, totalStars: 5 }),
      putPinyinProgress: put,
    }))
    await progress.load()
    await flush()
    // 服务端已有的那关不能被副本盖掉 —— 两边的关都要在。
    expect(put).toHaveBeenCalledWith({ stars: { 'u1-0': 3, 'u1-1': 2 }, totalStars: 120 })
  })

  it('服务端不落后就不多发一次写', async () => {
    storage = seedLocal({ stars: { 'u1-0': 3 }, totalStars: 120 })
    const put = vi.fn().mockResolvedValue(undefined)
    const progress = service(fakeApi({
      getPinyinProgress: vi.fn().mockResolvedValue({ stars: { 'u1-0': 3 }, totalStars: 120 }),
      putPinyinProgress: put,
    }))
    await progress.load()
    await flush()
    expect(put).not.toHaveBeenCalled()
  })

  // 补写是后台动作:孩子刚打开页面就弹一个红 toast 说「同步失败」是纯噪音,而且数据并没丢。
  it('补写失败不弹错、也不影响已经在屏幕上的进度', async () => {
    storage = seedLocal({ stars: { 'u1-0': 3 }, totalStars: 120 })
    const progress = service(fakeApi({ putPinyinProgress: vi.fn().mockRejectedValue(new Error('repair-boom')) }))
    await progress.load()
    await flush()
    expect(callbacks.onError).not.toHaveBeenCalled()
    expect(progress.getSnapshot().data).toEqual({ stars: { 'u1-0': 3 }, totalStars: 120 })
  })

  it('补写不影响随后启动的 load 落地', async () => {
    storage = seedLocal({ stars: { 'u1-0': 3 }, totalStars: 120 })
    let resolveGet: ((data: PinyinProgressData) => void) | undefined
    const progress = service(fakeApi({
      getPinyinProgress: vi.fn(() => new Promise<PinyinProgressData>((resolve) => { resolveGet = resolve })),
    }))
    const first = progress.load()
    resolveGet?.({ stars: { 'u1-1': 2 }, totalStars: 5 })
    await first
    const second = progress.load()
    resolveGet?.({ stars: { 'u1-2': 1 }, totalStars: 7 })
    await second
    expect(progress.getSnapshot().status).toBe('ready')
    expect(progress.getSnapshot().data.stars).toEqual({ 'u1-0': 3, 'u1-1': 2, 'u1-2': 1 })
  })

  // 补写若把自己记成「用户动作」,就会把几乎同时开始的重置误判成「重置期间孩子又通关了」——
  // 重置于是不清屏幕也不清副本,一次成功的重置看着像没生效。
  it('补写不被误记成用户动作:同时在飞的重置照样生效', async () => {
    storage = seedLocal({ stars: { 'u1-0': 3 }, totalStars: 120 })
    let resolveGet: ((data: PinyinProgressData) => void) | undefined
    let resolveDelete: (() => void) | undefined
    const progress = service(fakeApi({
      getPinyinProgress: vi.fn(() => new Promise<PinyinProgressData>((resolve) => { resolveGet = resolve })),
      deletePinyinProgress: vi.fn(() => new Promise<void>((resolve) => { resolveDelete = () => resolve() })),
    }))
    const loading = progress.load()
    const resetting = progress.resetAll()
    resolveGet?.({ stars: {}, totalStars: 0 })
    await loading
    await flush()
    resolveDelete?.()
    await resetting
    expect(progress.getSnapshot().data).toEqual(EMPTY)
    expect(storage.getItem(LOCAL_PROGRESS_KEY)).toBeNull()
  })

  it('坏掉的副本被忽略,以服务端为准', async () => {
    storage = memoryStorage({ [LOCAL_PROGRESS_KEY]: '{"stars":{"u1-0":99}' })
    const progress = service(fakeApi({
      getPinyinProgress: vi.fn().mockResolvedValue({ stars: { 'u1-0': 3 }, totalStars: 120 }),
    }))
    await progress.load()
    expect(progress.getSnapshot().data).toEqual({ stars: { 'u1-0': 3 }, totalStars: 120 })
    expect(readLocal(storage)).toEqual({ stars: { 'u1-0': 3 }, totalStars: 120 })
  })

  // 副本若是把服务端会 400 的键也吞下去,坏掉的就不只是显示 —— 之后每一次 PUT(通关、自愈)
  // 都会被整份打回来,孩子再也存不进任何进度。所以格式不对要**整份**当没有,而不是逐条筛。
  it('副本里混进服务端会拒的关 id 时整份丢弃,之后通关仍写得进去', async () => {
    storage = memoryStorage({
      [LOCAL_PROGRESS_KEY]: JSON.stringify({ stars: { 'not-a-level': 3, 'u1-0': 3 }, totalStars: 120 }),
    })
    const put = vi.fn().mockResolvedValue(undefined)
    const progress = service(fakeApi({ putPinyinProgress: put }))
    await progress.load()
    await progress.recordClear({ levelId: 'u1-1', stars: 3, starDust: 10 })
    expect(put).toHaveBeenCalledWith({ stars: { 'u1-1': 3 }, totalStars: 10 })
  })

  // 兜底副本不能是「只在 load 时读一次」的死物 —— 不然这次通关的星下次打开就没了。
  it('通关落地后副本跟着更新', async () => {
    const progress = service(fakeApi())
    await progress.recordClear({ levelId: 'u1-0', stars: 3, starDust: 10 })
    expect(readLocal(storage)).toEqual({ stars: { 'u1-0': 3 }, totalStars: 10 })
  })

  // 没存下来的值不许进副本:进了的话,下次一打开就会「复活」一笔服务端从来没有过的星尘。
  it('写失败回退后副本不保留乐观值', async () => {
    const progress = service(fakeApi({ putPinyinProgress: vi.fn().mockRejectedValue(new Error('boom')) }))
    await expect(progress.recordClear({ levelId: 'u1-0', stars: 3, starDust: 10 })).rejects.toThrow('boom')
    expect(readLocal(storage)?.stars).toEqual({})
    expect(readLocal(storage)?.totalStars).toBe(0)
  })

  // 重置若不清副本,下次 load 会拿它把刚清掉的进度原样顶回来 —— 重置等于没做。
  it('重置成功后副本被清,再 load 也不复活', async () => {
    storage = seedLocal({ stars: { 'u1-0': 3 }, totalStars: 120 })
    const progress = service(fakeApi({ getPinyinProgress: vi.fn().mockResolvedValue(EMPTY) }))
    await progress.load()
    await flush()
    await progress.resetAll()
    expect(storage.getItem(LOCAL_PROGRESS_KEY)).toBeNull()
    await progress.load()
    await flush()
    expect(progress.getSnapshot().data).toEqual(EMPTY)
  })
})
