import type { VocabularyService } from '@/shared/services/vocabulary'
import { WORDS, wordById } from './words'

export function createVocabularyService(): VocabularyService {
  return {
    getAllWords: () => WORDS,
    wordById,
  }
}
