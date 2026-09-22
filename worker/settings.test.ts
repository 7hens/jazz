import { describe, expect, it } from 'vitest'
import worker from './index'
import type { Env } from './index'
import { handleGetSettings, handlePutSettings } from './settings'

// handler 级契约测试:证明的是「handler 发出的 SQL 文本与绑定参数符合契约」,
// 不是「D1 会按这个语义执行」—— 下面的假 DB **不执行 SQL**(见文件末的诚实边界)。
//
// 假 DB 刻意只做「记录 + 按 SQL 子串分派」,不做通用 SQL 引擎:记录点**只有 bind**,
// 而本仓库的 settings 两条路径(GET / PUT)都走 `prepare(...).bind(...)`,
// 所以 calls 就是 handler 真正带参发出的语句。
// 例外:`getSingleUser` 的 `SELECT id, email, name FROM users ...` 不 bind → 不入册;
// 它的 INSERT 分支会 bind(user 行不存在时)。本文件一律给上 user 行,把这条噪声路径关掉。
type Call = { sql: string; args: unknown[] }

type FakeStmt = {
  bind(...args: unknown[]): FakeStmt
  first(): Promise<unknown>
  run(): Promise<{ success: boolean }>
}

function makeDB(opts: {
  user?: { id: string; email: string; name: string } | null
  settingsRow?: Record<string, unknown> | null
}) {
  const calls: Call[] = []
  const stmt = (sql: string): FakeStmt => {
    const self: FakeStmt = {
      bind(...args: unknown[]) {
        calls.push({ sql, args })
        return self
      },
      async first() {
        if (/FROM users/i.test(sql)) return opts.user ?? null
        if (/FROM user_settings/i.test(sql)) return opts.settingsRow ?? null
        return null
      },
      async run() {
        return { success: true }
      },
    }
    return self
  }
  return { calls, DB: { prepare: stmt } }
}

const USER = { id: 'u1', email: 'admin@life.local', name: '私密用户' }

/** ADMIN_TOKEN 显式给值 → 与 import.meta.env.DEV 无关,dev / 非 dev 两侧行为一致。 */
function envWith(db: ReturnType<typeof makeDB>): Env {
  return { DB: db.DB, ADMIN_TOKEN: 'tok' } as unknown as Env
}

function getRequest(cookie?: string) {
  return new Request('http://localhost/api/settings', {
    headers: cookie ? { Cookie: cookie } : {},
  })
}

function putRequest(body: string, cookie = 'jazz_token=tok') {
  return new Request('http://localhost/api/settings', {
    method: 'PUT',
    headers: { Cookie: cookie },
    body,
  })
}

/** PUT 落库的那条 INSERT —— 记在 calls 里的唯一一条 INSERT。 */
function insertCall(calls: Call[]): Call {
  const insert = calls.find((c) => /INSERT INTO user_settings/i.test(c.sql))
  if (!insert) throw new Error(`没发 INSERT:${JSON.stringify(calls.map((c) => c.sql))}`)
  return insert
}

/** PUT 一次并回读落库参数(顺序 = [userId, earned, days, date, updatedAt])。 */
async function putAndReadArgs(
  settings: Record<string, unknown>,
): Promise<{ args: unknown[]; body: unknown }> {
  const db = makeDB({ user: USER, settingsRow: null })
  const res = await handlePutSettings(putRequest(JSON.stringify({ settings })), envWith(db))
  return { args: insertCall(db.calls).args, body: await res.json() }
}

