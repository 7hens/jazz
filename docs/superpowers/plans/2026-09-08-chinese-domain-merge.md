# 汉语领域并轨 S1 · 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把学习启用模型从「技能级 3 开关(拼音/汉字/英语)」收敛为「领域级 2 开关(汉语=拼音+汉字 / 英语)」,内部 `SkillKey`、进度三键、词课步序、出题/结算语义一律不变。

**Architecture:** 改动只在**启用模型这一条链**上:领域常量与类型落 `shared/services/settings.ts`(DomainKey/域序/域键),领域→技能映射与启用派生落 `features/lesson/progress-rules.ts`(语义属主,唯一真源),面板/冷启动/api/worker/默认值/迁移都消费该链;`fullComplete` 因经 `enabledSkills` 自动吃到新口径,结算与成就零改。`WordProgress.completed` 三键与 progress 表列不动。

**Tech Stack:** TS + React 19 + Vitest(jsdom);Cloudflare Workers + D1(worker/settings.ts);Wrangler D1 migrations。

**Spec:** `docs/superpowers/specs/2026-09-08-chinese-domain-merge-design.md`

## Global Constraints

- 迁移**只新增 0004**,不改 `0001_init.sql` 基线;新列带 `DEFAULT`。
- `SkillKey`/`WordProgress.completed`/progress 表 `*_completed` 列 / `SKILL_ORDER=['pinyin','hanzi','english']` **不许动**。
- 词课步名仍 拼音/汉字/英语;千字谷/字母林命名皮肤**不做**(非目标)。
- `npm test` 全绿为每任务闸;架构边界守 `src/architecture.test.ts`(settings 面板不 `useService`、features 间不互引)。
- 每次 commit 消息尾附 `Co-Authored-By: Claude Code <noreply@anthropic.com>`。
- 分支 `feat/chinese-domain-merge` 上开发,勿碰 main / 0.2.0 发布线。

---

### Task 1:领域→技能 纯派生函数 + 单测

**Files:**
- Modify: `src/features/lesson/progress-rules.ts`
- Create: `src/features/lesson/progress-rules.test.ts`

**Interfaces:**
- Consumes: `SkillKey`(来自 `@/shared/services`)
- Produces:
  - `export const DOMAIN_SKILLS: Record<'chinese' | 'english', readonly SkillKey[]>` = `{ chinese: ['pinyin', 'hanzi'], english: ['english'] }`
  - `export function enabledSkillsFor(on: { enableChinese: boolean; enableEnglish: boolean }): SkillKey[]` — 按 `['chinese','english']` 顺序展开,返回 `SKILL_ORDER` 内技能;两域全关返 `[]`。

本任务**不接线**任何消费方,纯新增+测试,独立绿。

- [ ] **Step 1:写失败测试**

在 `src/features/lesson/progress-rules.ts` 顶部 import 下新增两个导出(先只写空实现占位会让 Step 3 才填,但本步先建测试文件):

创建 `src/features/lesson/progress-rules.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { DOMAIN_SKILLS, enabledSkillsFor } from './progress-rules'

describe('领域 → 技能映射', () => {
  it('汉语域捆绑拼音+汉字两技能', () => {
    expect(DOMAIN_SKILLS.chinese).toEqual(['pinyin', 'hanzi'])
    expect(DOMAIN_SKILLS.english).toEqual(['english'])
  })

  it('enabledSkillsFor 双域开 → 三技能按 SKILL_ORDER 序', () => {
    expect(enabledSkillsFor({ enableChinese: true, enableEnglish: true })).toEqual(['pinyin', 'hanzi', 'english'])
  })

  it('只开汉语 → 拼音+汉字;只开英语 → 英语', () => {
    expect(enabledSkillsFor({ enableChinese: true, enableEnglish: false })).toEqual(['pinyin', 'hanzi'])
    expect(enabledSkillsFor({ enableChinese: false, enableEnglish: true })).toEqual(['english'])
  })

  it('双域关 → 空列表(消费侧 stepsFor 兜底英语)', () => {
    expect(enabledSkillsFor({ enableChinese: false, enableEnglish: false })).toEqual([])
  })
})
```

