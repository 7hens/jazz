export type AnswerKind = 'first' | 'retry' | 'wrong'

export type ComboSnapshot = Readonly<{
  combo: number
  maxCombo: number
}>

export interface ComboService {
  getSnapshot(): ComboSnapshot
  subscribe(listener: () => void): () => void
  answer(kind: AnswerKind): number
  reset(): void
  getBonus(): number
}
