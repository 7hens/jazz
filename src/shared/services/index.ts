// 服务契约统一出口。服务接口与同名 token 一体:普通导出同时带 type(接口)与 value(token),
// 因此消费者既可 `import type { AchievementService }` 仅作类型,也可 `import { AchievementService }`
// 作为注册/取用 key。纯数据/快照类型仍走 `export type`,不占 value 空间。
// 数据类随其服务契约文件归属(UserSettings→settings、ApiError/Rng→api/lucky-bonus),
// 统一经本 barrel 流出。
export type { Achievement, AchievementState } from './achievements'
export { AchievementService } from './achievements'
export type { ApiUserSettings, User } from './api'
export { ApiError, ApiService } from './api'
export type { AudioCue } from './audio'
export { AudioService } from './audio'
export type { AuthSnapshot } from './auth'
export { AuthService } from './auth'
export type { CelebrateLevel } from './celebrate'
export { CelebrateService } from './celebrate'
export type { AnswerKind, ComboSnapshot } from './combo'
export { ComboService } from './combo'
export type { Rng } from './lucky-bonus'
export { LuckyBonusService } from './lucky-bonus'
export type { LevelStars, LevelClear, PinyinProgressData, PinyinProgressSnapshot } from './pinyin-progress'
export { PinyinProgressService } from './pinyin-progress'
export type { SettingsSnapshot, UserSettings } from './settings'
export { SettingsService } from './settings'
export type { SpeakRoleOptions, SpeechRole } from './speech'
export { SpeechService } from './speech'
export type { ToastData, ToastType } from './toast'
export { ToastService } from './toast'
export type { LoadState } from './core'