- [ ] **Step 2:跑测试确认失败**

Run: `npx vitest run src/features/lesson/progress-rules.test.ts`
Expected: FAIL —— `DOMAIN_SKILLS`/`enabledSkillsFor` not defined。

- [ ] **Step 3:最小实现**

在 `src/features/lesson/progress-rules.ts` 的 `SKILL_ORDER` 定义之后新增:

```ts
// 领域→技能 捆绑(汉语=拼音+汉字,不可拆;英语=英语)。语义属主 lesson。
export const DOMAIN_SKILLS: Record<'chinese' | 'english', readonly SkillKey[]> = {
  chinese: ['pinyin', 'hanzi'],
  english: ['english'],
}

/** 领域启用 → 技能列表,顺序恒 SKILL_ORDER(汉语两技能在前、英语在后)。双关返空,消费侧兜底。 */
export function enabledSkillsFor(on: { enableChinese: boolean; enableEnglish: boolean }): SkillKey[] {
  const out: SkillKey[] = []
  if (on.enableChinese) out.push(...DOMAIN_SKILLS.chinese)
  if (on.enableEnglish) out.push(...DOMAIN_SKILLS.english)
  return out
}
```

- [ ] **Step 4:跑测试确认通过**

Run: `npx vitest run src/features/lesson/progress-rules.test.ts`
Expected: PASS(4 例)

- [ ] **Step 5:回归确认 + 提交**

Run: `npx vitest run src/features/lesson src/shared/services 2>&1 | tail -20`
Expected: 无关全绿(本任务不接线,不应破坏任何既有测试)。

```bash
git add src/features/lesson/progress-rules.ts src/features/lesson/progress-rules.test.ts
git commit -m "feat(lesson): 领域→技能 纯派生(enabledSkillsFor) + 单测
Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2:UserSettings 字段翻转到领域 + 默认/API/规则接线(前端模型并轨)

**Files:**
- Modify: `src/shared/services/settings.ts`(DomainKey/DOMAIN_ORDER/enableKeyOf + UserSettings 字段替换)
- Modify: `src/features/settings-state/settings.ts`(`defaultSettings()` 双域开)
- Modify: `src/features/lesson/progress-rules.ts`(`enabledSkills` 改走 `enabledSkillsFor`)
- Modify: `src/features/settings/SettingsPanel.tsx`(逐技能行 → 逐域行)
- Modify: `src/features/settings/SettingsEntry.tsx`(传 `DOMAIN_ORDER`)
- Modify: `src/features/foundation/ColdStartWizard.tsx`(门改 `enableChinese`)
- Modify: `src/features/api/api.ts`(`isSettings` + `putSettings` 双键)
- Test: `src/features/lesson/lesson.test.ts`、`src/features/settings/SettingsEntry.test.tsx`、`src/features/settings-state/settings.test.ts`、`src/features/api/api.test.ts`、`src/features/foundation/ColdStartWizard.test.tsx`、`src/features/lesson/WordLesson.test.tsx`、`src/features/lesson/LessonEntry.test.tsx`、`src/features/archipelago/HomeEntry.test.tsx`、`src/app/App.test.tsx`、`src/features/auth/auth.test.ts`、`src/features/progress/progress.test.ts`、`src/features/lesson/progress.test.ts`、`src/features/lesson/settlement.test.ts`、`src/features/foundation/basics-service.test.ts`、`src/shared/services/core.test.tsx`(仅夹具字段迁移,见 Step 4 映射)

**Interfaces:**
- Consumes: Task 1 的 `DOMAIN_SKILLS` 不需要(本任务只接线 `enabledSkillsFor`);`DomainKey` 类型新定义于此
- Produces:
  - `export type DomainKey = 'chinese' | 'english'`(shared/services/settings.ts)
  - `export const DOMAIN_ORDER: readonly DomainKey[] = ['chinese', 'english']`(shared)
  - `export function enableKeyOf(d: DomainKey): 'enableChinese' | 'enableEnglish'`(shared)
  - `UserSettings = { enableChinese: boolean; enableEnglish: boolean; earnedAchievements: string[]; consecutiveDays: number; lastActiveDate: string; updatedAt: string }`

本任务**一个 commit 内**完成类型翻转 + 全部消费方 + 全部夹具,保持 `npm test` 绿;拆分提交会让中间态红。子步按块跑测试定位错误。

- [ ] **Step 1:shared 契约改**

`src/shared/services/settings.ts` 全文改为:

```ts
import type { LoadState, ReactiveService, ServiceToken } from './core'

