# 千字谷 ch1 重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给千字谷 ch1 加第 3 步「句」(每词 3 句、由易到难),重排叙事情绪曲线做出高潮与笑点,并让选择题干扰项优先取本章词与已学复习词。

**Architecture:** 三层骨架不动(`shared` → `features/<f>` → `app`)。句步复用既有 `ChoiceQuestion` 形状(options 就是完整句子)→ **零 UI 新组件**;进度用 `WordLayer` 扩展 + `WordProgress.sentenceLevel` 独立字段承载,**不扩 `SkillKey`**(家长面板仍是 2 域开关)。干扰项通过 `QuestionEngineService` 的可选末位入参 `QuestionContext` 注入场景池,字母林与千字谷共用同一引擎。

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind 4 + motion;Cloudflare Workers(手写路由)+ D1;vitest(jsdom)。

**Spec:** `docs/superpowers/specs/2026-09-11-qianzigu-ch1-rebuild-design.md`

## Global Constraints

- **禁止语音识别(ASR)**:句步只做点选,不要求孩子开口、不判音准。句子的 TTS 朗读是**播放**,不是识别 —— 不违反。
- **单句硬线 ≤20 汉字**(去标点/拼音后计数):项目既有加严线,`ch1-script.test.ts` 已守卫 ch1 台词;本轮**扩展到 `sentences.ts`**。
- **干扰词限定在词库内**:句子中替换目标词位置的**名词**必须能在 `WORDS` 查到。动词/修饰语不受限。
- **禁令**:谐音梗、双关(孩子词汇量接不住)。
- **`wrangler` 命令一律显式 `--config wrangler.toml`**;禁止 `[env.production]`。
- **迁移只增不改**:新增 `0006_*.sql`,不动 `0001` 基线;顺序**先升库后升代码**。
- **3 层边界**(`src/architecture.test.ts` 守卫):`shared/` 无上层依赖;`features/<f>/` 公共面 = 目录 `index.ts`,feature 间禁编译期互引;`useService()` 只在 page feature 的 `<Name>Entry.tsx` 与 `app/` hooks 内,注册只在 `bootstrap.ts`。
- **`npm test` 与 `npm run lint` 必须绿**。
- **本轮零词库扩充**(spec §4.6):候选词/干扰词只从**现有 100 个课程词**(`WORDS` 中 `category !== 'story'`)里选,不新增词条、不留空分类。`words.ts` / `words.test.ts` / worker `MAX_WORD_ID` 三者零改动。

---

### Task 1: `sentenceLevel` 数据模型贯穿

**Files:**
- Modify: `src/shared/services/progress.ts`
- Modify: `src/features/lesson/progress.ts`
- Modify: `src/features/qianzigu/word-progress.ts:24-31`(`emptyWordProgress`)
- Create: `migrations/0006_sentence_step.sql`
- Modify: `worker/progress.ts`
- Test: `src/features/lesson/progress.test.ts`

**Interfaces:**
- Consumes: 无
- Produces: `WordProgress.sentenceLevel: number`(0..3);`emptyProgress(wordId)` / `emptyWordProgress(wordId)` 返回对象含 `sentenceLevel: 0`;worker 读写 `sentence_level` 列

- [ ] **Step 1: 写失败测试**

在 `src/features/lesson/progress.test.ts` 末尾追加:

```ts
describe('sentenceLevel', () => {
  it('emptyProgress 带 sentenceLevel 0', () => {
    expect(emptyProgress(13).sentenceLevel).toBe(0)
  })

  it('isValidWordProgress 拒绝非法 sentenceLevel,接受 0..3', () => {
    const base = { wordId: 13, completed: { pinyin: true, hanzi: true, english: false }, starsEarned: 30, updatedAt: 'x' }
    expect(isValidWordProgress({ ...base, sentenceLevel: 0 })).toBe(true)
    expect(isValidWordProgress({ ...base, sentenceLevel: 3 })).toBe(true)
    expect(isValidWordProgress({ ...base, sentenceLevel: 4 })).toBe(false)
    expect(isValidWordProgress({ ...base, sentenceLevel: -1 })).toBe(false)
    expect(isValidWordProgress({ ...base, sentenceLevel: 1.5 })).toBe(false)
    expect(isValidWordProgress({ ...base, sentenceLevel: undefined })).toBe(false)
  })

  it('mergeProgress 取 max(只升不降)', () => {
    const local = { ...emptyProgress(13), sentenceLevel: 1 }
    const server = { ...emptyProgress(13), sentenceLevel: 3 }
    expect(mergeProgress(local, server).sentenceLevel).toBe(3)
    expect(mergeProgress(server, local).sentenceLevel).toBe(3)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/lesson/progress.test.ts`
Expected: FAIL —— `sentenceLevel` 为 `undefined`,`toBe(0)` 报错。

- [ ] **Step 3: 改 shared 契约**

`src/shared/services/progress.ts` 的 `WordProgress` 加字段(注释说明语义):

```ts
/** 每词学习进度(每 user × 每词一行,updatedAt 为前端本地时间戳)。 */
export type WordProgress = {
  wordId: number
  completed: Record<SkillKey, boolean>
  /** 汉语句型步已通过的档数(0..3,由易到难);不进 SkillKey —— 句是汉语域内固定步,不是独立技能。 */
  sentenceLevel: number
  starsEarned: number
  updatedAt: string
}
```

- [ ] **Step 4: 改 lesson 进度纯函数**

`src/features/lesson/progress.ts`:

```ts
export function emptyProgress(wordId: number): WordProgress {
  return {
    wordId,
    completed: { pinyin: false, hanzi: false, english: false },
    sentenceLevel: 0,
    starsEarned: 0,
    updatedAt: new Date().toISOString(),
  }
}

/** 句步合法档数上限与词表一致(3 档)。 */
const MAX_SENTENCE_LEVEL = 3

function isValidSentenceLevel(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= MAX_SENTENCE_LEVEL
}

export function isValidWordProgress(s: unknown): s is WordProgress {
  if (typeof s !== 'object' || s === null || Array.isArray(s)) return false
  const w = s as Record<string, unknown>
  if (typeof w.wordId !== 'number' || !Number.isInteger(w.wordId) || w.wordId < 1) return false
  const c = w.completed as Record<string, unknown> | null
  if (typeof c !== 'object' || c === null) return false
  if (!ALL_SKILLS.every((k) => typeof c[k] === 'boolean')) return false
  if (!isValidSentenceLevel(w.sentenceLevel)) return false
  return typeof w.starsEarned === 'number' && Number.isFinite(w.starsEarned)
}

export function mergeProgress(local: WordProgress, server: WordProgress): WordProgress {
  return {
    wordId: local.wordId,
    completed: {
      pinyin: local.completed.pinyin || server.completed.pinyin,
      hanzi: local.completed.hanzi || server.completed.hanzi,
      english: local.completed.english || server.completed.english,
    },
    sentenceLevel: Math.max(local.sentenceLevel, server.sentenceLevel),
    starsEarned: Math.max(local.starsEarned, server.starsEarned),
    updatedAt: new Date().toISOString(),
  }
}
```

