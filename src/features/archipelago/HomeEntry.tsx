import type { ReactNode } from 'react'
import { CATEGORY_LABELS, WORDS } from '@/shared/words'
import { firstTargetId, fullComplete, titleForStars } from '@/shared/progress-rules'
import { useService } from '@/shared/useService'
import { useServiceSnapshot } from '@/shared/useServiceSnapshot'
import type { WordProgress } from '@/shared/types'
import { ArchipelagoView } from './ArchipelagoView'

export type HomeEntryProps = {
  lingling?: ReactNode
  onEnterLesson: (wordId: number) => void
  onOpenSettings: () => void
  onLogout: () => void
}

export function HomeEntry({ lingling, onEnterLesson, onOpenSettings, onLogout }: HomeEntryProps) {
  const progress = useService('progress')
  const settingsService = useService('settings-state')
  const combo = useService('combo')
  const audio = useService('audio')

  const progressSnap = useServiceSnapshot(progress)
  const settingsSnap = useServiceSnapshot(settingsService)
  const soundOn = useServiceSnapshot(audio)

  const words = progressSnap.data
  const settings = settingsSnap.data

  const totalStars = Object.values(words).reduce((sum, p) => sum + p.starsEarned, 0)
  const title = titleForStars(totalStars)
  const doneCount = WORDS.filter((w) => fullComplete(words[w.id], settings)).length
  const target = firstTargetId(words, settings, WORDS)

  async function resetProgress() {
    if (!window.confirm('确定要重置全部学习进度吗?此操作无法撤销。')) return
    await progress.resetAll()
    combo.reset()
    // 趣味字段回默认(连续天数/已得成就),三技能开关保留当前设置
    await settingsService.save({
      ...settings,
      earnedAchievements: [],
      consecutiveDays: 0,
      lastActiveDate: '',
    })
  }

  return (
    <ArchipelagoView
      catalog={WORDS}
      categoryLabels={CATEGORY_LABELS}
      words={words}
      doneCount={doneCount}
      totalStars={totalStars}
      titleName={title.name}
      target={target}
      isComplete={(row: WordProgress | undefined) => fullComplete(row, settings)}
      soundOn={soundOn}
      lingling={lingling}
      onPlayWord={(wordId) => { audio.play('tap'); onEnterLesson(wordId) }}
      onToggleSound={() => audio.setOn(!soundOn)}
      onOpenSettings={onOpenSettings}
      onLogout={onLogout}
      onReset={() => { void resetProgress() }}
    />
  )
}
