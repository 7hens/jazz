import type { ReactNode } from 'react'

import { Badge } from '../ui/badge'
import { Card, CardContent, CardHeader } from '../ui/card'

type StatCardProps = {
  title: string
  value: string
  detail: string
  icon: ReactNode
  tone: 'orange' | 'violet' | 'emerald'
}

export function StatCard({ title, value, detail, icon, tone }: StatCardProps) {
  const toneMap = {
    orange: 'border-orange-100 bg-orange-50/60 text-orange-600',
    violet: 'border-violet-100 bg-violet-50/60 text-violet-600',
    emerald: 'border-emerald-100 bg-emerald-50/60 text-emerald-600',
  }

  return (
    <Card className={toneMap[tone]}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Badge variant={tone === 'orange' ? 'orange' : tone === 'violet' ? 'purple' : 'secondary'}>{title}</Badge>
          <div className="text-current">{icon}</div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-slate-900">{value}</div>
        <p className="mt-2 text-sm text-slate-500">{detail}</p>
      </CardContent>
    </Card>
  )
}
