import { AnimatePresence, motion } from 'motion/react'
import { Trash2 } from 'lucide-react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import type { LifeRecord } from '../../types'

type RecordListProps = {
  records: LifeRecord[]
  onDelete: (recordId: string) => void
  currency: Intl.NumberFormat
}

const typeMeta = {
  expense: { badge: '支', tile: 'bg-orange-tint text-orange' },
  income: { badge: '收', tile: 'bg-emerald-tint text-emerald' },
  weight: { badge: '体', tile: 'bg-violet-tint text-violet' },
} as const

export function RecordList({ records, onDelete, currency }: RecordListProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>最近记录</CardTitle>
            <CardDescription>每条数据都关联当前账户，做到用户隔离。</CardDescription>
          </div>
          <Badge className="inline-flex items-center gap-2">{records.length} 条</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {records.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-hairline-strong bg-surface-2 p-6 text-sm text-ink-3">
            暂无记录，先添加一条吧。
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {records.map((record) => {
                const meta = typeMeta[record.type]

                const valueText =
                  record.type === 'expense'
                    ? `- ${currency.format(record.amount ?? 0)}`
                    : record.type === 'income'
                      ? `+ ${currency.format(record.amount ?? 0)}`
                      : `${(record.weight ?? 0).toFixed(1)} kg`

                const labelText =
                  record.type === 'expense'
                    ? `${record.category ?? '其他'} · ${record.note || '消费记录'}`
                    : record.type === 'income'
                      ? `${record.category ?? '其他'} · ${record.note || '收入记录'}`
                      : `${(record.weight ?? 0).toFixed(1)} kg · ${record.note || '体重记录'}`

                return (
                  <motion.div
                    key={record.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 32 }}
                    transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
                    className="group flex items-center justify-between gap-4 rounded-2xl bg-surface-2 px-4 py-3 transition-colors hover:bg-surface-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold ${meta.tile}`}
                      >
                        {meta.badge}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-ink">{labelText}</div>
                        <div className="text-sm text-ink-3">{record.date}</div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="font-semibold tabular-nums text-ink">{valueText}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(record.id)}
                        aria-label="删除记录"
                        className="text-ink-3 opacity-70 hover:bg-red-tint hover:text-red md:opacity-0 md:group-hover:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
