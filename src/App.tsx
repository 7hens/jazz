import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { MotionConfig } from 'motion/react'
import { Loader2 } from 'lucide-react'
import { LoginGate } from './features/auth/LoginGate'
import { WordMapView } from './components/game/WordMapView'
import { WordLesson } from './components/game/WordLesson'
import { WordDone } from './components/game/WordDone'
import { SettingsPanel } from './components/game/SettingsPanel'
import { AchievementPopup } from './components/game/AchievementPopup'
import { LuckyBonus } from './components/game/LuckyBonus'
import { useToast } from './features/toast'
import { WORDS, wordById } from './features/vocabulary'
import { emptyProgress, isValidWordProgress, settleWord, titleForStars } from './game/progress'
import { getSoundOn, setSoundOn } from './features/audio'
import {
  loadCombo, loadMaxCombo, nextCombo, comboBonus, saveCombo, saveMaxCombo, type AnswerKind,
} from './features/combo'
import { celebrate } from './features/celebrate'
import { getRandomPraise } from './game/praise'
import { rollLucky, nextConsecutive, todayKey } from './game/fun'
import { checkAchievements, type Achievement } from './game/achievements'
import { fullComplete } from './game/lesson'
import type { SkillKey, UserSettings, WordProgress, WordUnit } from './shared/types'

type Screen = 'boot' | 'login' | 'map' | 'lesson' | 'done'

type DoneInfo = {
  word: WordUnit
  stepReward: number // 本次会话(该词)累计技能步首过星尘
  wordBonus: number  // 本次会话触发的整词加成(0 或 20)
  extraReward: number // 连击池 + 幸运 + 成就 本词追加合计(仅首通词非 0)
  luckyReward: number
  achievements: Achievement[]
}

// 当前设置下已 fullComplete 的词数 / 分类数(供成就扫描,词已完成即可,不含需追加的星尘)
function fullWords(progress: Record<number, WordProgress>, settings: UserSettings): number {
  return WORDS.filter((w) => fullComplete(progress[w.id], settings)).length
}

