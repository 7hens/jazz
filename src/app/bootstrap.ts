import { createHttpApiService } from '@/features/api'
import { createAuthService } from '@/features/auth'
import { createProgressService } from '@/features/progress'
import { createSettingsService } from '@/features/settings-state'
import { registry } from '@/shared/registry'
import { SERVICE_KEYS } from '@/shared/services'

const CURRENT_SERVICE_KEYS = [
  SERVICE_KEYS.API,
  SERVICE_KEYS.AUTH,
  SERVICE_KEYS.PROGRESS,
  SERVICE_KEYS.SETTINGS,
] as const

export function bootstrap(): void {
  if (CURRENT_SERVICE_KEYS.every(key => registry.has(key))) return

  const api = createHttpApiService()
  registry.register(SERVICE_KEYS.API, api)

  const auth = createAuthService(api)
  registry.register(SERVICE_KEYS.AUTH, auth)

  const callbacks = {
    onUnauthorized: auth.markAnonymous,
    onError: () => undefined,
  }
  registry.register(SERVICE_KEYS.PROGRESS, createProgressService(api, callbacks))
  registry.register(SERVICE_KEYS.SETTINGS, createSettingsService(api, callbacks))
}
