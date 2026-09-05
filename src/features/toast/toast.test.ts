import { describe, expect, it, vi } from 'vitest'
import { createToastService } from './toast'

function fakeTimers() {
  let nextId = 0
  const callbacks = new Map<number, () => void>()
  return {
    timers: {
      setTimeout(callback: () => void, delay: number) {
        expect(delay).toBe(3000)
        const id = ++nextId
        callbacks.set(id, callback)
        return id
      },
      clearTimeout(id: number) { callbacks.delete(id) },
    },
    fire(id: number) { callbacks.get(id)?.() },
  }
}

describe('ToastService', () => {
  it('publishes at most three toasts with stable sequential IDs', () => {
    const { timers } = fakeTimers()
    const service = createToastService(timers)
    const listener = vi.fn()
    service.subscribe(listener)

    expect(service.show('success', '答对了')).toBe(1)
    service.show('error', '网络异常')
    service.show('info', '继续加油')
    service.show('success', '太棒了')

    expect(service.getSnapshot()).toEqual([
      { id: 2, type: 'error', message: '网络异常' },
      { id: 3, type: 'info', message: '继续加油' },
      { id: 4, type: 'success', message: '太棒了' },
    ])
    expect(Object.isFrozen(service.getSnapshot())).toBe(true)
    expect(listener).toHaveBeenCalledTimes(4)
  })

  it('dismisses explicitly and after the unchanged 3000ms timeout', () => {
    const harness = fakeTimers()
    const service = createToastService(harness.timers)
    const first = service.show('info', '第一条')
    const second = service.show('error', '第二条')

    service.dismiss(first)
    expect(service.getSnapshot().map(toast => toast.id)).toEqual([second])

    harness.fire(2)
    expect(service.getSnapshot()).toEqual([])
  })
})
