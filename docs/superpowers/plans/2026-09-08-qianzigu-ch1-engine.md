# 千字谷 ch1 · P3 章节引擎 + ch1 内容数据实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建 `src/features/qianzigu/` 的**纯逻辑层**:章节场景数据模型 + ch1 完整内容数据 + 场景状态机引擎(reducer,可注入 rng,纯函数可测)。引擎只管「流程推进/条件跳转/断点/BOSS/社交后果」并产出效果,不判分、不碰 UI。

**Architecture:** `qianzigu` 为纯逻辑 feature,只引 shared(含 P2 的 `SpeechRole`);需要外部能力的用依赖注入(出题/进度写入交给 UI 层,P5 组装)。核心三个纯模块:
- `chapter.ts` — 场景类型模型(`ChapterScene`/`ChapterLine`/`SceneOption`/`SceneKind`/`SceneFlow`)。
- `ch1.ts` — ch1 内容数据:5 词有序 + 每词任务 + 场景元素 + 全部 scene 序列(台文本取自 spec 源 idea `docs/ideas/260908-01-001.md`)。
- `engine.ts` — `createChapterRunner(chapter)` 返回纯状态机:`{ state, start(), next(action) }`,产出 effects 数组(restore element / mark word layer / set settle stats)。

**Tech Stack:** TypeScript + vitest(纯函数,无 DOM)。

**Spec:** `docs/superpowers/specs/2026-09-08-qianzigu-ch1-design.md` §3.2(数据模型)/§3.3(引擎+场景两态)/§3.5(进度映射);内容台本源头 = `docs/ideas/260908-01-001.md` §4。executor 读 spec + 本 plan。

## Global Constraints

- qianzigu 只引 shared,不 import 任何 feature(`architecture.test.ts` 铁律)。
- `SpeechRole` 来自 shared/services/speech(P2 已完成)。
- 引擎是纯 reducer:给定 state+action 返新 state+effects,无副作用、无 setTimeout;rng 可注入。
- ch1 词集(顺序)= `[1, 101, 102, 103, 3]` = 太阳 / 升起 / 亮 / 早上好 / 星星(id 对应 P1 补词 + 复用词)。
- 每词两层恢复:声音=pinyin 技能、形状=hanzi 技能。效果 `markWord(id, layer)` 由 UI 落地为 `completed.*` 写库(幂等,见 spec §3.5)。
- ch1 台本文案:以 idea 文档 §4.1-4.10 为准,数据文件内逐条转写;此 plan 给结构与关键句,台词完整转写在实现步骤中从 idea 文件逐条照录(不臆造)。

---

### Task 1: 场景数据模型(chapter.ts)

**Files:**
- Create: `src/features/qianzigu/chapter.ts`
- Test: `src/features/qianzigu/chapter.test.ts`

**Interfaces:**
- Consumes: `SpeechRole`(shared/services/speech)。
- Produces(后续任务依赖的精确类型):

