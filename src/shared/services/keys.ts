export const SERVICE_KEYS = {
  API: 'api',
  AUDIO: 'audio',
  AUTH: 'auth',
  CELEBRATE: 'celebrate',
  COMBO: 'combo',
  PROGRESS: 'progress',
  QUESTION_ENGINE: 'question-engine',
  SETTINGS: 'settings-state',
  SPEECH: 'speech',
  TOAST: 'toast',
  VOCABULARY: 'vocabulary',
} as const

export type ServiceKey = (typeof SERVICE_KEYS)[keyof typeof SERVICE_KEYS]
