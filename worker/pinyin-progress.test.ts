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
  // **`u1-0h`(困难部分的题)与 `u2-0s`(脚手架遍专用键)都是合法 key**,不是脏数据 ——
  // 它们一度被这条筛子静默丢掉,见后面两条。
  it('逐项过筛:非法 id 与非法星数都丢掉', () => {
    expect(parseStars('{"u1-0":3,"u1-0h":2,"u2-0s":1,"不是id":2,"u1-1":9,"u1-2":0,"u2-0":2}'))
      .toEqual({ 'u1-0': 3, 'u1-0h': 2, 'u2-0s': 1, 'u2-0': 2 })
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
    // 困难部分的 key(简单题 id + 'h')必须放行:2026-09-29 前这里返 null,
    // 于是孩子在困难部分**每答完一题**就吃一次 400「星级数据不合法」,那题的星一颗也存不下。
    expect(readStars({ 'u1-0': 3, 'u1-0h': 2 })).toEqual({ 'u1-0': 3, 'u1-0h': 2 })
    expect(readStars({ 'u7-4h': 1 })).toEqual({ 'u7-4h': 1 })
    // 脚手架遍专用键(`s` 后缀,2026-10-12 那行)同样必须放行:键不被认 ⇒ 这里返 null
    // ⇒ **整包 400** ⇒ 这一题之前所有待写的星全部打不进去。这正是 2026-09-29 困难部分
    // 那次事故的复刻(原始取证见 `docs/PLAN.md` P0 那行),一个字都没变。
    expect(readStars({ 'u2-0': 3, 'u2-0s': 2 })).toEqual({ 'u2-0': 3, 'u2-0s': 2 })
    expect(readStars({ 'u12-50s': 1 })).toEqual({ 'u12-50s': 1 })
  })

  // 只升不降:重玩拿了一星不该把三星冲掉。
  it('合并逐 key 取 max', () => {
    expect(mergeStars({ 'u1-0': 3, 'u1-1': 1 }, { 'u1-0': 1, 'u1-2': 2 }))
      .toEqual({ 'u1-0': 3, 'u1-1': 1, 'u1-2': 2 })
    expect(mergeStars({}, { 'u1-0': 2 })).toEqual({ 'u1-0': 2 })
    expect(mergeStars({ 'u1-0': 2 }, {})).toEqual({ 'u1-0': 2 })
    // 脚手架遍的 `s` 键与正式那道题一样走 MAX、一样只升不降:两遍互不遮蔽
    // (换键而非改 merge 是「只升不降」这条防线下的等价实现,spec 裁定 C)。
    expect(mergeStars({ 'u2-0': 3, 'u2-0s': 3 }, { 'u2-0s': 1 }))
      .toEqual({ 'u2-0': 3, 'u2-0s': 3 })
    expect(mergeStars({ 'u2-0': 3 }, { 'u2-0s': 2 }))
      .toEqual({ 'u2-0': 3, 'u2-0s': 2 })
  })
})
