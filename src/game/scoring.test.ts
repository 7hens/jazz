import { describe, expect, it } from 'vitest'
import type { Level, Question } from '../types'
import { runLevel, scoreAttempt, starsForRate } from './scoring'

const OPTS = [
  { id: 'a', text: 'a' },
  { id: 'b', text: 'b' },
  { id: 'c', text: 'c' },
  { id: 'd', text: 'd' },
]

function listenQuestion(answerId: string): Question {
  return { kind: 'listen-choice', prompt: '听一听', promptSpeak: '啊', options: OPTS, answerId }
}

function listenQuestionN(n: number): Question {
  return {
    kind: 'listen-choice',
    prompt: `第 ${n} 题`,
    promptSpeak: `词${n}`,
    options: OPTS,
    answerId: 'a',
  }
}

function makeLevel(questions: Question[]): Level {
  return { id: 1, kingdom: 'pinyin', title: '第 1 关', questions }
}

describe('scoreAttempt', () => {
  it('首答正确: +10、连击 +1', () => {
    expect(scoreAttempt(listenQuestion('a'), 'a', 1, 0)).toEqual({ correct: true, points: 10, streak: 1 })
  })

  it('连击:上一题首对(prevStreak 3)后再首对 +2 → 12 分、streak 4', () => {
    expect(scoreAttempt(listenQuestion('a'), 'a', 1, 3)).toEqual({ correct: true, points: 12, streak: 4 })
  })

  it('二答正确: +5、连击中断 streak 0', () => {
    expect(scoreAttempt(listenQuestion('a'), 'a', 2, 3)).toEqual({ correct: true, points: 5, streak: 0 })
  })

  it('两次都错: 0 分、correct false、streak 0', () => {
    expect(scoreAttempt(listenQuestion('a'), 'b', 2, 0)).toEqual({ correct: false, points: 0, streak: 0 })
  })

  it('首答选错: correct false、streak 0', () => {
    expect(scoreAttempt(listenQuestion('a'), 'b', 1, 2)).toEqual({ correct: false, points: 0, streak: 0 })
  })
})

describe('starsForRate', () => {
  it.each([
    [100, 3],
    [90, 3],
    [89, 2],
    [80, 2],
    [70, 2],
    [69, 1],
    [60, 1],
    [50, 1],
    [49, 0],
    [0, 0],
  ] as const)('starsForRate(%s) → %s', (rate, stars) => {
    expect(starsForRate(rate)).toBe(stars)
  })
})

describe('runLevel', () => {
  it('6 题全首对:rawScore 70(含连击)、rate 封顶 100、3★、maxStreak 6、firstTryCorrect 6', () => {
    const questions = Array.from({ length: 6 }, (_, i) => listenQuestionN(i))
    const runs = questions.map((q, i) => ({ question: q, selectedId: 'a', attempt: 1 as const, prevStreak: i }))
    const out = runLevel(makeLevel(questions), runs)
    expect(out.rawScore).toBe(70)
    expect(out.baseMax).toBe(60)
    expect(out.rate).toBe(100)
    expect(out.stars).toBe(3)
    expect(out.maxStreak).toBe(6)
    expect(out.firstTryCorrect).toBe(6)
  })

  it('含二次对题目:首对率下降,rate < 100', () => {
    const q = Array.from({ length: 6 }, (_, i) => listenQuestionN(i))
    const runs = [
      { question: q[0], selectedId: 'a', attempt: 1 as const, prevStreak: 0 }, // 首对 +10
      { question: q[1], selectedId: 'a', attempt: 1 as const, prevStreak: 1 }, // 首对 +12
      { question: q[2], selectedId: 'b', attempt: 1 as const, prevStreak: 2 }, // 首答错 +0
      { question: q[2], selectedId: 'a', attempt: 2 as const, prevStreak: 0 }, // 二答对 +5
      { question: q[3], selectedId: 'b', attempt: 1 as const, prevStreak: 0 }, // 首答错 +0
      { question: q[3], selectedId: 'a', attempt: 2 as const, prevStreak: 0 }, // 二答对 +5
      { question: q[4], selectedId: 'a', attempt: 1 as const, prevStreak: 0 }, // 首对 +10
      { question: q[5], selectedId: 'a', attempt: 1 as const, prevStreak: 1 }, // 首对 +12
    ]
    const out = runLevel(makeLevel(q), runs)
    expect(out.baseMax).toBe(60)
    expect(out.rawScore).toBe(54)
    expect(out.rate).toBe(90)
    expect(out.rate).toBeLessThan(100)
    expect(out.stars).toBe(3)
    expect(out.maxStreak).toBe(2)
    expect(out.firstTryCorrect).toBe(4)
  })

  it('答案全错:rate 0、0★', () => {
    const questions = Array.from({ length: 6 }, (_, i) => listenQuestionN(i))
    const runs = questions.map((q) => ({ question: q, selectedId: 'b', attempt: 1 as const, prevStreak: 0 }))
    const out = runLevel(makeLevel(questions), runs)
    expect(out.rawScore).toBe(0)
    expect(out.baseMax).toBe(60)
    expect(out.rate).toBe(0)
    expect(out.stars).toBe(0)
    expect(out.maxStreak).toBe(0)
    expect(out.firstTryCorrect).toBe(0)
  })
})
