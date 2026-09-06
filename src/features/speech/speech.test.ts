import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSpeechService } from './speech'

function voice(lang: string, name = lang): SpeechSynthesisVoice {
  return { lang, name } as SpeechSynthesisVoice
}

afterEach(() => {
  vi.useRealTimers()
})

describe('SpeechService', () => {
  it('selects the requested voice and preserves utterance settings on an idle start', () => {
    const cancel = vi.fn()
    const speak = vi.fn()
    const synthesis = {
      getVoices: () => [voice('en-GB'), voice('en-US')],
      speaking: false,
      cancel,
      speak,
    } as unknown as SpeechSynthesis
    const utterance = {} as SpeechSynthesisUtterance
    const service = createSpeechService(synthesis, () => utterance, { eventTarget: null })

    expect(service.speak('apple', 'en-US')).toBe(true)
    expect(utterance).toMatchObject({ voice: voice('en-US'), lang: 'en-US', rate: 0.9 })
    expect(speak).toHaveBeenCalledWith(utterance)
    // Idle engine: no pre-emptive cancel, so the phrase starts immediately (cold-start friendly).
    expect(cancel).not.toHaveBeenCalled()
  })

  it('prefers a base Mandarin voice and re-enumerates voices on every request', () => {
    const getVoices = vi.fn(() => [voice('cmn', 'Mandarin+variant'), voice('cmn', 'Mandarin')])
    const synthesis = {
      getVoices,
      speaking: false,
      cancel: vi.fn(),
      speak: vi.fn(),
    } as unknown as SpeechSynthesis
    const utterances: SpeechSynthesisUtterance[] = []
    const service = createSpeechService(
      synthesis,
      () => {
        const utterance = {} as SpeechSynthesisUtterance
        utterances.push(utterance)
        return utterance
      },
      { eventTarget: null },
    )

    expect(service.speak('苹果')).toBe(true)
    expect(service.speak('苹果')).toBe(true)
    // One prime at creation + one per request keeps the cached table fresh.
    expect(getVoices).toHaveBeenCalledTimes(3)
    expect(utterances.every(u => u.voice?.name === 'Mandarin')).toBe(true)
  })

  it('queues the latest request while voices are still loading, then plays once they arrive', () => {
    const cancel = vi.fn()
    const speak = vi.fn()
    let voices: SpeechSynthesisVoice[] = []
    let onVoicesChanged: (() => void) | undefined
    const synthesis = {
      getVoices: () => voices,
      addEventListener: (_type: string, listener: () => void) => {
        onVoicesChanged = listener
      },
      speaking: false,
      cancel,
      speak,
    } as unknown as SpeechSynthesis
    const utterances: SpeechSynthesisUtterance[] = []
    const service = createSpeechService(
      synthesis,
      () => {
        const utterance = {} as SpeechSynthesisUtterance
        utterances.push(utterance)
        return utterance
      },
      { eventTarget: null },
    )

    // Chrome-style: voices not loaded yet — the request is held, not silently dropped.
    expect(service.speak('苹果')).toBe(true)
    expect(speak).not.toHaveBeenCalled()

    voices = [voice('cmn', 'Mandarin')]
    onVoicesChanged?.() // primes silently, then flushes the held phrase
    expect(speak).toHaveBeenCalledTimes(2)
    expect(utterances[0]).toMatchObject({ volume: 0 }) // inaudible engine warm-up
    expect(utterances[1]).toMatchObject({ voice: voice('cmn', 'Mandarin'), rate: 0.9 })
  })

  it('deferring a replacement one tick after cancel protects the new utterance head', () => {
    vi.useFakeTimers()
    const cancel = vi.fn()
    const speak = vi.fn()
    const synthesis = {
      getVoices: () => [voice('en-US')],
      speaking: true, // a previous phrase is still playing
      cancel,
      speak,
    } as unknown as SpeechSynthesis
    const utterance = {} as SpeechSynthesisUtterance
    const service = createSpeechService(synthesis, () => utterance, { eventTarget: null })

    expect(service.speak('again', 'en-US')).toBe(true)
    expect(cancel).toHaveBeenCalledOnce() // stops the in-flight phrase
    expect(speak).not.toHaveBeenCalled() // not in the same tick as the cancel

    vi.advanceTimersByTime(50)
    expect(speak).toHaveBeenCalledWith(utterance)
  })

  it('falls back to the engine default voice when no matching voice is installed', () => {
    const speak = vi.fn()
    const synthesis = {
      getVoices: () => [voice('en-US')],
      speaking: false,
      cancel: vi.fn(),
      speak,
    } as unknown as SpeechSynthesis
    const utterance = {} as SpeechSynthesisUtterance
    const service = createSpeechService(synthesis, () => utterance, { eventTarget: null })

    expect(service.speak('苹果')).toBe(true)
    expect(speak).toHaveBeenCalledTimes(1)
    expect(utterance).toMatchObject({ lang: 'zh-cn', rate: 0.9 })
    expect(utterance.voice).toBeUndefined() // no explicit voice → engine default
  })

  it('silently falls back when synthesis/utterances are unavailable or no voice can ever arrive', () => {
    expect(createSpeechService(null, null, { eventTarget: null }).speak('苹果')).toBe(false)

    // Empty voices and no voiceschanged capability → nothing can ever be spoken.
    const noVoices = {
      getVoices: () => [],
      cancel: vi.fn(),
      speak: vi.fn(),
    } as unknown as SpeechSynthesis
    expect(createSpeechService(noVoices, () => ({} as SpeechSynthesisUtterance), { eventTarget: null }).speak('苹果')).toBe(false)
    expect(createSpeechService(noVoices, null, { eventTarget: null }).speak('苹果')).toBe(false)
  })

  it('primes the engine on the first user gesture when voices load only then', () => {
    const speak = vi.fn()
    const synthesis = {
      getVoices: () => [voice('cmn', 'Mandarin')],
      speaking: false,
      cancel: vi.fn(),
      speak,
    } as unknown as SpeechSynthesis
    const texts: string[] = []
    const spoken: SpeechSynthesisUtterance[] = []
    const factory = (text: string) => {
      const utterance = { text, volume: 1 } as SpeechSynthesisUtterance
      texts.push(text)
      spoken.push(utterance)
      return utterance
    }
    const listeners: Record<string, () => void> = {}
    const eventTarget = {
      addEventListener: (type: string, listener: () => void) => {
        listeners[type] = listener
      },
    } as unknown as Window

    const service = createSpeechService(synthesis, factory, { eventTarget })

    // Real audio sample at volume 0 (inaudible) warms Chrome; an empty utterance would be skipped.
    listeners.pointerdown()
    expect(speak).toHaveBeenCalledTimes(1)
    expect(texts).toEqual(['a'])
    expect(spoken[0].volume).toBe(0)

    listeners.pointerdown()
    listeners.keydown()
    expect(speak).toHaveBeenCalledTimes(1) // primed once, then guarded
    expect(service.speak('苹果')).toBe(true)
    expect(speak).toHaveBeenCalledTimes(2)
  })

  it('primes the engine automatically once voices arrive (no gesture needed)', () => {
    const speak = vi.fn()
    let voices: SpeechSynthesisVoice[] = []
    let onVoicesChanged: (() => void) | undefined
    const synthesis = {
      getVoices: () => voices,
      addEventListener: (_type: string, listener: () => void) => {
        onVoicesChanged = listener
      },
      speaking: false,
      cancel: vi.fn(),
      speak,
    } as unknown as SpeechSynthesis
    const texts: string[] = []
    const factory = (text: string) => {
      texts.push(text)
      return { text, volume: 1 } as SpeechSynthesisUtterance
    }

    createSpeechService(synthesis, factory, { eventTarget: null })
    expect(speak).not.toHaveBeenCalled()

    voices = [voice('cmn', 'Mandarin')]
    onVoicesChanged?.()
    expect(speak).toHaveBeenCalledTimes(1)
    expect(texts).toEqual(['a'])
  })

  it('stops current speech (and any pending/deferred phrase) without throwing when unavailable', () => {
    const cancel = vi.fn()
    const speak = vi.fn()
    const synthesis = { getVoices: () => [], cancel, speak } as unknown as SpeechSynthesis

    createSpeechService(synthesis, null, { eventTarget: null }).stop()
    expect(cancel).toHaveBeenCalledOnce()
    expect(() => createSpeechService(null, null, { eventTarget: null }).stop()).not.toThrow()
  })
})
