import { describe, expect, it } from 'vitest'
import { DEV_DEFAULT_TOKEN, expectedToken } from './auth'

describe('expectedToken', () => {
  it('dev 未配 ADMIN_TOKEN 时回落默认令牌', () => {
    expect(expectedToken({}, true)).toBe('jazz')
  })

  it('生产/preview 未配 ADMIN_TOKEN 时不含任何兜底', () => {
    expect(expectedToken({}, false)).toBe('')
  })

  it('显式 ADMIN_TOKEN 覆盖默认值,dev 与线上一致', () => {
    expect(expectedToken({ ADMIN_TOKEN: 'secret' }, true)).toBe('secret')
    expect(expectedToken({ ADMIN_TOKEN: 'secret' }, false)).toBe('secret')
  })

  it('空串 ADMIN_TOKEN 视为未配', () => {
    expect(expectedToken({ ADMIN_TOKEN: '' }, true)).toBe(DEV_DEFAULT_TOKEN)
    expect(expectedToken({ ADMIN_TOKEN: '' }, false)).toBe('')
  })
})
