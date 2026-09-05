# foundation-learning 核心(数据/熟度/持久化/服务)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立基础引导层的领域核心:基础单元目录 + 100 词拆解 + 熟度估计器 + 服务端持久化 + 前端响应式服务;应用现有词课零改动、全程可测可跑。

**Architecture:** 新建 `features/foundation` 独立 feature(自包含纯逻辑 + 数据 + 工厂),契约经 `shared/services`(同名 token)流出;新增 additive 表 `basics_progress` + worker GET/PUT handler + `ApiService` 两方法。本 plan 不触 UI:词课插入、冷启动诊断、TeachOverlay 在 plan B(2026-09-05-foundation-learning-embed.md)。

**Tech Stack:** TypeScript / Vitest / Cloudflare Workers(D1,手写路由)/ React 服务注册模式(registry + ServiceToken)。

**Spec:** `docs/superpowers/specs/2026-09-05-foundation-learning-design.md`

## Global Constraints

- 3 层铁律(`src/architecture.test.ts` 强制):shared 不得 import features|app;feature 不得 import 其它 feature|app;`useService` 仅限 `<Name>Entry.tsx` 与 app 组装;`registry.register` 仅 `app/bootstrap.ts`。
- feature 数据/规则按语义属主;跨 feature 消费经 shared 契约服务(token 同名一体,`services/index.ts` barrel 出口)。
- 数据类随服务契约归属(本 plan 新增 `services/basics-progress.ts`、`services/foundation.ts`)。
- worker 只做行级读写、按 `user_id` 隔离、不解析业务语义;未授权 401。
- 迁移:不改 `0001_init.sql`,新增数字前缀迁移;新字段/表 additive;线上 apply 走 `/release`。
- UI 文案中文;依赖不新增(worker 无第三方路由库)。
- 现有词课/星尘/结算/称号规则零改动。

---

### Task 1: 基础进度契约(`shared/services/basics-progress.ts`)

**Files:**
- Create: `src/shared/services/basics-progress.ts`
- Modify: `src/shared/services/index.ts`

**Interfaces:**
- Produces:
  - `export type BasicsUnitState = 'learning' | 'known'`
  - `export type BasicsProgressRow = { unitKey: string; state: BasicsUnitState; correctStreak: number; taughtCount: number; updatedAt: string }`
  - `export type ApiBasicsProgressRow = Omit<BasicsProgressRow, 'updatedAt'>`
  - `export type BasicsProgressData = Record<string, BasicsProgressRow>`
  - `export type BasicsProgressSnapshot = LoadState<BasicsProgressData>`
  - `export interface BasicsService extends ReactiveService<BasicsProgressSnapshot> { load(): Promise<void>; recordAnswer(unitKey: string, correct: boolean): Promise<void>; markTaught(unitKeys: readonly string[]): Promise<void>; saveAll(rows: readonly BasicsProgressRow[]): Promise<void> }`
  - `export const BasicsService = Symbol('BasicsService') as unknown as ServiceToken<BasicsService>`

**Consumes:** `LoadState` / `ReactiveService` / `ServiceToken` from `./core`(已有)。

- [ ] **Step 1: 写契约文件**

```ts
import type { LoadState, ReactiveService, ServiceToken } from './core'

/** 基础单元状态:known 为已掌握,learning 为学习中(行缺失 = 未评估)。 */
export type BasicsUnitState = 'learning' | 'known'

/** 每 user × 每基础单元一行(updatedAt 为前端本地时间戳)。unitKey 形如 'pinyin:b'/'pinyin:ing'/'pinyin:ton2'/'english:a'。 */
export type BasicsProgressRow = {
  unitKey: string
  state: BasicsUnitState
  correctStreak: number
  taughtCount: number
  updatedAt: string
}

/** 服务端行(不含 updatedAt,由前端本地盖戳)。 */
export type ApiBasicsProgressRow = Omit<BasicsProgressRow, 'updatedAt'>

export type BasicsProgressData = Record<string, BasicsProgressRow>
export type BasicsProgressSnapshot = LoadState<BasicsProgressData>

export interface BasicsService extends ReactiveService<BasicsProgressSnapshot> {
  load(): Promise<void>
  /** 一次作答(短教轻测/软提示跟测/诊断):内部经估计器更新该单元后持久化。 */
  recordAnswer(unitKey: string, correct: boolean): Promise<void>
  /** 短教完成:这些单元 taughtCount+1 并持久化。 */
  markTaught(unitKeys: readonly string[]): Promise<void>
  /** 批量权威写入(冷启动诊断基线 / 全量重估),行级 upsert。 */
  saveAll(rows: readonly BasicsProgressRow[]): Promise<void>
}

export const BasicsService = Symbol('BasicsService') as unknown as ServiceToken<BasicsService>
```

- [ ] **Step 2: barrel 导出**

在 `src/shared/services/index.ts` 适当位置加三行:

```ts
export type { ApiBasicsProgressRow, BasicsProgressData, BasicsProgressRow, BasicsProgressSnapshot, BasicsUnitState } from './basics-progress'
export { BasicsService } from './basics-progress'
```

- [ ] **Step 3: 验证编译与测试未破**

Run: `npm test && npm run build`
Expected: PASS(现状测试全绿,新契约无引用即无影响)。

- [ ] **Step 4: Commit**

