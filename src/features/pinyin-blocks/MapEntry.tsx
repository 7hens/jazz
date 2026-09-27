import { PinyinProgressService, SettingsService, type Achievement } from '@/shared/services'
import { useService, useServiceSnapshot } from '@/shared/services/core'
import { UnitMap } from './UnitMap'

/**
 * 地图页入口。useService 只允许出现在 <Name>Entry.tsx,故服务在这里取、以 props 下传。
 * 地图不需要音频 / 语音服务 —— 点锁定格只是不响应,不发声(发声得先有一整套
 * 「哪种声音算提示、哪种算打扰」的判断,现在没有)。
 *
 * settings 只用来读已得成就:`status !== 'ready'` 时传 `null`(「还不知道」),
 * 由 UnitMap 决定整条徽章栏不渲染 —— 不拿空数组冒充「一个都没拿到」。
 * 成就目录由 app 组装层注入(见 UnitMap 的 props 注释)。
 */
export function MapEntry({
  badges,
  onPick,
  onOpenParent,
}: {
  badges: readonly Achievement[]
  onPick(unitIndex: number): void
  onOpenParent(): void
}) {
  const progress = useService(PinyinProgressService)
  const settings = useService(SettingsService)
  const snapshot = useServiceSnapshot(progress)
  const settingsSnap = useServiceSnapshot(settings)

  return (
    <UnitMap
      stars={snapshot.data.stars}
      totalStars={snapshot.data.totalStars}
      badges={badges}
      earned={settingsSnap.status === 'ready' ? settingsSnap.data.earnedAchievements : null}
      onPick={onPick}
      onOpenParent={onOpenParent}
    />
  )
}
