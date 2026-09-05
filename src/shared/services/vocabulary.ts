import type { WordUnit } from '../types'
import type { ServiceToken } from './token'

export interface VocabularyService {
  getAllWords(): readonly WordUnit[]
  wordById(id: number): WordUnit | undefined
}

export const VocabularyService = Symbol('VocabularyService') as unknown as ServiceToken<VocabularyService>
