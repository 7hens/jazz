import { useSyncExternalStore } from 'react'

export interface ReactiveService<T> {
  getSnapshot(): T
  subscribe(listener: () => void): () => void
}

export function useServiceSnapshot<T>(service: ReactiveService<T>): T {
  return useSyncExternalStore(service.subscribe, service.getSnapshot, service.getSnapshot)
}
