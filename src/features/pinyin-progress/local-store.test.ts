import { describe, expect, it, vi } from 'vitest'
import type { PinyinProgressData } from '@/shared/services'
import { LOCAL_PROGRESS_KEY, clearLocalProgress, parseLocalProgress, readLocalProgress, writeLocalProgress } from './local-store'

/** 可控的假 Storage:真 localStorage 在 jsdom 里是共享单例,用例之间会互相串味。 */
function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  } as unknown as Storage & { map: Map<string, string> }
}

function blockedStorage(): Storage {
  return {
    getItem: () => { throw new Error('blocked') },
    setItem: () => { throw new Error('blocked') },
    removeItem: () => { throw new Error('blocked') },
  } as unknown as Storage
}

const DATA: PinyinProgressData = { stars: { 'u1-0': 3, 'u2-1': 1 }, totalStars: 120 }

describe('进度兜底副本', () => {
  it('写进去读得出来', () => {
    const storage = fakeStorage()
    writeLocalProgress(DATA, storage)
    expect(readLocalProgress(storage)).toEqual(DATA)
  })

  it('没写过时是 null', () => {
    expect(readLocalProgress(fakeStorage())).toBeNull()
  })

  // 存的东西可能是别的版本写的、被人手改过、或者只写了一半 —— 一律当没有,不能把脏数据带进游戏。
  it('坏 JSON 当作没有副本', () => {
    expect(parseLocalProgress('{"stars":')).toBeNull()
    expect(parseLocalProgress('null')).toBeNull()
    expect(parseLocalProgress('"u1-0"')).toBeNull()
    expect(parseLocalProgress('[{"stars":{}}]')).toBeNull()
  })

  it('形状不对当作没有副本', () => {
    expect(parseLocalProgress(JSON.stringify({ stars: 'nope', totalStars: 1 }))).toBeNull()
    expect(parseLocalProgress(JSON.stringify({ stars: { 'u1-0': 0 }, totalStars: 1 }))).toBeNull()
    expect(parseLocalProgress(JSON.stringify({ stars: { 'u1-0': 4 }, totalStars: 1 }))).toBeNull()
    expect(parseLocalProgress(JSON.stringify({ stars: { 'u1-0': 2.5 }, totalStars: 1 }))).toBeNull()
    expect(parseLocalProgress(JSON.stringify({ stars: { 'u1-0': '3' }, totalStars: 1 }))).toBeNull()
    expect(parseLocalProgress(JSON.stringify({ stars: { '': 3 }, totalStars: 1 }))).toBeNull()
    expect(parseLocalProgress(JSON.stringify({ stars: { 'u1-0': 3 }, totalStars: 1.5 }))).toBeNull()
  })

  // 关 id 的严格度必须跟 worker 的 `readStars` 对齐:副本里留一个服务端会 400 的键,
  // 会把之后每一次 PUT(通关 / 自愈)全部打回来 —— 坏在离副本很远的地方。
  it('服务端会拒的关 id 不许进副本', () => {
    expect(parseLocalProgress(JSON.stringify({ stars: { 'not-a-level': 3 }, totalStars: 1 }))).toBeNull()
    expect(parseLocalProgress(JSON.stringify({ stars: { u1: 3 }, totalStars: 1 }))).toBeNull()
    expect(parseLocalProgress(JSON.stringify({ stars: { 'u1-x': 3 }, totalStars: 1 }))).toBeNull()
    expect(parseLocalProgress(JSON.stringify({ stars: { 'U1-0': 3 }, totalStars: 1 }))).toBeNull()
    // worker 认的还是照收。
    expect(parseLocalProgress(JSON.stringify({ stars: { 'u10-12': 3 }, totalStars: 1 }))).toEqual({
      stars: { 'u10-12': 3 },
      totalStars: 1,
    })
    // 困难部分的 id(简单题 id + 'h')同样照收:漏了它副本**整份**判废(返 null),
    // 兜底副本就再不写了 —— 静默,而且与 worker 那次 400 是同一个根因。
    expect(parseLocalProgress(JSON.stringify({ stars: { 'u1-0h': 3 }, totalStars: 1 }))).toEqual({
      stars: { 'u1-0h': 3 },
      totalStars: 1,
    })
    expect(parseLocalProgress(JSON.stringify({ stars: {}, totalStars: -1 }))).toBeNull()
    expect(parseLocalProgress(JSON.stringify({ stars: {}, totalStars: '120' }))).toBeNull()
    // 上限与 worker 的 MAX_TOTAL_STARS 对齐,同「服务端会拒的关 id」一个道理。
    expect(parseLocalProgress(JSON.stringify({ stars: {}, totalStars: 1_000_001 }))).toBeNull()
    expect(parseLocalProgress(JSON.stringify({ stars: {}, totalStars: 1_000_000 }))).toEqual({
      stars: {},
      totalStars: 1_000_000,
    })
    expect(parseLocalProgress(JSON.stringify({ stars: {} }))).toBeNull()
  })

  // 副本里多出来的字段不进游戏 —— 否则以后改形状时,老键里的残留会以「合法数据」的身份混进来。
  it('只取 stars 与 totalStars', () => {
    expect(parseLocalProgress(JSON.stringify({ ...DATA, schema: 2 }))).toEqual(DATA)
  })

  // 数据源里有一份我们控制不了的服务端响应 —— 坏形状宁可这次不写,也不留一份毒副本。
  it('只写自己读得回来的东西', () => {
    const storage = fakeStorage()
    writeLocalProgress({ stars: { 'not-a-level': 3 }, totalStars: 0 }, storage)
    writeLocalProgress({ stars: {}, totalStars: -1 }, storage)
    expect(readLocalProgress(storage)).toBeNull()
  })

  it('storage 整个不可用(隐私模式)时不炸、当作没有副本', () => {
    expect(readLocalProgress(blockedStorage())).toBeNull()
    expect(() => writeLocalProgress(DATA, blockedStorage())).not.toThrow()
    expect(() => clearLocalProgress(blockedStorage())).not.toThrow()
  })

  it('没有 storage(window 都没有)时也不炸', () => {
    expect(readLocalProgress(null)).toBeNull()
    expect(() => writeLocalProgress(DATA, null)).not.toThrow()
    expect(() => clearLocalProgress(null)).not.toThrow()
  })

  it('clear 之后读不到', () => {
    const storage = fakeStorage()
    writeLocalProgress(DATA, storage)
    clearLocalProgress(storage)
    expect(readLocalProgress(storage)).toBeNull()
  })

  // 真实场景:隐私模式下 localStorage 在跑的时候突然开始抛(配额满)。
  it('写到一半开始抛时不影响读写两边', () => {
    const storage = fakeStorage()
    writeLocalProgress(DATA, storage)
    const setItem = vi.spyOn(storage, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError') })
    expect(() => writeLocalProgress({ stars: {}, totalStars: 0 }, storage)).not.toThrow()
    setItem.mockRestore()
    expect(readLocalProgress(storage)).toEqual(DATA)
  })

  it('键带版本号', () => {
    const storage = fakeStorage()
    writeLocalProgress(DATA, storage)
    expect([...storage.map.keys()]).toEqual([LOCAL_PROGRESS_KEY])
    expect(LOCAL_PROGRESS_KEY).toMatch(/\.v\d+$/)
  })
})
