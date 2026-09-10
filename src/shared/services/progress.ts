import type { LoadState, ReactiveService, ServiceToken } from './core'

/** 技能键(与王国键同值):拼音/汉字/英语三学习模块。 */
export type SkillKey = 'pinyin' | 'hanzi' | 'english'

/** 每词学习进度(每 user × 每词一行,updatedAt 为前端本地时间戳)。 */
export type WordProgress = {
  wordId: number
  completed: Record<SkillKey, boolean>
  /** 汉语句型步已通过的档数(0..3,由易到难);不进 SkillKey —— 句是汉语域内固定步,不是独立技能。 */
  sentenceLevel: number
  starsEarned: number
  updatedAt: string
}

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
