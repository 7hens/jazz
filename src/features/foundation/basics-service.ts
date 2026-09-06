import { ApiError } from '@/shared/services'
import type {
  ApiService,
  BasicsProgressData,
  BasicsProgressRow,
  BasicsProgressSnapshot,
  BasicsService,
} from '@/shared/services'
import { applyCorrect, applyWrong, emptyUnit, toRow, withTaught } from './estimator'
import type { UnitModel } from './estimator'

export interface BasicsServiceCallbacks {
  onUnauthorized(): void
  onError(message: string): void
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown basics error'
}

/** 深冻结整张数据表:每个行对象 + 表本身,getSnapshot 返稳定引用避免无限重渲染。 */
function freezeData(data: BasicsProgressData): BasicsProgressData {
  const frozen: BasicsProgressData = {}
  for (const key of Object.keys(data)) {
    frozen[key] = Object.freeze({ ...data[key] })
  }
  return Object.freeze(frozen)
}

/** 依快照态分支冻结:idle/loading/ready 带 data,error 额外带 error。 */
function immutableSnapshot(next: BasicsProgressSnapshot): BasicsProgressSnapshot {
  const data = freezeData(next.data)
  return next.status === 'error'
    ? Object.freeze({ status: 'error', data, error: next.error })
    : Object.freeze({ status: next.status, data })
}

export function createBasicsService(
  api: ApiService,
  callbacks: BasicsServiceCallbacks,
): BasicsService {
  let snapshot: BasicsProgressSnapshot = immutableSnapshot({ status: 'idle', data: {} })
  const listeners = new Set<() => void>()

  function setSnapshot(next: BasicsProgressSnapshot) {
    snapshot = immutableSnapshot(next)
    listeners.forEach(listener => listener())
  }

  /** 还原到某次写入前的既有冻结快照(仅撤本次乐观叠加,其余保持)。 */
  function rollback(previous: BasicsProgressSnapshot) {
    snapshot = previous
    listeners.forEach(listener => listener())
  }

  function modelOf(row: BasicsProgressRow | undefined): UnitModel {
    return row ? { state: row.state, correctStreak: row.correctStreak, taughtCount: row.taughtCount } : emptyUnit()
  }

  function dataFromRows(rows: readonly BasicsProgressRow[]): BasicsProgressData {
    const data: BasicsProgressData = {}
    for (const row of rows) data[row.unitKey] = { ...row }
    return data
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
      setSnapshot({ status: 'loading', data: snapshot.data })
      try {
        const remote = await api.getBasicsProgress()
        const data: BasicsProgressData = {}
        for (const row of remote) {
          data[row.unitKey] = { ...row, updatedAt: new Date().toISOString() }
        }
        setSnapshot({ status: 'ready', data })
      } catch (error) {
        setSnapshot({ status: 'error', data: snapshot.data, error: errorMessage(error) })
        report(error)
      }
    },
    async recordAnswer(unitKey, correct) {
      const previous = snapshot
      const next = correct ? applyCorrect(modelOf(previous.data[unitKey])) : applyWrong(modelOf(previous.data[unitKey]))
      const row = toRow(unitKey, next)
      setSnapshot({ status: 'ready', data: { ...previous.data, [unitKey]: row } })
      try {
        await api.putBasicsProgress([row])
      } catch (error) {
        rollback(previous)
        report(error)
        throw error
      }
    },
    async markTaught(unitKeys) {
      const previous = snapshot
      const data = { ...previous.data }
      const rows: BasicsProgressRow[] = []
      for (const unitKey of unitKeys) {
        const row = toRow(unitKey, withTaught(modelOf(data[unitKey])))
        data[unitKey] = row
        rows.push(row)
      }
      setSnapshot({ status: 'ready', data })
      try {
        await api.putBasicsProgress(rows)
      } catch (error) {
        rollback(previous)
        report(error)
        throw error
      }
    },
    async saveAll(rows) {
      const previous = snapshot
      setSnapshot({ status: 'ready', data: dataFromRows(rows) })
      try {
        await api.putBasicsProgress(rows.map(row => ({ ...row })))
      } catch (error) {
        rollback(previous)
        report(error)
        throw error
      }
    },
  }
}
