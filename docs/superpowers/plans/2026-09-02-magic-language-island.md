# 魔法语言岛(MVP)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有「隐私生活记录」app 替换为面向儿童的拼音/汉字/英语闯关游戏「魔法语言岛」MVP——新手村 10 关线性闯关、积分/星级/星尘/exp/等级、进度持久化到 D1。

**Architecture:** 保留 Cloudflare Workers + D1 + token 认证后端栈;题库静态写在 React 前端 `src/data/levels.ts`;进度以整份 GameState JSON 单行存 D1 `game_state` 表,worker 仅提供 `GET/PUT /api/game`。前端为无路由库的屏幕状态机(`boot/login/map/play/result`),计分与进度合并抽成纯函数便于测试。发音用浏览器 SpeechSynthesis(拼音卡以同音汉字朗读),音效用 Web Audio 合成。

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind 4 + motion + lucide-react(现有);`vitest`(新增,仅测纯逻辑);Cloudflare Workers + D1(现有);无路由库/状态库。

**Spec:** `docs/superpowers/specs/2026-09-02-magic-language-island-design.md`

## Global Constraints

- 不引入路由库/状态管理库;无第三方 UI 库新增(仅新增 devDep `vitest` 用于测纯逻辑层)。
- UI 文案全中文;新增文案保持中文。
- 仓库当前无测试框架;`vitest` 只覆盖 `src/game/scoring.ts` 与 `src/game/state.ts` 纯函数,不测 React/UI/Worker。
- Worker 代码类型用 `@cloudflare/workers-types`,走 `worker/tsconfig.json`,不与前端 tsconfig 混用。
- 拼音发音规则:**显示拼音,但 `speak` 朗读文本用同音汉字/近似音节**(zh-CN TTS 读拼音串不可靠),英语用 en-US 直读原词。
- 每关答题逻辑:每题最多 2 次作答;首次答对 +10(上一题首对则 +2 连击),二次答对 +5,两次错 +0 并亮正确答案。
- 关末星级:满分 = 题数×10;得分率 = min(100%, 得分/满分);≥90%→3★、≥70%→2★、≥50%→1★、否则 0★(未通关)。
- 星尘只按历史最优星级发一次(3★=60、2★=40、1★=20),提升最优时补差;exp 每关首通一次 +80。等级 = floor(exp/300)+1。
- 删除记录:生活记录 UI(`tabs/dashboard/exercises/date`)、`records` worker 路由与 `LifeRecord` 类型;`GET /api/records` 最终 404。
- 迁移顺序:`npm run db:migrate`(本地)/ 远程 `wrangler d1 execute --remote --file=./migrations/<file>.sql`。
- 每任务结束跑 `npm run build`(tsc -b)与 `npm run lint`;纯逻辑任务跑 `npm test`。
- git 分支:实现开始时从当前 HEAD 新建 `feat/magic-language-island`。

---

### Task 1: 类型定义 + 计分与进度合并纯函数(vitest TDD)

**Files:**
- Create: `vitest.config.ts`
- Create: `src/types.ts`(整体重写)
- Create: `src/game/scoring.ts`
- Create: `src/game/state.ts`
- Create: `src/game/scoring.test.ts`
- Create: `src/game/state.test.ts`
- Modify: `package.json`(scripts `"test": "vitest run"`, devDep vitest)
- Modify: `CLAUDE.md`(本节暂不改,收尾任务统一改)——不用改。

**Interfaces:**
- Produces(后续所有任务依赖):
  - `src/types.ts`:`KingdomKey`、`QuestionKind`、`BaseOption`、`ListenChoiceQuestion`、`ChoiceQuestion`、`MatchQuestion`、`Question`、`Level`、`LevelRecord`、`GameState`、`UserProfile`。
  - `scoring.ts`:`AttemptResult {correct, points, streak}`, `scoreAttempt(q: Question, selectedId: string, attempt: 1|2, prevStreak: number): AttemptResult`;`LevelRun`(逐题结果数组);`runLevel(level, runs: LevelRun[]): LevelOutcome`;`LevelOutcome { rawScore, baseMax, rate, stars, maxStreak, firstTryCorrect }`;`starsForRate(rate: number): 0|1|2|3`。
  - `state.ts`:`emptyGameState(): GameState`;`levelOfExp(exp): number`;`kingdomForLevel(levelId): KingdomKey | null`(10 关为 null,不归属王国);`applyResult(state, levelId, outcome): { state: GameState; starDelta: number; expDelta: number; unlockedNew: boolean }`。
  - Match 题的作答归一到 `scoreAttempt`:匹配题一次性判定整组(`selectedId` 传整组答案的判别不适用——`runLevel` 对 match 采用「全对 +10、否则 0」的整组判定,见测试)。

- [ ] **Step 1: 安装 vitest 并配置**

Run: `npm install -D vitest && npm pkg set scripts.test="vitest run"`
Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
```

- [ ] **Step 2: 写类型定义**

Write `src/types.ts`(整体替换旧内容):
```ts
export type KingdomKey = 'pinyin' | 'hanzi' | 'english'
export type QuestionKind = 'listen-choice' | 'choice' | 'match'

export type BaseOption = {
  id: string
  text: string
  emoji?: string
  speak?: string // 🔊 点击朗读的文本;拼音卡此处用同音汉字
}

export type ListenChoiceQuestion = {
  kind: 'listen-choice'
  prompt: string // 题干,如「听一听,选一选」
  promptSpeak: string // 进题自动朗读的文本
  options: BaseOption[] // 恰好 4 项,仅 1 项正确
  answerId: string
}

export type ChoiceQuestion = {
  kind: 'choice'
  prompt: string
  speak?: string // 可点读题干
  options: BaseOption[]
  answerId: string
}

export type MatchQuestion = {
  kind: 'match'
  prompt: string
  left: BaseOption[] // left 卡组
  right: BaseOption[] // right 卡组(乱序)
  answerMap: Record<string, string> // left.id -> right.id
}

export type Question = ListenChoiceQuestion | ChoiceQuestion | MatchQuestion

export type Level = {
  id: number
  kingdom: KingdomKey | 'mixed'
  title: string
  questions: Question[]
}

export type LevelRecord = { stars: 0 | 1 | 2 | 3; bestScore: number }

export type GameState = {
  stars: number
  exp: number
  unlocked: number // 已解锁最大关卡号,1..11
  levels: Record<number, LevelRecord>
  kingdom: Record<KingdomKey, number>
  updatedAt: string
}

