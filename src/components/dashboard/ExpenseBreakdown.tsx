import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'

type ExpenseBreakdownProps = {
  breakdown: Array<[string, number]>
  total: number
  currency: Intl.NumberFormat
}

const palette = ['bg-orange-400', 'bg-violet-400', 'bg-emerald-400', 'bg-sky-400', 'bg-amber-400']

export function ExpenseBreakdown({ breakdown, total, currency }: ExpenseBreakdownProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>本月消费分布</CardTitle>
        <CardDescription>按分类统计并保护隐私</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {breakdown.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            本月还没有消费记录。
          </div>
        ) : (
          breakdown.map(([category, amount], index) => {
            const percent = total > 0 ? Math.round((amount / total) * 100) : 0
            return (
              <div key={category} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${palette[index % palette.length]}`} />
                    <span className="font-medium text-slate-700">{category}</span>
                  </div>
                  <span className="text-slate-600">{currency.format(amount)} · {percent}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className={`h-2 rounded-full ${palette[index % palette.length]}`} style={{ width: `${Math.max(8, percent)}%` }} />
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
