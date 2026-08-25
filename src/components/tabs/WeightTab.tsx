import { useMemo, useState, type FormEvent } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CalendarClock, TrendingUp } from 'lucide-react'
import { RecordList } from '../dashboard/RecordList'
import { StatCard } from '../dashboard/StatCard'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { getThisWeekFriday, isInThisWeek, todayIso } from '../../lib/date'
import type { LifeRecord } from '../../types'

const currency = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' })

type WeightTabProps = {
  records: LifeRecord[]
  error: string
  onSave: (payload: Record<string, string | number | undefined>) => Promise<void>
  onDelete: (recordId: string) => Promise<void>
}

export function WeightTab({ records, error, onSave, onDelete }: WeightTabProps) {
  const [date, setDate] = useState(getThisWeekFriday())
  const [weight, setWeight] = useState('')
  const [note, setNote] = useState('')

  const weightRecords = useMemo(
    () =>
      records
        .filter((record) => record.type === 'weight')
        .sort((left, right) => left.date.localeCompare(right.date)),
    [records],
  )

  const latest = weightRecords[weightRecords.length - 1] ?? null
  const change = useMemo(() => {
    if (weightRecords.length < 2) return null
    const last = weightRecords[weightRecords.length - 1]?.weight ?? 0
    const prev = weightRecords[weightRecords.length - 2]?.weight ?? 0
    return last - prev
  }, [weightRecords])
  const recordedThisWeek = weightRecords.some((record) => isInThisWeek(record.date))

  const chartData = weightRecords.map((record) => ({ date: record.date, weight: record.weight ?? 0 }))

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await onSave({ type: 'weight', date: date || todayIso(), note, weight: Number(weight || 0) })
    setWeight('')
    setNote('')
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="最新体重"
          value={latest ? `${latest.weight?.toFixed(1)} kg` : '--'}
          detail={latest ? `记录于 ${latest.date}` : '暂无体重记录'}
          icon={<TrendingUp className="h-5 w-5" />}
          tone="violet"
        />
        <StatCard
          title="较上次变化"
          value={change === null ? '--' : `${change >= 0 ? '+' : ''}${change.toFixed(1)} kg`}
          detail="最近两次记录差值"
          icon={<TrendingUp className="h-5 w-5" />}
          tone="emerald"
        />
        <StatCard
          title="本周状态"
          value={recordedThisWeek ? '已记录' : '待记录'}
          detail={`建议每周五记录 · 本周五 ${getThisWeekFriday()}`}
          icon={<CalendarClock className="h-5 w-5" />}
          tone="orange"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>记录体重</CardTitle>
            <CardDescription>每周五记录一次,追踪变化趋势。</CardDescription>
          </CardHeader>
          <CardContent>
            {recordedThisWeek ? (
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                本周已记录体重,如需更新可直接修改后保存。
              </div>
            ) : null}
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="weight-date">日期</Label>
                  <Input id="weight-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weight-value">体重（kg）</Label>
                  <Input id="weight-value" type="number" step="0.1" min="20" max="300" placeholder="68.5" value={weight} onChange={(event) => setWeight(event.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="weight-note">备注</Label>
                  <Input id="weight-note" value={note} placeholder="例如：晨间空腹、运动后" onChange={(event) => setNote(event.target.value)} />
                </div>
              </div>

              {error ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
              ) : null}

              <div className="flex justify-end">
                <Button type="submit">保存记录</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>体重趋势</CardTitle>
            <CardDescription>全部体重记录的变化曲线</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                暂无体重数据,记录后即可查看趋势。
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis domain={['auto', 'auto']} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="weight" name="体重 (kg)" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <RecordList records={weightRecords} onDelete={onDelete} currency={currency} />
    </div>
  )
}
