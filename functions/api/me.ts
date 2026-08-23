import { getAuthenticatedUser } from './_lib/auth'

function jsonResponse(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
}

export async function onRequestGet({ request, env }: { request: Request; env: { DB: D1Database } }) {
  const user = await getAuthenticatedUser(request, env)
  if (!user) {
    return jsonResponse({ message: '未授权' }, { status: 401 })
  }

  return jsonResponse({ user })
}
