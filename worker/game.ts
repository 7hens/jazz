import { getAuthenticatedUser } from './_lib/auth'
import { jsonResponse } from './_lib/http'
import type { Env } from './index'

const MAX_STATE_BYTES = 64 * 1024 // 上限按 UTF-8 字节计

export async function handleGetGame(request: Request, env: Env): Promise<Response> {
  const user = await getAuthenticatedUser(request, env)
  if (!user) return jsonResponse({ message: '未授权' }, { status: 401 })
  const row = (await env.DB.prepare('SELECT state FROM game_state WHERE user_id = ?').bind(user.id).first()) as
    | { state: string }
    | null
  if (!row) return jsonResponse({ state: null })
  try {
    return jsonResponse({ state: JSON.parse(row.state) })
  } catch {
    return jsonResponse({ state: null })
  }
}

export async function handlePutGame(request: Request, env: Env): Promise<Response> {
  const user = await getAuthenticatedUser(request, env)
  if (!user) return jsonResponse({ message: '未授权' }, { status: 401 })
  const body = (await request.json().catch(() => ({ state: null }))) as { state?: unknown }
  if (!body.state || typeof body.state !== 'object' || Array.isArray(body.state)) {
    return jsonResponse({ message: '进度数据不合法' }, { status: 400 })
  }
  const raw = JSON.stringify(body.state)
  // 测 UTF-8 字节数而非 UTF-16 码元数:中文存档若按 raw.length 会低估一半体积
  if (new TextEncoder().encode(raw).length > MAX_STATE_BYTES) {
    return jsonResponse({ message: '进度数据过大' }, { status: 400 })
  }
  await env.DB.prepare(
    'INSERT INTO game_state (user_id, state, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at',
  ).bind(user.id, raw, new Date().toISOString()).run()
  return jsonResponse({ ok: true })
}