describe('settings · GET 契约', () => {
  // 无 cookie / 错 token 都在 getAuthenticatedUser 里就返回 null,一条 SQL 都不该发。
  it('无 cookie:401,且不碰库', async () => {
    const db = makeDB({ user: USER })
    const res = await handleGetSettings(getRequest(), envWith(db))
    expect(res.status).toBe(401)
    expect(db.calls).toEqual([])
  })

  it('错 token:401', async () => {
    const db = makeDB({ user: USER })
    const res = await handleGetSettings(getRequest('jazz_token=bad'), envWith(db))
    expect(res.status).toBe(401)
    expect(db.calls).toEqual([])
  })

  it('用户行在、user_settings 无行:给空默认值', async () => {
    const db = makeDB({ user: USER, settingsRow: null })
    const res = await handleGetSettings(getRequest('jazz_token=tok'), envWith(db))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      settings: { earnedAchievements: [], consecutiveDays: 0, lastActiveDate: '' },
    })
  })

  it('有行但三列为 null:同样给空默认值(不是 null 透传)', async () => {
    const db = makeDB({
      user: USER,
      settingsRow: { earned_achievements: null, consecutive_days: null, last_active_date: null },
    })
    const res = await handleGetSettings(getRequest('jazz_token=tok'), envWith(db))
    expect(await res.json()).toEqual({
      settings: { earnedAchievements: [], consecutiveDays: 0, lastActiveDate: '' },
    })
  })

  it('成就是 JSON 数组:原样解出来', async () => {
    const db = makeDB({
      user: USER,
      settingsRow: { earned_achievements: '["a","b"]', consecutive_days: 2, last_active_date: '2026-09-20' },
    })
    const res = await handleGetSettings(getRequest('jazz_token=tok'), envWith(db))
    expect(await res.json()).toEqual({
      settings: { earnedAchievements: ['a', 'b'], consecutiveDays: 2, lastActiveDate: '2026-09-20' },
    })
  })

  // 存量里的脏数据不该让整个接口 500,也不该把非 string 项带出去。
  it('坏 JSON / 空串 / 非数组 / 混入非 string:一律降级为空表或逐项过滤', async () => {
    const cases: Array<[raw: string, expected: string[]]> = [
      ['不是 json', []],
      ['', []],
      ['{}', []],
      ['["a",1,"b"]', ['a', 'b']],
    ]
    for (const [raw, expected] of cases) {
      const db = makeDB({
        user: USER,
        settingsRow: { earned_achievements: raw, consecutive_days: 0, last_active_date: '' },
      })
      const res = await handleGetSettings(getRequest('jazz_token=tok'), envWith(db))
      const body = (await res.json()) as { settings: { earnedAchievements: string[] } }
      expect(body.settings.earnedAchievements, `raw=${JSON.stringify(raw)}`).toEqual(expected)
    }
  })

  // 读的那条 SELECT 已经不再碰两列 —— 把列加回去就是今天零覆盖的回归(曾经全绿)。
  it('GET 发的 SELECT 不含 enable_chinese / enable_english', async () => {
    const db = makeDB({ user: USER, settingsRow: null })
    await handleGetSettings(getRequest('jazz_token=tok'), envWith(db))
    const select = db.calls.find((c) => /FROM user_settings/i.test(c.sql))
    expect(select, '没发 user_settings 的 SELECT').toBeDefined()
    expect(select?.sql).not.toContain('enable_chinese')
    expect(select?.sql).not.toContain('enable_english')
  })
})

