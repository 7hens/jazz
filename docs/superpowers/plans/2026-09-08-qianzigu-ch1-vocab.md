# 千字谷 ch1 · P1 词库数据升维实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 词库数据模型升维:加 `partOfSpeech` 与 `category:'story'`,追加 ch1 三补词(升起/亮/早上好),且**字母林(letter-forest)既有 100 词学习流零波及**(`getAllWords()` 过滤 story 仍返 100)。

**Architecture:** `WORDS` 常量扩至 103(story 词 id 101-103);`VocabularyService.getAllWords()` 只返非 story(100 词,letter-forest/结算/群岛语义不变),`wordById` 全量(含 story,供后续章节按 id 取词)。`WordUnit` 加可选 `partOfSpeech`/`chapterId`;`CategoryKey`/`CATEGORY_LABELS` 加 `'story'`。story 类词**不参与「每类 ≥8」干扰项基数断言**(该断言只约束原 5 主题)。

**Tech Stack:** TypeScript + vitest。改动仅在 `src/shared/services/vocabulary.ts`、`src/features/vocabulary/{words.ts,vocabulary.ts,words.test.ts,vocabulary.test.ts}`。

**Spec:** `docs/superpowers/specs/2026-09-08-qianzigu-ch1-design.md` §2/§3.1/§3.4(story 边界)。executor 读 spec + 本 plan。

## Global Constraints

- 仓库红线(见 CLAUDE.md):`architecture.test.ts` 铁律不许 feature 间互引;`wordById`/`WORDS` 消费方测试全绿(`npm test`)。
- 词库唯一性:hanzi 与 english 各自**全局唯一**(story 词并入后仍成立)。
- story 词字段齐备:emoji/pinyin/hanzi/english/teaser(≤40 字)/category='story'/partOfSpeech/chapterId=1。
- 三补词(来自 spec §3.1,emoji 取自 idea §4.10 结算卡):`升起`(verb,`⬆️`,shēng qǐ,rise)、`亮`(adjective,`✨`,liàng,bright)、`早上好`(social,`🌅`,zǎo shang hǎo,good morning)。现有 100 词中无相同 hanzi/english。
- teaser 相邻去标点不雷同断言覆盖全 WORDS;story teaser 不得与 id100 清理后相同,且每条 ≤40 字符(含标点)。

---

### Task 1: 扩 CategoryKey / CATEGORY_LABELS / WordUnit 类型(含新字段)

**Files:**
- Modify: `src/shared/services/vocabulary.ts`(全文重写)

**Interfaces:**
- Consumes: 无(shared 契约文件自身)。
- Produces:
  - `export type CategoryKey = 'shape'|'food'|'animal'|'nature'|'object'|'story'`
  - `export const CATEGORY_LABELS: Record<CategoryKey, string>`(story → `'千字谷故事'`)
  - `export type PartOfSpeech = 'noun'|'verb'|'adjective'|'social'`
  - `WordUnit` 增可选字段:`partOfSpeech?: PartOfSpeech`、`chapterId?: number`;category 类型改为新 CategoryKey。
  - `VocabularyService` 接口不变(`getAllWords()`/`wordById(id)`)。

- [ ] **Step 1: 写失败测试(契约编译层)**

新增 `src/features/vocabulary/story-types.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { CategoryKey, PartOfSpeech } from '@/shared/services/vocabulary'

describe('vocabulary 类型升级', () => {
  it('story 是合法 CategoryKey,且 PartOfSpeech 四值存在', () => {
    const story: CategoryKey = 'story'
    const pos: PartOfSpeech[] = ['noun', 'verb', 'adjective', 'social']
    expect(story).toBe('story')
    expect(pos).toHaveLength(4)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/vocabulary/story-types.test.ts`
Expected: FAIL(类型不存在 → TS/测试引用错误)。

- [ ] **Step 3: 改写 `src/shared/services/vocabulary.ts`**

