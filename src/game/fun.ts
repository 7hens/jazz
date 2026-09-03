// 趣味系统纯工具:本地日 / 连续天数 / 幸运 / 灵灵档位。时间与 rng 可注入便于单测。

export const LUCKY_RATE = 0.1
export const LUCKY_AMOUNT = 50

const pad = (n: number) => String(n).padStart(2, '0')

export function todayKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function shiftDate(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, (m ?? 1) - 1, (d ?? 1) + delta)
  return todayKey(dt)
}

export function nextConsecutive(prev: number, lastDate: string, today: string): number {
  if (lastDate === '') return 1
  if (lastDate === today) return prev
  if (shiftDate(today, -1) === lastDate) return prev + 1
  return 1
}

export function rollLucky(rng: () => number = Math.random): number {
  return rng() < LUCKY_RATE ? LUCKY_AMOUNT : 0
}

export type LingLingStage = 0 | 1 | 2 | 3 | 4

export function lingLingStage(completedWords: number, totalWords = 100): LingLingStage {
  const pct = completedWords / totalWords
  if (pct < 0.1) return 0
  if (pct < 0.3) return 1
  if (pct < 0.5) return 2
  if (pct < 0.8) return 3
  return 4
}
