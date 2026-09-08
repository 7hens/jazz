import { act, renderHook } from '@testing-library/react'
import { expect, it } from 'vitest'
import { useAppState } from './useAppState'

it('starts in boot without a selected word', () => {
  const { result } = renderHook(() => useAppState())

  expect(result.current.phase).toBe('boot')
  expect(result.current.currentWordId).toBeNull()
  expect(result.current.currentChapterId).toBeNull()
})

it('enters and exits a lesson', () => {
  const { result } = renderHook(() => useAppState())

  act(() => result.current.actions.enterLesson(7))

  expect(result.current.phase).toBe('lesson')
  expect(result.current.currentWordId).toBe(7)

  act(() => result.current.actions.exitToHome())

  expect(result.current.phase).toBe('world')
})

it('opens and closes settings', () => {
  const { result } = renderHook(() => useAppState())

  act(() => result.current.actions.openSettings())
  expect(result.current.phase).toBe('settings')

  act(() => result.current.actions.closeSettings())
  expect(result.current.phase).toBe('world')
})

it('advances the active lesson word', () => {
  const { result } = renderHook(() => useAppState())

  act(() => result.current.actions.enterLesson(7))
  act(() => result.current.actions.nextWord())

  expect(result.current.currentWordId).toBe(8)
})

it('navigates world shell entries: qianzigu-map / letter-forest / world', () => {
  const { result } = renderHook(() => useAppState())

  act(() => result.current.actions.enterQianziguMap())
  expect(result.current.phase).toBe('qianzigu-map')

  act(() => result.current.actions.enterLetterForest())
  expect(result.current.phase).toBe('letter-forest')

  act(() => result.current.actions.enterWorld())
  expect(result.current.phase).toBe('world')
})

it('enterChapter carries chapterId and closeChapter returns to the map', () => {
  const { result } = renderHook(() => useAppState())

  act(() => result.current.actions.enterQianziguMap())
  act(() => result.current.actions.enterChapter(1))

  expect(result.current.phase).toBe('chapter')
  expect(result.current.currentChapterId).toBe(1)

  act(() => result.current.actions.closeChapter())

  expect(result.current.phase).toBe('qianzigu-map')
  expect(result.current.currentChapterId).toBeNull()
})

it('exits a lesson back to the map it was launched from (letter-forest)', () => {
  const { result } = renderHook(() => useAppState())

  act(() => result.current.actions.enterLetterForest())
  act(() => result.current.actions.enterLesson(3))
  expect(result.current.phase).toBe('lesson')

  act(() => result.current.actions.exitToHome())
  expect(result.current.phase).toBe('letter-forest')
})

it('closes settings back to the map it was launched from (letter-forest)', () => {
  const { result } = renderHook(() => useAppState())

  act(() => result.current.actions.enterLetterForest())
  act(() => result.current.actions.openSettings())
  expect(result.current.phase).toBe('settings')

  act(() => result.current.actions.closeSettings())
  expect(result.current.phase).toBe('letter-forest')
})