```ts
import type { ServiceToken } from './core'

/** 词分类键(5 大主题 + story 千字谷叙事补词)。 */
export type CategoryKey = 'shape' | 'food' | 'animal' | 'nature' | 'object' | 'story'

/** 词分类显示名(key→中文)。 */
export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  shape: '基础形状',
  food: '食物',
  animal: '动物',
  nature: '自然界',
  object: '交通与物品',
  story: '千字谷故事',
}

/** 词性(千字谷章节任务语法按词类分;老词缺省视为名词)。 */
export type PartOfSpeech = 'noun' | 'verb' | 'adjective' | 'social'

/** 词条(id 唯一;story 词归千字谷章节,不进 letter-forest 主题网格)。 */
export type WordUnit = {
  id: number
  emoji: string
  pinyin: string
  hanzi: string
  english: string
  category: CategoryKey
  partOfSpeech?: PartOfSpeech
  chapterId?: number
  teaser?: string
}

export interface VocabularyService {
  getAllWords(): readonly WordUnit[]
  wordById(id: number): WordUnit | undefined
}

export const VocabularyService = Symbol('VocabularyService') as unknown as ServiceToken<VocabularyService>
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/features/vocabulary/story-types.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/shared/services/vocabulary.ts src/features/vocabulary/story-types.test.ts
git commit -m "feat(vocabulary): WordUnit 加 partOfSpeech/chapterId + category 扩 story"
```

---

### Task 2: 追加 story 三词(升起/亮/早上好,id 101-103)

**Files:**
- Modify: `src/features/vocabulary/words.ts`(id 100 龙之后追加)

**Interfaces:**
- Consumes: `WordUnit`(Task 1)。
- Produces: `WORDS` 常量长度 103、末尾三词:
  - `{ id: 101, emoji: '⬆️', pinyin: 'shēng qǐ', hanzi: '升起', english: 'rise', category: 'story', partOfSpeech: 'verb', chapterId: 1, teaser: '<≤40 字>' }`
  - `{ id: 102, emoji: '✨', pinyin: 'liàng', hanzi: '亮', english: 'bright', category: 'story', partOfSpeech: 'adjective', chapterId: 1, teaser: '<≤40 字>' }`
  - `{ id: 103, emoji: '🌅', pinyin: 'zǎo shang hǎo', hanzi: '早上好', english: 'good morning', category: 'story', partOfSpeech: 'social', chapterId: 1, teaser: '<≤40 字>' }`

- [ ] **Step 1: 写失败测试(词库完整性补断言)**

在 `src/features/vocabulary/words.test.ts` 顶部 import 加 `PartOfSpeech`;替换「恰好 100 词」与「唯一性」两条为 103:

```ts
it('恰好 103 词且 id 与下标连续一致', () => {
  expect(WORDS).toHaveLength(103)
  WORDS.forEach((w, i) => expect(w.id).toBe(i + 1))
})

it('关键字段非空且汉字/英文全局唯一', () => {
  const hanzi = new Set(WORDS.map((w) => w.hanzi))
  const en = new Set(WORDS.map((w) => w.english))
  expect(hanzi.size).toBe(103)
  expect(en.size).toBe(103)
  for (const w of WORDS) {
    expect(w.emoji).toBeTruthy()
    expect(w.pinyin).toBeTruthy()
    expect(w.hanzi).toBeTruthy()
    expect(w.english).toBeTruthy()
  }
})

it('story 恰 3 词、partOfSpeech/chapterId 齐、emoji 唯一', () => {
  const story = WORDS.filter((w) => w.category === 'story')
  expect(story).toHaveLength(3)
  for (const w of story) {
    expect(w.partOfSpeech).toMatch(/^(noun|verb|adjective|social)$/)
    expect(w.chapterId).toBe(1)
  }
  const emojis = new Set(story.map((w) => w.emoji))
  expect(emojis.size).toBe(3)
})
```

`vocabulary.test.ts` 的 `wordById(101) 越界 undefined` 断言需改为 104(101 已是 story 词):

```ts
it('finds a word by id', () => {
  const service = createVocabularyService()
  expect(service.wordById(1)?.id).toBe(1)
  expect(service.wordById(101)?.hanzi).toBe('升起')
  expect(service.wordById(104)).toBeUndefined()
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/vocabulary/words.test.ts src/features/vocabulary/vocabulary.test.ts`
Expected: FAIL(长度 100≠103、唯一性 size 100≠103、wordById(101) 断言)。

- [ ] **Step 3: 追加三词到 words.ts 末尾**

在 id 100(龙)行之后、`]` 之前追加:

