// 服务契约统一出口。服务接口与同名 token 一体:普通导出同时带 type(接口)与 value(token),
// 因此消费者既可 `import type { ProgressService }` 仅作类型,也可 `import { ProgressService }`
// 作为注册/取用 key。纯数据/快照类型仍走 `export type`,不占 value 空间。
// 数据类随其服务契约文件归属(WordUnit→vocabulary、WordProgress/SkillKey→progress、
// UserSettings→settings、Question 族→question-engine、ApiError→api),统一经本 barrel 流出。
export type { Achievement, AchievementState } from './achievements'
export { AchievementService } from './achievements'
export type { ApiUserSettings, ApiWordProgress, User } from './api'
export { ApiError, ApiService } from './api'
export type { AudioCue } from './audio'
export { AudioService } from './audio'
export type { AuthSnapshot } from './auth'
export { AuthService } from './auth'
export type { ApiBasicsProgressRow, BasicsProgressData, BasicsProgressRow, BasicsProgressSnapshot, BasicsUnitState } from './basics-progress'
export { BASICS_UNIT_KEY_PATTERN, BasicsService } from './basics-progress'
export type { CelebrateLevel } from './celebrate'
export { CelebrateService } from './celebrate'
export type { ApiChapterProgressRow, ChapterProgressData, ChapterProgressRow, ChapterProgressSnapshot } from './chapter-progress'
export { ChapterService } from './chapter-progress'
export type { AnswerKind, ComboSnapshot } from './combo'
export { ComboService } from './combo'
export type { FoundationNeed } from './foundation'
export { FoundationService } from './foundation'
export { LuckyBonusService } from './lucky-bonus'
export type { ProgressData, ProgressSnapshot, SkillKey, WordProgress } from './progress'
export { ProgressService } from './progress'
export { ProgressRulesService } from './progress-rules'
export type {
  BaseOption,
  ChoiceQuestion,
  ListenChoiceQuestion,
  MatchQuestion,
  Question,
  QuestionKind,
  Rng,
} from './question-engine'
export { QuestionEngineService } from './question-engine'
export type { DomainKey, SettingsSnapshot, UserSettings } from './settings'
export { DOMAIN_ORDER, enableKeyOf, SettingsService } from './settings'
export type { SpeakRoleOptions, SpeechRole } from './speech'
export { SpeechService } from './speech'
export type { ToastData, ToastType } from './toast'
export { ToastService } from './toast'
export type { CategoryKey, PartOfSpeech, WordUnit } from './vocabulary'
export { CATEGORY_LABELS, VocabularyService } from './vocabulary'
export type { LoadState } from './core'
