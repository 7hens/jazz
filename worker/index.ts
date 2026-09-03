import { handleLogin, handleLogout, handleMe } from './auth'
import { jsonResponse } from './_lib/http'
import { handleGetProgress, handlePutProgress, handleDeleteProgress } from './progress'
import { handleGetSettings, handlePutSettings } from './settings'

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
      case '/api/progress':
        if (method === 'GET') return handleGetProgress(request, env)
        if (method === 'PUT') return handlePutProgress(request, env)
        if (method === 'DELETE') return handleDeleteProgress(request, env)
        return methodNotAllowed()
      case '/api/settings':
        if (method === 'GET') return handleGetSettings(request, env)
        if (method === 'PUT') return handlePutSettings(request, env)
        return methodNotAllowed()
      default:
        // 未匹配的 /api/*(拼错/遗留路径)一律 JSON 404,绝不落到静态资源
        if (pathname.startsWith('/api/')) return notFound()
        // 其余非 API 请求:生产环境由 Workers Assets 提供静态资源;dev 下 vite 已接管
        if (env.ASSETS) return env.ASSETS.fetch(request)
        return notFound()
    }
  },
}
