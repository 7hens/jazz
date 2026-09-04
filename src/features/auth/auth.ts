import { ApiError } from '@/shared/api-error'
import type { ApiService, AuthService, AuthSnapshot } from '@/shared/services'

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error('Authentication failed')
}

function immutableSnapshot(next: AuthSnapshot): AuthSnapshot {
  if (next.status === 'authenticated') {
    return Object.freeze({
      status: 'authenticated',
      user: Object.freeze({ ...next.user }),
    })
  }

  return Object.freeze({ ...next })
}

export function createAuthService(api: ApiService): AuthService {
  let snapshot: AuthSnapshot = immutableSnapshot({ status: 'checking' })
  const listeners = new Set<() => void>()

  function setSnapshot(next: AuthSnapshot) {
    snapshot = immutableSnapshot(next)
    listeners.forEach(listener => listener())
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async check() {
      setSnapshot({ status: 'checking' })
      try {
        setSnapshot({ status: 'authenticated', user: await api.me() })
      } catch (error) {
        setSnapshot(error instanceof ApiError && error.status === 401
          ? { status: 'anonymous' }
          : { status: 'error', error: toError(error) })
      }
    },
    async login(token) {
      setSnapshot({ status: 'checking' })
      try {
        setSnapshot({ status: 'authenticated', user: await api.login(token) })
      } catch (error) {
        setSnapshot({ status: 'error', error: toError(error) })
      }
    },
    async logout() {
      try {
        await api.logout()
        setSnapshot({ status: 'anonymous' })
      } catch (error) {
        setSnapshot({ status: 'error', error: toError(error) })
      }
    },
    markAnonymous() {
      setSnapshot({ status: 'anonymous' })
    },
  }
}
