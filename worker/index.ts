import { handleLogin, handleLogout, handleMe } from './auth'
import { jsonResponse } from './_lib/http'
import { handleRecords, type RecordsMethod } from './records'

export interface Env {
  DB: D1Database
  ADMIN_TOKEN?: string
  ASSETS?: Fetcher
}

function methodNotAllowed() {
  return jsonResponse({ message: 'Method Not Allowed' }, { status: 405 })
}

function notFound() {
  return jsonResponse({ message: 'Not Found' }, { status: 404 })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)
    const method = request.method

    switch (pathname) {
      case '/api/auth/login':
        if (method === 'POST') return handleLogin(request, env)
        if (method === 'GET') return handleMe(request, env)
        return methodNotAllowed()
      case '/api/auth/logout':
        if (method === 'POST') return handleLogout()
        return methodNotAllowed()
      case '/api/me':
        if (method === 'GET') return handleMe(request, env)
        return methodNotAllowed()
      case '/api/records':
        if (method === 'GET' || method === 'POST' || method === 'DELETE') {
          return handleRecords(request, env, method as RecordsMethod)
        }
        return methodNotAllowed()
      default:
        // 非 API 请求:生产环境由 Workers Assets 提供静态资源;dev 下 vite 已接管
        if (env.ASSETS) return env.ASSETS.fetch(request)
        return notFound()
    }
  },
}
