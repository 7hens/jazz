import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { Dumbbell, Loader2, LockKeyhole, LogOut, Scale, ShieldCheck, Wallet } from 'lucide-react'
import { LoginCard } from './components/auth/LoginCard'
import { ExerciseTab } from './components/tabs/ExerciseTab'
import { FinanceTab } from './components/tabs/FinanceTab'
import { WeightTab } from './components/tabs/WeightTab'
import { Button } from './components/ui/button'
import type { LifeRecord, UserProfile } from './types'

type TabId = 'weight' | 'finance' | 'exercise'

const TABS: Array<{ id: TabId; label: string; title: string; subtitle: string; icon: ReactNode }> = [
  {
    id: 'weight',
    label: '体重',
    title: '体重',
    subtitle: '每周五记录一次，追踪变化趋势',
    icon: <Scale className="h-4 w-4" />,
  },
  {
    id: 'finance',
    label: '财务',
    title: '财务',
    subtitle: '收支分记，月度自动汇总',
    icon: <Wallet className="h-4 w-4" />,
  },
  {
    id: 'exercise',
    label: '运动',
    title: '运动',
    subtitle: '科学动作要领与建议',
    icon: <Dumbbell className="h-4 w-4" />,
  },
]

// 临界阻尼弹簧：tap 无回弹，页面/指示器平滑归位
const SPRING = { type: 'spring', bounce: 0, duration: 0.45 } as const

function App() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [records, setRecords] = useState<LifeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabId>('weight')
  const [error, setError] = useState('')
  const [token, setToken] = useState('')

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true)
      try {
        const meResponse = await fetch('/api/me', { credentials: 'include' })
        if (!meResponse.ok) {
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
        setUser(null)
      } finally {
        setLoading(false)
      }
    }
    void bootstrap()
  }, [])

  async function fetchRecords() {
    const response = await fetch('/api/records', { credentials: 'include' })
    if (!response.ok) throw new Error('无法获取记录')
    const payload = (await response.json()) as { records: LifeRecord[] }
    setRecords(payload.records)
    return payload.records
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
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
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    setUser(null)
    setRecords([])
  }

  async function saveRecord(payload: Record<string, string | number | undefined>): Promise<boolean> {
    const response = await fetch('/api/records', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = (await response.json().catch(() => ({ message: '保存失败' }))) as { message?: string }
    if (!response.ok) {
      setError(data.message ?? '保存失败')
      return false
    }
    setError('')
    await fetchRecords()
    return true
  }

  async function deleteRecord(recordId: string) {
    const response = await fetch(`/api/records?id=${recordId}`, { method: 'DELETE', credentials: 'include' })
    if (response.ok) {
      setRecords((current) => current.filter((record) => record.id !== recordId))
    } else {
      setError('删除失败')
    }
  }

  const activeTabMeta = TABS.find((tab) => tab.id === activeTab) ?? TABS[0]

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-ink-2">
        <div className="flex items-center gap-3 rounded-full border border-hairline bg-surface px-4 py-2 shadow-card">
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
          <span className="text-sm">正在检查会话…</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <LoginCard
        token={token}
        error={error}
        onTokenChange={setToken}
        onSubmit={handleLogin}
      />
    )
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen bg-canvas text-ink">
        <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(1200px_600px_at_50%_-120px,rgb(10_132_255/0.06),transparent)]" />

        <header className="glass-strong sticky top-0 z-40 border-b border-hairline">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 md:px-6">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.35)]">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <span className="text-[15px] font-semibold tracking-tight">生活记录</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="hidden items-center gap-2 rounded-full bg-surface-2 px-3 py-1.5 text-sm text-ink-2 sm:flex">
                <span className="h-2 w-2 rounded-full bg-emerald" />
                {user.name}
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="退出登录">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 pb-32 pt-6 md:px-6 md:pb-16 md:pt-10">
          {/* 桌面端分段控件 */}
          <div className="mb-10 hidden justify-center md:flex">
            <div className="glass-strong inline-flex items-center gap-1 rounded-full border border-hairline p-1 shadow-pop">
              {TABS.map((tab) => {
                const active = tab.id === activeTab
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.id)
                      setError('')
                    }}
                    className={`relative rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                      active ? 'text-white' : 'text-ink-2 hover:text-ink'
                    }`}
                  >
                    {active ? (
                      <motion.span
                        layoutId="tab-pill-desktop"
                        className="absolute inset-0 rounded-full bg-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.3)]"
                        transition={SPRING}
                      />
                    ) : null}
                    <span className="relative z-10 flex items-center gap-2">
                      {tab.icon}
                      {tab.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
            >
              <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
                    {activeTabMeta.title}
                  </h1>
                  <p className="mt-1 text-sm text-ink-2 md:text-base">{activeTabMeta.subtitle}</p>
                </div>
              </div>

              {activeTab === 'weight' ? (
                <WeightTab records={records} error={error} onSave={saveRecord} onDelete={deleteRecord} />
              ) : activeTab === 'finance' ? (
                <FinanceTab records={records} error={error} onSave={saveRecord} onDelete={deleteRecord} />
              ) : (
                <ExerciseTab />
              )}
            </motion.div>
          </AnimatePresence>

          <footer className="mt-14 flex items-center justify-center gap-2 text-sm text-ink-3">
            <LockKeyhole className="h-3.5 w-3.5" />
            通过安全会话和 D1 数据隔离保护你的隐私。
          </footer>
        </main>

        {/* 移动端底部 tab bar */}
        <nav className="fixed inset-x-4 bottom-4 z-40 md:hidden">
          <div className="glass-strong mx-auto flex max-w-md items-center justify-between rounded-full border border-hairline p-1.5 shadow-pop">
            {TABS.map((tab) => {
              const active = tab.id === activeTab
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id)
                    setError('')
                  }}
                  className="relative flex-1 rounded-full py-2"
                >
                  {active ? (
                    <motion.span
                      layoutId="tab-pill-mobile"
                      className="absolute inset-0 rounded-full bg-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.3)]"
                      transition={SPRING}
                    />
                  ) : null}
                  <span
                    className={`relative z-10 flex flex-col items-center gap-0.5 text-xs font-medium transition-colors ${
                      active ? 'text-white' : 'text-ink-2'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </span>
                </button>
              )
            })}
          </div>
        </nav>
      </div>
    </MotionConfig>
  )
}

export default App
