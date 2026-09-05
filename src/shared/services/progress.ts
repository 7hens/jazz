import type { WordProgress } from '../types'
import type { LoadState } from '../load-state'
import type { ReactiveService, ServiceToken } from './manager'

export type ProgressData = Record<number, WordProgress>
export type ProgressSnapshot = LoadState<ProgressData>

export interface ProgressService extends ReactiveService<ProgressSnapshot> {
  load(): Promise<void>
  seed(progress: readonly WordProgress[]): void
  saveStep(progress: WordProgress): Promise<void>
  saveAll(progress: ProgressData): Promise<void>
  resetAll(): Promise<void>
}

export const ProgressService = Symbol('ProgressService') as unknown as ServiceToken<ProgressService>
