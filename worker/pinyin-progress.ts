// 拼音积木进度:每 user 一行 —— 每关星级(JSON)+ 星尘累计。
// 两条线都**单调升**,故合并一律取 max,幂等(重放同一份请求结果不变)。
//
// 存 JSON 而非定长串:以后加关卡不用在 worker 里维护「总关数」常量。
// 代价是 stars 没法在 SQL 里逐 key 取 max —— 只能读-改-写(见 handlePut)。
// 单档案自托管(一个家庭、一次一台设备写)下并发窗口不可达;且前端每次提交的是
// 已 merge 服务端旧值的**全量**,即使覆盖也不会丢已通关的位。

import { getAuthenticatedUser } from './_lib/auth'
import { jsonResponse } from './_lib/http'
import type { Env } from './index'

/** 与前端 `levels.ts` 的 id 格式对齐。worker 侧独立保留字面量,不跨端 import。 */
const LEVEL_ID = /^u\d+-\d+$/
/** 星尘上限:纯防呆,挡住溢出与手改。 */
const MAX_TOTAL_STARS = 1_000_000

type Row = { stars: string; total_stars: number }

/** 坏掉的存档当空表 —— 一行脏数据不该让整个接口 500,把孩子挡在门外。 */
export function parseStars(raw: string): Record<string, number> {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {}
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
  const out: Record<string, number> = {}
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!LEVEL_ID.test(key)) continue
    if (value === 1 || value === 2 || value === 3) out[key] = value
  }
  return out
}

/** 校验入参的星级表;非法返回 null(调用方据此 400,不静默降级)。 */
export function readStars(payload: unknown): Record<string, number> | null {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null
  const out: Record<string, number> = {}
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (!LEVEL_ID.test(key)) return null
    if (value !== 1 && value !== 2 && value !== 3) return null
    out[key] = value
  }
  return out
}

/** 逐 key 取 max。重玩拿了一星不该把三星冲掉。 */
export function mergeStars(
  existing: Record<string, number>,
  incoming: Record<string, number>,
): Record<string, number> {
  const out = { ...existing }
  for (const [key, value] of Object.entries(incoming)) {
    out[key] = Math.max(out[key] ?? 0, value)
  }
  return out
}

function toClient(row: Row | null) {
  return {
    stars: parseStars(row?.stars ?? '{}'),
    totalStars: row?.total_stars ?? 0,
  }
}

export async function handleGetPinyinProgress(request: Request, env: Env): Promise<Response> {
  const user = await getAuthenticatedUser(request, env)
  if (!user) return jsonResponse({ message: '未授权' }, { status: 401 })
  const row = await env.DB.prepare(
    'SELECT stars, total_stars FROM pinyin_progress WHERE user_id = ?',
  ).bind(user.id).first<Row>()
  return jsonResponse(toClient(row ?? null))
}

export async function handlePutPinyinProgress(request: Request, env: Env): Promise<Response> {
  const user = await getAuthenticatedUser(request, env)
  if (!user) return jsonResponse({ message: '未授权' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as { stars?: unknown; totalStars?: unknown } | null
  const incoming = readStars(body?.stars)
  if (!incoming) return jsonResponse({ message: '星级数据不合法' }, { status: 400 })

  const rawTotal = body?.totalStars
  if (typeof rawTotal !== 'number' || !Number.isInteger(rawTotal) || rawTotal < 0 || rawTotal > MAX_TOTAL_STARS) {
    return jsonResponse({ message: '星尘数不合法' }, { status: 400 })
  }

  const existing = await env.DB.prepare(
    'SELECT stars FROM pinyin_progress WHERE user_id = ?',
  ).bind(user.id).first<Row>()
  const merged = mergeStars(parseStars(existing?.stars ?? '{}'), incoming)

  await env.DB.prepare(
    `INSERT INTO pinyin_progress (user_id, stars, total_stars, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       stars       = excluded.stars,
       total_stars = MAX(pinyin_progress.total_stars, excluded.total_stars),
       updated_at  = excluded.updated_at`,
  ).bind(user.id, JSON.stringify(merged), rawTotal, new Date().toISOString()).run()

  return jsonResponse({ ok: true })
}

export async function handleDeletePinyinProgress(request: Request, env: Env): Promise<Response> {
  const user = await getAuthenticatedUser(request, env)
  if (!user) return jsonResponse({ message: '未授权' }, { status: 401 })
  await env.DB.prepare('DELETE FROM pinyin_progress WHERE user_id = ?').bind(user.id).run()
  return jsonResponse({ ok: true })
}