function fullCategories(progress: Record<number, WordProgress>, settings: UserSettings): number {
  const byCat = new Map<string, WordUnit[]>()
  for (const w of WORDS) {
    const list = byCat.get(w.category) ?? []
    list.push(w)
    byCat.set(w.category, list)
  }
  let n = 0
  for (const items of byCat.values()) {
    if (items.every((w) => fullComplete(progress[w.id], settings))) n += 1
  }
  return n
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
  // 词会话:eligible 捕获于 startWord(当时未 fullComplete);首答对才累计加成池;任何非首答断 perfect
  const wordRunRef = useRef({ eligible: false, bonusPool: 0, perfect: true })
  const activeWordIdRef = useRef<number | null>(null)
  // 连击会话态:初值读 sessionStorage → 刷新保持;comboRef 防 handleAnswer 快速连答闭包旧值
  const [combo, setCombo] = useState(() => loadCombo())
  const comboRef = useRef(combo)
  const maxComboRef = useRef(loadMaxCombo())
  const runSeqRef = useRef(0) // 词会话单调序号:进入/离开词自增 → 结算 await 后可判别「已离词」放弃导航
  const sessionRef = useRef({ firstCompleteToday: 0, perfectWords: 0 })
  const [achQueue, setAchQueue] = useState<Achievement[]>([])
  const [luckyOn, setLuckyOn] = useState(false)
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
    // 清趣味会话态 + 趣味字段回默认(连击/最大连击/会话计数/词会话)
    saveCombo(0); saveMaxCombo(0)
    comboRef.current = 0; setCombo(0); maxComboRef.current = 0
    sessionRef.current = { firstCompleteToday: 0, perfectWords: 0 }
    runSeqRef.current += 1
    wordRunRef.current = { eligible: false, bonusPool: 0, perfect: true }
    await persistSettings({ ...settingsRef.current, earnedAchievements: [], consecutiveDays: 0, lastActiveDate: '' })
  }

  /** settings 全量整行持久化单点:三 enable + 趣味字段(earned/consecutive/lastActiveDate)整体 PUT。
   *  部分 PUT 会触发 worker 对缺省趣味字段落默认 → 清空成就/连续天数,故 body 恒带全字段。 */
  async function persistSettings(next: UserSettings) {
    setSettings(next)
    settingsRef.current = next
    try {
      await fetch('/api/settings', {
        method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            enablePinyin: next.enablePinyin, enableHanzi: next.enableHanzi, enableEnglish: next.enableEnglish,
            earnedAchievements: next.earnedAchievements, consecutiveDays: next.consecutiveDays,
            lastActiveDate: next.lastActiveDate,
          },
        }),
      })
    } catch { /* ignore */ }
  }
  // 家长设置面板沿用旧名(saveSettings 语义 = 全量持久化);SettingsPanel 的 onChange 调用点不变
  const saveSettings = persistSettings

  /** 进入词:重置本词会话增益;eligible = 该词在进入时尚未 fullComplete(当前 settings) */
  function startWord(id: number) {
    const w = wordById(id)
    if (!w) return
    runSeqRef.current += 1
    gainRef.current = { step: 0, bonus: 0 }
    const prev = progressRef.current[id] ?? emptyProgress(id)
    wordRunRef.current = { eligible: !fullComplete(prev, settingsRef.current), bonusPool: 0, perfect: true }
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

  /** 每题作答 → 更新连击会话态(ref 防快速连答闭包旧值)并持久化;eligible 词首答对累计加成池 */
  function handleAnswer(kind: AnswerKind) {
    const run = wordRunRef.current
    if (kind !== 'first') run.perfect = false
    const n = nextCombo(comboRef.current, kind)
    comboRef.current = n
    saveCombo(n)
    setCombo(n)
    if (n > maxComboRef.current) {
      maxComboRef.current = n
      saveMaxCombo(n)
    }
    if (kind === 'first' && run.eligible) {
      run.bonusPool += comboBonus(n)
    }
  }

  /** 全部技能步完成 → 异步结算:累计计数 → 推进学习日/连续天数 → 扫成就(扫描即发)→ 追加星尘补 PUT → 弹层 */
  async function handleLessonComplete() {
    const w = activeWord
    if (!w) return
    const run = wordRunRef.current
    const settings = settingsRef.current
    const seq = runSeqRef.current
    // progressRef 已在本词逐步 PUT 时推进到完成态(见 handleStepPass),不能用「当前行未完成」判首通;
    // eligible 捕获于 startWord(当时未 fullComplete),且本函数只在全部启用技能步 pass 后触发 ⇒ 本次首次 full。
    const rowNow = progressRef.current[w.id]
    const newlyComplete = run.eligible && !!rowNow && fullComplete(rowNow, settings)

    // —— 先累计计数(供扫描):perfect 任意完成(含重学完美)都算;firstCompleteToday 仅 eligible 首通 ——
    if (run.perfect) sessionRef.current.perfectWords += 1
    if (newlyComplete) sessionRef.current.firstCompleteToday += 1
    const today = todayKey()
    const s1 = { ...settings, lastActiveDate: today,
      consecutiveDays: nextConsecutive(settings.consecutiveDays, settings.lastActiveDate, today) }
    const fullCount = fullWords(progressRef.current, s1)
    const catDone = fullCategories(progressRef.current, s1)
    const newEarned = checkAchievements({
      completedWords: fullCount, categoryDone: catDone,
      maxCombo: maxComboRef.current,
      firstCompleteToday: sessionRef.current.firstCompleteToday,
      perfectWords: sessionRef.current.perfectWords,
      consecutiveDays: s1.consecutiveDays,
      hour: new Date().getHours(), totalWords: WORDS.length,
    }, s1.earnedAchievements)

    // —— 扫描即发(无挂起池):成就一次性(earned 持久集)→ 任何词完成(含重学)扫到的新成就 reward 即时并入本词行;
    //    连击池 bonusPool + 幸运 rollLucky 仅 eligible 首通累计/掷 ——
    let extra = 0
    let luckyReward = 0
    if (newlyComplete) {
      extra += run.bonusPool
      luckyReward = rollLucky()
      extra += luckyReward
    }
    extra += newEarned.reduce((sum, a) => sum + a.reward, 0)
    if (extra > 0) {
      const base = rowNow ?? emptyProgress(w.id)
      const bumped: WordProgress = { ...base, starsEarned: base.starsEarned + extra, updatedAt: new Date().toISOString() }
      syncProgress({ ...progressRef.current, [w.id]: bumped })
      // 单调补 PUT(追加更高值;worker MAX 幂等,与逐步 PUT 乱序到达亦安全;成就一次性,无刷星)
      void fetch('/api/progress', {
        method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress: [bumped] }),
      }).catch(() => {})
    }
    if (newEarned.length > 0) {
      s1.earnedAchievements = Array.from(new Set([...s1.earnedAchievements, ...newEarned.map((a) => a.id)]))
    }
    // 学习日/连续天数只要实际变化就落库(含重学首日);否则只在有实质推进时 persist
    const dayChanged = s1.lastActiveDate !== settings.lastActiveDate || s1.consecutiveDays !== settings.consecutiveDays
    if (newlyComplete || newEarned.length > 0 || dayChanged) await persistSettings(s1)
    // 结算期间已离词(退出→重进同一词也算,runSeq 单调递增)→ 放弃导航;词已完成,上述落库无害
    if (seq !== runSeqRef.current) return

    setDoneInfo({ word: w, stepReward: gainRef.current.step, wordBonus: gainRef.current.bonus,
      extraReward: extra, luckyReward, achievements: newEarned })
    if (newEarned.length > 0) setAchQueue(newEarned)
    else if (luckyReward > 0) setLuckyOn(true)
    // 本次真正推进(整词首通或新增技能步)才放 word 级撒花;重学已完词不重复放
    if (gainRef.current.bonus > 0 || gainRef.current.step > 0) celebrate('word')
    setScreen('done')
  }

  function exitToMap() {
    runSeqRef.current += 1
    setAchQueue([])
    setLuckyOn(false)
    setActiveWord(null)
    setDoneInfo(null)
    setScreen('map')
  }

  function nextWord() {
    if (!activeWord) return
    setAchQueue([])
    setLuckyOn(false)
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
        onLessonComplete={() => void handleLessonComplete()}
        onExit={exitToMap}
      />
    )
  } else if (screen === 'done' && doneInfo) {
    content = (
      <>
        <WordDone
          word={doneInfo.word}
          stepReward={doneInfo.stepReward}
          wordBonus={doneInfo.wordBonus}
          extraReward={doneInfo.extraReward}
          totalStars={totalStars}
          titleName={title.name}
          nextId={doneInfo.word.id + 1}
          isLastWord={doneInfo.word.id >= WORDS.length}
          onNext={nextWord}
          onMap={exitToMap}
        />
        {/* 成就串行弹出:每次取 list[0],onDone 出队;队列空且本词有幸运才开幸运层 */}
        {achQueue.length > 0 ? (
          <AchievementPopup
            list={achQueue}
            onDone={() => {
              const rest = achQueue.slice(1)
              setAchQueue(rest)
              if (rest.length === 0 && doneInfo.luckyReward > 0) setLuckyOn(true)
            }}
          />
        ) : luckyOn ? (
          <LuckyBonus amount={doneInfo.luckyReward} onDone={() => setLuckyOn(false)} />
        ) : null}
      </>
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
