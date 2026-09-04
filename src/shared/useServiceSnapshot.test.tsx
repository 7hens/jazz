import { act, renderHook } from '@testing-library/react'
import { expect, it } from 'vitest'
import { useServiceSnapshot, type ReactiveService } from './useServiceSnapshot'

it('rerenders when a service snapshot changes', () => {
  let value = 0
  const listeners = new Set<() => void>()
  const service: ReactiveService<number> = {
    getSnapshot: () => value,
    subscribe: listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }

  const { result } = renderHook(() => useServiceSnapshot(service))

  act(() => {
    value = 1
    listeners.forEach(listener => listener())
  })

  expect(result.current).toBe(1)
})
