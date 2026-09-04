import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { MotionConfig } from 'motion/react'
import { Loader2 } from 'lucide-react'
import { LoginGate } from './components/login/LoginGate'
import { WordMapView } from './components/game/WordMapView'
import { WordLesson } from './components/game/WordLesson'
import { WordDone } from './components/game/WordDone'
import { SettingsPanel } from './components/game/SettingsPanel'
import { useToast } from './components/Toast'
import { WORDS, wordById } from './data/words'
import { emptyProgress, isValidWordProgress, settleWord, titleForStars } from './game/progress'
import { getSoundOn, setSoundOn } from './game/audio'
import { loadCombo, loadMaxCombo, nextCombo, saveCombo, saveMaxCombo, type AnswerKind } from './game/combo'
import { celebrate } from './game/confetti'
import { getRandomPraise } from './game/praise'
import type { SkillKey, UserSettings, WordProgress, WordUnit } from './types'

type Screen = 'boot' | 'login' | 'map' | 'lesson' | 'done'

type DoneInfo = {
  word: WordUnit
  stepReward: number // 本次会话(该词)累计技能步首过星尘
  wordBonus: number  // 本次会话触发的整词加成(0 或 20)
}

function defaultSettings(): UserSettings {
  const now = new Date().toISOString()
  return {
    enablePinyin: true, enableHanzi: true, enableEnglish: true,
    earnedAchievements: [], consecutiveDays: 0, lastActiveDate: '', updatedAt: now,
  }
}