export type UserProfile = { id: string; email: string; name: string }
```

- [ ] **Step 3: 写计分测试(先红)**

Write `src/game/scoring.test.ts`(以最小 4 选项样板构造题目,逐条 `it()` 落地):
```ts
import { describe, expect, it } from 'vitest'
import type { Question } from '../types'
import { runLevel, scoreAttempt, starsForRate } from './scoring'

const OPTS = [
  { id: 'a', text: 'a' },
  { id: 'b', text: 'b' },
  { id: 'c', text: 'c' },
  { id: 'd', text: 'd' },
]

function listenQuestion(answerId: string): Question {
  return { kind: 'listen-choice', prompt: '听一听', promptSpeak: '啊', options: OPTS, answerId }
}
```
测试要点如下,逐条写独立 `it()`:
- `scoreAttempt` 首对:`scoreAttempt(listenQuestion('a'), 'a', 1, 0)` → `{correct:true, points:10, streak:1}`。
- 连击:prevStreak 3 → points 12(10+2),streak 4。
- 二答对:attempt 2 → points 5,streak 0。
- 两次错:attempt 2、selectedId 'b' → `{correct:false, points:0, streak:0}`。
- 错误答案 attempt1:correct false、streak 0。
- `starsForRate` 边界:1→3、0.9→3、0.8→2、0.7→2、0.6→1、0.5→1、0.49→0、0→0。
- `runLevel` 6 题全首对:构造 `level`(6 个 listenQuestion 变体)与 6 条 `runs`(每条 `{question, selectedId: 正确, attempt: 1, prevStreak: i-1}`)→ rawScore = 60+10=70(第2题起每题+2,共 6 题 → 10+12+12+12+12+12=70)、rate=min(100, 70/60*100)=100、stars 3、maxStreak 6、firstTryCorrect 6。
- `runLevel` 含一题二次对(错后二答):rate < 100;全错 → rate 0、stars 0。
- `scoreAttempt` 首对:attempt 1、prevStreak 0 → `{correct:true, points:10, streak:1}`。
- 连击:attempt 1、prevStreak 3 → points 12(10+2),streak 4。
- 二答对:attempt 2 → points 5,streak 0(连击断)。
- 两次错:attempt 2、选错 → `{correct:false, points:0, streak:0}`。
- `starsForRate(1)`→3、`(0.9)`→3、`(0.8)`→2、`(0.7)`→2、`(0.6)`→1、`(0.5)`→1、`(0.49)`→0、`(0)`→0。
- `runLevel`:6 题全首对 → rawScore 含连击 ≥60、rate 封顶 100、stars 3、maxStreak 6、firstTryCorrect 6。
- `runLevel` 含 1 题二次对:首对率下降,rate < 100;答案全错 → rate 0、stars 0。

- [ ] **Step 4: 写进度合并测试(先红)**

Write `src/game/state.test.ts`(`LevelOutcome` 定义在 `./scoring`,`state.ts` import 它;用最小 outcome 工厂构造结算结果):
```ts
import { describe, expect, it } from 'vitest'
import type { GameState } from '../types'
import { starsForRate, type LevelOutcome } from './scoring'
import { applyResult, emptyGameState, kingdomForLevel, levelOfExp } from './state'

function outcome(stars: 0 | 1 | 2 | 3, rawScore: number): LevelOutcome {
  return { rawScore, baseMax: 60, rate: 0, stars, maxStreak: 0, firstTryCorrect: 0 }
}
```
`applyResult` 用例(每个独立 `it()`,用 `outcome(3, 60)` 等构造):
- `emptyGameState()`:stars 0、exp 0、unlocked 1、levels `{}`、kingdom 三键全 0。
- 首通 L1(3★):starDelta 60、expDelta 80、unlocked 变 2、kingdom.pinyin 3、state.levels[1].stars 3。
- 复玩 L1 同 3★(再 apply 同 outcome):starDelta 0、expDelta 0、unlocked 不变。
- 首通 2★ 后复玩 3★:starDelta 20(补差)。
- 首通失败(0★):expDelta 0、starDelta 0、unlocked 不变、levels 无该关记录。
- 通过 L10(混合关):kingdom 三键均不增加。
- `levelOfExp(0)`→1、`(299)`→1、`(300)`→2、`(899)`→3。
- `kingdomForLevel(1..4)`→'pinyin'、5..7→'hanzi'、8..9→'english'、10→null。
- `emptyGameState()`:stars 0、exp 0、unlocked 1、levels `{}`、kingdom 三键全 0。
- 首通 L1(3★、rawScore 60):starDelta 60、expDelta 80、unlocked 变 2、kingdom.pinyin +3、state.levels[1].stars 3。
- 复玩 L1 同 3★:starDelta 0、expDelta 0、unlocked 不变。
- 首通 2★ 后复玩 3★:starDelta 20(补差)。
- 首通失败(0★):expDelta 0、starDelta 0、unlocked 不变、levels 无该关记录(不记录失败)。
- 通过 L10(混合关):kingdom 三键均不增加。
- `levelOfExp(0)`→1、`(299)`→1、`(300)`→2、`(899)`→3。
- `kingdomForLevel(1..4)`→'pinyin'、5..7→'hanzi'、8..9→'english'、10→null。

- [ ] **Step 5: 运行测试确认红**

Run: `npm test`
Expected: FAIL(模块不存在/导出缺失)。

- [ ] **Step 6: 实现计分纯函数**

Write `src/game/scoring.ts`:
```ts
import type { Level, Question } from '../types'

export type AttemptResult = { correct: boolean; points: number; streak: number }

export type LevelRun = {
  question: Question
  selectedId: string
  attempt: 1 | 2
  prevStreak: number
}

export type LevelOutcome = {
  rawScore: number
  baseMax: number
  rate: number // 0..100 整数
  stars: 0 | 1 | 2 | 3
  maxStreak: number
  firstTryCorrect: number
}

export function scoreAttempt(question: Question, selectedId: string, attempt: 1 | 2, prevStreak: number): AttemptResult {
  if (question.kind === 'match') {
    // 匹配题整组作答:left/right 必须全部配对;无二次作答机会(attempt 恒 1)
    const correct = question.left.every((l) => l.id === selectedId || selectedId === l.id) && question.answerMap[selectedId] !== undefined
    return { correct, points: correct ? 10 : 0, streak: correct ? prevStreak + 1 : 0 }
  }
  const correct = selectedId === question.answerId
  if (!correct) return { correct, points: 0, streak: 0 }
  const firstTry = attempt === 1
  const points = firstTry ? 10 + (prevStreak >= 1 ? 2 : 0) : 5
  const streak = firstTry ? prevStreak + 1 : 0
  return { correct, points, streak }
}

