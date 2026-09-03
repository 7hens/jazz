import { getAuthenticatedUser } from './_lib/auth'
import { jsonResponse } from './_lib/http'
import type { Env } from './index'

const DEFAULTS = { enable_pinyin: 1, enable_hanzi: 1, enable_english: 1 }

type SettingsRow = { enable_pinyin: number; enable_hanzi: number; enable_english: number }

export async function handleGetSettings(request: Request, env: Env): Promise<Response> {
  const user = await getAuthenticatedUser(request, env)
  if (!user) return jsonResponse({ message: '未授权' }, { status: 401 })
  const row = (await env.DB.prepare(
    'SELECT enable_pinyin, enable_hanzi, enable_english FROM user_settings WHERE user_id = ?',
  ).bind(user.id).first<SettingsRow>()) ?? DEFAULTS
  return jsonResponse({
    settings: {
      enablePinyin: row.enable_pinyin === 1,
      enableHanzi: row.enable_hanzi === 1,
      enableEnglish: row.enable_english === 1,
    },
  })
}

export async function handlePutSettings(request: Request, env: Env): Promise<Response> {
  const user = await getAuthenticatedUser(request, env)
  if (!user) return jsonResponse({ message: '未授权' }, { status: 401 })
  const body = (await request.json().catch(() => null)) as {
    settings?: { enablePinyin?: unknown; enableHanzi?: unknown; enableEnglish?: unknown }
  } | null
  const s = body?.settings
  if (!s) return jsonResponse({ message: '设置不合法' }, { status: 400 })
  const b = (v: unknown) => (v === true ? 1 : 0)
  // 至少保留一项为真(默认英语)
  const py = s.enablePinyin === true
  const hz = s.enableHanzi === true
  const en = s.enableEnglish === true
  if (!py && !hz && !en) return jsonResponse({ message: '至少保留一个学习模块' }, { status: 400 })
  await env.DB.prepare(
    `INSERT INTO user_settings (user_id, enable_pinyin, enable_hanzi, enable_english, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       enable_pinyin=excluded.enable_pinyin, enable_hanzi=excluded.enable_hanzi,
       enable_english=excluded.enable_english, updated_at=excluded.updated_at`,
  ).bind(user.id, b(py), b(hz), b(en), new Date().toISOString()).run()
  return jsonResponse({ ok: true })
}
