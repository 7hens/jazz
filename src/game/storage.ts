export interface KeyValueStore {
  get(key: string): string | null
  set(key: string, value: string): void
}

export const sessionStore: KeyValueStore = {
  get: (k) => { try { return sessionStorage.getItem(k) } catch { return null } },
  set: (k, v) => { try { sessionStorage.setItem(k, v) } catch { /* 隐私模式忽略 */ } },
}
