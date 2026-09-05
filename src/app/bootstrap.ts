import { createHttpApiService } from '@/features/api'
import { createAudioService } from '@/features/audio'
import { createAuthService } from '@/features/auth'
import { createCelebrateService } from '@/features/celebrate'
import { createComboService } from '@/features/combo'
import { createProgressService } from '@/features/progress'
import { createQuestionEngineService } from '@/features/question-engine'
import { createSettingsService } from '@/features/settings-state'
import { createSpeechService } from '@/features/speech'
import { createToastService } from '@/features/toast'
import { createVocabularyService } from '@/features/vocabulary'
import { registry } from '@/shared/registry'
import { SERVICE_KEYS } from '@/shared/services'

const CURRENT_SERVICE_KEYS = [
  SERVICE_KEYS.API,
  SERVICE_KEYS.AUDIO,
  SERVICE_KEYS.AUTH,
  SERVICE_KEYS.CELEBRATE,
  SERVICE_KEYS.COMBO,
  SERVICE_KEYS.PROGRESS,
  SERVICE_KEYS.QUESTION_ENGINE,
  SERVICE_KEYS.SETTINGS,
  SERVICE_KEYS.SPEECH,
  SERVICE_KEYS.TOAST,
  SERVICE_KEYS.VOCABULARY,
] as const

export function bootstrap(): void {
  if (CURRENT_SERVICE_KEYS.every(key => registry.has(key))) return

  const api = createHttpApiService()
  registry.register(SERVICE_KEYS.API, api)

  const auth = createAuthService(api)
  registry.register(SERVICE_KEYS.AUTH, auth)

  registry.register(SERVICE_KEYS.AUDIO, createAudioService())
  registry.register(SERVICE_KEYS.CELEBRATE, createCelebrateService())
  registry.register(SERVICE_KEYS.COMBO, createComboService())
  registry.register(SERVICE_KEYS.SPEECH, createSpeechService())
  const toast = createToastService()
  registry.register(SERVICE_KEYS.TOAST, toast)

  const callbacks = {
    onUnauthorized: auth.markAnonymous,
    onError: (message: string) => { toast.show('error', message) },
  }
  registry.register(SERVICE_KEYS.PROGRESS, createProgressService(api, callbacks))
  registry.register(SERVICE_KEYS.SETTINGS, createSettingsService(api, callbacks))

  const vocabulary = createVocabularyService()
  registry.register(SERVICE_KEYS.VOCABULARY, vocabulary)
  registry.register(SERVICE_KEYS.QUESTION_ENGINE, createQuestionEngineService(vocabulary))
}
