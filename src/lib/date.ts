export function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayIso(): string {
  return toIsoDate(new Date())
}

// 本周五(以周一为一周起点)。周六/日返回本周已过去的周五。
export function getThisWeekFriday(): string {
  const now = new Date()
  const day = now.getDay() // 0=周日,1=周一…6=周六
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diffToMonday)
  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)
  return toIsoDate(friday)
}

// dateStr 是否属于本周(周一为起点)
export function isInThisWeek(dateStr: string): boolean {
  const date = new Date(`${dateStr}T00:00:00`)
  const now = new Date()
  const day = now.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const start = new Date(now)
  start.setDate(now.getDate() + diffToMonday)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return date >= start && date <= end
}

// dateStr 是否属于本月
export function isInThisMonth(dateStr: string): boolean {
  const now = new Date()
  const date = new Date(`${dateStr}T00:00:00`)
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
}

// '2026-08' 月键(用于月度聚合)
export function getMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7)
}
