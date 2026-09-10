import type { VocabularyService } from '@/shared/services/vocabulary'
import { WORDS, wordById } from './words'
import { sentenceSetFor } from './sentences'

export function createVocabularyService(): VocabularyService {
  return {
    getAllWords: () => WORDS.filter((w) => w.category !== 'story'),
    wordById,
    sentenceSetFor,
  }
}
