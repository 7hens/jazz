import { describe, expect, it } from 'vitest'
import type { ChapterProgressRow } from './chapter-progress'

describe('chapter-progress 契约', () => {
  it('行形状含 chapterId/resumeSceneId/restoreState/updatedAt', () => {
    const row: ChapterProgressRow = {
      chapterId: 1, resumeSceneId: 't1-core', restoreState: '[]', updatedAt: '2026-09-08T00:00:00.000Z',
    }
    expect(row.chapterId).toBe(1)
    expect(row.resumeSceneId).toBe('t1-core')
    expect(typeof row.restoreState).toBe('string')
  })
})
