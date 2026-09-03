export type KingdomKey = 'pinyin' | 'hanzi' | 'english'
export type QuestionKind = 'listen-choice' | 'choice' | 'match'

export type BaseOption = {
  id: string
  text: string
  emoji?: string
  speak?: string // 🔊 点击朗读的文本;拼音卡此处用同音汉字
}

export type ListenChoiceQuestion = {
  kind: 'listen-choice'
  prompt: string // 题干,如「听一听,选一选」
  promptSpeak: string // 进题自动朗读的文本
  options: BaseOption[] // 恰好 4 项,仅 1 项正确
  answerId: string
}

export type ChoiceQuestion = {
  kind: 'choice'
  prompt: string
  speak?: string // 可点读题干
  options: BaseOption[]
  answerId: string
}

export type MatchQuestion = {
  kind: 'match'
  prompt: string
  left: BaseOption[] // left 卡组
  right: BaseOption[] // right 卡组(乱序)
  answerMap: Record<string, string> // left.id -> right.id
}

export type Question = ListenChoiceQuestion | ChoiceQuestion | MatchQuestion

export type Level = {
  id: number
  kingdom: KingdomKey | 'mixed'
  title: string
  questions: Question[]
}

export type LevelRecord = { stars: 0 | 1 | 2 | 3; bestScore: number }

export type GameState = {
  stars: number
  exp: number
  unlocked: number // 已解锁最大关卡号,1..11
  levels: Record<number, LevelRecord>
  kingdom: Record<KingdomKey, number>
  updatedAt: string
}

export type UserProfile = { id: string; email: string; name: string }

export type SkillKey = 'pinyin' | 'hanzi' | 'english'
export type CategoryKey = 'shape' | 'food' | 'animal' | 'nature' | 'object'

export type WordUnit = {
  id: number; emoji: string; pinyin: string; hanzi: string; english: string; category: CategoryKey
}

export type WordProgress = {
  wordId: number
  completed: Record<SkillKey, boolean>
  starsEarned: number
  updatedAt: string
}

export type UserSettings = {
  enablePinyin: boolean; enableHanzi: boolean; enableEnglish: boolean; updatedAt: string
}
