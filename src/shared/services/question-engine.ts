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

/** 出题上下文:干扰项优先取自这些词(场景词 > 已学复习词 > 同 category > 跨类)。 */
export type QuestionContext = Readonly<{
  /** 本章场景词(ch1 = chapter.wordIds)。 */
  sceneWordIds?: readonly number[]
  /** 已学复习词(progress 中已完成的词)。 */
  learnedWordIds?: readonly number[]
}>

/** 句型题入参的最小结构(shared 不得依赖 features 的具体类型)。 */
export type SentenceTextSet = {
  readonly tiers: readonly [
    { readonly correct: string; readonly wrong: readonly [string, string, string] },
    { readonly correct: string; readonly wrong: readonly [string, string, string] },
    { readonly correct: string; readonly wrong: readonly [string, string, string] },
  ]
}

export interface QuestionEngineService {
  optionCountFor(wordId: number): number
  textOf(word: WordUnit, skill: SkillKey): string
  speakOf(word: WordUnit, skill: SkillKey): string
  distractorsFor(word: WordUnit, count: number, rng?: Rng, context?: QuestionContext): WordUnit[]
  makeChoice(word: WordUnit, skill: SkillKey, rng: Rng, step?: number, context?: QuestionContext): ChoiceQuestion
  makeListen(word: WordUnit, skill: SkillKey, rng: Rng, step?: number, context?: QuestionContext): ListenChoiceQuestion
  makeMatch(word: WordUnit, skill: SkillKey, rng: Rng, step?: number, context?: QuestionContext): MatchQuestion
  makeStepQuestions(word: WordUnit, skill: SkillKey, rng?: Rng, context?: QuestionContext): Question[]
  /** 句型步:恒 3 题,顺序 = 档 1 → 档 3;每题 4 句选一(1 正 + 3 错)。 */
  makeSentenceQuestions(word: WordUnit, set: SentenceTextSet, rng?: Rng): ChoiceQuestion[]
}

export const QuestionEngineService = Symbol('QuestionEngineService') as unknown as ServiceToken<QuestionEngineService>
