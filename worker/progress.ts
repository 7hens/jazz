import { getAuthenticatedUser } from './_lib/auth'
import { jsonResponse } from './_lib/http'
import type { Env } from './index'

const MAX_WORD_ID = 100
const MAX_BATCH = 200

type Row = {
  word_id: number
  pinyin_completed: number
  hanzi_completed: number
  english_completed: number
  stars_earned: number
}

function toClient(r: Row) {
  return {
    wordId: r.word_id,
    completed: {
      pinyin: r.pinyin_completed === 1,
      hanzi: r.hanzi_completed === 1,
      english: r.english_completed === 1,
    },
    starsEarned: r.stars_earned,
  }
}

export async function handleGetProgress(request: Request, env: Env): Promise<Response> {
  const user = await getAuthenticatedUser(request, env)
  if (!user) return jsonResponse({ message: '未授权' }, { status: 401 })
  const { results } = await env.DB.prepare(
    'SELECT word_id, pinyin_completed, hanzi_completed, english_completed, stars_earned FROM progress WHERE user_id = ? ORDER BY word_id',
  ).bind(user.id).all<Row>()
  return jsonResponse({ progress: results.map(toClient) })
}

export async function handlePutProgress(request: Request, env: Env): Promise<Response> {
  const user = await getAuthenticatedUser(request, env)
  if (!user) return jsonResponse({ message: '未授权' }, { status: 401 })
  const body = (await request.json().catch(() => null)) as { progress?: unknown } | null
  const list = Array.isArray(body?.progress) ? body.progress : null
  if (!list || list.length === 0) return jsonResponse({ message: '进度数据不合法' }, { status: 400 })
  if (list.length > MAX_BATCH) return jsonResponse({ message: '进度数据过大' }, { status: 400 })
  const stmts: D1PreparedStatement[] = []
  for (const item of list) {
    const p = item as {
      wordId?: unknown; completed?: { pinyin?: unknown; hanzi?: unknown; english?: unknown }; starsEarned?: unknown
    }
    const wordId = p.wordId
    if (typeof wordId !== 'number' || !Number.isInteger(wordId) || wordId < 1 || wordId > MAX_WORD_ID) {
      return jsonResponse({ message: `非法的 word_id:${String(wordId)}` }, { status: 400 })
    }
    const c = p.completed ?? {}
    const bool = (v: unknown) => (v === true ? 1 : 0)
    const stars = typeof p.starsEarned === 'number' && Number.isFinite(p.starsEarned) ? Math.max(0, Math.floor(p.starsEarned)) : 0
    const stmt = env.DB.prepare(
      `INSERT INTO progress (user_id, word_id, pinyin_completed, hanzi_completed, english_completed, stars_earned, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, word_id) DO UPDATE SET
         pinyin_completed = MAX(progress.pinyin_completed, excluded.pinyin_completed),
         hanzi_completed  = MAX(progress.hanzi_completed, excluded.hanzi_completed),
         english_completed= MAX(progress.english_completed, excluded.english_completed),
         stars_earned     = MAX(progress.stars_earned, excluded.stars_earned),
         updated_at       = excluded.updated_at`,
    ).bind(
      user.id, wordId,
      bool(c.pinyin), bool(c.hanzi), bool(c.english),
      stars, new Date().toISOString(),
    )
    stmts.push(stmt)
  }
  await env.DB.batch(stmts)
  return jsonResponse({ ok: true, updated: stmts.length })
}

export async function handleDeleteProgress(request: Request, env: Env): Promise<Response> {
  const user = await getAuthenticatedUser(request, env)
  if (!user) return jsonResponse({ message: '未授权' }, { status: 401 })
  await env.DB.prepare('DELETE FROM progress WHERE user_id = ?').bind(user.id).run()
  return jsonResponse({ ok: true })
}
