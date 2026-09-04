import { ApiError } from '@/shared/api-error'
import type { ApiService, SettingsService, SettingsSnapshot } from '@/shared/services'
import type { UserSettings } from '@/shared/types'

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
  let settledSnapshot = snapshot
  const listeners = new Set<() => void>()
  let nextCommandId = 0
  let latestStateCommandId = 0
  type SaveTransaction = {
    settings: UserSettings
    status: 'pending' | 'succeeded' | 'failed'
  }
  const saveTransactions: SaveTransaction[] = []

  function setSnapshot(next: SettingsSnapshot) {
    snapshot = immutableSnapshot(next)
    listeners.forEach(listener => listener())
  }

  function startCommand(): number {
    const commandId = ++nextCommandId
    latestStateCommandId = commandId
    return commandId
  }

  function setStableSnapshot(next: SettingsSnapshot) {
    saveTransactions.length = 0
    setSnapshot(next)
    settledSnapshot = snapshot
  }

  function visibleSnapshot(): SettingsSnapshot {
    let data = settledSnapshot.data
    let hasVisibleSave = false
    for (const transaction of saveTransactions) {
      if (transaction.status === 'failed') continue
      data = transaction.settings
      hasVisibleSave = true
    }
    return hasVisibleSave ? { status: 'ready', data } : settledSnapshot
  }

  function settleSave(transaction: SaveTransaction, status: 'succeeded' | 'failed') {
    if (!saveTransactions.includes(transaction)) return
    transaction.status = status

    while (saveTransactions[0]?.status !== 'pending' && saveTransactions.length > 0) {
      const settled = saveTransactions.shift()
      if (settled?.status === 'succeeded') {
        settledSnapshot = immutableSnapshot({ status: 'ready', data: settled.settings })
      }
    }

    setSnapshot(visibleSnapshot())
    if (saveTransactions.length === 0) settledSnapshot = snapshot
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
      const commandId = startCommand()
      const previousData = snapshot.data
      setSnapshot({ status: 'loading', data: previousData })
      try {
        const remote = await api.getSettings()
        if (latestStateCommandId !== commandId) return
        setStableSnapshot({
          status: 'ready',
          data: { ...defaultSettings(), ...remote, earnedAchievements: [...remote.earnedAchievements] },
        })
      } catch (error) {
        if (latestStateCommandId !== commandId) return
        const message = errorMessage(error)
        setStableSnapshot({ status: 'error', data: previousData, error: message })
        report(error)
      }
    },
    async save(next) {
      startCommand()
      const transaction: SaveTransaction = { settings: freezeSettings(next), status: 'pending' }
      saveTransactions.push(transaction)
      setSnapshot(visibleSnapshot())
      try {
        await api.putSettings(transaction.settings)
        settleSave(transaction, 'succeeded')
      } catch (error) {
        settleSave(transaction, 'failed')
        report(error)
        throw error
      }
    },
  }
}
