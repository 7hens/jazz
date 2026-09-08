import { ProgressService, VocabularyService } from '@/shared/services'
import { useService, useServiceSnapshot } from '@/shared/services/core'
import { CHAPTER_1 } from './ch1'
import { ChapterMapView } from './ChapterMapView'

export type QianziguEntryProps = {
  onBack(): void
  onEnterChapter(chapterId: number): void
}

/** 千字谷页面入口(唯一 useService 点):取进度/词库服务组装章节地图。 */
export function QianziguEntry({ onBack, onEnterChapter }: QianziguEntryProps) {
  const progress = useService(ProgressService)
  const vocabulary = useService(VocabularyService)
  const progressSnap = useServiceSnapshot(progress)

  return (
    <ChapterMapView
      chapters={[CHAPTER_1]}
      progress={progressSnap.data}
      wordById={(id) => vocabulary.wordById(id)}
      onPlay={onEnterChapter}
      onBack={onBack}
    />
  )
}
