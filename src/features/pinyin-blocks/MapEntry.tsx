import { PinyinProgressService } from '@/shared/services'
import { useService, useServiceSnapshot } from '@/shared/services/core'
import { UnitMap } from './UnitMap'

/**
 * 地图页入口。useService 只允许出现在 <Name>Entry.tsx,故服务在这里取、以 props 下传。
 * 地图不需要音频 / 语音服务 —— 点锁定格只是不响应,不发声(发声得先有一整套
 * 「哪种声音算提示、哪种算打扰」的判断,现在没有)。
 */
export function MapEntry({
  onPick,
  onOpenParent,
}: {
  onPick(unitIndex: number): void
  onOpenParent(): void
}) {
  const progress = useService(PinyinProgressService)
  const snapshot = useServiceSnapshot(progress)

  return (
    <UnitMap
      stars={snapshot.data.stars}
      totalStars={snapshot.data.totalStars}
      onPick={onPick}
      onOpenParent={onOpenParent}
    />
  )
}
