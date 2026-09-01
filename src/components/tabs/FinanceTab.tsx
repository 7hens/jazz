import { useMemo, useState, type FormEvent } from 'react'
import { motion } from 'motion/react'
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CircleDollarSign, PiggyBank, Wallet } from 'lucide-react'
import { ExpenseBreakdown } from '../dashboard/ExpenseBreakdown'
import { RecordList } from '../dashboard/RecordList'
import { StatCard } from '../dashboard/StatCard'
import { ChartTooltip } from '../ui/chart-tooltip'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select } from '../ui/select'
import { getMonthKey, isInThisMonth, todayIso } from '../../lib/date'
import type { LifeRecord, RecordType } from '../../types'

const currency = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' })

const expenseCategories = ['餐饮', '购物', '交通', '娱乐', '生活', '医疗', '其他']
const incomeCategories = ['工资', '奖金', '副业', '理财', '其他']

const TYPE_SPRING = { type: 'spring', bounce: 0, duration: 0.4 } as const

type FinanceTabProps = {
  records: LifeRecord[]
  error: string
  onSave: (payload: Record<string, string | number | undefined>) => Promise<boolean>
  onDelete: (recordId: string) => Promise<void>
}

export function FinanceTab({ records, error, onSave, onDelete }: FinanceTabProps) {
  const [type, setType] = useState<RecordType>('expense')
  const [date, setDate] = useState(todayIso())
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('餐饮')
  const [note, setNote] = useState('')

  const financeRecords = useMemo(
    () => records.filter((record) => record.type === 'expense' || record.type === 'income'),
    [records],
  )

  const monthExpense = useMemo(
    () =>
      financeRecords
        .filter((record) => record.type === 'expense' && isInThisMonth(record.date))
        .reduce((total, record) => total + Number(record.amount ?? 0), 0),
    [financeRecords],
  )

  const monthIncome = useMemo(
    () =>
      financeRecords
        .filter((record) => record.type === 'income' && isInThisMonth(record.date))
        .reduce((total, record) => total + Number(record.amount ?? 0), 0),
    [financeRecords],
  )

  const monthCount = financeRecords.filter((record) => isInThisMonth(record.date)).length

  const expenseBreakdown = useMemo(() => {
    const totals = new Map<string, number>()
    financeRecords
      .filter((record) => record.type === 'expense' && isInThisMonth(record.date))
      .forEach((record) => {
        const key = record.category ?? '其他'
        totals.set(key, (totals.get(key) ?? 0) + Number(record.amount ?? 0))
      })
    return Array.from(totals.entries()).sort((left, right) => right[1] - left[1])
  }, [financeRecords])

  const chartData = useMemo(() => {
    const months = new Map<string, { month: string; income: number; expense: number }>()
    financeRecords.forEach((record) => {
      const key = getMonthKey(record.date)
      const entry = months.get(key) ?? { month: key, income: 0, expense: 0 }
      if (record.type === 'income') entry.income += Number(record.amount ?? 0)
      else entry.expense += Number(record.amount ?? 0)
      months.set(key, entry)
    })
    return Array.from(months.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((entry) => ({ ...entry, net: entry.income - entry.expense }))
  }, [financeRecords])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const ok = await onSave({
      type,
      date: date || todayIso(),
      note,
      amount: Number(amount || 0),
      category,
    })
    if (ok) {
      setAmount('')
      setNote('')
    }
  }

  const categories = type === 'expense' ? expenseCategories : incomeCategories

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="本月支出"
          value={currency.format(monthExpense)}
          detail="本月累计支出"
          icon={<CircleDollarSign className="h-5 w-5" />}
          tone="orange"
        />
        <StatCard
          title="本月收入"
          value={currency.format(monthIncome)}
          detail="本月累计收入"
          icon={<PiggyBank className="h-5 w-5" />}
          tone="emerald"
        />
        <StatCard
          title="本月结余"
          value={currency.format(monthIncome - monthExpense)}
          detail={monthCount > 0 ? `本月已记录 ${monthCount} 笔` : '本月暂无记录'}
          icon={<Wallet className="h-5 w-5" />}
          tone="violet"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>记录收支</CardTitle>
            <CardDescription>收入与支出分开记录，月度自动汇总。</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="glass-strong inline-flex items-center gap-1 rounded-full border border-hairline p-1">
                {(['expense', 'income'] as const).map((item) => {
                  const active = type === item
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setType(item)
                        setCategory(item === 'expense' ? '餐饮' : '工资')
                      }}
                      className={`relative rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                        active ? 'text-white' : 'text-ink-2 hover:text-ink'
                      }`}
                    >
                      {active ? (
                        <motion.span
                          layoutId="finance-type-pill"
                          className="absolute inset-0 rounded-full bg-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.3)]"
                          transition={TYPE_SPRING}
                        />
                      ) : null}
                      <span className="relative z-10">{item === 'expense' ? '支出' : '收入'}</span>
                    </button>
                  )
                })}
              </div>
              {monthCount > 0 ? (
                <span className="rounded-full bg-sky-tint px-3 py-1 text-xs font-medium text-sky">
                  本月已记录 {monthCount} 笔
                </span>
              ) : null}
            </div>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="finance-date">日期</Label>
                  <Input id="finance-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="finance-amount">金额</Label>
                  <Input
                    id="finance-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="finance-category">分类</Label>
                  <Select
                    id="finance-category"
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                  >
                    {categories.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="finance-note">备注</Label>
                  <Input
                    id="finance-note"
                    value={note}
                    placeholder="例如：日常采购、工资入账"
                    onChange={(event) => setNote(event.target.value)}
                  />
                </div>
              </div>

              {error ? (
                <div className="rounded-xl bg-red-tint px-3.5 py-2.5 text-sm text-red">{error}</div>
              ) : null}

              <div className="flex justify-end">
                <Button type="submit">保存记录</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <ExpenseBreakdown breakdown={expenseBreakdown} total={monthExpense} currency={currency} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>收支趋势</CardTitle>
          <CardDescription>按月汇总收入、支出与结余</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-hairline-strong bg-surface-2 p-6 text-sm text-ink-3">
              暂无收支数据，记录后即可查看月度趋势。
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-hairline)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: 'var(--color-ink-3)' }}
                    axisLine={false}
                    tickLine={false}
                    tickMargin={8}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: 'var(--color-ink-3)' }}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--color-hairline)' }} />
                  <Bar dataKey="income" name="收入" fill="var(--color-emerald)" radius={[6, 6, 0, 0]} barSize={18} />
                  <Bar dataKey="expense" name="支出" fill="var(--color-orange)" radius={[6, 6, 0, 0]} barSize={18} />
                  <Line
                    type="monotone"
                    dataKey="net"
                    name="结余"
                    stroke="var(--color-violet)"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: 'var(--color-violet)', strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <RecordList records={financeRecords} onDelete={onDelete} currency={currency} />
    </div>
  )
}