function App() {
  const [screen, setScreen] = useState<Screen>('boot')
  const [progress, setProgress] = useState<Record<number, WordProgress>>({})
  const [settings, setSettings] = useState<UserSettings>(defaultSettings)
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [soundOn, setSound] = useState(() => getSoundOn())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [activeWord, setActiveWord] = useState<WordUnit | null>(null)
  const [lessonKey, setLessonKey] = useState(0)
  const [doneInfo, setDoneInfo] = useState<DoneInfo | null>(null)
  const progressRef = useRef(progress)
  const settingsRef = useRef(settings)
  const gainRef = useRef({ step: 0, bonus: 0 })
  const activeWordIdRef = useRef<number | null>(null)
  // 连击会话态:初值读 sessionStorage → 刷新保持;comboRef 防 handleAnswer 快速连答闭包旧值
  const [combo, setCombo] = useState(() => loadCombo())
  const comboRef = useRef(combo)
  const maxComboRef = useRef(loadMaxCombo())
  const { showToast } = useToast()

  progressRef.current = progress
  settingsRef.current = settings

  const totalStars = Object.values(progress).reduce((sum, p) => sum + p.starsEarned, 0)
  const title = titleForStars(totalStars)

  function syncProgress(next: Record<number, WordProgress>) {
    setProgress(next)
    progressRef.current = next
  }

  async function fetchAll() {
    const [pg, st] = await Promise.all([
      fetch('/api/progress', { credentials: 'include' }),
      fetch('/api/settings', { credentials: 'include' }),
    ])
    const map: Record<number, WordProgress> = {}
    if (pg.ok) {
      const body = (await pg.json().catch(() => null)) as { progress?: unknown[] } | null
      for (const raw of body?.progress ?? []) {
        if (isValidWordProgress(raw)) map[(raw as WordProgress).wordId] = raw as WordProgress
      }
    }
    syncProgress(map)
    if (st.ok) {
      const body = (await st.json().catch(() => null)) as { settings?: UserSettings } | null
      if (body?.settings) {
        const s = { ...defaultSettings(), ...body.settings }
        setSettings(s)
        settingsRef.current = s
      }
    }
  }

  useEffect(() => {
    const boot = async () => {
      try {
        const me = await fetch('/api/me', { credentials: 'include' })
        if (!me.ok) { setScreen('login'); return }
      } catch {
        setScreen('login')
        return
      }
      try { await fetchAll() } catch { /* 保留默认 */ }
      setScreen('map')
    }
    void boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const p = (await res.json().catch(() => ({ message: '登录失败' }))) as { message?: string; user?: unknown }
      if (!res.ok || !p.user) { setError(p.message ?? '登录失败'); return }
    } catch { setError('网络连接异常,请稍后重试'); return }
    setToken('')
    try { await fetchAll() } catch { /* ignore */ }
    setScreen('map')
  }

  async function logout() {
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }) } catch { /* ignore */ }
    syncProgress({})
    setActiveWord(null)
    setDoneInfo(null)
    setScreen('login')
  }

  async function resetProgress() {
    if (!window.confirm('确定要重置全部学习进度吗?此操作无法撤销。')) return
    try { await fetch('/api/progress', { method: 'DELETE', credentials: 'include' }) } catch { /* ignore */ }
    syncProgress({})
  }

  async function saveSettings(next: UserSettings) {
    setSettings(next)
    settingsRef.current = next
    try {
      await fetch('/api/settings', {
        method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: { enablePinyin: next.enablePinyin, enableHanzi: next.enableHanzi, enableEnglish: next.enableEnglish },
        }),
      })
    } catch { /* ignore */ }
  }

  /** 进入词:重置本词会话增益 */
  function startWord(id: number) {
    const w = wordById(id)
    if (!w) return
    gainRef.current = { step: 0, bonus: 0 }
    activeWordIdRef.current = id
    setActiveWord(w)
    setLessonKey((k) => k + 1)
    setScreen('lesson')
  }

  /** 一步(2 题)全过:立即结算该技能并即时 PUT 该词单行 */
  function handleStepPass(skill: SkillKey) {
    const id = activeWordIdRef.current
    if (id === null) return
    const prev = progressRef.current[id] ?? emptyProgress(id)
    const r = settleWord(id, prev, [{ skill, passed: true }], settingsRef.current)
    syncProgress({ ...progressRef.current, [id]: r.next })
    gainRef.current = {
      step: gainRef.current.step + r.stepReward,
      bonus: Math.max(gainRef.current.bonus, r.wordBonus),
    }
    void fetch('/api/progress', {
      method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progress: [r.next] }),
    }).catch(() => {})
    // 一步(2 题)全过:轻庆祝 + 夸奖 toast(每步一次,非每题)
    celebrate('step')
    showToast('success', getRandomPraise())
  }

  /** 每题作答 → 更新连击会话态(ref 防快速连答闭包旧值)并持久化 */
  function handleAnswer(kind: AnswerKind) {
    const n = nextCombo(comboRef.current, kind)
    comboRef.current = n
    saveCombo(n)
    setCombo(n)
    if (n > maxComboRef.current) {
      maxComboRef.current = n
      saveMaxCombo(n)
    }
  }

  /** 全部技能步完成 → 展示本词结算 */
  function handleLessonComplete() {
    const w = activeWord
    if (!w) return
    setDoneInfo({ word: w, stepReward: gainRef.current.step, wordBonus: gainRef.current.bonus })
    setScreen('done')
  }

  function exitToMap() {
    setActiveWord(null)
    setDoneInfo(null)
    setScreen('map')
  }

  function nextWord() {
    if (!activeWord) return
    const nextId = activeWord.id + 1
    if (nextId > WORDS.length) { exitToMap(); return }
    startWord(nextId)
  }

  let content: ReactNode
  if (screen === 'boot') {
    content = <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-ink-3" /></div>
  } else if (screen === 'login') {
    content = <LoginGate error={error} onTokenChange={setToken} onSubmit={(e) => void login(e)} />
  } else if (screen === 'lesson' && activeWord) {
    content = (
      <WordLesson
        key={lessonKey}
        word={activeWord}
        settings={settings}
        combo={combo}
        onAnswer={handleAnswer}
        onStepPass={handleStepPass}
        onLessonComplete={handleLessonComplete}
        onExit={exitToMap}
      />
    )
  } else if (screen === 'done' && doneInfo) {
    content = (
      <WordDone
        word={doneInfo.word}
        stepReward={doneInfo.stepReward}
        wordBonus={doneInfo.wordBonus}
        totalStars={totalStars}
        titleName={title.name}
        nextId={doneInfo.word.id + 1}
        isLastWord={doneInfo.word.id >= WORDS.length}
        onNext={nextWord}
        onMap={exitToMap}
      />
    )
  } else {
    content = (
      <>
        <WordMapView
          words={progress}
          totalStars={totalStars}
          settings={settings}
          soundOn={soundOn}
          onToggleSound={() => { setSoundOn(!soundOn); setSound(!soundOn) }}
          onPlay={startWord}
          onOpenSettings={() => setSettingsOpen(true)}
          onLogout={() => void logout()}
          onReset={() => void resetProgress()}
        />
        {settingsOpen ? (
          <SettingsPanel settings={settings} onChange={(s) => void saveSettings(s)} onClose={() => setSettingsOpen(false)} />
        ) : null}
      </>
    )
  }

  // ToastProvider 已上移到 main.tsx 包 <App/>(App 内 handleStepPass 亦需 useToast)
  return <MotionConfig reducedMotion="user">{content}</MotionConfig>
}

export default App
