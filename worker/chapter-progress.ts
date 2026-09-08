import { getAuthenticatedUser } from './_lib/auth'
import { jsonResponse } from './_lib/http'
import type { Env } from './index'

type Row = { chapter_id: number; resume_scene_id: string | null; restore_state: string }

function toClient(r: Row) {
  return { chapterId: r.chapter_id, resumeSceneId: r.resume_scene_id, restoreState: r.restore_state }
}

export async function handleGetChapterProgress(request: Request, env: Env): Promise<Response> {
  const user = await getAuthenticatedUser(request, env)
  if (!user) return jsonResponse({ message: '未授权' }, { status: 401 })
  const row = (await env.DB.prepare(
    'SELECT chapter_id, resume_scene_id, restore_state FROM qianzigu_progress WHERE user_id = ?',
  ).bind(user.id).first<Row>())
  return jsonResponse({ row: row ? toClient(row) : null })
}

export async function handlePutChapterProgress(request: Request, env: Env): Promise<Response> {
  const user = await getAuthenticatedUser(request, env)
  if (!user) return jsonResponse({ message: '未授权' }, { status: 401 })
  const body = (await request.json().catch(() => null)) as { row?: unknown } | null
  const r = body?.row as {
    chapterId?: unknown; resumeSceneId?: unknown; restoreState?: unknown
  } | undefined
  if (!r) return jsonResponse({ message: '章节数据不合法' }, { status: 400 })
  const chapterId = r.chapterId
  if (typeof chapterId !== 'number' || !Number.isInteger(chapterId) || chapterId < 1) {
    return jsonResponse({ message: `非法的 chapter_id:${String(chapterId)}` }, { status: 400 })
  }
  const restoreState = typeof r.restoreState === 'string' ? r.restoreState : ''
  const resumeSceneId = typeof r.resumeSceneId === 'string' ? r.resumeSceneId : null
  await env.DB.prepare(
    `INSERT INTO qianzigu_progress (user_id, chapter_id, resume_scene_id, restore_state, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       chapter_id=excluded.chapter_id,
       resume_scene_id=excluded.resume_scene_id,
       restore_state=excluded.restore_state,
       updated_at=excluded.updated_at`,
  ).bind(user.id, chapterId, resumeSceneId, restoreState, new Date().toISOString()).run()
  return jsonResponse({ ok: true })
}
