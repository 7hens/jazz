import { describe, expect, it } from 'vitest'
import type { SpeechRole } from './speech'

describe('speech 契约', () => {
  it('SpeechRole 含五角色字面量(旧四角色已退役)', () => {
    const roles: SpeechRole[] = [
      'lingling', 'xuwannian', 'pixiaonao', 'changmo', 'narrator',
    ]
    expect(roles).toHaveLength(5)
  })
})
