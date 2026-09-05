import { useSyncExternalStore } from 'react'

/**
 * 服务访问机制:注册 / 取用 / 订阅 收在一个文件。
 *
 * 「服务接口」与「注册/取用 key」同名一体:每个契约文件同时导出同名 const —— 接口占 type
 * 空间、token 占 value 空间(类型见下方 ServiceToken),调用方 `import { ProgressService }`
 * 一个 import 拿全。旧集中清单 keys.ts / map.ts 已删;注册/取用同源,无第三张手工映射。
 */

/** 服务标识 token 类型:幽灵品牌 __service 把 token 回推为对应服务接口。 */
export interface ServiceToken<T> {
  readonly __service: T
}

/** 响应式服务的共同形状:useServiceSnapshot 只需 getSnapshot + subscribe。 */
export interface ReactiveService<T> {
  getSnapshot(): T
  subscribe(listener: () => void): () => void
}

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

/** React 取用钩子:经 registry 按 token 取已注册实例(仅 Entry / app 组装 hook 可调)。 */
export function useService<K>(token: ServiceToken<K>): K {
  return registry.get(token)
}

/** React 订阅钩子:订阅任意响应式服务(getSnapshot 须返稳定引用,否则无限重渲染)。 */
export function useServiceSnapshot<T>(service: ReactiveService<T>): T {
  return useSyncExternalStore(service.subscribe, service.getSnapshot, service.getSnapshot)
}
