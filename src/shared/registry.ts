import type { ServiceToken } from './services/token'

// key = 服务 token(Symbol),value = 实例。泛型经 token 的幽灵品牌回推实例类型。
const services = new Map<object, unknown>()

export const registry = {
  register<K>(token: ServiceToken<K>, service: K) {
    services.set(token, service)
  },
  get<K>(token: ServiceToken<K>): K {
    const service = services.get(token)

    if (!service) throw new Error(`[registry] 服务未注册: ${String(token)}`)

    return service as K
  },
  has<K>(token: ServiceToken<K>) {
    return services.has(token)
  },
  clear() {
    services.clear()
  },
}
