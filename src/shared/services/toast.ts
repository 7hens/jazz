import type { ServiceToken } from './manager'

export type ToastType = 'success' | 'error' | 'info'

export type ToastData = Readonly<{
  id: number
  type: ToastType
  message: string
}>

export interface ToastService {
  getSnapshot(): readonly ToastData[]
  subscribe(listener: () => void): () => void
  show(type: ToastType, message: string): number
  dismiss(id: number): void
}

export const ToastService = Symbol('ToastService') as unknown as ServiceToken<ToastService>
