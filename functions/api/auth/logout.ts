import { clearCookieHeader } from '../_lib/auth'

function jsonResponse(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
}

export async function onRequestPost({ request, env }: { request: Request; env: { DB: D1Database } }) {
  const cookieHeader = request.headers.get('Cookie') ?? ''
  const match = cookieHeader.split(';').find((item) => item.trim().startsWith('jazz_session='))
  const sessionId = match ? decodeURIComponent(match.trim().slice('jazz_session='.length)) : null

  if (sessionId) {
    await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run()
  }

  return jsonResponse({ ok: true }, { status: 200, headers: { 'Set-Cookie': clearCookieHeader() } })
}
