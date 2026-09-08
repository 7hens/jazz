import { useRef, useState } from 'react'

export type AppPhase =
  | 'boot'
  | 'login'
  | 'world'
  | 'qianzigu-map'
  | 'chapter'
  | 'letter-forest'
  | 'lesson'
  | 'settings'

export interface AppState {
  phase: AppPhase
  currentWordId: number | null
  currentChapterId: number | null
  actions: {
    enterLesson(wordId: number): void
    exitToHome(): void
    nextWord(): void
    openSettings(): void
    closeSettings(): void
    enterWorld(): void
    enterQianziguMap(): void
    enterLetterForest(): void
    enterChapter(chapterId: number): void
    closeChapter(): void
  }
}

/** 「地图」相位:world 壳 / 千字谷地图 / 字母林 —— lesson·settings 返回时落回这些。 */
const MAP_PHASES: readonly AppPhase[] = ['world', 'qianzigu-map', 'letter-forest']

export function useAppState(): AppState {
  const [phase, setPhase] = useState<AppPhase>('boot')
  const [currentWordId, setCurrentWordId] = useState<number | null>(null)
  const [currentChapterId, setCurrentChapterId] = useState<number | null>(null)
  // 从哪个地图进入全屏页(lesson/settings),退出时回该地图;默认 world 壳。
  const lastMapRef = useRef<AppPhase>('world')

  function rememberLastMap() {
    if (MAP_PHASES.includes(phase)) lastMapRef.current = phase
  }

  return {
    phase,
    currentWordId,
    currentChapterId,
    actions: {
      enterLesson(wordId) {
        rememberLastMap()
        setCurrentWordId(wordId)
        setPhase('lesson')
      },
      exitToHome() {
        setPhase(lastMapRef.current)
      },
      nextWord() {
        setCurrentWordId(wordId => (wordId === null ? null : wordId + 1))
      },
      openSettings() {
        rememberLastMap()
        setPhase('settings')
      },
      closeSettings() {
        setPhase(lastMapRef.current)
      },
      enterWorld() {
        setPhase('world')
      },
      enterQianziguMap() {
        setPhase('qianzigu-map')
      },
      enterLetterForest() {
        setPhase('letter-forest')
      },
      enterChapter(chapterId) {
        setCurrentChapterId(chapterId)
        setPhase('chapter')
      },
      closeChapter() {
        setCurrentChapterId(null)
        setPhase('qianzigu-map')
      },
    },
  }
}
