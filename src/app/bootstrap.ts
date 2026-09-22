import { createAchievementService } from '@/features/achievements'
import { createHttpApiService } from '@/features/api'
import { createAudioService } from '@/features/audio'
import { createAuthService } from '@/features/auth'
import { createCelebrateService } from '@/features/celebrate'
import { createComboService } from '@/features/combo'
import { createLuckyBonusService } from '@/features/lucky-bonus'
import { createPinyinProgressService } from '@/features/pinyin-progress'
import { createSettingsService } from '@/features/settings-state'
import { createSpeechService } from '@/features/speech'
import { createToastService } from '@/features/toast'
import {
  AchievementService,
  ApiService,
  AudioService,
  AuthService,
  CelebrateService,
  ComboService,
  LuckyBonusService,
  PinyinProgressService,
  SettingsService,
  SpeechService,
  ToastService,
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
  PinyinProgressService,
  SettingsService,
  SpeechService,
  ToastService,
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
  registry.register(SettingsService, createSettingsService(api, callbacks))
  registry.register(PinyinProgressService, createPinyinProgressService(api, callbacks))
}
