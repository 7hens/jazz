import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import workerPinyinSource from '../../../worker/pinyin-progress.ts?raw'
import type { ApiService, ApiUserSettings, ApiWordProgress } from '@/shared/services/api'
import { MAX_SENTENCE_LEVEL } from '@/shared/services'
import type { ApiBasicsProgressRow, ApiChapterProgressRow, BasicsProgressRow, ChapterProgressRow, UserSettings, WordProgress } from '@/shared/services'
import { createHttpApiService, LEVEL_ID } from './api'

const user = { id: 'u', email: 'e', name: 'n' }
const progress = [{
  wordId: 1,
  completed: { pinyin: true, hanzi: false, english: false },
  sentenceLevel: 0,
  bonusGranted: false,
  starsEarned: 30,
  updatedAt: '2026-09-04T00:00:00.000Z',
}]
const workerProgress = [{
  wordId: 1,
  completed: { pinyin: true, hanzi: false, english: false },
  sentenceLevel: 0,
  bonusGranted: false,
  starsEarned: 30,
}]
const settings = {
  enableChinese: true,
  enableEnglish: true,
  earnedAchievements: ['first-word'],
  consecutiveDays: 3,
  lastActiveDate: '2026-09-04',
  updatedAt: '2026-09-04T00:00:00.000Z',
}
const workerSettings = {
  enableChinese: true,
  enableEnglish: true,
  earnedAchievements: ['first-word'],
  consecutiveDays: 3,
  lastActiveDate: '2026-09-04',
}
const basicsRows: BasicsProgressRow[] = [{
  unitKey: 'pinyin:b',
  state: 'known',
  correctStreak: 2,
  taughtCount: 3,
  updatedAt: '2026-09-04T00:00:00.000Z',
}]
const workerBasicsRows = [{
  unitKey: 'pinyin:b',
  state: 'known',
  correctStreak: 2,
  taughtCount: 3,
}]
const workerChapterRow: ApiChapterProgressRow = {
  chapterId: 1,
  resumeSceneId: 't1-core',
  restoreState: '[]',
}
const chapterRow: ChapterProgressRow = {
  ...workerChapterRow,
  updatedAt: '2026-09-08T00:00:00.000Z',
}