```bash
git add src/shared/services/basics-progress.ts src/shared/services/index.ts
git commit -m "feat(foundation): basics-progress 契约(BasicsService + 数据类)"
```

---

### Task 2: 基础辅导契约(`shared/services/foundation.ts`)

**Files:**
- Create: `src/shared/services/foundation.ts`
- Modify: `src/shared/services/index.ts`

**Interfaces:**
- Produces:
  - `export type FoundationNeed = 'mandatory' | 'soft' | 'none'`
  - `export interface FoundationService { unitsFor(wordId: number, skill: SkillKey): readonly string[]; needFor(units: readonly string[], models: Readonly<BasicsProgressData>): FoundationNeed }`
  - `export const FoundationService = Symbol('FoundationService') as unknown as ServiceToken<FoundationService>`
- Consumes: `SkillKey` from `./progress`; `BasicsProgressData` from `./basics-progress`(均同层 shared,允许)。

> `unitsFor` 给词 + 技能 → 该词该技能涉及的全部基础单元 key(如词 21 苹果拼音步 → `['pinyin:p','pinyin:ing','pinyin:ton2','pinyin:g','pinyin:uo','pinyin:ton3']`);`needFor` 据熟度模型判 强制/软/无。wordId 而非 WordUnit,便于调用方无需拉词。hanzi 技能 → `[]`。

- [ ] **Step 1: 写契约文件**

```ts
import type { SkillKey } from './progress'
import type { BasicsProgressData } from './basics-progress'
import type { ServiceToken } from './core'

/** 词课插入判定:强制先学 / 软提示 / 不出现。 */
export type FoundationNeed = 'mandatory' | 'soft' | 'none'

/** 基础教学门面(无状态纯查询,与 ProgressRulesService 同款):跨 feature 消费经 bootstrap 注册。 */
export interface FoundationService {
  /** 词 × 技能 → 涉及的基础单元 key 序列(拼音拆声母/韵母/声调,英语拆字母;汉字技能恒 [])。 */
  unitsFor(wordId: number, skill: SkillKey): readonly string[]
  /** 判定插入档:mandatory(含未评估或 learning 且从未教过)/ soft(learning 且教过)/ none。 */
  needFor(units: readonly string[], models: Readonly<BasicsProgressData>): FoundationNeed
}

export const FoundationService = Symbol('FoundationService') as unknown as ServiceToken<FoundationService>
```

- [ ] **Step 2: barrel 导出**

`src/shared/services/index.ts` 加:

```ts
export type { FoundationNeed, FoundationService } from './foundation'
export { FoundationService } from './foundation'
```

- [ ] **Step 3: 验证**

Run: `npm test && npm run build`
Expected: PASS。

- [ ] **Step 4: Commit**

```bash
git add src/shared/services/foundation.ts src/shared/services/index.ts
git commit -m "feat(foundation): FoundationService 契约(unitsFor + needFor)"
```

---

### Task 3: 熟度估计器(纯函数 + 测试)

**Files:**
- Create: `src/features/foundation/estimator.ts`
- Test: `src/features/foundation/estimator.test.ts`

**Interfaces:**
- Consumes: `BasicsProgressRow` / `BasicsProgressData` from `@/shared/services`(type);`FoundationNeed` from `@/shared/services`.
- Produces(供 later Task 6 服务工厂与 Task 5 needFor 用):
  - `export type UnitModel = Pick<BasicsProgressRow, 'state' | 'correctStreak' | 'taughtCount'>`
  - `export function emptyUnit(): UnitModel` → `{ state: 'learning', correctStreak: 0, taughtCount: 0 }`
  - `export function applyCorrect(u: UnitModel): UnitModel`
  - `export function applyWrong(u: UnitModel): UnitModel`
  - `export function withTaught(u: UnitModel): UnitModel`
  - `export function needFor(units: readonly string[], models: Readonly<BasicsProgressData>): FoundationNeed`
  - `export function toRow(unitKey: string, model: UnitModel): BasicsProgressRow`(补 updatedAt = `new Date().toISOString()`)

语义(逐条对应 spec §5.1/§5.2):`applyCorrect` streak+1,streak≥2 → `known`(已知保持 known);`applyWrong` → `learning` + streak 0(known 也降);`withTaught` taughtCount+1;`needFor`:任一单元「模型缺失 或 learning」且 `taughtCount === 0` → `mandatory`;否则任一「缺失或 learning」→ `soft`;否则 `none`。

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from 'vitest'
import type { BasicsProgressData } from '@/shared/services'
import { applyCorrect, applyWrong, emptyUnit, needFor, toRow, withTaught } from './estimator'

