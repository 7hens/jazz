# 趣味性系统 v2 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在一期词库学习闭环上纯增量加入趣味机制(P0 Toast/撒花/夸奖/连击/特效 + P1 灵灵/词间文案/隐藏成就/幸运奖励),不改变星尘只升不降经济、worker 保持哑读写。

**Architecture:** 纯逻辑层(`src/game/{combo,fun,achievements}.ts`,可单测、storage/时间可注入)承载连击、完美判定、成就扫描、幸运、连续天数;React 组件(App/WordLesson/WordDone/WordMapView + 新组件)负责接线与展示;worker 仅扩 settings 三列回显 + 整行 upsert。追加星尘一律并入 eligible 首通词行、走既有 `/api/progress` MAX 合并,服务端零业务改动。

**Tech Stack:** React 19 + TS + Vite + Tailwind 4 + motion;vitest(node env,`src/**/*.test.ts`);Cloudflare Workers + D1(migrations)。

**Spec:** [2026-09-04-fun-system-design.md](../specs/2026-09-04-fun-system-design.md)(本计划从 spec 论证;执行者两篇同读)

## Global Constraints

- 星尘铁律:总星尘 = Σ `progress.stars_earned`;追加星尘**仅 eligible 首通词**入行;已完成词重学 0 追加(夸奖/特效照给)。
- worker **不做业务逻辑**:settings 三新列只回显 + 整行 upsert;成就并集在客户端。
- 表结构变更 = 新增数字前缀迁移(`0002_fun.sql`),**不改** `0001_init.sql`;字段带 DEFAULT。
- 学习日一律**本地时** `YYYY-MM-DD`,禁用 `toISOString().slice(0,10)`。
- vitest = node env,**无 DOM**;新单测只测纯逻辑(storage/时间/rng 注入),sessionStorage 只经 `KeyValueStore` 接口访问。
- UI 文案中文;新增代码沿用一期简约风格(无路由/状态库)。改动先 `npm run lint`、`npm run build`,再 `npm run dev` 冒烟。
- 测试命令:`npx vitest run <file> --run`(跑单文件加 `-t <name>`);既有 `npm test` 全量须绿。
- commit 结尾加:`\n\nCo-Authored-By: Claude Code <noreply@anthropic.com>`。

---

### Task 1: 依赖 + settings 扩展列(迁移 + worker + 前端类型)

**Files:**
- Modify: `package.json`(经 `npm i`)
- Create: `migrations/0002_fun.sql`
- Modify: `worker/settings.ts`(整体替换内容)
- Modify: `src/types.ts:51-53`(UserSettings)
- Modify: `src/App.tsx:22-25`(defaultSettings)

**Interfaces:**
- Produces:`UserSettings` 增 `earnedAchievements: string[]`、`consecutiveDays: number`、`lastActiveDate: string`;worker GET 返回 camel 键同形、PUT 接受同形并整行 upsert;`0002_fun.sql` 已 apply 到本地 D1。

- [ ] **Step 1: 装依赖**

```bash
npm i canvas-confetti
npm i -D @types/canvas-confetti
```

- [ ] **Step 2: 写迁移并本地应用**

Create `migrations/0002_fun.sql`:

```sql
-- 趣味性系统:user_settings 扩展列(纯增量,不改 0001 基线)
ALTER TABLE user_settings ADD COLUMN earned_achievements TEXT    NOT NULL DEFAULT '[]';
ALTER TABLE user_settings ADD COLUMN consecutive_days    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN last_active_date     TEXT    NOT NULL DEFAULT '';
```

```bash
npm run db:local
```

- [ ] **Step 3: 扩前端类型 + 默认值**

`src/types.ts` — `UserSettings` 改为:

```ts
export type UserSettings = {
  enablePinyin: boolean; enableHanzi: boolean; enableEnglish: boolean
  earnedAchievements: string[]; consecutiveDays: number; lastActiveDate: string
  updatedAt: string
}
```

`src/App.tsx` `defaultSettings()` 改为(earned 用**数组**,非 JSON 串):

```ts
function defaultSettings(): UserSettings {
  const now = new Date().toISOString()
  return {
    enablePinyin: true, enableHanzi: true, enableEnglish: true,
    earnedAchievements: [], consecutiveDays: 0, lastActiveDate: '', updatedAt: now,
  }
}
```

- [ ] **Step 4: 重写 worker settings 整行读写**

Replace `worker/settings.ts` 全文:

