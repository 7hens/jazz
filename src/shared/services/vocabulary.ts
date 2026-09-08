import type { ServiceToken } from './core'

/** 词分类键(5 大主题 + story 千字谷叙事补词)。 */
export type CategoryKey = 'shape' | 'food' | 'animal' | 'nature' | 'object' | 'story'

/** 词分类显示名(key→中文)。 */
export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  shape: '基础形状',
  food: '食物',
  animal: '动物',
  nature: '自然界',
  object: '交通与物品',
  story: '千字谷故事',
}

/** 词性(千字谷章节任务语法按词类分;老词缺省视为名词)。 */
export type PartOfSpeech = 'noun' | 'verb' | 'adjective' | 'social'

/** 词条(id 唯一;story 词归千字谷章节,不进 letter-forest 主题网格)。 */
export type WordUnit = {
  id: number
  emoji: string
  pinyin: string
  hanzi: string
  english: string
  category: CategoryKey
  partOfSpeech?: PartOfSpeech
  chapterId?: number
  teaser?: string
}

export interface VocabularyService {
  getAllWords(): readonly WordUnit[]
  wordById(id: number): WordUnit | undefined
}

export const VocabularyService = Symbol('VocabularyService') as unknown as ServiceToken<VocabularyService>
