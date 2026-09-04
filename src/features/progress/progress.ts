import { ApiError } from '@/shared/api-error'
import type { ApiService, ApiWordProgress, ProgressData, ProgressService, ProgressSnapshot } from '@/shared/services'
import type { WordProgress } from '@/shared/types'
import { isValidWordProgress, mergeProgress } from '@/game/progress'

export interface ProgressServiceCallbacks {
  onUnauthorized(): void
  onError(message: string): void
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown progress error'
}

function freezeProgress(progress: WordProgress): WordProgress {
  return Object.freeze({
    ...progress,
    completed: Object.freeze({ ...progress.completed }),
  })
}

function freezeData(data: ProgressData): ProgressData {
  const copy: ProgressData = {}
  for (const [wordId, progress] of Object.entries(data)) copy[Number(wordId)] = freezeProgress(progress)
  return Object.freeze(copy)
}

function immutableSnapshot(next: ProgressSnapshot): ProgressSnapshot {
  const data = freezeData(next.data)
  return next.status === 'error'
    ? Object.freeze({ status: 'error', data, error: next.error })
    : Object.freeze({ status: next.status, data })
}

function fromRows(rows: readonly WordProgress[]): ProgressData {
  const data: ProgressData = {}
  for (const row of rows) {
    if (!isValidWordProgress(row)) continue
    data[row.wordId] = data[row.wordId] ? mergeProgress(data[row.wordId], row) : row
  }
  return data
}

function mergeRowsInto(current: ProgressData, rows: readonly WordProgress[]): ProgressData {
  const data = { ...current }
  for (const row of rows) {
    if (!isValidWordProgress(row)) continue
    data[row.wordId] = data[row.wordId] ? mergeProgress(data[row.wordId], row) : row
  }
  return data
}

function normalizeApiRow(row: ApiWordProgress): WordProgress {
  return { ...row, completed: { ...row.completed }, updatedAt: new Date().toISOString() }
}

export function createProgressService(
  api: ApiService,
  callbacks: ProgressServiceCallbacks,
): ProgressService {
  let snapshot: ProgressSnapshot = immutableSnapshot({ status: 'idle', data: {} })
  let settledSnapshot = snapshot
  const listeners = new Set<() => void>()
  let nextCommandId = 0
  let latestLoadCommandId = 0
  let latestUserMutationId = 0
  let successfulResetLoadCutoff = 0
  type SaveTransaction = {
    rows: WordProgress[]
    status: 'pending' | 'succeeded' | 'failed'
  }
  const saveTransactions: SaveTransaction[] = []

  function setSnapshot(next: ProgressSnapshot) {
    snapshot = immutableSnapshot(next)
    listeners.forEach(listener => listener())
  }

  function startCommand(isUserMutation: boolean): number {
    const commandId = ++nextCommandId
    if (isUserMutation) latestUserMutationId = commandId
    return commandId
  }

  function canPublishLoad(commandId: number): boolean {
    return latestLoadCommandId === commandId
      && latestUserMutationId <= commandId
      && successfulResetLoadCutoff < commandId
  }

  function setStableSnapshot(next: ProgressSnapshot) {
    saveTransactions.length = 0
    setSnapshot(next)
    settledSnapshot = snapshot
  }

  function report(error: unknown) {
    if (error instanceof ApiError && error.status === 401) callbacks.onUnauthorized()
    else callbacks.onError(errorMessage(error))
  }

  function visibleSnapshot(): ProgressSnapshot {
    let data = settledSnapshot.data
    let hasVisibleSave = false
    for (const transaction of saveTransactions) {
      if (transaction.status === 'failed') continue
      data = mergeRowsInto(data, transaction.rows)
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
        settledSnapshot = immutableSnapshot({
          status: 'ready',
          data: mergeRowsInto(settledSnapshot.data, settled.rows),
        })
      }
    }

    setSnapshot(visibleSnapshot())
    if (saveTransactions.length === 0) settledSnapshot = snapshot
  }

  async function persist(rows: WordProgress[]) {
    startCommand(true)
    const transaction: SaveTransaction = {
      rows: rows.map(freezeProgress),
      status: 'pending',
    }
    saveTransactions.push(transaction)
    setSnapshot(visibleSnapshot())
    try {
      await api.putProgress(transaction.rows)
      settleSave(transaction, 'succeeded')
    } catch (error) {
      settleSave(transaction, 'failed')
      report(error)
      throw error
    }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async load() {
      const commandId = startCommand(false)
      latestLoadCommandId = commandId
      const previousData = snapshot.data
      setSnapshot({ status: 'loading', data: previousData })
      try {
        const rows = (await api.getProgress()).map(normalizeApiRow)
        if (!canPublishLoad(commandId)) return
        setStableSnapshot({ status: 'ready', data: fromRows(rows) })
      } catch (error) {
        if (!canPublishLoad(commandId)) return
        const message = errorMessage(error)
        setStableSnapshot({ status: 'error', data: previousData, error: message })
        report(error)
      }
    },
    seed(rows) {
      startCommand(true)
      setStableSnapshot({ status: 'ready', data: fromRows(rows) })
    },
    async saveStep(next) {
      const current = snapshot.data[next.wordId]
      const merged = current ? mergeProgress(current, next) : next
      await persist([merged])
    },
    async saveAll(next) {
      const data = mergeRowsInto(snapshot.data, Object.values(next))
      const rows = Object.keys(next).flatMap(wordId => data[Number(wordId)] ? [data[Number(wordId)]] : [])
      await persist(rows)
    },
    async resetAll() {
      const commandId = startCommand(false)
      try {
        await api.deleteProgress()
        // DELETE wins over every GET that was already in flight when it settled.
        successfulResetLoadCutoff = Math.max(successfulResetLoadCutoff, nextCommandId)
        if (latestUserMutationId <= commandId) setStableSnapshot({ status: 'ready', data: {} })
      } catch (error) {
        if (snapshot.status === 'loading') setSnapshot(visibleSnapshot())
        report(error)
        throw error
      }
    },
  }
}
