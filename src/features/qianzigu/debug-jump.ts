import type { ChapterProgressRow } from '@/shared/services'
import type { Chapter } from './chapter'
import { serializeRestoreState } from './word-progress'

/** URL ?s=<world>.<chapter>.<sceneNumber> 的世界段:千字谷 = 1(预留其它世界的段位)。 */
const QIANZIGU_WORLD_ID = 1

/**
 * dev-only URL 直达(浏览器敲 ?s=1.1.N → 从第 N 幕起播):
 *  sceneNumber = 章内幕序号(1 起,依 scenes 数组顺序,含 break,不含 settle 结算幕)。
 *  产物是伪 ChapterProgressRow:resumeSceneId=目标幕 id、restoreState=目标幕前全部 task 推导集,
 *  喂 ChapterRunnerView 的 resumeFromRow 即快进落在目标幕(引擎零改动)。
 *  目标非法(world/chapter 段不符、越界、非数字、settle)一律 null → 调用方走正常路径。
 */
export function resolveDebugRow(chapter: Chapter, raw: string | null): ChapterProgressRow | null {
  if (!raw) return null
  const segments = raw.split('.')
  if (segments.length !== 3) return null
  const [world, chapterId, sceneNumber] = segments
  if (world !== String(QIANZIGU_WORLD_ID)) return null
  if (chapterId !== String(chapter.id)) return null
  const n = Number(sceneNumber)
  if (!Number.isInteger(n) || n < 1 || n > chapter.scenes.length) return null
  const target = chapter.scenes[n - 1]
  if (target.kind === 'settle') return null // 直跳结算幕 = 等价通关 + 清章行副作用,排除
  const restored = chapter.scenes.slice(0, n - 1).flatMap((scene) =>
    scene.kind === 'task' ? [{ wordId: scene.task.wordId, layer: scene.task.layer }] : [],
  )
  return {
    chapterId: chapter.id,
    resumeSceneId: target.id,
    restoreState: serializeRestoreState(restored),
    updatedAt: new Date().toISOString(),
  }
}
