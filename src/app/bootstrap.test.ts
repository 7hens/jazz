import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { registry } from '@/shared/registry'
import {
  AchievementService,
  ApiService,
  AudioService,
  AuthService,
  CelebrateService,
  ComboService,
  LuckyBonusService,
  ProgressService,
  QuestionEngineService,
  SettingsService,
  SpeechService,
  ToastService,
  VocabularyService,
} from '@/shared/services'
import type { ServiceToken } from '@/shared/services/token'
import { bootstrap } from './bootstrap'

const ALL_TOKENS: readonly ServiceToken<unknown>[] = [
  AchievementService,
  ApiService,
  AudioService,
  AuthService,
  CelebrateService,
  ComboService,
  LuckyBonusService,
  ProgressService,
  QuestionEngineService,
  SettingsService,
  SpeechService,
  ToastService,
  VocabularyService,
]

beforeEach(() => registry.clear())
afterEach(() => vi.unstubAllGlobals())

it('registers every currently available service', () => {
  bootstrap()

  for (const token of ALL_TOKENS) {
    expect(registry.has(token)).toBe(true)
  }
})

it('preserves registered service instances when called again', () => {
  bootstrap()
  const first = ALL_TOKENS.map((token) => [token, registry.get(token)] as const)

  bootstrap()

  for (const [token, instance] of first) {
    expect(registry.get(token)).toBe(instance)
  }
})

it('marks auth anonymous when a state service receives an unauthorized response', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(
    JSON.stringify({ message: 'Session expired' }),
    { status: 401, headers: { 'Content-Type': 'application/json' } },
  )))
  bootstrap()

  await registry.get(ProgressService).load()

  expect(registry.get(AuthService).getSnapshot()).toEqual({ status: 'anonymous' })
})

it('reports state service errors through the toast service', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(
    JSON.stringify({ message: 'Progress unavailable' }),
    { status: 503, headers: { 'Content-Type': 'application/json' } },
  )))
  bootstrap()

  await registry.get(ProgressService).load()

  expect(registry.get(ToastService).getSnapshot()).toEqual([
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
  await registry.get(ProgressService).load()

  expect(registry.get(ToastService).getSnapshot()).toEqual([
    { id: 1, type: 'error', message: 'Progress unavailable' },
  ])
})
