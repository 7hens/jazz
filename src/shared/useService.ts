import { registry } from './registry'
import type { ServiceKey } from './services/keys'
import type { ServiceMap } from './services/map'

export function useService<K extends ServiceKey>(key: K): ServiceMap[K] {
  return registry.get(key)
}