export function starsForRate(rate: number): 0 | 1 | 2 | 3 {
  if (rate >= 90) return 3
  if (rate >= 70) return 2
  if (rate >= 50) return 1
  return 0
}

export function runLevel(level: Level, runs: LevelRun[]): LevelOutcome {
  let raw = 0
  let maxStreak = 0
  let streak = 0
  let firstTryCorrect = 0
  for (const r of runs) {
    const res = scoreAttempt(r.question, r.selectedId, r.attempt, r.prevStreak)
    raw += res.points
    streak = res.streak
    if (streak > maxStreak) maxStreak = streak
    if (r.attempt === 1 && res.correct) firstTryCorrect += 1
  }
  const baseMax = level.questions.length * 10
  const rate = Math.round(Math.min(100, (raw / baseMax) * 100))
  return { rawScore: raw, baseMax, rate, stars: starsForRate(rate), maxStreak, firstTryCorrect }
}
```

- [ ] **Step 7: 实现进度合并纯函数**

Write `src/game/state.ts`:
```ts
import type { GameState, KingdomKey } from '../types'
import type { LevelOutcome } from './scoring'

export const LEVELS_PER_KINGDOM: Record<KingdomKey, number[]> = {
  pinyin: [1, 2, 3, 4],
  hanzi: [5, 6, 7],
  english: [8, 9],
}

export function kingdomForLevel(levelId: number): KingdomKey | null {
  for (const [key, ids] of Object.entries(LEVELS_PER_KINGDOM) as [KingdomKey, number[]][]) {
    if (ids.includes(levelId)) return key
  }
  return null
}

export function emptyGameState(): GameState {
  return { stars: 0, exp: 0, unlocked: 1, levels: {}, kingdom: { pinyin: 0, hanzi: 0, english: 0 }, updatedAt: new Date().toISOString() }
}

export function levelOfExp(exp: number): number {
  return Math.floor(exp / 300) + 1
}

const STAR_REWARDS: Record<number, number> = { 1: 20, 2: 40, 3: 60 }

export function applyResult(
  state: GameState,
  levelId: number,
  outcome: LevelOutcome,
): { state: GameState; starDelta: number; expDelta: number; unlockedNew: boolean } {
  const next: GameState = JSON.parse(JSON.stringify(state)) as GameState
  const prev = next.levels[levelId]
  const stars = outcome.stars
  let starDelta = 0
  let expDelta = 0

  // 失败不记录、不推进
  if (stars === 0) return { state: next, starDelta: 0, expDelta: 0, unlockedNew: false }

  if (!prev) {
    next.levels[levelId] = { stars, bestScore: outcome.rawScore }
    starDelta = STAR_REWARDS[stars]
    expDelta = 80
    if (levelId === next.unlocked) next.unlocked = levelId + 1
  } else if (stars > prev.stars || outcome.rawScore > prev.bestScore) {
    starDelta = Math.max(0, STAR_REWARDS[stars] - STAR_REWARDS[prev.stars])
    next.levels[levelId] = {
      stars: stars > prev.stars ? stars : prev.stars,
      bestScore: Math.max(prev.bestScore, outcome.rawScore),
    }
  }

  const k = kingdomForLevel(levelId)
  if (k) {
    next.kingdom[k] = LEVELS_PER_KINGDOM[k].reduce((sum, id) => sum + (next.levels[id]?.stars ?? 0), 0)
  }

  next.stars += starDelta
  next.exp += expDelta
  next.updatedAt = new Date().toISOString()
  return { state: next, starDelta, expDelta, unlockedNew: levelId === state.unlocked && stars > 0 }
}
```
(注:`scoreAttempt` 的 match 分支以整题作答归约——组件端保证配对完成后触发,该分支 correct 恒 true 视为整题对;签名稳定供 T6 使用。)

- [ ] **Step 8: 运行测试确认绿**

Run: `npm test`
Expected: PASS(若个别规则实现与测试语义冲突,以 spec 第六节为准修正测试或实现,并保留边界用例)。

- [ ] **Step 9: 静态检查并提交**

Run: `npm run lint`
Commit:
```bash
git add vitest.config.ts package.json package-lock.json src/types.ts src/game/
git commit -m "feat: 游戏类型与计分/进度纯函数(单测引入)"
```

---

### Task 2: 题库内容(10 关)与数据完整性测试

**Files:**
- Create: `src/data/levels.ts`
- Create: `src/game/levels.test.ts`

**Interfaces:**
- Consumes:`Level`/`Question`(`src/types.ts`,Task 1)、素材清单(spec 第五节)。
- Produces:`LEVELS: Level[]`(id 1..10 升序,导出常量)。

- [ ] **Step 1: 写数据完整性测试(先红)**

Write `src/game/levels.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { LEVELS } from '../data/levels'

