import { useState } from 'react'
import type { Chapter } from '@/features/pinyin-blocks'

export type AppPhase = 'boot' | 'login' | 'map' | 'level' | 'parent'

export interface AppState {
  phase: AppPhase
  currentUnitIndex: number | null
  /** 当前所在的章。与单元一起构成关卡页的身份 —— 两者缺一就不进关卡页。 */
  currentChapter: Chapter | null
  actions: {
    enterUnit(unitIndex: number, chapter: Chapter): void
    exitToMap(): void
    openParent(): void
    closeParent(): void
  }
}

/** 五个相位:登录 → 单元地图 → 单元(章),外加一个家长面板。地图是唯一的「家」。 */
export function useAppState(): AppState {
  const [phase, setPhase] = useState<AppPhase>('boot')
  const [currentUnitIndex, setCurrentUnitIndex] = useState<number | null>(null)
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null)

  return {
    phase,
    currentUnitIndex,
    currentChapter,
    actions: {
      enterUnit(unitIndex, chapter) {
        setCurrentUnitIndex(unitIndex)
        setCurrentChapter(chapter)
        setPhase('level')
      },
      exitToMap() {
        setCurrentUnitIndex(null)
        setCurrentChapter(null)
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
