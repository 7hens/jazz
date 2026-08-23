import { buildCookieHeader, getAuthenticatedUser, hashPassword, verifyPassword } from '../_lib/auth'

const defaultEmail = 'admin@life.local'
const defaultPassword = 'ChangeMe123!'

function jsonResponse(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
}

export async function onRequestPost({ request, env }: { request: Request; env: { DB: D1Database; ADMIN_EMAIL?: string; ADMIN_PASSWORD?: string } }) {
  if (request.headers.get('content-type')?.includes('application/json') === false) {
    return jsonResponse({ message: 'Content-Type must be application/json' }, { status: 400 })
  }

  const body = (await request.json().catch(() => ({ email: '', password: '' }))) as {
    email?: string
    password?: string
  }

  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  const adminEmail = env.ADMIN_EMAIL ?? defaultEmail
  const adminPassword = env.ADMIN_PASSWORD ?? defaultPassword

  if (!email || !password) {
    return jsonResponse({ message: '邮箱和密码不能为空' }, { status: 400 })
  }

  let user = (await env.DB.prepare('SELECT id, email, password_hash, name FROM users WHERE email = ?').bind(email).first()) as {
    id: string
    email: string
    password_hash: string
    name: string
  } | null

  if (!user && email === adminEmail) {
    const userId = crypto.randomUUID()
    const passwordHash = await hashPassword(adminPassword)
    await env.DB.prepare(
      'INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)',
    ).bind(userId, email, '私密用户', passwordHash).run()
    user = {
      id: userId,
      email,
      password_hash: passwordHash,
      name: '私密用户',
    }
  }

  if (!user) {
    return jsonResponse({ message: '未找到此账户，请确认邮箱或联系管理员' }, { status: 401 })
  }

  const valid = await verifyPassword(password, user.password_hash)
  if (!valid) {
    return jsonResponse({ message: '密码不正确' }, { status: 401 })
  }

  const sessionId = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  await env.DB.prepare(
    'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
  ).bind(sessionId, user.id, expiresAt).run()

  const authCookie = buildCookieHeader(sessionId, request)
  return jsonResponse(
    {
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    },
    { status: 200, headers: { 'Set-Cookie': authCookie } },
  )
}

export async function onRequestGet({ request, env }: { request: Request; env: { DB: D1Database } }) {
  const user = await getAuthenticatedUser(request, env)
  if (!user) {
    return jsonResponse({ message: '未授权' }, { status: 401 })
  }

  return jsonResponse({ user })
}
