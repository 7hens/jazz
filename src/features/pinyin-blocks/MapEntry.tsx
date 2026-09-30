import { PinyinProgressService, SettingsService, type Achievement } from '@/shared/services'
import { useService, useServiceSnapshot } from '@/shared/services/core'
import { LearningPath } from './LearningPath'

/**
 * 路径页入口。useService 只允许出现在 <Name>Entry.tsx,故服务在这里取、以 props 下传。
 * 路径不需要音频 / 语音服务 —— 点锁着的节点只是不响应,不发声。
 *
 * settings 只用来读已得成就:`status !== 'ready'` 时传 `null`(「还不知道」),
 * 由 `LearningPath` 决定整条徽章栏不渲染 —— 不拿空数组冒充「一个都没拿到」。
 * 成就目录由 app 组装层注入。
 */
export function MapEntry({
  badges,
  onPickLesson,
  onPickPractice,
  onOpenParent,
}: {
  badges: readonly Achievement[]
  onPickLesson(lessonId: string): void
  onPickPractice(unitId: string): void
  onOpenParent(): void
}) {
  const progress = useService(PinyinProgressService)
  const settings = useService(SettingsService)
  const snapshot = useServiceSnapshot(progress)
  const settingsSnap = useServiceSnapshot(settings)

  return (
    <LearningPath
      stars={snapshot.data.stars}
      totalStars={snapshot.data.totalStars}
      badges={badges}
      earned={settingsSnap.status === 'ready' ? settingsSnap.data.earnedAchievements : null}
      onPickLesson={onPickLesson}
      onPickPractice={onPickPractice}
      onOpenParent={onOpenParent}
    />
  )
}
