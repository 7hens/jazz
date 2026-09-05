import type { ToastData, ToastService, ToastType } from '@/shared/services'

export type ToastTimers = {
  setTimeout(callback: () => void, delay: number): number
  clearTimeout(id: number): void
}

function browserTimers(): ToastTimers {
  return {
    setTimeout: (callback, delay) => window.setTimeout(callback, delay),
    clearTimeout: id => window.clearTimeout(id),
  }
}

export function createToastService(timers: ToastTimers = browserTimers()): ToastService {
  let snapshot: readonly ToastData[] = Object.freeze([])
  let nextId = 0
  const listeners = new Set<() => void>()
  const timeoutByToast = new Map<number, number>()

  function publish(next: readonly ToastData[]) {
    snapshot = Object.freeze([...next])
    listeners.forEach(listener => listener())
  }

  function dismiss(id: number) {
    const next = snapshot.filter(toast => toast.id !== id)
    if (next.length === snapshot.length) return
    const timeout = timeoutByToast.get(id)
    if (timeout !== undefined) timers.clearTimeout(timeout)
    timeoutByToast.delete(id)
    publish(next)
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    show(type: ToastType, message: string) {
      const id = ++nextId
      publish([...snapshot.slice(-2), Object.freeze({ id, type, message })])
      timeoutByToast.set(id, timers.setTimeout(() => {
        timeoutByToast.delete(id)
        dismiss(id)
      }, 3000))
      return id
    },
    dismiss,
  }
}
