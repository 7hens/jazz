import type { ApiService } from './api'
import type { AuthService } from './auth'
import type { ProgressService } from './progress'
import type { QuestionEngineService } from './question-engine'
import type { SettingsService } from './settings'
import type { VocabularyService } from './vocabulary'

export interface ServiceMap {
  api: ApiService
  auth: AuthService
  progress: ProgressService
  'question-engine': QuestionEngineService
  'settings-state': SettingsService
  vocabulary: VocabularyService
}
