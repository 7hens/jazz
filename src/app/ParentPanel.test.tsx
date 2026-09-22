import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AuthService, PinyinProgressService } from '@/shared/services'
import { registry } from '@/shared/services/core'
import { ParentPanel } from './ParentPanel'

function register(auth: unknown, progress: unknown) {
  registry.clear()
  registry.register(AuthService, auth as never)
  registry.register(PinyinProgressService, progress as never)
}

// 「取消后进度仍被清空」的两种真实长相:同步调用,或把调用推迟到微任务/定时器里。
// 同步断言对后者完全失明 —— 所以下面的取消用例必须先排干微任务与定时器再断言。
const DEFERRED_CLEAR = '取消后进度仍被清空:调用被推迟到微任务/定时器里,原同步断言看不见'

describe('家长面板', () => {
  afterEach(() => {
    cleanup()
    registry.clear()
    vi.useRealTimers()
    // confirm 的 spy 会跨用例泄漏(spyOn 挂在 window 上),显式收回。
    vi.restoreAllMocks()
  })

  it('登出调 AuthService.logout', async () => {
    const logout = vi.fn().mockResolvedValue(undefined)
    register({ logout }, { getSnapshot: () => ({ status: 'ready', data: {} }), subscribe: () => () => {}, resetAll: vi.fn() })
    render(<ParentPanel onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '退出登录' }))
    expect(logout).toHaveBeenCalled()
  })

  // 清空进度不可逆,必须先确认 —— 一键抹掉孩子全部星星是这里最坏的可能。
  it('重置进度要先确认,取消则什么都不做', async () => {
    const calls: string[] = []
    const resetAll = vi.fn().mockImplementation(() => {
      calls.push('resetAll')
      return Promise.resolve()
    })
    register(
      { logout: vi.fn() },
      { getSnapshot: () => ({ status: 'ready', data: {} }), subscribe: () => () => {}, resetAll },
    )
    vi.useFakeTimers()
    vi.spyOn(window, 'confirm').mockImplementation(() => {
      calls.push('confirm')
      return false
    })
    render(<ParentPanel onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '重置全部进度' }))
    // 排干微任务与定时器:任何「取消后仍把清空推迟执行」的写法都必须在这一步现形
    await vi.runAllTimersAsync()
    expect(window.confirm).toHaveBeenCalled()
    expect(resetAll, DEFERRED_CLEAR).not.toHaveBeenCalled()
    // 顺序是被断言的对象,不是副作用:取消时除了一次 confirm,不该再多出任何一步。
    expect(calls, DEFERRED_CLEAR).toEqual(['confirm'])
  })

  it('确认后才真的清', async () => {
    const calls: string[] = []
    const resetAll = vi.fn().mockImplementation(() => {
      calls.push('resetAll')
      return Promise.resolve()
    })
    register(
      { logout: vi.fn() },
      { getSnapshot: () => ({ status: 'ready', data: {} }), subscribe: () => () => {}, resetAll },
    )
    vi.useFakeTimers()
    vi.spyOn(window, 'confirm').mockImplementation(() => {
      calls.push('confirm')
      return true
    })
    render(<ParentPanel onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '重置全部进度' }))
    await vi.runAllTimersAsync()
    expect(resetAll).toHaveBeenCalled()
    // 排干之后仍然必须是「先问、后清」这个次序 —— 倒置或只走个过场都会在这里露馅。
    expect(calls, '确认后顺序必须是先 confirm 再 resetAll,顺序反了说明 confirm 只是走过场').toEqual([
      'confirm',
      'resetAll',
    ])
  })
})