describe('estimator', () => {
  it('correct: streak 累积,2 连对升 known,known 保持', () => {
    expect(applyCorrect(emptyUnit())).toEqual({ state: 'learning', correctStreak: 1, taughtCount: 0 })
    const once = applyCorrect(emptyUnit())
    expect(applyCorrect(once)).toEqual({ state: 'known', correctStreak: 2, taughtCount: 0 })
    const known = { state: 'known' as const, correctStreak: 2, taughtCount: 1 }
    expect(applyCorrect(known)).toEqual({ state: 'known', correctStreak: 3, taughtCount: 1 })
  })

  it('wrong: 回落 learning 且清零,known 也降', () => {
    const known = { state: 'known' as const, correctStreak: 2, taughtCount: 1 }
    expect(applyWrong(known)).toEqual({ state: 'learning', correctStreak: 0, taughtCount: 1 })
  })

  it('taught: taughtCount +1,其余不变', () => {
    expect(withTaught(emptyUnit())).toEqual({ state: 'learning', correctStreak: 0, taughtCount: 1 })
  })

  it('toRow 补 updatedAt', () => {
    const row = toRow('pinyin:p', emptyUnit())
    expect(row.unitKey).toBe('pinyin:p')
    expect(typeof row.updatedAt).toBe('string')
    expect(new Date(row.updatedAt).getTime()).not.toBeNaN()
  })

  it('needFor: 无单元 → none', () => {
    expect(needFor([], {})).toBe('none')
  })

  it('needFor: 未教 learning → mandatory', () => {
    const models: BasicsProgressData = { 'pinyin:p': toRow('pinyin:p', { state: 'learning', correctStreak: 0, taughtCount: 0 }) }
    expect(needFor(['pinyin:p'], models)).toBe('mandatory')
  })

  it('needFor: 缺失单元按未教 learning 处理 → mandatory', () => {
    expect(needFor(['pinyin:ing'], {})).toBe('mandatory')
  })

  it('needFor: 教过仍 learning → soft', () => {
    const models: BasicsProgressData = { 'pinyin:p': toRow('pinyin:p', { state: 'learning', correctStreak: 1, taughtCount: 1 }) }
    expect(needFor(['pinyin:p'], models)).toBe('soft')
  })

  it('needFor: 任一 mandatory 压过 soft', () => {
    const models: BasicsProgressData = {
      'pinyin:p': toRow('pinyin:p', { state: 'learning', correctStreak: 0, taughtCount: 1 }), // soft
      'pinyin:ing': toRow('pinyin:ing', { state: 'learning', correctStreak: 0, taughtCount: 0 }), // mandatory
    }
    expect(needFor(['pinyin:p', 'pinyin:ing'], models)).toBe('mandatory')
  })

  it('needFor: 全 known → none', () => {
    const models: BasicsProgressData = {
      'pinyin:p': toRow('pinyin:p', { state: 'known', correctStreak: 2, taughtCount: 1 }),
      'pinyin:ing': toRow('pinyin:ing', { state: 'known', correctStreak: 3, taughtCount: 1 }),
    }
    expect(needFor(['pinyin:p', 'pinyin:ing'], models)).toBe('none')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/features/foundation/estimator.test.ts`
Expected: FAIL(module not found)。

- [ ] **Step 3: 最小实现**

```ts
import type { BasicsProgressData, BasicsProgressRow, FoundationNeed } from '@/shared/services'

export type UnitModel = Pick<BasicsProgressRow, 'state' | 'correctStreak' | 'taughtCount'>

export function emptyUnit(): UnitModel {
  return { state: 'learning', correctStreak: 0, taughtCount: 0 }
}

export function applyCorrect(u: UnitModel): UnitModel {
  const correctStreak = u.correctStreak + 1
  return { ...u, state: correctStreak >= 2 ? 'known' : u.state, correctStreak }
}

export function applyWrong(u: UnitModel): UnitModel {
  return { ...u, state: 'learning', correctStreak: 0 }
}

export function withTaught(u: UnitModel): UnitModel {
  return { ...u, taughtCount: u.taughtCount + 1 }
}

export function needFor(units: readonly string[], models: Readonly<BasicsProgressData>): FoundationNeed {
  let hasSoft = false
  for (const unit of units) {
    const model = models[unit]
    const u = model ? { state: model.state, correctStreak: model.correctStreak, taughtCount: model.taughtCount } : emptyUnit()
    if (u.state !== 'known' && u.taughtCount === 0) return 'mandatory'
    if (u.state !== 'known') hasSoft = true
  }
  return hasSoft ? 'soft' : 'none'
}

export function toRow(unitKey: string, model: UnitModel): BasicsProgressRow {
  return { unitKey, state: model.state, correctStreak: model.correctStreak, taughtCount: model.taughtCount, updatedAt: new Date().toISOString() }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run src/features/foundation/estimator.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/features/foundation/estimator.ts src/features/foundation/estimator.test.ts
git commit -m "feat(foundation): 熟度估计器(applyCorrect/applyWrong/withTaught/needFor)"
```

---

### Task 4: 基础单元目录 + 100 词拆解(纯数据/算法 + 测试)

**Files:**
- Create: `src/features/foundation/catalogs.ts`
- Create: `src/features/foundation/decompose.ts`
- Test: `src/features/foundation/decompose.test.ts`

**Interfaces:**
- Consumes: `WordUnit` from `@/shared/services`;`WORDS`/`wordById` from `@/features/vocabulary/words.ts`(**同 feature 内直接引**?否 —— `features/vocabulary` 是另一 feature,foundation 不得 import。见注意)。词库经 `VocabularyService.getAllWords()` 注入,纯函数不直引 words.ts。

> ⚠️ **feature 边界修正**:foundation 是独立 feature,不可 `import` vocabulary 的 `words.ts`。拆解纯函数改为接收词列表入参:`decomposeWords(words: readonly WordUnit[])` 或 decompose 函数逐词入参 `decomposeWord(word: WordUnit)`,调用方(service 工厂 / 测试)用 `VocabularyService` 取词喂入。

**领域定义:**
- `PINYIN_INITIALS`:23 项,每项 `{ symbol, anchorHanzi, anchorEmoji }`。符号:声母 23(下)。锚点(示例音节 + 汉字 + emoji)尽量取自词库既有词,教学卡沿用「朗读真相=汉字」。
- `PINYIN_FINALS`:韵母目录,每项 `{ symbol, anchorPinyin, anchorHanzi, anchorEmoji }`。symbol 为规范韵母(含介音组合,如 `uo`/`iang`);词库拆解须全部归口到本目录。
- `PINYIN_TONES`:5 项 `{ symbol: 'ton1'|'ton2'|'ton3'|'ton4'|'ton0', label, anchorHanzi, anchorEmoji }`。
- `ENGLISH_LETTERS`:26 项 `{ symbol('a'…'z'), anchorWord, anchorEmoji }`,锚点用词库词(无则通用小词)。
- `unitKey(track, sym)` 组合器。
- `decomposeWord(word): { pinyin: PinyinSyllable[]; english: EnglishLetter[] }`,其中
  - `PinyinSyllable = { text: string; initial: string | null; final: string; tone: number; unitKeys: string[] }`(unitKeys = 该音节涉及的目录 key:initial 非空则含声母 key、恒含韵母 key、声调非 0 时含 `pinyin:ton{tone}`,轻声 `ton0`;声调见注)
  - `EnglishLetter = { char: string; unitKey: string }`(char 小写)
  - 每词 english 字母序去重后即该词英语单元。
- `unitsFor(wordId, skill, words): readonly string[]`(skill hanzi → [];pinyin → 各音节 unitKeys 去重;english → 字母 unitKeys 去重)—— Task 5 service 工厂复用。

**拼音拆解算法(两拼口径,spec §4.1 注):**
1. 按空格切音节;每音节去声调号 → 得声调 `tone`(āáǎà→1-4;有调号音节 tone = 该调;无声调号 → tone 0 轻声;`ü` 的调号在 `ü` 上,先还原 `ü` 底字母再判调)。
2. 音节尾残留候选:先试最长声母前缀(`zh/ch/sh` 优先于单字母),剩余为韵母文本;若剩余不在 `PINYIN_FINALS`(含 y/w·j/q/x 后的 ü 正写法归一:`y+e→ie`、`y+u→ü`、`y+un→ün`、`y+ue→üe`、`y+uan→üan` 等由 `Y_W_SPELLINGS` 表处理),则降级零声母整音节查表。
3. 产出归口 key;任一步失败抛错(测试兜住)。

> 拆解正确性由测试驱动:全 100 词「拆解 → 重组 == 原词」round-trip + 每词拆出 unit 全部能在目录找到锚点。任一不符即红,实现者按失败扩充 `PINYIN_FINALS` / `Y_W_SPELLINGS` / 锚点数据。**目录与拆解以 100 词实测为准,不在本 plan 预穷举**(避免凭记忆写错韵母/锚点)。

- [ ] **Step 1: 写目录 + 拆解实现**

`catalogs.ts` 骨架(实现者按上述定义写全;以下为结构样例 + 关键常量起点,不得删节接口):

```ts
export type TrackKey = 'pinyin' | 'english'

export type PinyinAnchor = { symbol: string; anchorPinyin: string; anchorHanzi: string; anchorEmoji: string }
export type InitialUnit = { symbol: string; anchorPinyin: string; anchorHanzi: string; anchorEmoji: string }
export type ToneUnit = { symbol: string; label: string; anchorPinyin: string; anchorHanzi: string; anchorEmoji: string }
export type EnglishLetter = { symbol: string; anchorWord: string; anchorEmoji: string }

export function unitKey(track: TrackKey, sym: string): string {
  return `${track}:${sym}`
}
// 数据常量: PINYIN_INITIALS: InitialUnit[] / PINYIN_FINALS: PinyinAnchor[] / PINYIN_TONES: ToneUnit[] / ENGLISH_LETTERS: EnglishLetter[]
// 目录需含:声母 23 全、声调 ton1..ton4+ton0、字母 a..z 全。
```

`decompose.ts`:按 §算法实现 `decomposeWord(word)`、`unitsFor(wordId, skill, words)`;导出 `Y_W_SPELLINGS`(只读映射,实现者按词库实测补齐)。

- [ ] **Step 2: 写失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { WORDS } from '@/features/vocabulary/words'
import { decomposeWord, unitsFor } from './decompose'
import { PINYIN_FINALS, PINYIN_INITIALS, PINYIN_TONES, ENGLISH_LETTERS } from './catalogs'
import { wordById } from '@/features/vocabulary/words'

const catalogSymbols = new Set<string>([
  ...PINYIN_INITIALS.map(u => `pinyin:${u.symbol}`),
  ...PINYIN_FINALS.map(u => `pinyin:${u.symbol}`),
  ...PINYIN_TONES.map(u => `pinyin:${u.symbol}`),
  ...ENGLISH_LETTERS.map(u => `english:${u.symbol}`),
])

describe('catalogs 完整性', () => {
  it('声母 23 且符号唯一', () => {
    expect(PINYIN_INITIALS).toHaveLength(23)
    expect(new Set(PINYIN_INITIALS.map(u => u.symbol)).size).toBe(23)
  })
  it('声调 ton1..ton4 + ton0', () => {
    expect(PINYIN_TONES.map(t => t.symbol)).toEqual(['ton1', 'ton2', 'ton3', 'ton4', 'ton0'])
  })
  it('英文字母 26 唯一', () => {
    expect(ENGLISH_LETTERS).toHaveLength(26)
    expect(new Set(ENGLISH_LETTERS.map(u => u.symbol)).size).toBe(26)
  })
  it('锚点汉字/emoji 非空且不重复', () => {
    const all = [...PINYIN_INITIALS, ...PINYIN_FINALS, ...PINYIN_TONES]
    for (const u of all) {
      expect(u.anchorHanzi.length).toBeGreaterThan(0)
      expect(u.anchorEmoji.length).toBeGreaterThan(0)
    }
  })
})

describe('decompose 全 100 词', () => {
  it('每词可拆,拼音 round-trip == 原文本', () => {
    for (const word of WORDS) {
      const parts = decomposeWord(word)
      expect(parts.english.length).toBeGreaterThan(0)
      const joined = parts.pinyin.map(s => s.text).join(' ')
      expect(joined).toBe(word.pinyin) // 重组精确复原(含声调)
      for (const s of parts.pinyin) {
        for (const key of s.unitKeys) expect(catalogSymbols.has(key)).toBe(true)
      }
      for (const l of parts.english) expect(catalogSymbols.has(l.unitKey)).toBe(true)
    }
  })
  it('unitsFor 命中词 21 苹果拼音含声母 p/韵母 ing/声调 2', () => {
    const word = wordById(21)!
    const keys = unitsFor(21, 'pinyin', WORDS)
    expect(keys).toContain('pinyin:p')
    expect(keys).toContain('pinyin:ing')
    expect(keys).toContain('pinyin:ton2')
  })
  it('hanzi 技能恒无基础单元', () => {
    expect(unitsFor(21, 'hanzi', WORDS)).toEqual([])
  })
})
```

- [ ] **Step 3: 运行确认失败**

Run: `npx vitest run src/features/foundation/decompose.test.ts`
Expected: FAIL(实现未完成 / 词 21 断言未过)。实现者据此把 `catalogs` 全表与 `Y_W_SPELLINGS` 补齐至全绿——此步即 100 词拆解数据定稿。

- [ ] **Step 4: 实现至全绿(迭代:红 → 扩表 → 绿)**

Run: `npx vitest run src/features/foundation/decompose.test.ts`
Expected: PASS(全 100 词 round-trip + 目录归属 + 锚点完整)。

> 该测试是 100 词拆解的**质量闸门**(spec §4.2),跑绿后拆解数据视为定稿;后续改词库须经此测试。

- [ ] **Step 5: 全量回归**

Run: `npm test`
Expected: PASS(architecture 边界依旧绿:foundation 未 import 其它 feature——`WORDS` 仅测试文件引,生产 decompose 以入参注入)。

- [ ] **Step 6: Commit**

```bash
git add src/features/foundation/catalogs.ts src/features/foundation/decompose.ts src/features/foundation/decompose.test.ts
git commit -m "feat(foundation): 基础单元目录 + 100 词拼音/英语拆解(round-trip 质量闸门)"
```

---

### Task 5: FoundationService 工厂 + 注册

**Files:**
- Create: `src/features/foundation/service.ts`
- Create: `src/features/foundation/index.ts`
- Modify: `src/app/bootstrap.ts`
- Test: `src/features/foundation/service.test.ts`

**Interfaces:**
- Consumes: `decompose.ts` 的 `unitsFor`;`estimator.ts` 的 `needFor`/`toRow`;`VocabularyService`(取词);`FoundationService` token + `BasicsProgressData` type。
- Produces: `export function createFoundationService(vocabulary: VocabularyService): FoundationService`;`features/foundation/index.ts` 统一出口。

> 与 `ProgressRulesService` 同款无状态门面:`unitsFor(wordId, skill)` 内部经 vocabulary 取词 → `unitsFor(wordId, skill, words)`;`needFor` 直透。词汇注入以绕过 feature 互引。

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from 'vitest'
import type { BasicsProgressData } from '@/shared/services'
import { createFoundationService } from './service'
import { createVocabularyService } from '@/features/vocabulary'

const vocab = createVocabularyService()

describe('FoundationService', () => {
  it('unitsFor 经 vocabulary 取词拆解', () => {
    const svc = createFoundationService(vocab)
    const keys = svc.unitsFor(21, 'pinyin')
    expect(keys).toContain('pinyin:p')
  })
  it('needFor 判强制', () => {
    const svc = createFoundationService(vocab)
    const models: BasicsProgressData = {}
    expect(svc.needFor(svc.unitsFor(21, 'pinyin'), models)).toBe('mandatory')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/features/foundation/service.test.ts`
Expected: FAIL。

- [ ] **Step 3: 实现工厂 + index + bootstrap 注册**

`service.ts`:

```ts
import type { BasicsProgressData, FoundationService, SkillKey, VocabularyService } from '@/shared/services'
import { unitsFor } from './decompose'
import { needFor } from './estimator'

export function createFoundationService(vocabulary: VocabularyService): FoundationService {
  return {
    unitsFor: (wordId: number, skill: SkillKey) => {
      if (skill === 'hanzi') return []
      const word = vocabulary.wordById(wordId)
      if (!word) return []
      return unitsFor(wordId, skill, vocabulary.getAllWords())
    },
    needFor: (units, models: Readonly<BasicsProgressData>) => needFor(units, models),
  }
}
```

`index.ts`:

```ts
export { createFoundationService } from './service'
```

`bootstrap.ts`:顶部加 `import { createFoundationService } from '@/features/foundation'`,`ALL_SERVICE_TOKENS` 加 `FoundationService`;在 `VocabularyService` 注册后加:

```ts
registry.register(FoundationService, createFoundationService(vocabulary))
```

> `ALL_SERVICE_TOKENS.every(has)` 幂等守卫同步含 FoundationService(registry 内未注册会先注册全套,无碍)。

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run src/features/foundation/service.test.ts`
Expected: PASS。

- [ ] **Step 5: 全量回归(架构测试验证 bootstrap 注册点合法)**

Run: `npm test && npm run build`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add src/features/foundation/service.ts src/features/foundation/index.ts src/features/foundation/service.test.ts src/app/bootstrap.ts
git commit -m "feat(foundation): FoundationService 注册(unitsFor + needFor 门面)"
```

---

### Task 6: 服务端持久化(迁移 0003 + worker handlers + 路由)

**Files:**
- Create: `migrations/0003_basics.sql`
- Create: `worker/basics.ts`
- Modify: `worker/index.ts`

**Interfaces:**
- Produces: worker `GET /api/basics-progress` → `{ rows: ApiBasicsProgressRow[] }`;`PUT /api/basics-progress` body `{ rows }` → `{ ok: true, updated }`。
- Consumes: `getAuthenticatedUser` from `./_lib/auth`;`jsonResponse` from `./_lib/http`;`Env` type。

表结构/校验规范(逐条对应 spec §6):unitKey 白名单正则 `^[a-z]+:[A-Za-z0-9]+$`;state ∈ {learning,known};correctStreak/taughtCount 非负整数(服务端取 `Math.max(0, floor)`);单批 ≤ 200;行级 upsert latest-wins;按 user_id 隔离;GET 按 unit_key 排序。worker 不解析单元语义。

- [ ] **Step 1: 写迁移**

`migrations/0003_basics.sql`:

```sql
-- 基础引导:每 user × 每基础单元一行(声母/韵母/声调/英文字母熟度)。
-- additive:仅新增表,不改动 0001 基线与现有表,旧代码回滚无视本表。
CREATE TABLE IF NOT EXISTS basics_progress (
  user_id        INTEGER NOT NULL,
  unit_key       TEXT    NOT NULL,
  state          TEXT    NOT NULL,
  correct_streak INTEGER NOT NULL DEFAULT 0,
  taught_count   INTEGER NOT NULL DEFAULT 0,
  updated_at     TEXT    NOT NULL,
  PRIMARY KEY (user_id, unit_key)
);
```

- [ ] **Step 2: 本地应用迁移**

Run: `npm run db:local`
Expected: `0003_basics` 应用成功;`.wrangler/state` 无错。

- [ ] **Step 3: 写 worker handler**

`worker/basics.ts`(仿 `worker/progress.ts` 风格):

```ts
import { getAuthenticatedUser } from './_lib/auth'
import { jsonResponse } from './_lib/http'
import type { Env } from './index'

const MAX_BATCH = 200
const UNIT_KEY_RE = /^[a-z]+:[A-Za-z0-9]+$/

type Row = { unit_key: string; state: string; correct_streak: number; taught_count: number }

function toClient(r: Row) {
  return { unitKey: r.unit_key, state: r.state, correctStreak: r.correct_streak, taughtCount: r.taught_count }
}

export async function handleGetBasicsProgress(request: Request, env: Env): Promise<Response> {
  const user = await getAuthenticatedUser(request, env)
  if (!user) return jsonResponse({ message: '未授权' }, { status: 401 })
  const { results } = await env.DB.prepare(
    'SELECT unit_key, state, correct_streak, taught_count FROM basics_progress WHERE user_id = ? ORDER BY unit_key',
  ).bind(user.id).all<Row>()
  return jsonResponse({ rows: results.map(toClient) })
}

export async function handlePutBasicsProgress(request: Request, env: Env): Promise<Response> {
  const user = await getAuthenticatedUser(request, env)
  if (!user) return jsonResponse({ message: '未授权' }, { status: 401 })
  const body = (await request.json().catch(() => null)) as { rows?: unknown } | null
  const list = Array.isArray(body?.rows) ? body.rows : null
  if (!list || list.length === 0) return jsonResponse({ message: '基础数据不合法' }, { status: 400 })
  if (list.length > MAX_BATCH) return jsonResponse({ message: '基础数据过大' }, { status: 400 })
  const stmts: D1PreparedStatement[] = []
  for (const item of list) {
    const r = item as { unitKey?: unknown; state?: unknown; correctStreak?: unknown; taughtCount?: unknown }
    if (typeof r.unitKey !== 'string' || !UNIT_KEY_RE.test(r.unitKey)) {
      return jsonResponse({ message: `非法的 unit_key:${String(r.unitKey)}` }, { status: 400 })
    }
    const state = r.state === 'learning' ? 'learning' : r.state === 'known' ? 'known' : null
    if (!state) return jsonResponse({ message: `非法的 state:${String(r.state)}` }, { status: 400 })
    const int = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0)
    const stmt = env.DB.prepare(
      `INSERT INTO basics_progress (user_id, unit_key, state, correct_streak, taught_count, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, unit_key) DO UPDATE SET
         state = excluded.state,
         correct_streak = excluded.correct_streak,
         taught_count = excluded.taught_count,
         updated_at = excluded.updated_at`,
    ).bind(user.id, r.unitKey, state, int(r.correctStreak), int(r.taughtCount), new Date().toISOString())
    stmts.push(stmt)
  }
  await env.DB.batch(stmts)
  return jsonResponse({ ok: true, updated: stmts.length })
}
```

- [ ] **Step 4: 注册路由**

`worker/index.ts`:import 两 handler;case 加:

```ts
case '/api/basics-progress':
  if (method === 'GET') return handleGetBasicsProgress(request, env)
  if (method === 'PUT') return handlePutBasicsProgress(request, env)
  return methodNotAllowed()
```

- [ ] **Step 5: 验证类型与构建(worker 无单测基建,仿现有 progress/settings handler;以 tsc 收口)**

Run: `npm run build`
Expected: PASS(tsc 覆盖 worker)。

- [ ] **Step 6: Commit**

```bash
git add migrations/0003_basics.sql worker/basics.ts worker/index.ts
git commit -m "feat(worker): basics_progress 表 + GET/PUT /api/basics-progress"
```

---

### Task 7: ApiService 扩展(GET/PUT basics-progress)

**Files:**
- Modify: `src/shared/services/api.ts`
- Modify: `src/features/api/api.ts`
- Test: `src/features/api/api.test.ts`

**Interfaces:**
- Consumes: `ApiBasicsProgressRow` / `BasicsProgressRow` type(shared);`ApiService` 接口。
- Produces(改接口):
  - `getBasicsProgress(): Promise<ApiBasicsProgressRow[]>`
  - `putBasicsProgress(rows: BasicsProgressRow[]): Promise<void>`

- [ ] **Step 1: 扩展契约**

`src/shared/services/api.ts`:`import type { ApiBasicsProgressRow, BasicsProgressRow } from './basics-progress'`;接口加两方法(签名见上)。

- [ ] **Step 2: 扩展实现 + validator**

`src/features/api/api.ts`:

```ts
import type { ApiBasicsProgressRow, BasicsProgressRow } from '@/shared/services'

type BasicsProgressResponse = { rows: ApiBasicsProgressRow[] }

function isBasicsRow(value: unknown): value is ApiBasicsProgressRow {
  return isObject(value)
    && typeof value.unitKey === 'string'
    && (value.state === 'learning' || value.state === 'known')
    && typeof value.correctStreak === 'number' && Number.isFinite(value.correctStreak)
    && typeof value.taughtCount === 'number' && Number.isFinite(value.taughtCount)
}
function isBasicsProgressResponse(value: unknown): value is BasicsProgressResponse {
  return isObject(value) && Array.isArray(value.rows) && value.rows.every(isBasicsRow)
}
```

并在 `createHttpApiService` 返回对象加:

```ts
async getBasicsProgress() {
  return (await request('/api/basics-progress', {}, isBasicsProgressResponse)).rows
},
async putBasicsProgress(rows) {
  await request('/api/basics-progress', {
    method: 'PUT',
    body: JSON.stringify({ rows }),
  }, isOkResponse)
},
```

- [ ] **Step 3: 写/扩测试**

`src/features/api/api.test.ts` 参照现有 me/progress 测试模式(fake fetcher 断言 path/method/body/校验/401 抛 `ApiError`),补两条:`GET /api/basics-progress` 解析 rows;`PUT` 带 body 且坏响应抛错。用真实 `createHttpApiService` + stub fetch 断言。

- [ ] **Step 4: 运行确认**

Run: `npx vitest run src/features/api/api.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/shared/services/api.ts src/features/api/api.ts src/features/api/api.test.ts
git commit -m "feat(api): getBasicsProgress/putBasicsProgress"
```

---

### Task 8: BasicsService 响应式实现 + 注册

**Files:**
- Create: `src/features/foundation/basics-service.ts`
- Modify: `src/features/foundation/index.ts`
- Modify: `src/app/bootstrap.ts`
- Test: `src/features/foundation/basics-service.test.ts`

**Interfaces:**
- Consumes: `ApiService`;`estimator.ts`(emptyUnit/applyCorrect/applyWrong/withTaught/toRow);`BasicsService`/`BasicsProgressRow`/`ApiBasicsProgressRow` type;`BasicsServiceCallbacks`(本模块自定,同 Settings 风格 `{ onUnauthorized(); onError(message) }`)。
- Produces: `export function createBasicsService(api, callbacks): BasicsService`;index 出口;bootstrap 注册。
- 语义:snapshot = `LoadState<BasicsProgressData>`(key=unitKey,稳定冻结引用);
  - `load()` 拉全量 → ready;
  - `recordAnswer(unitKey, correct)`:取当前行(无 → emptyUnit)经 `applyCorrect/applyWrong` → `toRow` → 本地合并乐观更新 + `api.putBasicsProgress([row])`;失败回滚该行(仅删本次乐观叠加)并 `report`+抛;
  - `markTaught(unitKeys)`:逐 key `withTaught`,批量 PUT 合并的若干行;
  - `saveAll(rows)`:整批 PUT(基线),本地 ready 态替换为这批;
  - 401 → onUnauthorized;其它错 → onError。
  - 用 `useSyncExternalStore` 的 getSnapshot 需稳定引用(冻结)。
- 参考样板:`features/settings-state/settings.ts` 的 `immutableSnapshot`/事务队列入门,但本服务写入低频,可用**简化乐观单事务**(不做多事务队列,够 MVP)。

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it, vi } from 'vitest'
import type { ApiBasicsProgressRow, ApiService } from '@/shared/services'
import { createBasicsService } from './basics-service'

function fakeApi(): ApiService {
  return {
    me: vi.fn(), login: vi.fn(), logout: vi.fn(),
    getProgress: vi.fn(async () => []), putProgress: vi.fn(), deleteProgress: vi.fn(),
    getSettings: vi.fn(async () => ({ enablePinyin: true, enableHanzi: true, enableEnglish: true, earnedAchievements: [], consecutiveDays: 0, lastActiveDate: '' })),
    putSettings: vi.fn(),
    getBasicsProgress: vi.fn(async () => []),
    putBasicsProgress: vi.fn(async () => undefined),
  }
}

describe('BasicsService', () => {
  it('load 拉全量入 snapshot', async () => {
    const api = fakeApi()
    const row: ApiBasicsProgressRow = { unitKey: 'pinyin:p', state: 'known', correctStreak: 2, taughtCount: 1 }
    vi.mocked(api.getBasicsProgress).mockResolvedValue([row])
    const svc = createBasicsService(api, { onUnauthorized: () => {}, onError: () => {} })
    await svc.load()
    const snap = svc.getSnapshot()
    expect(snap.status).toBe('ready')
    expect((snap as { data: Record<string, unknown> }).data['pinyin:p']).toBeDefined()
  })

  it('recordAnswer 答对后 persists 更新行并乐观入 snapshot', async () => {
    const api = fakeApi()
    const svc = createBasicsService(api, { onUnauthorized: () => {}, onError: () => {} })
    await svc.recordAnswer('pinyin:ing', true)
    const snap = svc.getSnapshot()
    const row = (snap as { data: Record<string, { state: string; correctStreak: number }> }).data['pinyin:ing']
    expect(row.state).toBe('learning')
    expect(row.correctStreak).toBe(1)
    expect(api.putBasicsProgress).toHaveBeenCalledTimes(1)
    const sent = (api.putBasicsProgress as ReturnType<typeof vi.fn>).mock.calls[0][0] as Array<{ unitKey: string }>
    expect(sent[0].unitKey).toBe('pinyin:ing')
  })

  it('markTaught 自增 taughtCount', async () => {
    const api = fakeApi()
    const svc = createBasicsService(api, { onUnauthorized: () => {}, onError: () => {} })
    await svc.markTaught(['pinyin:p', 'pinyin:ing'])
    const snap = svc.getSnapshot()
    const row = (snap as { data: Record<string, { taughtCount: number }> }).data['pinyin:ing']
    expect(row.taughtCount).toBe(1)
    expect(api.putBasicsProgress).toHaveBeenCalledTimes(1)
  })

  it('saveAll 批量基线', async () => {
    const api = fakeApi()
    const svc = createBasicsService(api, { onUnauthorized: () => {}, onError: () => {} })
    await svc.saveAll([{ unitKey: 'english:a', state: 'known', correctStreak: 2, taughtCount: 1, updatedAt: new Date().toISOString() }])
    expect(api.putBasicsProgress).toHaveBeenCalledTimes(1)
    expect(svc.getSnapshot().status).toBe('ready')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/features/foundation/basics-service.test.ts`
Expected: FAIL(模块不存在)。实现到 PASS(注意 snapshot 每写重建稳定冻结引用;失败路径:PUT 抛错 → 回滚本地乐观叠加 + report + rethrow)。

- [ ] **Step 3: 注册**

`features/foundation/index.ts` 加 `export { createBasicsService } from './basics-service'`;`bootstrap.ts`:import;`ALL_SERVICE_TOKENS` 加 `BasicsService`;在 callbacks 定义后加:

```ts
registry.register(BasicsService, createBasicsService(api, callbacks))
```

- [ ] **Step 4: 全量回归**

Run: `npm test && npm run build`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/features/foundation/basics-service.ts src/features/foundation/index.ts src/features/foundation/basics-service.test.ts src/app/bootstrap.ts
git commit -m "feat(foundation): BasicsService 响应式服务 + 注册"
```

---

### Task 9: 收口(全量回归 + lint)

**Files:**
- (无源码改动,仅验证)

- [ ] **Step 1: 全量测试**

Run: `npm test`
Expected: PASS(含 architecture 边界:foundation 未 import 其它 feature;bootstrap 为唯一 register 点;useService 纪律)。

- [ ] **Step 2: Lint + 构建**

Run: `npm run lint && npm run build`
Expected: 无告警/错误。

- [ ] **Step 3: 迁移复验**

Run: `npm run db:local`
Expected: 幂等,0003 不重跑。

- [ ] **Step 4: 提交收口(如有多余改动一并)**

```bash
git add -A
git commit -m "chore(foundation): core plan 收口回归" || true
```
