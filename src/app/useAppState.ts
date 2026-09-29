import { useState } from 'react'

export type AppPhase = 'boot' | 'login' | 'map' | 'level' | 'parent'

export interface AppState {
  phase: AppPhase
  currentUnitIndex: number | null
  actions: {
    enterUnit(unitIndex: number): void
    exitToMap(): void
    openParent(): void
    closeParent(): void
  }
}

/**
 * 五个相位:登录 → 单元地图 → 单元,外加一个家长面板。地图是唯一的「家」。
 *
 * **单元页没有「第几部分」这个相位** —— 一个单元三部分是一个整体,起点由 `UnitEntry`
 * 自己按「第一个还没全通的部分」定,部分间的推进也在它内部,bootstrap 之外无人需要知道。
 */
export function useAppState(): AppState {
  const [phase, setPhase] = useState<AppPhase>('boot')
  const [currentUnitIndex, setCurrentUnitIndex] = useState<number | null>(null)

  return {
    phase,
    currentUnitIndex,
    actions: {
      enterUnit(unitIndex) {
        setCurrentUnitIndex(unitIndex)
        setPhase('level')
      },
      exitToMap() {
        setCurrentUnitIndex(null)
        setPhase('map')
      },
      openParent() {
        setPhase('parent')
      },
      closeParent() {
        setPhase('map')
      },
    },
  }
}
