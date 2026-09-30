import { useState } from 'react'

export type AppPhase = 'boot' | 'login' | 'path' | 'lesson' | 'practice' | 'parent'

export interface AppState {
  phase: AppPhase
  /** 正在走的节。只在 `phase === 'lesson'` 时非空。 */
  lessonId: string | null
  /** 正在练的单元。只在 `phase === 'practice'` 时非空。 */
  practiceUnitId: string | null
  actions: {
    enterLesson(lessonId: string): void
    enterPractice(unitId: string): void
    exitToPath(): void
    openParent(): void
    closeParent(): void
  }
}

/**
 * 六个相位:登录 → 学习路径 → 一节 / 一次练习,外加一个家长面板。**路径是唯一的「家」**。
 *
 * 两个查看相位**只存 id**,不存整个对象 —— 课程数据一变(加题、挪节),存下来的对象就是旧世界的一份
 * 快照,而 id 永远指向当前真实那份。`LessonEntry` / `PracticeEntry` 各自按 id 去课表里取。
 */
export function useAppState(): AppState {
  const [phase, setPhase] = useState<AppPhase>('boot')
  const [lessonId, setLessonId] = useState<string | null>(null)
  const [practiceUnitId, setPracticeUnitId] = useState<string | null>(null)

  const toPath = () => {
    setLessonId(null)
    setPracticeUnitId(null)
    setPhase('path')
  }

  return {
    phase,
    lessonId,
    practiceUnitId,
    actions: {
      enterLesson(id) {
        setLessonId(id)
        setPracticeUnitId(null)
        setPhase('lesson')
      },
      enterPractice(unitId) {
        setPracticeUnitId(unitId)
        setLessonId(null)
        setPhase('practice')
      },
      exitToPath: toPath,
      openParent() {
        setPhase('parent')
      },
      closeParent: toPath,
    },
  }
}
