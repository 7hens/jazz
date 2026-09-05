import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { registry } from '@/shared/registry'
import { bootstrap } from './bootstrap'

beforeEach(() => registry.clear())
afterEach(() => vi.unstubAllGlobals())

it('registers every currently available service', () => {
  bootstrap()

  expect(registry.has('api')).toBe(true)
  expect(registry.has('audio')).toBe(true)
  expect(registry.has('auth')).toBe(true)
  expect(registry.has('celebrate')).toBe(true)
  expect(registry.has('combo')).toBe(true)
  expect(registry.has('progress')).toBe(true)
  expect(registry.has('question-engine')).toBe(true)
  expect(registry.has('settings-state')).toBe(true)
  expect(registry.has('speech')).toBe(true)
  expect(registry.has('toast')).toBe(true)
  expect(registry.has('vocabulary')).toBe(true)
})

it('preserves registered service instances when called again', () => {
  bootstrap()
  const first = {
    api: registry.get('api'),
    audio: registry.get('audio'),
    auth: registry.get('auth'),
    celebrate: registry.get('celebrate'),
    combo: registry.get('combo'),
    progress: registry.get('progress'),
    questionEngine: registry.get('question-engine'),
    settings: registry.get('settings-state'),
    speech: registry.get('speech'),
    toast: registry.get('toast'),
    vocabulary: registry.get('vocabulary'),
  }

  bootstrap()

  expect(registry.get('api')).toBe(first.api)
  expect(registry.get('audio')).toBe(first.audio)
  expect(registry.get('auth')).toBe(first.auth)
  expect(registry.get('celebrate')).toBe(first.celebrate)
  expect(registry.get('combo')).toBe(first.combo)
  expect(registry.get('progress')).toBe(first.progress)
  expect(registry.get('question-engine')).toBe(first.questionEngine)
  expect(registry.get('settings-state')).toBe(first.settings)
  expect(registry.get('speech')).toBe(first.speech)
  expect(registry.get('toast')).toBe(first.toast)
  expect(registry.get('vocabulary')).toBe(first.vocabulary)
})

it('marks auth anonymous when a state service receives an unauthorized response', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(
    JSON.stringify({ message: 'Session expired' }),
    { status: 401, headers: { 'Content-Type': 'application/json' } },
  )))
  bootstrap()

  await registry.get('progress').load()

  expect(registry.get('auth').getSnapshot()).toEqual({ status: 'anonymous' })
})

it('reports state service errors through the toast service', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(
    JSON.stringify({ message: 'Progress unavailable' }),
    { status: 503, headers: { 'Content-Type': 'application/json' } },
  )))
  bootstrap()

  await registry.get('progress').load()

  expect(registry.get('toast').getSnapshot()).toEqual([
    { id: 1, type: 'error', message: 'Progress unavailable' },
  ])
})

it('keeps bootstrap error reporting available without a DOM timer host', async () => {
  vi.stubGlobal('window', undefined)
  vi.stubGlobal('fetch', vi.fn(async () => new Response(
    JSON.stringify({ message: 'Progress unavailable' }),
    { status: 503, headers: { 'Content-Type': 'application/json' } },
  )))

  expect(() => bootstrap()).not.toThrow()
  await registry.get('progress').load()

  expect(registry.get('toast').getSnapshot()).toEqual([
    { id: 1, type: 'error', message: 'Progress unavailable' },
  ])
})
