import type { ApiService } from './api'
import type { AudioService } from './audio'
import type { AuthService } from './auth'
import type { CelebrateService } from './celebrate'
import type { ComboService } from './combo'
import type { ProgressService } from './progress'
import type { QuestionEngineService } from './question-engine'
import type { SettingsService } from './settings'
import type { SpeechService } from './speech'
import type { ToastService } from './toast'
import type { VocabularyService } from './vocabulary'

export interface ServiceMap {
  api: ApiService
  audio: AudioService
  auth: AuthService
  celebrate: CelebrateService
  combo: ComboService
  progress: ProgressService
  'question-engine': QuestionEngineService
  'settings-state': SettingsService
  speech: SpeechService
  toast: ToastService
  vocabulary: VocabularyService
}
