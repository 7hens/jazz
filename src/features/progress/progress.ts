import { ApiError } from '@/shared/api-error'
import type { ApiService, ApiWordProgress, ProgressData, ProgressService, ProgressSnapshot } from '@/shared/services'
import type { WordProgress } from '@/types'
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
  let mutationVersion = 0
  let loadGeneration = 0
  type SaveTransaction = {
    snapshot: ProgressSnapshot
    status: 'pending' | 'succeeded' | 'failed'
  }
  const saveTransactions: SaveTransaction[] = []

  function setSnapshot(next: ProgressSnapshot) {
    snapshot = immutableSnapshot(next)
    listeners.forEach(listener => listener())
  }

  function setMutation(next: ProgressSnapshot): number {
    mutationVersion += 1
    setSnapshot(next)
    return mutationVersion
  }

  function setStableMutation(next: ProgressSnapshot) {
    saveTransactions.length = 0
    setMutation(next)
    settledSnapshot = snapshot
  }

  function report(error: unknown) {
    if (error instanceof ApiError && error.status === 401) callbacks.onUnauthorized()
    else callbacks.onError(errorMessage(error))
  }

  function settleSave(transaction: SaveTransaction, status: 'succeeded' | 'failed') {
    if (!saveTransactions.includes(transaction)) return
    transaction.status = status

    while (saveTransactions[0]?.status !== 'pending' && saveTransactions.length > 0) {
      const settled = saveTransactions.shift()
      if (settled?.status === 'succeeded') settledSnapshot = settled.snapshot
    }

    const visible = saveTransactions.findLast(candidate => candidate.status !== 'failed')?.snapshot
      ?? settledSnapshot
    if (snapshot !== visible) setMutation(visible)
    if (saveTransactions.length === 0) settledSnapshot = snapshot
  }

  async function persist(nextData: ProgressData, rows: WordProgress[]) {
    setMutation({ status: 'ready', data: nextData })
    const transaction: SaveTransaction = { snapshot, status: 'pending' }
    saveTransactions.push(transaction)
    try {
      await api.putProgress(rows)
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
      const generation = ++loadGeneration
      const startingMutationVersion = mutationVersion
      const previousData = snapshot.data
      setSnapshot({ status: 'loading', data: previousData })
      try {
        const rows = (await api.getProgress()).map(normalizeApiRow)
        if (generation !== loadGeneration || mutationVersion !== startingMutationVersion) return
        setStableMutation({ status: 'ready', data: fromRows(rows) })
      } catch (error) {
        if (generation !== loadGeneration || mutationVersion !== startingMutationVersion) return
        const message = errorMessage(error)
        setStableMutation({ status: 'error', data: previousData, error: message })
        report(error)
      }
    },
    seed(rows) {
      setStableMutation({ status: 'ready', data: fromRows(rows) })
    },
    async saveStep(next) {
      const current = snapshot.data[next.wordId]
      const merged = current ? mergeProgress(current, next) : next
      await persist({ ...snapshot.data, [merged.wordId]: merged }, [merged])
    },
    async saveAll(next) {
      const data = mergeRowsInto(snapshot.data, Object.values(next))
      await persist(data, Object.values(data))
    },
    async resetAll() {
      const startingMutationVersion = mutationVersion
      try {
        await api.deleteProgress()
        if (mutationVersion === startingMutationVersion) setStableMutation({ status: 'ready', data: {} })
      } catch (error) {
        report(error)
        throw error
      }
    },
  }
}