/** 学习领域(启用粒度;汉语域内部恒捆绑 拼音+汉字 两技能步)。 */
export type DomainKey = 'chinese' | 'english'

export const DOMAIN_ORDER: readonly DomainKey[] = ['chinese', 'english']

export function enableKeyOf(domain: DomainKey): 'enableChinese' | 'enableEnglish' {
  return domain === 'chinese' ? 'enableChinese' : 'enableEnglish'
}

/** 每 user 学习设置(启用领域 + 趣味字段)。 */
export type UserSettings = {
  enableChinese: boolean
  enableEnglish: boolean
  earnedAchievements: string[]
  consecutiveDays: number
  lastActiveDate: string
  updatedAt: string
}

export type SettingsSnapshot = LoadState<UserSettings>

export interface SettingsService extends ReactiveService<SettingsSnapshot> {
  load(): Promise<void>
  save(settings: UserSettings): Promise<void>
}

export const SettingsService = Symbol('SettingsService') as unknown as ServiceToken<SettingsService>
```

- [ ] **Step 2:默认值改**

`src/features/settings-state/settings.ts` `defaultSettings()`:

```ts
export function defaultSettings(): UserSettings {
  return {
    enableChinese: true,
    enableEnglish: true,
    earnedAchievements: [],
    consecutiveDays: 0,
    lastActiveDate: '',
    updatedAt: new Date().toISOString(),
  }
}
```

- [ ] **Step 3:规则接线 + api**

`src/features/lesson/progress-rules.ts`:`enabledSkills` 改为:

```ts
export function enabledSkills(settings: UserSettings): SkillKey[] {
  return enabledSkillsFor({ enableChinese: settings.enableChinese, enableEnglish: settings.enableEnglish })
}
```

`src/features/api/api.ts`:

```ts
function isSettings(value: unknown): value is ApiUserSettings {
  if (!isObject(value)) return false

  return typeof value.enableChinese === 'boolean'
    && typeof value.enableEnglish === 'boolean'
    && Array.isArray(value.earnedAchievements)
    && value.earnedAchievements.every((achievement) => typeof achievement === 'string')
    && typeof value.consecutiveDays === 'number'
    && Number.isFinite(value.consecutiveDays)
    && typeof value.lastActiveDate === 'string'
}
```

`putSettings` body 构造去 `enablePinyin/enableHanzi/enableEnglish` 三行,改传 `enableChinese/enableEnglish` 两键(其余键原样)。

- [ ] **Step 4:全仓夹具字段迁移(机械,照映射改)**

对每个含 `enablePinyin/enableHanzi/enableEnglish` 键的测试文件:把字面量三键替换为领域两键。映射规则(按**意图**,非机械同名):

| 旧意图(曾开哪些技能) | 新领域字段 |
|---|---|
| 拼音+汉字 都开,英语关 | `enableChinese: true, enableEnglish: false` |
| 英语 开,拼音/汉字 关 | `enableChinese: false, enableEnglish: true` |
| 三者全开(默认) | `enableChinese: true, enableEnglish: true` |
| 只开拼音 | `enableChinese: true, enableEnglish: false`(原「拼音-only」用例重写,见下) |
| 只开汉字 | 同上 `enableChinese: true`(原用例删除,域不可拆) |

涉及文件:见上方 Files→Test 清单里除专门改写外的全部(lesson.test、SettingsEntry.test 属专门改写,Step 5 给全文)。常见夹具是 `{ enablePinyin: true, enableHanzi: true, enableEnglish: true, earnedAchievements: [], ... }` → `{ enableChinese: true, enableEnglish: true, ... }`。

> 凡原测试是「三技能里关掉一个留两个」(如 拼音+英语、汉字+英语)的减步场景:领域语义下**无等价域组合**,按断言意图重表达——想要「中文两步」用 `enableChinese:true, enableEnglish:false`;想「单步英语」用 `enableChinese:false, enableEnglish:true`。

Run: `npx vitest run 2>&1 | tail -40` 逐一修到只剩 Step 5 那类行为断言错。

- [ ] **Step 5:行为断言改写(lesson.test / SettingsEntry.test / 冷启动 / 面板)**

`src/features/lesson/lesson.test.ts` 改为领域语义:

```ts
import { describe, expect, it } from 'vitest'
import { firstTargetId, fullComplete, stepsFor } from './lesson'
import type { UserSettings, WordProgress } from '@/shared/services'

