import type { ServiceToken } from './core'

/** 词分类键(5 大主题)。 */
export type CategoryKey = 'shape' | 'food' | 'animal' | 'nature' | 'object'

/** 词条(id 1..100 唯一,词库常量在 shared/words.ts)。 */
export type WordUnit = {
  id: number
  emoji: string
  pinyin: string
  hanzi: string
  english: string
  category: CategoryKey
  teaser?: string
}

export interface VocabularyService {
  getAllWords(): readonly WordUnit[]
  wordById(id: number): WordUnit | undefined
}

export const VocabularyService = Symbol('VocabularyService') as unknown as ServiceToken<VocabularyService>
