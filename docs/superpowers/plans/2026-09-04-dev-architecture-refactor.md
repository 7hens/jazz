# Frontend Architecture Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the frontend into strict `shared → features → app` layers while preserving every current user-visible behavior and retaining Worker + D1 as the only learning-data source.

**Architecture:** Typed service contracts live in `src/shared`, implementations and page Entry components live in isolated `src/features`, and `src/app` is the only composition root. Stateful services expose immutable snapshots and subscriptions; pure UI receives data and callbacks through props.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest 4, React Testing Library, Tailwind CSS 4, Cloudflare Workers, D1

**Spec:** `docs/superpowers/specs/2026-09-04-dev-architecture-refactor-design.md`

## Global Constraints

- Worker + D1 remain the only source of truth for progress and settings.
- Preserve `ADMIN_TOKEN`, HttpOnly Cookie, all `/api/*` contracts, D1 schema, migrations, UI, interactions, and business rules.
- Do not add IndexedDB, a runtime mock API, Redux, Zustand, or React Query.
- `src/features/<a>` must never import `src/features/<b>`.
- Feature code must not import `src/app`; shared code must not import feature or app code.
- Only feature Entry files and app composition hooks may call `useService`.
- `src/app/bootstrap.ts` is the only production service registration point.
- Root `worker/`, `migrations/`, and `wrangler.toml` retain their current locations and deployment semantics.
- Use constructor injection for service dependencies and injected RNG for random rules.
- Every task must leave `npm test`, `npm run lint`, and `npm run build` passing.

---

