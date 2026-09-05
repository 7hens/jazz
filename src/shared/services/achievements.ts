export type Achievement = Readonly<{
  id: string
  name: string
  description: string
  emoji: string
  reward: number
}>

export type AchievementState = Readonly<{
  completedWords: number
  categoryDone: number
  maxCombo: number
  firstCompleteToday: number
  perfectWords: number
  consecutiveDays: number
  hour: number
  totalWords: number
}>

export interface AchievementService {
  scan(state: AchievementState, earned: readonly string[]): readonly Achievement[]
}