```ts
import type { SpeechRole } from '@/shared/services'

export type SceneKind = 'dialogue' | 'task' | 'social' | 'break' | 'boss' | 'ending' | 'settle'
export type WordLayer = 'sound' | 'shape'          // sound=拼音恢复,shape=汉字恢复

export type ChapterLine = Readonly<{ role: SpeechRole; text: string }>

export type SceneOption = Readonly<{
  id: string
  text: string                       // 选项文案(朗读文本即 text)
  emoji?: string
  consequence: 'good' | 'bad' | 'neutral'
  response: string                   // 选择后月亮/灵灵的回应台词
}>

export type TaskSpec = Readonly<{
  wordId: number
  layer: WordLayer                   // 该任务恢复哪一层
  minCorrect: number                 // 需答对次数才算恢复(默认 1,可留)
}>

export type TaskScene = Readonly<{
  id: string
  kind: 'task'
  title: string                      // 任务名(如 拯救太阳)
  intro: ChapterLine[]
  task: TaskSpec
  onDone: ChapterLine[]              // 恢复成功后的台词
}>

export type DialogueScene = Readonly<{
  id: string
  kind: 'dialogue'
  lines: ChapterLine[]
  choices?: never
}>

export type SocialScene = Readonly<{
  id: string
  kind: 'social'
  lines: ChapterLine[]               // 情境引入(含 月亮 哭诉)
  options: SceneOption[]
  goodOptionId: string               // 正向后果选项(命中则 good 后果推进)
  loop: ChapterLine[]                // 非 good 选择后 灵灵 引导词(重新弹选项)
  onGood: ChapterLine[]              // 选中 good 的收尾台词
}>

export type BreakScene = Readonly<{ id: string; kind: 'break' }>

export type BossScene = Readonly<{
  id: string
  kind: 'boss'
  intro: ChapterLine[]
  maxWrong: number                   // 失败阈值(默认 3)
  win: ChapterLine[]
  lose: ChapterLine[]
}>

export type EndingScene = Readonly<{ id: string; kind: 'ending'; lines: ChapterLine[] }>
export type SettleScene = Readonly<{ id: string; kind: 'settle'; summary: ChapterLine[] }>

export type Scene =
  | TaskScene | DialogueScene | SocialScene | BreakScene | BossScene | EndingScene | SettleScene

export type Chapter = Readonly<{
  id: number
  title: string
  subtitle: string
  emoji: string
  wordIds: readonly number[]          // 有序 5 词
  restoreOrder: readonly number[]     // 恢复点亮顺序的 wordId(可含重复元素,如太阳)
  scenes: readonly Scene[]
}>
```

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from 'vitest'
import type { Scene, SceneKind } from './chapter'