`settleWord` 的 `next` 也要带上(否则类型不过):

```ts
  const next = {
    wordId: base.wordId,
    completed: { ...base.completed },
    sentenceLevel: base.sentenceLevel,
    starsEarned: base.starsEarned,
    updatedAt: new Date().toISOString(),
  }
```

- [ ] **Step 5: 改千字谷 `emptyWordProgress`**

`src/features/qianzigu/word-progress.ts`:

```ts
export function emptyWordProgress(wordId: number): WordProgress {
  return {
    wordId,
    completed: { pinyin: false, hanzi: false, english: false },
    sentenceLevel: 0,
    starsEarned: 0,
    updatedAt: new Date().toISOString(),
  }
}
```

同文件的 `settleChapterStep` 里 `next` 也要带 `sentenceLevel: base.sentenceLevel`(本任务只补字段,结算语义在 Task 7 改)。

- [ ] **Step 6: 加迁移**

`migrations/0006_sentence_step.sql`:

```sql
-- 汉语句型步:每词多句、由易到难;加列记录已通过档数(0..3)。
-- additive,不改 0001 基线;ch1(0.3.0)从未上线,无存量存档需回填。
ALTER TABLE progress ADD COLUMN sentence_level INTEGER NOT NULL DEFAULT 0;
```

- [ ] **Step 7: 改 worker**

`worker/progress.ts`:

1. `Row` 加 `sentence_level: number`
2. `toClient` 加 `sentenceLevel: r.sentence_level`
3. SELECT 列表加 `sentence_level`
4. 入参解析加:

```ts
    const c = p.completed ?? {}
    const bool = (v: unknown) => (v === true ? 1 : 0)
    const rawLevel = (p as { sentenceLevel?: unknown }).sentenceLevel
    const level = typeof rawLevel === 'number' && Number.isInteger(rawLevel) && rawLevel >= 0 && rawLevel <= 3
      ? rawLevel : 0
```

5. INSERT 列表 / VALUES / UPSERT 加该列:

```sql
      `INSERT INTO progress (user_id, word_id, pinyin_completed, hanzi_completed, english_completed, sentence_level, stars_earned, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, word_id) DO UPDATE SET
         pinyin_completed = MAX(progress.pinyin_completed, excluded.pinyin_completed),
         hanzi_completed  = MAX(progress.hanzi_completed, excluded.hanzi_completed),
         english_completed= MAX(progress.english_completed, excluded.english_completed),
         sentence_level   = MAX(progress.sentence_level, excluded.sentence_level),
         stars_earned     = MAX(progress.stars_earned, excluded.stars_earned),
         updated_at       = excluded.updated_at`,
```

6. `.bind(...)` 在 `bool(c.english)` 后插 `level`

- [ ] **Step 8: 跑测试 + 类型检查**

Run: `npx vitest run src/features/lesson/progress.test.ts && npm run lint && npx tsc -b`
Expected: PASS + 无 lint 错 + 无类型错(含 `worker/tsconfig.json` 被 `tsc -b` 检查)。

- [ ] **Step 9: 提交**

```bash
git add src/shared/services/progress.ts src/features/lesson/progress.ts src/features/qianzigu/word-progress.ts migrations/0006_sentence_step.sql worker/progress.ts src/features/lesson/progress.test.ts
git commit -m "feat(progress): 加 sentenceLevel 字段 + 0006 迁移 + worker 读写"
```

---

### Task 2: `sentences.ts` 句库 + 守卫测试

**Files:**
- Create: `src/features/vocabulary/sentences.ts`
- Create: `src/features/vocabulary/sentences.test.ts`

**Interfaces:**
- Consumes: `WORDS` / `wordById`(`./words`)
- Produces: `SentenceTier`、`SentenceItem`、`SentenceSet`、`SENTENCES`、`sentenceSetFor(wordId)`

**难度轴(spec §4.2)**:① 动词完全不搭 → ② 目标词位置换成别的库内名词 → ③ 成分错位 / 语序颠倒。正确句长上限 **6 / 10 / 14** 字。

- [ ] **Step 1: 写失败测试**

`src/features/vocabulary/sentences.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { WORDS, wordById } from './words'
import { SENTENCES, sentenceSetFor } from './sentences'

const TIER_MAX = [6, 10, 14] as const
const body = (t: string): string => t.replace(/[^一-龥a-zA-Z0-9]/g, '')
const hanziSet = new Set(WORDS.map((w) => w.hanzi))

describe('句库数据完整性', () => {
  it('每个 ch1 词恰一套,含 3 档', () => {
    for (const id of [13, 7, 14, 8, 19]) {
      const set = sentenceSetFor(id)
      expect(set, `词 ${id} 缺句集`).toBeDefined()
      expect(set!.tiers).toHaveLength(3)
    }
  })

  it('每档 1 正 3 错,且组内 4 句互不相同', () => {
    for (const set of SENTENCES) {
      for (const [i, tier] of set.tiers.entries()) {
        const all = [tier.correct, ...tier.wrong]
        expect(new Set(all).size, `词 ${set.wordId} 档 ${i + 1} 有重复句`).toBe(4)
      }
    }
  })

  it('正确句长度 ≤ 档位上限', () => {
    for (const set of SENTENCES) {
      set.tiers.forEach((tier, i) => {
        expect(body(tier.correct).length, `词 ${set.wordId} 档 ${i + 1} 过长`).toBeLessThanOrEqual(TIER_MAX[i])
      })
    }
  })

  it('全部句子 ≤ 20 汉字硬线', () => {
    for (const set of SENTENCES) {
      for (const tier of set.tiers) {
        for (const s of [tier.correct, ...tier.wrong]) {
          expect(body(s).length, `超硬线:${s}`).toBeLessThanOrEqual(20)
        }
      }
    }
  })

  it('每档正确句都含该词(题面必须对得上)', () => {
    for (const set of SENTENCES) {
      const word = wordById(set.wordId)!
      for (const tier of set.tiers) {
        expect(tier.correct, `词 ${set.wordId} 正确句不含目标词`).toContain(word.hanzi)
      }
    }
  })

  it('档 2 的替换名词必须在词库内(干扰词限定词库内)', () => {
    // 档 2 造法 = 目标词位置换成别的库内名词 → 错句必须含一个库内名词、且不含目标词
    for (const set of SENTENCES) {
      const word = wordById(set.wordId)!
      for (const wrong of set.tiers[1].wrong) {
        expect(wrong, `词 ${set.wordId} 档 2 错句混入目标词`).not.toContain(word.hanzi)
        const hits = WORDS.filter((w) => w.hanzi !== word.hanzi && wrong.includes(w.hanzi))
        expect(hits.length, `词 ${set.wordId} 档 2 错句「${wrong}」无库内替换名词`).toBeGreaterThan(0)
      }
    }
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/vocabulary/sentences.test.ts`
Expected: FAIL —— 模块不存在。

- [ ] **Step 3: 写句库**

`src/features/vocabulary/sentences.ts`:

