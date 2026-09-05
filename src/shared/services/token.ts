/**
 * 服务标识 token:让「服务接口」与「注册/取用 key」一体。
 *
 * 每个契约文件同时导出同名 const —— 接口占 type 空间、token 占 value 空间:
 *
 *   export const ProgressService = Symbol('ProgressService') as unknown as ServiceToken<ProgressService>
 *
 * 调用方一个 import 拿全:useService(ProgressService) 传值当 key,类型经幽灵品牌 __service
 * 回推为 ProgressService;registry 内部按 object 恒等存(运行时即那个 Symbol)。
 * 旧集中清单 keys.ts(ServiceKey/SERVICE_KEYS)与 map.ts(ServiceMap) 已删除——注册/取用同源,
 * 不再需要第三张手工同步映射。
 */
export interface ServiceToken<T> {
  readonly __service: T
}
