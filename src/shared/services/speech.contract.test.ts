import { describe, expect, it } from 'vitest'
import type { SpeechRole } from './speech'

describe('speech 契约', () => {
  it('SpeechRole 六角色字面量合法', () => {
    const roles: SpeechRole[] = ['lingling', 'sun', 'moon', 'jingmo', 'narrator', 'villager']
    expect(roles).toHaveLength(6)
  })
})
