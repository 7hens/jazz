import { act, renderHook } from '@testing-library/react'
import { expect, it } from 'vitest'
import { useAppState } from './useAppState'

it('starts in boot with no unit selected', () => {
  const { result } = renderHook(() => useAppState())

  expect(result.current.phase).toBe('boot')
  expect(result.current.currentUnitIndex).toBeNull()
})

it('boot → map:exitToMap 是登录成功后的落点', () => {
  const { result } = renderHook(() => useAppState())

  act(() => result.current.actions.exitToMap())

  expect(result.current.phase).toBe('map')
  expect(result.current.currentUnitIndex).toBeNull()
})

it('map → level:enterUnit 记下单元并进关卡', () => {
  const { result } = renderHook(() => useAppState())

  act(() => result.current.actions.enterUnit(2))

  expect(result.current.phase).toBe('level')
  expect(result.current.currentUnitIndex).toBe(2)
})

it('level → map:exitToMap 回地图并把 currentUnitIndex 清干净', () => {
  const { result } = renderHook(() => useAppState())

  act(() => result.current.actions.enterUnit(4))
  expect(result.current.currentUnitIndex).toBe(4)

  act(() => result.current.actions.exitToMap())

  expect(result.current.phase).toBe('map')
  // 清干净是有意的:残留的单元号会让「回地图后又进关卡」渲染错单元(或复用旧 key)。
  expect(result.current.currentUnitIndex).toBeNull()
})

it('map → parent → map:家长面板开得开、合得上', () => {
  const { result } = renderHook(() => useAppState())

  act(() => result.current.actions.exitToMap())
  act(() => result.current.actions.openParent())
  expect(result.current.phase).toBe('parent')

  act(() => result.current.actions.closeParent())
  expect(result.current.phase).toBe('map')
})

it('level → parent → map:关卡里开家长面板,关掉落回地图(不是关卡)', () => {
  const { result } = renderHook(() => useAppState())

  act(() => result.current.actions.enterUnit(1))
  act(() => result.current.actions.openParent())
  expect(result.current.phase).toBe('parent')

  act(() => result.current.actions.closeParent())

  expect(result.current.phase).toBe('map')
  // 相位是唯一真源:closeParent 不负责清单元号,残留值本身进不了关卡分支
  // (App 的关卡分支要求 phase === 'level')。
  expect(result.current.currentUnitIndex).toBe(1)
})
