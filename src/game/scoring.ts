import type { Level, Question } from '../types'

export type AttemptResult = { correct: boolean; points: number; streak: number }

export type LevelRun = {
  question: Question
  selectedId: string
  attempt: 1 | 2
  prevStreak: number
}

export type LevelOutcome = {
  rawScore: number
  baseMax: number
  rate: number // 0..100 整数
  stars: 0 | 1 | 2 | 3
  maxStreak: number
  firstTryCorrect: number
}

export function scoreAttempt(question: Question, selectedId: string, attempt: 1 | 2, prevStreak: number): AttemptResult {
  if (question.kind === 'match') {
    // 匹配题整组作答:组件端配对全对后才触发本函数,selectedId 传任一正确 left id
    // (answerMap 以 left.id 为键);无二次作答机会(attempt 恒 1),整对 +10 并延续连击。
    const correct = question.answerMap[selectedId] !== undefined
    return { correct, points: correct ? 10 : 0, streak: correct ? prevStreak + 1 : 0 }
  }
  const correct = selectedId === question.answerId
  if (!correct) return { correct, points: 0, streak: 0 }
  const firstTry = attempt === 1
  const points = firstTry ? 10 + (prevStreak >= 1 ? 2 : 0) : 5
  const streak = firstTry ? prevStreak + 1 : 0
  return { correct, points, streak }
}

/** rate 为 0..100 整数(得分率百分比);≥90→3★、≥70→2★、≥50→1★,否则 0★。 */
export function starsForRate(rate: number): 0 | 1 | 2 | 3 {
  if (rate >= 90) return 3
  if (rate >= 70) return 2
  if (rate >= 50) return 1
  return 0
}

export function runLevel(level: Level, runs: LevelRun[]): LevelOutcome {
  let raw = 0
  let maxStreak = 0
  let streak = 0
  let firstTryCorrect = 0
  for (const r of runs) {
    const res = scoreAttempt(r.question, r.selectedId, r.attempt, r.prevStreak)
    raw += res.points
    streak = res.streak
    if (streak > maxStreak) maxStreak = streak
    if (r.attempt === 1 && res.correct) firstTryCorrect += 1
  }
  const baseMax = level.questions.length * 10
  const rate = Math.round(Math.min(100, (raw / baseMax) * 100))
  return { rawScore: raw, baseMax, rate, stars: starsForRate(rate), maxStreak, firstTryCorrect }
}
