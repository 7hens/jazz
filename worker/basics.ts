import { getAuthenticatedUser } from './_lib/auth'
import { jsonResponse } from './_lib/http'
import type { Env } from './index'

const MAX_BATCH = 200
const UNIT_KEY_RE = /^[a-z]+:[A-Za-z0-9]+$/

type Row = { unit_key: string; state: string; correct_streak: number; taught_count: number }

function toClient(r: Row) {
  return { unitKey: r.unit_key, state: r.state, correctStreak: r.correct_streak, taughtCount: r.taught_count }
}

export async function handleGetBasicsProgress(request: Request, env: Env): Promise<Response> {
  const user = await getAuthenticatedUser(request, env)
  if (!user) return jsonResponse({ message: '未授权' }, { status: 401 })
  const { results } = await env.DB.prepare(
    'SELECT unit_key, state, correct_streak, taught_count FROM basics_progress WHERE user_id = ? ORDER BY unit_key',
  ).bind(user.id).all<Row>()
  return jsonResponse({ rows: results.map(toClient) })
}

export async function handlePutBasicsProgress(request: Request, env: Env): Promise<Response> {
  const user = await getAuthenticatedUser(request, env)
  if (!user) return jsonResponse({ message: '未授权' }, { status: 401 })
  const body = (await request.json().catch(() => null)) as { rows?: unknown } | null
  const list = Array.isArray(body?.rows) ? body.rows : null
  if (!list || list.length === 0) return jsonResponse({ message: '基础数据不合法' }, { status: 400 })
  if (list.length > MAX_BATCH) return jsonResponse({ message: '基础数据过大' }, { status: 400 })
  const stmts: D1PreparedStatement[] = []
  for (const item of list) {
    const r = item as { unitKey?: unknown; state?: unknown; correctStreak?: unknown; taughtCount?: unknown }
    if (typeof r.unitKey !== 'string' || !UNIT_KEY_RE.test(r.unitKey)) {
      return jsonResponse({ message: `非法的 unit_key:${String(r.unitKey)}` }, { status: 400 })
    }
    const state = r.state === 'learning' ? 'learning' : r.state === 'known' ? 'known' : null
    if (!state) return jsonResponse({ message: `非法的 state:${String(r.state)}` }, { status: 400 })
    const int = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0)
    const stmt = env.DB.prepare(
      `INSERT INTO basics_progress (user_id, unit_key, state, correct_streak, taught_count, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, unit_key) DO UPDATE SET
         state = excluded.state,
         correct_streak = excluded.correct_streak,
         taught_count = excluded.taught_count,
         updated_at = excluded.updated_at`,
    ).bind(user.id, r.unitKey, state, int(r.correctStreak), int(r.taughtCount), new Date().toISOString())
    stmts.push(stmt)
  }
  await env.DB.batch(stmts)
  return jsonResponse({ ok: true, updated: stmts.length })
}
