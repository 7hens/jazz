import type { ServiceToken } from './core'

/** 词分类键(5 大主题)。 */
export type CategoryKey = 'shape' | 'food' | 'animal' | 'nature' | 'object'

/** 词分类显示名(key→中文)。 */
export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  shape: '基础形状',
  food: '食物',
  animal: '动物',
  nature: '自然界',
  object: '交通与物品',
}

/** 词条(id 1..100 唯一,词库常量 WORDS/wordById 在 features/vocabulary/words.ts)。 */
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
