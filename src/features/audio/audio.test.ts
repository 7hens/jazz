import { describe, expect, it, vi } from 'vitest'
import { AUDIO_CUES } from '@/shared/services'
import { createAudioService, SOUND_KEY } from './audio'

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

function storage(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial))
  return {
    get length() { return values.size },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => [...values.keys()][index] ?? null,
    removeItem: key => { values.delete(key) },
    setItem: (key, value) => { values.set(key, value) },
  }
}

function runningContext() {
  const tones: Array<Record<string, unknown>> = []
  const context = {
    state: 'running',
    currentTime: 10,
    destination: {},
    close: vi.fn(async () => undefined),
    resume: vi.fn(async () => undefined),
    createOscillator: () => {
      const tone: Record<string, unknown> = { frequency: { value: 0 } }
      tones.push(tone)
      return Object.assign(tone, {
        type: 'sine',
        connect: vi.fn(() => ({ connect: vi.fn() })),
        start: vi.fn((at: number) => { tone.start = at }),
        stop: vi.fn((at: number) => { tone.stop = at }),
      })
    },
    createGain: () => ({
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(() => context.destination),
    }),
  }
  return { context, tones }
}

// 每个 cue 的**精确**频率 / 波形 / 起止时刻。逐值写死,因为「听起来对不对」是本文件
// 唯一能自动判的那部分;剩余(音量、音色好不好听)归人耳。
const TONE_CASES = [
  ['correct', [[523, 'sine', 10, 10.2], [659, 'sine', 10.08, 10.31]]],
  ['wrong', [[330, 'square', 10, 10.35]]],
  ['streak', [[523, 'sine', 10, 10.15], [659, 'sine', 10.07, 10.22], [784, 'sine', 10.14, 10.39]]],
  ['victory', [[523, 'sine', 10, 10.2], [659, 'sine', 10.12, 10.32], [784, 'sine', 10.24, 10.44], [1046, 'sine', 10.36, 10.81]]],
  ['tap', [[440, 'triangle', 10, 10.13]]],
  ['achievement', [[659, 'sine', 10, 10.17], [784, 'sine', 10.1, 10.27], [988, 'sine', 10.2, 10.37], [1319, 'sine', 10.3, 10.65]]],
  ['lucky', [[880, 'triangle', 10, 10.17], [1320, 'triangle', 10.12, 10.45]]],
] as const

describe('AudioService', () => {
  it('uses jazz_sound_on, defaults on, and publishes changed snapshots', () => {
    const store = storage()
    const service = createAudioService({ storage: store, createContext: null, eventTarget: null })
    const listener = vi.fn()
    service.subscribe(listener)

    expect(service.isOn()).toBe(true)
    service.setOn(false)

    expect(store.getItem(SOUND_KEY)).toBe('0')
    expect(service.getSnapshot()).toBe(false)
    expect(listener).toHaveBeenCalledOnce()
    service.setOn(true)
    expect(store.getItem(SOUND_KEY)).toBe('1')
  })

  it('restores an off preference and silently tolerates unavailable storage', () => {
    expect(createAudioService({ storage: storage({ jazz_sound_on: '0' }), createContext: null, eventTarget: null }).isOn()).toBe(false)
    const broken = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    } as unknown as Storage
    const service = createAudioService({ storage: broken, createContext: null, eventTarget: null })
    expect(service.isOn()).toBe(true)
    expect(() => service.setOn(false)).not.toThrow()
  })

  it.each(TONE_CASES)('preserves the %s sound frequencies and timing', (cue, expected) => {
    const { context, tones } = runningContext()
    const service = createAudioService({
      storage: storage(),
      createContext: () => context as unknown as AudioContext,
      eventTarget: null,
    })

    service.play(cue)

    expect(tones).toHaveLength(expected.length)
    expected.forEach(([frequency, type, start, stop], index) => {
      expect(tones[index]).toMatchObject({ frequency: { value: frequency }, type })
      expect(tones[index].start).toBeCloseTo(start)
      expect(tones[index].stop).toBeCloseTo(stop)
    })
  })

  // 这两条合起来才拦得住「加了一个 cue 而它响的是别的东西」:
  // 上面那张表是**手写的**,把 achievement 的期望值抄成 tap 的、实现也抄成 tap 的,
  // 逐个用例照样全绿 —— 所以还要断「每一格都各自不同」。
  it('音色表的覆盖面 === AUDIO_CUES(加 cue 必须同时给期望值)', () => {
    expect(TONE_CASES.map(([cue]) => cue)).toEqual([...AUDIO_CUES])
  })

  it('每一档响的都是自己那串音,没有两档共用同一串', () => {
    const { context, tones } = runningContext()
    const service = createAudioService({
      storage: storage(),
      createContext: () => context as unknown as AudioContext,
      eventTarget: null,
    })

    const shapes = AUDIO_CUES.map((cue) => {
      tones.length = 0
      service.play(cue)
      return JSON.stringify(tones.map(t => t.frequency))
    })

    const frequencies = shapes.map((shape, index) => `${AUDIO_CUES[index]}=${shape}`)
    expect(new Set(shapes).size, `有两个 cue 响的是同一串音 —— 孩子分不出它们是两件事:${frequencies.join(' | ')}`).toBe(AUDIO_CUES.length)
  })

  it('does not play while off, still unlocks, and tolerates a missing context factory', () => {
    const createContext = vi.fn(() => runningContext().context as unknown as AudioContext)
    const off = createAudioService({ storage: storage({ jazz_sound_on: '0' }), createContext, eventTarget: null })

    off.play('victory')
    off.unlock()
    expect(createContext).toHaveBeenCalledOnce()

    const silent = createAudioService({ storage: storage(), createContext: null, eventTarget: null })
    expect(() => silent.play('tap')).not.toThrow()
    expect(() => silent.unlock()).not.toThrow()
  })

  it('closes a suspended context and recreates it on the next unlock', () => {
    const suspended = runningContext().context
    suspended.state = 'suspended'
    const running = runningContext().context
    const createContext = vi.fn()
      .mockReturnValueOnce(suspended as unknown as AudioContext)
      .mockReturnValueOnce(running as unknown as AudioContext)
    const service = createAudioService({ storage: storage(), createContext, eventTarget: null })

    service.unlock()
    service.unlock()

    expect(suspended.close).toHaveBeenCalledOnce()
    expect(createContext).toHaveBeenCalledTimes(2)
  })

  it('keeps one suspended context alive while a multi-note cue waits for resume', async () => {
    const gate = deferred<undefined>()
    const { context, tones } = runningContext()
    context.state = 'suspended'
    context.resume.mockImplementation(() => gate.promise)
    const createContext = vi.fn(() => context as unknown as AudioContext)
    const service = createAudioService({ storage: storage(), createContext, eventTarget: null })

    service.play('correct')

    expect(tones).toHaveLength(0)
    expect(createContext).toHaveBeenCalledOnce()
    expect(context.close).not.toHaveBeenCalled()
    expect(context.resume).toHaveBeenCalledOnce()

    context.state = 'running'
    gate.resolve(undefined)
    await gate.promise

    await vi.waitFor(() => expect(tones).toHaveLength(2))
  })
})
