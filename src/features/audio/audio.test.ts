import { describe, expect, it, vi } from 'vitest'
import { createAudioService, SOUND_KEY } from './audio'

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

  it.each([
    ['correct', [[523, 'sine', 10, 10.2], [659, 'sine', 10.08, 10.31]]],
    ['streak', [[523, 'sine', 10, 10.15], [659, 'sine', 10.07, 10.22], [784, 'sine', 10.14, 10.39]]],
    ['wrong', [[330, 'square', 10, 10.35]]],
    ['victory', [[523, 'sine', 10, 10.2], [659, 'sine', 10.12, 10.32], [784, 'sine', 10.24, 10.44], [1046, 'sine', 10.36, 10.81]]],
    ['tap', [[440, 'triangle', 10, 10.13]]],
  ] as const)('preserves the %s sound frequencies and timing', (cue, expected) => {
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
})
