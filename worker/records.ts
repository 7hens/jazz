import { getAuthenticatedUser } from './_lib/auth'
import { jsonResponse } from './_lib/http'
import type { Env } from './index'

export type RecordsMethod = 'GET' | 'POST' | 'DELETE'

export async function handleRecords(request: Request, env: Env, method: RecordsMethod): Promise<Response> {
  const user = await getAuthenticatedUser(request, env)
  if (!user) {
    return jsonResponse({ message: '未授权' }, { status: 401 })
  }

  if (method === 'GET') {
    const rows = (await env.DB.prepare(
      'SELECT id, type, date, note, amount, category, weight, exercise_type AS exerciseType, duration, calories, created_at AS createdAt FROM records WHERE user_id = ? ORDER BY date DESC, created_at DESC LIMIT 200',
    ).bind(user.id).all()) as { results?: Array<Record<string, unknown>> }

    return jsonResponse({ records: rows.results ?? [] })
  }

  if (method === 'DELETE') {
    const recordId = new URL(request.url).searchParams.get('id')
    if (!recordId) {
      return jsonResponse({ message: '缺少记录 ID' }, { status: 400 })
    }

    await env.DB.prepare('DELETE FROM records WHERE id = ? AND user_id = ?').bind(recordId, user.id).run()
    return jsonResponse({ ok: true })
  }

  const body = (await request.json().catch(() => ({}))) as {
    type?: string
    date?: string
    note?: string
    amount?: number | string
    category?: string
    weight?: number | string
  }

  const type = String(body.type ?? '').trim()
  const date = String(body.date ?? '').trim() || new Date().toISOString().slice(0, 10)

  if (!['expense', 'income', 'weight'].includes(type)) {
    return jsonResponse({ message: '类型不合法' }, { status: 400 })
  }

  if (!date) {
    return jsonResponse({ message: '日期不能为空' }, { status: 400 })
  }

  if ((type === 'expense' || type === 'income') && Number(body.amount ?? 0) <= 0) {
    return jsonResponse({ message: '金额必须大于 0' }, { status: 400 })
  }

  if (type === 'weight' && Number(body.weight ?? 0) <= 0) {
    return jsonResponse({ message: '体重必须大于 0' }, { status: 400 })
  }

  const recordId = crypto.randomUUID()
  await env.DB.prepare(
    'INSERT INTO records (id, user_id, type, date, note, amount, category, weight, exercise_type, duration, calories) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(
      recordId,
      user.id,
      type,
      date,
      body.note ?? '',
      type === 'expense' || type === 'income' ? Number(body.amount ?? 0) : null,
      type === 'expense' || type === 'income' ? (body.category ?? '其他') : null,
      type === 'weight' ? Number(body.weight ?? 0) : null,
      null,
      null,
      null,
    )
    .run()

  return jsonResponse({ ok: true, recordId })
}
