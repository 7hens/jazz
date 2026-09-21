import { ApiError } from '@/shared/services'
import type {
  ApiService,
  LevelClear,
  LevelStars,
  PinyinProgressData,
  PinyinProgressService,
  PinyinProgressSnapshot,
} from '@/shared/services'

export interface PinyinProgressCallbacks {
  onUnauthorized(): void
  onError(message: string): void
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown pinyin progress error'
}

function freeze(data: PinyinProgressData): PinyinProgressData {
  return Object.freeze({ stars: Object.freeze({ ...data.stars }), totalStars: data.totalStars })
}

function immutable(next: PinyinProgressSnapshot): PinyinProgressSnapshot {
  const data = freeze(next.data)
  return next.status === 'error'
    ? Object.freeze({ status: 'error', data, error: next.error })
    : Object.freeze({ status: next.status, data })
}

/**
 * 一步通关的合并:星级取 max(只升不降),星尘累加。
 * 星尘累加而非取 max —— 它不是「一个值变好了」,是「又赚了一笔」。
 */
export function mergeClear(data: PinyinProgressData, clear: LevelClear): PinyinProgressData {
  const stars: LevelStars = {
    ...data.stars,
    [clear.levelId]: Math.max(data.stars[clear.levelId] ?? 0, clear.stars),
  }
  return { stars, totalStars: data.totalStars + Math.max(0, clear.starDust) }
}

function mergeInto(base: PinyinProgressData, next: PinyinProgressData): PinyinProgressData {
  const stars: Record<string, number> = { ...base.stars }
  for (const [levelId, value] of Object.entries(next.stars)) {
    stars[levelId] = Math.max(stars[levelId] ?? 0, value)
  }
  return { stars, totalStars: Math.max(base.totalStars, next.totalStars) }
}

export function createPinyinProgressService(
  api: ApiService,
  callbacks: PinyinProgressCallbacks,
): PinyinProgressService {
  let snapshot = immutable({ status: 'idle', data: { stars: {}, totalStars: 0 } })
  let settled = snapshot
  const listeners = new Set<() => void>()
  let nextCommandId = 0
  let latestLoadCommandId = 0
  let latestUserMutationId = 0
  let successfulResetLoadCutoff = 0
  type SaveTransaction = { data: PinyinProgressData; status: 'pending' | 'succeeded' | 'failed' }
  const saves: SaveTransaction[] = []

  function setSnapshot(next: PinyinProgressSnapshot) {
    snapshot = immutable(next)
    listeners.forEach((listener) => listener())
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

  function setStableSnapshot(next: PinyinProgressSnapshot) {
    saves.length = 0
    setSnapshot(next)
    settled = snapshot
  }

  function report(error: unknown) {
    if (error instanceof ApiError && error.status === 401) callbacks.onUnauthorized()
    else callbacks.onError(errorMessage(error))
  }

  function visibleSnapshot(): PinyinProgressSnapshot {
    let data = settled.data
    let hasVisibleSave = false
    for (const transaction of saves) {
      if (transaction.status === 'failed') continue
      data = mergeInto(data, transaction.data)
      hasVisibleSave = true
    }
    return hasVisibleSave ? { status: 'ready', data } : settled
  }

  function settleSave(transaction: SaveTransaction, status: 'succeeded' | 'failed') {
    if (!saves.includes(transaction)) return
    transaction.status = status
    while (saves[0]?.status !== 'pending' && saves.length > 0) {
      const done = saves.shift()
      if (done?.status === 'succeeded') {
        settled = immutable({ status: 'ready', data: mergeInto(settled.data, done.data) })
      }
    }
    setSnapshot(visibleSnapshot())
    if (saves.length === 0) settled = snapshot
  }

  async function persist(data: PinyinProgressData) {
    startCommand(true)
    const transaction: SaveTransaction = { data: freeze(data), status: 'pending' }
    saves.push(transaction)
    setSnapshot(visibleSnapshot())
    try {
      await api.putPinyinProgress(transaction.data)
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
      const previous = snapshot.data
      setSnapshot({ status: 'loading', data: previous })
      try {
        const data = await api.getPinyinProgress()
        if (!canPublishLoad(commandId)) return
        setStableSnapshot({ status: 'ready', data })
      } catch (error) {
        if (!canPublishLoad(commandId)) return
        setStableSnapshot({ status: 'error', data: previous, error: errorMessage(error) })
        report(error)
      }
    },
    // 提交的是**已 merge 本地的全量** —— 覆盖服务端也不会丢已通关的位(见 worker 注释)。
    async recordClear(clear) {
      await persist(mergeClear(snapshot.data, clear))
    },
    async resetAll() {
      const commandId = startCommand(false)
      try {
        await api.deletePinyinProgress()
        successfulResetLoadCutoff = Math.max(successfulResetLoadCutoff, nextCommandId)
        if (latestUserMutationId <= commandId) {
          setStableSnapshot({ status: 'ready', data: { stars: {}, totalStars: 0 } })
        }
      } catch (error) {
        if (snapshot.status === 'loading') setSnapshot(visibleSnapshot())
        report(error)
        throw error
      }
    },
  }
}
