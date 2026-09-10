import { describe, expect, it } from 'vitest'
import { CHAPTER_1 } from './ch1'
import { resolveDebugRow } from './debug-jump'

// dev-only URL 直达 ?s=<world>.<chapter>.<sceneNumber>:
//  sceneNumber = 章内幕序号(1 起,依 scenes 数组顺序,含 break,不含 settle 结算幕)。
//  产物是伪 ChapterProgressRow:resumeSceneId=目标幕 id,restoreState=目标幕前全部 task 推导集,
//  喂 resumeFromRow 即快进落在目标幕(engine 零改动)。目标非法一律 null。

// ch1 scenes 顺序(序号 1 起):1 open / 2 t1-sound / 3 t1-shape / 4 t1-sentence / 5 br1 /
//   6 t2-sound / 7 t2-shape / 8 t2-sentence / 9 br2 / 10 social-pixiaonao / 11 br3 /
//   12 t3-sound / 13 t3-shape / 14 t3-sentence / 15 t4-sound / 16 t4-shape / 17 t4-sentence /
//   18 t5-sound / 19 t5-shape / 20 t5-sentence / 21 boss / 22 ending / 23 settle

const entries = (row: { restoreState: string }): Array<{ wordId: number; layer: string }> =>
  JSON.parse(row.restoreState) as Array<{ wordId: number; layer: string }>
const key = (e: { wordId: number; layer: string }) => `${e.wordId}:${e.layer}`

const ALL_TASK_KEYS = [
  '13:sound', '13:shape', '13:sentence',
  '7:sound', '7:shape', '7:sentence',
  '14:sound', '14:shape', '14:sentence',
  '8:sound', '8:shape', '8:sentence',
  '19:sound', '19:shape', '19:sentence',
]

describe('resolveDebugRow(?s=world.chapter.sceneNumber)', () => {
  it('sceneNumber=1 → open 幕,前置无 task', () => {
    const row = resolveDebugRow(CHAPTER_1, '1.1.1')
    expect(row).not.toBeNull()
    expect(row?.resumeSceneId).toBe('open')
    expect(row?.restoreState).toBe('[]')
  })

  it('sceneNumber=6(t2-sound)前只有房子三层恢复', () => {
    const row = resolveDebugRow(CHAPTER_1, '1.1.6')
    expect(row).not.toBeNull()
    expect(row?.resumeSceneId).toBe('t2-sound')
    expect(entries(row!).map(key)).toEqual(['13:sound', '13:shape', '13:sentence'])
  })

  it('sceneNumber=5(br1)合法,restore 覆盖断点前 task', () => {
    const row = resolveDebugRow(CHAPTER_1, '1.1.5')
    expect(row).not.toBeNull()
    expect(row?.resumeSceneId).toBe('br1')
    expect(entries(row!).map(key)).toEqual(['13:sound', '13:shape', '13:sentence'])
  })

  it('sceneNumber=21(boss)/22(ending)前置推导全章 15 个 task', () => {
    for (const n of ['1.1.21', '1.1.22']) {
      const row = resolveDebugRow(CHAPTER_1, n)
      expect(row, n).not.toBeNull()
      expect(entries(row!).map(key)).toEqual(ALL_TASK_KEYS)
    }
  })

  it('sceneNumber=23(settle 结算幕)不可直跳 → null', () => {
    expect(resolveDebugRow(CHAPTER_1, '1.1.23')).toBeNull()
  })

  it('world 段≠1 忽略', () => {
    expect(resolveDebugRow(CHAPTER_1, '2.1.1')).toBeNull()
  })

  it('chapter 段≠本章 id 忽略', () => {
    expect(resolveDebugRow(CHAPTER_1, '1.2.1')).toBeNull()
  })

  it('sceneNumber 越界/0/负数忽略', () => {
    expect(resolveDebugRow(CHAPTER_1, '1.1.0')).toBeNull()
    expect(resolveDebugRow(CHAPTER_1, '1.1.99')).toBeNull()
    expect(resolveDebugRow(CHAPTER_1, '1.1.-3')).toBeNull()
  })

  it('格式非法(段数不足/非数字/空/null)忽略', () => {
    expect(resolveDebugRow(CHAPTER_1, '1.1')).toBeNull()
    expect(resolveDebugRow(CHAPTER_1, 'abc')).toBeNull()
    expect(resolveDebugRow(CHAPTER_1, '1.1.x')).toBeNull()
    expect(resolveDebugRow(CHAPTER_1, '')).toBeNull()
    expect(resolveDebugRow(CHAPTER_1, null)).toBeNull()
  })
})