const allOn = (): UserSettings => ({ enableChinese: true, enableEnglish: true, earnedAchievements: [], consecutiveDays: 0, lastActiveDate: '', updatedAt: '' })
const p = (over: Partial<WordProgress> = {}): WordProgress => ({
  wordId: 1, completed: { pinyin: false, hanzi: false, english: false }, starsEarned: 0, updatedAt: '', ...over,
})
const vocabulary = Array.from({ length: 100 }, (_, index) => ({ id: index + 1 }))

describe('lesson 步序与完成', () => {
  it('stepsFor 双域开 → 三技能按序', () => {
    expect(stepsFor(allOn())).toEqual(['pinyin', 'hanzi', 'english'])
  })

  it('只开汉语 → 两中文层;只开英语 → 英语一步', () => {
    expect(stepsFor({ ...allOn(), enableEnglish: false })).toEqual(['pinyin', 'hanzi'])
    expect(stepsFor({ ...allOn(), enableChinese: false })).toEqual(['english'])
  })

  it('全关强制英语兜底', () => {
    expect(stepsFor({ enableChinese: false, enableEnglish: false, earnedAchievements: [], consecutiveDays: 0, lastActiveDate: '', updatedAt: '' })).toEqual(['english'])
  })

  it('fullComplete 只看启用领域内技能', () => {
    const donePy = p({ completed: { pinyin: true, hanzi: false, english: false } })
    // 汉语域开 → 拼音+汉字都过才算全
    expect(fullComplete(donePy, allOn())).toBe(false)
    expect(fullComplete(donePy, { ...allOn(), enableEnglish: false })).toBe(false)
    const doneZh = p({ completed: { pinyin: true, hanzi: true, english: false } })
    expect(fullComplete(doneZh, { ...allOn(), enableEnglish: false })).toBe(true)
    // 英语-only 域:英语过即全
    expect(fullComplete(p({ completed: { pinyin: false, hanzi: false, english: true } }), { ...allOn(), enableChinese: false })).toBe(true)
    expect(fullComplete(undefined, allOn())).toBe(false)
  })

  it('firstTargetId 找到首个未完成词', () => {
    const words: Record<number, WordProgress> = {}
    for (const w of vocabulary.slice(0, 5)) {
      words[w.id] = p({ wordId: w.id, completed: { pinyin: true, hanzi: true, english: true } })
    }
    expect(firstTargetId(words, allOn(), vocabulary)).toBe(6)
    expect(firstTargetId({}, allOn(), vocabulary)).toBe(1)
  })

  it('全部完成返回 101', () => {
    const words: Record<number, WordProgress> = {}
    for (const w of vocabulary) words[w.id] = p({ wordId: w.id, completed: { pinyin: true, hanzi: true, english: true } })
    expect(firstTargetId(words, allOn(), vocabulary)).toBe(101)
  })
})
```

`src/features/settings/SettingsPanel.tsx` 全文(域两行,防全关按域):

```tsx
import { X } from 'lucide-react'
import { cn } from '@/shared/ui/utils'
import type { DomainKey, UserSettings } from '@/shared/services'
import { enableKeyOf } from '@/shared/services'
import { Button } from '@/shared/ui/button'

