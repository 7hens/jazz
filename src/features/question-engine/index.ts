import { registry } from '@/shared/registry'
import { SERVICE_KEYS } from '@/shared/services'
import type { Rng } from '@/shared/services/question-engine'
import type { Question, SkillKey, WordUnit } from '@/shared/types'

export { createQuestionEngineService, optionCountFor, speakOf, textOf } from './engine'

// TODO(Task 9): remove this legacy wrapper when the lesson consumes QuestionEngineService directly.
export function makeStepQuestions(word: WordUnit, skill: SkillKey, rng?: Rng): Question[] {
  return registry.get(SERVICE_KEYS.QUESTION_ENGINE).makeStepQuestions(word, skill, rng)
}
