import { createAchievementService } from '@/features/achievements'
import { createHttpApiService } from '@/features/api'
import { createAudioService } from '@/features/audio'
import { createAuthService } from '@/features/auth'
import { createCelebrateService } from '@/features/celebrate'
import { createComboService } from '@/features/combo'
import { createFoundationService } from '@/features/foundation'
import { createLuckyBonusService } from '@/features/lucky-bonus'
import { createProgressRulesService } from '@/features/lesson'
import { createProgressService } from '@/features/progress'
import { createQuestionEngineService } from '@/features/question-engine'
import { createSettingsService } from '@/features/settings-state'
import { createSpeechService } from '@/features/speech'
import { createToastService } from '@/features/toast'
import { createVocabularyService } from '@/features/vocabulary'
import {
  AchievementService,
  ApiService,
  AudioService,
  AuthService,
  CelebrateService,
  ComboService,
  LuckyBonusService,
  ProgressRulesService,
  ProgressService,
  QuestionEngineService,
  SettingsService,
  SpeechService,
  ToastService,
  VocabularyService,
  FoundationService,
} from '@/shared/services'
import { registry, type ServiceToken } from '@/shared/services/core'

// 幂等守卫只做 has 存在性,故按 ServiceToken<unknown> 拓宽,避开异构联合的泛型推断。
const ALL_SERVICE_TOKENS: readonly ServiceToken<unknown>[] = [
  AchievementService,
  ApiService,
  AudioService,
  AuthService,
  CelebrateService,
  ComboService,
  LuckyBonusService,
  ProgressRulesService,
  ProgressService,
  QuestionEngineService,
  SettingsService,
  SpeechService,
  ToastService,
  VocabularyService,
  FoundationService,
]

export function bootstrap(): void {
  if (ALL_SERVICE_TOKENS.every(token => registry.has(token))) return

  const api = createHttpApiService()
  registry.register(ApiService, api)

  const auth = createAuthService(api)
  registry.register(AuthService, auth)

  registry.register(AchievementService, createAchievementService())
  registry.register(AudioService, createAudioService())
  registry.register(CelebrateService, createCelebrateService())
  registry.register(ComboService, createComboService())
  registry.register(LuckyBonusService, createLuckyBonusService())
  registry.register(SpeechService, createSpeechService())
  const toast = createToastService()
  registry.register(ToastService, toast)

  const callbacks = {
    onUnauthorized: auth.markAnonymous,
    onError: (message: string) => { toast.show('error', message) },
  }
  registry.register(ProgressService, createProgressService(api, callbacks))
  registry.register(SettingsService, createSettingsService(api, callbacks))

  const vocabulary = createVocabularyService()
  registry.register(VocabularyService, vocabulary)
  registry.register(QuestionEngineService, createQuestionEngineService(vocabulary))
  registry.register(ProgressRulesService, createProgressRulesService())
  registry.register(FoundationService, createFoundationService(vocabulary))
}