describe('chapter 数据模型', () => {
  it('SceneKind 七值合法', () => {
    const kinds: SceneKind[] = ['dialogue', 'task', 'social', 'break', 'boss', 'ending', 'settle']
    expect(kinds).toHaveLength(7)
  })
  it('Scene 联合可承载 Dialogue 与 Task 两种形态', () => {
    const d: Scene = { id: 'open', kind: 'dialogue', lines: [] }
    const t: Scene = {
      id: 't1', kind: 'task', title: 'x', intro: [], onDone: [],
      task: { wordId: 1, layer: 'sound', minCorrect: 1 },
    }
    expect(d.kind).toBe('dialogue')
    expect(t.kind).toBe('task')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/qianzigu/chapter.test.ts`
Expected: FAIL(模块不存在)。

- [ ] **Step 3: 按上文 Interfaces 代码块建 `chapter.ts`**

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/features/qianzigu/chapter.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/features/qianzigu/chapter.ts src/features/qianzigu/chapter.test.ts
git commit -m "feat(qianzigu): 章节场景数据模型 chapter.ts"
```

---

### Task 2: ch1 内容数据(ch1.ts)

**Files:**
- Create: `src/features/qianzigu/ch1.ts`
- Test: `src/features/qianzigu/ch1.test.ts`

**Interfaces:**
- Consumes: `Chapter`/`Scene`(Task 1)。
- Produces: `export const CHAPTER_1: Chapter`,字段:
  - `id: 1`, `title: '太阳的求救'`, `subtitle: '天空区·第一束光'`, `emoji: '🌅'`(与词 103 同构,示意「天光」)。
  - `wordIds: [1, 101, 102, 103, 3]`
  - `restoreOrder: [1, 1, 101, 101, 102, 102, 103, 103, 3, 3]`(每词 sound+shape 各点亮一次;太阳在开场先声音恢复)
  - `scenes`:按 spec 源 idea §4 逐条转写 —— 开场(dialogue)→ 任务1-5(task,每词两层可并为一个 scene 逐层推进或拆 scene,随实现;至少每个词一个 task scene 覆盖 sound 与 shape)→ 断点(break)×3 → 社交(social,月亮安慰)→ 任务推进 → BOSS(boss,静默)→ 结局(ending)→ 结算(settle)。台本逐行照录 idea §4.1-4.10 的 🦊/☀️/🌙/🖤 台词(role 分别 lingling/sun/moon/jingmo;居民旁白 villager/narrator)。

- [ ] **Step 1: 写失败测试(结构性契约)**

```ts
import { describe, expect, it } from 'vitest'
import { CHAPTER_1 } from './ch1'

describe('ch1 数据完整性', () => {
  it('5 词有序且与 P1 词库 story/复用词对齐', () => {
    expect(CHAPTER_1.wordIds).toEqual([1, 101, 102, 103, 3])
  })
  it('每个词都至少一个 task scene 覆盖 sound 与 shape', () => {
    const tasks = CHAPTER_1.scenes.filter((s): s is Extract<typeof s, { kind: 'task' }> => s.kind === 'task')
    for (const wid of CHAPTER_1.wordIds) {
      const covered = new Set(tasks.filter((t) => t.task.wordId === wid).map((t) => t.task.layer))
      expect(covered.has('sound'), `词 ${wid} 缺 sound`).toBe(true)
      expect(covered.has('shape'), `词 ${wid} 缺 shape`).toBe(true)
    }
  })
  it('含 开场/social/boss/ending/settle/break 节点', () => {
    const kinds = new Set(CHAPTER_1.scenes.map((s) => s.kind))
    for (const k of ['dialogue', 'social', 'boss', 'ending', 'settle', 'break']) {
      expect(kinds.has(k as never), `缺 ${k}`).toBe(true)
    }
  })
  it('台本行 role 合法(限 SpeechRole 六值)', () => {
    const allowed = new Set(['lingling', 'sun', 'moon', 'jingmo', 'narrator', 'villager'])
    const roles = CHAPTER_1.scenes.flatMap((s) =>
      'lines' in s ? s.lines.map((l) => l.role) : s.kind === 'task' ? [...s.intro, ...s.onDone].map((l) => l.role) : s.kind === 'social' ? [...s.lines, ...s.loop, ...s.onGood].map((l) => l.role) : s.kind === 'boss' ? [...s.intro, ...s.win, ...s.lose].map((l) => l.role) : [],
    )
    for (const r of roles) expect(allowed.has(r), `非法 role ${String(r)}`).toBe(true)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/qianzigu/ch1.test.ts`
Expected: FAIL(模块不存在)。

- [ ] **Step 3: 转写 ch1.ts**

打开 `docs/ideas/260908-01-001.md`,按其 §4.1 开场、§4.2 任务1(太阳,听音引子→创作锚定占位→拼音/汉字双层)、§4.3 任务2(升起)、§4.4 社交事件(安慰月亮,后果式)、§4.5 任务3(亮)、§4.6 任务4(早上好)、§4.7 任务5(星星综合)、§4.8 BOSS 战、§4.9 结局、§4.10 结算+悬念,**逐条台词照录进对应 scene**(role 映射见下表);§3 场景视觉/音效不在本 plan(UI 属 P5),仅把「场景元素恢复顺序」落到 `restoreOrder`。断点按 idea 文档「【自然断点】」位置插入 3 个 `break` scene。

role 映射:🦊 灵灵→`lingling`;☀️ 太阳→`sun`;🌙 月亮→`moon`;🖤 静默→`jingmo`;🐰 居民/旁白→`villager`;无角色叙述句→`narrator`。选项结构照 §5.1 `SocialOption`(text/emoji/consequence/response)→ `SceneOption`(good/bad/neutral 由 `consequence` 标)。

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/features/qianzigu/ch1.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/features/qianzigu/ch1.ts src/features/qianzigu/ch1.test.ts
git commit -m "feat(qianzigu): ch1 内容数据(5词任务/社交/BOSS/结局/结算)"
```

---

### Task 3: 章节引擎(engine.ts)

**Files:**
- Create: `src/features/qianzigu/engine.ts`
- Test: `src/features/qianzigu/engine.test.ts`

**Interfaces:**
- Consumes: `Chapter`/`Scene`(Task 1)、`CHAPTER_1`(Task 2)。
- Produces:

```ts
import type { Chapter, Scene, WordLayer } from './chapter'

export type RunnerEffect =
  | { type: 'restore'; wordId: number; layer: WordLayer }      // UI 落 completed.pinyin/hanzi
  | { type: 'mark-boss-failed' }
  | { type: 'settle' }                                          // 结算节点:UI 汇总星尘/连击/成就

export type RunnerState = Readonly<{
  sceneIndex: number
  taskHits: Record<number, number>      // wordId -> 已答对次数(task scene 推进)
  restored: ReadonlyArray<{ wordId: number; layer: WordLayer }>
  bossWrong: number
  bossWon: boolean
  socialDone: boolean
  finished: boolean
}>

export type RunnerAction =
  | { type: 'advance' }                // dialogue/break 确认继续
  | { type: 'task-correct'; wordId: number; layer: WordLayer }
  | { type: 'task-wrong'; wordId: number; layer: WordLayer }
  | { type: 'social-choose'; optionId: string }
  | { type: 'boss-correct' }
  | { type: 'boss-wrong' }

export type Runner = {
  state: RunnerState
  start(): RunnerState
  next(action: RunnerAction): { state: RunnerState; effects: RunnerEffect[] }
}

export function createChapterRunner(chapter: Chapter): Runner
```

**运行规则(实现依此):**
1. 引擎逐 scene 推进;`sceneIndex` 指向当前 scene。
2. `task` scene:`task-correct` 累计 `taskHits[wordId]`,≥ `task.minCorrect` 则该词该层「恢复」:写 `restored`,发 `{restore}` effect,sceneIndex+1。`task-wrong` 只计失败(由 UI 决定是否重试/降难,引擎不重试逻辑;连错不计入恢复)。
3. `social` scene:`social-choose`;选 `goodOptionId` → 发(无 effect)并推进 + 标 `socialDone=true`;选非 good → **sceneIndex 不动**(重弹选项),仅把选项后果交给 UI 朗读(UI 播 `option.response` 后回到同一 scene)。
4. `boss` scene:`boss-correct` 累计通过;`boss-wrong` 使 `bossWrong++`;`bossWrong >= maxWrong` → 引擎置 `bossWon=false` 并**跳过后续走向结束**(finished=true,发 `mark-boss-failed`);累计答对 ≥ 题目数(由调用方判定,见 3.3 注)则 `bossWon=true` 推进。
5. `break` scene:`advance` 即过(UI 弹「继续/明天再来」)。
6. 触 `settle` scene:发 `settle` effect,`finished=true`。
7. scene 越界/无 next 的结束由 UI 处理(`state.finished`)。

> 注(与 spec §3.3 对齐):BOSS 具体题目数由 UI 依据题目生成决定;引擎只收 correct/wrong 信号与失败阈值,不自行出题。社交事件不强制答对,始终可推进到 good。

- [ ] **Step 1: 写失败测试(核心流转)**

```ts
import { describe, expect, it } from 'vitest'
import { createChapterRunner } from './engine'
import { CHAPTER_1 } from './ch1'

describe('createChapterRunner', () => {
  it('advance 逐节点推进到第一个 task', () => {
    const r = createChapterRunner(CHAPTER_1)
    const s0 = r.start()
    expect(s0.sceneIndex).toBe(0)
    // 开场 dialogue → advance 到 task
    let s = s0
    for (let i = 0; i < 5 && !s.finished; i++) {
      const scene = CHAPTER_1.scenes[s.sceneIndex]
      if (scene.kind === 'task') break
      s = r.next({ type: 'advance' }).state
    }
    expect(CHAPTER_1.scenes[s.sceneIndex].kind).toBe('task')
  })

  it('task 连续答对达 minCorrect 触发 restore effect 并推进', () => {
    const r = createChapterRunner(CHAPTER_1)
    let s = r.start()
    while (CHAPTER_1.scenes[s.sceneIndex].kind !== 'task') s = r.next({ type: 'advance' }).state
    const task = CHAPTER_1.scenes[s.sceneIndex] as Extract<Scene, { kind: 'task' }>
    let out = r.next({ type: 'task-correct', wordId: task.task.wordId, layer: task.task.layer })
    out = r.next({ type: 'task-correct', wordId: task.task.wordId, layer: task.task.layer })
    expect(out.state.sceneIndex).toBeGreaterThan(s.sceneIndex)
    expect(out.effects.some((e) => e.type === 'restore')).toBe(true)
  })

  it('boss 连续错达 maxWrong 标失败并 finished', () => {
    const r = createChapterRunner(CHAPTER_1)
    let s = r.start()
    // 推进到 boss(简化:直接找 index)
    const bossIdx = CHAPTER_1.scenes.findIndex((sc) => sc.kind === 'boss')
    while (s.sceneIndex < bossIdx) {
      const scene = CHAPTER_1.scenes[s.sceneIndex]
      if (scene.kind === 'task') {
        const t = scene as Extract<Scene, { kind: 'task' }>
        s = r.next({ type: 'task-correct', wordId: t.task.wordId, layer: t.task.layer }).state
      } else {
        s = r.next({ type: 'advance' }).state
      }
    }
    const boss = CHAPTER_1.scenes[s.sceneIndex] as Extract<Scene, { kind: 'boss' }>
    for (let i = 0; i < boss.maxWrong; i++) s = r.next({ type: 'boss-wrong' }).state
    expect(s.bossWon).toBe(false)
    expect(s.finished).toBe(true)
  })

  it('social 选中 good 才推进,选 bad 停留同 scene', () => {
    const r = createChapterRunner(CHAPTER_1)
    let s = r.start()
    const socialIdx = CHAPTER_1.scenes.findIndex((sc) => sc.kind === 'social')
    while (s.sceneIndex < socialIdx) {
      const scene = CHAPTER_1.scenes[s.sceneIndex]
      if (scene.kind === 'task') {
        const t = scene as Extract<Scene, { kind: 'task' }>
        s = r.next({ type: 'task-correct', wordId: t.task.wordId, layer: t.task.layer }).state
      } else s = r.next({ type: 'advance' }).state
    }
    const social = CHAPTER_1.scenes[s.sceneIndex] as Extract<Scene, { kind: 'social' }>
    const bad = social.options.find((o) => o.consequence !== 'good')!
    s = r.next({ type: 'social-choose', optionId: bad.id }).state
    expect(s.sceneIndex).toBe(socialIdx)         // 未推进
    s = r.next({ type: 'social-choose', optionId: social.goodOptionId }).state
    expect(s.sceneIndex).toBeGreaterThan(socialIdx)
    expect(s.socialDone).toBe(true)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/qianzigu/engine.test.ts`
Expected: FAIL(模块不存在)。

- [ ] **Step 3: 实现 engine.ts**

按 Task 3 Interfaces 与运行规则实现纯状态机(内部用不可变对象推进;effects 由 next 返回)。要点:所有更新用 spread 建新 state;`restoreOrder` 只在 UI 侧用于场景点亮先后,引擎不依赖它推进(见实现可选择按 scene 内 task 顺序)。

```ts
function initial(chapter: Chapter): RunnerState {
  return { sceneIndex: 0, taskHits: {}, restored: [], bossWrong: 0, bossWon: false, socialDone: false, finished: false }
}

export function createChapterRunner(chapter: Chapter): Runner {
  let state: RunnerState = initial(chapter)
  const step = (s: RunnerState, action: RunnerAction): { state: RunnerState; effects: RunnerEffect[] } => {
    if (s.finished) return { state: s, effects: [] }
    const scene = chapter.scenes[s.sceneIndex]
    const effects: RunnerEffect[] = []
    const patch = (p: Partial<RunnerState>): RunnerState => ({ ...s, ...p })

    switch (scene.kind) {
      case 'dialogue': case 'break': case 'ending': {
        if (action.type !== 'advance') return { state: s, effects }
        const nextIdx = s.sceneIndex + 1
        const finished = scene.kind === 'ending' || nextIdx >= chapter.scenes.length
        return { state: patch({ sceneIndex: Math.min(nextIdx, chapter.scenes.length - 1), finished }), effects }
      }
      case 'task': {
        if (action.type === 'task-correct' && action.wordId === scene.task.wordId && action.layer === scene.task.layer) {
          const hits = { ...s.taskHits, [action.wordId]: (s.taskHits[action.wordId] ?? 0) + 1 }
          if (hits[action.wordId] >= scene.task.minCorrect) {
            const restored = [...s.restored, { wordId: action.wordId, layer: action.layer }]
            effects.push({ type: 'restore', wordId: action.wordId, layer: action.layer })
            return { state: patch({ sceneIndex: s.sceneIndex + 1, taskHits: hits, restored }), effects }
          }
          return { state: patch({ taskHits: hits }), effects }
        }
        if (action.type === 'task-wrong') return { state: s, effects }
        return { state: s, effects }
      }
      case 'social': {
        if (action.type !== 'social-choose') return { state: s, effects }
        const chosen = scene.options.find((o) => o.id === action.optionId)
        if (!chosen) return { state: s, effects }
        if (chosen.id !== scene.goodOptionId) return { state: s, effects }   // 停留重弹
        return { state: patch({ sceneIndex: s.sceneIndex + 1, socialDone: true }), effects }
      }
      case 'boss': {
        if (action.type === 'boss-wrong') {
          const wrong = s.bossWrong + 1
          if (wrong >= scene.maxWrong) {
            effects.push({ type: 'mark-boss-failed' })
            return { state: patch({ bossWrong: wrong, bossWon: false, finished: true }), effects }
          }
          return { state: patch({ bossWrong: wrong }), effects }
        }
        if (action.type === 'boss-correct') {
          return { state: patch({ bossWon: true, sceneIndex: s.sceneIndex + 1 }), effects }
        }
        return { state: s, effects }
      }
      case 'settle': {
        effects.push({ type: 'settle' })
        return { state: patch({ finished: true }), effects }
      }
      default:
        return { state: s, effects }
    }
  }
  return {
    state,
    start() { state = initial(chapter); return state },
    next(action) {
      const out = step(state, action)
      state = out.state
      return out
    },
  }
}
```

> 说明:BOSS 成败在真实玩法里按 spec §4.8 为「交错 5 题,全对胜;3 次错败」;本引擎以 `boss-correct` 首次即推进为简化。**UI 层(P5)负责真正的 5 题交错与全对判定**,引擎在此只保证「收 boss-correct/wrong 信号、按 maxWrong 判失败」,若 P5 需要「全部答对才胜」则 UI 在发 `boss-correct` 前自行校验(引擎可加 `bossAnswered`/`bossNeeded` 字段——见 Task 4 增强)。

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/features/qianzigu/engine.test.ts`
Expected: 全 PASS(4 用例)。

- [ ] **Step 5: 全量回归 + 架构边界**

Run: `npm test`
Expected: 全绿;`architecture.test.ts` 不报(qianzigu 只引 shared)。

- [ ] **Step 6: Commit**

```bash
git add src/features/qianzigu/engine.ts src/features/qianzigu/engine.test.ts
git commit -m "feat(qianzigu): 章节运行引擎 createChapterRunner"
```

---

### Task 4: BOSS 全对制增强(bossAnswered/bossNeeded)+ 引擎汇总测试

**Files:**
- Modify: `src/features/qianzigu/engine.ts`、`chapter.ts`、`ch1.ts`
- Test: `src/features/qianzigu/engine.test.ts`

**Interfaces:**
- Consumes: Task 1-3。
- Produces:
  - `BossScene` 增字段 `questionCount: number`(题目数,默认 5)。
  - `RunnerState` 增 `bossAnswered: number`、`bossNeeded: number`;`boss-correct` 在 `bossAnswered >= bossNeeded` 才置胜推进。

- [ ] **Step 1: 写失败测试**

```ts
it('boss 需全对 questionCount 才胜', () => {
  const r = createChapterRunner(CHAPTER_1)
  let s = r.start()
  const bossIdx = CHAPTER_1.scenes.findIndex((sc) => sc.kind === 'boss')
  while (s.sceneIndex < bossIdx) {
    const scene = CHAPTER_1.scenes[s.sceneIndex]
    if (scene.kind === 'task') {
      const t = scene as Extract<Scene, { kind: 'task' }>
      s = r.next({ type: 'task-correct', wordId: t.task.wordId, layer: t.task.layer }).state
    } else s = r.next({ type: 'advance' }).state
  }
  const boss = CHAPTER_1.scenes[s.sceneIndex] as Extract<Scene, { kind: 'boss' }>
  for (let i = 0; i < boss.questionCount - 1; i++) s = r.next({ type: 'boss-correct' }).state
  expect(s.bossWon).toBe(false)                     // 未满
  s = r.next({ type: 'boss-correct' }).state
  expect(s.bossWon).toBe(true)
  expect(s.sceneIndex).toBeGreaterThan(bossIdx)
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/qianzigu/engine.test.ts`
Expected: FAIL(未满仍胜)。

- [ ] **Step 3: 增强模型与引擎**

- `chapter.ts`:`BossScene` 加 `questionCount: number`。
- `ch1.ts`:BOSS scene 设 `questionCount: 5`。
- `engine.ts`:
  - `RunnerState` 增 `bossAnswered: number`、`bossNeeded: number`;`initial` 时 `bossNeeded` 取 boss scene 的 `questionCount`(若当前尚未到 boss,默认 5)。
  - boss 分支:`boss-correct` 时 `bossAnswered+1`;达 `>= bossNeeded` 才 `bossWon:true` + 推进;否则停留。

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/features/qianzigu/engine.test.ts`
Expected: 全 PASS。

- [ ] **Step 5: 全量回归**

Run: `npm test`
Expected: 全绿。

- [ ] **Step 6: Commit**

```bash
git add src/features/qianzigu/chapter.ts src/features/qianzigu/ch1.ts src/features/qianzigu/engine.ts src/features/qianzigu/engine.test.ts
git commit -m "feat(qianzigu): BOSS 全对制判定(bossAnswered/bossNeeded)"
```

---

## Self-Review

**Spec 覆盖:** §3.2 数据模型 → Task1;§3.3 引擎(纯 reducer,不判分,自然断点 advance,失败保留 finished/restored 不丢)→ Task3/4;ch1 全内容(§4.1-4.10)→ Task2 照录;社交后果式/§5 → Task2 + Task3 social 规则;复用进度/幂等(§3.5)→ 引擎只发 `restore`/`settle` effect,落库由 P4/P5 承接,幂等写库在 P5 settle 语义内。场景两态/配音/UI 属 P5。

**占位扫描:** 无 TBD;台本完整转写指令明确(逐条照录 idea §4,不臆造)。

**类型一致性:** `Scene` 判别联合用 `scene.kind === 'task'` 收窄在测试中 `Extract<Scene,{kind:'task'}>` 可用;`BossScene.questionCount` 在 Task4 同步进 ch1/engine 三处;`SpeechRole` 来自 P2 shared。
