import { describe, expect, it } from 'vitest'
import type { CategoryKey, PartOfSpeech } from '@/shared/services/vocabulary'

describe('vocabulary 类型升级', () => {
  it('story 是合法 CategoryKey,且 PartOfSpeech 四值存在', () => {
    const story: CategoryKey = 'story'
    const pos: PartOfSpeech[] = ['noun', 'verb', 'adjective', 'social']
    expect(story).toBe('story')
    expect(pos).toHaveLength(4)
  })
})
