import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/shared/api-error'
import type { ApiService, User } from '@/shared/services'
import { createAuthService } from './auth'

const user: User = { id: 'u', email: 'e', name: 'n' }

function fakeApi(overrides: Partial<ApiService> = {}): ApiService {
  return {
    me: async () => user,
    login: async () => user,
    logout: async () => undefined,
    getProgress: async () => [],
    putProgress: async () => undefined,
    deleteProgress: async () => undefined,
    getSettings: async () => ({
      enablePinyin: true,
      enableHanzi: true,
      enableEnglish: true,
      earnedAchievements: [],
      consecutiveDays: 0,
      lastActiveDate: '',
    }),
    putSettings: async () => undefined,
    ...overrides,
  }
}

describe('AuthService', () => {
  it('maps a 401 check to anonymous', async () => {
    const auth = createAuthService(fakeApi({
      me: async () => { throw new ApiError(401, 'Unauthorized') },
    }))

    await auth.check()

    expect(auth.getSnapshot()).toEqual({ status: 'anonymous' })
  })

  it('exposes the authenticated user after login', async () => {
    const auth = createAuthService(fakeApi({ login: async () => user }))

    await auth.login('secret')

    expect(auth.getSnapshot()).toEqual({ status: 'authenticated', user })
  })

  it('keeps authenticated snapshots independent of later user mutations', async () => {
    const returnedUser: User = { id: 'u', email: 'e', name: 'n' }
    const auth = createAuthService(fakeApi({ login: async () => returnedUser }))

    await auth.login('secret')
    returnedUser.name = 'Changed elsewhere'

    expect(auth.getSnapshot()).toEqual({ status: 'authenticated', user })
  })

  it('notifies subscribers about checking and authenticated snapshots', async () => {
    const auth = createAuthService(fakeApi())
    const listener = vi.fn()
    auth.subscribe(listener)

    await auth.check()

    expect(listener).toHaveBeenCalledTimes(2)
    expect(auth.getSnapshot()).toEqual({ status: 'authenticated', user })
  })

  it('exposes an error snapshot when a check fails for a reason other than 401', async () => {
    const failure = new ApiError(500, 'Server unavailable')
    const auth = createAuthService(fakeApi({
      me: async () => { throw failure },
    }))

    await auth.check()

    expect(auth.getSnapshot()).toEqual({ status: 'error', error: failure })
  })

  it('logs out remotely before marking the service anonymous', async () => {
    const logout = vi.fn(async () => undefined)
    const auth = createAuthService(fakeApi({ logout }))

    await auth.logout()

    expect(logout).toHaveBeenCalledOnce()
    expect(auth.getSnapshot()).toEqual({ status: 'anonymous' })
  })

  it('marks the service anonymous without a remote request', () => {
    const logout = vi.fn(async () => undefined)
    const auth = createAuthService(fakeApi({ logout }))

    auth.markAnonymous()

    expect(logout).not.toHaveBeenCalled()
    expect(auth.getSnapshot()).toEqual({ status: 'anonymous' })
  })
})
