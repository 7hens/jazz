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

/** 五个相位:登录 → 单元地图 → 关卡,外加一个家长面板。地图是唯一的「家」。 */
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
