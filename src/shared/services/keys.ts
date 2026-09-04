export const SERVICE_KEYS = {
  API: 'api',
  AUTH: 'auth',
  PROGRESS: 'progress',
  QUESTION_ENGINE: 'question-engine',
  SETTINGS: 'settings-state',
  VOCABULARY: 'vocabulary',
} as const

export type ServiceKey = (typeof SERVICE_KEYS)[keyof typeof SERVICE_KEYS]
