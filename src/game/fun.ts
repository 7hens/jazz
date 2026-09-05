// 本地日 / 连续天数纯工具。时间可注入便于单测。
// 幸运骰与灵灵档位已迁 src/features/{lucky-bonus,lingling};此处只留日期。

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
