import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { MotionConfig } from 'motion/react'
import { Loader2 } from 'lucide-react'
import { LoginGate } from './components/login/LoginGate'
import { MapView } from './components/game/MapView'
import { LevelPlay } from './components/game/LevelPlay'
import { LevelResult } from './components/game/LevelResult'
import { LEVELS } from './data/levels'
import { applyResult, emptyGameState, isValidGameState } from './game/state'
import { runLevel, type LevelOutcome, type LevelRun } from './game/scoring'
import { getSoundOn, setSoundOn } from './game/audio'
import type { GameState, Level } from './types'

type Screen = 'boot' | 'login' | 'map' | 'play' | 'result'

type ResultInfo = {
  levelId: number
  title: string
  outcome: LevelOutcome
  starDelta: number
  expDelta: number
  unlockedNew: boolean
}

function App() {
  const [screen, setScreen] = useState<Screen>('boot')
  const [state, setState] = useState<GameState>(() => emptyGameState())
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [soundOn, setSound] = useState(() => getSoundOn())
  const [activeLevel, setActiveLevel] = useState<Level | null>(null)
  const [result, setResult] = useState<ResultInfo | null>(null)
  const [playNonce, setPlayNonce] = useState(0)

  useEffect(() => {
    const boot = async () => {
      try {
        const me = await fetch('/api/me', { credentials: 'include' })
        if (!me.ok) {
          setScreen('login')
          return
        }
      } catch {
        // 无法确认会话;交由登录门重试(登录本身会校验 token)
        setError('网络连接异常,请重试')
        setScreen('login')
        return
      }
      await loadGame()
      setScreen('map')
    }
    void boot()
  }, [])

  /** 拉取进度;失败不阻断已登录用户进地图(保留内存中的默认/旧进度)。 */
  async function loadGame() {
    try {
      const g = await fetch('/api/game', { credentials: 'include' })
      if (g.ok) {
        const { state: s } = (await g.json()) as { state: unknown }
        // 服务端只保证 JSON 语法,不保证结构;残缺 blob 退回空档(下次通关 PUT 覆盖坏档)
        setState(isValidGameState(s) ? s : emptyGameState())
      }
    } catch {
      /* 忽略:不把已登录用户踢回登录 */
    }
  }

  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    try {
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
    } catch {
      setError('网络连接异常,请稍后重试')
      return
    }
    setToken('')
    await loadGame()
    setScreen('map')
  }

  async function save(next: GameState) {
    setState(next)
    try {
      await fetch('/api/game', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: next }),
      })
    } catch {
      // 网络失败:保留内存进度,不阻塞玩法/结算 UI
    }
  }

  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    } catch {
      /* 忽略登出请求失败,前端仍回登录门 */
    }
    setState(emptyGameState())
    setError('')
    setActiveLevel(null)
    setResult(null)
    setScreen('login')
  }

  function resetProgress() {
    if (!window.confirm('确定要重置全部闯关进度吗?此操作无法撤销。')) return
    void save(emptyGameState())
  }

  // ── play / result 接线 ────────────────────────────────
  function startLevel(id: number) {
    const lv = LEVELS.find((l) => l.id === id)
    if (!lv) return
    setActiveLevel(lv)
    setResult(null)
    setPlayNonce((n) => n + 1)
    setScreen('play')
  }

  function handleFinish(runs: LevelRun[]) {
    if (!activeLevel) return
    const outcome = runLevel(activeLevel, runs)
    const applied = applyResult(state, activeLevel.id, outcome)
    // 仅通关(≥1★)落库;失败不推进、不记录。
    if (outcome.stars >= 1) void save(applied.state)
    setResult({
      levelId: activeLevel.id,
      title: activeLevel.title,
      outcome,
      starDelta: applied.starDelta,
      expDelta: applied.expDelta,
      unlockedNew: applied.unlockedNew,
    })
    setScreen('result')
  }

  function exitToMap() {
    setResult(null)
    setScreen('map')
  }

  function replayLevel() {
    setPlayNonce((n) => n + 1)
    setScreen('play')
  }

  function nextLevel() {
    if (result) startLevel(result.levelId + 1)
  }

  // ── 屏内容 ────────────────────────────────────────────
  let content: ReactNode
  if (screen === 'boot') {
    content = (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-ink-3" />
      </div>
    )
  } else if (screen === 'login') {
    content = <LoginGate error={error} onTokenChange={setToken} onSubmit={(e) => void login(e)} />
  } else if (screen === 'play' && activeLevel) {
    content = <LevelPlay key={playNonce} level={activeLevel} onFinish={handleFinish} onExit={exitToMap} />
  } else if (screen === 'result' && result) {
    content = (
      <LevelResult
        levelId={result.levelId}
        title={result.title}
        outcome={result.outcome}
        starDelta={result.starDelta}
        expDelta={result.expDelta}
        unlockedNew={result.unlockedNew}
        onAgain={replayLevel}
        onMap={exitToMap}
        onNext={result.levelId < 10 ? nextLevel : undefined}
      />
    )
  } else {
    content = (
      <MapView
        state={state}
        onPlay={startLevel}
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

  return <MotionConfig reducedMotion="user">{content}</MotionConfig>
}

export default App