```ts
import type { WordUnit } from '@/shared/services'

/**
 * 汉语句型步句库(ch1 五词切片)。
 * 每词 3 档、由易到难,每档 = 1 正确句 + 3 错句。
 * 难度轴:① 动词完全不搭 → ② 目标词位置换成别的库内名词 → ③ 成分错位 / 语序颠倒。
 * 硬线:正确句 ≤ 6 / 10 / 14 汉字(逐档),任一句 ≤ 20(sentences.test.ts 守卫)。
 * 干扰词约束:档 2 的替换名词必须是词库内已有的词(同上测试守卫)。
 */
export type SentenceTier = 1 | 2 | 3

export type SentenceItem = Readonly<{
  correct: string
  wrong: readonly [string, string, string]
}>

export type SentenceSet = Readonly<{
  wordId: number
  tiers: readonly [SentenceItem, SentenceItem, SentenceItem]
}>

export const SENTENCES: readonly SentenceSet[] = [
  // 词 13 房子
  {
    wordId: 13,
    tiers: [
      {
        correct: '我住在房子里。',
        wrong: ['我吃掉了房子。', '我穿上了房子。', '我背起了房子。'],
      },
      {
        correct: '徐爷爷家就是那栋房子。',
        wrong: ['徐爷爷家就是那栋帽子。', '徐爷爷家就是那栋雨伞。', '徐爷爷家就是那栋台灯。'],
      },
      {
        correct: '房子在路的尽头，徐爷爷朝它走去。',
        wrong: [
          '徐爷爷在路的尽头，房子朝他走去。',
          '路在房子的尽头，徐爷爷朝它走去。',
          '尽头在房子的路，徐爷爷朝它走去。',
        ],
      },
    ],
  },
  // 词 7 门
  {
    wordId: 7,
    tiers: [
      {
        correct: '我推开门。',
        wrong: ['我吃掉了门。', '我穿上了门。', '我骑上了门。'],
      },
      {
        correct: '爷爷推开门，进屋了。',
        wrong: ['爷爷推开帽子，进屋了。', '爷爷推开杯子，进屋了。', '爷爷推开鞋子，进屋了。'],
      },
      {
        correct: '门在爷爷身后轻轻关上，天黑了。',
        wrong: [
          '爷爷在门身后轻轻关上，天黑了。',
          '天在门身后轻轻关上，爷爷黑了。',
          '黑在门身后轻轻关上，爷爷天了。',
        ],
      },
    ],
  },
  // 词 14 钥匙
  {
    wordId: 14,
    tiers: [
      {
        correct: '我用钥匙开门。',
        wrong: ['我用钥匙吃饭。', '我用钥匙穿鞋。', '我用钥匙扫地。'],
      },
      {
        correct: '爷爷掏出钥匙开门。',
        wrong: ['爷爷掏出帽子开门。', '爷爷掏出杯子开门。', '爷爷掏出鞋子开门。'],
      },
      {
        correct: '钥匙在爷爷的口袋里，一摸就摸到了。',
        wrong: [
          '爷爷在钥匙的口袋里，一摸就摸到了。',
          '口袋在钥匙的爷爷里，一摸就摸到了。',
          '一摸在钥匙的口袋里，爷爷就摸到了。',
        ],
      },
    ],
  },
  // 词 8 窗户
  {
    wordId: 8,
    tiers: [
      {
        correct: '我打开窗户。',
        wrong: ['我吃掉了窗户。', '我穿上了窗户。', '我骑上了窗户。'],
      },
      {
        correct: '爷爷推开了那扇窗户。',
        wrong: ['爷爷推开了那扇帽子。', '爷爷推开了那扇台灯。', '爷爷推开了那本书。'],
      },
      {
        correct: '风从窗户吹进来，屋里凉快了。',
        wrong: ['窗户从风吹进来，屋里凉快了。', '屋里从窗户吹进来，风凉快了。', '风把窗户吹进来，屋里凉快了。'],
      },
    ],
  },
  // 词 19 台灯
  {
    wordId: 19,
    tiers: [
      {
        correct: '我打开台灯。',
        wrong: ['我吃掉了台灯。', '我穿上了台灯。', '我骑上了台灯。'],
      },
      {
        correct: '天黑前，爷爷点亮了台灯。',
        wrong: ['天黑前，爷爷点亮了帽子。', '天黑前，爷爷点亮了鞋子。', '天黑前，爷爷点亮了杯子。'],
      },
      {
        correct: '台灯亮起来，屋里一下子暖了。',
        wrong: ['屋里亮起来，台灯一下子暖了。', '亮起来台灯，屋里一下子暖了。', '暖起来台灯，屋里一下子亮了。'],
      },
    ],
  },
]

export function sentenceSetFor(wordId: number): SentenceSet | undefined {
  return SENTENCES.find((s) => s.wordId === wordId)
}

/** 目标词的句型句集;无句集(非 ch1 词)返回 undefined,调用方回落既有题型。 */
export function sentenceSetOf(word: WordUnit): SentenceSet | undefined {
  return sentenceSetFor(word.id)
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/features/vocabulary/sentences.test.ts`
Expected: PASS(6 个用例全绿)。

- [ ] **Step 5: 提交**

```bash
git add src/features/vocabulary/sentences.ts src/features/vocabulary/sentences.test.ts
git commit -m "feat(vocabulary): ch1 句型句库(五词 × 三档 × 四句)+ 守卫测试"
```

---

### Task 3: 引擎 `makeSentenceQuestions`

**Files:**
- Modify: `src/shared/services/question-engine.ts`
- Modify: `src/features/question-engine/engine.ts`
- Test: `src/features/question-engine/engine.test.ts`

**Interfaces:**
- Consumes: `SentenceSet`(`@/features/vocabulary/sentences` —— 注意:`shared` **不得**反向 import `features`;句子以**结构类型**入参,见下)
- Produces: `makeSentenceQuestions(word: WordUnit, set: SentenceTextSet, rng?: Rng): ChoiceQuestion[]`(恒 3 题,顺序 = 档 1→3)

> **边界说明**:`shared/services/question-engine.ts` 不能 import `features/vocabulary/sentences.ts`(3 层红线)。故契约里把句集**按结构声明**为最小形状,`features` 侧的 `SentenceSet` 结构上兼容即可。

- [ ] **Step 1: 写失败测试**

在 `src/features/question-engine/engine.test.ts` 末尾追加:

```ts
describe('makeSentenceQuestions', () => {
  const word = wordById(14)!            // 钥匙
  const set = sentenceSetFor(14)!

  it('恒 3 题,kind 全为 choice', () => {
    const qs = engine.makeSentenceQuestions(word, set, () => 0.5)
    expect(qs).toHaveLength(3)
    for (const q of qs) expect(q.kind).toBe('choice')
  })

  it('每题 4 项,answerId 指向正确句,且正确句在选项中', () => {
    const qs = engine.makeSentenceQuestions(word, set, () => 0.5)
    qs.forEach((q, i) => {
      expect(q.options).toHaveLength(4)
      const answer = q.options.find((o) => o.id === q.answerId)
      expect(answer?.text).toBe(set.tiers[i].correct)
    })
  })

  it('选项 id 唯一、文本不重复', () => {
    for (const q of engine.makeSentenceQuestions(word, set, () => 0.5)) {
      expect(new Set(q.options.map((o) => o.id)).size).toBe(4)
      expect(new Set(q.options.map((o) => o.text)).size).toBe(4)
    }
  })

  it('选项可朗读(speak 与 text 一致)', () => {
    for (const q of engine.makeSentenceQuestions(word, set, () => 0.5)) {
      for (const o of q.options) expect(o.speak).toBe(o.text)
    }
  })
})
```

