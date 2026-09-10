import { describe, expect, it } from 'vitest'
import type { ChapterLine, Scene } from './chapter'
import { CHAPTER_1 } from './ch1'

// 收集一幕内会被自动朗读的台词行(供 role 合法性校验)。
// 注:原 plan 用 `'lines' in s` 三元会在 strict tsc 下把 social/boss 判为 never
// (social 含 lines 字段被并入首分支),故改为按 kind 收窄,断言语义不变。
function sceneLines(s: Scene): readonly ChapterLine[] {
  switch (s.kind) {
    case 'dialogue':
    case 'ending':
      return s.lines
    case 'task':
      return [...s.intro, ...s.onDone]
    case 'social':
      return [...s.lines, ...s.loop, ...s.onGood]
    case 'boss':
      return [...s.intro, ...s.win, ...s.lose]
    case 'settle':
      return s.summary
    case 'break':
      return []
  }
}

describe('ch1 数据完整性', () => {
  it('5 词有序(搬家语义场:房子→门→钥匙→窗户→台灯)', () => {
    expect(CHAPTER_1.wordIds).toEqual([13, 7, 14, 8, 19])
  })
  it('每个词都至少一个 task scene 覆盖 sound 与 shape', () => {
    const tasks = CHAPTER_1.scenes.filter((s): s is Extract<typeof s, { kind: 'task' }> => s.kind === 'task')
    for (const wid of CHAPTER_1.wordIds) {
      const covered = new Set(tasks.filter((t) => t.task.wordId === wid).map((t) => t.task.layer))
      expect(covered.has('sound'), `词 ${wid} 缺 sound`).toBe(true)
      expect(covered.has('shape'), `词 ${wid} 缺 shape`).toBe(true)
    }
  })
  it('含 开场/social/boss/ending/settle/break 节点', () => {
    const kinds = new Set(CHAPTER_1.scenes.map((s) => s.kind))
    for (const k of ['dialogue', 'social', 'boss', 'ending', 'settle', 'break']) {
      expect(kinds.has(k as never), `缺 ${k}`).toBe(true)
    }
  })
  it('台本行 role 合法(限本章用到的角色)', () => {
    const allowed = new Set(['lingling', 'xuwannian', 'pixiaonao', 'narrator'])
    const roles = CHAPTER_1.scenes.flatMap((s) => sceneLines(s).map((l) => l.role))
    for (const r of roles) expect(allowed.has(r), `非法 role ${String(r)}`).toBe(true)
  })
})
