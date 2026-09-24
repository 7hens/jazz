import type { AudioCue, AudioService } from '@/shared/services'

export const SOUND_KEY = 'jazz_sound_on'

type AudioUnlockTarget = Pick<Window, 'addEventListener'>

export type AudioServiceOptions = {
  storage?: Storage | null
  createContext?: (() => AudioContext) | null
  eventTarget?: AudioUnlockTarget | null
}

function browserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function browserContextFactory(): (() => AudioContext) | null {
  if (typeof window === 'undefined') return null
  const Context = window.AudioContext
    ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  return Context ? () => new Context() : null
}

function browserEventTarget(): AudioUnlockTarget | null {
  return typeof window === 'undefined' ? null : window
}

function readPreference(storage: Storage | null): boolean {
  try {
    return storage?.getItem(SOUND_KEY) !== '0'
  } catch {
    return true
  }
}

export function createAudioService(options: AudioServiceOptions = {}): AudioService {
  const storage = options.storage === undefined ? browserStorage() : options.storage
  const createContext = options.createContext === undefined ? browserContextFactory() : options.createContext
  const eventTarget = options.eventTarget === undefined ? browserEventTarget() : options.eventTarget
  let soundOn = readPreference(storage)
  let context: AudioContext | null = null
  let pendingResume: { context: AudioContext; promise: Promise<void> } | null = null
  const listeners = new Set<() => void>()

  function ensureContext(): AudioContext | null {
    if (!createContext) return null
    if (context && context.state !== 'running' && pendingResume?.context !== context) {
      void context.close().catch(() => undefined)
      context = null
    }
    context ??= createContext()
    return context
  }

  function tone(frequency: number, start: number, duration: number, type: OscillatorType = 'sine', volume = 0.3) {
    const current = ensureContext()
    if (!current) return

    const playNow = () => {
      const oscillator = current.createOscillator()
      const gain = current.createGain()
      oscillator.type = type
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0, current.currentTime + start)
      gain.gain.linearRampToValueAtTime(volume, current.currentTime + start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, current.currentTime + start + duration)
      oscillator.connect(gain).connect(current.destination)
      oscillator.start(current.currentTime + start)
      oscillator.stop(current.currentTime + start + duration + 0.05)
    }

    if (current.state === 'running') {
      playNow()
      return
    }
    if (pendingResume?.context !== current) {
      const resumed = current.resume()
      if (!resumed) {
        playNow()
        return
      }
      const promise = resumed.finally(() => {
        if (pendingResume?.promise === promise) pendingResume = null
      })
      pendingResume = { context: current, promise }
    }
    void pendingResume.promise.then(playNow).catch(() => undefined)
  }

  // 一音一表:每个 cue 一格,没有兜底分支。加 cue 而漏了这里 = `Record<AudioCue, …>`
  // 在编译期就报错 —— 这是把「静默播成 'tap'」那个洞从类型层堵死的那一半。
  const TONES: Record<AudioCue, () => void> = {
    correct: () => {
      tone(523, 0, 0.15)
      tone(659, 0.08, 0.18)
    },
    streak: () => {
      tone(523, 0, 0.1)
      tone(659, 0.07, 0.1)
      tone(784, 0.14, 0.2)
    },
    wrong: () => {
      tone(330, 0, 0.3, 'square', 0.22)
    },
    victory: () => {
      tone(523, 0, 0.15, 'sine', 0.3)
      tone(659, 0.12, 0.15, 'sine', 0.3)
      tone(784, 0.24, 0.15, 'sine', 0.3)
      tone(1046, 0.36, 0.4, 'sine', 0.3)
    },
    tap: () => {
      tone(440, 0, 0.08, 'triangle', 0.18)
    },
    // 成就:四音上行收在高位,比 victory 短、比 correct 亮 ——
    // 「又收了一枚」,不是「赢了」。
    achievement: () => {
      tone(659, 0, 0.12)
      tone(784, 0.1, 0.12)
      tone(988, 0.2, 0.12)
      tone(1319, 0.3, 0.3)
    },
    // 幸运:两声三角波,纯五度跳进(A5 → E6)。与成就那串正弦琶音在**音色**上就分得开。
    lucky: () => {
      tone(880, 0, 0.12, 'triangle', 0.26)
      tone(1320, 0.12, 0.28, 'triangle', 0.26)
    },
  }

  function play(cue: AudioCue) {
    if (!soundOn) return
    TONES[cue]()
  }

  const service: AudioService = {
    getSnapshot: () => soundOn,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    isOn: () => soundOn,
    setOn(on) {
      try {
        storage?.setItem(SOUND_KEY, on ? '1' : '0')
      } catch {
        // Storage can be unavailable in private browsing; the in-memory switch still works.
      }
      if (soundOn === on) return
      soundOn = on
      listeners.forEach(listener => listener())
    },
    play,
    unlock: ensureContext,
  }

  eventTarget?.addEventListener('pointerdown', service.unlock, { capture: true })
  eventTarget?.addEventListener('keydown', service.unlock, { capture: true })
  return service
}
