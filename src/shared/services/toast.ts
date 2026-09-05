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
