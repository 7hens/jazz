import { getAuthenticatedUser } from './_lib/auth'
import { jsonResponse } from './_lib/http'
import type { Env } from './index'

// user_settings 仍留着 enable_chinese / enable_english 两列(0001/0004 基线不可改,老行原值保留),
// 但新代码**不读不写**它们 —— 列都有 DEFAULT,INSERT 去列即安全。
type SettingsRow = {
  earned_achievements: string | null; consecutive_days: number | null; last_active_date: string | null
}

function parseEarned(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch { return [] }
}

export async function handleGetSettings(request: Request, env: Env): Promise<Response> {
  const user = await getAuthenticatedUser(request, env)
  if (!user) return jsonResponse({ message: '未授权' }, { status: 401 })
  const row = (await env.DB.prepare(
    `SELECT earned_achievements, consecutive_days, last_active_date
     FROM user_settings WHERE user_id = ?`,
  ).bind(user.id).first<SettingsRow>())
  if (!row) {
    return jsonResponse({
      settings: { earnedAchievements: [], consecutiveDays: 0, lastActiveDate: '' },
    })
  }
  return jsonResponse({
    settings: {
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
    settings?: { earnedAchievements?: unknown; consecutiveDays?: unknown; lastActiveDate?: unknown }
  } | null
  const s = body?.settings
  if (!s) return jsonResponse({ message: '设置不合法' }, { status: 400 })
  const earned = Array.isArray(s.earnedAchievements)
    ? s.earnedAchievements.filter((x): x is string => typeof x === 'string')
    : []
  const consecutive = typeof s.consecutiveDays === 'number' && Number.isFinite(s.consecutiveDays)
    ? Math.max(0, Math.floor(s.consecutiveDays))
    : 0
  const lastDate = typeof s.lastActiveDate === 'string' ? s.lastActiveDate.slice(0, 10) : ''
  await env.DB.prepare(
    `INSERT INTO user_settings
       (user_id, earned_achievements, consecutive_days, last_active_date, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       earned_achievements=excluded.earned_achievements, consecutive_days=excluded.consecutive_days,
       last_active_date=excluded.last_active_date, updated_at=excluded.updated_at`,
  ).bind(user.id, JSON.stringify(earned), consecutive, lastDate, new Date().toISOString()).run()
  return jsonResponse({ ok: true })
}
