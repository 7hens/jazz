import { useState } from 'react'

export type AppPhase = 'boot' | 'login' | 'home' | 'lesson' | 'settings'

export interface AppState {
  phase: AppPhase
  currentWordId: number | null
  actions: {
    enterLesson(wordId: number): void
    exitToHome(): void
    nextWord(): void
    openSettings(): void
    closeSettings(): void
  }
}

export function useAppState(): AppState {
  const [phase, setPhase] = useState<AppPhase>('boot')
  const [currentWordId, setCurrentWordId] = useState<number | null>(null)

  return {
    phase,
    currentWordId,
    actions: {
      enterLesson(wordId) {
        setCurrentWordId(wordId)
        setPhase('lesson')
      },
      exitToHome() {
        setPhase('home')
      },
      nextWord() {
        setCurrentWordId(wordId => wordId === null ? null : wordId + 1)
      },
      openSettings() {
        setPhase('settings')
      },
      closeSettings() {
        setPhase('home')
      },
    },
  }
}
