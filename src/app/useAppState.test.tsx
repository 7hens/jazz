import { act, renderHook } from '@testing-library/react'
import { expect, it } from 'vitest'
import { useAppState } from './useAppState'

it('starts in boot with nothing selected', () => {
  const { result } = renderHook(() => useAppState())

  expect(result.current.phase).toBe('boot')
  expect(result.current.lessonId).toBeNull()
  expect(result.current.practiceUnitId).toBeNull()
})

it('boot → path:exitToPath 是登录成功后的落点', () => {
  const { result } = renderHook(() => useAppState())

  act(() => result.current.actions.exitToPath())

  expect(result.current.phase).toBe('path')
  expect(result.current.lessonId).toBeNull()
  expect(result.current.practiceUnitId).toBeNull()
})

it('path → lesson:enterLesson 记下节 id 并进课', () => {
  const { result } = renderHook(() => useAppState())

  act(() => result.current.actions.enterLesson('u1#easy-0'))

  expect(result.current.phase).toBe('lesson')
  expect(result.current.lessonId).toBe('u1#easy-0')
  expect(result.current.practiceUnitId).toBeNull()
})

it('lesson → path:exitToPath 回路径并把 lessonId 清干净', () => {
  const { result } = renderHook(() => useAppState())

  act(() => result.current.actions.enterLesson('u1#easy-0'))
  expect(result.current.lessonId).toBe('u1#easy-0')

  act(() => result.current.actions.exitToPath())

  expect(result.current.phase).toBe('path')
  // 清干净是有意的:残留的 id 会让「回路径后又进另一节」渲染错节点(或复用旧 key)。
  expect(result.current.lessonId).toBeNull()
})

it('path → parent → path:家长面板开得开、合得上', () => {
  const { result } = renderHook(() => useAppState())

  act(() => result.current.actions.exitToPath())
  act(() => result.current.actions.openParent())
  expect(result.current.phase).toBe('parent')

  act(() => result.current.actions.closeParent())
  expect(result.current.phase).toBe('path')
})

it('lesson → parent → path:课里开家长面板,关掉落回路径(不是课)', () => {
  const { result } = renderHook(() => useAppState())

  act(() => result.current.actions.enterLesson('u1#easy-0'))
  act(() => result.current.actions.openParent())
  expect(result.current.phase).toBe('parent')

  act(() => result.current.actions.closeParent())

  expect(result.current.phase).toBe('path')
  // closeParent 与 exitToPath 是同一条路(都回「家」)—— 节 id 一并清掉,
  // 免得下次从路径进课时复用一个早已走完的旧 id。
  expect(result.current.lessonId).toBeNull()
})

it('六个相位:登录 → 路径 → 一节 / 一次练习,外加家长面板', () => {
  const { result } = renderHook(() => useAppState())
  expect(result.current.phase).toBe('boot')
  act(() => result.current.actions.enterLesson('u1#easy-0'))
  expect(result.current.phase).toBe('lesson')
  expect(result.current.lessonId).toBe('u1#easy-0')
  expect(result.current.practiceUnitId).toBeNull()
  act(() => result.current.actions.exitToPath())
  expect(result.current.phase).toBe('path')
  act(() => result.current.actions.enterPractice('u1'))
  expect(result.current.phase).toBe('practice')
  expect(result.current.practiceUnitId).toBe('u1')
  expect(result.current.lessonId).toBeNull()
})
