import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import type { LifeRecord } from '../../types'

type RecordListProps = {
  records: LifeRecord[]
  onDelete: (recordId: string) => void
  currency: Intl.NumberFormat
}

export function RecordList({ records, onDelete, currency }: RecordListProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>最近记录</CardTitle>
            <CardDescription>每条数据都关联当前账户，做到用户隔离。</CardDescription>
          </div>
          <Badge variant="secondary" className="inline-flex items-center gap-2">
            {records.length} 条
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {records.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
              暂无记录，先添加一条吧。
            </div>
          ) : (
            records.map((record) => {
              const badgeMap = {
                expense: '支',
                income: '收',
                weight: '体',
              }

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
                <div key={record.id} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white">
                      {badgeMap[record.type]}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800">{labelText}</div>
                      <div className="text-sm text-slate-500">{record.date}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-base font-semibold text-slate-800">{valueText}</div>
                    <Button variant="ghost" size="sm" onClick={() => onDelete(record.id)}>
                      删除
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}
