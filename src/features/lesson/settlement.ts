import type { ProgressData, ProgressService, Rng, SettingsService } from '@/shared/services'
import type { UserSettings, WordProgress, WordUnit } from '@/shared/types'
import { fullComplete } from './lesson'

export type SettlementSession = Readonly<{
  firstCompleteToday: number
  perfectWords: number
}>

export type SettlementAchievement = Readonly<{
  id: string
  name: string
  description: string
  emoji: string
  reward: number
}>

export type SettlementAchievementState = Readonly<{
  completedWords: number
  categoryDone: number
  maxCombo: number
  firstCompleteToday: number
  perfectWords: number
  consecutiveDays: number
  hour: number
  totalWords: number
}>

export type SettlementInput = Readonly<{
  word: WordUnit
  words: readonly WordUnit[]
  progress: ProgressData
  settings: UserSettings
  eligible: boolean
  perfect: boolean
  stepReward: number
  wordBonus: number
  comboReward: number
  maxCombo: number
  session: SettlementSession
  pendingPersistence?: readonly Promise<unknown>[]
  now?: () => Date
  rng?: Rng
}>

export type SettlementServices<TAchievement extends SettlementAchievement = SettlementAchievement> = Readonly<{
  progress: Pick<ProgressService, 'saveStep'>
  settings: Pick<SettingsService, 'save'>
  achievements: {
    scan(state: SettlementAchievementState, earned: string[]): readonly TAchievement[]
  }
  lucky: {
    roll(rng?: Rng): number
  }
  overlays: {
    enqueue(achievements: readonly TAchievement[], luckyReward: number): void
  }
}>

export type SettlementResult<TAchievement extends SettlementAchievement = SettlementAchievement> = Readonly<{
  word: WordUnit
  progress: ProgressData
  settings: UserSettings
  session: SettlementSession
  newlyComplete: boolean
  stepReward: number
  wordBonus: number
  extraReward: number
  luckyReward: number
  achievements: readonly TAchievement[]
}>

const pad = (value: number) => String(value).padStart(2, '0')

function todayKey(now: Date): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function shiftDate(date: string, delta: number): string {
  const [year, month, day] = date.split('-').map(Number)
  return todayKey(new Date(year, (month ?? 1) - 1, (day ?? 1) + delta))
}

function nextConsecutive(previous: number, lastDate: string, today: string): number {
  if (lastDate === '') return 1
  if (lastDate === today) return previous
  if (shiftDate(today, -1) === lastDate) return previous + 1
  return 1
}

function completedWordCount(
  words: readonly WordUnit[],
  progress: ProgressData,
  settings: UserSettings,
): number {
  return words.filter(word => fullComplete(progress[word.id], settings)).length
}

function completedCategoryCount(
  words: readonly WordUnit[],
  progress: ProgressData,
  settings: UserSettings,
): number {
  const categories = new Map<string, WordUnit[]>()
  for (const word of words) {
    const category = categories.get(word.category) ?? []
    category.push(word)
    categories.set(word.category, category)
  }
  let count = 0
  for (const category of categories.values()) {
    if (category.every(word => fullComplete(progress[word.id], settings))) count += 1
  }
  return count
}

function addReward(
  progress: ProgressData,
  word: WordUnit,
  reward: number,
  updatedAt: string,
): ProgressData {
  if (reward <= 0) return progress
  const current = progress[word.id]
  if (!current) return progress
  const next: WordProgress = {
    ...current,
    completed: { ...current.completed },
    starsEarned: current.starsEarned + reward,
    updatedAt,
  }
  return { ...progress, [word.id]: next }
}

function command(run: () => Promise<void>): Promise<void> {
  try {
    return run()
  } catch (error) {
    return Promise.reject(error)
  }
}

export async function coordinateSettlement<TAchievement extends SettlementAchievement>(
  input: SettlementInput,
  services: SettlementServices<TAchievement>,
): Promise<SettlementResult<TAchievement>> {
  const clock = input.now ?? (() => new Date())
  const now = clock()
  const row = input.progress[input.word.id]
  const newlyComplete = input.eligible && fullComplete(row, input.settings)

  // 1. Base stars already live in the per-step row. Only a newly completed word
  // may retain the answer-by-answer combo pool.
  const comboReward = newlyComplete ? input.comboReward : 0

  // 2. Preserve the single lucky roll and its position before progress/streak work.
  const luckyReward = newlyComplete ? services.lucky.roll(input.rng) : 0

  // 3. Apply immediate whole-word rewards before deriving completion statistics.
  const immediateReward = comboReward + luckyReward
  const progressWithImmediateReward = addReward(
    input.progress,
    input.word,
    immediateReward,
    now.toISOString(),
  )

  // 4. Advance the local-calendar learning streak with the unchanged rules.
  const today = todayKey(now)
  const settingsWithStreak: UserSettings = {
    ...input.settings,
    lastActiveDate: today,
    consecutiveDays: nextConsecutive(
      input.settings.consecutiveDays,
      input.settings.lastActiveDate,
      today,
    ),
  }
  const session: SettlementSession = {
    firstCompleteToday: input.session.firstCompleteToday + (newlyComplete ? 1 : 0),
    perfectWords: input.session.perfectWords + (input.perfect ? 1 : 0),
  }

  // 5. Scan once using the post-completion progress and post-streak settings.
  const achievements = services.achievements.scan({
    completedWords: completedWordCount(input.words, progressWithImmediateReward, settingsWithStreak),
    categoryDone: completedCategoryCount(input.words, progressWithImmediateReward, settingsWithStreak),
    maxCombo: input.maxCombo,
    firstCompleteToday: session.firstCompleteToday,
    perfectWords: session.perfectWords,
    consecutiveDays: settingsWithStreak.consecutiveDays,
    hour: now.getHours(),
    totalWords: input.words.length,
  }, [...settingsWithStreak.earnedAchievements])

  const achievementReward = achievements.reduce((sum, achievement) => sum + achievement.reward, 0)
  const extraReward = immediateReward + achievementReward
  const progress = addReward(
    progressWithImmediateReward,
    input.word,
    achievementReward,
    now.toISOString(),
  )
  const settings: UserSettings = achievements.length === 0
    ? settingsWithStreak
    : {
        ...settingsWithStreak,
        earnedAchievements: Array.from(new Set([
          ...settingsWithStreak.earnedAchievements,
          ...achievements.map(achievement => achievement.id),
        ])),
      }

  // 6. Start progress before settings, retain the existing parallel persistence,
  // and wait for both success or rollback before publishing navigation.
  const persistence = [...(input.pendingPersistence ?? [])]
  if (extraReward > 0) {
    const finalRow = progress[input.word.id]
    if (finalRow) persistence.push(command(() => services.progress.saveStep(finalRow)))
  }
  const dayChanged = settings.lastActiveDate !== input.settings.lastActiveDate
    || settings.consecutiveDays !== input.settings.consecutiveDays
  if (newlyComplete || achievements.length > 0 || dayChanged) {
    persistence.push(command(() => services.settings.save(settings)))
  }
  await Promise.allSettled(persistence)

  // 7. The consumer shows the settlement page first, then drains achievements,
  // then the lucky effect. The coordinator resolves only after this enqueue.
  services.overlays.enqueue(achievements, luckyReward)

  return {
    word: input.word,
    progress,
    settings,
    session,
    newlyComplete,
    stepReward: input.stepReward,
    wordBonus: input.wordBonus,
    extraReward,
    luckyReward,
    achievements,
  }
}
