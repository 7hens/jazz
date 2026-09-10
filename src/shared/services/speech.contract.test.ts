import { describe, expect, it } from 'vitest'
import type { SpeechRole } from './speech'

describe('speech 契约', () => {
  it('SpeechRole 含九角色字面量(新三角色已接入)', () => {
    const roles: SpeechRole[] = [
      'lingling', 'sun', 'moon', 'jingmo', 'narrator', 'villager',
      'xuwannian', 'pixiaonao', 'changmo',
    ]
    expect(roles).toHaveLength(9)
  })
})
