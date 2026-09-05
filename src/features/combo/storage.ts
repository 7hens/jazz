export interface KeyValueStore {
  get(key: string): string | null
  set(key: string, value: string): void
}

export function storageAdapter(storage: Storage | null): KeyValueStore {
  return {
    get(key) {
      try {
        return storage?.getItem(key) ?? null
      } catch {
        return null
      }
    },
    set(key, value) {
      try {
        storage?.setItem(key, value)
      } catch {
        // Session storage may be blocked; combo state remains available in memory.
      }
    },
  }
}

function browserSessionStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

export const sessionStore: KeyValueStore = storageAdapter(browserSessionStorage())
