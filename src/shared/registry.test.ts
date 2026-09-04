import { beforeEach, describe, expect, it } from 'vitest'
import { registry } from './registry'
import { useService } from './useService'

beforeEach(() => registry.clear())

describe('registry', () => {
  it('returns the registered instance', () => {
    const api = { me: async () => null }

    registry.register('api', api)

    expect(registry.get('api')).toBe(api)
  })

  it('throws for a missing service', () => {
    expect(() => registry.get('api')).toThrow('[registry] 服务未注册: api')
  })

  it('reports a registered service', () => {
    registry.register('api', { me: async () => null })

    expect(registry.has('api')).toBe(true)
  })

  it('removes registered services when cleared', () => {
    registry.register('api', { me: async () => null })

    registry.clear()

    expect(registry.has('api')).toBe(false)
  })

  it('gets registered services through useService', () => {
    const api = { me: async () => null }
    registry.register('api', api)

    expect(useService('api')).toBe(api)
  })
})
