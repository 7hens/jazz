import { motion } from 'motion/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'

type ExpenseBreakdownProps = {
  breakdown: Array<[string, number]>
  total: number
  currency: Intl.NumberFormat
}

const palette = ['bg-orange', 'bg-violet', 'bg-emerald', 'bg-sky', 'bg-amber']

export function ExpenseBreakdown({ breakdown, total, currency }: ExpenseBreakdownProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>本月消费分布</CardTitle>
        <CardDescription>按分类统计并保护隐私</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {breakdown.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-hairline-strong bg-surface-2 p-5 text-sm text-ink-3">
            本月还没有消费记录。
          </div>
        ) : (
          breakdown.map(([category, amount], index) => {
            const percent = total > 0 ? Math.round((amount / total) * 100) : 0
            const color = palette[index % palette.length]
            return (
              <div key={category} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
                    <span className="font-medium text-ink">{category}</span>
                  </div>
                  <span className="tabular-nums text-ink-2">
                    {currency.format(amount)} · {percent}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-3">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(8, percent)}%` }}
                    transition={{ type: 'spring', bounce: 0, duration: 0.6 }}
                    className={`h-2 rounded-full ${color}`}
                  />
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
