import { ApiError } from '@/shared/services'
import type {
  ApiChapterProgressRow,
  ApiService,
  ChapterProgressData,
  ChapterProgressRow,
  ChapterProgressSnapshot,
  ChapterService,
} from '@/shared/services'

export interface ChapterProgressCallbacks {
  onUnauthorized(): void
  onError(message: string): void
}

const EMPTY_RESTORE = '[]'

/** 全新的第 1 章起始行(无断点、无恢复进度)。 */
export function emptyRow(): ChapterProgressRow {
  return {
    chapterId: 1,
    resumeSceneId: null,
    restoreState: EMPTY_RESTORE,
    updatedAt: new Date().toISOString(),
  }
}

/** clear 重置时持久化的服务端行(无 updatedAt,后端按无进度起始态处理)。 */
function resetApiRow(): ApiChapterProgressRow {
  return { chapterId: 1, resumeSceneId: null, restoreState: EMPTY_RESTORE }
}

/** save 落 api 时剥离前端本地盖戳 updatedAt。 */
function toApiRow(row: ChapterProgressRow): ApiChapterProgressRow {
  return { chapterId: row.chapterId, resumeSceneId: row.resumeSceneId, restoreState: row.restoreState }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown chapter progress error'
}

function freezeRow(row: ChapterProgressRow | null): ChapterProgressRow | null {
  return row === null ? null : Object.freeze({ ...row })
}

function freezeData(data: ChapterProgressData): ChapterProgressData {
  return Object.freeze({ row: freezeRow(data.row) })
}

/** 依快照态分支冻结:idle/loading/ready 带 data,error 额外带 error。 */
function immutableSnapshot(next: ChapterProgressSnapshot): ChapterProgressSnapshot {
  const data = freezeData(next.data)
  return next.status === 'error'
    ? Object.freeze({ status: 'error', data, error: next.error })
    : Object.freeze({ status: next.status, data })
}

export function createChapterService(
  api: ApiService,
  callbacks: ChapterProgressCallbacks,
): ChapterService {
  let snapshot: ChapterProgressSnapshot = immutableSnapshot({ status: 'idle', data: { row: null } })
  let settledSnapshot = snapshot
  const listeners = new Set<() => void>()
  let nextCommandId = 0
  let latestStateCommandId = 0
  type SaveTransaction = {
    row: ChapterProgressRow | null
    status: 'pending' | 'succeeded' | 'failed'
  }
  const saveTransactions: SaveTransaction[] = []

  function setSnapshot(next: ChapterProgressSnapshot) {
    snapshot = immutableSnapshot(next)
    listeners.forEach(listener => listener())
  }

  function startCommand(): number {
    const commandId = ++nextCommandId
    latestStateCommandId = commandId
    return commandId
  }

  function setStableSnapshot(next: ChapterProgressSnapshot) {
    saveTransactions.length = 0
    setSnapshot(next)
    settledSnapshot = snapshot
  }

  function visibleSnapshot(): ChapterProgressSnapshot {
    let data = settledSnapshot.data
    let hasVisibleSave = false
    for (const transaction of saveTransactions) {
      if (transaction.status === 'failed') continue
      data = { row: transaction.row }
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
        settledSnapshot = immutableSnapshot({ status: 'ready', data: { row: settled.row } })
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
        const remote = await api.getChapterProgress()
        if (latestStateCommandId !== commandId) return
        const row = remote ? { ...remote, updatedAt: new Date().toISOString() } : null
        setStableSnapshot({ status: 'ready', data: { row } })
      } catch (error) {
        if (latestStateCommandId !== commandId) return
        const message = errorMessage(error)
        setStableSnapshot({ status: 'error', data: previousData, error: message })
        report(error)
      }
    },
    async save(next) {
      startCommand()
      const transaction: SaveTransaction = { row: freezeRow(next), status: 'pending' }
      saveTransactions.push(transaction)
      setSnapshot(visibleSnapshot())
      try {
        await api.putChapterProgress(toApiRow(next))
        settleSave(transaction, 'succeeded')
      } catch (error) {
        settleSave(transaction, 'failed')
        report(error)
        throw error
      }
    },
    async clear() {
      startCommand()
      const transaction: SaveTransaction = { row: null, status: 'pending' }
      saveTransactions.push(transaction)
      setSnapshot(visibleSnapshot())
      try {
        await api.putChapterProgress(resetApiRow())
        settleSave(transaction, 'succeeded')
      } catch (error) {
        settleSave(transaction, 'failed')
        report(error)
        throw error
      }
    },
  }
}
