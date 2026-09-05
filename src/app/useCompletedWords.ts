import { ProgressRulesService, ProgressService, SettingsService, VocabularyService } from '@/shared/services'
import { useService, useServiceSnapshot } from '@/shared/services/core'

/** 当前设置下已整词完成的词数(app 级组装:给 LingLing 等跨 feature 展示用)。 */
export function useCompletedWords(): number {
  const vocabulary = useService(VocabularyService)
  const progress = useService(ProgressService)
  const settingsService = useService(SettingsService)
  const rules = useService(ProgressRulesService)
  const progressSnap = useServiceSnapshot(progress)
  const settingsSnap = useServiceSnapshot(settingsService)
  const settings = settingsSnap.data

  return vocabulary
    .getAllWords()
    .filter((word) => rules.fullComplete(progressSnap.data[word.id], settings)).length
}
