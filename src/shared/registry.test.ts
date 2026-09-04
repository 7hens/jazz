import { beforeEach, describe, expect, it } from 'vitest'
import { registry } from './registry'
import type { ApiService } from './services'
import { useService } from './useService'

beforeEach(() => registry.clear())

function createApi(): ApiService {
  return {
    me: async () => ({ id: 'user', email: 'user@example.com', name: 'User' }),
    login: async () => ({ id: 'user', email: 'user@example.com', name: 'User' }),
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
      updatedAt: '',
    }),
    putSettings: async () => undefined,
  }
}

describe('registry', () => {
  it('returns the registered instance', () => {
    const api = createApi()

    registry.register('api', api)

    expect(registry.get('api')).toBe(api)
  })

  it('throws for a missing service', () => {
    expect(() => registry.get('api')).toThrow('[registry] 服务未注册: api')
  })

  it('reports a registered service', () => {
    registry.register('api', createApi())

    expect(registry.has('api')).toBe(true)
  })

  it('removes registered services when cleared', () => {
    registry.register('api', createApi())

    registry.clear()

    expect(registry.has('api')).toBe(false)
  })

  it('gets registered services through useService', () => {
    const api = createApi()
    registry.register('api', api)

    expect(useService('api')).toBe(api)
  })
})
