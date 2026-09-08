import type { LoadState, ReactiveService, ServiceToken } from './core'

/** 每 user 的千字谷章节态(单行)。restoreState:已恢复 {wordId,layer} 集 + 场景元素点亮集合。 */
export type ChapterProgressRow = {
  chapterId: number
  resumeSceneId: string | null       // 断点续玩定位(自然断点/退出)
  restoreState: string               // JSON 字符串(引擎 restored + 元素点亮)
  updatedAt: string
}

/** 服务端行(不含 updatedAt)。 */
export type ApiChapterProgressRow = Omit<ChapterProgressRow, 'updatedAt'>

export type ChapterProgressData = { row: ChapterProgressRow | null }
export type ChapterProgressSnapshot = LoadState<ChapterProgressData>

export interface ChapterService extends ReactiveService<ChapterProgressSnapshot> {
  load(): Promise<void>
  /** 保存整行(upsert 单行);乐观写,失败滚回。 */
  save(row: ChapterProgressRow): Promise<void>
  /** 清空该 user 章节态(重置章节用,可选)。 */
  clear(): Promise<void>
}

export const ChapterService = Symbol('ChapterService') as unknown as ServiceToken<ChapterService>
