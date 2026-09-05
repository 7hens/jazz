import type {
  ChoiceQuestion,
  ListenChoiceQuestion,
  MatchQuestion,
  Question,
  SkillKey,
  WordUnit,
} from '../types'

export type Rng = () => number

export interface QuestionEngineService {
  optionCountFor(wordId: number): number
  textOf(word: WordUnit, skill: SkillKey): string
  speakOf(word: WordUnit, skill: SkillKey): string
  distractorsFor(word: WordUnit, count: number, rng?: Rng): WordUnit[]
  makeChoice(word: WordUnit, skill: SkillKey, rng: Rng, step?: number): ChoiceQuestion
  makeListen(word: WordUnit, skill: SkillKey, rng: Rng, step?: number): ListenChoiceQuestion
  makeMatch(word: WordUnit, skill: SkillKey, rng: Rng, step?: number): MatchQuestion
  makeStepQuestions(word: WordUnit, skill: SkillKey, rng?: Rng): Question[]
}
