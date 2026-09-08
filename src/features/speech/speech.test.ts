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
    const service = createSpeechService(synthesis, () => utterance)

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
    )

    expect(service.speak('苹果')).toBe(true)
    expect(service.speak('苹果')).toBe(true)
    // One voice refresh at creation + one per request keeps the cached table fresh.
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
    )

    // Chrome-style: voices not loaded yet — the request is held, not silently dropped.
    expect(service.speak('苹果')).toBe(true)
    expect(speak).not.toHaveBeenCalled()

    voices = [voice('cmn', 'Mandarin')]
    onVoicesChanged?.() // flushes the held phrase — no engine warm-up utterance
    expect(speak).toHaveBeenCalledTimes(1)
    expect(utterances[0]).toMatchObject({ voice: voice('cmn', 'Mandarin'), rate: 0.9 })
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
    const service = createSpeechService(synthesis, () => utterance)

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
    const service = createSpeechService(synthesis, () => utterance)

    expect(service.speak('苹果')).toBe(true)
    expect(speak).toHaveBeenCalledTimes(1)
    expect(utterance).toMatchObject({ lang: 'zh-cn', rate: 0.9 })
    expect(utterance.voice).toBeUndefined() // no explicit voice → engine default
  })

  it('silently falls back when synthesis/utterances are unavailable or no voice can ever arrive', () => {
    expect(createSpeechService(null, null).speak('苹果')).toBe(false)

    // Empty voices and no voiceschanged capability → nothing can ever be spoken.
    const noVoices = {
      getVoices: () => [],
      cancel: vi.fn(),
      speak: vi.fn(),
    } as unknown as SpeechSynthesis
    expect(createSpeechService(noVoices, () => ({} as SpeechSynthesisUtterance)).speak('苹果')).toBe(false)
    expect(createSpeechService(noVoices, null).speak('苹果')).toBe(false)
  })

  it('stops current speech (and any pending/deferred phrase) without throwing when unavailable', () => {
    const cancel = vi.fn()
    const speak = vi.fn()
    const synthesis = { getVoices: () => [], cancel, speak } as unknown as SpeechSynthesis

    createSpeechService(synthesis, null).stop()
    expect(cancel).toHaveBeenCalledOnce()
    expect(() => createSpeechService(null, null).stop()).not.toThrow()
  })

  it('speakRole 按角色映射应用语速与音高', () => {
    const synthesis = {
      getVoices: () => [voice('cmn', 'Mandarin')],
      speaking: false,
      cancel: vi.fn(),
      speak: vi.fn(),
    } as unknown as SpeechSynthesis
    const utterances: SpeechSynthesisUtterance[] = []
    const service = createSpeechService(
      synthesis,
      () => {
        const u = {} as SpeechSynthesisUtterance
        utterances.push(u)
        return u
      },
    )

    expect(service.speakRole('早上好', 'jingmo')).toBe(true)
    expect(utterances[0]).toMatchObject({ rate: 0.6, pitch: 0.5, lang: 'cmn' })

    expect(service.speakRole('太棒了', 'lingling')).toBe(true)
    expect(utterances[1]).toMatchObject({ rate: 0.75, pitch: 1.2 })
  })

  it('speakRole opts 可覆盖角色默认语速/音高', () => {
    const synthesis = {
      getVoices: () => [voice('cmn', 'Mandarin')],
      speaking: false,
      cancel: vi.fn(),
      speak: vi.fn(),
    } as unknown as SpeechSynthesis
    const utterances: SpeechSynthesisUtterance[] = []
    const service = createSpeechService(
      synthesis,
      () => {
        const u = {} as SpeechSynthesisUtterance
        utterances.push(u)
        return u
      },
    )
    service.speakRole('太阳', 'sun', { rate: 1, pitch: 1.1 })
    expect(utterances[0]).toMatchObject({ rate: 1, pitch: 1.1 })
  })

  it('speakRole 无引擎时返回 false(UI 走降级)', () => {
    const service = createSpeechService(null, null)
    expect(service.speakRole('你好', 'lingling')).toBe(false)
  })

  it('speakRole 角色未匹配 voice 时并入队列,voice 就绪后带角色配置补播', () => {
    const cancel = vi.fn()
    let voices: SpeechSynthesisVoice[] = []
    const speak = vi.fn()
    let pendingVoices: (() => void) | undefined
    const synthesis = {
      getVoices: () => voices,
      speaking: false,
      cancel,
      speak,
      addEventListener: vi.fn((type: string, cb: () => void) => {
        if (type === 'voiceschanged') pendingVoices = cb
      }),
    } as unknown as SpeechSynthesis
    const utterances: SpeechSynthesisUtterance[] = []
    const service = createSpeechService(
      synthesis,
      () => {
        const u = {} as SpeechSynthesisUtterance
        utterances.push(u)
        return u
      },
    )

    expect(service.speakRole('月亮', 'moon')).toBe(true) // 无 voice → 入队
    voices = [voice('cmn', 'Mandarin')]
    pendingVoices?.()
    const last = utterances[utterances.length - 1]
    expect(last).toMatchObject({ rate: 0.7, pitch: 1 })
  })
})
