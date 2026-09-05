import type { ServiceToken } from './core'
import type { SkillKey } from './progress'
import type { WordUnit } from './vocabulary'

/** 题型判别:听音选图 / 看图选题 / 配对。 */
export type QuestionKind = 'listen-choice' | 'choice' | 'match'

/** 选项共用形状:text 为卡面文本,emoji/speak 可空(朗读文本另由 speakOf 推导)。 */
export type BaseOption = {
  id: string
  text: string
  emoji?: string
  speak?: string
}

export type ListenChoiceQuestion = {
  kind: 'listen-choice'
  prompt: string
  promptSpeak: string
  options: BaseOption[]
  answerId: string
}

export type ChoiceQuestion = {
  kind: 'choice'
  prompt: string
  speak?: string
  options: BaseOption[]
  answerId: string
}

export type MatchQuestion = {
  kind: 'match'
  prompt: string
  left: BaseOption[]
  right: BaseOption[]
  answerMap: Record<string, string>
}

export type Question = ListenChoiceQuestion | ChoiceQuestion | MatchQuestion

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

export const QuestionEngineService = Symbol('QuestionEngineService') as unknown as ServiceToken<QuestionEngineService>