export type SettingsPanelProps = {
  settings: UserSettings
  domainOrder: readonly DomainKey[]
  onChange: (next: UserSettings) => void
  onClose: () => void
}

const DOMAIN_LABEL: Record<DomainKey, string> = { chinese: '汉语', english: '英语' }

export function SettingsPanel({ settings, domainOrder, onChange, onClose }: SettingsPanelProps) {
  function toggle(domain: DomainKey) {
    const key = enableKeyOf(domain)
    // 防全关:若正在关闭的域是唯一开启域,拒绝(保持选中)。
    if (settings[key] && domainOrder.every((d) => d === domain || !settings[enableKeyOf(d)])) return
    onChange({ ...settings, [key]: !settings[key], updatedAt: new Date().toISOString() })
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-sm rounded-[1.75rem] border border-hairline bg-surface p-5 shadow-pop">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">学习设置</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="关闭">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="space-y-3">
          {domainOrder.map((domain) => {
            const on = settings[enableKeyOf(domain)]
            return (
              <button
                key={domain}
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() => toggle(domain)}
                className="flex w-full items-center justify-between rounded-2xl border border-hairline bg-surface-2 px-4 py-3 text-left"
              >
                <span className="text-[15px] font-semibold">{DOMAIN_LABEL[domain]} 学习</span>
                <span
                  className={cn(
                    'relative h-6 w-11 rounded-full transition-colors',
                    on ? 'bg-emerald' : 'bg-ink/20',
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                      on ? 'translate-x-[22px]' : 'translate-x-0.5',
                    )}
                  />
                </span>
              </button>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-ink-3">至少保留一个学习领域。设置会同步到本设备。</p>
        <Button size="lg" className="mt-4 w-full" onClick={onClose}>
          完成
        </Button>
      </div>
    </div>
  )
}
```

> 注意:`SettingsEntry.test` 里 `panelSource` 断言面板无 `useService`/无 `@/features/` 依赖仍成立(新面板只引 shared + lucide + ui)。

`src/features/settings/SettingsEntry.tsx`:去掉 `useService(ProgressRulesService)`,改用共享 `DOMAIN_ORDER`:

```tsx
import { DOMAIN_ORDER, SettingsService } from '@/shared/services'
import { useService, useServiceSnapshot } from '@/shared/services/core'
import type { UserSettings } from '@/shared/services'
import { SettingsPanel } from './SettingsPanel'

export type SettingsEntryProps = { onClose: () => void }

export function SettingsEntry({ onClose }: SettingsEntryProps) {
  const settingsService = useService(SettingsService)
  const snapshot = useServiceSnapshot(settingsService)
  const settings = snapshot.data

  function change(next: UserSettings) {
    void settingsService.save(next)
  }

  return (
    <SettingsPanel
      settings={settings}
      domainOrder={DOMAIN_ORDER}
      onChange={change}
      onClose={onClose}
    />
  )
}
```

`src/features/foundation/ColdStartWizard.tsx`:门两处 `settings.enablePinyin` → `settings.enableChinese`,deps 数组同步改 `[settings.enableChinese, settings.enableEnglish]`(track 名仍 `'pinyin'`,汉字无轨,见 spec §2)。其测试内把只开拼音的夹具改成 `enableChinese: true, enableEnglish: false` 并断言仍抽 pinyin 探针。

`src/features/settings/SettingsEntry.test.tsx` 更新为:

```tsx
const settings: UserSettings = {
  enableChinese: true,
  enableEnglish: true,
  earnedAchievements: [],
  consecutiveDays: 0,
  lastActiveDate: '',
  updatedAt: '2026-09-05T00:00:00.000Z',
}
```

第一条用例改:关英语 → `save` 收到 `enableEnglish: false` 且 `(next.enableChinese || next.enableEnglish)` 为 true;再补一条:双关被面板拦(先关英语再关汉语,第二次 click 不触发 save)。

> SettingsEntry 不再用 `ProgressRulesService`,该测试里 `registerSettings()` 的 `registry.register(ProgressRulesService, …)` 与 `import { createProgressRulesService } from '@/features/lesson'` 会变未用 → 一并删,避免 oxlint unused 报错。

- [ ] **Step 6:全绿 + 提交**

Run: `npm test`
Expected: 全绿(含 architecture;面板保持纯视图断言通过)。

```bash
git add -A
git commit -m "feat(settings): 启用模型并轨 2 领域开关(汉语=拼音+汉字/英语)

UserSettings 字段 enablePinyin/Hanzi/English → enableChinese/English;面板/冷启动/api/默认值接线;规则经 enabledSkillsFor 派生;夹具全迁移,单测绿。

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3:worker 读写领域列 + 迁移 0004

**Files:**
- Modify: `worker/settings.ts`
- Create: `migrations/0004_chinese_domain.sql`

**Interfaces:**
- Consumes: 前端 PUT 体字段 `enableChinese/enableEnglish`(Task 2)
- Produces: DB `user_settings.enable_chinese` 列(`DEFAULT 1`);GET 返 `enableChinese/enableEnglish`;PUT 双关 400「至少保留一个学习领域」

- [ ] **Step 1:迁移文件**

创建 `migrations/0004_chinese_domain.sql`:

```sql
-- 汉语领域并轨:settings 启用粒度 3 技能 → 2 领域(汉语=拼音+汉字 / 英语)。
-- additive:仅加列,不改 0001 基线;旧 enable_pinyin/enable_hanzi 保留不删、新代码停用。
ALTER TABLE user_settings ADD COLUMN enable_chinese INTEGER NOT NULL DEFAULT 1;
-- 旧行连续性:任一侧旧开过汉语技能 → 域开;纯英语/零汉语旧配置不静默塞回汉语。
UPDATE user_settings SET enable_chinese = (enable_pinyin | enable_hanzi);
```

- [ ] **Step 2:本地应用迁移**

Run: `npm run db:local`
Expected: `0004_chinese_domain.sql` applied(d1_migrations 记录)。

- [ ] **Step 3:worker 读写改**

`worker/settings.ts` 全文替换为:

```ts
import { getAuthenticatedUser } from './_lib/auth'
import { jsonResponse } from './_lib/http'
import type { Env } from './index'

type SettingsRow = { enable_chinese: number; enable_english: number
  earned_achievements: string | null; consecutive_days: number | null; last_active_date: string | null
}

function parseEarned(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch { return [] }
}

function toEnabled(s: { enableChinese?: unknown; enableEnglish?: unknown }) {
  const zh = s.enableChinese === true
  const en = s.enableEnglish === true
  if (!zh && !en) return null
  return { zh, en }
}

export async function handleGetSettings(request: Request, env: Env): Promise<Response> {
  const user = await getAuthenticatedUser(request, env)
  if (!user) return jsonResponse({ message: '未授权' }, { status: 401 })
  const row = (await env.DB.prepare(
    `SELECT enable_chinese, enable_english, earned_achievements, consecutive_days, last_active_date
     FROM user_settings WHERE user_id = ?`,
  ).bind(user.id).first<SettingsRow>())
  if (!row) {
    return jsonResponse({
      settings: { enableChinese: true, enableEnglish: true,
        earnedAchievements: [], consecutiveDays: 0, lastActiveDate: '' },
    })
  }
  return jsonResponse({
    settings: {
      enableChinese: row.enable_chinese === 1,
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
    settings?: { enableChinese?: unknown; enableEnglish?: unknown;
      earnedAchievements?: unknown; consecutiveDays?: unknown; lastActiveDate?: unknown }
  } | null
  const s = body?.settings
  if (!s) return jsonResponse({ message: '设置不合法' }, { status: 400 })
  const en = toEnabled(s)
  if (!en) return jsonResponse({ message: '至少保留一个学习领域' }, { status: 400 })
  const earned = Array.isArray(s.earnedAchievements)
    ? s.earnedAchievements.filter((x): x is string => typeof x === 'string')
    : []
  const consecutive = typeof s.consecutiveDays === 'number' && Number.isFinite(s.consecutiveDays)
    ? Math.max(0, Math.floor(s.consecutiveDays))
    : 0
  const lastDate = typeof s.lastActiveDate === 'string' ? s.lastActiveDate.slice(0, 10) : ''
  await env.DB.prepare(
    `INSERT INTO user_settings
       (user_id, enable_chinese, enable_english, earned_achievements, consecutive_days, last_active_date, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       enable_chinese=excluded.enable_chinese, enable_english=excluded.enable_english,
       earned_achievements=excluded.earned_achievements, consecutive_days=excluded.consecutive_days,
       last_active_date=excluded.last_active_date, updated_at=excluded.updated_at`,
  ).bind(user.id, en.zh ? 1 : 0, en.en ? 1 : 0,
    JSON.stringify(earned), consecutive, lastDate, new Date().toISOString()).run()
  return jsonResponse({ ok: true })
}
```

- [ ] **Step 4:构建 + 单测回归**

Run: `npm test && npm run lint && npm run build`
Expected: 全绿;`build` 过(前端 tsc+vite;worker 由 wrangler 编译,无单测,靠 build/lint 兜语法)。

- [ ] **Step 5:提交**

```bash
git add migrations/0004_chinese_domain.sql worker/settings.ts
git commit -m "feat(worker): settings 读写作领域列 + 迁移 0004 enable_chinese

worker GET/PUT 双域读写;PUT 双关 400;0004 加 enable_chinese(DEFAULT 1)回填旧任一侧汉语技能开即域开;旧列保留停用。

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4:文档事实同步 + 收口验收

**Files:**
- Modify: `docs/dev-reference.md`
- Modify: `docs/PLAN.md`(feature 轨 0.3.0 行补 plan 链接)

**Interfaces:**
- Consumes: 前序任务产出的最终事实(字段/列/面板 prop)

- [ ] **Step 1:dev-reference 同步事实**

- 数据模型表一节:user_settings 列列出 `enable_chinese`/`enable_english`(注明旧 `enable_pinyin/enable_hanzi` 停用保留),并去掉 `enable_pinyin/enable_hanzi/enable_english` 的描述。
- 前端类型归属:`UserSettings`(`enableChinese/enableEnglish` + 趣味字段)行替换。
- 前端 3 层明细:settings 分区括号改「`SettingsPanel` 纯 UI 收 `domainOrder` prop」;progress-rules 描述改「`DOMAIN_SKILLS`/`enabledSkillsFor` + `enabledSkills` 域推导」。

- [ ] **Step 2:PLAN 行补链接**

feature 轨 0.3.0 汉语并轨行末追加 ` / [plan](superpowers/plans/2026-09-08-chinese-domain-merge.md)`。

- [ ] **Step 3:全量验收**

Run: `npm test && npm run lint && npm run build`
Expected: 全绿。浏览器手工验收(可委托 run skill / 人工):
- 设置面板两行 汉语/英语;关英语后词课只跑 拼音+汉字 两步;只开英语 → 一步。
- 双关被面板拦;旧库(0001+0002+0003 已 apply)迁移 0004 后,纯英语旧配置仍英语-only。

- [ ] **Step 4:提交**

```bash
git add docs/dev-reference.md docs/PLAN.md
git commit -m "docs: 汉语域并轨 dev-reference 事实 + PLAN 轨链接同步
Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Self-Review(计划自查)

- **Spec 覆盖**:§3.1 映射→Task1;§3.2 类型→Task2;§3.3 消费点(面板/入口/冷启动/api/worker)→Task2+Task3;§3.4 迁移 0004→Task3;§4 语义(only-one-domain/fullComplete)→Task2 测试;§5 边界明确不implement;§6 兼容回滚→Task3+spec 已述;§7 测试验收→各 Task 闸+Task4;§8 落地方式→Global Constraints。dev-reference 同步→Task4。
- **占位扫描**:无 TBD/TODO;所有代码改动给到可直接粘贴的最终形态;夹具迁移给映射表而非「自行处理」。
- **类型一致性**:`enableKeyOf`/`DOMAIN_ORDER`/`DOMAIN_SKILLS`/`enabledSkillsFor`/`enableChinese/enableEnglish` 全计划同名同参;`settings-state` 默认、api、worker、面板全用同一对键。
