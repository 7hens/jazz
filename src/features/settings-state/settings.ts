import { ApiError } from '@/shared/api-error'
import type { ApiService, SettingsService, SettingsSnapshot } from '@/shared/services'
import type { UserSettings } from '@/types'

export interface SettingsServiceCallbacks {
  onUnauthorized(): void
  onError(message: string): void
}

export function defaultSettings(): UserSettings {
  return {
    enablePinyin: true,
    enableHanzi: true,
    enableEnglish: true,
    earnedAchievements: [],
    consecutiveDays: 0,
    lastActiveDate: '',
    updatedAt: new Date().toISOString(),
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown settings error'
}

function freezeSettings(settings: UserSettings): UserSettings {
  const earnedAchievements = [...settings.earnedAchievements]
  Object.freeze(earnedAchievements)
  return Object.freeze({
    ...settings,
    earnedAchievements,
  })
}

function immutableSnapshot(next: SettingsSnapshot): SettingsSnapshot {
  const data = freezeSettings(next.data)
  return next.status === 'error'
    ? Object.freeze({ status: 'error', data, error: next.error })
    : Object.freeze({ status: next.status, data })
}

export function createSettingsService(
  api: ApiService,
  callbacks: SettingsServiceCallbacks,
): SettingsService {
  let snapshot: SettingsSnapshot = immutableSnapshot({ status: 'idle', data: defaultSettings() })
  const listeners = new Set<() => void>()
  let mutationVersion = 0
  let loadGeneration = 0

  function setSnapshot(next: SettingsSnapshot) {
    snapshot = immutableSnapshot(next)
    listeners.forEach(listener => listener())
  }

  function setMutation(next: SettingsSnapshot): number {
    mutationVersion += 1
    setSnapshot(next)
    return mutationVersion
  }

  function report(error: unknown) {
    if (error instanceof ApiError && error.status === 401) callbacks.onUnauthorized()
    else callbacks.onError(errorMessage(error))
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async load() {
      const generation = ++loadGeneration
      const startingMutationVersion = mutationVersion
      const previousData = snapshot.data
      setSnapshot({ status: 'loading', data: previousData })
      try {
        const remote = await api.getSettings()
        if (generation !== loadGeneration || mutationVersion !== startingMutationVersion) return
        setSnapshot({
          status: 'ready',
          data: { ...defaultSettings(), ...remote, earnedAchievements: [...remote.earnedAchievements] },
        })
      } catch (error) {
        if (generation !== loadGeneration || mutationVersion !== startingMutationVersion) return
        const message = errorMessage(error)
        setSnapshot({ status: 'error', data: previousData, error: message })
        report(error)
      }
    },
    async save(next) {
      const previous = snapshot
      const operationVersion = setMutation({ status: 'ready', data: next })
      try {
        await api.putSettings(next)
      } catch (error) {
        if (mutationVersion === operationVersion) setMutation(previous)
        report(error)
        throw error
      }
    },
  }
}
