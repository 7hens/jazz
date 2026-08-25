import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  ArrowRight,
  CircleDollarSign,
  Dumbbell,
  Loader2,
  LockKeyhole,
  LogOut,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react'

import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { Input } from './components/ui/input'
import { Label } from './components/ui/label'
import type { LifeRecord, RecordType, UserProfile } from './types'

const currency = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
})

const todayIso = () => new Date().toISOString().slice(0, 10)

const defaultForm = {
  date: todayIso(),
  amount: '',
  category: '餐饮',
  note: '',
  weight: '',
  exerciseType: '跑步',
  duration: '',
  calories: '',
}

const DEV_USER = {
  id: 'dev-user-1',
  email: 'admin@life.local',
  name: '私密用户',
} as const

const DEV_STORAGE_KEY = 'jazz-life-tracker-dev-user'
const DEV_RECORDS_KEY = 'jazz-life-tracker-dev-records'

function getDevRecords(): LifeRecord[] {
  try {
    const raw = window.localStorage.getItem(DEV_RECORDS_KEY)
    if (!raw) {
      const seed: LifeRecord[] = [
        { id: 'seed-1', type: 'expense', date: '2026-08-20', amount: 68.5, category: '餐饮', note: '午餐和咖啡' },
        { id: 'seed-2', type: 'weight', date: '2026-08-21', weight: 68.4, note: '晨间空腹' },
        { id: 'seed-3', type: 'exercise', date: '2026-08-22', exerciseType: '跑步', duration: 35, calories: 280, note: '晨跑' },
      ]
      window.localStorage.setItem(DEV_RECORDS_KEY, JSON.stringify(seed))
      return seed
    }
    return JSON.parse(raw) as LifeRecord[]
  } catch {
    return []
  }
}

function setDevRecords(records: LifeRecord[]) {
  window.localStorage.setItem(DEV_RECORDS_KEY, JSON.stringify(records))
}

function isLocalDevFallback() {
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
}

function getDevAuth(): { user: UserProfile | null; records: LifeRecord[] } {
  const storedUser = window.localStorage.getItem(DEV_STORAGE_KEY)
  if (!storedUser) {
    return { user: null, records: getDevRecords() }
  }

  try {
    const user = JSON.parse(storedUser) as UserProfile
    return { user, records: getDevRecords() }
  } catch {
    return { user: null, records: getDevRecords() }
  }
}

