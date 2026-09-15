export const AUTH_COOKIE = 'jazz_token'

// 本地 dev 的兜底令牌:vite dev 下 import.meta.env.DEV 为 true,没配 .dev.vars 也能直接登录;
// build 后 DEV 被替换为 false → 生产/preview 无兜底,必须配 ADMIN_TOKEN secret(缺失即全部 401)。
export const DEV_DEFAULT_TOKEN = 'jazz'

export const DEFAULT_USER = {
  id: 'default-user',
  email: 'admin@life.local',
  name: '私密用户',
} as const

export type AuthenticatedUser = {
  id: string
  email: string
  name: string
}

export function getCookieValue(request: Request, cookieName: string) {
  const cookieHeader = request.headers.get('Cookie') ?? ''
  const cookies = cookieHeader.split(';').map((item) => item.trim())
  const match = cookies.find((item) => item.startsWith(`${cookieName}=`))
  if (!match) return null
  return decodeURIComponent(match.slice(cookieName.length + 1))
}

// 期望令牌:env.ADMIN_TOKEN 优先(dev 可被 .dev.vars 覆盖),dev 缺省回落 jazz,其余环境缺失即空串(拒一切)。
// isDev 可注入,便于测试固定两侧行为。
export function expectedToken(
  env: { ADMIN_TOKEN?: string },
  isDev: boolean = import.meta.env.DEV,
): string {
  return env.ADMIN_TOKEN || (isDev ? DEV_DEFAULT_TOKEN : '')
}

// constant-time 比较,避免时序侧信道;token 直接比对 env.ADMIN_TOKEN
export function safeEqual(a: string, b: string) {
  const ab = new TextEncoder().encode(a)
  const bb = new TextEncoder().encode(b)
  if (ab.length !== bb.length) return false
  let diff = 0
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i]
  return diff === 0
}

// 单用户应用:返回唯一用户;无行时插入默认用户(避免与旧 uuid 用户/email 唯一约束冲突)
export async function getSingleUser(env: { DB: D1Database }): Promise<AuthenticatedUser> {
  const userRecord = (await env.DB.prepare(
    'SELECT id, email, name FROM users ORDER BY created_at LIMIT 1',
  ).first()) as { id: string; email: string; name: string } | null

  if (userRecord) {
    return { id: userRecord.id, email: userRecord.email, name: userRecord.name }
  }

  await env.DB.prepare(
    'INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)',
  ).bind(DEFAULT_USER.id, DEFAULT_USER.email, DEFAULT_USER.name, '').run()
  return { id: DEFAULT_USER.id, email: DEFAULT_USER.email, name: DEFAULT_USER.name }
}

export async function getAuthenticatedUser(
  request: Request,
  env: { DB: D1Database; ADMIN_TOKEN?: string },
): Promise<AuthenticatedUser | null> {
  const token = getCookieValue(request, AUTH_COOKIE)
  const expected = expectedToken(env)
  if (!token || !expected) return null
  if (!safeEqual(token, expected)) return null

  return getSingleUser(env)
}

export function buildCookieHeader(token: string, request: Request) {
  // Secure 只看实际传输协议,不按主机名猜:http 上加 Secure 会被浏览器(非 localhost 安全上下文)
  // 整体拒存 → dev 用局域网 IP(http://192.168.x.x:3000)访问时反复登出。仅 https 才带 Secure。
  const isSecure = new URL(request.url).protocol === 'https:'
  const secureFlag = isSecure ? '; Secure' : ''
  // token 永不过期,cookie 载体给 10 年,到期只是重新输入一次
  return `${AUTH_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=315360000${secureFlag}`
}

export function clearCookieHeader() {
  return `${AUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}
