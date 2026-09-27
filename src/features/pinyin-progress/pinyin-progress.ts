import { ApiError } from '@/shared/services'
import type {
  ApiService,
  LevelClear,
  LevelStars,
  PinyinProgressData,
  PinyinProgressService,
  PinyinProgressSnapshot,
} from '@/shared/services'
import { clearLocalProgress, localProgressStorage, readLocalProgress, writeLocalProgress } from './local-store'

export interface PinyinProgressCallbacks {
  onUnauthorized(): void
  onError(message: string): void
}

export interface PinyinProgressOptions {
  /** 兜底副本的落点。默认浏览器 localStorage;jsdom 里没有它,测试必须显式注入。 */
  storage?: Storage | null
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

/** 两份进度是否逐关一致。用来判断「服务端是不是落后了,要不要补」。 */
function sameData(a: PinyinProgressData, b: PinyinProgressData): boolean {
  if (a.totalStars !== b.totalStars) return false
  const levelIds = Object.keys(a.stars)
  if (levelIds.length !== Object.keys(b.stars).length) return false
  return levelIds.every((levelId) => a.stars[levelId] === b.stars[levelId])
}

export function createPinyinProgressService(
  api: ApiService,
  callbacks: PinyinProgressCallbacks,
  options: PinyinProgressOptions = {},
): PinyinProgressService {
  const storage = options.storage === undefined ? localProgressStorage() : options.storage
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
    if (saves.length === 0) {
      settled = snapshot
      // 落地才写本地:没存下来的值不该进兜底副本,否则回退后一刷新又「活」过来。
      writeLocalProgress(settled.data, storage)
    }
  }

  /**
   * @param userMutation 这次写算不算「用户动作」。后台补齐必须传 false:
   *   它会把 latestUserMutationId 顶高,而**同时在飞的重置**正是靠「重置之后有没有更新的
   *   用户动作」决定要不要清空的 —— 顶高了重置就会被判成「期间孩子又通关了」,
   *   于是不清本地也不清屏幕,一次成功的重置看着像没生效。
   *   (load 不受影响:能触发补齐的那次 load 必然是当前最新的一次,
   *   之后启动的 load 命令号一定更大。)
   * @param reportFailure 失败要不要报给用户。后台补齐不报:孩子没做错任何事,本地那份还在,
   *   下次通关本来就会再全量提交一次。
   */
  async function persist(
    data: PinyinProgressData,
    { userMutation = true, reportFailure = true }: { userMutation?: boolean; reportFailure?: boolean } = {},
  ) {
    startCommand(userMutation)
    const transaction: SaveTransaction = { data: freeze(data), status: 'pending' }
    saves.push(transaction)
    setSnapshot(visibleSnapshot())
    try {
      await api.putPinyinProgress(transaction.data)
      settleSave(transaction, 'succeeded')
    } catch (error) {
      settleSave(transaction, 'failed')
      if (!reportFailure) return
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
    // 服务端不是唯一真相源:浏览器那份兜底副本与服务端**逐关取 max** 后才是要显示的进度。
    // 任何一侧丢了数据,另一侧都能把它捞回来。
    async load() {
      const commandId = startCommand(false)
      latestLoadCommandId = commandId
      const previous = snapshot.data
      const local = readLocalProgress(storage)
      setSnapshot({ status: 'loading', data: previous })
      try {
        const data = await api.getPinyinProgress()
        if (!canPublishLoad(commandId)) return
        const merged = local ? mergeInto(local, data) : data
        setStableSnapshot({ status: 'ready', data: merged })
        writeLocalProgress(merged, storage)
        // 服务端落后(典型:它那边被清过/丢过库)就把并集补回去,让它自己长回来。
        // 残留竞态:重置于这次 PUT 在飞的那一刻发生时,DELETE 可能先落地、补写后落地,
        // 进度会复活一次 —— 家长面板那边表现为「重置没生效」,再点一次即可,不会再丢数据。
        if (!sameData(data, merged)) {
          void persist(merged, { userMutation: false, reportFailure: false })
        }
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
          // 兜底副本必须跟着清,否则下次 load 会拿它把刚重置掉的进度顶回来。
          clearLocalProgress(storage)
        } else {
          // 重置期间孩子又通关了 —— 以那次通关为准,兜底得跟着它走,不能留一份空的。
          writeLocalProgress(settled.data, storage)
        }
      } catch (error) {
        if (snapshot.status === 'loading') setSnapshot(visibleSnapshot())
        report(error)
        throw error
      }
    },
  }
}
