import { buildCookieHeader, clearCookieHeader, getAuthenticatedUser, getSingleUser, safeEqual } from './_lib/auth'
import { jsonResponse } from './_lib/http'
import type { Env } from './index'

export async function handleLogin(request: Request, env: Env): Promise<Response> {
  if (request.headers.get('content-type')?.includes('application/json') === false) {
    return jsonResponse({ message: 'Content-Type must be application/json' }, { status: 400 })
  }

  const body = (await request.json().catch(() => ({ token: '' }))) as { token?: string }
  const token = String(body.token ?? '').trim()

  if (!token) {
    return jsonResponse({ message: '访问令牌不能为空' }, { status: 400 })
  }

  const expected = env.ADMIN_TOKEN ?? ''
  if (!expected) {
    return jsonResponse({ message: '未配置访问令牌' }, { status: 401 })
  }
  if (!safeEqual(token, expected)) {
    return jsonResponse({ message: '令牌不正确' }, { status: 401 })
  }

  // 认证不再需要密码/邮箱,users 仅作 game_state 的外键;返回唯一用户(无则建默认)
  const user = await getSingleUser(env)

  return jsonResponse(
    { ok: true, user },
    { status: 200, headers: { 'Set-Cookie': buildCookieHeader(token, request) } },
  )
}

export async function handleLogout(): Promise<Response> {
  // token 无状态,登出只清浏览器 cookie
  return jsonResponse({ ok: true }, { status: 200, headers: { 'Set-Cookie': clearCookieHeader() } })
}

export async function handleMe(request: Request, env: Env): Promise<Response> {
  const user = await getAuthenticatedUser(request, env)
  if (!user) {
    return jsonResponse({ message: '未授权' }, { status: 401 })
  }
  return jsonResponse({ user })
}