describe('settings · PUT 契约', () => {
  it('body 里没有 settings 字段:400', async () => {
    const db = makeDB({ user: USER })
    const res = await handlePutSettings(putRequest(JSON.stringify({ foo: 1 })), envWith(db))
    expect(res.status).toBe(400)
  })

  it('body 不是 JSON:400', async () => {
    const db = makeDB({ user: USER })
    const res = await handlePutSettings(putRequest('not json'), envWith(db))
    expect(res.status).toBe(400)
  })

  // 列序与 ON CONFLICT 是这份契约的骨架:错一列,落库就是错位写入。
  it('合法 PUT:INSERT 列序完整、绑 5 个参数、第 5 个是 ISO 串', async () => {
    const db = makeDB({ user: USER })
    const res = await handlePutSettings(
      putRequest(
        JSON.stringify({
          settings: { earnedAchievements: ['a'], consecutiveDays: 3, lastActiveDate: '2026-09-21' },
        }),
      ),
      envWith(db),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })

    const insert = insertCall(db.calls)
    expect(insert.sql).toContain(
      '(user_id, earned_achievements, consecutive_days, last_active_date, updated_at)',
    )
    expect(insert.sql).toContain('ON CONFLICT(user_id) DO UPDATE')
    expect(insert.args).toHaveLength(5)
    expect(insert.args[0]).toBe(USER.id)
    expect(insert.args[1]).toBe('["a"]')
    expect(insert.args[2]).toBe(3)
    expect(insert.args[3]).toBe('2026-09-21')
    expect(insert.args[4]).toEqual(expect.any(String))
    expect(Number.isNaN(Date.parse(insert.args[4] as string)), 'updated_at 得是合法 ISO 时刻').toBe(false)
  })

  // 写的那条 INSERT 也不再提两列 —— 这是 T13 删列后最该钉住的不变量。
  it('PUT 发的 INSERT:SQL 与全部绑定参数都不含 enable_chinese / enable_english', async () => {
    const db = makeDB({ user: USER })
    await handlePutSettings(
      putRequest(JSON.stringify({ settings: { earnedAchievements: ['a'], consecutiveDays: 1 } })),
      envWith(db),
    )
    const insert = insertCall(db.calls)
    const flattened = JSON.stringify(insert.args)
    expect(insert.sql).not.toContain('enable_chinese')
    expect(insert.sql).not.toContain('enable_english')
    expect(flattened).not.toContain('enable_chinese')
    expect(flattened).not.toContain('enable_english')
  })

  it('清洗成就:非 string 逐项丢掉', async () => {
    const { args } = await putAndReadArgs({ earnedAchievements: ['a', 1, 'b', null] })
    expect(args[1]).toBe('["a","b"]')
  })

  // 连续天数是「天数」:负数 / 小数 / 字符串 / 非有限数都不该原样落库。
  it('清洗连续天数:取非负整数字面量,其余归零', async () => {
    const cases: Array<[unknown, number]> = [
      [-5, 0],
      [2.7, 2],
      ['3', 0],
      [NaN, 0],
      [Infinity, 0],
    ]
    for (const [input, expected] of cases) {
      const { args } = await putAndReadArgs({ consecutiveDays: input })
      expect(args[2], `consecutiveDays=${String(input)}`).toBe(expected)
    }
  })

  it('清洗活跃日期:字符串截到日历日,非字符串归空', async () => {
    const iso = await putAndReadArgs({ lastActiveDate: '2026-09-21T10:00:00Z' })
    expect(iso.args[3]).toBe('2026-09-21')
    const num = await putAndReadArgs({ lastActiveDate: 42 })
    expect(num.args[3]).toBe('')
  })
})

describe('settings · 路由', () => {
  it('POST /api/settings → 405', async () => {
    const db = makeDB({ user: USER })
    const res = await worker.fetch(
      new Request('http://localhost/api/settings', { method: 'POST' }),
      envWith(db),
    )
    expect(res.status).toBe(405)
  })

  it('GET /api/nope → JSON 404(带 message)', async () => {
    const db = makeDB({ user: USER })
    const res = await worker.fetch(new Request('http://localhost/api/nope'), envWith(db))
    expect(res.status).toBe(404)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect((await res.json()) as { message?: string }).toHaveProperty('message')
  })
})

/* 诚实边界(勿把本文件读成「已验证 DB 行为」):
 * 上面的假 DB 只记录「handler 发了哪条 SQL、绑了哪些参数」,**不执行任何 SQL**。
 * 所以它证明不了:INSERT 的列表名在真实 schema 里都存在、新行上两个 `DEFAULT 1` 列的取值、
 * `ON CONFLICT(user_id)` 是否真有唯一约束可冲突 —— 那些只有跑真库才够得着。
 */