```ts
import { getAuthenticatedUser } from './_lib/auth'
import { jsonResponse } from './_lib/http'
import type { Env } from './index'

const DEFAULT_FUN = { earned_achievements: '[]', consecutive_days: 0, last_active_date: '' }

type SettingsRow = {
  enable_pinyin: number; enable_hanzi: number; enable_english: number
  earned_achievements: string | null; consecutive_days: number | null; last_active_date: string | null
}

function parseEarned(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch { return [] }
}

function toEnabled(s: { enablePinyin?: unknown; enableHanzi?: unknown; enableEnglish?: unknown }) {
  const py = s.enablePinyin === true
  const hz = s.enableHanzi === true
  const en = s.enableEnglish === true
  if (!py && !hz && !en) return null
  return { py, hz, en }
}

export async function handleGetSettings(request: Request, env: Env): Promise<Response> {
  const user = await getAuthenticatedUser(request, env)
  if (!user) return jsonResponse({ message: '未授权' }, { status: 401 })
  const row = (await env.DB.prepare(
    `SELECT enable_pinyin, enable_hanzi, enable_english, earned_achievements, consecutive_days, last_active_date
     FROM user_settings WHERE user_id = ?`,
  ).bind(user.id).first<SettingsRow>())
  if (!row) {
    return jsonResponse({
      settings: { enablePinyin: true, enableHanzi: true, enableEnglish: true,
        earnedAchievements: [], consecutiveDays: 0, lastActiveDate: '' },
    })
  }
  return jsonResponse({
    settings: {
      enablePinyin: row.enable_pinyin === 1,
      enableHanzi: row.enable_hanzi === 1,
      enableEnglish: row.enable_english === 1,
      earnedAchievements: parseEarned(row.earned_achievements),
      consecutiveDays: row.consecutive_days ?? 0,
      lastActiveDate: row.last_active_date ?? '',
    },
  })
}

export async function handlePutSettings(request: Request, env: Env): Promise<Response> {
  const user = await getAuthenticatedUser(request, env)
  if (!user) return jsonResponse({ message: '未授权' }, { status: 401 })
  const body = (await request.json().catch(() => null)) as {
    settings?: { enablePinyin?: unknown; enableHanzi?: unknown; enableEnglish?: unknown;
      earnedAchievements?: unknown; consecutiveDays?: unknown; lastActiveDate?: unknown }
  } | null
  const s = body?.settings
  if (!s) return jsonResponse({ message: '设置不合法' }, { status: 400 })
  const en = toEnabled(s)
  if (!en) return jsonResponse({ message: '至少保留一个学习模块' }, { status: 400 })
  const earned = Array.isArray(s.earnedAchievements)
    ? s.earnedAchievements.filter((x): x is string => typeof x === 'string')
    : []
  const consecutive = typeof s.consecutiveDays === 'number' && Number.isFinite(s.consecutiveDays)
    ? Math.max(0, Math.floor(s.consecutiveDays))
    : 0
  const lastDate = typeof s.lastActiveDate === 'string' ? s.lastActiveDate.slice(0, 10) : ''
  await env.DB.prepare(
    `INSERT INTO user_settings
       (user_id, enable_pinyin, enable_hanzi, enable_english, earned_achievements, consecutive_days, last_active_date, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       enable_pinyin=excluded.enable_pinyin, enable_hanzi=excluded.enable_hanzi,
       enable_english=excluded.enable_english,
       earned_achievements=excluded.earned_achievements, consecutive_days=excluded.consecutive_days,
       last_active_date=excluded.last_active_date, updated_at=excluded.updated_at`,
  ).bind(user.id, en.py ? 1 : 0, en.hz ? 1 : 0, en.en ? 1 : 0,
    JSON.stringify(earned), consecutive, lastDate, new Date().toISOString()).run()
  return jsonResponse({ ok: true })
}
```

- [ ] **Step 5: 类型/构建通过**

```bash
npx tsc -b && npm run lint
```

Expected: 无错误(oxlint 现有 warning 可忽略)。

- [ ] **Step 6: Commit**

```bash
git add migrations/0002_fun.sql worker/settings.ts src/types.ts src/App.tsx package.json package-lock.json
git commit -m "feat(fun): settings 扩展趣味列(迁移+worker 整行回显/upsert)
Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: storage + combo 纯逻辑(可注入 store,单测)

**Files:**
- Create: `src/game/storage.ts`
- Create: `src/game/combo.ts`
- Test: `src/game/combo.test.ts`

**Interfaces:**
- Consumes: Task 1 `UserSettings` 无关;本任务独立。
- Produces:
  - `src/game/storage.ts`:`export interface KeyValueStore { get(k: string): string | null; set(k: string, v: string): void }`、`export const sessionStore: KeyValueStore`
  - `src/game/combo.ts`:
    - `export type AnswerKind = 'first' | 'retry' | 'wrong'`(`first`=首答对;`retry`=二答对;`wrong`=答错/整步重做)
    - `export function nextCombo(combo: number, kind: AnswerKind): number`(first→combo+1;retry/wrong→0)
    - `export function comboBonus(combo: number): number`(= `Math.min(combo * 5, 50)`)
    - `export const COMBO_KEY = 'mgp_combo'`、`export const MAX_COMBO_KEY = 'mgp_max_combo'`
    - `export function loadCombo(store: KeyValueStore = sessionStore): number`
    - `export function saveCombo(v: number, store: KeyValueStore = sessionStore): void`
    - `export function loadMaxCombo(store: KeyValueStore = sessionStore): number`
    - `export function saveMaxCombo(v: number, store: KeyValueStore = sessionStore): void`

- [ ] **Step 1: 写失败测试**

Create `src/game/combo.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { KeyValueStore } from './storage'
import { comboBonus, loadCombo, loadMaxCombo, nextCombo, saveCombo, saveMaxCombo } from './combo'

function fakeStore(): KeyValueStore {
  const m = new Map<string, string>()
  return { get: (k) => m.get(k) ?? null, set: (k, v) => { m.set(k, v) } }
}

describe('combo 纯逻辑', () => {
  it('nextCombo:首答对 +1,重试对/错归零', () => {
    expect(nextCombo(3, 'first')).toBe(4)
    expect(nextCombo(3, 'retry')).toBe(0)
    expect(nextCombo(3, 'wrong')).toBe(0)
    expect(nextCombo(0, 'first')).toBe(1)
  })
  it('comboBonus 封顶 50', () => {
    expect(comboBonus(1)).toBe(5)
    expect(comboBonus(10)).toBe(50)
    expect(comboBonus(20)).toBe(50)
  })
  it('存取走注入 store(默认空=0)', () => {
    const st = fakeStore()
    expect(loadCombo(st)).toBe(0)
    saveCombo(7, st)
    expect(loadCombo(st)).toBe(7)
    saveMaxCombo(12, st)
    expect(loadMaxCombo(st)).toBe(12)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
npx vitest run src/game/combo.test.ts
```

Expected: FAIL(模块不存在)。

- [ ] **Step 3: 写实现**

Create `src/game/storage.ts`:

```ts
export interface KeyValueStore {
  get(key: string): string | null
  set(key: string, value: string): void
}

export const sessionStore: KeyValueStore = {
  get: (k) => { try { return sessionStorage.getItem(k) } catch { return null } },
  set: (k, v) => { try { sessionStorage.setItem(k, v) } catch { /* 隐私模式忽略 */ } },
}
```

Create `src/game/combo.ts`:

```ts
import { sessionStore, type KeyValueStore } from './storage'

export type AnswerKind = 'first' | 'retry' | 'wrong'

export const COMBO_KEY = 'mgp_combo'
export const MAX_COMBO_KEY = 'mgp_max_combo'

export function nextCombo(combo: number, kind: AnswerKind): number {
  return kind === 'first' ? combo + 1 : 0
}

export function comboBonus(combo: number): number {
  return Math.min(combo * 5, 50)
}

export function loadCombo(store: KeyValueStore = sessionStore): number {
  const n = Number(store.get(COMBO_KEY) ?? '0')
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
}

export function saveCombo(v: number, store: KeyValueStore = sessionStore): void {
  store.set(COMBO_KEY, String(Math.max(0, Math.floor(v))))
}

export function loadMaxCombo(store: KeyValueStore = sessionStore): number {
  const n = Number(store.get(MAX_COMBO_KEY) ?? '0')
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
}

export function saveMaxCombo(v: number, store: KeyValueStore = sessionStore): void {
  store.set(MAX_COMBO_KEY, String(Math.max(0, Math.floor(v))))
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
npx vitest run src/game/combo.test.ts
```

Expected: PASS(3 tests)。

- [ ] **Step 5: Commit**

```bash
git add src/game/storage.ts src/game/combo.ts src/game/combo.test.ts
git commit -m "feat(fun): combo 纯逻辑(storage 可注入)+ 单测
Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: fun 工具(本地日/幸运/连续天数/灵灵档),单测

**Files:**
- Create: `src/game/fun.ts`
- Test: `src/game/fun.test.ts`

**Interfaces:**
- Consumes: 无(Task 2 无关)。
- Produces(`src/game/fun.ts`):
  - `export const LUCKY_RATE = 0.1`、`export const LUCKY_AMOUNT = 50`
  - `export function todayKey(now: Date = new Date()): string`(本地 `YYYY-MM-DD`)
  - `export function shiftDate(dateStr: string, delta: number): string`(`'2026-09-04'`±n 天,本地)
  - `export function nextConsecutive(prev: number, lastDate: string, today: string): number`
    - `lastDate === ''` 或非昨日 → `1`;`lastDate === today` → `prev`(防同日重写);`lastDate === 昨日` → `prev + 1`
  - `export function rollLucky(rng: () => number = Math.random): number`(`rng() < 0.1 ? 50 : 0`)
  - `export type LingLingStage = 0 | 1 | 2 | 3 | 4`
  - `export function lingLingStage(completedWords: number, totalWords = 100): LingLingStage`(完成比例分档:<0.1→0,<0.3→1,<0.5→2,<0.8→3,否则 4)

- [ ] **Step 1: 写失败测试**

Create `src/game/fun.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  lingLingStage, LUCKY_AMOUNT, LUCKY_RATE, nextConsecutive, rollLucky, shiftDate, todayKey,
} from './fun'

describe('fun 本地日与连续天数', () => {
  it('todayKey 本地 YYYY-MM-DD', () => {
    expect(todayKey(new Date(2026, 8, 4, 23, 30))).toBe('2026-09-04')
    expect(todayKey(new Date(2026, 0, 1))).toBe('2026-01-01')
  })
  it('shiftDate 跨月/跨年', () => {
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftDate('2026-01-01', -1)).toBe('2025-12-31')
    expect(shiftDate('2026-09-04', 1)).toBe('2026-09-05')
  })
  it('nextConsecutive:首日=1,昨日+1,同日不变,断档重置', () => {
    expect(nextConsecutive(0, '', '2026-09-04')).toBe(1)
    expect(nextConsecutive(3, '2026-09-03', '2026-09-04')).toBe(4)
    expect(nextConsecutive(4, '2026-09-04', '2026-09-04')).toBe(4)
    expect(nextConsecutive(5, '2026-09-01', '2026-09-04')).toBe(1)
  })
})

describe('fun 幸运', () => {
  it('rollLucky 10%→50,否则 0', () => {
    expect(LUCKY_RATE).toBe(0.1)
    expect(LUCKY_AMOUNT).toBe(50)
    expect(rollLucky(() => 0.05)).toBe(50)
    expect(rollLucky(() => 0.5)).toBe(0)
  })
})

describe('fun 灵灵档位', () => {
  it('分档阈值', () => {
    expect(lingLingStage(0)).toBe(0)
    expect(lingLingStage(9)).toBe(0)
    expect(lingLingStage(10)).toBe(1)
    expect(lingLingStage(30)).toBe(2)
    expect(lingLingStage(50)).toBe(3)
    expect(lingLingStage(80)).toBe(4)
    expect(lingLingStage(100)).toBe(4)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
npx vitest run src/game/fun.test.ts
```

Expected: FAIL(模块不存在)。

- [ ] **Step 3: 写实现**

Create `src/game/fun.ts`:

```ts
// 趣味系统纯工具:本地日 / 连续天数 / 幸运 / 灵灵档位。时间与 rng 可注入便于单测。

export const LUCKY_RATE = 0.1
export const LUCKY_AMOUNT = 50

const pad = (n: number) => String(n).padStart(2, '0')

export function todayKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function shiftDate(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, (m ?? 1) - 1, (d ?? 1) + delta)
  return todayKey(dt)
}

export function nextConsecutive(prev: number, lastDate: string, today: string): number {
  if (lastDate === '') return 1
  if (lastDate === today) return prev
  if (shiftDate(today, -1) === lastDate) return prev + 1
  return 1
}

export function rollLucky(rng: () => number = Math.random): number {
  return rng() < LUCKY_RATE ? LUCKY_AMOUNT : 0
}

export type LingLingStage = 0 | 1 | 2 | 3 | 4

export function lingLingStage(completedWords: number, totalWords = 100): LingLingStage {
  const pct = completedWords / totalWords
  if (pct < 0.1) return 0
  if (pct < 0.3) return 1
  if (pct < 0.5) return 2
  if (pct < 0.8) return 3
  return 4
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
npx vitest run src/game/fun.test.ts
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/game/fun.ts src/game/fun.test.ts
git commit -m "feat(fun): 本地日/幸运/连续天数/灵灵档位 纯工具 + 单测
Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: 成就定义 + 扫描,单测

**Files:**
- Create: `src/game/achievements.ts`
- Test: `src/game/achievements.test.ts`

**Interfaces:**
- Consumes: 无。状态字段由 App 结算点装配。
- Produces:
  - `src/game/achievements.ts`:
    - `export type AchievementState = { completedWords: number; categoryDone: number; maxCombo: number; firstCompleteToday: number; perfectWords: number; consecutiveDays: number; hour: number; totalWords: number }`
    - `export type Achievement = { id: string; name: string; description: string; emoji: string; reward: number; check: (s: AchievementState) => boolean }`
    - `export const ACHIEVEMENTS: readonly Achievement[]`(见 Spec §7.2,8 条,无 painter/review 依赖)
    - `export function checkAchievements(state: AchievementState, earned: string[]): Achievement[]`(返回未在 earned 中且 check 通过的条目,顺序按数组序)

- [ ] **Step 1: 写失败测试**

Create `src/game/achievements.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ACHIEVEMENTS, checkAchievements, type AchievementState } from './achievements'

const base = (): AchievementState => ({
  completedWords: 0, categoryDone: 0, maxCombo: 0, firstCompleteToday: 0,
  perfectWords: 0, consecutiveDays: 0, hour: 12, totalWords: 100,
})

describe('成就集', () => {
  it('无重复 id', () => {
    const ids = new Set(ACHIEVEMENTS.map((a) => a.id))
    expect(ids.size).toBe(ACHIEVEMENTS.length)
  })
  it('不依赖绘画/复习字段(裁剪验证)', () => {
    const names = ACHIEVEMENTS.map((a) => a.id)
    expect(names).not.toContain('painter_10')
  })
  it('checkAchievements:新达成的发出,已达成不重发', () => {
    const s: AchievementState = { ...base(), completedWords: 100, perfectWords: 1 }
    const got = checkAchievements(s, [])
    expect(got.map((a) => a.id)).toContain('grand_master')
    expect(got.map((a) => a.id)).toContain('perfect_word')
    expect(checkAchievements(s, got.map((a) => a.id))).toHaveLength(0)
  })
  it('各成就触发口径', () => {
    const hour = (h: number): AchievementState => ({ ...base(), hour: h })
    expect(checkAchievements(hour(8), []).map((a) => a.id)).toContain('early_bird')
    expect(checkAchievements(hour(22), []).map((a) => a.id)).toContain('night_owl')
    expect(checkAchievements({ ...base(), maxCombo: 15 }, []).map((a) => a.id)).toContain('combo_15')
    expect(checkAchievements({ ...base(), firstCompleteToday: 5 }, []).map((a) => a.id)).toContain('marathon')
    expect(checkAchievements({ ...base(), categoryDone: 1 }, []).map((a) => a.id)).toContain('collector')
    expect(checkAchievements({ ...base(), consecutiveDays: 7 }, []).map((a) => a.id)).toContain('dedicated')
    expect(checkAchievements({ ...base(), completedWords: 50 }, []).map((a) => a.id)).not.toContain('grand_master')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
npx vitest run src/game/achievements.test.ts
```

Expected: FAIL(模块不存在)。

- [ ] **Step 3: 写实现**

Create `src/game/achievements.ts`:

```ts
// 隐藏成就(纯数据 + 扫描)。状态由 App 在词结算点装配;不重发由 earned 集保证。

export type AchievementState = {
  completedWords: number
  categoryDone: number
  maxCombo: number
  firstCompleteToday: number
  perfectWords: number
  consecutiveDays: number
  hour: number
  totalWords: number
}

export type Achievement = {
  id: string
  name: string
  description: string
  emoji: string
  reward: number
  check: (s: AchievementState) => boolean
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: 'perfect_word', name: '完美主义', description: '一个词全部题目首答就对', emoji: '💎', reward: 50,
    check: (s) => s.perfectWords >= 1 },
  { id: 'combo_15', name: '连击王者', description: '连击达到 15', emoji: '⚡', reward: 50,
    check: (s) => s.maxCombo >= 15 },
  { id: 'marathon', name: '马拉松', description: '一次学习首通 5 个词', emoji: '🏃', reward: 100,
    check: (s) => s.firstCompleteToday >= 5 },
  { id: 'early_bird', name: '早起鸟', description: '早上学习', emoji: '🌅', reward: 20,
    check: (s) => s.hour < 10 },
  { id: 'night_owl', name: '夜猫子', description: '晚上学习', emoji: '🦉', reward: 20,
    check: (s) => s.hour >= 21 },
  { id: 'collector', name: '收集者', description: '完成一个分类的全部 20 词', emoji: '📦', reward: 200,
    check: (s) => s.categoryDone >= 1 },
  { id: 'dedicated', name: '坚持者', description: '连续 7 天学习', emoji: '🔥', reward: 300,
    check: (s) => s.consecutiveDays >= 7 },
  { id: 'grand_master', name: '大法师', description: '全部 100 词完成', emoji: '👑', reward: 1000,
    check: (s) => s.completedWords >= s.totalWords },
]

export function checkAchievements(state: AchievementState, earned: string[]): Achievement[] {
  const earnedSet = new Set(earned)
  return ACHIEVEMENTS.filter((a) => !earnedSet.has(a.id) && a.check(state))
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
npx vitest run src/game/achievements.test.ts
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/game/achievements.ts src/game/achievements.test.ts
git commit -m "feat(fun): 隐藏成就定义与扫描(纯数据)+ 单测
Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: praise + confetti + Toast(组件无单测,dev 冒烟)

**Files:**
- Create: `src/game/praise.ts`
- Create: `src/game/confetti.ts`
- Create: `src/components/Toast.tsx`
- Modify: `src/App.tsx`(根部包 `<ToastProvider>`,content 不变)

**Interfaces:**
- Consumes: 无。
- Produces:
  - `praise.ts`:`export function getRandomPraise(rng: () => number = Math.random): string`(内置 ≥8 句中文字样)
  - `confetti.ts`:`export type CelebrateLevel = 'step' | 'word' | 'achievement' | 'combo10'`;`export function celebrate(level: CelebrateLevel): void`(import confetti from 'canvas-confetti',按 Spec §3.2 配置;`typeof confetti !== 'function'` 保护导出处理可能空 default)
  - `Toast.tsx`:`export type ToastType = 'success' | 'error' | 'info'`;`export type ToastData = { id: number; type: ToastType; message: string }`;`export function ToastProvider({ children }: { children: ReactNode })`;`export function useToast(): { showToast: (type: ToastType, message: string) => void }`

- [ ] **Step 1: 写 praise + confetti**

Create `src/game/praise.ts`:

```ts
const PRAISES = [
  '太棒了!🎉', '你真厉害!⭐', '完美!✨', '小天才!🌟',
  '好样的!💪', '真不错!🎊', '你做到了!🏆', '太聪明了!🧠',
]

export function getRandomPraise(rng: () => number = Math.random): string {
  return PRAISES[Math.floor(rng() * PRAISES.length)] ?? PRAISES[0]
}
```

Create `src/game/confetti.ts`:

```ts
import confetti from 'canvas-confetti'

export type CelebrateLevel = 'step' | 'word' | 'achievement' | 'combo10'

const CONFIGS: Record<CelebrateLevel, confetti.Options> = {
  step: { particleCount: 30, spread: 50 },
  word: { particleCount: 100, spread: 80, origin: { y: 0.6 } },
  achievement: { particleCount: 200, spread: 120 },
  combo10: { particleCount: 150, spread: 90 },
}

export function celebrate(level: CelebrateLevel): void {
  confetti(CONFIGS[level])
}
```

- [ ] **Step 2: 写 Toast Provider**

Create `src/components/Toast.tsx`(顶部居中、≤3 条排队、motion 滑入淡出、3s):

```tsx
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '../lib/utils'

export type ToastType = 'success' | 'error' | 'info'
export type ToastData = { id: number; type: ToastType; message: string }

const ToastCtx = createContext<{ showToast: (type: ToastType, message: string) => void } | null>(null)

export function useToast() {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast 需在 <ToastProvider> 内使用')
  return ctx
}

const TYPE_STYLE: Record<ToastType, string> = {
  success: 'border-emerald/40 bg-emerald/10 text-emerald',
  error: 'border-red/40 bg-red-tint text-red',
  info: 'border-sky/40 bg-sky/10 text-sky',
}
const TYPE_ICON: Record<ToastType, string> = { success: '✅', error: '❌', info: '📥' }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([])
  const seq = useRef(0)
  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])
  const showToast = useCallback((type: ToastType, message: string) => {
    const id = ++seq.current
    setToasts((t) => [...t.slice(-2), { id, type, message }]) // 保留最近 2 条 + 新 = ≤3
    window.setTimeout(() => remove(id), 3000)
  }, [remove])

  return (
    <ToastCtx.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className={cn('pointer-events-auto flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-bold shadow-pop', TYPE_STYLE[t.type])}
            >
              <span aria-hidden>{TYPE_ICON[t.type]}</span>{t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  )
}
```

> 注:`text-sky`/`border-sky`/`bg-sky/10` token 在 `src/index.css @theme` 中已有(`--color-sky`)。

- [ ] **Step 3: App 根部挂 Provider**

`src/App.tsx`:
- import 增 `import { ToastProvider } from './components/Toast'`
- 返回改 `return <ToastProvider><MotionConfig reducedMotion="user">{content}</MotionConfig></ToastProvider>`

- [ ] **Step 4: lint/build**

```bash
npm run lint && npm run build
```

Expected: 无错误。

- [ ] **Step 5: dev 冒烟**

```bash
npm run dev
```

浏览 :3000,临时在任一 handler 调 `showToast('success','⭐ +30 星尘')` 验证顶部滑入/3s 消失;确认后撤临时调用。

- [ ] **Step 6: Commit**

```bash
git add src/game/praise.ts src/game/confetti.ts src/components/Toast.tsx src/App.tsx
git commit -m "feat(fun): praise/confetti/Toast(顶部居中排队滑入淡出)
Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 6: teaser 词间文案(words.ts + 类型 + 校验)

**Files:**
- Modify: `src/types.ts:40-42`(WordUnit)
- Modify: `src/data/words.ts`(100 词补 `teaser`)
- Test: `src/game/words.test.ts`(增用例)

**Interfaces:**
- Consumes: 无(纯数据)。
- Produces:`WordUnit` 增可选 `teaser?: string`;words.ts 每词带非空 `teaser`,语义=灵灵在当前词完成后暗示**下一词**(id+1)。

- [ ] **Step 1: 类型加字段**

`src/types.ts` WordUnit:

```ts
export type WordUnit = {
  id: number; emoji: string; pinyin: string; hanzi: string; english: string; category: CategoryKey
  teaser?: string // 学完本词后灵灵引导语,暗示下一词(id+1)
}
```

- [ ] **Step 2: 写失败测试(words.test 追加用例)**

In `src/game/words.test.ts` 追加:

```ts
describe('词库 teaser', () => {
  it('每词 teaser 非空且长度上限 40', () => {
    for (const w of WORDS) {
      expect(typeof w.teaser, `${w.id} 缺 teaser`).toBe('string')
      expect((w.teaser ?? '').length).toBeGreaterThan(0)
      expect((w.teaser ?? '').length).toBeLessThanOrEqual(40)
    }
  })
  it('相邻词 teaser 不逐字雷同(去标点后不同)', () => {
    for (let i = 0; i + 1 < WORDS.length; i += 1) {
      const clean = (s: string) => s.replace(/[\s，。！？、「」……,.!?]/g, '')
      expect(clean(WORDS[i].teaser ?? '')).not.toBe(clean(WORDS[i + 1].teaser ?? ''))
    }
  })
})
```

- [ ] **Step 3: 跑测试确认失败**

```bash
npx vitest run src/game/words.test.ts -t teaser
```

Expected: FAIL(现无 teaser)。

- [ ] **Step 4: 补 100 句文案**

在 `src/data/words.ts` 每个词对象加 `teaser` 字段。**写作规则**:
- 用当前词 emoji/感知开场,句中**不点名下个词名**(引导好奇);暗示 id+1 的那个词。
- 长度 ≤ 40 汉字;每句末尾带 `…`/`?`;风格对齐 Spec 例句(`太阳`→「太阳好温暖!咦…晚上天上那个亮亮的是什么?」→ 下个词月亮)。
- 可 AI 成稿,但**逐词人工校对**;分类语义正确(id 段内自然衔接),不误导。
- 例:1 太阳 → 2 月亮;41 猫 → 42 狗 用「猫猫的朋友总爱摇尾巴…是谁呀?」等。跨分类边界(20→21 食物、40→41 动物、60→61 自然、80→81 交通)顺承即可。
- teaser 是软性内容,功能不依赖;完成整批 100 条后进 Step 5。

- [ ] **Step 5: 跑测试确认通过 + lint/build**

```bash
npx vitest run src/game/words.test.ts && npm run lint && npm run build
```

Expected: 全绿。

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/data/words.ts src/game/words.test.ts
git commit -m "feat(fun): 100 词词间过渡 teaser 文案 + 数据校验
Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 7: 灵灵吉祥物 + 主页挂载

**Files:**
- Create: `src/components/game/LingLing.tsx`
- Modify: `src/components/game/WordMapView.tsx`(标题与词格之间插 `<LingLing completedWords={doneCount} />`)

**Interfaces:**
- Consumes: Task 3 `lingLingStage`;本组件从 map 拿 `completedWords`。
- Produces:`export function LingLing({ completedWords, totalWords = 100 }: { completedWords: number; totalWords?: number })`;五档文案/emoji/CSS 动画,纯展示。

- [ ] **Step 1: 写组件**

Create `src/components/game/LingLing.tsx`:

```tsx
import { motion } from 'motion/react'
import { lingLingStage } from '../../game/fun'

type StageMeta = {
  emoji: string; label: string; className: string
}
const STAGES: readonly StageMeta[] = [
  { emoji: '😴', label: '灵灵在睡觉…快醒醒!', className: 'animate-[ll-sleep_2.4s_ease-in-out_infinite]' },
  { emoji: '🦊', label: '好耶!继续加油!', className: 'animate-[ll-bounce_1.4s_ease-in-out_infinite]' },
  { emoji: '🦊✨', label: '你太厉害了!', className: 'animate-[ll-wiggle_1.6s_ease-in-out_infinite]' },
  { emoji: '🌟', label: '魔法快恢复了!', className: 'animate-[ll-glow_1.8s_ease-in-out_infinite]' },
  { emoji: '🦊👑', label: '你是我的英雄!', className: 'animate-[ll-fly_2s_ease-in-out_infinite]' },
]

export function LingLing({ completedWords, totalWords = 100 }: { completedWords: number; totalWords?: number }) {
  const meta = STAGES[lingLingStage(completedWords, totalWords)]
  return (
    <div className="mb-5 flex items-center justify-center gap-3 rounded-2xl border border-hairline bg-surface/70 px-4 py-3 shadow-card">
      <motion.span className={`text-4xl ${meta.className}`} aria-hidden>{meta.emoji}</motion.span>
      <p className="text-sm font-bold text-ink-2">{meta.label}</p>
    </div>
  )
}
```

在 `src/index.css` 追加 keyframes(Task 7 一并提交):

```css
@keyframes ll-sleep { 0%,100% { transform: scale(1) } 50% { transform: scale(0.94) } }
@keyframes ll-bounce { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-10px) } }
@keyframes ll-wiggle { 0%,100% { transform: rotate(-3deg) } 50% { transform: rotate(3deg) } }
@keyframes ll-glow { 0%,100% { filter: brightness(1) } 50% { filter: brightness(1.5) } }
@keyframes ll-fly { 0%,100% { transform: translateY(0) rotate(0deg) } 50% { transform: translateY(-20px) rotate(5deg) } }
```

- [ ] **Step 2: 挂主页**

`src/components/game/WordMapView.tsx`:
- import 增 `import { LingLing } from './LingLing'`
- `<main>` 内 `<section className="mb-6 text-center">`(标题区)与词格第一个 `<section>` 之间插入:`<LingLing completedWords={doneCount} />`(doneCount 已在该组件算出)

- [ ] **Step 3: lint/build + dev 冒烟**

```bash
npm run lint && npm run build
```

dev:主页应见灵灵档位动画;点学词/刷新随 doneCount 变化。

- [ ] **Step 4: Commit**

```bash
git add src/components/game/LingLing.tsx src/components/game/WordMapView.tsx src/index.css
git commit -m "feat(fun): 灵灵吉祥物(进度分档动画)+ 主页挂载
Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 8: 连击接线(WordLesson 每题回调 + ComboDisplay + App 会话态)

**Files:**
- Create: `src/components/game/ComboDisplay.tsx`
- Modify: `src/components/game/WordLesson.tsx`(加 props + handleAnswer 事件 + ComboDisplay 挂载)
- Modify: `src/App.tsx`(combo/maxCombo 状态 + startWord/handleStepPass 接线 + confetti combo10 + step 完成 toast/confetti)

**Interfaces:**
- Consumes: Task 2 combo 模块;Task 5 useToast/celebrate/getRandomPraise。
- Produces:
  - `WordLessonProps` 增 `combo: number` 与 `onAnswer: (kind: AnswerKind) => void`
  - `ComboDisplay.tsx` 导出 `comboText(combo: number): { text: string; className: string }`(阈值 1/2/3/5/8/10,Text 同 Spec §3.5)与 `export function ComboDisplay({ text, className }: { text: string; className: string })`(motion 弹入 1s 自隐)

- [ ] **Step 1: 写 ComboDisplay**

Create `src/components/game/ComboDisplay.tsx`:

```tsx
import { motion } from 'motion/react'
import { cn } from '../../lib/utils'

const LEVELS: ReadonlyArray<{ threshold: number; text: string; className: string }> = [
  { threshold: 1, text: '🔥 太棒了!', className: 'text-orange-500' },
  { threshold: 2, text: '🔥🔥 连击!', className: 'text-orange-600' },
  { threshold: 3, text: '🔥🔥🔥 三连击!', className: 'text-red-500' },
  { threshold: 5, text: '⚡ 五连击!无敌!', className: 'text-purple-500' },
  { threshold: 8, text: '🌟 八连击!小法师!', className: 'text-blue-500' },
  { threshold: 10, text: '👑 十连击!大法师!', className: 'text-yellow-500' },
]

export function comboText(combo: number): { text: string; className: string } {
  let hit = LEVELS[0]
  for (const l of LEVELS) if (combo >= l.threshold) hit = l
  return { text: hit.text, className: hit.className }
}

export function ComboDisplay({ text, className }: { text: string; className: string }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={cn('pointer-events-none pb-2 text-center text-lg font-extrabold', className)}
    >
      {text}
    </motion.p>
  )
}
```

- [ ] **Step 2: WordLesson 接入**

`src/components/game/WordLesson.tsx`:
- import 增:`AnimatePresence`(已 import)、`ComboDisplay, comboText`、`type AnswerKind`、`getRandomPraise`、`useToast`、`celebrate`。
- Props 增:`combo: number`、`onAnswer: (kind: AnswerKind) => void`。
- 组件内加状态/ref:
  ```ts
  const [comboBurst, setComboBurst] = useState<{ text: string; className: string } | null>(null)
  const prevCombo = useRef(combo)
  // combo 增加且越过阈值 → 显示;>=10 撒花
  useEffect(() => {
    if (combo > prevCombo.current) {
      const prev = prevCombo.current
      const { text, className } = comboText(combo)
      const crossed = LEVEL_CROSSING(prev, combo) // 见下
      if (crossed) {
        setComboBurst({ text, className })
        const t = window.setTimeout(() => setComboBurst(null), 1000)
        return () => window.clearTimeout(t)
      }
      if (combo >= 10 && prev < 10) celebrate('combo10')
    }
    prevCombo.current = combo
  }, [combo])
  ```
  简化跨阈值检测:先导一个文件级 helper(放本文件顶):
  ```ts
  const COMBO_HITS = [1, 2, 3, 5, 8, 10]
  function crossedLevel(prev: number, next: number): boolean {
    return COMBO_HITS.some((h) => prev < h && next >= h)
  }
  ```
  若 `next >= 10 && prev < 10` 由 crossed 已覆盖 → 撒花并入 crossed 分支:`if (crossed) { ...; if (combo === 10) celebrate('combo10') }`。用此实现。
- `handleAnswer` 内正确/错误分支开头发事件:match 整组对 → `onAnswer('first')`(该题即整组,无错回调);`correct`(selectedId===answerId)→ 若 `attempt===1` 发 `'first'` 否则(attempt2 对)发 `'retry'`;错:attempt===1 与 attempt===2 再错都发 `'wrong'`(每次点错即断)。用局部 `const firstTry = attempt === 1` 判断。
- 反馈区上方插 ComboDisplay:
  ```tsx
  <AnimatePresence>{comboBurst ? <ComboDisplay {...comboBurst} /> : null}</AnimatePresence>
  ```

> 注:一期 match 走 `onComplete` 进 handleAnswer 的 match 分支且 attempt 恒 1 → 一律 first,连击 +1、perfect 不断,接受(Spec §6.3 注)。

- [ ] **Step 3: App combo 会话态与逐步庆祝**

`src/App.tsx`:
- import 增:`loadCombo, loadMaxCombo, nextCombo, saveCombo, saveMaxCombo`(combo.ts)、`celebrate`(confetti)、`getRandomPraise`、`useToast`。
- state/ref 增(放 handleStepPass 附近):
  ```ts
  const [combo, setCombo] = useState(() => loadCombo())
  const maxComboRef = useRef(loadMaxCombo())
  const { showToast } = useToast()
  ```
  (combo 初值经 `loadCombo()` 读 sessionStorage → 刷新保持)
- 增一个 per-answer 处理器(WordLesson 的 `onAnswer`),放 startWord 定义旁:
  ```ts
  function handleAnswer(kind: AnswerKind) {
    const n = nextCombo(combo, kind)
    saveCombo(n); setCombo(n)
    if (n > maxComboRef.current) { maxComboRef.current = n; saveMaxCombo(n) }
  }
  ```
  ⚠️ 依赖闭包 `combo` 有竞态(连答快)→ 改读 ref:加 `comboRef`,或直接读 storage。用 ref:新增 `const comboRef = useRef(combo)` 并在每次 setCombo 前同步;`handleAnswer` 内 `const cur = comboRef.current; const n = nextCombo(cur, kind); comboRef.current = n; ...`。
- `startWord` 开头(现有 `gainRef.current = { step: 0, bonus: 0 }` 处)保持 combo 不清零(跨词持续);空实现改动前先无 op。
- WordLesson 使用处传新 props:
  ```tsx
  combo={combo} onAnswer={handleAnswer}
  ```
- `handleStepPass(skill)` 内(一步 2 题全过)加轻庆祝:
  ```ts
  celebrate('step')
  showToast('success', `${getRandomPraise()} ${SKILL_LABEL_OF(skill)||''}+30 星尘`)
  ```
  简化 toast:`showToast('success', getRandomPraise())`,若需含数值,接 App 内已有增益:gainRef.step 已在 +30 后 → 用 `showToast('success', \`${getRandomPraise()} ⭐ +30\`)`。就地写。
  (`SKILL_LABEL` 在 WordLesson 内,App 不引;toast 文案用夸奖语即可。)

- [ ] **Step 4: lint/build + dev 冒烟**

```bash
npm run lint && npm run build
```

dev:连续首答对 → 阈值文字弹 + 连击 10 撒花;答错一次归零;刷新页面 combo 保持。

- [ ] **Step 5: Commit**

```bash
git add src/components/game/ComboDisplay.tsx src/components/game/WordLesson.tsx src/App.tsx
git commit -m "feat(fun): 连击逐题接线 + ComboDisplay 阈值特效(session 持久)
Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 9: WordDone 结算卡趣味化(夸奖 + 灵灵气泡 + 整词撒花)

**Files:**
- Modify: `src/components/game/WordDone.tsx`
- Modify: `src/App.tsx`(整词完成撒花一处)

**Interfaces:**
- Consumes: Task 6 teaser;Task 5 getRandomPraise/celebrate。
- Produces:`WordDone` 展示:动态祝贺换随机夸奖(词级,useRef 固化一次)、底部灵灵+`word.teaser` 气泡(有 teaser 才显示)、现行动效与按钮不动。UI 层无单测,dev 冒烟。

- [ ] **Step 1: WordDone 改动**

`src/components/game/WordDone.tsx`:
- import 增:`getRandomPraise`、`celebrate`、`LingLing` 不需要(气泡直接内联小狐狸 emoji,避免整卡过重)——用内联气泡:emoji `🦊` + 文字。
- 组件内 praise 固定一次:
  ```ts
  const praise = useRef(getRandomPraise())
  ```
  (`useRef` 惰性 init → 每次挂载随机一次;整词完成撒花一次放 App,见 Step 2。)
- 将原祝贺行 `<p ...>{wordBonus>0 ? '太棒了,整词完成!' : '这一步完成啦!'}</p>` 文案替换/增强为 `${praise.current}` 开头。保留 emerald/accent 配色判断。
- 卡片底部新增灵灵气泡(teaser 存在时):
  ```tsx
  {word.teaser ? (
    <div className="mt-5 flex items-start gap-3 rounded-2xl border border-hairline bg-surface-2 px-4 py-3 text-left">
      <span className="text-3xl" aria-hidden>🦊</span>
      <p className="text-sm leading-relaxed text-ink-2">{word.teaser}</p>
    </div>
  ) : null}
  ```
  (文案已含 emoji 尾巴,提示「下一词」由文案承担;不放多余装饰)

- [ ] **Step 2: App 整词完成撒花**

`src/App.tsx` `handleLessonComplete()` 设 `screen('done')` 前:`celebrate('word')`(只在本次确实推进时才放?放宽:凡到 done 即 word 级庆祝,与一期 victory 音效语义一致——但重学已完成词也到 done,播放 word 撒花/音效会偏重。更贴合一期:仅 `gainRef.current.bonus > 0`(本次首通)或该词 had 新完成时 celebrate('word'))。实现:`if (gainRef.current.bonus > 0 || gainRef.current.step > 0) celebrate('word')`。step>0 含整词首通(首步即 step+30),bonus 首通 +20。保留现音效逻辑 WordDone 内部。

- [ ] **Step 3: lint/build + dev 冒烟**

```bash
npm run lint && npm run build
```

dev:整词完成 → 撒花 + 随机夸奖标题 + 底部灵灵 teaser 气泡(有文案词)。

- [ ] **Step 4: Commit**

```bash
git add src/components/game/WordDone.tsx src/App.tsx
git commit -m "feat(fun): WordDone 随机夸奖 + 灵灵 teaser 气泡 + 整词撒花
Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 10: 结算编排(eligible/加成池/幸运/成就/连续天数 + 弹层 + 补 PUT)

**Files:**
- Create: `src/components/game/AchievementPopup.tsx`
- Create: `src/components/game/LuckyBonus.tsx`
- Modify: `src/App.tsx`(本任务主战场:会话态、resolveAtDone、settings 合并、reset 清 fun)

**Interfaces:**
- Consumes: Task 1 settings 类型/默认;Task 2 combo;Task 3 fun(rollLucky/nextConsecutive/todayKey);Task 4 achievements;Task 5 useToast/celebrate;Task 8 combo 会话态。
- Produces:
  - `DoneInfo` 扩展:`extraReward`(本词追加星尘合计)、`luckyReward`、`achievements`(`Achievement[]` 本次新达成)。
  - `AchievementPopup`:`({ list }: { list: Achievement[] })`,顺序弹每枚:emoji+名+描述+`+reward`,每枚 200 粒子;非阻塞,盖在 done 上,点击/自动关闭。
  - `LuckyBonus`:`({ amount }: { amount: number })`,显示幸运文案 + amount。
  - App:`handleLessonComplete` 改为异步结算(见 Step 3 代码块),并新增会话/挂起 ref 与 settings 持久化 helper。

- [ ] **Step 1: 写弹层组件**

Create `src/components/game/AchievementPopup.tsx`:

```tsx
import { useEffect } from 'react'
import { motion } from 'motion/react'
import { celebrate } from '../../game/confetti'
import type { Achievement } from '../../game/achievements'

export function AchievementPopup({ list, onDone }: { list: Achievement[]; onDone: () => void }) {
  const a = list[0]
  useEffect(() => {
    if (!a) { onDone(); return }
    celebrate('achievement')
    const t = window.setTimeout(() => onDone(), 2600)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a])
  if (!a) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 px-4" onClick={onDone}>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-xs rounded-[2rem] border border-hairline bg-surface p-6 text-center shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-5xl" aria-hidden>{a.emoji}</div>
        <p className="mt-3 text-lg font-extrabold text-accent">解锁成就</p>
        <h2 className="text-xl font-extrabold">{a.name}</h2>
        <p className="mt-1 text-sm text-ink-2">{a.description}</p>
        <p className="mt-2 text-sm font-bold text-emerald">+{a.reward} 星尘</p>
      </motion.div>
    </div>
  )
}
```

Create `src/components/game/LuckyBonus.tsx`:

```tsx
import { useEffect } from 'react'
import { motion } from 'motion/react'

export function LuckyBonus({ amount, onDone }: { amount: number; onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, 2600)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 px-4" onClick={onDone}>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-xs rounded-[2rem] border border-amber/50 bg-amber-100 p-6 text-center shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-5xl" aria-hidden>🍀</div>
        <h2 className="mt-3 text-xl font-extrabold text-amber">好运来了!</h2>
        <p className="mt-1 text-sm text-ink-2">灵灵在草丛里找到了一颗隐藏星尘!</p>
        <p className="mt-2 text-lg font-extrabold text-amber">+{amount} ⭐</p>
      </motion.div>
    </div>
  )
}
```

- [ ] **Step 2: App 结算编排(核心,含每处具体改法)**

`src/App.tsx` 全量改法见下锚点(逐段替换/插入):

1. imports 核对(按现有 App.tsx 已 import 补缺,**避免同一模块重复绑定**):已含 `WORDS, wordById`(data/words)、`useToast`/`celebrate`/`getRandomPraise`(Task 8)。**本轮净增**:

```ts
import { loadCombo, loadMaxCombo, nextCombo, comboBonus, saveCombo, saveMaxCombo, type AnswerKind } from './game/combo'
import { rollLucky, nextConsecutive, todayKey } from './game/fun'
import { checkAchievements, type Achievement } from './game/achievements'
import { fullComplete } from './game/lesson'
import type { WordUnit } from './types' // 若 WordUnit 未在该文件 top import,补
import { AchievementPopup } from './components/game/AchievementPopup'
import { LuckyBonus } from './components/game/LuckyBonus'
```

2. `DoneInfo` 扩展(顶层 type):

```ts
type DoneInfo = {
  word: WordUnit
  stepReward: number
  wordBonus: number
  extraReward: number      // 连击池+幸运+成就 本词追加合计
  luckyReward: number
  achievements: Achievement[]
}
```

3. 会话/结算 state 与 ref(放 `gainRef` 定义旁):

```ts
const { showToast } = useToast()
const [combo, setCombo] = useState<number>(() => loadCombo())
const comboRef = useRef(combo)
const maxComboRef = useRef(loadMaxCombo())
const pendingBonusRef = useRef(0)      // 非 eligible 达成成就的挂起星尘
const sessionRef = useRef({ firstCompleteToday: 0, perfectWords: 0 })
const [achQueue, setAchQueue] = useState<Achievement[]>([])
const [luckyOn, setLuckyOn] = useState(false)
```

4. `handleAnswer`(Task 8 已有雏形)→ 加固(读 comboRef):

```ts
function handleAnswer(kind: AnswerKind) {
  const n = nextCombo(comboRef.current, kind)
  comboRef.current = n
  setCombo(n)
  saveCombo(n)
  if (n > maxComboRef.current) { maxComboRef.current = n; saveMaxCombo(n) }
}
```

5. **eligible 捕获 + 词会话 ref**:`startWord` 内(`gainRef.current = { step: 0, bonus: 0 }` 行后)增:

```ts
const prev = progressRef.current[id] ?? emptyProgress(id)
wordRunRef.current = { eligible: !fullComplete(prev, settingsRef.current), bonusPool: 0, perfect: true }
```
ref 定义:`const wordRunRef = useRef({ eligible: false, bonusPool: 0, perfect: true })`。

6. **加成池 + perfect 逐答累计**:把 Task 8 的 `handleAnswer` 扩展为也更新 wordRun:

```ts
function handleAnswer(kind: AnswerKind) {
  const run = wordRunRef.current
  if (kind !== 'first') run.perfect = false
  const n = nextCombo(comboRef.current, kind)
  comboRef.current = n
  setCombo(n)
  saveCombo(n)
  if (n > maxComboRef.current) { maxComboRef.current = n; saveMaxCombo(n) }
  if (kind === 'first' && run.eligible) {
    run.bonusPool += comboBonus(n)
  }
}
```
(import `comboBonus`。)

7. **词完成 count/分类 done 计数 helper**(文件级):

```ts
function fullWords(progress: Record<number, WordProgress>, settings: UserSettings): number {
  return WORDS.filter((w) => fullComplete(progress[w.id], settings)).length
}
function fullCategories(progress: Record<number, WordProgress>, settings: UserSettings): number {
  let n = 0
  for (const [cat, items] of CATEGORY_ORDER_GROUPS) {
    if (items.every((w) => fullComplete(progress[w.id], settings))) n += 1
  }
  return n
}
```
为省篇幅,分类分组直接以字面分类对象内联到函数(见 Step 3 完整块;用 `import { WORDS, CATEGORY_LABELS }` 时以 `w.category` 聚合):

```ts
function fullCategories(progress: Record<number, WordProgress>, settings: UserSettings): number {
  const byCat = new Map<string, WordUnit[]>()
  for (const w of WORDS) { const a = byCat.get(w.category) ?? []; a.push(w); byCat.set(w.category, a) }
  let n = 0
  for (const items of byCat.values()) if (items.every((w) => fullComplete(progress[w.id], settings))) n += 1
  return n
}
```

8. **settings 持久化 helper**(单点,含 earning/consecutive):

```ts
async function persistSettings(next: UserSettings) {
  setSettings(next); settingsRef.current = next
  try {
    await fetch('/api/settings', {
      method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: {
        enablePinyin: next.enablePinyin, enableHanzi: next.enableHanzi, enableEnglish: next.enableEnglish,
        earnedAchievements: next.earnedAchievements, consecutiveDays: next.consecutiveDays,
        lastActiveDate: next.lastActiveDate,
      } }),
    })
  } catch { /* ignore */ }
}
```

9. **`handleLessonComplete` 改写为异步结算**(替换现有同步实现):

```ts
async function handleLessonComplete() {
  const w = activeWord
  if (!w) return
  const run = wordRunRef.current
  const settings = settingsRef.current
  const prev = progressRef.current[w.id]
  const newlyComplete = fullComplete(prev, settings) === false && run.eligible

  // —— 先累加本次首通/perfect(供扫描),再更新学习日(重学也算) ——
  if (newlyComplete) {
    if (run.perfect) sessionRef.current.perfectWords += 1
    sessionRef.current.firstCompleteToday += 1
  }
  const today = todayKey()
  const s1 = { ...settings, lastActiveDate: today,
    consecutiveDays: nextConsecutive(settings.consecutiveDays, settings.lastActiveDate, today) }
  const fullCount = fullWords(progressRef.current, s1)
  const catDone = fullCategories(progressRef.current, s1)
  const newEarned = checkAchievements({
    completedWords: fullCount, categoryDone: catDone,
    maxCombo: maxComboRef.current,
    firstCompleteToday: sessionRef.current.firstCompleteToday,
    perfectWords: sessionRef.current.perfectWords,
    consecutiveDays: s1.consecutiveDays,
    hour: new Date().getHours(), totalWords: WORDS.length,
  }, s1.earnedAchievements)

  // —— 星尘结算:eligible 首通才写词行 ——
  let extra = 0
  let luckyReward = 0
  if (newlyComplete) {
    extra += run.bonusPool
    luckyReward = rollLucky()
    extra += luckyReward
    extra += newEarned.reduce((sum, a) => sum + a.reward, 0) + pendingBonusRef.current
    pendingBonusRef.current = 0
  } else {
    pendingBonusRef.current += newEarned.reduce((sum, a) => sum + a.reward, 0)
  }
  const newAchievements = newlyComplete ? newEarned : []
  if (extra > 0) {
    const base = prev ?? emptyProgress(w.id)
    const bumped: WordProgress = { ...base, starsEarned: base.starsEarned + extra, updatedAt: new Date().toISOString() }
    syncProgress({ ...progressRef.current, [w.id]: bumped })
    void fetch('/api/progress', { method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ progress: [bumped] }) }).catch(() => {})
  }
  if (newEarned.length > 0) {
    s1.earnedAchievements = Array.from(new Set([...s1.earnedAchievements, ...newEarned.map((a) => a.id)]))
  }
  if (newlyComplete || newEarned.length > 0) await persistSettings(s1)

  setDoneInfo({ word: w, stepReward: gainRef.current.step, wordBonus: gainRef.current.bonus,
    extraReward: extra, luckyReward, achievements: newAchievements })
  if (newAchievements.length > 0) setAchQueue(newAchievements)
  else if (luckyReward > 0) setLuckyOn(true)
  if (gainRef.current.bonus > 0 || gainRef.current.step > 0) celebrate('word')
  setScreen('done')
}
```

> 口径:计数在扫描**前**累加(首个 perfect 词/马拉松当次即算);s1 先内存更新连续天数与 earned 再 persist 一次;非首通词达成的成就只入 earned 列表 + 奖励进挂起池(星尘在下次 eligible 首通 flush);`extra > 0` 只在 newlyComplete 路径非零,写词行单调、不刷星。

10. **resetProgress 清 fun**:现有 `resetProgress` 在 DELETE 后追加:

```ts
saveCombo(0); saveMaxCombo(0)
comboRef.current = 0; setCombo(0); maxComboRef.current = 0
sessionRef.current = { firstCompleteToday: 0, perfectWords: 0 }
pendingBonusRef.current = 0
wordRunRef.current = { eligible: false, bonusPool: 0, perfect: true }
await persistSettings({ ...settingsRef.current, earnedAchievements: [], consecutiveDays: 0, lastActiveDate: '' })
```
(补 `saveCombo/saveMaxCombo` import 已含。)

- [ ] **Step 3: render 弹层 + done 文案**

`src/App.tsx` content 分支:done 分支渲染 WordDone + 弹层(盖于卡上)。成就**串行**出队、每枚关闭后若队列空且本词有幸运则开幸运层:

```tsx
} else if (screen === 'done' && doneInfo) {
  content = (
    <>
      <WordDone
        word={doneInfo.word} stepReward={doneInfo.stepReward} wordBonus={doneInfo.wordBonus}
        totalStars={totalStars} titleName={title.name} nextId={doneInfo.word.id + 1}
        isLastWord={doneInfo.word.id >= WORDS.length} extraReward={doneInfo.extraReward}
        onNext={nextWord} onMap={exitToMap}
      />
      {achQueue.length > 0 ? (
        <AchievementPopup
          list={achQueue}
          onDone={() => {
            const rest = achQueue.slice(1)
            setAchQueue(rest)
            if (rest.length === 0 && doneInfo.luckyReward > 0) setLuckyOn(true)
          }}
        />
      ) : luckyOn ? (
        <LuckyBonus amount={doneInfo.luckyReward} onDone={() => setLuckyOn(false)} />
      ) : null}
    </>
  )
}
```

`exitToMap`/`nextWord` 中追加清弹层:`setAchQueue([]); setLuckyOn(false)`(避免历史词弹层残留)。

`src/components/game/WordDone.tsx`:Props 增 `extraReward?: number`;星尘块下方(或步/加成块同行)若 `extraReward > 0` 显示:

```tsx
{extraReward > 0 ? (
  <div className="rounded-2xl border border-amber/50 bg-amber-100 px-4 py-2">
    <p className="text-xs font-semibold text-ink-3">趣味额外奖励</p>
    <p className="text-xl font-extrabold text-amber">+{extraReward}</p>
  </div>
) : null}
```

放在现有「技能步星尘/整词完成加成」flex 块之后、`星尘 {totalStars}` 行之前。

- [ ] **Step 4: lint/build + 单测 + dev 冒烟**

```bash
npm run lint && npm run build && npx vitest run src/game
```

dev 验证:
1. 首通词全对 → 连击池星尘进词行、成就/幸运弹层、extraReward 块;刷新后星尘不变多。
2. 重学已完成词答全对 → 无幸运、extraReward 0、仍可触发 early_bird 类成就在下次首通词入账(pending)。
3. 连击 15/首通 5 词/整 0 错词等成就按 §9.3 冒烟(可临时调低阈值验)。
4. 同日重复学习 consecutiveDays 不增;第二天经 nextConsecutive +1;断档归 1。
5. 家长重置 → 词行、成就、连击、连续天数全清。

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/game/WordDone.tsx src/components/game/AchievementPopup.tsx src/components/game/LuckyBonus.tsx
git commit -m "feat(fun): 结算编排(eligible 加成池/幸运/成就/连续天数 + 弹层 + 补 PUT)
Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 11: 收尾回归(全测/lint/build/冒烟 + spec 对照)

**Files:**
- 全量回归;不改逻辑(除非回归暴露 bug → 按 `superpowers:systematic-debugging` 处理)。

- [ ] **Step 1: 全量测试 + lint + build**

```bash
npm test && npm run lint && npm run build
```

Expected: words/progress/lesson/engine/combo/fun/achievements 全绿;tsc 无类型错。

- [ ] **Step 2: 全流程冒烟(dev :3000)**

按 Spec §9 测清单逐条:
1. 答对一题 → combo+1、Toast 夸奖;2. 答错 → 归零;3. combo=3 → 「三连击!」;4. 整词首通 → 撒花 + 结算 + 随机夸奖 + extraReward 入账;5. 10% 幸运(临时提概率验)弹层 +50;6. 进度 <10% → 灵灵睡觉档;7. 完成词 21 → 档位升;8. 全对词 → 「完美主义」;9. 刷新 → 连击/成就保持;10. 关浏览器重开 → 连击归零、成就保持(settings);11. 双设备逻辑 = 客户端并集(单机人工可跳过);12. 离线 → 趣味机制前端正常(除同步 PUT 失败静默)。

- [ ] **Step 3: spec 对照勾稽**

对照 `docs/superpowers/specs/2026-09-04-fun-system-design.md` 每节落到代码:Toast(3.1)/confetti(3.2)/praise(3.3)/combo+特效(3.4-3.5)/LingLing(4.1)/teaser(4.2)/achievements(4.3)/lucky(4.4)/迁移与 worker(§4-5)/结算编排(§6)/成就口径(§7)。缺项就地补,补后回 Step 1。

- [ ] **Step 4: 收尾 commit(若有遗留)**

```bash
git add -A
git commit -m "test(fun): 趣味系统回归收尾
Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

（如 Step 1-3 无改动,跳过本步。）

---

## Self-Review 记录

- **Spec 覆盖**:3.1-3.5→Task 5/8/9;4.1→Task 3/7;4.2→Task 6/9;4.3/4.4→Task 4/10;DB+worker→Task 1;结算编排/学习日/挂起池→Task 10;重置清 fun→Task 10 Step 2.10;裁剪 painter/review→Task 4 测试锁死。无缺项。
- **占位符**:无 TBD/TODO;内容型文案(100 teaser)以写作规则 + 测试兜底给出,属必要软性步骤。
- **类型一致性**:`AnswerKind`/`nextCombo`/`comboBonus` 跨 Task 2/8/10 一致;`WordUnit.teaser` Task 6→9;`UserSettings` 新字段 Task 1→10;`Achievement`/`checkAchievements` Task 4→10;`todayKey/nextConsecutive/rollLucky` Task 3→10;`celebrate` Task 5→8/9;`getRandomPraise` Task 5→8/9。`WordDone` 增 `extraReward` prop 在 Task 9 后由 Task 10 引入,调用处(App done 分支)与组件同步更新。
