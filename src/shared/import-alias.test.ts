import { describe, expect, it } from 'vitest'
import { cn } from '@/shared/utils'

describe('@ alias', () => {
  it('resolves src modules', () => expect(cn('a', false && 'b')).toBe('a'))
})
