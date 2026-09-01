import type { ReactNode } from 'react'

import { Card } from '../ui/card'

type StatCardProps = {
  title: string
  value: string
  detail: string
  icon: ReactNode
  tone: 'orange' | 'violet' | 'emerald'
}

const toneMap = {
  orange: 'bg-orange-tint text-orange',
  violet: 'bg-violet-tint text-violet',
  emerald: 'bg-emerald-tint text-emerald',
}

export function StatCard({ title, value, detail, icon, tone }: StatCardProps) {
  return (
    <Card className="p-5 md:p-6">
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${toneMap[tone]}`}>{icon}</span>
        <span className="text-sm font-medium text-ink-2">{title}</span>
      </div>
      <div className="mt-4 text-3xl font-semibold tabular-nums tracking-tight">{value}</div>
      <p className="mt-1.5 text-sm text-ink-3">{detail}</p>
    </Card>
  )
}
