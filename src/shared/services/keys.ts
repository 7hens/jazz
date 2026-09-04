export const SERVICE_KEYS = { API: 'api', AUTH: 'auth' } as const

export type ServiceKey = (typeof SERVICE_KEYS)[keyof typeof SERVICE_KEYS]
