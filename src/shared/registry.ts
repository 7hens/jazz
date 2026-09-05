import type { ServiceKey } from './services/keys'
import type { ServiceMap } from './services/map'

const services = new Map<ServiceKey, unknown>()

export const registry = {
  register<K extends ServiceKey>(key: K, service: ServiceMap[K]) {
    services.set(key, service)
  },
  get<K extends ServiceKey>(key: K): ServiceMap[K] {
    const service = services.get(key)

    if (!service) throw new Error(`[registry] 服务未注册: ${key}`)

    return service as ServiceMap[K]
  },
  has(key: ServiceKey) {
    return services.has(key)
  },
  clear() {
    services.clear()
  },
}
