import { describe, expect, it } from 'vitest'
import type { Scene, SceneKind } from './chapter'

describe('chapter 数据模型', () => {
  it('SceneKind 七值合法', () => {
    const kinds: SceneKind[] = ['dialogue', 'task', 'social', 'break', 'boss', 'ending', 'settle']
    expect(kinds).toHaveLength(7)
  })
  it('Scene 联合可承载 Dialogue 与 Task 两种形态', () => {
    const d: Scene = { id: 'open', kind: 'dialogue', lines: [] }
    const t: Scene = {
      id: 't1', kind: 'task', title: 'x', intro: [], onDone: [],
      task: { wordId: 1, layer: 'sound', minCorrect: 1 },
    }
    expect(d.kind).toBe('dialogue')
    expect(t.kind).toBe('task')
  })
})
