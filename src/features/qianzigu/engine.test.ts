import { describe, expect, it } from 'vitest'
import { createChapterRunner } from './engine'
import { CHAPTER_1 } from './ch1'
import type { Scene } from './chapter'

describe('createChapterRunner', () => {
  it('advance 逐节点推进到第一个 task', () => {
    const r = createChapterRunner(CHAPTER_1)
    const s0 = r.start()
    expect(s0.sceneIndex).toBe(0)
    // 开场 dialogue → advance 到 task
    let s = s0
    for (let i = 0; i < 5 && !s.finished; i++) {
      const scene = CHAPTER_1.scenes[s.sceneIndex]
      if (scene.kind === 'task') break
      s = r.next({ type: 'advance' }).state
    }
    expect(CHAPTER_1.scenes[s.sceneIndex].kind).toBe('task')
  })

  it('task 连续答对达 minCorrect 触发 restore effect 并推进', () => {
    const r = createChapterRunner(CHAPTER_1)
    let s = r.start()
    while (CHAPTER_1.scenes[s.sceneIndex].kind !== 'task') s = r.next({ type: 'advance' }).state
    const task = CHAPTER_1.scenes[s.sceneIndex] as Extract<Scene, { kind: 'task' }>
    let out = r.next({ type: 'task-correct', wordId: task.task.wordId, layer: task.task.layer })
    out = r.next({ type: 'task-correct', wordId: task.task.wordId, layer: task.task.layer })
    expect(out.state.sceneIndex).toBeGreaterThan(s.sceneIndex)
    expect(out.effects.some((e) => e.type === 'restore')).toBe(true)
  })

  it('boss 连续错达 maxWrong 标失败并 finished', () => {
    const r = createChapterRunner(CHAPTER_1)
    let s = r.start()
    // 推进到 boss(简化:直接找 index)
    const bossIdx = CHAPTER_1.scenes.findIndex((sc) => sc.kind === 'boss')
    while (s.sceneIndex < bossIdx) {
      const scene = CHAPTER_1.scenes[s.sceneIndex]
      if (scene.kind === 'task') {
        const t = scene as Extract<Scene, { kind: 'task' }>
        s = r.next({ type: 'task-correct', wordId: t.task.wordId, layer: t.task.layer }).state
      } else {
        s = r.next({ type: 'advance' }).state
      }
    }
    const boss = CHAPTER_1.scenes[s.sceneIndex] as Extract<Scene, { kind: 'boss' }>
    for (let i = 0; i < boss.maxWrong; i++) s = r.next({ type: 'boss-wrong' }).state
    expect(s.bossWon).toBe(false)
    expect(s.finished).toBe(true)
  })

  it('social 选中 good 才推进,选 bad 停留同 scene', () => {
    const r = createChapterRunner(CHAPTER_1)
    let s = r.start()
    const socialIdx = CHAPTER_1.scenes.findIndex((sc) => sc.kind === 'social')
    while (s.sceneIndex < socialIdx) {
      const scene = CHAPTER_1.scenes[s.sceneIndex]
      if (scene.kind === 'task') {
        const t = scene as Extract<Scene, { kind: 'task' }>
        s = r.next({ type: 'task-correct', wordId: t.task.wordId, layer: t.task.layer }).state
      } else s = r.next({ type: 'advance' }).state
    }
    const social = CHAPTER_1.scenes[s.sceneIndex] as Extract<Scene, { kind: 'social' }>
    const bad = social.options.find((o) => o.consequence !== 'good')!
    s = r.next({ type: 'social-choose', optionId: bad.id }).state
    expect(s.sceneIndex).toBe(socialIdx)         // 未推进
    s = r.next({ type: 'social-choose', optionId: social.goodOptionId }).state
    expect(s.sceneIndex).toBeGreaterThan(socialIdx)
    expect(s.socialDone).toBe(true)
  })
})