### Task 1: Development and test foundation

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tsconfig.app.json`
- Modify: `vite.config.ts`
- Modify: `vitest.config.ts`
- Create: `src/test-setup.ts`
- Create: `src/shared/import-alias.test.ts`

**Interfaces:**
- Produces: `@/*` resolving to `src/*` in TypeScript, Vite, and Vitest.
- Produces: `npm run dev:init` applying local D1 migrations before starting Vite.
- Produces: jsdom test environment with jest-dom matchers and automatic DOM cleanup.

- [ ] **Step 1: Add a failing alias test**

```ts
// src/shared/import-alias.test.ts
import { describe, expect, it } from 'vitest'
import { cn } from '@/lib/utils'

describe('@ alias', () => {
  it('resolves src modules', () => expect(cn('a', false && 'b')).toBe('a'))
})
```

- [ ] **Step 2: Run the test and verify the alias is unresolved**

Run: `npm test -- src/shared/import-alias.test.ts`  
Expected: FAIL with a resolution error for `@/lib/utils`.

- [ ] **Step 3: Install UI-test dependencies and configure aliases**

Run: `npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom`

Add to `tsconfig.app.json` compiler options:

```json
"baseUrl": ".",
"paths": { "@/*": ["src/*"] }
```

Add `resolve.alias` to `vite.config.ts`:

```ts
import { fileURLToPath, URL } from 'node:url'

resolve: {
  alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
},
```

Replace `vitest.config.ts` with:

```ts
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test-setup.ts'],
  },
})
```

Create setup:

```ts
// src/test-setup.ts
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(cleanup)
```

Add to `package.json` scripts:

```json
"dev:init": "npm run db:local && npm run dev"
```

- [ ] **Step 4: Verify foundation**

Run: `npm test -- src/shared/import-alias.test.ts && npm run lint && npm run build`  
Expected: all commands PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.app.json vite.config.ts vitest.config.ts src/test-setup.ts src/shared/import-alias.test.ts
git commit -m "test: establish architecture test foundation"
```

### Task 2: Typed service registry and reactive-store hook

**Files:**
- Create: `src/shared/services/keys.ts`
- Create: `src/shared/services/map.ts`
- Create: `src/shared/services/index.ts`
- Create: `src/shared/registry.ts`
- Create: `src/shared/registry.test.ts`
- Create: `src/shared/useService.ts`
- Create: `src/shared/useServiceSnapshot.ts`
- Create: `src/shared/useServiceSnapshot.test.tsx`

**Interfaces:**
- Produces: `ServiceKey`, initially `'api'` only and extended by later tasks.
- Produces: `registry.register<K>(key, service)`, `registry.get<K>(key)`, `registry.has(key)`, and `registry.clear()`.
- Produces: `ReactiveService<T> { getSnapshot(): T; subscribe(listener): () => void }`.
- Produces: `useService<K>(key): ServiceMap[K]` and `useServiceSnapshot<T>(service): T`.

- [ ] **Step 1: Write failing registry tests**

```ts
// src/shared/registry.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { registry } from './registry'

beforeEach(() => registry.clear())

describe('registry', () => {
  it('returns the registered instance', () => {
    const api = { me: async () => null }
    registry.register('api', api)
    expect(registry.get('api')).toBe(api)
  })

  it('throws for a missing service', () => {
    expect(() => registry.get('api')).toThrow('[registry] 服务未注册: api')
  })
})
```

- [ ] **Step 2: Run registry tests and verify failure**

Run: `npm test -- src/shared/registry.test.ts`  
Expected: FAIL because `registry.ts` does not exist.

- [ ] **Step 3: Implement typed registry and service map**

```ts
// src/shared/services/keys.ts
export const SERVICE_KEYS = { API: 'api' } as const
export type ServiceKey = (typeof SERVICE_KEYS)[keyof typeof SERVICE_KEYS]

// src/shared/services/map.ts
import type { ApiService } from './api'
export interface ServiceMap { api: ApiService }

// src/shared/registry.ts
import type { ServiceKey } from './services/keys'
import type { ServiceMap } from './services/map'

const services = new Map<ServiceKey, unknown>()
export const registry = {
  register<K extends ServiceKey>(key: K, service: ServiceMap[K]) { services.set(key, service) },
  get<K extends ServiceKey>(key: K): ServiceMap[K] {
    const service = services.get(key)
    if (!service) throw new Error(`[registry] 服务未注册: ${key}`)
    return service as ServiceMap[K]
  },
  has(key: ServiceKey) { return services.has(key) },
  clear() { services.clear() },
}
```

Define a temporary minimal `ApiService` in `src/shared/services/api.ts` with `me(): Promise<unknown>` so Task 2 compiles; Task 3 replaces it with the complete contract.

- [ ] **Step 4: Write and pass a reactive hook test**

```tsx
// src/shared/useServiceSnapshot.test.tsx
import { act, renderHook } from '@testing-library/react'
import { expect, it } from 'vitest'
import { useServiceSnapshot, type ReactiveService } from './useServiceSnapshot'

it('rerenders when a service snapshot changes', () => {
  let value = 0
  const listeners = new Set<() => void>()
  const service: ReactiveService<number> = {
    getSnapshot: () => value,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) },
  }
  const { result } = renderHook(() => useServiceSnapshot(service))
  act(() => { value = 1; listeners.forEach(listener => listener()) })
  expect(result.current).toBe(1)
})
```

Implement:

```ts
// src/shared/useServiceSnapshot.ts
import { useSyncExternalStore } from 'react'
export interface ReactiveService<T> {
  getSnapshot(): T
  subscribe(listener: () => void): () => void
}
export function useServiceSnapshot<T>(service: ReactiveService<T>): T {
  return useSyncExternalStore(service.subscribe, service.getSnapshot, service.getSnapshot)
}
```

Implement `useService` as `return registry.get(key)`; it must not subscribe to registry mutations.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- src/shared/registry.test.ts src/shared/useServiceSnapshot.test.tsx && npm run build`  
Expected: PASS.

```bash
git add src/shared
git commit -m "feat: add typed service registry"
```

### Task 3: HTTP API service

**Files:**
- Create: `src/shared/services/api.ts`
- Create: `src/shared/api-error.ts`
- Create: `src/features/api/api.ts`
- Create: `src/features/api/api.test.ts`
- Create: `src/features/api/index.ts`
- Modify: `src/shared/services/index.ts`

**Interfaces:**
- Consumes: existing types from `src/types.ts` until Task 7 relocates them.
- Produces: `ApiService` methods `me`, `login`, `logout`, `getProgress`, `putProgress`, `deleteProgress`, `getSettings`, and `putSettings`.
- Produces: `ApiError { status: number; message: string }`.
- Produces: `createHttpApiService(fetcher?: typeof fetch): ApiService`.

- [ ] **Step 1: Write failing transport tests**

```ts
// src/features/api/api.test.ts
import { describe, expect, it, vi } from 'vitest'
import { createHttpApiService } from './api'

describe('HTTP API service', () => {
  it('sends credentials for me', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ user: { id: 'u', email: 'e', name: 'n' } }), { status: 200 }))
    await createHttpApiService(fetcher).me()
    expect(fetcher).toHaveBeenCalledWith('/api/me', { credentials: 'include' })
  })

  it('normalizes JSON errors', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ message: '未授权' }), { status: 401 }))
    await expect(createHttpApiService(fetcher).me()).rejects.toMatchObject({ status: 401, message: '未授权' })
  })
})
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- src/features/api/api.test.ts`  
Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement exact API contract**

Define response types matching current Worker payloads and implement a private `request<T>(path, init)` that always adds `credentials: 'include'`, adds JSON content type for request bodies, parses JSON, and throws `ApiError` on non-2xx or malformed success data. Keep paths and payload keys identical to current `src/App.tsx`.

```ts
export interface ApiService {
  me(): Promise<User>
  login(token: string): Promise<User>
  logout(): Promise<void>
  getProgress(): Promise<WordProgress[]>
  putProgress(progress: WordProgress[]): Promise<void>
  deleteProgress(): Promise<void>
  getSettings(): Promise<UserSettings>
  putSettings(settings: UserSettings): Promise<void>
}
```

- [ ] **Step 4: Run focused and regression tests**

Run: `npm test -- src/features/api/api.test.ts && npm test && npm run build`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/services src/shared/api-error.ts src/features/api
git commit -m "feat: extract HTTP API service"
```

### Task 4: Authentication service and page feature

**Files:**
- Create: `src/shared/services/auth.ts`
- Create: `src/features/auth/auth.ts`
- Create: `src/features/auth/auth.test.ts`
- Create: `src/features/auth/AuthEntry.tsx`
- Create: `src/features/auth/AuthEntry.test.tsx`
- Move: `src/components/login/LoginGate.tsx` → `src/features/auth/LoginGate.tsx`
- Create: `src/features/auth/index.ts`
- Modify: `src/shared/services/keys.ts`
- Modify: `src/shared/services/map.ts`
- Modify: `src/shared/services/index.ts`

**Interfaces:**
- Consumes: `ApiService`, `ReactiveService<AuthSnapshot>`.
- Produces: `AuthSnapshot` with `checking | authenticated | anonymous | error`.
- Produces: `AuthService.check()`, `login(token)`, `logout()`, `markAnonymous()`.
- Produces: `createAuthService(api): AuthService` and `AuthEntry`.

- [ ] **Step 1: Write failing auth-state tests**

```ts
it('maps a 401 check to anonymous', async () => {
  const api = fakeApi({ me: async () => { throw new ApiError(401, '未授权') } })
  const auth = createAuthService(api)
  await auth.check()
  expect(auth.getSnapshot()).toEqual({ status: 'anonymous' })
})

it('exposes the authenticated user after login', async () => {
  const user = { id: 'u', email: 'e', name: 'n' }
  const auth = createAuthService(fakeApi({ login: async () => user }))
  await auth.login('secret')
  expect(auth.getSnapshot()).toEqual({ status: 'authenticated', user })
})
```

- [ ] **Step 2: Verify failure, then implement AuthService**

Run: `npm test -- src/features/auth/auth.test.ts`  
Expected before implementation: FAIL because auth service files do not exist.  
Implement immutable snapshots, listener notification after each state change, 401-to-anonymous mapping, and error snapshots for other failures.

- [ ] **Step 3: Add AuthEntry composition test**

Register a fake AuthService, render `AuthEntry`, submit a token, and assert `auth.login('secret')` is called once. Move LoginGate without changing its DOM, copy, or styling.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- src/features/auth && npm test && npm run build`  
Expected: PASS.

```bash
git add src/components/login src/shared/services src/features/auth
git commit -m "feat: extract authentication feature"
```

### Task 5: Reactive progress and settings services

**Files:**
- Create: `src/shared/load-state.ts`
- Create: `src/shared/services/progress.ts`
- Create: `src/shared/services/settings.ts`
- Create: `src/features/progress/progress.ts`
- Create: `src/features/progress/progress.test.ts`
- Create: `src/features/progress/index.ts`
- Create: `src/features/settings-state/settings.ts`
- Create: `src/features/settings-state/settings.test.ts`
- Create: `src/features/settings-state/index.ts`
- Modify: `src/shared/services/keys.ts`
- Modify: `src/shared/services/map.ts`
- Modify: `src/shared/services/index.ts`

**Interfaces:**
- Consumes: `ApiService`, existing `WordProgress`, `UserSettings`, and merge/validation functions.
- Produces: `LoadState<T>` from the spec.
- Produces: `ProgressService.load`, `saveStep`, `saveAll`, `resetAll`, `getSnapshot`, `subscribe`.
- Produces: `SettingsService.load`, `save`, `getSnapshot`, `subscribe`.
- Produces: injected `onUnauthorized()` and `onError(message)` callbacks.

- [ ] **Step 1: Write failing progress tests**

Cover these exact cases: `load()` transitions loading → ready; `saveStep()` publishes optimistic data; failed PUT restores the previous snapshot and calls `onError`; API 401 calls `onUnauthorized`; `resetAll()` restores local empty progress only after DELETE succeeds.

```ts
it('rolls back an optimistic save when PUT fails', async () => {
  const api = fakeApi({ putProgress: async () => { throw new Error('offline') } })
  const service = createProgressService(api, { onUnauthorized: vi.fn(), onError: vi.fn() })
  service.seed([emptyProgress(1)])
  await expect(service.saveStep(completedProgress(1))).rejects.toThrow('offline')
  expect(service.getSnapshot().data[1]).toEqual(emptyProgress(1))
})
```

- [ ] **Step 2: Run and verify failures**

Run: `npm test -- src/features/progress src/features/settings-state`  
Expected: FAIL because implementations do not exist.

- [ ] **Step 3: Implement minimal reactive stores**

Use a fresh frozen snapshot object for every mutation so `useSyncExternalStore` can detect changes. Capture the previous snapshot before optimistic writes. Do not swallow persistence errors after rollback.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- src/features/progress src/features/settings-state && npm test && npm run build`  
Expected: PASS.

```bash
git add src/shared/load-state.ts src/shared/services src/features/progress src/features/settings-state
git commit -m "feat: add reactive progress and settings services"
```

### Task 6: Bootstrap and app state shell

**Files:**
- Create: `src/app/bootstrap.ts`
- Create: `src/app/bootstrap.test.ts`
- Create: `src/app/useAppState.ts`
- Create: `src/app/useAppState.test.tsx`
- Create: `src/app/ErrorBoundary.tsx`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: factories from Tasks 3–5 and `registry`.
- Produces: idempotent `bootstrap(): void` registering services in dependency order.
- Produces: `AppPhase = 'boot' | 'login' | 'home' | 'lesson' | 'settings'` and navigation actions.

- [ ] **Step 1: Write failing app-state test**

```ts
it('enters and exits a lesson', () => {
  const { result } = renderHook(() => useAppState())
  act(() => result.current.actions.enterLesson(7))
  expect(result.current.phase).toBe('lesson')
  expect(result.current.currentWordId).toBe(7)
  act(() => result.current.actions.exitToHome())
  expect(result.current.phase).toBe('home')
})
```

- [ ] **Step 2: Implement state shell and bootstrap**

`bootstrap()` registers HTTP API first, then auth/progress/settings. Inject `auth.markAnonymous` as `onUnauthorized` and `() => undefined` as the temporary `onError`; these new services are not consumed by the still-current App in this task. Task 8 replaces the no-op with `toast.show('error', message)` before Task 12 switches App to the services.

Call `bootstrap()` once in `main.tsx` before `createRoot(...).render(...)`.

- [ ] **Step 3: Verify registration and state behavior**

Test that all current keys exist after bootstrap and a second call does not replace instances. Run: `npm test -- src/app && npm run build`  
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app src/main.tsx
git commit -m "feat: add application composition root"
```

### Task 7: Vocabulary and question-engine features

**Files:**
- Move: `src/types.ts` → `src/shared/types.ts`
- Move: `src/data/words.ts` → `src/features/vocabulary/words.ts`
- Move: `src/game/words.test.ts` → `src/features/vocabulary/words.test.ts`
- Create: `src/shared/services/vocabulary.ts`
- Create: `src/features/vocabulary/vocabulary.ts`
- Create: `src/features/vocabulary/index.ts`
- Move: `src/game/engine.ts` → `src/features/question-engine/engine.ts`
- Move: `src/game/engine.test.ts` → `src/features/question-engine/engine.test.ts`
- Create: `src/shared/services/question-engine.ts`
- Create: `src/features/question-engine/index.ts`
- Modify: all imports of `src/types.ts` and `src/data/words.ts`
- Modify: service keys/map and `src/app/bootstrap.ts`

**Interfaces:**
- Produces: `VocabularyService.getAllWords()` and `wordById(id)`.
- Produces: `QuestionEngineService.makeStepQuestions(word, skill, rng?)` and existing public engine helpers needed by lesson.

- [ ] **Step 1: Add service-factory tests before moving code**

```ts
it('finds a word by id', () => {
  const service = createVocabularyService()
  expect(service.wordById(1)?.id).toBe(1)
  expect(service.wordById(101)).toBeUndefined()
})
```

Add an engine test proving the factory uses its injected VocabularyService rather than importing `WORDS`.

- [ ] **Step 2: Run failing tests**

Run: `npm test -- src/features/vocabulary src/features/question-engine`  
Expected: FAIL because factories do not exist.

- [ ] **Step 3: Move code and inject vocabulary**

Preserve every existing engine test vector and RNG argument. Replace the engine's direct `WORDS` import with a constructor-captured `VocabularyService`. Update imports mechanically without changing data or rules.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- src/features/vocabulary src/features/question-engine && npm test && npm run build`  
Expected: PASS.

```bash
git add src/types.ts src/data src/game/engine.ts src/game/engine.test.ts src/game/words.test.ts src/shared src/features/vocabulary src/features/question-engine src/app/bootstrap.ts src
git commit -m "refactor: isolate vocabulary and question engine"
```

### Task 8: Device and feedback services

**Files:**
- Move: `src/game/tts.ts` → `src/features/speech/speech.ts`
- Move: `src/game/audio.ts`, `src/game/sfx.ts` → `src/features/audio/`
- Move: `src/game/confetti.ts` → `src/features/celebrate/celebrate.ts`
- Move: `src/components/Toast.tsx` → `src/features/toast/`
- Move: `src/game/combo.ts`, `src/game/storage.ts` → `src/features/combo/`
- Move: `src/game/combo.test.ts` → `src/features/combo/combo.test.ts`
- Create: shared service interfaces and feature `index.ts` files
- Modify: service keys/map and `src/app/bootstrap.ts`

**Interfaces:**
- Produces: `SpeechService.speak/stop`.
- Produces: reactive `AudioService` with `isOn/setOn/play/unlock`.
- Produces: `CelebrateService.play(level)`.
- Produces: reactive `ToastService.show/dismiss` and `ToastContainer`.
- Produces: reactive `ComboService.answer/reset/getBonus` retaining sessionStorage keys.

- [ ] **Step 1: Write behavior-preservation tests**

Use injected `Storage`, `speechSynthesis`, AudioContext factory, confetti function, and timers. Assert existing storage keys (`mgp_combo`, `mgp_max_combo`), combo bonus thresholds, silent browser fallbacks, and toast dismissal behavior remain unchanged.

- [ ] **Step 2: Run tests and verify new factories are missing**

Run: `npm test -- src/features/speech src/features/audio src/features/combo src/features/celebrate src/features/toast`  
Expected: FAIL before implementations are moved.

- [ ] **Step 3: Move implementations behind service interfaces**

Do not change sound timing, storage semantics, animation copy, or public behavior. Replace module globals with factory-owned state where a reactive snapshot is required.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- src/features/speech src/features/audio src/features/combo src/features/celebrate src/features/toast && npm test && npm run build`  
Expected: PASS.

```bash
git add src/game src/components/Toast.tsx src/shared/services src/features src/app/bootstrap.ts
git commit -m "refactor: isolate device and feedback services"
```

### Task 9: Lesson and quiz feature

**Files:**
- Move: `src/game/lesson.ts`, `src/game/lesson.test.ts`, `src/game/progress.ts`, `src/game/progress.test.ts`, `src/game/praise.ts` → `src/features/lesson/`
- Move: `src/components/game/WordLesson.tsx`, `WordDone.tsx`, `ComboDisplay.tsx`, and `quiz/` → `src/features/lesson/`
- Create: `src/features/lesson/LessonEntry.tsx`
- Create: `src/features/lesson/LessonEntry.test.tsx`
- Create: `src/features/lesson/settlement.ts`
- Create: `src/features/lesson/settlement.test.ts`
- Create: `src/features/lesson/index.ts`

**Interfaces:**
- Consumes only shared types and service interfaces.
- Produces: `LessonEntry({ wordId, onExit, onNextWord })`.
- Produces: pure `WordLesson` and `WordDone` components with props/callbacks only.
- Produces: settlement coordinator preserving current ordering.

- [ ] **Step 1: Write a failing Entry composition test**

Register fakes for every service consumed by LessonEntry, render word 1, and assert the first enabled skill is shown. Assert `WordLesson.tsx` contains no `useService` call.

- [ ] **Step 2: Write settlement-order tests**

Use spies for progress save, settings save, achievement scan, lucky roll, and overlay enqueue. Assert the exact order from spec section 7 and assert persistence finishes before navigation becomes available.

- [ ] **Step 3: Run and verify failures**

Run: `npm test -- src/features/lesson`  
Expected: FAIL because Entry and coordinator do not exist.

- [ ] **Step 4: Move current logic without changing rules**

Keep WordLesson's local answering state inside the component. Replace direct imports of question engine, combo, sound, speech, and confetti with Entry-provided values and callbacks. Preserve every existing lesson/progress/quiz test.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- src/features/lesson && npm test && npm run build`  
Expected: PASS.

```bash
git add src/game src/components/game src/shared src/features/lesson
git commit -m "refactor: isolate lesson workflow"
```

### Task 10: Achievement, lucky bonus, and LingLing features

**Files:**
- Move: `src/game/achievements.ts`, `achievements.test.ts` and `src/components/game/AchievementPopup.tsx` → `src/features/achievements/`
- Move: `LUCKY_RATE`, `LUCKY_AMOUNT`, and `rollLucky` from `src/game/fun.ts`, plus `src/components/game/LuckyBonus.tsx` → `src/features/lucky-bonus/`
- Move: `LingLingStage` and `lingLingStage` from `src/game/fun.ts`, plus `src/components/game/LingLing.tsx` → `src/features/lingling/`
- Split remaining `src/game/fun.test.ts` assertions into matching feature tests
- Create: shared service interfaces, feature factories, and public indexes
- Modify: service keys/map, bootstrap, and lesson composition

**Interfaces:**
- Produces: `AchievementService.scan(state, earned)` with current definitions.
- Produces: `LuckyBonusService.roll(rng?)` with current 10% rate and reward amount.
- Produces: pure `LingLing({ completedWords, totalWords })`.

- [ ] **Step 1: Add factory tests around existing rules**

Assert achievement scan remains monotonic, lucky roll boundary remains exactly the current `LUCKY_RATE`, and all five LingLing thresholds preserve current values and text.

- [ ] **Step 2: Run and verify failures**

Run: `npm test -- src/features/achievements src/features/lucky-bonus src/features/lingling`  
Expected: FAIL before factories and relocated modules exist.

- [ ] **Step 3: Relocate and wire through contracts**

Lesson consumes achievement and lucky services only through shared interfaces. App/Entry composes popup UI without feature-to-feature imports.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- src/features/achievements src/features/lucky-bonus src/features/lingling && npm test && npm run build`  
Expected: PASS.

```bash
git add src/game src/components/game src/shared/services src/features src/app/bootstrap.ts
git commit -m "refactor: isolate reward features"
```

### Task 11: Archipelago and settings pages

**Files:**
- Move: `src/components/game/WordMapView.tsx` → `src/features/archipelago/ArchipelagoView.tsx`
- Create: `src/features/archipelago/HomeEntry.tsx`
- Create: `src/features/archipelago/HomeEntry.test.tsx`
- Create: `src/features/archipelago/index.ts`
- Move: `src/components/game/SettingsPanel.tsx` → `src/features/settings/SettingsPanel.tsx`
- Create: `src/features/settings/SettingsEntry.tsx`
- Create: `src/features/settings/SettingsEntry.test.tsx`
- Create: `src/features/settings/index.ts`

**Interfaces:**
- Produces: `HomeEntry({ lingling, onEnterLesson, onOpenSettings, onLogout })`.
- Produces: `SettingsEntry({ onClose })`.
- Pure views receive all data and callbacks via props.

- [ ] **Step 1: Write failing Entry tests**

Home test: register progress/settings/audio services, render, click the first available word, and assert `onEnterLesson` receives its ID. Settings test: toggle a skill and assert SettingsService.save receives a state with at least one skill enabled; reset calls ProgressService.resetAll.

- [ ] **Step 2: Run and verify failures**

Run: `npm test -- src/features/archipelago src/features/settings`  
Expected: FAIL because Entry files do not exist.

- [ ] **Step 3: Move views and remove business imports**

Move completion, title, first-target, settings persistence, logout, reset, and audio behavior into Entry callbacks/services. Keep view markup, Tailwind classes, motion behavior, and copy unchanged.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- src/features/archipelago src/features/settings && npm test && npm run build`  
Expected: PASS.

```bash
git add src/components/game src/features/archipelago src/features/settings
git commit -m "refactor: extract page entries"
```

### Task 12: Replace the monolithic App

**Files:**
- Create: `src/app/App.tsx`
- Create: `src/app/App.test.tsx`
- Create: `src/app/useCompletedWords.ts`
- Modify: `src/main.tsx`
- Delete: `src/App.tsx`
- Delete: migrated empty directories under `src/components/`, `src/game/`, and `src/data/`

**Interfaces:**
- Consumes: AuthEntry, HomeEntry, LessonEntry, SettingsEntry, global overlays, service snapshots, and useAppState.
- Produces: default `App` with orchestration only.

- [ ] **Step 1: Write app routing tests**

Test boot → login on anonymous auth, boot → home after authenticated progress/settings load, home → lesson with selected ID, settings open/close, and 401 → login. Use registered fake services; do not mock feature implementation modules.

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- src/app/App.test.tsx`  
Expected: FAIL because the new App does not exist.

- [ ] **Step 3: Implement orchestration-only App**

Render Entry components from phase and snapshot state. Keep cross-feature overlays in app composition. Move any remaining business calculation into its owning feature or service before deleting old App. Update `main.tsx` to import `@/app/App`.

- [ ] **Step 4: Verify behavior and commit**

Run: `npm test -- src/app/App.test.tsx && npm test && npm run lint && npm run build`  
Expected: PASS with no imports from deleted paths.

```bash
git add src
git commit -m "refactor: replace monolithic application shell"
```

### Task 13: Enforce architecture boundaries

**Files:**
- Create: `src/architecture.test.ts`
- Modify: public `index.ts` files as violations reveal themselves
- Modify: `CLAUDE.md`
- Modify: `README.md`

**Interfaces:**
- Produces: automated import and composition-root enforcement.
- Produces: documentation of the new fact source and `dev:init` command.

- [ ] **Step 1: Write architecture assertions**

Implement a test that enumerates `.ts/.tsx` files under `src` and parses static import specifiers with a strict regex. Assert:

```ts
expect(featureToOtherFeatureImports).toEqual([])
expect(featureToAppImports).toEqual([])
expect(sharedToUpperLayerImports).toEqual([])
expect(nonEntryFeatureUseServiceCalls).toEqual([])
expect(registryRegisterCallsOutsideBootstrapAndTests).toEqual([])
```

Resolve both `@/` and relative paths before classifying imports. Ignore type-only versus value imports: both are forbidden across feature boundaries.

- [ ] **Step 2: Run the test and list every violation**

Run: `npm test -- src/architecture.test.ts`  
Expected: FAIL if any old cross-boundary import or registration remains; the failure message must list source file and imported target.

- [ ] **Step 3: Remove violations without adding adapters**

Move same-feature code together, introduce a shared service interface for real cross-feature behavior, or compose UI in app. Do not whitelist individual production files other than Entry useService and `app/bootstrap.ts` registration rules.

- [ ] **Step 4: Update architecture documentation**

Update `CLAUDE.md` and `README.md` to name the new `app/features/shared` fact source, retain root Worker+D1 rules, document `npm run dev:init`, and link the approved spec. Mark `docs/ideas/2026-09-04-dev-architecture.md` as superseded by the implemented spec rather than silently editing its historical proposal.

- [ ] **Step 5: Full verification**

Run:

```bash
npm test
npm run lint
npm run build
npm run db:local
```

Expected: all commands PASS; local migration output reports no pending migrations or applies only committed pending migrations successfully.

- [ ] **Step 6: Commit**

```bash
git add src/architecture.test.ts src CLAUDE.md README.md docs/ideas/2026-09-04-dev-architecture.md
git commit -m "chore: enforce frontend architecture boundaries"
```

### Task 14: Final behavior audit

**Files:**
- Modify only files implicated by a failing audit; do not perform opportunistic refactors.

**Interfaces:**
- Consumes: completed Tasks 1–13.
- Produces: evidence that the architectural refactor preserved behavior.

- [ ] **Step 1: Compare public behavior against the pre-refactor baseline**

Use the spec checklist and `git show 1abc9ae^:src/App.tsx` plus pre-refactor tests to verify every fetch path/payload, storage key, business constant, user-facing string, phase transition, and overlay ordering has a matching test or unchanged implementation.

- [ ] **Step 2: Run clean verification**

Run:

```bash
npm test
npm run lint
npm run build
npm run db:local
git status --short
```

Expected: tests/lint/build/migrations PASS. `git status` shows only changes intentionally made by the user before execution, if any.

- [ ] **Step 3: Resolve audit failures through the owning task**

If Step 1 or 2 finds a mismatch, do not patch it inside this audit task. Reopen the task that moved the affected behavior, add a regression test there, apply the minimal fix, rerun that task's focused command and the full verification suite, and amend that task before repeating this audit. If no mismatch exists, finish without an empty commit.
