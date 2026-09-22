import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import workerPinyinSource from '../../../worker/pinyin-progress.ts?raw'
import type { ApiService, ApiUserSettings } from '@/shared/services/api'
import type { UserSettings } from '@/shared/services'
import { createHttpApiService, LEVEL_ID } from './api'

const user = { id: 'u', email: 'e', name: 'n' }
const settings = {
  earnedAchievements: ['first-word'],
  consecutiveDays: 3,
  lastActiveDate: '2026-09-04',
  updatedAt: '2026-09-04T00:00:00.000Z',
}
const workerSettings = {
  earnedAchievements: ['first-word'],
  consecutiveDays: 3,
  lastActiveDate: '2026-09-04',
}

describe('HTTP API service', () => {
  it('exposes timestamp-free Worker shapes for GET responses', () => {
    expectTypeOf<ApiService['getSettings']>().returns.toEqualTypeOf<Promise<ApiUserSettings>>()
    expectTypeOf<ApiUserSettings>().toEqualTypeOf<Omit<UserSettings, 'updatedAt'>>()
  })

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

  it('拼音进度:GET 解析 stars 与 totalStars', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      stars: { 'u1-0': 3, 'u2-1': 2 },
      totalStars: 340,
    }), { status: 200 }))
    const api = createHttpApiService(fetcher)
    await expect(api.getPinyinProgress()).resolves.toEqual({
      stars: { 'u1-0': 3, 'u2-1': 2 },
      totalStars: 340,
    })
  })

  // 响应体不合法时整包被拒 —— 这是刻意的:宁可不写,也不要把半截数据当真相写进服务快照。
  it('拼音进度:响应里星数越界 → 抛 Invalid API response', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ stars: { 'u1-0': 9 }, totalStars: 0 }), { status: 200 }))
    const api = createHttpApiService(fetcher)
    await expect(api.getPinyinProgress()).rejects.toThrow('Invalid API response')
  })

  // 关卡 id 不合格式同样整包拒:放进来会成为一个永远点不到的幽灵关。
  it('拼音进度:响应里关卡 id 不合格式 → 抛 Invalid API response', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ stars: { 'unit-1': 3 }, totalStars: 0 }), { status: 200 }))
    const api = createHttpApiService(fetcher)
    await expect(api.getPinyinProgress()).rejects.toThrow('Invalid API response')
  })

  it('拼音进度:PUT 发 stars 与 totalStars 两个字段', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    const api = createHttpApiService(fetcher)
    await api.putPinyinProgress({ stars: { 'u1-0': 3 }, totalStars: 30 })
    const [path, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
    expect(path).toBe('/api/pinyin-progress')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(String(init.body))).toEqual({ stars: { 'u1-0': 3 }, totalStars: 30 })
  })

  it('拼音进度:DELETE 打同一个路径', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    const api = createHttpApiService(fetcher)
    await api.deletePinyinProgress()
    const [path, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
    expect(path).toBe('/api/pinyin-progress')
    expect(init.method).toBe('DELETE')
  })

  // 漂移锚定:api.ts 与 worker/pinyin-progress.ts 各自独立保留 LEVEL_ID 字面量(worker 不跨端 import)。
  // 两侧一旦分家,worker 的 parseStars 会**静默丢弃**格式不符的 key,而下一次 PUT 把过滤后的表写回 ——
  // 不是「进度看不见」,是「已得的星被永久抹掉」。本测试比较两条**真实定义**(worker 源码字面量 vs
  // LEVEL_ID.toString()),不在测试里再抄第三份正则。
  it('拼音进度:api 的 LEVEL_ID 与 worker 的字面量逐字一致', () => {
    const fromWorker = /const LEVEL_ID = (\/[^/\n]+\/[a-z]*)/.exec(workerPinyinSource)?.[1]

    expect(fromWorker, '没在 worker/pinyin-progress.ts 里搜到 `const LEVEL_ID = /.../` 字面量 —— 搜法失效或字面量被改名,请让本测试与 worker 同步').toBeDefined()
    expect(fromWorker, '关卡 id 格式两侧分家:必须同步改 src/features/api/api.ts 与 worker/pinyin-progress.ts 两处 LEVEL_ID(worker 会静默丢 key,下次保存即抹掉已得的星)').toBe(LEVEL_ID.toString())
    // 两侧一起改错也得红:格式必须仍认真实关卡 id(37 个,u1-0 … u7-4)。
    expect(LEVEL_ID.test('u1-0'), 'LEVEL_ID 已不认真实关卡 id —— 改回来的同时别忘了 worker/pinyin-progress.ts').toBe(true)
  })
})
