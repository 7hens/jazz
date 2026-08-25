import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Dumbbell, Loader2, LockKeyhole, LogOut, Scale, ShieldCheck, Wallet } from 'lucide-react'
import { LoginCard } from './components/auth/LoginCard'
import { ExerciseTab } from './components/tabs/ExerciseTab'
import { FinanceTab } from './components/tabs/FinanceTab'
import { WeightTab } from './components/tabs/WeightTab'
import { Button } from './components/ui/button'
import { todayIso } from './lib/date'
import type { LifeRecord, RecordType, UserProfile } from './types'

const DEV_USER = {
  id: 'dev-user-1',
  email: 'admin@life.local',
  name: '私密用户',
} as const

const DEV_STORAGE_KEY = 'jazz-life-tracker-dev-user'
const DEV_RECORDS_KEY = 'jazz-life-tracker-dev-records'

type TabId = 'weight' | 'finance' | 'exercise'

const TABS: Array<{ id: TabId; label: string; icon: ReactNode }> = [
  { id: 'weight', label: '体重', icon: <Scale className="h-4 w-4" /> },
  { id: 'finance', label: '财务', icon: <Wallet className="h-4 w-4" /> },
  { id: 'exercise', label: '运动', icon: <Dumbbell className="h-4 w-4" /> },
]

function getDevRecords(): LifeRecord[] {
  try {
    const raw = window.localStorage.getItem(DEV_RECORDS_KEY)
    if (!raw) {
      const seed: LifeRecord[] = [
        { id: 'seed-1', type: 'expense', date: '2026-08-20', amount: 68.5, category: '餐饮', note: '午餐和咖啡' },
        { id: 'seed-2', type: 'weight', date: '2026-08-22', weight: 68.4, note: '晨间空腹' },
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
  if (!storedUser) return { user: null, records: getDevRecords() }
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
  const [activeTab, setActiveTab] = useState<TabId>('weight')
  const [error, setError] = useState('')
  const [email, setEmail] = useState('admin@life.local')
  const [password, setPassword] = useState('ChangeMe123!')

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

  async function fetchRecords() {
    if (isLocalDevFallback()) {
      const devRecords = getDevRecords()
      setRecords(devRecords)
      return devRecords
    }
    const response = await fetch('/api/records', { credentials: 'include' })
    if (!response.ok) throw new Error('无法获取记录')
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
      const devUser = { ...DEV_USER, email: email.trim().toLowerCase() }
      window.localStorage.setItem(DEV_STORAGE_KEY, JSON.stringify(devUser))
      setUser(devUser)
      setRecords(getDevRecords())
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
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    setUser(null)
    setRecords([])
  }

  async function saveRecord(payload: Record<string, string | number | undefined>) {
    if (isLocalDevFallback()) {
      const type = String(payload.type) as RecordType
      const next = [...getDevRecords()]
      next.unshift({
        id: `dev-${Date.now()}`,
        type,
        date: String(payload.date ?? todayIso()),
        note: String(payload.note ?? ''),
        amount: type === 'expense' || type === 'income' ? Number(payload.amount ?? 0) : undefined,
        category: type === 'expense' || type === 'income' ? String(payload.category ?? '其他') : undefined,
        weight: type === 'weight' ? Number(payload.weight ?? 0) : undefined,
      })
      setDevRecords(next)
      setRecords(next)
      setError('')
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
    await fetchRecords()
  }

  async function deleteRecord(recordId: string) {
    if (isLocalDevFallback()) {
      const next = getDevRecords().filter((record) => record.id !== recordId)
      setDevRecords(next)
      setRecords(next)
      return
    }
    const response = await fetch(`/api/records?id=${recordId}`, { method: 'DELETE', credentials: 'include' })
    if (response.ok) {
      setRecords((current) => current.filter((record) => record.id !== recordId))
    }
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
      <LoginCard
        email={email}
        password={password}
        error={error}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onSubmit={handleLogin}
      />
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

        <nav className="flex gap-2">
          {TABS.map((tab) => (
            <Button
              key={tab.id}
              type="button"
              variant={activeTab === tab.id ? 'default' : 'secondary'}
              onClick={() => setActiveTab(tab.id)}
              className="rounded-full"
            >
              {tab.icon}
              <span className="ml-2">{tab.label}</span>
            </Button>
          ))}
        </nav>

        {activeTab === 'weight' ? (
          <WeightTab records={records} error={error} onSave={saveRecord} onDelete={deleteRecord} />
        ) : activeTab === 'finance' ? (
          <FinanceTab records={records} error={error} onSave={saveRecord} onDelete={deleteRecord} />
        ) : (
          <ExerciseTab />
        )}

        <footer className="flex items-center justify-center gap-2 pb-4 text-sm text-slate-500">
          <LockKeyhole className="h-4 w-4" />
          通过安全会话和 D1 数据隔离保护你的隐私。
        </footer>
      </div>
    </div>
  )
}

export default App
