import { describe, expect, it, vi } from 'vitest'
import { createSpeechService } from './speech'

function voice(lang: string, name = lang): SpeechSynthesisVoice {
  return { lang, name } as SpeechSynthesisVoice
}

describe('SpeechService', () => {
  it('selects the requested voice and preserves utterance settings', () => {
    const cancel = vi.fn()
    const speak = vi.fn()
    const synthesis = {
      getVoices: () => [voice('en-GB'), voice('en-US')],
      cancel,
      speak,
    } as unknown as SpeechSynthesis
    const utterance = {} as SpeechSynthesisUtterance
    const service = createSpeechService(synthesis, () => utterance)

    expect(service.speak('apple', 'en-US')).toBe(true)
    expect(utterance).toMatchObject({ voice: voice('en-US'), lang: 'en-US', rate: 0.9 })
    expect(cancel).toHaveBeenCalledOnce()
    expect(speak).toHaveBeenCalledWith(utterance)
  })

  it('prefers a base Mandarin voice and enumerates voices on every request', () => {
    const getVoices = vi.fn(() => [voice('cmn', 'Mandarin+variant'), voice('cmn', 'Mandarin')])
    const synthesis = { getVoices, cancel: vi.fn(), speak: vi.fn() } as unknown as SpeechSynthesis
    const utterances: SpeechSynthesisUtterance[] = []
    const service = createSpeechService(synthesis, () => {
      const utterance = {} as SpeechSynthesisUtterance
      utterances.push(utterance)
      return utterance
    })

    expect(service.speak('苹果')).toBe(true)
    expect(service.speak('苹果')).toBe(true)
    expect(getVoices).toHaveBeenCalledTimes(2)
    expect(utterances[0].voice?.name).toBe('Mandarin')
  })

  it('silently falls back when synthesis, utterances, or a matching voice are unavailable', () => {
    expect(createSpeechService(null, null).speak('苹果')).toBe(false)

    const noVoices = {
      getVoices: () => [],
      cancel: vi.fn(),
      speak: vi.fn(),
    } as unknown as SpeechSynthesis
    expect(createSpeechService(noVoices, () => ({} as SpeechSynthesisUtterance)).speak('苹果')).toBe(false)
    expect(createSpeechService(noVoices, null).speak('苹果')).toBe(false)
  })

  it('stops current speech without throwing when synthesis is unavailable', () => {
    const cancel = vi.fn()
    const synthesis = { getVoices: () => [], cancel, speak: vi.fn() } as unknown as SpeechSynthesis

    createSpeechService(synthesis, null).stop()
    expect(cancel).toHaveBeenCalledOnce()
    expect(() => createSpeechService(null, null).stop()).not.toThrow()
  })
})
