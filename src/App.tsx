import { useEffect, useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { LoginGate } from './components/login/LoginGate'
import { MapView } from './components/game/MapView'
import { emptyGameState } from './game/state'
import { getSoundOn, setSoundOn } from './game/audio'
import type { GameState } from './types'

type Screen = 'boot' | 'login' | 'map' | 'play' | 'result'

function App() {
  const [screen, setScreen] = useState<Screen>('boot')
  const [state, setState] = useState<GameState>(() => emptyGameState())
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [soundOn, setSound] = useState(() => getSoundOn())

  useEffect(() => {
    const boot = async () => {
      try {
        const me = await fetch('/api/me', { credentials: 'include' })
        if (!me.ok) {
          setScreen('login')
          return
        }
        const g = await fetch('/api/game', { credentials: 'include' })
        if (g.ok) {
          const { state: s } = (await g.json()) as { state: GameState | null }
          if (s) setState(s)
        }
        setScreen('map')
      } catch {
        setScreen('login')
      }
    }
    void boot()
  }, [])

  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    const p = (await res.json().catch(() => ({ message: '登录失败' }))) as { message?: string; user?: unknown }
    if (!res.ok || !p.user) {
      setError(p.message ?? '登录失败')
      return
    }
    setToken('')
    const g = await fetch('/api/game', { credentials: 'include' })
    if (g.ok) {
      const { state: s } = (await g.json()) as { state: GameState | null }
      if (s) setState(s)
    }
    setScreen('map')
  }

  async function save(next: GameState) {
    setState(next)
    await fetch('/api/game', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: next }),
    })
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    setState(emptyGameState())
    setError('')
    setScreen('login')
  }

  function resetProgress() {
    if (!window.confirm('确定要重置全部闯关进度吗?此操作无法撤销。')) return
    void save(emptyGameState())
  }

  if (screen === 'boot') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-ink-3" />
      </div>
    )
  }

  if (screen === 'login') {
    return <LoginGate error={error} onTokenChange={setToken} onSubmit={(e) => void login(e)} />
  }

  // play / result 本任务为骨架:暂以地图作兜底屏,Task 6 接线真实玩法与结算
  if (screen === 'map' || screen === 'play' || screen === 'result') {
    return (
      <MapView
        state={state}
        onPlay={() => {
          setScreen('play')
        }}
        onReset={resetProgress}
        onLogout={() => void logout()}
        soundOn={soundOn}
        onToggleSound={() => {
          setSoundOn(!soundOn)
          setSound(!soundOn)
        }}
      />
    )
  }

  return null
}

export default App