function App() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [records, setRecords] = useState<LifeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [recordType, setRecordType] = useState<RecordType>('expense')
  const [error, setError] = useState('')
  const [email, setEmail] = useState('admin@life.local')
  const [password, setPassword] = useState('ChangeMe123!')
  const [form, setForm] = useState(defaultForm)

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true)
      try {
        const meResponse = await fetch('/api/me', { credentials: 'include' })
        if (!meResponse.ok) {
          if (isLocalDevFallback()) {
            const fallback = getDevAuth()
            setUser(fallback.user)
            setRecords(fallback.records)
            return
          }
          setUser(null)
          return
        }

        const profile = (await meResponse.json()) as { user: UserProfile }
        setUser(profile.user)

        const recordsResponse = await fetch('/api/records', { credentials: 'include' })
        if (recordsResponse.ok) {
          const data = (await recordsResponse.json()) as { records: LifeRecord[] }
          setRecords(data.records)
        }
      } catch {
        if (isLocalDevFallback()) {
          const fallback = getDevAuth()
          setUser(fallback.user)
          setRecords(fallback.records)
        } else {
          setUser(null)
        }
      } finally {
        setLoading(false)
      }
    }

    void bootstrap()
  }, [])

  const monthExpense = useMemo(() => {
    const currentMonth = new Date().getMonth()
    return records
      .filter((record) => record.type === 'expense')
      .filter((record) => {
        const date = new Date(`${record.date}T00:00:00`)
        return date.getMonth() === currentMonth
      })
      .reduce((total, record) => total + Number(record.amount ?? 0), 0)
  }, [records])

  const latestWeight = useMemo(() => {
    const weights = records
      .filter((record) => record.type === 'weight')
      .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())

    return weights[0] ?? null
  }, [records])

  const weeklyMinutes = useMemo(() => {
    const now = new Date()
    const lastWeek = new Date(now)
    lastWeek.setDate(now.getDate() - 6)

    return records
      .filter((record) => record.type === 'exercise')
      .filter((record) => new Date(`${record.date}T00:00:00`) >= lastWeek)
      .reduce((sum, record) => sum + Number(record.duration ?? 0), 0)
  }, [records])

  const expenseBreakdown = useMemo(() => {
    const totals = new Map<string, number>()

    records
      .filter((record) => record.type === 'expense')
      .forEach((record) => {
        const key = record.category ?? '其他'
        totals.set(key, (totals.get(key) ?? 0) + Number(record.amount ?? 0))
      })

    return Array.from(totals.entries()).sort((left, right) => right[1] - left[1])
  }, [records])

  const sortedRecords = useMemo(
    () => [...records].sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()),
    [records],
  )

  async function fetchRecords() {
    if (isLocalDevFallback()) {
      const records = getDevRecords()
      setRecords(records)
      return records
    }

    const response = await fetch('/api/records', { credentials: 'include' })
    if (!response.ok) {
      throw new Error('无法获取记录')
    }

    const payload = (await response.json()) as { records: LifeRecord[] }
    setRecords(payload.records)
    return payload.records
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (isLocalDevFallback()) {
      const credentialsOk = email.trim().toLowerCase() === DEV_USER.email && password === 'ChangeMe123!'
      if (!credentialsOk) {
        setError('登录失败')
        return
      }

      const user = { ...DEV_USER, email: email.trim().toLowerCase() }
      window.localStorage.setItem(DEV_STORAGE_KEY, JSON.stringify(user))
      setUser(user)
      const records = await fetchRecords()
      setRecords(records)
      return
    }

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    const payload = (await response.json().catch(() => ({ message: '登录失败' }))) as {
      message?: string
      user?: UserProfile
    }

    if (!response.ok) {
      setError(payload.message ?? '登录失败')
      return
    }

    if (payload.user) {
      setUser(payload.user)
      await fetchRecords()
    }
  }

  async function handleLogout() {
    if (isLocalDevFallback()) {
      window.localStorage.removeItem(DEV_STORAGE_KEY)
      window.localStorage.removeItem(DEV_RECORDS_KEY)
      setUser(null)
      setRecords([])
      return
    }

    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })
    setUser(null)
    setRecords([])
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const payload: Record<string, string | number | undefined> = {
      type: recordType,
      date: form.date || todayIso(),
      note: form.note || '',
    }

    if (recordType === 'expense') {
      payload.amount = Number(form.amount || 0)
      payload.category = form.category || '其他'
    }

    if (recordType === 'weight') {
      payload.weight = Number(form.weight || 0)
    }

    if (recordType === 'exercise') {
      payload.exerciseType = form.exerciseType || '其他'
      payload.duration = Number(form.duration || 0)
      payload.calories = Number(form.calories || 0)
    }

    if (isLocalDevFallback()) {
      const next = [...getDevRecords()]
      next.unshift({
        id: `dev-${Date.now()}`,
        type: recordType,
        date: String(payload.date),
        note: String(payload.note ?? ''),
        amount: recordType === 'expense' ? Number(payload.amount ?? 0) : undefined,
        category: recordType === 'expense' ? String(payload.category ?? '其他') : undefined,
        weight: recordType === 'weight' ? Number(payload.weight ?? 0) : undefined,
        exerciseType: recordType === 'exercise' ? String(payload.exerciseType ?? '其他') : undefined,
        duration: recordType === 'exercise' ? Number(payload.duration ?? 0) : undefined,
        calories: recordType === 'exercise' ? Number(payload.calories ?? 0) : undefined,
      })
      setDevRecords(next)
      setRecords(next)
      setError('')
      setForm({ ...defaultForm, date: todayIso() })
      return
    }

    const response = await fetch('/api/records', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = (await response.json().catch(() => ({ message: '保存失败' }))) as { message?: string }
    if (!response.ok) {
      setError(data.message ?? '保存失败')
      return
    }

    setError('')
    setForm({ ...defaultForm, date: todayIso() })
    await fetchRecords()
  }

  async function handleDelete(recordId: string) {
    if (isLocalDevFallback()) {
      const next = getDevRecords().filter((record) => record.id !== recordId)
      setDevRecords(next)
      setRecords(next)
      return
    }

    const response = await fetch(`/api/records?id=${recordId}`, {
      method: 'DELETE',
      credentials: 'include',
    })

    if (response.ok) {
      setRecords((current) => current.filter((record) => record.id !== recordId))
    }
  }

  const renderMiniForm = () => {
    if (recordType === 'expense') {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="date">日期</Label>
            <Input id="date" type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">金额</Label>
            <Input id="amount" type="number" step="0.01" min="0" placeholder="0.00" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">分类</Label>
            <select
              id="category"
              className="flex h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
            >
              <option>餐饮</option>
              <option>购物</option>
              <option>交通</option>
              <option>娱乐</option>
              <option>生活</option>
              <option>医疗</option>
              <option>其他</option>
            </select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="expense-note">备注</Label>
            <Input id="expense-note" value={form.note} placeholder="例如：早餐、电影票、副食品" onChange={(event) => setForm({ ...form, note: event.target.value })} />
          </div>
        </div>
      )
    }

    if (recordType === 'weight') {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="weight-date">日期</Label>
            <Input id="weight-date" type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="weight-value">体重（kg）</Label>
            <Input id="weight-value" type="number" step="0.1" min="20" max="300" placeholder="68.5" value={form.weight} onChange={(event) => setForm({ ...form, weight: event.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="weight-note">备注</Label>
            <Input id="weight-note" value={form.note} placeholder="例如：晨间空腹、运动后" onChange={(event) => setForm({ ...form, note: event.target.value })} />
          </div>
        </div>
      )
    }

    return (
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="exercise-date">日期</Label>
          <Input id="exercise-date" type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="exercise-type">运动类型</Label>
          <select
            id="exercise-type"
            className="flex h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
            value={form.exerciseType}
            onChange={(event) => setForm({ ...form, exerciseType: event.target.value })}
          >
            <option>跑步</option>
            <option>健身</option>
            <option>骑行</option>
            <option>游泳</option>
            <option>散步</option>
            <option>瑜伽</option>
            <option>其他</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="exercise-duration">时长（分钟）</Label>
          <Input id="exercise-duration" type="number" min="1" value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="exercise-calories">热量（kcal）</Label>
          <Input id="exercise-calories" type="number" min="0" value={form.calories} onChange={(event) => setForm({ ...form, calories: event.target.value })} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="exercise-note">备注</Label>
          <Input id="exercise-note" value={form.note} placeholder="例如：胸肌训练、轻松晨跑" onChange={(event) => setForm({ ...form, note: event.target.value })} />
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-700">
        <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>正在检查会话…</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#f4f7ff,_#eef2ff_38%,_#f8fafc)] p-4 text-slate-700">
        <Card className="w-full max-w-md border-slate-200 shadow-xl shadow-slate-200/70">
          <CardHeader className="space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-900/20">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-2xl">隐私生活记录</CardTitle>
              <CardDescription>登录后才可查看和编辑你的数据，访问前会校验授权。</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleLogin}>
              <div className="space-y-2">
                <Label htmlFor="email">邮箱</Label>
                <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="请输入密码" />
              </div>

              {error ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
              ) : null}

              <Button type="submit" className="w-full">
                进入受保护空间
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>

            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              默认账户：admin@life.local / ChangeMe123!
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f8fafc,_#edf2ff_35%,_#f8fafc)] p-4 text-slate-700 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              私密生活管理
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">生活记录仪</h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700">
              {user.email}
            </div>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              退出
            </Button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <Card className="border-orange-100 bg-orange-50/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between text-orange-600">
                <Badge variant="orange">支出</Badge>
                <CircleDollarSign className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{currency.format(monthExpense)}</div>
              <p className="mt-2 text-sm text-slate-500">本月累计</p>
            </CardContent>
          </Card>

          <Card className="border-violet-100 bg-violet-50/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between text-violet-600">
                <Badge variant="purple">体重</Badge>
                <TrendingUp className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{latestWeight ? `${latestWeight.weight?.toFixed(1)} kg` : '--'}</div>
              <p className="mt-2 text-sm text-slate-500">{latestWeight ? `最近更新：${latestWeight.date}` : '暂无体重记录'}</p>
            </CardContent>
          </Card>

          <Card className="border-emerald-100 bg-emerald-50/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between text-emerald-600">
                <Badge variant="secondary">运动</Badge>
                <Dumbbell className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{weeklyMinutes} 分钟</div>
              <p className="mt-2 text-sm text-slate-500">近 7 天运动总时长</p>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>新增记录</CardTitle>
              <CardDescription>所有数据都保存在带用户隔离的 D1 数据库中。</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-5 flex flex-wrap gap-2">
                {(['expense', 'weight', 'exercise'] as RecordType[]).map((type) => (
                  <Button
                    key={type}
                    type="button"
                    variant={recordType === type ? 'default' : 'secondary'}
                    onClick={() => setRecordType(type)}
                    className="rounded-full"
                  >
                    {type === 'expense' ? '记账' : type === 'weight' ? '体重' : '运动'}
                  </Button>
                ))}
              </div>

              <form className="space-y-5" onSubmit={handleSave}>
                {renderMiniForm()}

                {error ? (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
                ) : null}

                <div className="flex justify-end">
                  <Button type="submit">
                    <Sparkles className="mr-2 h-4 w-4" />
                    保存记录
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>本月消费分布</CardTitle>
              <CardDescription>按分类统计并保护隐私</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {expenseBreakdown.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  本月还没有消费记录。
                </div>
              ) : (
                expenseBreakdown.map(([category, total], index) => {
                  const palette = ['bg-orange-400', 'bg-violet-400', 'bg-emerald-400', 'bg-sky-400', 'bg-amber-400']
                  const percent = monthExpense > 0 ? Math.round((total / monthExpense) * 100) : 0
                  return (
                    <div key={category} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${palette[index % palette.length]}`} />
                          <span className="font-medium text-slate-700">{category}</span>
                        </div>
                        <span className="text-slate-600">{currency.format(total)} · {percent}%</span>
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
        </section>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>最近记录</CardTitle>
                <CardDescription>每条数据都关联当前账户，做到用户隔离。</CardDescription>
              </div>
              <Badge variant="secondary" className="inline-flex items-center gap-2">
                <Wallet className="h-3.5 w-3.5" />
                {records.length} 条
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sortedRecords.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                  暂无记录，先添加一条吧。
                </div>
              ) : (
                sortedRecords.map((record) => {
                  const badgeMap = {
                    expense: '支',
                    income: '收',
                    weight: '体',
                    exercise: '运',
                  }

                  const valueText =
                    record.type === 'expense'
                      ? `- ${currency.format(record.amount ?? 0)}`
                      : record.type === 'income'
                        ? `+ ${currency.format(record.amount ?? 0)}`
                        : record.type === 'weight'
                          ? `${record.weight?.toFixed(1)} kg`
                          : `${record.duration ?? 0} 分钟`

                  const labelText =
                    record.type === 'expense'
                      ? `${record.category ?? '其他'} · ${record.note || '消费记录'}`
                      : record.type === 'income'
                        ? `${record.category ?? '其他'} · ${record.note || '收入记录'}`
                        : record.type === 'weight'
                          ? `${record.weight?.toFixed(1)} kg · ${record.note || '体重记录'}`
                          : `${record.exerciseType ?? '运动'} · ${record.duration ?? 0} 分钟`

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
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(record.id)}>
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

        <footer className="flex items-center justify-center gap-2 pb-4 text-sm text-slate-500">
          <LockKeyhole className="h-4 w-4" />
          通过安全会话和 D1 数据隔离保护你的隐私。
        </footer>
      </div>
    </div>
  )
}

export default App
