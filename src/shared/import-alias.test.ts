import { describe, expect, it } from 'vitest'
import { cn } from '@/lib/utils'

describe('@ alias', () => {
  it('resolves src modules', () => expect(cn('a', false && 'b')).toBe('a'))
})