测试文件顶部按需补 import:`sentenceSetFor` from `@/features/vocabulary/sentences`、`wordById` from `@/features/vocabulary/words`。

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/question-engine/engine.test.ts -t makeSentenceQuestions`
Expected: FAIL —— `engine.makeSentenceQuestions is not a function`。

- [ ] **Step 3: 扩契约**

`src/shared/services/question-engine.ts` 加:

```ts
/** 句型题入参的最小结构(shared 不得依赖 features 的具体类型)。 */
export type SentenceTextSet = {
  readonly tiers: readonly [
    { readonly correct: string; readonly wrong: readonly [string, string, string] },
    { readonly correct: string; readonly wrong: readonly [string, string, string] },
    { readonly correct: string; readonly wrong: readonly [string, string, string] },
  ]
}

export interface QuestionEngineService {
  // …既有方法不动…
  /** 句型步:恒 3 题,顺序 = 档 1 → 档 3;每题 4 句选一(1 正 + 3 错)。 */
  makeSentenceQuestions(word: WordUnit, set: SentenceTextSet, rng?: Rng): ChoiceQuestion[]
}
```

- [ ] **Step 4: 实现**

`src/features/question-engine/engine.ts` 加:

```ts
/** 句型题文案(题干用图 + 一句话;选项是完整句子)。 */
const SENTENCE_PROMPT = '哪句话说对了?'

/**
 * 句型步:把每档的 1 正确句 + 3 错句 shuffle 成 4 选项的 choice 题。
 * 恒 3 题,顺序即档 1 → 档 3(由易到难);选项 speak = 句子本身,TTS 可整句朗读。
 */
function makeSentenceQuestions(
  word: WordUnit,
  set: SentenceTextSet,
  rng: Rng = defaultRng(),
): ChoiceQuestion[] {
  return set.tiers.map((tier, i) => {
    const tierNo = i + 1
    const seed = `${word.id}-${tierNo}-s-sentence`
    const texts = shuffle([tier.correct, ...tier.wrong], rng)
    const options = texts.map((text, n) => ({ id: `${seed}-${n}`, text, speak: text }))
    const answerId = options.find((o) => o.text === tier.correct)!.id
    return { kind: 'choice', prompt: SENTENCE_PROMPT, options, answerId }
  })
}
```

并在 `createQuestionEngineService` 的返回对象里加:

```ts
    makeSentenceQuestions: (word, set, rng) => makeSentenceQuestions(word, set, rng),