describe('HTTP API service', () => {
  it('exposes timestamp-free Worker shapes for GET responses', () => {
    expectTypeOf<ApiService['getProgress']>().returns.toEqualTypeOf<Promise<ApiWordProgress[]>>()
    expectTypeOf<ApiService['getSettings']>().returns.toEqualTypeOf<Promise<ApiUserSettings>>()
    expectTypeOf<ApiService['getBasicsProgress']>().returns.toEqualTypeOf<Promise<ApiBasicsProgressRow[]>>()
    expectTypeOf<ApiService['getChapterProgress']>().returns.toEqualTypeOf<Promise<ApiChapterProgressRow | null>>()
    expectTypeOf<ApiWordProgress>().toEqualTypeOf<Omit<WordProgress, 'updatedAt'>>()
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

  it('returns progress from the Worker envelope', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ progress: workerProgress }), { status: 200 }))

    await expect(createHttpApiService(fetcher).getProgress()).resolves.toEqual(workerProgress)
    expect(fetcher).toHaveBeenCalledWith('/api/progress', { credentials: 'include' })
  })

  it('serializes progress under the existing envelope', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ ok: true, updated: 1 }), { status: 200 }))

    await createHttpApiService(fetcher).putProgress(progress)

    expect(fetcher).toHaveBeenCalledWith('/api/progress', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progress }),
    })
  })

  it('sends the progress reset request with its existing method', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))

    await createHttpApiService(fetcher).deleteProgress()

    expect(fetcher).toHaveBeenCalledWith('/api/progress', { method: 'DELETE', credentials: 'include' })
  })

  it('returns settings from the Worker envelope', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ settings: workerSettings }), { status: 200 }))

    await expect(createHttpApiService(fetcher).getSettings()).resolves.toEqual(workerSettings)
    expect(fetcher).toHaveBeenCalledWith('/api/settings', { credentials: 'include' })
  })

  it.each([0, 104])('rejects a progress response with out-of-range word ID %s', async (wordId) => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      progress: [{ ...workerProgress[0], wordId }],
    }), { status: 200 }))

    await expect(createHttpApiService(fetcher).getProgress()).rejects.toMatchObject({
      status: 200,
      message: 'Invalid API response',
    })
  })

  it('rejects a progress response with an out-of-range sentenceLevel', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      progress: [{ ...workerProgress[0], sentenceLevel: 4 }],
    }), { status: 200 }))

    await expect(createHttpApiService(fetcher).getProgress()).rejects.toMatchObject({
      status: 200,
      message: 'Invalid API response',
    })
  })

  // 锚定:api 的字面量上限必须与 shared MAX_SENTENCE_LEVEL 同步(改了常量而 api 忘改 → 此处红)。
  it('sentenceLevel 上限锚定 MAX_SENTENCE_LEVEL(上限接受 / +1 拒绝)', async () => {
    const ok = vi.fn(async () => new Response(JSON.stringify({
      progress: [{ ...workerProgress[0], sentenceLevel: MAX_SENTENCE_LEVEL }],
    }), { status: 200 }))
    await expect(createHttpApiService(ok).getProgress()).resolves.toHaveLength(1)

    const bad = vi.fn(async () => new Response(JSON.stringify({
      progress: [{ ...workerProgress[0], sentenceLevel: MAX_SENTENCE_LEVEL + 1 }],
    }), { status: 200 }))
    await expect(createHttpApiService(bad).getProgress()).rejects.toMatchObject({
      status: 200,
      message: 'Invalid API response',
    })
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
          enableChinese: true,
          enableEnglish: true,
          earnedAchievements: ['first-word'],
          consecutiveDays: 3,
          lastActiveDate: '2026-09-04',
        },
      }),
    })
  })

  it('serializes a partial-off settings body carrying an explicit false', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    const partialOff = { ...settings, enableEnglish: false }

    await createHttpApiService(fetcher).putSettings(partialOff)

    expect(fetcher).toHaveBeenCalledWith('/api/settings', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settings: {
          enableChinese: true,
          enableEnglish: false,
          earnedAchievements: ['first-word'],
          consecutiveDays: 3,
          lastActiveDate: '2026-09-04',
        },
      }),
    })
  })

  it('returns basics rows from the Worker envelope', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ rows: workerBasicsRows }), { status: 200 }))

    await expect(createHttpApiService(fetcher).getBasicsProgress()).resolves.toEqual(workerBasicsRows)
    expect(fetcher).toHaveBeenCalledWith('/api/basics-progress', { credentials: 'include' })
  })

  it('serializes basics rows under the existing envelope', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))

    await createHttpApiService(fetcher).putBasicsProgress(basicsRows)

    expect(fetcher).toHaveBeenCalledWith('/api/basics-progress', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: basicsRows }),
    })
  })

  it('throws ApiError when the basics PUT is not ok', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ message: 'boom' }), { status: 500 }))

    await expect(createHttpApiService(fetcher).putBasicsProgress(basicsRows)).rejects.toMatchObject({
      status: 500,
      message: 'boom',
    })
  })

  it('rejects a basics response with a malformed row', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      rows: [{ ...workerBasicsRows[0], state: 'mastered' }],
    }), { status: 200 }))

    await expect(createHttpApiService(fetcher).getBasicsProgress()).rejects.toMatchObject({
      status: 200,
      message: 'Invalid API response',
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

  it('returns the chapter progress row from the Worker envelope', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ row: workerChapterRow }), { status: 200 }))

    await expect(createHttpApiService(fetcher).getChapterProgress()).resolves.toEqual(workerChapterRow)
    expect(fetcher).toHaveBeenCalledWith('/api/chapter-progress', { credentials: 'include' })
  })

  it('resolves getChapterProgress to null when the Worker has no row', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ row: null }), { status: 200 }))

    await expect(createHttpApiService(fetcher).getChapterProgress()).resolves.toBeNull()
  })

  it('rejects a chapter progress response with a malformed row', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      row: { ...workerChapterRow, chapterId: 'one' },
    }), { status: 200 }))

    await expect(createHttpApiService(fetcher).getChapterProgress()).rejects.toMatchObject({
      status: 200,
      message: 'Invalid API response',
    })
  })

  it('serializes the chapter row under the envelope without the client timestamp', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))

    await createHttpApiService(fetcher).putChapterProgress(chapterRow)

    expect(fetcher).toHaveBeenCalledWith('/api/chapter-progress', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        row: { chapterId: 1, resumeSceneId: 't1-core', restoreState: '[]' },
      }),
    })
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
