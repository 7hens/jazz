import { act, renderHook } from '@testing-library/react'
import { expect, it } from 'vitest'
import { useAppState } from './useAppState'

it('starts in boot without a selected word', () => {
  const { result } = renderHook(() => useAppState())

  expect(result.current.phase).toBe('boot')
  expect(result.current.currentWordId).toBeNull()
})

it('enters and exits a lesson', () => {
  const { result } = renderHook(() => useAppState())

  act(() => result.current.actions.enterLesson(7))

  expect(result.current.phase).toBe('lesson')
  expect(result.current.currentWordId).toBe(7)

  act(() => result.current.actions.exitToHome())

  expect(result.current.phase).toBe('home')
})

it('opens and closes settings', () => {
  const { result } = renderHook(() => useAppState())

  act(() => result.current.actions.openSettings())
  expect(result.current.phase).toBe('settings')

  act(() => result.current.actions.closeSettings())
  expect(result.current.phase).toBe('home')
})

it('advances the active lesson word', () => {
  const { result } = renderHook(() => useAppState())

  act(() => result.current.actions.enterLesson(7))
  act(() => result.current.actions.nextWord())

  expect(result.current.currentWordId).toBe(8)
})
