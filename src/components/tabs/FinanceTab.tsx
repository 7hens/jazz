import { useMemo, useState, type FormEvent } from 'react'
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CircleDollarSign, PiggyBank, Wallet } from 'lucide-react'
import { ExpenseBreakdown } from '../dashboard/ExpenseBreakdown'
import { RecordList } from '../dashboard/RecordList'
import { StatCard } from '../dashboard/StatCard'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { getMonthKey, isInThisMonth, todayIso } from '../../lib/date'
import type { LifeRecord, RecordType } from '../../types'

const currency = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' })

const expenseCategories = ['餐饮', '购物', '交通', '娱乐', '生活', '医疗', '其他']
const incomeCategories = ['工资', '奖金', '副业', '理财', '其他']

type FinanceTabProps = {
  records: LifeRecord[]
  error: string
  onSave: (payload: Record<string, string | number | undefined>) => Promise<void>
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
      .filter((record) => record.type === 'expense')
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
    await onSave({
      type,
      date: date || todayIso(),
      note,
      amount: Number(amount || 0),
      category,
    })
    setAmount('')
    setNote('')
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
            <CardDescription>收入与支出分开记录,月度自动汇总。</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-5 flex flex-wrap gap-2">
              <Button
                type="button"
                variant={type === 'expense' ? 'default' : 'secondary'}
                onClick={() => setType('expense')}
                className="rounded-full"
              >
                支出
              </Button>
              <Button
                type="button"
                variant={type === 'income' ? 'default' : 'secondary'}
                onClick={() => setType('income')}
                className="rounded-full"
              >
                收入
              </Button>
            </div>
            {monthCount > 0 ? (
              <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700">
                本月已记录 {monthCount} 笔收支,建议每月底盘点一次。
              </div>
            ) : null}
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="finance-date">日期</Label>
                  <Input id="finance-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="finance-amount">金额</Label>
                  <Input id="finance-amount" type="number" step="0.01" min="0" placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="finance-category">分类</Label>
                  <select
                    id="finance-category"
                    className="flex h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                  >
                    {categories.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="finance-note">备注</Label>
                  <Input id="finance-note" value={note} placeholder="例如：日常采购、工资入账" onChange={(event) => setNote(event.target.value)} />
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

        <ExpenseBreakdown breakdown={expenseBreakdown} total={monthExpense} currency={currency} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>收支趋势</CardTitle>
          <CardDescription>按月汇总收入、支出与结余</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
              暂无收支数据,记录后即可查看月度趋势。
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="income" name="收入" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="支出" fill="#f97316" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="net" name="结余" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} />
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