```

顶部 import 类型:

```ts
import type { SentenceTextSet } from '@/shared/services/question-engine'
```

- [ ] **Step 5: 跑测试确认通过**

Run: `npx vitest run src/features/question-engine/engine.test.ts`
Expected: PASS(既有用例 + 新增 4 例)。

- [ ] **Step 6: 提交**

```bash
git add src/shared/services/question-engine.ts src/features/question-engine/engine.ts src/features/question-engine/engine.test.ts
git commit -m "feat(question-engine): makeSentenceQuestions(三档选对句,复用 choice 形状)"
```

---

### Task 4: 引擎 `QuestionContext` 场景池

**Files:**
- Modify: `src/shared/services/question-engine.ts`
- Modify: `src/features/question-engine/engine.ts`
- Test: `src/features/question-engine/engine.test.ts`

**Interfaces:**
- Consumes: Task 3 的改动
- Produces: `QuestionContext = { sceneWordIds?: readonly number[]; learnedWordIds?: readonly number[] }`;`distractorsFor(word, count, rng?, context?)`;`makeChoice/makeListen/makeMatch(word, skill, rng, step?, context?)`;`makeStepQuestions(word, skill, rng?, context?)`

- [ ] **Step 1: 写失败测试**

追加:

```ts
describe('干扰项场景池', () => {
  const word = wordById(13)!   // 房子(shape 类)

  it('未传 context 时行为不变(同 category 优先)', () => {
    const ds = engine.distractorsFor(word, 3, () => 0.5)
    expect(ds).toHaveLength(3)
    expect(ds.every((d) => d.category === 'shape')).toBe(true)
  })

  it('传 sceneWordIds 时优先取场景词', () => {
    const ds = engine.distractorsFor(word, 2, () => 0.5, { sceneWordIds: [7, 14, 8] })
    expect(ds.map((d) => d.id).sort()).toEqual([7, 8])
  })

  it('场景词不足时用已学复习词补齐', () => {
    const ds = engine.distractorsFor(word, 3, () => 0.5, {
      sceneWordIds: [7],
      learnedWordIds: [21, 41],
    })
    expect(ds.map((d) => d.id).sort()).toEqual([7, 21, 41])
  })

  it('场景池与复习池都空 → 回落同 category', () => {
    const ds = engine.distractorsFor(word, 3, () => 0.5, { sceneWordIds: [], learnedWordIds: [] })
    expect(ds.every((d) => d.category === 'shape')).toBe(true)
  })

  it('排除目标词,且不与目标词任何一门文本撞车', () => {
    const ds = engine.distractorsFor(word, 3, () => 0.5, { sceneWordIds: [13, 7, 14, 8] })
    for (const d of ds) {
      expect(d.id).not.toBe(13)
      expect([d.hanzi, d.pinyin, d.english.toLowerCase()])
        .not.toEqual([word.hanzi, word.pinyin, word.english.toLowerCase()])
    }
  })

  it('makeChoice 透传 context', () => {
    const q = engine.makeChoice(word, 'hanzi', () => 0.5, 0, { sceneWordIds: [7, 14, 8] })
    const ids = q.options.map((o) => o.text)
    expect(ids).toContain('门')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/question-engine/engine.test.ts -t 干扰项场景池`
Expected: FAIL —— `distractorsFor` 忽略第 4 参,`'门'` 不在选项里。

- [ ] **Step 3: 扩契约**

`src/shared/services/question-engine.ts` 加:

```ts
/** 出题上下文:干扰项优先取自这些词(场景词 > 已学复习词 > 同 category > 跨类)。 */
export type QuestionContext = Readonly<{
  /** 本章场景词(ch1 = chapter.wordIds)。 */
  sceneWordIds?: readonly number[]
  /** 已学复习词(progress 中已完成的词)。 */
  learnedWordIds?: readonly number[]
}>
```

并把既有方法签名加**可选末位**参数:

```ts
  distractorsFor(word: WordUnit, count: number, rng?: Rng, context?: QuestionContext): WordUnit[]
  makeChoice(word: WordUnit, skill: SkillKey, rng: Rng, step?: number, context?: QuestionContext): ChoiceQuestion
  makeListen(word: WordUnit, skill: SkillKey, rng: Rng, step?: number, context?: QuestionContext): ListenChoiceQuestion
  makeMatch(word: WordUnit, skill: SkillKey, rng: Rng, step?: number, context?: QuestionContext): MatchQuestion
  makeStepQuestions(word: WordUnit, skill: SkillKey, rng?: Rng, context?: QuestionContext): Question[]
```

- [ ] **Step 4: 实现池序**

`src/features/question-engine/engine.ts` 改 `distractorsFor`:

```ts
/** 干扰项池序:场景词 → 已学复习词 → 同 category → 跨类补齐;各段独立 shuffle,按序拼接取前 count。 */
function distractorsFor(
  vocabulary: VocabularyService,
  word: WordUnit,
  count: number,
  rng: Rng = defaultRng(),
  context?: QuestionContext,
): WordUnit[] {
  const words = vocabulary.getAllWords()
  const clash = (w: WordUnit) =>
    w.hanzi === word.hanzi || w.english.toLowerCase() === word.english.toLowerCase() || w.pinyin === word.pinyin
  const usable = (w: WordUnit) => w.id !== word.id && !clash(w)
  const byIds = (ids: readonly number[] | undefined) => {
    if (!ids || ids.length === 0) return []
    const set = new Set(ids)
    return words.filter((w) => set.has(w.id) && usable(w))
  }
  const scene = shuffle(byIds(context?.sceneWordIds), rng)
  const learned = shuffle(byIds(context?.learnedWordIds), rng)
  const seen = new Set([...scene, ...learned].map((w) => w.id))
  const rest = words.filter((w) => usable(w) && !seen.has(w.id))
  const sameCat = shuffle(rest.filter((w) => w.category === word.category), rng)
  const others = shuffle(rest.filter((w) => w.category !== word.category), rng)
  const pool = [...scene, ...learned, ...sameCat, ...others]
  if (pool.length < count) {
    throw new Error(`词库不足以生成 ${count} 个干扰项`)
  }
  return pool.slice(0, count)
}
```

把 `context` 一路透传:`makeChoice` / `makeListen` / `makeMatch` / `makeStepQuestions` / `buildTextQuestion` 各加末位 `context?: QuestionContext`,并在内部 `distractorsFor(..., rng, context)`。

`createQuestionEngineService` 的返回对象同步加参数:

```ts
    distractorsFor: (word, count, rng, context) => distractorsFor(vocabulary, word, count, rng, context),
    makeChoice: (word, skill, rng, step, context) => makeChoice(vocabulary, word, skill, rng, step, context),
    makeListen: (word, skill, rng, step, context) => makeListen(vocabulary, word, skill, rng, step, context),
    makeMatch: (word, skill, rng, step, context) => makeMatch(vocabulary, word, skill, rng, step, context),
    makeStepQuestions: (word, skill, rng, context) => makeStepQuestions(vocabulary, word, skill, rng, context),
```

- [ ] **Step 5: 跑测试确认通过**

Run: `npx vitest run src/features/question-engine/engine.test.ts`
Expected: PASS(既有用例不回归 + 新增 6 例绿)。

- [ ] **Step 6: 提交**

```bash
git add src/shared/services/question-engine.ts src/features/question-engine/engine.ts src/features/question-engine/engine.test.ts
git commit -m "feat(question-engine): QuestionContext 场景池,干扰项优先取本章词与复习词"
```

---

### Task 5: 千字谷 `WordLayer` + runner + 存档解析

**Files:**
- Modify: `src/features/qianzigu/chapter.ts:4`
- Modify: `src/features/qianzigu/word-progress.ts`(`layerToSkill`、`restoredKey`、`parseRestoreState`)
- Modify: `src/features/qianzigu/engine.ts`(`taskKey` 无需改,但测试要覆盖三键)
- Test: `src/features/qianzigu/engine.test.ts`、`src/features/qianzigu/chapter-progress.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `WordProgress.sentenceLevel`
- Produces: `WordLayer = 'sound' | 'shape' | 'sentence'`;`layerToSkill('sentence') === 'hanzi'`;`parseRestoreState` 接受 `layer: 'sentence'`

- [ ] **Step 1: 写失败测试**

`src/features/qianzigu/chapter-progress.test.ts` 追加:

```ts
describe('restoreState 支持 sentence 层', () => {
  it('parseRestoreState 保留 sentence 条目', () => {
    const json = JSON.stringify([{ wordId: 13, layer: 'sound' }, { wordId: 13, layer: 'sentence' }])
    expect(parseRestoreState(json)).toEqual([
      { wordId: 13, layer: 'sound' },
      { wordId: 13, layer: 'sentence' },
    ])
  })

  it('未知 layer 仍被过滤', () => {
    expect(parseRestoreState(JSON.stringify([{ wordId: 13, layer: 'bogus' }]))).toEqual([])
  })
})
```

`src/features/qianzigu/engine.test.ts` 追加:

```ts
it('同词三层计数互不串数', () => {
  const runner = createChapterRunner(CHAPTER_1)
  // 用一个只含 task 三幕的假章节更稳;此处直接对 ch1 的 task 场景发事件
  const t1 = CHAPTER_1.scenes.find((s) => s.id === 't1-sound')!
  // …(按既有测试的推进模式,从 start 走到 t1-sound,再发 sentence 层事件)
})
```

> 实现者注:若既有 `engine.test.ts` 已有「推进到指定 task 场景」的辅助函数,复用它;没有就按该文件既有风格写最小推进循环。**断言**:对同一 `wordId` 分别发 `task-correct`(sound)与 `task-correct`(sentence),`taskHits` 应为 `{'13:sound': 1, '13:sentence': 1}` 两条独立键。

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/qianzigu/chapter-progress.test.ts`
Expected: FAIL —— `sentence` 条目被过滤掉。

- [ ] **Step 3: 改类型与解析**

`src/features/qianzigu/chapter.ts:4`:

```ts
export type WordLayer = 'sound' | 'shape' | 'sentence'  // sound=拼音恢复,shape=汉字恢复,sentence=句型
```

`src/features/qianzigu/word-progress.ts`:

```ts
/** 章节任务层 → 技能键:sound=拼音恢复,shape=汉字恢复;sentence 按汉字文本通道渲染与朗读。 */
export function layerToSkill(layer: WordLayer): SkillKey {
  return layer === 'sound' ? 'pinyin' : 'hanzi'
}
```

`parseRestoreState` 的合法性判断改为集合:

```ts
const LAYERS: readonly WordLayer[] = ['sound', 'shape', 'sentence']
// …
      return typeof e?.wordId === 'number' && LAYERS.includes(e.layer as WordLayer)
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/features/qianzigu/chapter-progress.test.ts src/features/qianzigu/engine.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/features/qianzigu/chapter.ts src/features/qianzigu/word-progress.ts src/features/qianzigu/engine.test.ts src/features/qianzigu/chapter-progress.test.ts
git commit -m "feat(qianzigu): WordLayer 加 sentence 层,存档解析与技能映射同步"
```

---

### Task 6: `TaskScene` 句步渲染 + 原地重出 + 接线

**Files:**
- Modify: `src/features/qianzigu/scene-ui.tsx:202-257`(`TaskScene`)、`TaskSceneProps`
- Modify: `src/features/qianzigu/ChapterRunnerView.tsx:260-275`
- Test: `src/features/qianzigu/ChapterRunnerView.test.tsx`

**Interfaces:**
- Consumes: Task 2 `sentenceSetFor`;Task 3 `makeSentenceQuestions`;Task 5 `WordLayer`;Task 4 `QuestionContext`
- Produces: `TaskSceneProps.makeQuestions(): Question[]` 语义不变;新增行为 = `layer === 'sentence'` 时重出错题**保留 `qIndex`**

- [ ] **Step 1: 写失败测试**

`src/features/qianzigu/ChapterRunnerView.test.tsx` 追加一个用例:渲染 ch1 走到 `t1-sentence`(用既有测试的推进辅助),断言:

```ts
// 1) 题面出现「哪句话说对了?」
// 2) 连续两次错答 → 重出后仍是同一档(题干不变,不回到档 1)
```

> 实现者注:按该文件既有渲染/推进风格写。若推进到指定幕不便,退而用 `TaskScene` 的独立组件测试(直接给 props 渲染 `layer: 'sentence'`),断言重出保留 `qIndex` 的行为。

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/qianzigu/ChapterRunnerView.test.tsx`
Expected: FAIL —— `t1-sentence` 尚不存在(该幕在 Task 8 才加),或重出回到档 1。

> 因 `t1-sentence` 由 Task 8 落地,本任务的测试**先针对 `TaskScene` 独立渲染**写(不依赖 ch1 数据)。

- [ ] **Step 3: 改 `TaskScene`**

`src/features/qianzigu/scene-ui.tsx`:

```tsx
  function handleRetry() {
    // 句步:原地重出当前档(保留 qIndex),否则档 3 答错两次会被打回档 1,对儿童过苛。
    // 其余层维持「重置整套」的既有行为。
    if (scene.task.layer === 'sentence') {
      setQuestions(makeQuestions())
      setRound((r) => r + 1)
      return
    }
    setQuestions(makeQuestions())
    setQIndex(0)
    setRound((r) => r + 1)
  }
```

- [ ] **Step 4: 改 `ChapterRunnerView` 接线**

`src/features/qianzigu/ChapterRunnerView.tsx` 的 `case 'task'`:

```tsx
      case 'task': {
        const word = services.vocabulary.wordById(current.task.wordId)
        if (!word) return null
        const skill = layerToSkill(current.task.layer)
        const context = taskContext()
        const makeQuestions = current.task.layer === 'sentence'
          ? () => {
              const set = sentenceSetFor(word.id)
              return set ? services.questionEngine.makeSentenceQuestions(word, set, Math.random) : []
            }
          : () => services.questionEngine.makeStepQuestions(word, skill, Math.random, context)
        return (
          <TaskScene
            scene={current}
            word={word}
            skill={skill}
            makeQuestions={makeQuestions}
            speak={speak}
            playSound={playSound}
            onCorrect={handleTaskCorrect}
          />
        )
      }
```

新增 `taskContext()`(组件内,用已有的 `localProgressRef`):

```tsx
  /** 出题上下文:本章场景词 + 已学复习词(排除不在场景内的本章已完成词,避免重复)。 */
  function taskContext(): QuestionContext {
    const progress = localProgressRef.current
    const learned = Object.values(progress)
      .filter((p) => p.completed.pinyin || p.completed.hanzi || p.completed.english)
      .map((p) => p.wordId)
    return { sceneWordIds: chapter.wordIds, learnedWordIds: learned }
  }
```

`boss` 的 `makeQuestion` 同样透传 context:

```tsx
            makeQuestion={(word, skill) =>
              services.questionEngine.makeStepQuestions(word, skill, Math.random, taskContext())[0]}
```

`ChapterRunnerView.tsx` 顶部 import 加 `sentenceSetFor` from `@/features/vocabulary/sentences`、`QuestionContext` 类型。

> ⚠ 若 `chapter` 在该组件里不是 in-scope 变量,按该文件既有取章节的方式取(查 `chapter` 或 `CHAPTER_1` 的现有引用点)。

- [ ] **Step 5: 跑测试确认通过**

Run: `npx vitest run src/features/qianzigu/ && npm run lint`
Expected: PASS + lint 干净。

- [ ] **Step 6: 提交**

```bash
git add src/features/qianzigu/scene-ui.tsx src/features/qianzigu/ChapterRunnerView.tsx src/features/qianzigu/ChapterRunnerView.test.tsx
git commit -m "feat(qianzigu): TaskScene 句步渲染 + 原地重出;ChapterRunnerView 注入场景池"
```

---

### Task 7: 千字谷结算(句步 +30 / 整词 +20 含句步)

**Files:**
- Modify: `src/features/qianzigu/word-progress.ts`(`settleChapterStep`、`chapterWordDone`)
- Test: `src/features/qianzigu/chapter-progress.test.ts` 或新建 `src/features/qianzigu/word-progress.test.ts`

**Interfaces:**
- Consumes: Task 1 `sentenceLevel`
- Produces: `settleChapterStep(wordId, prev, layer, rules, settings)` 支持 `layer === 'sentence'`;`chapterWordDone(row)` = `pinyin && hanzi && sentenceLevel >= 3`

- [ ] **Step 1: 写失败测试**

```ts
describe('句步结算', () => {
  const rules = createProgressRulesService()
  const settings = { enableChinese: true, enableEnglish: false } as UserSettings

  it('句步首过(+30)且 sentenceLevel 记 3', () => {
    const prev = { ...emptyWordProgress(13), completed: { pinyin: true, hanzi: true, english: false } }
    const { next, stepReward } = settleChapterStep(13, prev, 'sentence', rules, settings)
    expect(next.sentenceLevel).toBe(3)
    expect(stepReward).toBe(30)
  })

  it('句步已满级不重复发星尘', () => {
    const prev = { ...emptyWordProgress(13), completed: { pinyin: true, hanzi: true, english: false }, sentenceLevel: 3 }
    expect(settleChapterStep(13, prev, 'sentence', rules, settings).stepReward).toBe(0)
  })

  it('整词 +20 在三层齐备时才发', () => {
    const twoSkill = { ...emptyWordProgress(13), completed: { pinyin: true, hanzi: true, english: false } }
    // 只差句步:此时 +20 不能发
    expect(settleChapterStep(13, twoSkill, 'sentence', rules, settings).wordBonus).toBe(0)
    // sentenceLevel 已 3 后再补? 不会发生 —— 句步一次结算即 3
  })

  it('chapterWordDone 要求 pinyin + hanzi + sentenceLevel >= 3', () => {
    expect(chapterWordDone({ ...emptyWordProgress(13), completed: { pinyin: true, hanzi: true, english: false } })).toBe(false)
    expect(chapterWordDone({
      ...emptyWordProgress(13), completed: { pinyin: true, hanzi: true, english: false }, sentenceLevel: 3,
    })).toBe(true)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/qianzigu/word-progress.test.ts`
Expected: FAIL —— `sentence` 走 `layerToSkill` 落到 hanzi 分支,`sentenceLevel` 恒 0。

- [ ] **Step 3: 实现**

`src/features/qianzigu/word-progress.ts`:

```ts
/** 整词在「千字谷语义」下完成 = 拼音 + 汉字双技能 + 句型三档全过(不掺英语域)。 */
export function chapterWordDone(row: WordProgress | undefined): boolean {
  return !!row && row.completed.pinyin && row.completed.hanzi && row.sentenceLevel >= MAX_SENTENCE_LEVEL
}

const MAX_SENTENCE_LEVEL = 3

export function settleChapterStep(
  wordId: number,
  prev: WordProgress | undefined,
  layer: WordLayer,
  rules: ProgressRulesService,
  settings: UserSettings,
): { next: WordProgress; stepReward: number; wordBonus: number } {
  const base = prev ?? emptyWordProgress(wordId)
  const wasComplete = chapterWordDone(base)
  const completed = { ...base.completed }
  let sentenceLevel = base.sentenceLevel
  let stepReward = 0

  if (layer === 'sentence') {
    if (sentenceLevel < MAX_SENTENCE_LEVEL) {
      sentenceLevel = MAX_SENTENCE_LEVEL
      stepReward = SKILL_STEP_REWARD
    }
  } else {
    const skill = layerToSkill(layer)
    if (!completed[skill]) {
      completed[skill] = true
      stepReward = SKILL_STEP_REWARD
    }
  }

  const next: WordProgress = {
    wordId: base.wordId,
    completed,
    sentenceLevel,
    starsEarned: base.starsEarned,
    updatedAt: new Date().toISOString(),
  }
  const wordBonus = chapterWordDone(next) && !wasComplete ? WORD_COMPLETE_BONUS : 0
  next.starsEarned += stepReward + wordBonus
  return { next, stepReward, wordBonus }
}
```

> **口径变更**:`wasComplete` / `isComplete` 由 `rules.fullComplete` 改为 `chapterWordDone` —— 整词 +20 现在含句步(spec §8)。`rules` 参数**保留**在签名里(调用方不变),但本函数不再用它;若 lint 报未使用参数,改为 `_rules` 或从签名移除并同步调用点(`ChapterRunnerView` 的结算调用处)。

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/features/qianzigu/`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/features/qianzigu/word-progress.ts src/features/qianzigu/word-progress.test.ts
git commit -m "feat(qianzigu): 句步首过 +30,整词 +20 含句步"
```

---

### Task 8: ch1 数据(23 幕 + 叙事改动)

**Files:**
- Modify: `src/features/qianzigu/ch1.ts`
- Modify: `src/features/qianzigu/ch1.test.ts`
- Test: `src/features/qianzigu/ch1.test.ts`、`src/features/qianzigu/ch1-script.test.ts`

**Interfaces:**
- Consumes: Task 5 `WordLayer`,Task 2 句库
- Produces: `CHAPTER_1.scenes` 23 幕,`restoreOrder` 15 项

- [ ] **Step 1: 更新结构测试**

`src/features/qianzigu/ch1.test.ts`:

```ts
  it('每词三层齐备(sound / shape / sentence)', () => {
    const tasks = CHAPTER_1.scenes.filter((s): s is Extract<typeof s, { kind: 'task' }> => s.kind === 'task')
    for (const wid of CHAPTER_1.wordIds) {
      const covered = new Set(tasks.filter((t) => t.task.wordId === wid).map((t) => t.task.layer))
      for (const layer of ['sound', 'shape', 'sentence']) {
        expect(covered.has(layer as never), `词 ${wid} 缺 ${layer}`).toBe(true)
      }
    }
  })

  it('共 23 幕、断点恰 3 个、句型幕紧跟同词 shape 之后', () => {
    expect(CHAPTER_1.scenes).toHaveLength(23)
    expect(CHAPTER_1.scenes.filter((s) => s.kind === 'break')).toHaveLength(3)
    for (const wid of CHAPTER_1.wordIds) {
      const idx = (layer: string) =>
        CHAPTER_1.scenes.findIndex((s) => s.kind === 'task' && s.task.wordId === wid && s.task.layer === (layer as never))
      expect(idx('sentence')).toBe(idx('shape') + 1)
    }
  })

  it('restoreOrder 覆盖 15 项(每词三层)', () => {
    expect(CHAPTER_1.restoreOrder).toHaveLength(15)
  })
```

`src/features/qianzigu/ch1-script.test.ts` 加一条:句型幕的句题数据在 `sentences.ts`,其句长守卫见 `sentences.test.ts` —— **本文件不重复**。

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/qianzigu/ch1.test.ts`
Expected: FAIL —— 只有 18 幕、缺 sentence 层。

- [ ] **Step 3: 改 `restoreOrder`**

```ts
  restoreOrder: [13, 13, 13, 7, 7, 7, 14, 14, 14, 8, 8, 8, 19, 19, 19],
```

- [ ] **Step 4: 每词加一个句型幕**

在每对 `t{n}-shape` 之后、下一个 `break`/`social` 之前插入(以词 1 为例):

```ts
    {
      id: 't1-sentence',
      kind: 'task',
      title: '用「房子」说句话',
      intro: [{ role: 'lingling', text: '会认还不够，咱们用它说句话！' }],
      task: { wordId: 13, layer: 'sentence', minCorrect: 3 },
      onDone: [{ role: 'xuwannian', text: '我住在房子里——说对啦！' }],
    },
```

五个词的 `id` / `wordId` / `onDone` 分别替换:

| 幕 id | wordId | title | onDone 台词 |
| --- | --- | --- | --- |
| `t1-sentence` | 13 | 用「房子」说句话 | 我住在房子里——说对啦！ |
| `t2-sentence` | 7 | 用「门」说句话 | 推开门，就进屋啦！ |
| `t3-sentence` | 14 | 用「钥匙」说句话 | 钥匙一掏，门就开！ |
| `t4-sentence` | 8 | 用「窗户」说句话 | 风从窗户进来，真凉快！ |
| `t5-sentence` | 19 | 用「台灯」说句话 | 台灯一亮，屋子就暖了！ |

- [ ] **Step 5: 叙事改动(任务 8 的核心)**

**(a) 挫败低谷** —— 改 `t3-sound` 的 `intro` 为(前半为新增的「刚想起的又滑走」拍):

```ts
      intro: [
        { role: 'xuwannian', text: '等等……刚才那个叫啥来着？' },
        { role: 'lingling', text: '是门呀，你刚想起来的！' },
        { role: 'xuwannian', text: '哦对……门。' },
        { role: 'lingling', text: '门是认出来了，可它锁着呢。' },
        { role: 'xuwannian', text: '钥匙……钥匙就在我口袋里！' },
        { role: 'lingling', text: '那你快拿出来呀？' },
        { role: 'xuwannian', text: '可我说不出它叫啥，就摸不着它！' },
        { role: 'lingling', text: '它叫「钥匙」！yào shi！' },
      ],
```

**(b) 高潮重写** —— 改 `boss` 的 `win`(新增「叫出苏灵灵的名字」= 弧光落点):

```ts
      win: [
        { role: 'xuwannian', text: '都想起来了！房子、门、钥匙、窗户、台灯！', mood: 'happy' },
        { role: 'xuwannian', text: '还有你——苏灵灵！', mood: 'happy' },
        { role: 'lingling', text: '诶？你记住我的名字啦！' },
        { role: 'lingling', text: '一个都没落下！' },
      ],
```

**(c) 笑点 3 处已在位**(`open` 卡壳 / `t2-shape` onDone 推门拉反 / `social` 皮小闹撞人),**不改**,只在文档登记(见 Task 9)。

- [ ] **Step 6: 跑全部相关测试**

Run: `npx vitest run src/features/qianzigu/ && npm run lint`
Expected: PASS(含句长守卫 —— 新增台词全部 ≤20 字)。

- [ ] **Step 7: 提交**

```bash
git add src/features/qianzigu/ch1.ts src/features/qianzigu/ch1.test.ts src/features/qianzigu/ch1-script.test.ts
git commit -m "feat(qianzigu): ch1 扩到 23 幕(每词声形句三步)+ 挫败低谷与 boss 高潮重写"
```

---

### Task 9: 文档同步

**Files:**
- Modify: `docs/design/game-story-bible.md`(§4 章节契约)
- Modify: `docs/design/game-direction.md`(§1 逐幕表、§2 交互流、§4 现状表)
- Modify: `docs/dev-reference.md`(模块清单加 `vocabulary/sentences.ts`)
- Modify: `docs/PLAN.md`(ch1 重构行状态)

**Interfaces:** 纯文档,无代码接口。

- [ ] **Step 1: 更新 bible §4 章节契约**

把「共 18 场景」改为 23;场景序补 `t{n}-sentence`;新增两栏并填:

```markdown
- **高潮位**:`boss` win —— 徐万年在叫回五个名字之后,叫出「苏灵灵」的名字(他此前只记得自己的事)。
- **笑点位**(机制限误会/重复/落差,禁谐音梗与双关):① `open` 重复——徐万年卡壳说半句又卡住;② `t2-shape` onDone 落差——先认出「门」,再被点破刚才一直在往外拉;③ `social` 夸张——皮小闹「让让让让让让——」一头撞上。
- **每章结构**:5 词 × 三层恢复(声/形/句)× `minCorrect`(2/2/3) + 3 断点 + 1 社交事件 + 1 BOSS + ending + settle。
```

- [ ] **Step 2: 重写 `game-direction.md` §1 逐幕表**

18 幕表 → 23 幕表:每词加一行 `t{n}-sentence`(功能 = 句型三档选对句;交互 = 3 题,每题 2 次机会;演出钩子 = 该词说进一句完整的话)。§2 交互流补 `t{n}-sentence`。§4 现状表把「18 幕」改 23,并加一行「句型步 ✅ 已落地」。

- [ ] **Step 3: 补 dev-reference 模块清单**

在 `vocabulary` 条目里加:`+ sentences.ts(ch1 句型句库:每词 3 档 × 4 句,受 sentences.test.ts 守卫)`。

- [ ] **Step 4: 更新 PLAN**

`0.3.0 feature` 轨的 ch1 重构行 → `[x]`(若代码已合)或保留 `[ ]` 并把状态改为「开发完成待发」。同时把想法池「汉语句型步全量」行补一句「称号阈值重算」为全量前置。

- [ ] **Step 5: 提交**

```bash
git add docs/design/game-story-bible.md docs/design/game-direction.md docs/dev-reference.md docs/PLAN.md
git commit -m "docs(qianzigu): 同步 23 幕结构 + 章节契约高潮位/笑点位"
```

---

### Task 10: 端到端验收

**Files:** 无代码改动(纯验证)

- [ ] **Step 1: 全量测试 + lint + 构建**

```bash
npm test
npm run lint
npm run build
```

Expected: 全绿;`build` 的 `tsc -b` 覆盖 `worker/` 类型。

- [ ] **Step 2: 本地迁移**

```bash
npm run db:local
```

Expected: `0006_sentence_step.sql` 应用成功,无报错。

- [ ] **Step 3: 浏览器人工走查(`npm run dev`)**

逐项确认:

1. 23 幕顺序:每词「声 → 形 → 句」连排
2. 句幕出 3 题、由易到难;**档 3 答错两次后仍在档 3**(不被打回档 1)
3. 句题选项**可点读**(4 句都能整句朗读)
4. 干扰项确为本章词(答「房子」时选项里出现门/钥匙/窗户,而非鲸鱼/火箭)
5. `boss` win 出现「还有你——苏灵灵!」
6. 断点仍 3 个,「明天再来」正常落库
7. 刷新续玩:句步进度保留
8. 整词星尘:五星全过时 +110(30+30+30+20)

- [ ] **Step 4: 记录结果**

把走查结果(通过/发现的问题)追加到发布条目的复盘三问。**未过闸门不得进入发布流程**。

- [ ] **Step 5: 提交(若有修复)**

```bash
git add -A
git commit -m "fix(qianzigu): ch1 走查修复"
```

---

## Self-Review

**Spec 覆盖核对:**

| Spec 节 | 落在 |
| --- | --- |
| §3 数据模型(A2) | Task 1、5 |
| §3.2 迁移 0006 | Task 1 Step 6 |
| §3.3 worker | Task 1 Step 7 |
| §3.5 千字谷侧 | Task 5 |
| §4.1 句库数据结构 | Task 2 |
| §4.2 三档规则 + 干扰词约束 | Task 2(数据 + 守卫测试) |
| §4.3 引擎 | Task 3 |
| §4.4 判分(`minCorrect 3` / 原地重出) | Task 6、8 |
| §4.5 无障碍(可朗读) | Task 3 Step 4(`speak` = 句子)、Task 10 Step 3.3 |
| §4.6 词库不扩充 | **零改动**(候选词只从现有 100 词里选;由 Task 2 的逐句 `wordById` 守卫测试保证) |
| §5 干扰项场景池 | Task 4、6 |
| §6 叙事重写(高潮/笑点) | Task 8 Step 5、Task 9 |
| §7 幕数 18 → 23 | Task 8 |
| §8 星尘与结算 | Task 7 |
| §9 测试域 | 各 Task 的测试步骤 |
| §10 文档同步 | Task 9 |
| §12 验收闸门 | Task 10 |

**占位符扫描:** Task 5 Step 1 与 Task 6 Step 1 含「实现者注」—— 它们指向按既有测试风格补齐的**测试脚手架**,断言已写明;其余步骤均含完整代码。数据内容(60 句、23 幕台词改动)全部写实。

**类型一致性:** `sentenceLevel` / `SentenceSet` / `SentenceTextSet` / `QuestionContext` / `makeSentenceQuestions` / `sentenceSetFor` / `chapterWordDone` 在全部 Task 中用同一名字与签名。
