import { describe, expect, it } from 'vitest'
import type { ChapterLine, Scene, SceneKind, WordLayer } from './chapter'
import { CHAPTER_1 } from './ch1'

/** 引擎收窄:task 场景序列(kind 判别式,非 as 断言)。 */
function taskScenes(): Array<Extract<Scene, { kind: 'task' }>> {
  return CHAPTER_1.scenes.filter((s): s is Extract<Scene, { kind: 'task' }> => s.kind === 'task')
}

const LAYERS: readonly WordLayer[] = ['sound', 'shape', 'sentence']

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
  it('每词三层齐备(sound / shape / sentence)', () => {
    const tasks = taskScenes()
    for (const wid of CHAPTER_1.wordIds) {
      const covered = new Set(tasks.filter((t) => t.task.wordId === wid).map((t) => t.task.layer))
      for (const layer of LAYERS) {
        expect(covered.has(layer), `词 ${wid} 缺 ${layer}`).toBe(true)
      }
    }
  })

  it('共 23 幕、断点恰 3 个、句型幕紧跟同词 shape 之后', () => {
    expect(CHAPTER_1.scenes).toHaveLength(23)
    expect(CHAPTER_1.scenes.filter((s) => s.kind === 'break')).toHaveLength(3)
    for (const wid of CHAPTER_1.wordIds) {
      const idx = (layer: WordLayer) =>
        CHAPTER_1.scenes.findIndex((s) => s.kind === 'task' && s.task.wordId === wid && s.task.layer === layer)
      expect(idx('sentence')).toBe(idx('shape') + 1)
    }
  })

  it('restoreOrder 逐项等于 scenes 中 task 序列的 wordId(每词三层)', () => {
    expect(CHAPTER_1.restoreOrder).toEqual(taskScenes().map((s) => s.task.wordId))
    expect(CHAPTER_1.restoreOrder).toHaveLength(15)
  })

  it('含 开场/social/boss/ending/settle/break 节点', () => {
    const kinds = new Set<SceneKind>(CHAPTER_1.scenes.map((s) => s.kind))
    const required: readonly SceneKind[] = ['dialogue', 'social', 'boss', 'ending', 'settle', 'break']
    for (const k of required) {
      expect(kinds.has(k), `缺 ${k}`).toBe(true)
    }
  })
  it('台本行 role 合法(限本章用到的角色)', () => {
    const allowed = new Set(['lingling', 'xuwannian', 'pixiaonao', 'narrator'])
    const roles = CHAPTER_1.scenes.flatMap((s) => sceneLines(s).map((l) => l.role))
    for (const r of roles) expect(allowed.has(r), `非法 role ${String(r)}`).toBe(true)
  })
})
