export const AUTH_COOKIE = 'jazz_session'

export type AuthenticatedUser = {
  id: string
  email: string
  name: string
}

async function createDigest(value: string) {
  const data = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function hashPassword(password: string) {
  const salt = crypto.randomUUID()
  const hash = await createDigest(`${salt}:${password}`)
  return `${salt}:${hash}`
}

export async function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(':')
  if (!salt || !hash) return false
  const candidate = await createDigest(`${salt}:${password}`)
  return candidate === hash
}

export function getCookieValue(request: Request, cookieName: string) {
  const cookieHeader = request.headers.get('Cookie') ?? ''
  const cookies = cookieHeader.split(';').map((item) => item.trim())
  const match = cookies.find((item) => item.startsWith(`${cookieName}=`))
  if (!match) return null
  return decodeURIComponent(match.slice(cookieName.length + 1))
}

export async function getAuthenticatedUser(request: Request, env: { DB: D1Database }): Promise<AuthenticatedUser | null> {
  const sessionId = getCookieValue(request, AUTH_COOKIE)
  if (!sessionId) return null

  const sessionRecord = (await env.DB.prepare(
    'SELECT user_id, expires_at FROM sessions WHERE id = ? AND expires_at > CURRENT_TIMESTAMP',
  )
    .bind(sessionId)
    .first()) as { user_id: string; expires_at: string } | null

  if (!sessionRecord) return null

  const userRecord = (await env.DB.prepare(
    'SELECT id, email, name FROM users WHERE id = ?',
  )
    .bind(sessionRecord.user_id)
    .first()) as { id: string; email: string; name: string } | null

  if (!userRecord) return null

  return {
    id: userRecord.id,
    email: userRecord.email,
    name: userRecord.name,
  }
}

export function buildCookieHeader(value: string, request: Request) {
  const isSecure = !request.url.startsWith('http://localhost') && !request.url.startsWith('http://127.0.0.1')
  const secureFlag = isSecure ? '; Secure' : ''
  return `${AUTH_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secureFlag}`
}

export function clearCookieHeader() {
  return `${AUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}
