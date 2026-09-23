import { describe, expect, it } from 'vitest'
import { mergeStars, parseStars, readStars } from './pinyin-progress'

describe('拼音进度 · worker 纯助手', () => {
  it('坏掉的存档当空表,不让整个接口 500', () => {
    expect(parseStars('')).toEqual({})
    expect(parseStars('不是 json')).toEqual({})
    expect(parseStars('[]')).toEqual({})
    expect(parseStars('null')).toEqual({})
  })

  // 存量里的脏数据不该被带出去:id 不合格式、星数越界的项一律丢弃。
  it('逐项过筛:非法 id 与非法星数都丢掉', () => {
    expect(parseStars('{"u1-0":3,"不是id":2,"u1-1":9,"u1-2":0,"u2-0":2}')).toEqual({ 'u1-0': 3, 'u2-0': 2 })
  })

  it('readStars 对入参校验:非对象返回 null,非法项整体 400', () => {
    expect(readStars(null)).toBeNull()
    expect(readStars([])).toBeNull()
    expect(readStars('{}')).toBeNull()
    // 空对象是**合法**的(注意与上面的字符串 '{}' 相反):新玩家首屏 PUT {stars:{}} 必须放行,
    // 否则行永远建不出来,星尘一颗也存不下。
    expect(readStars({})).toEqual({})
    expect(readStars({ 'u1-0': 4 })).toBeNull()
    expect(readStars({ 'bad': 1 })).toBeNull()
    expect(readStars({ 'u1-0': 3, 'u2-1': 1 })).toEqual({ 'u1-0': 3, 'u2-1': 1 })
  })

  // 只升不降:重玩拿了一星不该把三星冲掉。
  it('合并逐 key 取 max', () => {
    expect(mergeStars({ 'u1-0': 3, 'u1-1': 1 }, { 'u1-0': 1, 'u1-2': 2 }))
      .toEqual({ 'u1-0': 3, 'u1-1': 1, 'u1-2': 2 })
    expect(mergeStars({}, { 'u1-0': 2 })).toEqual({ 'u1-0': 2 })
    expect(mergeStars({ 'u1-0': 2 }, {})).toEqual({ 'u1-0': 2 })
  })
})
