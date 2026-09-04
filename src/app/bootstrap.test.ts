import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { registry } from '@/shared/registry'
import { bootstrap } from './bootstrap'

beforeEach(() => registry.clear())
afterEach(() => vi.unstubAllGlobals())

it('registers every currently available service', () => {
  bootstrap()

  expect(registry.has('api')).toBe(true)
  expect(registry.has('auth')).toBe(true)
  expect(registry.has('progress')).toBe(true)
  expect(registry.has('question-engine')).toBe(true)
  expect(registry.has('settings-state')).toBe(true)
  expect(registry.has('vocabulary')).toBe(true)
})

it('preserves registered service instances when called again', () => {
  bootstrap()
  const first = {
    api: registry.get('api'),
    auth: registry.get('auth'),
    progress: registry.get('progress'),
    questionEngine: registry.get('question-engine'),
    settings: registry.get('settings-state'),
    vocabulary: registry.get('vocabulary'),
  }

  bootstrap()

  expect(registry.get('api')).toBe(first.api)
  expect(registry.get('auth')).toBe(first.auth)
  expect(registry.get('progress')).toBe(first.progress)
  expect(registry.get('question-engine')).toBe(first.questionEngine)
  expect(registry.get('settings-state')).toBe(first.settings)
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
