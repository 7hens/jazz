import { fullComplete } from '@/features/lesson'
import { useService } from '@/shared/useService'
import { useServiceSnapshot } from '@/shared/useServiceSnapshot'

/** 当前设置下已整词完成的词数(app 级组装:给 LingLing 等跨 feature 展示用)。 */
export function useCompletedWords(): number {
  const vocabulary = useService('vocabulary')
  const progress = useService('progress')
  const settingsService = useService('settings-state')
  const progressSnap = useServiceSnapshot(progress)
  const settingsSnap = useServiceSnapshot(settingsService)
  const settings = settingsSnap.data

  return vocabulary
    .getAllWords()
    .filter((word) => fullComplete(progressSnap.data[word.id], settings)).length
}
