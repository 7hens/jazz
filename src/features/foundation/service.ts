import type { BasicsProgressData, FoundationService, SkillKey, VocabularyService } from '@/shared/services'
import { unitsFor } from './decompose'
import { needFor } from './estimator'

export function createFoundationService(vocabulary: VocabularyService): FoundationService {
  return {
    unitsFor: (wordId: number, skill: SkillKey) => {
      if (skill === 'hanzi') return []
      const word = vocabulary.wordById(wordId)
      if (!word) return []
      return unitsFor(wordId, skill, vocabulary.getAllWords())
    },
    needFor: (units, models: Readonly<BasicsProgressData>) => needFor(units, models),
  }
}
