import { getAuthenticatedUser } from './_lib/auth'
import { jsonResponse } from './_lib/http'
import type { Env } from './index'

type SettingsRow = {  enable_pinyin: number; enable_hanzi: number; enable_english: number
  earned_achievements: string | null; consecutive_days: number | null; last_active_date: string | null
}

function parseEarned(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch { return [] }
}

function toEnabled(s: { enablePinyin?: unknown; enableHanzi?: unknown; enableEnglish?: unknown }) {
  const py = s.enablePinyin === true
  const hz = s.enableHanzi === true
  const en = s.enableEnglish === true
  if (!py && !hz && !en) return null
  return { py, hz, en }
}

export async function handleGetSettings(request: Request, env: Env): Promise<Response> {
  const user = await getAuthenticatedUser(request, env)
  if (!user) return jsonResponse({ message: '未授权' }, { status: 401 })
  const row = (await env.DB.prepare(
    `SELECT enable_pinyin, enable_hanzi, enable_english, earned_achievements, consecutive_days, last_active_date
     FROM user_settings WHERE user_id = ?`,
  ).bind(user.id).first<SettingsRow>())
  if (!row) {
    return jsonResponse({
      settings: { enablePinyin: true, enableHanzi: true, enableEnglish: true,
        earnedAchievements: [], consecutiveDays: 0, lastActiveDate: '' },
    })
  }
  return jsonResponse({
    settings: {
      enablePinyin: row.enable_pinyin === 1,
      enableHanzi: row.enable_hanzi === 1,
      enableEnglish: row.enable_english === 1,
      earnedAchievements: parseEarned(row.earned_achievements),
      consecutiveDays: row.consecutive_days ?? 0,
      lastActiveDate: row.last_active_date ?? '',
    },
  })
}

export async function handlePutSettings(request: Request, env: Env): Promise<Response> {
  const user = await getAuthenticatedUser(request, env)
  if (!user) return jsonResponse({ message: '未授权' }, { status: 401 })
  const body = (await request.json().catch(() => null)) as {
    settings?: { enablePinyin?: unknown; enableHanzi?: unknown; enableEnglish?: unknown;
      earnedAchievements?: unknown; consecutiveDays?: unknown; lastActiveDate?: unknown }
  } | null
  const s = body?.settings
  if (!s) return jsonResponse({ message: '设置不合法' }, { status: 400 })
  const en = toEnabled(s)
  if (!en) return jsonResponse({ message: '至少保留一个学习模块' }, { status: 400 })
  const earned = Array.isArray(s.earnedAchievements)
    ? s.earnedAchievements.filter((x): x is string => typeof x === 'string')
    : []
  const consecutive = typeof s.consecutiveDays === 'number' && Number.isFinite(s.consecutiveDays)
    ? Math.max(0, Math.floor(s.consecutiveDays))
    : 0
  const lastDate = typeof s.lastActiveDate === 'string' ? s.lastActiveDate.slice(0, 10) : ''
  await env.DB.prepare(
    `INSERT INTO user_settings
       (user_id, enable_pinyin, enable_hanzi, enable_english, earned_achievements, consecutive_days, last_active_date, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       enable_pinyin=excluded.enable_pinyin, enable_hanzi=excluded.enable_hanzi,
       enable_english=excluded.enable_english,
       earned_achievements=excluded.earned_achievements, consecutive_days=excluded.consecutive_days,
       last_active_date=excluded.last_active_date, updated_at=excluded.updated_at`,
  ).bind(user.id, en.py ? 1 : 0, en.hz ? 1 : 0, en.en ? 1 : 0,
    JSON.stringify(earned), consecutive, lastDate, new Date().toISOString()).run()
  return jsonResponse({ ok: true })
}