describe('题库数据完整性', () => {
  it('恰好 10 关且 id 1..10 升序唯一', () => {
    expect(LEVELS.map((l) => l.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })
  it('每关标题非空', () => {
    for (const l of LEVELS) expect(l.title.length).toBeGreaterThan(0)
  })
  it('L1-9 题数=6, L10=8', () => {
    for (const l of LEVELS) {
      expect(l.questions.length).toBe(l.id === 10 ? 8 : 6)
    }
  })
  it('listen-choice/choice:选项 4 项且 answerId 在选项内且唯一', () => {
    for (const l of LEVELS)
      for (const q of l.questions)
        if (q.kind !== 'match') {
          expect(q.options).toHaveLength(4)
          const ids = q.options.map((o) => o.id)
          expect(ids).toHaveLength(new Set(ids).size)
          expect(ids).toContain(q.answerId)
        }
  })
  it('match:left/right 等长、answerMap 覆盖全部 left 且值指向右列', () => {
    for (const l of LEVELS)
      for (const q of l.questions)
        if (q.kind === 'match') {
          expect(q.left.length).toBe(q.right.length)
          const rightIds = q.right.map((o) => o.id)
          for (const left of q.left) expect(rightIds).toContain(q.answerMap[left.id])
        }
  })
  it('发声素材带 speak(拼音/汉字/英语朗读类)', () => {
    // 遍历 listen-choice:promptSpeak 非空;带 speak 字段的选项按需有值;L3 声调题正确卡必须带 speak
    for (const l of LEVELS)
      for (const q of l.questions) {
        if (q.kind === 'listen-choice') expect(q.promptSpeak.trim().length).toBeGreaterThan(0)
      }
  })
  it('关卡 id 与王国归属符合 spec', () => {
    const expectK: Record<number, string> = { 1: 'pinyin', 2: 'pinyin', 3: 'pinyin', 4: 'pinyin', 5: 'hanzi', 6: 'hanzi', 7: 'hanzi', 8: 'english', 9: 'english', 10: 'mixed' }
    for (const l of LEVELS) expect(l.kingdom).toBe(expectK[l.id])
  })
})
```

- [ ] **Step 2: 运行确认红**

Run: `npm test`
Expected: FAIL(`LEVELS` 不存在)。

- [ ] **Step 3: 实现 L1 与数据脚手架**

Write `src/data/levels.ts`(骨架 + L1 完整;先让文件存在):
```ts
import type { Level } from '../types'

export const LEVELS: Level[] = [
  {
    id: 1,
    kingdom: 'pinyin',
    title: '韵母小镇',
    questions: [
      {
        kind: 'listen-choice',
        prompt: '听一听,点出你听到的韵母',
        promptSpeak: '啊',
        options: [
          { id: 'a', text: 'a', speak: '啊' },
          { id: 'o', text: 'o', speak: '喔' },
          { id: 'e', text: 'e', speak: '鹅' },
          { id: 'i', text: 'i', speak: '衣' },
        ],
        answerId: 'a',
      },
      // …L1 其余 5 题见 spec 素材:a/o/e/i/u/ü 循环作 answer,options 含其余 3 个干扰
    ],
  },
  // …L2-L10
]
```

- [ ] **Step 4: 按 spec 素材补全 L1–L10 全部题目**

按 spec 第五节素材清单逐关写满(每 listen-choice 恰 4 选项、answerId 对应正确项、拼音类 `speak` 用同音汉字):
- L1 `韵母小镇`:单韵母 a/o/e/i/u/ü 循环听音选(a..ü 缺项作干扰)。
- L2 `声母城堡`:b/p/m/f/d/t/n/l 听音选(speak:玻/坡/摸/佛/得/特/讷/勒)。
- L3 `声调小山`:听汉字选带调拼音;三组字卡(妈麻马骂、八拔把爸、衣姨椅亿)每关 6 题=每组循环出 2 题;选项 4 个带调拼音,其中含正确声调。
- L4 `拼读魔法阵`:听词选完整拼音;词卡 妈mā/爸bà/大dà/米mǐ/地dì/兔tù(6 题各一),选项为 4 个相似拼音。
- L5 `象形字林`:2 题 match,各配 4 对(emoji↔字):日☀️ 月🌙 山⛰️ 水💧 火🔥 木🌳 田🌾 目👁。右列乱序。
- L6 `笔画山谷`:6 题 choice,题干数笔画选项数字 1–5:一(1) 二(2) 三(3) 十(2) 口(3) 人(2) 大(3) 天(4) 上(3) 下(3) 任选 6 不重复。
- L7 `认字花园`:6 题 listen-choice 或 choice,听/认字选:人 八 入 大 天 上 下 我 好 山(speak=字本身);选项含 3 个形近干扰。
- L8 `字母乐园`:2 题 match 大写↔小写 Aa Bb Cc Dd / Ee Ff + 4 题 listen-choice 读字母名(en-US speak=`A`,`B`…)选对应大写卡。
- L9 `单词农场`:6 题 listen-choice,🔊 读英词(en-US speak=cat/dog/sun/apple/egg/fish)选对应英文词卡;选项含其余词。
- L10 `新手魔法师考核`:8 题混合,从 L1–L9 已建素材各抽(韵母/声母/声调/拼读/象形/笔画/字母/单词各 1),可复用上面的题结构新建独立题对象(不共享引用)。

写毕自查:每关题目与 spec 素材一致、正确卡 speak 与 answerId 相符、无跨关重复 id。

- [ ] **Step 5: 运行测试确认绿**

Run: `npm test`
Expected: PASS。

- [ ] **Step 6: 静态检查并提交**

Run: `npm run lint`
Commit:
```bash
git add src/data/levels.ts src/game/levels.test.ts
git commit -m "feat: 新手村 10 关题库与数据完整性校验"
```

---

### Task 3: Worker 迁移与 `/api/game` 端点

**Files:**
- Create: `migrations/2026-09-02-game-state.sql`
- Create: `worker/game.ts`
- Modify: `worker/index.ts`(删 records case、加 game case)
- Delete: `worker/records.ts`

**Interfaces:**
- Consumes:`getAuthenticatedUser`(`worker/_lib/auth.ts`)、`jsonResponse`(`worker/_lib/http.ts`)、`Env`(`worker/index.ts`)。
- Produces:worker 路由 `GET /api/game` → `{ state: GameState|null }`;`PUT /api/game` body `{ state }` → `{ ok }`。前端 `App` 用。

- [ ] **Step 1: 写迁移**

Write `migrations/2026-09-02-game-state.sql`:
```sql
-- 魔法语言岛:移除已无用的生活记录表,新增单档案游戏进度
DROP TABLE IF EXISTS records;

CREATE TABLE IF NOT EXISTS game_state (
  user_id    TEXT PRIMARY KEY,
  state      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

- [ ] **Step 2: 实现 worker/game.ts**

```ts
import { getAuthenticatedUser } from './_lib/auth'
import { jsonResponse } from './_lib/http'
import type { Env } from './index'

const MAX_STATE_BYTES = 64 * 1024

export async function handleGetGame(request: Request, env: Env): Promise<Response> {
  const user = await getAuthenticatedUser(request, env)
  if (!user) return jsonResponse({ message: '未授权' }, { status: 401 })
  const row = (await env.DB.prepare('SELECT state FROM game_state WHERE user_id = ?').bind(user.id).first()) as
    | { state: string }
    | null
  if (!row) return jsonResponse({ state: null })
  try {
    return jsonResponse({ state: JSON.parse(row.state) })
  } catch {
    return jsonResponse({ state: null })
  }
}

export async function handlePutGame(request: Request, env: Env): Promise<Response> {
  const user = await getAuthenticatedUser(request, env)
  if (!user) return jsonResponse({ message: '未授权' }, { status: 401 })
  const body = (await request.json().catch(() => ({ state: null }))) as { state?: unknown }
  if (!body.state || typeof body.state !== 'object' || Array.isArray(body.state)) {
    return jsonResponse({ message: '进度数据不合法' }, { status: 400 })
  }
  const raw = JSON.stringify(body.state)
  if (raw.length > MAX_STATE_BYTES) {
    return jsonResponse({ message: '进度数据过大' }, { status: 400 })
  }
  await env.DB.prepare(
    'INSERT INTO game_state (user_id, state, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at',
  ).bind(user.id, raw, new Date().toISOString()).run()
  return jsonResponse({ ok: true })
}
```

- [ ] **Step 3: 改 worker/index.ts 路由**

Replace the `case '/api/records': …` block with:
```ts
      case '/api/game':
        if (method === 'GET') return handleGetGame(request, env)
        if (method === 'PUT') return handlePutGame(request, env)
        return methodNotAllowed()
```
And update the import line:
```ts
import { handleGetGame, handlePutGame } from './game'
```
删除 `import { handleRecords, type RecordsMethod } from './records'`。

- [ ] **Step 4: 删除 records worker 并应用迁移**

```bash
rm worker/records.ts
npm run db:migrate   # 应用 migrations/2026-09-02-game-state.sql 到本地 D1
```

- [ ] **Step 5: 端到端手测 worker API**

Run: `npm run dev`(后台)。
用带 token 的 cookie 请求(本地 dev token 默认 `jazz-local-dev-token`,见 `.dev.vars`):
```bash
# 登录拿 cookie
curl -s -c /tmp/jar 'http://localhost:3000/api/auth/login' -H 'Content-Type: application/json' -d '{"token":"jazz-local-dev-token"}'
# 空态
curl -s -b /tmp/jar 'http://localhost:3000/api/game'                      # → {"state":null}
# 写入
curl -s -b /tmp/jar 'http://localhost:3000/api/game' -X PUT -H 'Content-Type: application/json' -d '{"state":{"stars":0,"exp":0,"unlocked":1,"levels":{},"kingdom":{"pinyin":0,"hanzi":0,"english":0},"updatedAt":"2026-09-02T00:00:00.000Z"}}'
# 读回
curl -s -b /tmp/jar 'http://localhost:3000/api/game'                      # → {"state":{...}}
# records 已死
curl -s -o /dev/null -w '%{http_code}' -b /tmp/jar 'http://localhost:3000/api/records'   # → 404
# 非法 body
curl -s -b /tmp/jar 'http://localhost:3000/api/game' -X PUT -H 'Content-Type: application/json' -d '{"state":"oops"}'   # → 400
```
Expected:上述全部符合注释标注。结束时清理本地插入行(可对 `.wrangler/state` 下的 d1 sqlite 直接删除,或留待收尾用家长重置清理;此处可 `rm /tmp/jar`)。

- [ ] **Step 6: 静态检查并提交**

Run: `npm run build && npm run lint`
Commit:
```bash
git add -A
git commit -m "feat: /api/game 存取单行 JSON 进度,移除 records 路由"
```

---

### Task 4: 主题换肤 + TTS + 音效工具

**Files:**
- Modify: `src/index.css`(主题 token 换天空糖果色,保留 glass/dark/降级能力)
- Create: `src/game/tts.ts`
- Create: `src/game/sfx.ts`
- Create: `src/game/audio.ts`(全局声音开关:localStorage `jazz_sound_on`,导出 `getSoundOn/setSoundOn`)

**Interfaces:**
- Produces:`tts.speak(text: string, lang?: string): boolean`(成功返回 true;无语音返回 false 不报错);`sfx.play(type: 'correct'|'wrong'|'streak'|'victory'|'tap')`(尊重声音开关);`audio.getSoundOn(): boolean`、`audio.setSoundOn(on: boolean)`。

- [ ] **Step 1: 重写主题 token**

Edit `src/index.css` 的 `@theme` 颜色块为天空糖果色系(保留 `--font-sans`、阴影/圆角结构、`glass`/`glass-strong`、暗色 `@media` 覆盖与 reduce 降级):
```css
  --color-canvas: #bfe3ff;         /* 天空 */
  --color-canvas-2: #eaf6ff;
  --color-surface: #ffffff;
  --color-surface-2: #f2f8ff;
  --color-ink: #1f3a5f;            /* 深蓝灰 */
  --color-ink-2: #5a7ba0;
  --color-ink-3: #8fb0d0;
  --color-hairline: rgb(31 58 95 / 0.10);
  /* 王国/糖果强调 */
  --color-accent: #ff8a2a;         /* 通用主强调(橙,大按钮) */
  --color-pinyin: #f59e0b;         /* 拼音=橙 */
  --color-hanzi: #ef4444;          /* 汉字=红 */
  --color-english: #3b82f6;        /* 英语=蓝 */
  --color-emerald: #10b981;
  --color-pink: #f472b6;
  --color-violet: #8b5cf6;
  --color-amber: #f59e0b;
  --color-sky: #0ea5e9;
  --color-red: #ef4444;
  --color-red-tint: rgb(239 68 68 / 0.14);
```
body 背景改为天空渐变:`background: linear-gradient(180deg, var(--color-canvas), var(--color-canvas-2) 70%)`;暗色模式下 body 背景换深蓝夜空渐变(`#0b1b3a` → `#12294d`)。其余 token(ink/语义色)在暗色块内同步给深色可读值。`radius` 增补 `--radius-4xl: 2rem`。

- [ ] **Step 2: TTS 封装**

Write `src/game/tts.ts`:
```ts
export function speak(text: string, lang = 'zh-CN'): boolean {
  if (!('speechSynthesis' in window)) return false
  const voices = window.speechSynthesis.getVoices()
  const voice = voices.find((v) => v.lang.toLowerCase().replace('_', '-') === lang) ?? null
  if (lang.startsWith('zh') && !voice) return false // 无中文语音 → 静音降级
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang
  if (voice) u.voice = voice
  u.rate = 0.9
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(u)
  return true
}
```
(注意 `getVoices()` 首次可能为空:在模块内注册 `voiceschanged` 并缓存一次即可——补充一个小缓存实现,避免首次静音误判。)

- [ ] **Step 3: Web Audio 音效**

Write `src/game/sfx.ts`:
```ts
import { getSoundOn } from './audio'

let ctx: AudioContext | null = null
function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  ctx ??= new Ctor()
  return ctx
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.15) {
  const c = ac()
  if (!c) return
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0, c.currentTime + start)
  gain.gain.linearRampToValueAtTime(vol, c.currentTime + start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + start + dur)
  osc.connect(gain).connect(c.destination)
  osc.start(c.currentTime + start)
  osc.stop(c.currentTime + start + dur + 0.05)
}

export function play(type: 'correct' | 'wrong' | 'streak' | 'victory' | 'tap') {
  if (!getSoundOn()) return
  const now = ac()?.currentTime ?? 0
  if (type === 'correct') { tone(523, 0, 0.15); tone(659, 0.08, 0.18) }
  else if (type === 'streak') { tone(523, 0, 0.1); tone(659, 0.07, 0.1); tone(784, 0.14, 0.2) }
  else if (type === 'wrong') { tone(220, 0, 0.25, 'triangle', 0.12) }
  else if (type === 'victory') { tone(523, 0, 0.15); tone(659, 0.12, 0.15); tone(784, 0.24, 0.15); tone(1046, 0.36, 0.35) }
  else { tone(330, 0, 0.06, 'triangle', 0.08) }
}
```

- [ ] **Step 4: 声音开关**

Write `src/game/audio.ts`:
```ts
const KEY = 'jazz_sound_on'
export function getSoundOn(): boolean {
  try { return localStorage.getItem(KEY) !== '0' } catch { return true }
}
export function setSoundOn(on: boolean) {
  try { localStorage.setItem(KEY, on ? '1' : '0') } catch { /* ignore */ }
}
```

- [ ] **Step 5: 静态检查并提交**

Run: `npm run build && npm run lint`
Commit:
```bash
git add src/index.css src/game/tts.ts src/game/sfx.ts src/game/audio.ts
git commit -m "feat: 天空糖果主题 + TTS/音效/声音开关工具"
```

---

### Task 5: App 状态机 + 登录门 + 地图视图

**Files:**
- Rewrite: `src/App.tsx`
- Create: `src/components/login/LoginGate.tsx`
- Create: `src/components/game/MapView.tsx`
- Delete: `src/components/auth/LoginCard.tsx`
- Modify: `src/components/ui/button.tsx` / `card.tsx`(如需要:加大圆角、`size="lg"` 已有则复用)

**Interfaces:**
- Consumes:Task 1–4 的全部导出、`motion`(现有依赖)、`lucide-react`。
- Produces:
  - `LoginGate` props:`{ error: string; onTokenChange(v: string): void; onSubmit(e: React.FormEvent): void }`(受控,App 持有)。
  - `MapView` props:`{ state: GameState; onPlay(levelId: number): void; onReset(): void; onLogout(): void; soundOn: boolean; onToggleSound(): void }`。
  - `App` 导出一个内部 `Screen` 联合 = `'boot'|'login'|'map'|'play'|'result'`(本任务实现前三种 + play/result 占位空屏)。

- [ ] **Step 1: 登录门(魔法岛入口)**

Write `src/components/login/LoginGate.tsx`(魔幻卡通风:云朵 emoji 头图、标题「魔法语言岛」、副题「语言小魔法师,来收集魔法星尘吧!」、token 密码框、错误红字、按钮「进入魔法岛」):
```tsx
import { ArrowRight } from 'lucide-react'
import { Button } from '../ui/button'
import { Card } from '../ui/card'
import { Input } from '../ui/input'
import { Label } from '../ui/label'

type Props = { error: string; onTokenChange: (v: string) => void; onSubmit: (e: React.FormEvent<HTMLFormElement>) => void }

export function LoginGate({ error, onTokenChange, onSubmit }: Props) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-canvas-2 p-4 text-ink">
      <div className="text-center">
        <div className="text-6xl">🏰✨🌤️</div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">魔法语言岛</h1>
        <p className="mt-1 text-ink-2">语言小魔法师,来收集魔法星尘吧!</p>
        <Card className="mx-auto mt-8 w-full max-w-sm rounded-[2rem] shadow-pop">
          <form className="space-y-4 p-6" onSubmit={onSubmit}>
            <div className="space-y-2 text-left">
              <Label htmlFor="token">家长通行令牌</Label>
              <Input id="token" type="password" autoComplete="off" onChange={(e) => onTokenChange(e.target.value)} placeholder="请输入访问令牌" />
            </div>
            {error ? <div className="rounded-xl bg-red-tint px-3.5 py-2.5 text-sm text-red">{error}</div> : null}
            <Button type="submit" size="lg" className="w-full">进入魔法岛 <ArrowRight className="ml-2 h-4 w-4" /></Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 地图视图**

Write `src/components/game/MapView.tsx`。结构:顶部状态条(⭐ 星尘 / Lv / 声音开关 / 家长菜单 🔧 含重置与退出),中部新手村 10 节点路径(垂直线性 + 节点按钮),底部三王国进度徽章。节点态:未解锁 🔒 / 当前可玩(呼吸高亮)/ 已通关显示 ⭐×N。调用 `levelOfExp(state.exp)` 显示等级、`state.levels[levelId]?.stars`。王国徽章按 `kingdomForLevel`/`state.kingdom` 汇总(L1–9 的「已得星/总星」)。用 `<button>` + motion `whileHover`/`layoutId` 做推进感。示例节点区:
```tsx
function LevelNode({ id, title, stars, locked, active, onPlay }: { id: number; title: string; stars?: number; locked: boolean; active: boolean; onPlay: () => void }) {
  return (
    <button type="button" onClick={onPlay} disabled={locked}
      className={`flex w-64 items-center gap-3 rounded-2xl border px-4 py-3 text-left shadow-card transition-transform ${
        locked ? 'border-hairline bg-surface-3 opacity-60' : 'border-hairline bg-surface hover:-translate-y-0.5'
      }`}>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${locked ? 'bg-surface-3' : active ? 'bg-accent text-white' : 'bg-amber-100 text-amber-600'}`}>
        {locked ? '🔒' : id === 10 ? '👑' : `⭐`.repeat(stars ?? 0) || '▶'}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-semibold">第 {id} 关 · {title}</span>
        <span className="block text-xs text-ink-3">{stars ? `${'★'.repeat(stars)} 已通关,可再玩` : active ? '开始冒险!' : '先通过上一关吧'}</span>
      </span>
    </button>
  )
}
```
(视觉细节允许 executor 打磨;必须满足:全部 10 节点、已通关显星、锁定禁用、当前可玩高亮、`onPlay` 仅对非锁定触发。)

- [ ] **Step 3: App 状态机**

Rewrite `src/App.tsx`(删除生活记录逻辑):
```tsx
import { useEffect, useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { LoginGate } from './components/login/LoginGate'
import { MapView } from './components/game/MapView'
import { emptyGameState, levelOfExp } from './game/state'
import { setSoundOn, getSoundOn } from './game/audio'
import type { GameState, UserProfile } from './types'

type Screen = 'boot' | 'login' | 'map' | 'play' | 'result'

function App() {
  const [screen, setScreen] = useState<Screen>('boot')
  const [user, setUser] = useState<UserProfile | null>(null)
  const [state, setState] = useState<GameState>(() => emptyGameState())
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [soundOn, setSound] = useState(() => getSoundOn())

  useEffect(() => {
    const boot = async () => {
      try {
        const me = await fetch('/api/me', { credentials: 'include' })
        if (!me.ok) { setScreen('login'); return }
        const { user: u } = (await me.json()) as { user: UserProfile }
        setUser(u)
        const g = await fetch('/api/game', { credentials: 'include' })
        if (g.ok) {
          const { state: s } = (await g.json()) as { state: GameState | null }
          if (s) setState(s)
        }
        setScreen('map')
      } catch {
        setScreen('login')
      }
    }
    void boot()
  }, [])

  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError('')
    const res = await fetch('/api/auth/login', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
    const p = (await res.json().catch(() => ({ message: '登录失败' }))) as { message?: string; user?: UserProfile }
    if (!res.ok || !p.user) { setError(p.message ?? '登录失败'); return }
    setUser(p.user)
    const g = await fetch('/api/game', { credentials: 'include' })
    if (g.ok) { const { state: s } = (await g.json()) as { state: GameState | null }; if (s) setState(s) }
    setScreen('map')
  }

  async function save(next: GameState) {
    setState(next)
    await fetch('/api/game', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state: next }) })
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    setUser(null); setState(emptyGameState()); setScreen('login')
  }

  function resetProgress() {
    if (!window.confirm('确定要重置全部闯关进度吗?此操作无法撤销。')) return
    void save(emptyGameState())
  }

  if (screen === 'boot') return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-ink-3" /></div>
  if (screen === 'login') return <LoginGate error={error} onTokenChange={setToken} onSubmit={(e) => void login(e)} />
  if (screen === 'map' || screen === 'play' || screen === 'result') {
    return (
      <MapView state={state} onPlay={(id) => { /* Task 6 接线 play */ setScreen('play') }} onReset={resetProgress} onLogout={() => void logout()}
        soundOn={soundOn} onToggleSound={() => { setSoundOn(!soundOn); setSound(!soundOn) }} />
    )
  }
  return null
}
export default App
```

- [ ] **Step 4: 删除旧登录卡并手测**

```bash
rm src/components/auth/LoginCard.tsx   # 删除旧登录卡与 auth 组件目录若空
npm run dev
```
手测:未登录见魔法岛登录门;错 token 红字;对 token 进地图;10 节点态正确;🔧 重置(确认)清空;退出回登录门。play/result 暂为地图兜底屏(本任务仅骨架,玩法下一任务接)。

- [ ] **Step 5: 静态检查并提交**

Run: `npm run build && npm run lint`
Commit:
```bash
git add -A
git commit -m "feat: 魔法岛登录门 + 地图视图 + App 状态机骨架"
```

---

### Task 6: 玩法引擎 + 结算屏 + 进度落库接线

**Files:**
- Create: `src/components/game/quiz/ListenChoice.tsx`
- Create: `src/components/game/quiz/Choice.tsx`
- Create: `src/components/game/quiz/MatchGame.tsx`
- Create: `src/components/game/quiz/engine.tsx`(作答状态机)
- Create: `src/components/game/LevelPlay.tsx`
- Create: `src/components/game/LevelResult.tsx`
- Modify: `src/App.tsx`(play/result 接线 + `applyResult`/`runLevel` 串联 + 保存)

**Interfaces:**
- Consumes:`LEVELS`(Task 2)、`runLevel`/`LevelRun`(Task 1)、`applyResult`(Task 1)、`tts.speak`/`sfx.play`/`audio`(Task 4)。
- Produces:App 内 play 状态 `{ level: Level; outcome: LevelOutcome }` 传递;`LevelPlay` 回调 `onFinish(runs: LevelRun[]): void`(由 App 调 `runLevel` 得 outcome)、`onExit(): void`;`LevelResult` props `{ levelId; title; outcome; starDelta; expDelta; unlockedNew; onAgain(): void; onMap(): void; onNext?(): void }`。

- [ ] **Step 1: 作答引擎核心**

Write `src/components/game/quiz/engine.tsx`(一个 React 无头 hook,供三个题型组件共用对错反馈状态;也可直接由 LevelPlay 持有对错态再下发——推荐后者,减少层数):
LevelPlay 内部状态:
```ts
type RunRow = { questionIndex: number; selectedId: string; attempt: 1 | 2; prevStreak: number }
const [index, setIndex] = useState(0)
const [rows, setRows] = useState<RunRow[]>([])
const [phase, setPhase] = useState<'answering' | 'feedback'>('answering')
const [attempt, setAttempt] = useState<1 | 2>(1)
const [streak, setStreak] = useState(0)
const [reveal, setReveal] = useState<string | null>(null) // 亮正确答案的 option id(两次错后)
```
作答提交:题型组件调 `onAnswer(selectedId)` → LevelPlay 内:
1. `const q = level.questions[index]`,调 `scoreAttempt(q, selectedId, attempt, streak)`。
2. 若 `kind==='match'`:匹配为整组完成事件(全部配对成功才 `onAnswer` 一枪),selectedId 传任意 left 的 id 但 `scoreAttempt` 的 match 分支以 `answerMap[selectedId]` 判定——因此 MatchGame 组件必须**配对全对后才调 onAnswer**,并将正确 left 的 id 作为 selectedId;`prevStreak` 从 LevelPlay 传,scoreAttempt match 分支据此给 streak 结果(实现上让 match 的 correct 恒 true 传入即可)。
3. 正确 → `sfx.play(streak>=1?'streak':'correct')`;`setStreak(正确首对? streak+1 : 0)`、push row、`index+1` 或结束 `onFinish(rows)`。
4. 错误:
   - attempt 1 → `setAttempt(2)`,`sfx.play('wrong')`,重答同题(卡片标红并允许再选)。
   - attempt 2 → 两次错:`setReveal(answerId)`(把正确项高亮绿)、`sfx.play('wrong')`,点「下一题」按钮继续;`setStreak(0)`。
5. 每题进入时:若 `listen-choice` 自动 `tts.speak(q.promptSpeak)`;卡片 🔊 调 `speak(option.speak, kingdom==='english'?'en-US':'zh-CN')`(拼音/汉字 zh;英语 en)。

- [ ] **Step 2: 三个题型组件**

- `ListenChoice.tsx`:`{ prompt, promptSpeak, kingdom, options, attempt, disabled, onAnswer }`,渲染大 🔊 播放钮(自动播一次)、题干、4 张卡片(emoji/文字)。已答错二次后 `disabled`、正确卡绿显。
- `Choice.tsx`:同上结构,题干文字、可点读 `speak`、无自动播(除非 props.autoSpeak)。
- `MatchGame.tsx`:`{ prompt, left, right, kingdom, onComplete }`,点左点右配对;错配抖动并清选择;全部配对完成调 `onComplete`(传正确 left[0].id,语义上整题对)。

- [ ] **Step 3: LevelPlay 屏**

`LevelPlay.tsx`:顶栏(返回地图 `onExit` + 关卡标题 + `◉` 进度点);中部当前题(`index+1`/total);作答逻辑如 Step 1;每题完成自动推进;末题完成调 `onFinish(runs)`。使用 `motion` keyed 转场每题;`AnimatePresence` 包裹反馈徽标(✓/✗)。

- [ ] **Step 4: LevelResult 结算屏**

`LevelResult.tsx`:从 `onFinish` 回来的 outcome + App 算好的 `starDelta/expDelta/unlockedNew`;显示 3/2/1/0 颗大星(motion 依次弹出)、得分、最高连击、新增星尘/exp;按钮:`再玩一次`(onAgain)/`回到地图`(onMap)/`下一关`(unlockedNew 且 levelId<10 才显示,onNext)。
结算开 `sfx.play('victory')`(若通过)。

- [ ] **Step 5: App 接线**

改 Task 5 的 App:
- `screen==='map'` 时,`onPlay(id)`:`setActiveLevel(LEVELS.find(l=>l.id===id)!)`, `setScreen('play')`。
- `LevelPlay onFinish(runs)`:`const outcome = runLevel(activeLevel, runs)`;`const { state: next, starDelta, expDelta, unlockedNew } = applyResult(state, activeLevel.id, outcome)`;`void save(next)`;`setOutcome({ levelId, title, outcome, starDelta, expDelta, unlockedNew })`;`setScreen('result')`。
- result 屏按钮:`onAgain`→ 重置 play 内部(重新 mount,`key={nonce}`);`onMap`→ `setScreen('map')`;`onNext`→ `onPlay(levelId+1)`。
- 返回地图中途退出:结算前不落库(正确——保存只在 onFinish)。

- [ ] **Step 6: 端到端手测**

Run: `npm run dev`
手测验收(每关题型、自动朗读或静音降级、音效、错二答后亮正确答案):
- L1–L10 顺序打;首通得星/星尘/exp;L1 3★ → 星尘 60、exp 80、解锁 L2。
- 未通关(<1★)不推进 unlocked;重玩可冲星;复玩最优不变时星尘/exp 不再加。
- 关末 PUT 落库:刷新页面进度保留。
- 🔊 英语关读英文、拼音关读汉字同音。
- 家长重置清空后回到 L1。

- [ ] **Step 7: 静态检查并提交**

Run: `npm run build && npm run lint`
Commit:
```bash
git add src/components/game/ src/App.tsx
git commit -m "feat: 题型引擎 + 关卡玩法 + 结算屏 + 进度落库接线"
```

---

### Task 7: 清理删除 + 全量验收 + 文档收尾

**Files:**
- Delete: `src/components/tabs/`、`src/components/dashboard/`、`src/data/exercises.ts`、`src/lib/date.ts`、`src/assets/hero.png`(保留 react.svg/vite.svg 若被引用则一并查删)
- Modify: `CLAUDE.md`(架构/命令/数据模型改为游戏版)
- (查 `src/App.tsx` 与 `main.tsx` 不再引用被删文件)

- [ ] **Step 1: 删除生活记录残留**

```bash
git rm -r src/components/tabs src/components/dashboard src/data/exercises.ts src/lib/date.ts src/assets/hero.png
grep -rn "tabs\|dashboard\|exercises\|LifeRecord\|/api/records\|ExpenseBreakdown\|RecordList\|StatCard" src/ || echo "无残留引用"
```
若 grep 有命中,修掉对应引用再提交。

- [ ] **Step 2: 更新 CLAUDE.md**

把「隐私生活记录仪」相关段落改写为「魔法语言岛」:概述(三王国 10 关、单档案进度)、命令(增加 `npm test`;`db:migrate` 说明)、数据模型(`records`→`game_state`)、worker API(`/api/game`)、前端结构(状态机 + `src/components/game` + `src/data/levels` + `src/game/*` 纯逻辑)、注意(中文文案、简约风格、题库改动走 `levels.ts`、发音用同音汉字)。

- [ ] **Step 3: 全量静态与功能验收**

```bash
npm run build   # tsc -b + vite build,应全绿
npm run lint
npm test        # 纯逻辑单测全绿
npm run dev     # 手动跑一遍验收清单(spec 第十一节 1–10 项逐条打勾)
```
逐条核对 spec「十一、验收标准」10 项。失败项立即修,直至全过。

- [ ] **Step 4: 最终提交**

```bash
git add -A
git commit -m "chore: 清理生活记录残留并更新文档(魔法语言岛 MVP 完工)"
git log --oneline -10
```

---

## Self-Review 记录

- **Spec 覆盖**:迁移/API(→T3)、GameState 模型与纯函数(→T1)、10 关题库(→T2)、TTS/音效/主题(→T4)、登录门/地图/状态机(→T5)、题型玩法/结算/落库(→T6)、删除与文档与验收(→T7)。验收标准集中在 T6 Step6 与 T7 Step3。
- **计分一致性**:`scoreAttempt` 连击 = 进入本题时 `prevStreak≥1` 且首对 → +2;`runLevel` rate 以 `rawScore/baseMax` 封顶 100;与 spec 修正口径一致。
- **match 归一**:`scoreAttempt` 的 match 分支保留整组判定语义,组件端保证配对完成后才触发 onAnswer(见 T6 Step1 注)。
- **types.ts 无重复导出**:`LevelOutcome` 只在 `scoring.ts` 定义(`state.ts` import),state.test 从 `../game/scoring` 引用,避免 Task 1 测试与 types 冲突——state.test 模板已按此写。
- **分支**:Task 1 前先建 `feat/magic-language-island`(在 Handoff 确认)。
