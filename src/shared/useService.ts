import { registry } from './registry'
import type { ServiceToken } from './services/token'

export function useService<K>(token: ServiceToken<K>): K {
  return registry.get(token)
}