```ts
  // story 101-103(千字谷 ch1 补词;不进 letter-forest 主题网格)
  { id: 101, emoji: '⬆️', pinyin: 'shēng qǐ', hanzi: '升起', english: 'rise', category: 'story', partOfSpeech: 'verb', chapterId: 1, teaser: '红红的太阳从山后探出圆脑袋,慢慢往天上爬…这个动作叫什么呀?' },
  { id: 102, emoji: '✨', pinyin: 'liàng', hanzi: '亮', english: 'bright', category: 'story', partOfSpeech: 'adjective', chapterId: 1, teaser: '黑夜退啦,天空洒满光,不再黑漆漆…这时候的感觉是哪个词呀?' },
  { id: 103, emoji: '🌅', pinyin: 'zǎo shang hǎo', hanzi: '早上好', english: 'good morning', category: 'story', partOfSpeech: 'social', chapterId: 1, teaser: '太阳升起来啦!见着它,先笑一笑说句问候的话…该说什么呀?' },
]
```

(teaser 逐条 ≤40 字符且与 id100 teaser 清理后不同;emoji ⬆️/✨/🌅 与既有 100 词不冲突。)

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/features/vocabulary/words.test.ts src/features/vocabulary/vocabulary.test.ts`
Expected: PASS。

- [ ] **Step 5: 全量回归(确认既有消费方无 100 硬编码破坏)**

Run: `npm test`
Expected: 全绿(如有个别测试硬编码 100/totalWords,按失败信息最小修正为「非 story 词数」口径)。

- [ ] **Step 6: Commit**

```bash
git add src/features/vocabulary/words.ts src/features/vocabulary/words.test.ts src/features/vocabulary/vocabulary.test.ts
git commit -m "feat(vocabulary): ch1 story 补词 升起/亮/早上好(id 101-103)"
```

---

### Task 3: getAllWords() 过滤 story(letter-forest 零波及)

**Files:**
- Modify: `src/features/vocabulary/vocabulary.ts`

**Interfaces:**
- Consumes: `WORDS`、Task 1 的 WordUnit.category。
- Produces: `createVocabularyService().getAllWords()` 只返 `category !== 'story'` 词(仍 100 词,id 1..100,顺序不变);`wordById` 全量含 story。

- [ ] **Step 1: 写失败测试**

在 `src/features/vocabulary/vocabulary.test.ts` 追加:

```ts
it('getAllWords 过滤 story(letter-forest 仍 100 词)', () => {
  const service = createVocabularyService()
  const all = service.getAllWords()
  expect(all).toHaveLength(100)
  expect(all.every((w) => w.category !== 'story')).toBe(true)
  expect(all[0]?.id).toBe(1)
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/vocabulary/vocabulary.test.ts`
Expected: FAIL(长度 103)。

- [ ] **Step 3: 改 `src/features/vocabulary/vocabulary.ts`**

```ts
import type { VocabularyService } from '@/shared/services/vocabulary'
import { WORDS, wordById } from './words'

export function createVocabularyService(): VocabularyService {
  return {
    getAllWords: () => WORDS.filter((w) => w.category !== 'story'),
    wordById,
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/features/vocabulary/vocabulary.test.ts`
Expected: PASS。

- [ ] **Step 5: 全量回归**

Run: `npm test`
Expected: 全绿(letter-forest/结算/群岛的 catalog 来源即 `getAllWords()` → 语义不变)。

- [ ] **Step 6: Commit**

```bash
git add src/features/vocabulary/vocabulary.ts src/features/vocabulary/vocabulary.test.ts
git commit -m "feat(vocabulary): getAllWords 过滤 story 保 letter-forest 100 词"
```

---

## Self-Review

**Spec 覆盖:** spec §2(100 词事实)→ WORDS 103 保持既有 100 + story 3;§3.1(partOfSpeech/chapterId/story 档、emoji、story 豁免 ≥8)→ Task1/2;§3.4 story 边界(字母林过滤 story)→ Task3 落 `getAllWords()`。遗留(非本 plan):story 词 english 不进字母林分解教学 —— 由 letter-forest 只遍历 `getAllWords()` 天然满足;ch1 章节归属词集(含复用 太阳 id1/星星 id3)由 P2 章节定义引用 id,不在本 plan。

**占位扫描:** 无 TBD;story teaser 具体文案已给实字(≤40 且避开 id100 雷同)。

**类型一致性:** `CategoryKey`/`PartOfSpeech`/`WordUnit` 全走 shared barrel 引用;`wordById(101)`/`(104)` 断言与新常量一致。
