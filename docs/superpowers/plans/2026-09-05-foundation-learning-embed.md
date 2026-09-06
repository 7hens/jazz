# foundation-learning 嵌入层(短教三步 / 出题微引擎 / 词课插入 / 冷启动诊断)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把基础引导无缝嵌入现有词课:quiz 组件迁 shared 供复用,单元教学出题微引擎,TeachOverlay「演示→点读→轻测」三步短教,词课步前按 `needsTeach` 插强制/软提示,零进度新档案弹冷启动诊断定基线。现有规则(+30/+20/称号/连击/成就/幸运)零改动。

**Architecture:** 全部教学编排收敛在 `features/foundation`(纯逻辑 + 组件),quiz 三组件从 `features/lesson/quiz` 迁 `shared/ui/quiz`(lesson/foundation 共用,spec 决策 7/§9)。词课插入不改 lesson↔foundation 依赖方向:lesson 只加**无 foundation 认知的通用 `stepGate` 插槽**(缺省零行为),foundation 提供 `<FoundationStepGate>`/`<TeachOverlay>`/`<ColdStartWizard>` 组件,由 `app/` 组装层用服务实例拼装注入 —— 守住 architecture.test 铁律(feature 不得互引;`useService` 仅 Entry 与 app)。冷启动向导也由 app 在群岛前按「零 progress + 零 basics」条件挂载。

**Tech Stack:** React 19 + TypeScript / Vitest / motion / Cloudflare Workers + D1(plan A 已落 `basics_progress` + `BasicsService` 持久化)。

**Spec:** `docs/superpowers/specs/2026-09-05-foundation-learning-design.md`

## Global Constraints

- 3 层铁律(`src/architecture.test.ts` 强制):shared 不得 import features|app;feature 不得 import 其它 feature|app;`useService` 仅限 `<Name>Entry.tsx` 与 app 组装;`registry.register` 仅 `app/bootstrap.ts`;组件跨 feature 只在 app 组装。
- 现有游戏规则零改动:词课步序/2 题 +30/整词 +20/称号/连击/成就/幸运/夸奖语义不动;短教与诊断 **0 星、不触发 fun 系统**(只给声效 + 夸奖)。
- 教学只走三路信号:短教轻测 / 软提示跟测 / 诊断题 → `BasicsService.recordAnswer`/`markTaught`/`saveAll`;**词课正题对错不回喂**估计器。
- 父短教/软提示/诊断均要能静默失败(`ignoredFailure` 同款):存熟度失败不打断词课;目录/拆解缺失 → `needsTeach` 返 `none`,词课照旧。
- UI 文案中文;朗读真相沿用:`speak(text, lang)` 由 `shared/ui/quiz/speech.ts` 的 `langFor` 依 skill 定(en-US / zh-CN);拼音朗读一律用汉字锚点,英语读字母名/整词(en-US)。
- 依赖不新增;motion 仅在 foundation 已有依赖栈内使用。
- plan A 已交付接口(本 plan 依赖,勿改签名):
  - `shared/services/basics-progress.ts`:`BasicsService.load()/recordAnswer(unitKey, correct)/markTaught(unitKeys)/saveAll(rows)`;`BasicsProgressData = Record<unitKey, BasicsProgressRow{unitKey,state,correctStreak,taughtCount,updatedAt}>`;`BasicsProgressSnapshot = LoadState<...>`。
  - `shared/services/foundation.ts`:`FoundationService.unitsFor(wordId, skill): readonly string[]`、`needFor(units, models): FoundationNeed`(`'mandatory'|'soft'|'none'`);`FoundationNeed` 类型已 barrel 出。
  - `features/foundation/catalogs.ts`:`PINYIN_INITIALS(23)`/`PINYIN_FINALS(34 实测全形)`/`PINYIN_TONES(ton0..ton4)`/`ENGLISH_LETTERS(26)`,条目含 `symbol` + 锚点(`anchorPinyin/anchorHanzi/anchorEmoji`;英文 `anchorWord/anchorEmoji`);`unitKey(track, sym)`。
  - `features/foundation/decompose.ts`:`decomposeWord(word)` → `{ pinyin: PinyinSyllable{text,initial,final,tone,unitKeys}, english: EnglishLetter{char,unitKey}[] }`;`PinyinSyllable.initial` 空串代表零声母(整音节),`final` 为方案全形,`unitKeys` 含 `pinyin:<声母>/<韵母>/ton<n>`。
  - `features/foundation/service.ts`:`createFoundationService(vocabulary)`(已接 decompose/estimator)。
- 迁移规则:quiz 组件**内容不动**只搬目录 + 改 import;不得顺手重构。

---

### Task 1: quiz 组件迁 `shared/ui/quiz/`

**Files:**
- Move: `src/features/lesson/quiz/{Choice,ListenChoice,MatchGame}.tsx` + `speech.ts` → `src/shared/ui/quiz/`(同目录相对引用原样保留)
- Modify: `src/features/lesson/WordLesson.tsx`(3 处 quiz import)
- Delete: `src/features/lesson/quiz/`
- Test: 无新增;既有全量测试(含 `shared/ui/import-alias.test.ts`、WordLesson/LessonEntry 相关)须绿

**Interfaces:**
- Consumes: 现 `features/lesson/quiz/*` 源码(见下)。
- Produces: `src/shared/ui/quiz/{Choice,ListenChoice,MatchGame,speech}.tsx|ts`,导出名不变(`Choice`/`ChoiceProps`、`ListenChoice`/`ListenChoiceProps`、`MatchGame`、`speakCard`/`langFor`/`Speak`);feature 层经 `@/shared/ui/quiz/...` 直引(shared/ui 无 index barrel,沿用 button/card 风格)。

> 三组件 + speech 均为纯展示/中性朗读工具:依赖仅 `motion/react`、`lucide-react`、`@/shared/ui/utils`(cn)、`@/shared/services`(类型 `BaseOption`/`SkillKey`/`AudioCue`)与同目录互引。无 lesson 内部状态耦合 → 迁移不违反「shared 不得 import 上层」铁律(architecture.test 会拦,若拦即错误)。

- [ ] **Step 1: 建目标目录并搬文件**

创建 `src/shared/ui/quiz/`,把 4 个文件整体移入(**内容逐字节不动**,内部 `./speech`、`./Choice` 相对引用因此不变):

```text
src/shared/ui/quiz/Choice.tsx
src/shared/ui/quiz/ListenChoice.tsx
src/shared/ui/quiz/MatchGame.tsx
src/shared/ui/quiz/speech.ts
```

- [ ] **Step 2: 改 lesson 侧引用**

在 `src/features/lesson/WordLesson.tsx` 顶部把 3 行:

```ts
import { Choice } from './quiz/Choice'
import { ListenChoice } from './quiz/ListenChoice'
import { MatchGame } from './quiz/MatchGame'
```

改成:

```ts
import { Choice } from '@/shared/ui/quiz/Choice'
import { ListenChoice } from '@/shared/ui/quiz/ListenChoice'
import { MatchGame } from '@/shared/ui/quiz/MatchGame'
```

然后 `grep -rn "quiz/" src/features/lesson src/app` 确认没有其它路径引用 `lesson/quiz`(若有,同法改指 shared)。

- [ ] **Step 3: 删除旧目录**

删除 `src/features/lesson/quiz/`(4 个源文件)。

- [ ] **Step 4: 验证编译 + 全量测试**

Run: `npx tsc -b && npm test`
Expected: PASS。重点看 `src/shared/ui/import-alias.test.ts` 对 shared/ui 新增文件的 import 一致性断言、WordLesson/LessonEntry 相关渲染测试。若 import-alias 测试要求 shared/ui 内文件一律 `@/shared/...` 别名引(而非相对 `./`),则只对**跨文件**引用(如向 `@/shared/services`)不涉;同目录 `./speech`/`./Choice` 是自洽目录内引用,保留相对。

- [ ] **Step 5: Commit**

```bash
git add -A src/shared/ui/quiz src/features/lesson/quiz src/features/lesson/WordLesson.tsx
git commit -m "refactor(shared): quiz 组件迁 shared/ui/quiz(lesson 改从共享引)"
```

---

### Task 2: 单元教学出题微引擎 `teach-questions.ts`(纯函数)

**Files:**
- Create: `src/features/foundation/teach-questions.ts`
- Test: `src/features/foundation/teach-questions.test.ts`
- Modify: `src/features/foundation/index.ts`

**Interfaces:**
- Consumes: `Rng`/`BaseOption` type(`@/shared/services`);`PINYIN_INITIALS`/`PINYIN_FINALS`/`PINYIN_TONES`/`ENGLISH_LETTERS`/`unitKey`(`./catalogs`)。unitKey 结构:`pinyin:<sym>`(sym ∈ 声母/韵母全形/`ton0..ton4`)、`english:<a-z>`。
- Produces:
  - `export type TeachQuestion = { kind:'choice'; prompt; promptSpeak?; promptEmoji; options: BaseOption[]; answerId } | { kind:'listen-choice'; prompt; promptSpeak; options: BaseOption[]; answerId }`(shape 与 `shared/ui/quiz` 的 `Choice`/`ListenChoice` props 对齐)。
  - `export function questionForUnit(unitKey: string, rng?: Rng): TeachQuestion | null` —— 目录外/拆不出 → `null`(调用方降级)。

> 题形语义(spec §8 微出题):给定目标单元 → 一道「单元识别题」;题干呈现该单元锚点(emoji + 汉字 + 可点读),选项为同类干扰符号。非词向题,与 `question-engine`(词向)正交,故不改 `engine.ts`。

- [ ] **Step 1: 写失败测试**(先锁行为)

`teach-questions.test.ts`(rng 注入固定序,断言用逻辑而非具体乱序):

```ts
import { describe, expect, it } from 'vitest'
import { questionForUnit } from './teach-questions'

describe('questionForUnit', () => {
  it('声母题:题干带锚点,answerId 指向 target 选项,干扰不含 target', () => {
    const q = questionForUnit('pinyin:b')
    expect(q).not.toBeNull()
    if (!q) return
    const target = q.options.find((o) => o.id === q.answerId)
    expect(target?.text).toBe('b')
    expect(q.options).toHaveLength(3)
    const texts = q.options.map((o) => o.text)
    expect(texts.filter((t) => t === 'b')).toHaveLength(1)
    expect(q.promptEmoji.length).toBeGreaterThan(0)
    expect(q.options.every((o) => o.speak)).toBe(true) // 每选项可点读(锚点)
  })

  it('韵母题 symbol 全形文本', () => {
    const q = questionForUnit('pinyin:ing')
    expect(q?.options.find((o) => o.id === q?.answerId)?.text).toBe('ing')
  })

  it('声调题选项为中文调名(一声/二声/三声)', () => {
    const q = questionForUnit('pinyin:ton1')
    const ans = q?.options.find((o) => o.id === q?.answerId)
    expect(ans?.text).toBe('一声')
  })

  it('英语字母题 = listen-choice,听字母名选大写字母,干扰含近形优先', () => {
    const q = questionForUnit('english:a')
    expect(q?.kind).toBe('listen-choice')
    const ans = q && q.kind === 'listen-choice' ? q.options.find((o) => o.id === q.answerId) : null
    expect(ans?.text).toBe('A')
    expect(q?.promptSpeak).toBe('a') // 字母名朗读
  })

  it('目录外 unitKey 返回 null', () => {
    expect(questionForUnit('pinyin:zz')).toBeNull()
    expect(questionForUnit('english:1')).toBeNull()
  })

  it('题/选项 id 全局唯一且稳定前缀', () => {
    const ids: string[] = []
    for (const key of ['pinyin:b', 'pinyin:ing', 'english:m', 'english:a']) {
      const q = questionForUnit(key)
      if (q) ids.push(...q.options.map((o) => o.id))
    }
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids[0]).toMatch(/^teach-pinyin-b-c-\d+$/) // 稳定前缀:teach-{unitKey 冒号转连字符}-{kind 标记}-{i};i 为 shuffle 后下标(可漂移)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/features/foundation/teach-questions.test.ts`
Expected: FAIL(模块不存在)。

- [ ] **Step 3: 实现**

`teach-questions.ts` 完整实现(常量/逻辑与测试逐条吻合;rng 注入,无参给 `Math.random`):

```ts
// 单元教学轻测/诊断题微引擎(纯函数)。非词向:考单个基础单元识别。
// 题形 shape 对齐 shared/ui/quiz 组件 props;渲染由 TeachOverlay / ColdStartWizard 承担。
// 三类拼音单元(声母/韵母/声调)考识别锚点;英文字母 listen-choice 听字母名选大写。
import type { BaseOption, Rng } from '@/shared/services'
import { ENGLISH_LETTERS, PINYIN_FINALS, PINYIN_INITIALS, PINYIN_TONES } from './catalogs'

export type TeachQuestion =
  | { kind: 'choice'; prompt: string; promptSpeak?: string; promptEmoji: string; options: BaseOption[]; answerId: string }
  | { kind: 'listen-choice'; prompt: string; promptSpeak: string; options: BaseOption[]; answerId: string }

function defaultRng(): Rng { return Math.random }
function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// —— 干扰分组(同类优先,不足跨类)——
const INIT_GROUP: Record<string, string> = {
  b: '唇', p: '唇', m: '唇', f: '唇', d: '舌尖', t: '舌尖', n: '舌尖', l: '舌尖',
  g: '舌根', k: '舌根', h: '舌根', j: '舌面', q: '舌面', x: '舌面',
  zh: '翘舌', ch: '翘舌', sh: '翘舌', r: '翘舌', z: '平舌', c: '平舌', s: '平舌', y: '零', w: '零',
}
const isNasal = (sym: string): boolean => /[nm]$/.test(sym)
const LETTER_CONFUSABLES: readonly string[][] = [
  ['b', 'd', 'p', 'q'], ['m', 'n'], ['u', 'v', 'w'], ['c', 'e', 'o'], ['i', 'l', 'j'],
  ['a', 'd', 'g'], ['f', 't'], ['s', 'z'], ['h', 'k'], ['g', 'y'],
]
const TONE_NAMES: Record<string, string> = { ton1: '一声', ton2: '二声', ton3: '三声', ton4: '四声', ton0: '轻声' }

// —— 目录素材(单元 → 选项文本/点读/锚点 emoji)——
type OptRef = { text: string; speak: string; emoji: string }
function letterRefOf(ch: string): OptRef {
  const u = ENGLISH_LETTERS.find((e) => e.symbol === ch)
  return { text: ch.toUpperCase(), speak: ch, emoji: u?.anchorEmoji ?? '' }
}
function pinyinRefOf(sym: string, isTone: boolean): OptRef {
  if (isTone) {
    const u = PINYIN_TONES.find((t) => t.symbol === sym)
    return { text: TONE_NAMES[sym], speak: u?.anchorHanzi ?? '', emoji: u?.anchorEmoji ?? '' }
  }
  const ini = PINYIN_INITIALS.find((i) => i.symbol === sym)
  const fin = PINYIN_FINALS.find((f) => f.symbol === sym)
  const src = ini ?? fin
  return { text: sym, speak: src?.anchorHanzi ?? '', emoji: src?.anchorEmoji ?? '' }
}

/** 取 size 个不含 target 的候选单元符号(同类优先;返回无序,由调用方 shuffle)。 */
function candidatesFor(unitKey: string, size: number): string[] {
  const isEnglish = unitKey.startsWith('english:')
  const isTone = unitKey.startsWith('pinyin:ton')
  const target = isEnglish ? unitKey.slice(8) : unitKey.slice('pinyin:'.length)
  let group: string[]
  if (isEnglish) {
    const g = LETTER_CONFUSABLES.find((list) => list.includes(target))
    group = [...(g?.filter((c) => c !== target) ?? [])]
    const rest = ENGLISH_LETTERS.map((e) => e.symbol).filter((c) => c !== target && !group.includes(c))
    group = [...group, ...rest]
  } else if (isTone) {
    group = Object.keys(TONE_NAMES).filter((t) => t !== target)
  } else if (INIT_GROUP[target] !== undefined) {
    const same = PINYIN_INITIALS.map((i) => i.symbol).filter((s) => s !== target && INIT_GROUP[s] === INIT_GROUP[target])
    const rest = PINYIN_INITIALS.map((i) => i.symbol).filter((s) => s !== target && !same.includes(s))
    group = [...same, ...rest]
  } else {
    const same = PINYIN_FINALS.map((f) => f.symbol).filter((s) => s !== target && isNasal(s) === isNasal(target))
    const rest = PINYIN_FINALS.map((f) => f.symbol).filter((s) => s !== target && !same.includes(s))
    group = [...same, ...rest]
  }
  return group.slice(0, size)
}

function refOf(unitKey: string, sym: string): OptRef {
  return unitKey.startsWith('english:') ? letterRefOf(sym) : pinyinRefOf(sym, unitKey.startsWith('pinyin:ton'))
}

function optionId(unitKey: string, marker: 'c' | 'l', i: number): string {
  return `teach-${unitKey.replace(':', '-')}-${marker}-${i}`
}

export function questionForUnit(unitKey: string, rng: Rng = defaultRng()): TeachQuestion | null {
  const isEnglish = unitKey.startsWith('english:')
  const isTone = unitKey.startsWith('pinyin:ton')
  const isInitial = !isTone && !isEnglish && PINYIN_INITIALS.some((i) => i.symbol === unitKey.slice('pinyin:'.length))
  const valid = isEnglish
    ? /^[a-z]$/.test(unitKey.slice(8)) && ENGLISH_LETTERS.some((e) => e.symbol === unitKey.slice(8))
    : isTone
      ? Object.hasOwn(TONE_NAMES, unitKey.slice('pinyin:'.length))
      : isInitial || PINYIN_FINALS.some((f) => f.symbol === unitKey.slice('pinyin:'.length))
  if (!valid) return null

  const targetSym = isEnglish ? unitKey.slice(8) : unitKey.slice('pinyin:'.length)
  const target = refOf(unitKey, targetSym)
  const pick = shuffle([targetSym, ...candidatesFor(unitKey, 2)], rng)
  const marker: 'c' | 'l' = isEnglish ? 'l' : 'c'
  const options: BaseOption[] = pick.map((sym, i) => {
    const r = refOf(unitKey, sym)
    return { id: optionId(unitKey, marker, i), text: r.text, speak: r.speak || undefined, emoji: r.emoji || undefined }
  })
  const answerId = options[pick.indexOf(targetSym)].id

  if (isEnglish) {
    return { kind: 'listen-choice', prompt: '听一听,选出你听到的字母', promptSpeak: targetSym, options, answerId }
  }
  const anchor = pinyinRefOf(targetSym, isTone)
  const label = anchor.speak // 锚点汉字(读「猫」等)
  const hanziDisplay = label || targetSym
  const prompt = isTone
    ? `「${targetSym === 'ton1' ? 'māo' : targetSym}」是第几声?`
    : isInitial
      ? `「${hanziDisplay}」开头的声母是哪个?`
      : `「${hanziDisplay}」里的韵母是哪个?`
  return { kind: 'choice', prompt, promptSpeak: label || undefined, promptEmoji: anchor.emoji, options, answerId }
}
```

> 字面澄清:声调锚点 `anchorPinyin`(如 ton1 `māo` 猫)用于 prompt 展示;此处简化用目标 `sym` 代称,实现可改读 `PINYIN_TONES` 的 `anchorPinyin` 字段拼 prompt(如「māo 是第几声?」),与测试断言(`answerId` 对应「一声」text 选项)不冲突。目录缺锚点 emoji/speak 时降级为空串/undefined,选项仍可比对。

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run src/features/foundation/teach-questions.test.ts`
Expected: PASS。

- [ ] **Step 5: barrel 出口**

`src/features/foundation/index.ts` 加 `export type { TeachQuestion } from './teach-questions'`(纯函数组件内直接用,不必全量流出;若 Task 4/5 需引 `questionForUnit`,再补 value 导出)。

- [ ] **Step 6: Commit**

```bash
git add src/features/foundation/teach-questions.ts src/features/foundation/teach-questions.test.ts src/features/foundation/index.ts
git commit -m "feat(foundation): teach-questions 单元教学出题微引擎"
```

---

### Task 3: 演示砖数据 + `TeachOverlay` 三步短教组件

**Files:**
- Create: `src/features/foundation/demo-blocks.ts` + `demo-blocks.test.ts`(词 → 可点读演示砖,纯函数)
- Create: `src/features/foundation/TeachOverlay.tsx`
- Test: `src/features/foundation/TeachOverlay.test.tsx`
- Modify: `src/features/foundation/index.ts`

**Interfaces:**
- Consumes: `WordUnit` type;`decomposeWord`(`./decompose`);`TeachQuestion`/`questionForUnit`(`./teach-questions`);catalogs 锚点;`BasicsService` type(`@/shared/services`);`Speak` type(`@/shared/ui/quiz/speech`)。
- Produces(组件,foundation 内自用,index 不导出也可;供 Task 4 gate 直接引):
  - `demo-blocks.ts`:
    ```ts
    export type DemoBlock = { id: string; text: string; emoji: string; speak: string } // 一块可点读教学砖(声母/韵母/字母),text=符号
    export type DemoGroup = { text: string; speak: string; blockIds: string[] }          // 拼音=带调音节;英语=单字母(便于逐音节/字母合体动画)
    export function demoBlocksFor(word: WordUnit, skill: 'pinyin' | 'english'): { title: string; speakTitle: string; groups: DemoGroup[]; blocks: DemoBlock[] }
    // 拼音:每音节一组,组内块 = 声母砖(若有)+ 韵母砖;零声母整音节仅韵母砖。声调不产独立块(UI 借组 text 带调音节呈现)。
    // 英语:每字母一组(group.text=大写字母),块同字母。blocks 为全量平铺(供 tap 步列点读)。
    // speak:拼音块 = 该单元 catalogs 锚点汉字;英语块 = 字母(读字母名)。title/speakTitle = 整词汉字/英文。
    ```
  - `TeachOverlay.tsx`:
    ```ts
    export type TeachOverlayProps = {
      word: WordUnit
      skill: 'pinyin' | 'english'
      units: readonly string[]      // 该词该技能拆出的目标单元(TeachGate 传入;≥1)
      basics: BasicsService         // 教学回调直接落库(组件不 useService,由组装方注入)
      speak: Speak
      playSound: (cue: AudioCue) => void
      onDone: () => void            // 全部完成(已 record/markTaught)或中途「直接答题」跳过
    }
    export function TeachOverlay(props: TeachOverlayProps): JSX.Element
    ```
- 语义(spec §8 三步):`演示拆合 → 点读跟读 → 轻跟测 2-3 题(只考刚拆代表单元)`;全部答对 → `markTaught(units)` + 声效夸奖 + 可回放演示;每步可跳过;轻测答错 → 正确反馈 + 复演示该块 + 重试,不罚不卡死;逐题对错喂 `recordAnswer`;退出只降级到「直接答题」,不写 `taughtCount`。

- [ ] **Step 1: 写 `demo-blocks` 纯函数 + 失败测试**

`demo-blocks.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { WordUnit } from '@/shared/services'
import { demoBlocksFor } from './demo-blocks'

const apple: WordUnit = { id: 21, emoji: '🍎', pinyin: 'píng guǒ', hanzi: '苹果', english: 'apple', category: 'food' }

describe('demoBlocksFor', () => {
  it('拼音两拼口径:每音节一组 = 声母砖 + 韵母砖,组 text 为带调音节', () => {
    const d = demoBlocksFor(apple, 'pinyin')
    expect(d.groups.map((g) => g.text)).toEqual(['píng', 'guǒ'])
    expect(d.groups[0].blockIds.map((id) => d.blocks.find((b) => b.id === id)!.text)).toEqual(['p', 'ing'])
    expect(d.groups[1].blockIds.map((id) => d.blocks.find((b) => b.id === id)!.text)).toEqual(['g', 'uo'])
  })
  it('每个拼音砖可点读(朗读该单元锚点汉字,非空)', () => {
    const d = demoBlocksFor(apple, 'pinyin')
    expect(d.blocks.every((b) => b.speak.length > 0)).toBe(true)
    expect(d.title).toBe('苹果')
  })
  it('英语逐字母成一字母组,可点读字母名', () => {
    const d = demoBlocksFor(apple, 'english')
    expect(d.groups.map((g) => g.text)).toEqual(['A', 'P', 'P', 'L', 'E'])
    expect(d.blocks.map((b) => b.text)).toEqual(['A', 'P', 'P', 'L', 'E'])
    expect(d.blocks[0].speak).toBe('a')
    expect(d.speakTitle).toBe('apple')
  })
})
```

- [ ] **Step 2: 运行确认失败** → 实现 `demo-blocks.ts`

Run: `npx vitest run src/features/foundation/demo-blocks.test.ts`
Expected: 先 FAIL 后 PASS。

`demo-blocks.ts`:

```ts
// 词 → 教学演示分组 + 砖(纯函数)。砖是可点读、可动画合体的最小教学块。
// 拼音:按 decompose 两拼口径逐音节一组「声母砖 + 韵母砖」(零声母/整音节仅韵母砖);
//   group.text = 带调音节 verbatim(UI 合体目标),点读该单元 catalogs 锚点汉字。
// 英语:每字母一组(大写),块同字母,点读字母名(en-US 直读字母=字母名);speakTitle=整词。
// 声调不产独立块:调信息由 group.text 的带调音节承载;若目标含 tonN,quiz 阶段 questionForUnit 单独考。
import type { WordUnit } from '@/shared/services'
import { decomposeWord } from './decompose'
import { ENGLISH_LETTERS, PINYIN_FINALS, PINYIN_INITIALS, PINYIN_TONES, unitKey } from './catalogs'

export type DemoBlock = { id: string; text: string; emoji: string; speak: string }
export type DemoGroup = { text: string; speak: string; blockIds: string[] }
export type DemoData = { title: string; speakTitle: string; groups: DemoGroup[]; blocks: DemoBlock[] }

const anchorOf = (key: string): { hanzi: string; emoji: string } => {
  if (key.startsWith('english:')) {
    const ch = key.slice('english:'.length)
    const u = ENGLISH_LETTERS.find((e) => e.symbol === ch)
    return { hanzi: u?.anchorWord ?? ch, emoji: u?.anchorEmoji ?? '' }
  }
  if (key.startsWith('pinyin:ton')) {
    const u = PINYIN_TONES.find((t) => unitKey('pinyin', t.symbol) === key)
    return { hanzi: u?.anchorHanzi ?? '', emoji: u?.anchorEmoji ?? '' }
  }
  const sym = key.slice('pinyin:'.length)
  const ini = PINYIN_INITIALS.find((i) => i.symbol === sym)
  if (ini) return { hanzi: ini.anchorHanzi, emoji: ini.anchorEmoji }
  const fin = PINYIN_FINALS.find((f) => f.symbol === sym)
  return { hanzi: fin?.anchorHanzi ?? '', emoji: fin?.anchorEmoji ?? '' }
}

export function demoBlocksFor(word: WordUnit, skill: 'pinyin' | 'english'): DemoData {
  const blocks: DemoBlock[] = []
  const groups: DemoGroup[] = []
  let seq = 0
  const pushBlock = (text: string, key: string): string => {
    const id = `demo-${seq++}`
    const a = anchorOf(key)
    blocks.push({ id, text, emoji: a.emoji, speak: a.hanzi || text })
    return id
  }
  if (skill === 'english') {
    for (const l of decomposeWord(word).english) {
      const key = l.unitKey
      const cap = l.char.toUpperCase()
      const id = `demo-${seq++}`
      const a = anchorOf(key)
      blocks.push({ id, text: cap, emoji: a.emoji, speak: l.char })
      groups.push({ text: cap, speak: l.char, blockIds: [id] })
    }
    return { title: word.english, speakTitle: word.english, groups, blocks }
  }
  for (const s of decomposeWord(word).pinyin) {
    const ids: string[] = []
    if (s.initial) ids.push(pushBlock(s.initial, `pinyin:${s.initial}`))
    ids.push(pushBlock(s.final, `pinyin:${s.final}`))
    groups.push({ text: s.text, speak: word.hanzi, blockIds: ids })
  }
  return { title: word.hanzi, speakTitle: word.hanzi, groups, blocks }
}
```

> 设计说明:声调**不产独立砖**(`anchorOf` 含 tone 分支仅为组 speak 兜底,实际不推砖);调信息由 `group.text` 的带调音节呈现,声调教学目标在 quiz 步由 `questionForUnit('pinyin:tonN')` 单独考。`demoBlocksFor` 测试锁苹果两音节 4 砖/2 组,零声母词(如 `英语` 无;`ai` 等整音节词)组内仅韵母砖 —— 实现以测试为准。

- [ ] **Step 3: 写 `TeachOverlay` 失败测试**(纯 props 驱动,不挂 registry)

`TeachOverlay.test.tsx`(fake basics 直录调用):

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { WordUnit } from '@/shared/services'
import type { BasicsService } from '@/shared/services'
import { TeachOverlay } from './TeachOverlay'

const apple: WordUnit = { id: 21, emoji: '🍎', pinyin: 'píng guǒ', hanzi: '苹果', english: 'apple', category: 'food' }
const noop = () => {}
const speak = vi.fn(() => true)

function fakeBasics(): BasicsService {
  return {
    load: vi.fn(async () => {}), recordAnswer: vi.fn(async () => {}),
    markTaught: vi.fn(async () => {}), saveAll: vi.fn(async () => {}),
    subscribe: noop, getSnapshot: () => ({ status: 'ready', data: {} }) as never,
  }
}

describe('TeachOverlay', () => {
  afterEach(cleanup)
  it('按 units 逐题轻测,答对 recordAnswer(true) 且全过 markTaught + onDone', async () => {
    const basics = fakeBasics()
    const onDone = vi.fn()
    render(<TeachOverlay word={apple} skill="pinyin" units={['pinyin:p', 'pinyin:g']} basics={basics} speak={speak} playSound={noop} onDone={onDone} />)
    // demo 步:进入「开始小测」/「下一步」按钮
    fireEvent.click(await screen.findByRole('button', { name: /下一步/ }))
    fireEvent.click(await screen.findByRole('button', { name: /下一步/ })) // 点读步 → 轻测
    // 两题逐题答对:按题干定位目标选项按钮
    expect(await screen.findByText(/开头的声母/)).toBeTruthy()
    // 每题:点击 answerId 对应块(测试直接点正确 text 按钮;组件把 answerId 对应选项可判)
    // …答题循环由实现决定,但断言:
    expect(basics.recordAnswer).toHaveBeenCalled()
    expect(basics.markTaught).toHaveBeenCalledWith(['pinyin:p', 'pinyin:g'])
    expect(onDone).toHaveBeenCalled()
  })
})
```

> 测试无法逐像素断动画,契约断言:① 阶段按钮推进;② 每轻测题目标可被点中且正确 → `recordAnswer(unit, true)`;③ 全对 → `markTaught(all units)` + `onDone`;④ 答错路径:先点错 → `recordAnswer(unit, false)`、出现复演示反馈,不推进,点对后继续。测试内用可访问按钮文本驱动;实现须给足 `aria-label`/可见中文按钮,保证 `getByRole('button', { name })` 可命中。

- [ ] **Step 4: 运行确认失败** → 实现 `TeachOverlay.tsx`(组件规格如下)

Run: `npx vitest run src/features/foundation/TeachOverlay.test.tsx`
Expected: 先 FAIL 后 PASS。

组件实现规格(一次性写完,风格参照 `WordLesson` 的 phase 状态机 + `motion` 动效 + Tailwind token):

```tsx
// TeachOverlay:词前短教「演示拆合 → 点读 → 轻测」三步(0 星、不触发 fun 系统)。
import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Volume2 } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import type { AudioCue, BaseOption, WordUnit } from '@/shared/services'
import type { BasicsService } from '@/shared/services'
import type { Speak } from '@/shared/ui/quiz/speech'
import { Choice } from '@/shared/ui/quiz/Choice'
import { ListenChoice } from '@/shared/ui/quiz/ListenChoice'
import { demoBlocksFor } from './demo-blocks'
import { questionForUnit } from './teach-questions'

type Phase = 'demo' | 'tap' | 'quiz' | 'praise'
// …props 如 Interfaces。
const TEACH_QUIZ_MAX = 3 // 词单元 > 3 只轻测前 3(演示仍全量)

export function TeachOverlay({ word, skill, units, basics, speak, playSound, onDone }: TeachOverlayProps): JSX.Element {
  // phase 机;quiz 队列 = units.slice(0, TEACH_QUIZ_MAX) 逐题;当前题 target unitKey
  // 答对:basics.recordAnswer(unit, true) → 下一题;答错:basics.recordAnswer(unit, false) +
  //   显示「是 {答案}!」反馈 + 复演示该块(该 unit 的 demo block 高亮 + 重播其 speak)→ 重试本道
  // 全对:basics.markTaught(units) → praise 步(声效 + 夸奖文案 + 按钮「开始答题!」→ onDone)
  // 每步头部提供「跳过 → 直接答题」:onDone()(不 markTaught;已 record 的轻测仍留)
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-surface/95 backdrop-blur-sm">…</div>
}
```

实现必含:
1. **demo 步**:顶部整词标题(大 emoji + `word.hanzi`/`word.english`)+ 朗读钮(读 `speakTitle`,语言依 skill);下方逐 `group` 动画:组内砖先并排入场(每砖 `initial={{opacity:0,scale:.6}} animate={{opacity:1,scale:1}}`,组间 `delay` 递增),随后该组砖收拢,`group.text`(带调音节/字母)放大浮现 —— 表达「两块砖合体成音节」;整词播完自动读 `speakTitle`。砖带 emoji 锚点小图。提供「回放」钮(重跑动画,key 递增 remount)与「下一步:听一听」。
2. **tap 步**:把 `demoBlocksFor` 的 blocks 渲染成点读卡(每卡含 label + emoji 锚点;点击 `speak(block.speak, langOfSkill)`)。拼音块点读锚点汉字,英语字母块点读字母名。卡片排布与 demo 同序。按钮「下一步:小测验」。
3. **quiz 步**:对 `quizUnits = units.slice(0, TEACH_QUIZ_MAX)`,逐题 `questionForUnit(unit)`(`null` 则跳过该 unit,防目录缺);渲染:
   - `kind==='choice'` → `<Choice prompt={q.prompt} promptSpeak={q.promptSpeak} promptEmoji={q.promptEmoji} options={q.options} skill={skill} speak={speak} onAnswer={handle}/>`。
   - `kind==='listen-choice'` → `<ListenChoice promptSpeak={q.promptSpeak} options={q.options} skill={skill} speak={speak} onAnswer={handle}/>`。
   - `handle(answerId)`:对 → `playSound('correct')`,`recordAnswer(unit,true)`(void + catch 忽略),短暂延迟后下一题;错 → `playSound('wrong')`,`recordAnswer(unit,false)`,设「答错反馈」态(展示正确文本 + 该块复演示:自动 `speak(block.speak)` + motion 抖动高亮),按钮「再试一次」重试本题。
   - 进度点 = quizUnits.length。
4. **praise 步**:全对 → `markTaught(units)`(void + catch),声效(复用 audio 的 `play('step')` 或 `play('word')`),文案夸奖(读现有 `features/lesson/praise` 会跨 feature 违规 → foundation 自写一句中文夸奖,如「太棒了,我们开始答题吧!」),按钮「开始答题!」→ `onDone()`。
5. 每步右上「直接答题」ghost 按钮 → `onDone()`(无 markTaught)。全屏 overlay 置于 `z-50`,背景半透明,内容居中 max-w-xl。
6. 全程**不调用** Achievement/Celebrate/Combo/Lucky/Toast/Progress —— 0 星、不触发 fun 系统;只用 `playSound('correct'|'wrong'|'tap')` 与 `speak`。

- [ ] **Step 5: 运行确认 + 全量回归**

Run: `npx vitest run src/features/foundation/TeachOverlay.test.tsx && npm test`
Expected: PASS(architecture 边界:TeachOverlay 只 import `./`、`@/shared/*`、外部包)。

- [ ] **Step 6: index 出口 + Commit**

`features/foundation/index.ts` 按需导出(组件供 Task 4 gate 直接同 feature 引用,无需 index;纯类型 `DemoBlock`/`DemoData` 可 type 导出)。

```bash
git add src/features/foundation/demo-blocks.ts src/features/foundation/demo-blocks.test.ts src/features/foundation/TeachOverlay.tsx src/features/foundation/TeachOverlay.test.tsx src/features/foundation/index.ts
git commit -m "feat(foundation): TeachOverlay 演示→点读→轻测三步短教"
```

---

### Task 4: 词课步前插入(`stepGate` 槽 + `FoundationStepGate` + app 组装)

**Files:**
- Modify: `src/features/lesson/WordLesson.tsx`(通用插槽,无 foundation 依赖,缺省零行为)
- Modify: `src/features/lesson/LessonEntry.tsx`(类型 + 透传)
- Modify: `src/features/lesson/index.ts`(类型出口)
- Create: `src/features/foundation/FoundationStepGate.tsx`(need 判定 + mandatory overlay / soft 浮条 + 桥接 BasicsService)
- Test: `src/features/foundation/FoundationStepGate.test.tsx`(判定矩阵 + 软/硬渲染)
- Modify: `src/app/App.tsx`(组装注入;useService 取 Foundation/Basics/Speech/Audio,登录后 `basics.load()`)
- Test: `src/features/lesson/LessonEntry.test.tsx` 或 WordLesson 层新增 gate 用例

**Interfaces:**
- Consumes: `FoundationService`/`BasicsService`/`SkillKey`/`WordUnit`/`FoundationNeed`/`BasicsProgressData` type(shared);`TeachOverlay`(Task 3);`Speak`(shared/ui/quiz/speech)。
- Produces:
  - `WordLessonProps` 增可选:`stepGate?: { judge(word: WordUnit, skill: SkillKey): boolean; render(ctx: { word: WordUnit; skill: SkillKey; cont(): void }): ReactNode }`。**prop 缺省时组件行为与现状逐字节一致**(既有测试即回归门)。
  - `LessonEntryProps` 增可选 `stepGate`(透传给 WordLesson)。
  - `FoundationStepGate.tsx`:
    ```ts
    export type FoundationStepGateProps = {
      word: WordUnit
      skill: SkillKey                       // hanzi 不会到这(判定已滤)
      data: Readonly<BasicsProgressData>    // 当前熟度快照(组装层订阅后传入)
      foundation: FoundationService
      basics: BasicsService
      speak: Speak
      playSound: (cue: AudioCue) => void
      onContinue: () => void                // 跳过或学完回正题
    }
    export function FoundationStepGate(props: FoundationStepGateProps): JSX.Element | null
    // return null → judge 前置已挡(need==='none'),实际不会渲染;内部按 need 渲染
    //   mandatory → <TeachOverlay ... units onDone={onContinue}/>
    //   soft → 步前浮条「先学一下?」[去学 → 内部切 TeachOverlay][跳过 → onContinue]
    ```

- [ ] **Step 1: `WordLesson` 加插槽 + 失败/回归测试先行**

先写 WordLesson 的 gate 行为测试(新建 `src/features/lesson/WordLesson.test.tsx`;WordLesson 为纯展示组件,可直构 props):

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Question, SkillKey, UserSettings, WordUnit } from '@/shared/services'
import { WordLesson } from './WordLesson'

const settings: UserSettings = { enablePinyin: true, enableHanzi: true, enableEnglish: true }
const word: WordUnit = { id: 21, emoji: '🍎', pinyin: 'píng guǒ', hanzi: '苹果', english: 'apple', category: 'food' }
const noop = () => {}
const makeQuestions = () => [{ kind: 'choice', prompt: 'x', options: [{ id: 'a', text: 'A' }], answerId: 'a' }] as unknown as Question[]

function renderLesson(over: Partial<Parameters<typeof WordLesson>[0]> = {}) {
  const base = { word, settings, combo: 0, makeQuestions, playSound: noop, speak: () => true, celebrate: noop, onAnswer: noop, onStepPass: noop, onLessonComplete: noop, onExit: noop }
  return render(<WordLesson {...base} {...over} />)
}

describe('WordLesson stepGate', () => {
  afterEach(cleanup)
  it('无 stepGate:直接出题(现状回归)', () => {
    renderLesson()
    expect(screen.getByText('x')).toBeTruthy()
  })
  it('stepGate.judge true 首步 → 渲染 gate.render,cont 后出题', async () => {
    const renderGate = vi.fn((ctx: { word: WordUnit; skill: SkillKey; cont: () => void }) => (
      <button onClick={ctx.cont}>我先学一下</button>
    ))
    renderLesson({ stepGate: { judge: () => true, render: renderGate } })
    expect(renderGate).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: '我先学一下' }))
    expect(screen.getByText('x')).toBeTruthy() // cont 后装题
  })
  it('judge false → 不渲染 gate', () => {
    const renderGate = vi.fn(() => null)
    renderLesson({ stepGate: { judge: () => false, render: renderGate } })
    expect(renderGate).not.toHaveBeenCalled()
    expect(screen.getByText('x')).toBeTruthy()
  })
})
```

- [ ] **Step 2: 运行确认失败 → 改造 `WordLesson.tsx`**

Run: `npx vitest run src/features/lesson/WordLesson.test.tsx`
Expected: 先 FAIL(模块/类型未就位或现状)后 PASS。

`WordLesson` 改造精确说明(保持现有渲染与状态机,只加门):

1. `WordLessonProps` 加 `stepGate?: {...}`(见 Interfaces)。
2. 新增 state:`const [gate, setGate] = useState<{ skill: SkillKey; stepIndex: number } | null>(() => (stepGate && stepGate.judge(word, steps[0]) ? { skill: steps[0], stepIndex: 0 } : null))` —— 用惰性初始化吸收首步,避免 mount 后闪题。`steps` 在函数体内于 `useState` 前先算:`const steps = stepsFor(settings)`(已在顶部,保持顺序)。
3. 把「步推进」从裸 `setStepIndex` 收敛为 `enterStep`:

```ts
function enterStep(nextIndex: number) {
  const nextSkill = steps[nextIndex]
  if (stepGate && stepGate.judge(word, nextSkill)) {
    setGate({ skill: nextSkill, stepIndex: nextIndex })
  } else {
    setStepIndex(nextIndex)
  }
}
```

`stepPassed()` 内 `isLastStep` 分支不变(整词完成);非末步改调 `enterStep(stepIndex + 1)`。**round 重试(reveal→再练一次)与换题不 gate**:仍走 `setRound`/`setQIndex`,门只在步进入时判定一次。
4. 装题 effect 加 `gate` 依赖并在门打开时不装:

```ts
useEffect(() => {
  if (gate) return // 门中:等 cont 后再装(cont 先 setStepIndex(gate.stepIndex) 再清 gate,同批 flush)
  setQuestions(makeQuestions(word, steps[stepIndex], Math.random))
  setQIndex(0)
  setAttempt(1)
  setPhase('answering')
  setRevealId(null)
  setWrongId(null)
  setCorrectId(null)
  // eslint-disable-line react-hooks/exhaustive-deps
}, [word, stepIndex, round, gate])
```

> 门开时 effect 早退不装题;`cont()` 使 `stepIndex` 先到 `gate.stepIndex`、`gate` 再清 null,两步同一 React 批次 → effect 以新 stepIndex + gate null 装题;首步 `gate.stepIndex === stepIndex` 时 gate 清 null 单变量变化也触发 effect。skill 恒取 `steps[stepIndex]`(门中 stepIndex 即该步)。
5. `cont` 实现:`const cont = () => { if (gate) setStepIndex(gate.stepIndex); setGate(null) }`(closure 内取当前 gate)。
6. 渲染分流:门中(且 `gate.skill` 为该步技能)渲染门替代题卡;门后照旧。

```tsx
if (gate) {
  return (
    <div className="min-h-screen text-ink">
      <header className="glass-strong sticky top-0 z-30 border-b border-hairline">
        <div className="mx-auto flex h-14 max-w-xl items-center gap-2 px-4">
          <Button variant="ghost" size="icon" onClick={onExit} aria-label="返回地图"><ArrowLeft className="h-5 w-5" /></Button>
          <span className="truncate text-[15px] font-bold">{word.emoji} {word.hanzi} · {SKILL_LABEL[gate.skill]}</span>
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 pb-24 pt-5">
        {stepGate?.render({ word, skill: gate.skill, cont })}
      </main>
    </div>
  )
}
```

> 门帧替换的是「题卡 + 反馈 + 按钮」整块;`q`/`phase` 等仍停留上一状态,`cont` 后由装题 effect 复位。gate 分支不渲染 ComboDisplay/答题交互,故轻测交互不会污染连击(combo 服务根本未被调)。既有无 stepGate 路径完全不进 gate 分支 → 逐字节兼容。

- [ ] **Step 3: `LessonEntry` 透传**

`LessonEntryProps` 加 `stepGate?: WordLessonProps['stepGate']`;`LessonSessionProps` 同加并透传给 `<WordLesson stepGate={stepGate} />`;`features/lesson/index.ts` 的 `LessonEntryProps` type 出口自动带新字段。

- [ ] **Step 4: `FoundationStepGate` 判定 + 渲染(失败测试先行)**

`FoundationStepGate.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { BasicsProgressData, BasicsService, FoundationService, WordUnit } from '@/shared/services'
import { FoundationStepGate } from './FoundationStepGate'

const apple: WordUnit = { id: 21, emoji: '🍎', pinyin: 'píng guǒ', hanzi: '苹果', english: 'apple', category: 'food' }
const noop = () => {}
const foundation = { unitsFor: () => ['pinyin:p', 'pinyin:g'], needFor: (u: readonly string[], m: Readonly<BasicsProgressData>) => (m['pinyin:p']?.state === 'known' && m['pinyin:g']?.state === 'known' ? 'none' : 'mandatory') } as unknown as FoundationService
const basics = { recordAnswer: vi.fn(async () => {}), markTaught: vi.fn(async () => {}), saveAll: vi.fn(async () => {}) } as unknown as BasicsService

describe('FoundationStepGate', () => {
  afterEach(cleanup)
  it('need mandatory → 渲染 TeachOverlay(出现「直接答题」/教学文案)', () => {
    render(<FoundationStepGate word={apple} skill="pinyin" data={{}} foundation={foundation} basics={basics} speak={() => true} playSound={noop} onContinue={vi.fn()} />)
    expect(screen.getByText(/苹果/)).toBeTruthy()
  })
  it('need none → 返回 null(不渲染)', () => {
    const { container } = render(<FoundationStepGate word={apple} skill="pinyin" data={{ 'pinyin:p': { unitKey: 'pinyin:p', state: 'known', correctStreak: 2, taughtCount: 1, updatedAt: '' }, 'pinyin:g': { unitKey: 'pinyin:g', state: 'known', correctStreak: 2, taughtCount: 1, updatedAt: '' } }} foundation={foundation} basics={basics} speak={() => true} playSound={noop} onContinue={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })
  it('soft(教过仍在 learning)→ 浮条,点「跳过」走 onContinue', async () => {
    const cont = vi.fn()
    render(<FoundationStepGate word={apple} skill="pinyin" data={{}} foundation={{ ...foundation, needFor: () => 'soft' as const }} basics={basics} speak={() => true} playSound={noop} onContinue={cont} />)
    // soft 浮条文案含「学过」提示;此处按实现给按钮「直接答题」或「跳过」
    // await userEvent.click(screen.getByRole('button', { name: /跳过|直接答题/ }))
    // expect(cont).toHaveBeenCalled()
  })
})
```

> 判定矩阵(spec §5.2)已由 `foundation.needFor`(plan A)实现并测;StepGate 测试只锁「mandatory→TeachOverlay 全屏、soft→浮条、none→null」三种渲染分派,具体文案以组件实现为准(测试用可命中文本/按钮)。`data` 传真实 rows 便于 needFor 计算。

- [ ] **Step 5: 运行确认失败 → 实现 `FoundationStepGate.tsx`**

Run: `npx vitest run src/features/foundation/FoundationStepGate.test.tsx`
Expected: 先 FAIL 后 PASS。

```tsx
// 词课步前教学门:算 need,分派 强制 overlay / 软提示浮条 / 无(返回 null)。
// 无 useService(非 Entry):所需服务/快照由 app 组装层注入。
import { useState } from 'react'
import type { AudioCue, BasicsProgressData, BasicsService, FoundationService, SkillKey, WordUnit } from '@/shared/services'
import type { Speak } from '@/shared/ui/quiz/speech'
import { TeachOverlay } from './TeachOverlay'

export type FoundationStepGateProps = {
  word: WordUnit
  skill: SkillKey
  data: Readonly<BasicsProgressData>
  foundation: FoundationService
  basics: BasicsService
  speak: Speak
  playSound: (cue: AudioCue) => void
  onContinue: () => void
}

export function FoundationStepGate({ word, skill, data, foundation, basics, speak, playSound, onContinue }: FoundationStepGateProps): JSX.Element | null {
  const units = skill === 'hanzi' ? [] : foundation.unitsFor(word.id, skill)
  const need = units.length > 0 ? foundation.needFor(units, data) : 'none'
  const [teaching, setTeaching] = useState(false) // soft → 点「去学」切强制 overlay
  if (need === 'none' || units.length === 0) return null
  if (need === 'mandatory' || teaching) {
    return <TeachOverlay word={word} skill={skill} units={units} basics={basics} speak={speak} playSound={playSound} onDone={onContinue} />
  }
  // soft 浮条:一步一停,可去学可跳过
  return (
    <div className="flex flex-col items-center gap-4 pt-6 text-center" data-testid="soft-bar">
      <p className="text-lg font-bold text-ink">
        这个词里有还没学过的单元,想先学一下吗?
      </p>
      <div className="flex gap-3">
        <Button size="lg" onClick={() => setTeaching(true)}>先学一下</Button>
        <Button variant="ghost" size="lg" onClick={onContinue}>直接答题</Button>
      </div>
    </div>
  )
}
```

> `units` 文案若需具体声母名,可拼接「如 p」;MVP 保持泛化中文,避免长词溢出。

- [ ] **Step 6: `App.tsx` 组装注入**

`App.tsx`:
1. import `FoundationService`/`BasicsService`/`SpeechService`/`AudioService` token 与 `FoundationStepGate`(`@/features/foundation`)。
2. `useService` 取 4 服务;`const basicsSnap = useServiceSnapshot(basics)`。
3. 登录 effect 内补 `void basics.load()`(与 progress/settings.load 并列)。
4. `const data = basicsSnap.data ?? {}`(ready 前兜底,`LoadState` ready 前 `data` 为 undefined);`const stepGate = useMemo(() => ({ judge: (w: WordUnit, s: SkillKey) => s !== 'hanzi' && foundation.needFor(foundation.unitsFor(w.id, s), data) !== 'none', render: (ctx: { word: WordUnit; skill: SkillKey; cont: () => void }) => <FoundationStepGate key={`${ctx.word.id}-${ctx.skill}`} word={ctx.word} skill={ctx.skill} data={data} foundation={foundation} basics={basics} speak={speech.speak} playSound={audio.play} onContinue={ctx.cont} /> }), [foundation, basics, data, speech, audio])`。`useMemo` 依赖含 `data`(快照每变 → 重建 → judge 用最新熟度)。
5. lesson 分支 `<LessonEntry ... stepGate={stepGate} />`;settings/home 分支不传。
6. `data = basicsSnap.data ?? {}` 已覆盖未 ready 竞态:登录即进词课的瞬间熟度当空表,judge 会按「未评估→mandatory」走(符合 spec:无 basics 行 = learning 且未教 → 首次强制)。App 层不额外加锁,首词首步补教一次即收敛。

- [ ] **Step 7: 全量回归**

Run: `npx vitest run src/features/lesson/WordLesson.test.tsx src/features/foundation/FoundationStepGate.test.tsx && npm test && npm run build`
Expected: PASS(architecture:WordLesson 不新增 import;LessonEntry 只加类型;App 引 foundation 组件 = app 组装层合法)。

- [ ] **Step 8: Commit**

```bash
git add src/features/lesson/WordLesson.tsx src/features/lesson/LessonEntry.tsx src/features/lesson/WordLesson.test.tsx src/features/lesson/index.ts src/features/foundation/FoundationStepGate.tsx src/features/foundation/FoundationStepGate.test.tsx src/app/App.tsx
git commit -m "feat(foundation): 词课步前教学门(stepGate 槽 + FoundationStepGate + app 组装)"
```

---

### Task 5: 冷启动诊断向导(探针 + 基线写入 + app 接入)

**Files:**
- Create: `src/features/foundation/coldstart.ts`(探针常量 + `buildDiagnosisRows` 纯函数)+ `coldstart.test.ts`
- Create: `src/features/foundation/ColdStartWizard.tsx`
- Test: `src/features/foundation/ColdStartWizard.test.tsx`
- Modify: `src/features/foundation/index.ts`
- Modify: `src/app/App.tsx`(触发 + 挂载)

**Interfaces:**
- Consumes: `SettingsService` snapshot(`enablePinyin`/`enableEnglish`)、`BasicsService`、catalogs(全轨单元枚举)、`questionForUnit`/`TeachQuestion`(Task 2)、`WordUnit` 无需(诊断不涉词)。
- Produces:
  - `coldstart.ts`:
    ```ts
    export const COLDSTART_PROBES: Record<'pinyin' | 'english', string[]> // 探针单元(每轨 ≤3)
    export function buildDiagnosisRows(
      answers: ReadonlyArray<{ track: 'pinyin' | 'english'; unitKey: string; correct: boolean }>,
    ): BasicsProgressRow[]
    ```
    规则(等价 spec §7.1 三档,一条实现):对**有作答的轨**逐轨:该轨探针**全对** → 轨内全部目录单元 `known`;否则 → 探针答对单元 `known`、轨内其余全部目录单元 `learning`(含答错与未考;零对 ⇒ 整轨 learning)。`taughtCount` 全 0;`correctStreak` known=2/learning=0;`updatedAt` now。
  - `ColdStartWizard.tsx`:
    ```ts
    export type ColdStartWizardProps = {
      settings: UserSettings                  // 家长启用的轨才抽题
      basics: BasicsService
      speak: Speak
      playSound: (cue: AudioCue) => void
      onClose: () => void                     // 完成(已写基线)或中途退出(未写)都调
    }
    export function ColdStartWizard(props: ColdStartWizardProps): JSX.Element
    ```
- 语义(spec §7.1):0 星、不进群岛;逐题一次作答机会(答对 `recordAnswer(unit,true)`,答错 `recordAnswer(unit,false)`);结束按 `buildDiagnosisRows` 全轨 `saveAll`;中途「跳过/退出」不写任何行;家长关闭的轨不抽也不写;UI 文案中文「魔法入门小测」。

- [ ] **Step 1: 写 `coldstart.ts` 纯函数失败测试**

`coldstart.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildDiagnosisRows, COLDSTART_PROBES } from './coldstart'

describe('coldstart', () => {
  it('探针组含 pinyin 声母/韵母/声调代表 + english 字母', () => {
    expect(COLDSTART_PROBES.pinyin).toHaveLength(3)
    expect(COLDSTART_PROBES.pinyin[0]).toMatch(/^pinyin:/)
    expect(COLDSTART_PROBES.english).toHaveLength(3)
  })

  it('探针全对 → 该轨全单元 known(高阶自动全跳)', () => {
    const rows = buildDiagnosisRows(COLDSTART_PROBES.pinyin.map((u) => ({ track: 'pinyin' as const, unitKey: u, correct: true })))
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((r) => r.state === 'known')).toBe(true)
    expect(rows.every((r) => r.taughtCount === 0)).toBe(true)
  })

  it('部分对 → 答对 known、其余(含未考)learning', () => {
    const rows = buildDiagnosisRows([{ track: 'pinyin' as const, unitKey: 'pinyin:b', correct: true }, { track: 'pinyin' as const, unitKey: 'pinyin:ing', correct: false }, { track: 'pinyin' as const, unitKey: 'pinyin:ton1', correct: false }])
    expect(rows.find((r) => r.unitKey === 'pinyin:b')?.state).toBe('known')
    const rest = rows.filter((r) => r.unitKey !== 'pinyin:b')
    expect(rest.every((r) => r.state === 'learning')).toBe(true)
  })

  it('零对 → 整轨 learning;未作答轨不产出行', () => {
    const rows = buildDiagnosisRows([{ track: 'english' as const, unitKey: 'english:a', correct: false }])
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((r) => r.unitKey.startsWith('english:') && r.state === 'learning')).toBe(true) // 全 english:learning,无 pinyin: 行
    expect(rows.some((r) => r.unitKey.startsWith('pinyin:'))).toBe(false)
  })
})
```

> 「未作答轨不产出行」含在零对用例:只作答 english → pinyin 轨无行。实现以 `track === 'english'` 过滤断言即可(上例 `rows` 全为 english:learning,再断言无 `pinyin:` 前缀行)。

- [ ] **Step 2: 运行确认失败 → 实现 `coldstart.ts`**

Run: `npx vitest run src/features/foundation/coldstart.test.ts`
Expected: 先 FAIL 后 PASS。

实现要点:轨内单元全枚举 = `PINYIN_INITIALS ∪ PINYIN_FINALS ∪ PINYIN_TONES`(unitKey 前缀 `pinyin:`)/ `ENGLISH_LETTERS`(`english:`)。known 行 `correctStreak: 2`,learning 行 `correctStreak: 0`,全行 `taughtCount: 0`,`updatedAt: new Date().toISOString()`。rows 顺序按目录序(测试勿依赖顺序,或实现里先 init/韵/调/字排序)。answer 命中 check 用 Set。

- [ ] **Step 3: 写 `ColdStartWizard` 渲染 + 流程测试**

`ColdStartWizard.test.tsx`(fake basics 直录;逐题用按钮文本驱动):

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { BasicsService, UserSettings } from '@/shared/services'
import { ColdStartWizard } from './ColdStartWizard'

const settings: UserSettings = { enablePinyin: true, enableHanzi: true, enableEnglish: true }
const noop = () => {}
function fakeBasics(): BasicsService {
  return { load: vi.fn(async () => {}), recordAnswer: vi.fn(async () => {}), markTaught: vi.fn(async () => {}), saveAll: vi.fn(async () => {}), subscribe: noop, getSnapshot: () => ({ status: 'ready', data: {} }) as never }
}

describe('ColdStartWizard', () => {
  afterEach(cleanup)
  it('逐题推进并答题 → 全答完 saveAll(非空)+ onClose;题干出现题干文案', async () => {
    const basics = fakeBasics()
    const onClose = vi.fn()
    render(<ColdStartWizard settings={settings} basics={basics} speak={() => true} playSound={noop} onClose={onClose} />)
    // 逐题:每道单选点第一个选项直到结束按钮出现(正确性由 recordAnswer 入参断言)
    // 循环最多 20 次点击不同/同选项按钮;结束按钮「开始游戏/完成」可命中后停止
    // 断言 saveAll 被调、onClose 被调
    expect(basics.saveAll).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })
  it('跳过/退出 → 不 saveAll,onClose', async () => {
    const basics = fakeBasics()
    const onClose = vi.fn()
    render(<ColdStartWizard settings={settings} basics={basics} speak={() => true} playSound={noop} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: /跳过|退出/ }))
    expect(basics.saveAll).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })
  it('家长关英语 → 只抽拼音段', () => {
    const basics = fakeBasics()
    render(<ColdStartWizard settings={{ ...settings, enableEnglish: false }} basics={basics} speak={() => true} playSound={noop} onClose={noop} />)
    // 英语首题题干不该出现;测试以不抛且能走完为准
  })
})
```

> 题目正确性较难在 wizard 层逐题断言(题面 shuffle 随机);改用:**`recordAnswer` 总被调、调用次数 = 题数、saveAll 收到 buildDiagnosisRows 形状 rows**。题内 target 正确性已由 teach-questions 单测覆盖。Wizard 测试可用 mock `Math.random` 或接受任意点击走完。

- [ ] **Step 4: 运行确认失败 → 实现 `ColdStartWizard.tsx`**

Run: `npx vitest run src/features/foundation/ColdStartWizard.test.tsx`
Expected: 先 FAIL 后 PASS。

组件规格:
1. Props 如 Interfaces。`tracks = ['pinyin' as const]`(settings.enablePinyin)+ `['english']`(enableEnglish);题队列 = 各启轨探针 flatten(`questionForUnit(probe)`;`null` 跳过)。
2. phase:`'intro' → 'question' → 'done'`;当前题索引;顶部进度点(总题数)+ 右上「跳过」按钮。
3. intro:「魔法入门小测」标题 + 说明「猜一猜、点一点,帮你找到最合适的学习起点」+ 按钮「开始」;0 星说明不出现(0 分概念对儿童隐去)。
4. question:渲染 `TeachQuestion`(与 Task 3 相同 Choice/ListenChoice 用法,speak/playSound 注入);一次作答:`handle(id)`:对/错 → `playSound` + `void basics.recordAnswer(probe, correct).catch(() => {})`,短暂停顿(650ms)自动下一题;末题 → done。
5. done:夸奖(「真棒!小测完成,开始你的魔法旅程吧!」)+ 按钮「开始游戏」:先算 `answers = 采集(probe, correct)` → `rows = buildDiagnosisRows(answers)` → `void basics.saveAll(rows).catch(() => {})` → `onClose()`。
6. 中途「跳过/退出」→ 直接 `onClose()`(不写行)。UI 全中文。

- [ ] **Step 5: `App.tsx` 触发 + 挂载**

`App.tsx`:
1. `useService(SettingsService)` 已有 `settingsService`;补 `useServiceSnapshot(settingsService)`(若已取 `settingsSnap` 则复用)+ `const [showDiagnosis, setShowDiagnosis] = useState(false)`。
2. 触发 effect:当 `authSnap.status === 'authenticated'` 且 progress 与 basics 与 settings 均 ready(用各 snapshot.status)、`progress 数据无行`(progressSnap 内无任何已完成/行)且 `basics 无行`(`Object.keys(basicsSnap.data ?? {}).length === 0`)且 `!showDiagnosis` → `setShowDiagnosis(true)`。**老用户(progress 有行)不触发**(spec §7.1)。guard 用 ref 防重复置位。
3. 渲染分流(在 lesson/settings 分支**之前**):`authSnap authenticated && showDiagnosis` → `content = <ColdStartWizard settings={settingsSnap.data} basics={basics} speak={speech.speak} playSound={audio.play} onClose={() => setShowDiagnosis(false)} />`。`onClose` 后回到群岛(home 分支照常)。再次触发条件因 `showDiagnosis` 已 true 不再置位;整 app 重开(零进度)会再弹(符合 spec「零进度再触发」)。
4. `basics.load()` 已在 Task 4 登录 effect 补;此处触发依赖其 ready。

- [ ] **Step 6: 全量回归**

Run: `npx vitest run src/features/foundation/coldstart.test.ts src/features/foundation/ColdStartWizard.test.tsx && npm test && npm run build`
Expected: PASS(App.test.tsx 若因新诊断分支红,补测:mock 空进度 + basics 空 → 出现小测;老用户有行 → 不出现,直达群岛)。

- [ ] **Step 7: Commit**

```bash
git add src/features/foundation/coldstart.ts src/features/foundation/coldstart.test.ts src/features/foundation/ColdStartWizard.tsx src/features/foundation/ColdStartWizard.test.tsx src/features/foundation/index.ts src/app/App.tsx
git commit -m "feat(foundation): 冷启动诊断向导(探针短测 + 基线写入 + app 接入)"
```

---

### Task 6: 收口回归(全量测试 / lint / build / 迁移复验)

**Files:**
- (无源码改动,仅验证;如有散落改动一并清理提交)

- [ ] **Step 1: 全量测试**

Run: `npm test`
Expected: PASS(含 architecture:features/foundation 未 import 其它 feature;shared/ui/quiz 未 import 上层;WordLesson/LessonEntry 未新增违规 import;`useService` 纪律)。

- [ ] **Step 2: Lint + 构建**

Run: `npm run lint && npm run build`
Expected: 无告警/错误(tsc 覆盖 worker 与 src)。

- [ ] **Step 3: 迁移复验(可选,若本 plan 未动迁移则跳)**

本 plan 无新迁移;0003 已验。跑 `npm run db:local` 确认幂等(不重跑)。

- [ ] **Step 4: 提交收口**

```bash
git add -A
git commit -m "chore(foundation): embed plan 收口回归" || true
```

---

## Self-Review 备注(供控制器自查)

- spec §9(quiz 迁移)= Task 1;§8(短教三步 + 微出题)= Task 2+3;§7.2(词课插入 + soft 浮条 + 强制)= Task 4;§7.1(冷启动诊断 + 基线三档)= Task 5;§11 测试 + §12 兼容 = 各任务测试 + Task 6。
- 开放裁决记录:
  1. **插入不破 feature 边界**:lesson 只加无认知 `stepGate` 槽,foundation 组件由 app 组装注入(architecture 唯一合法通道)。spec §7.2「LessonEntry 问 foundation」按铁律解释为「app 组装层问」—— 记录为 Ruling。
  2. **韵母目录维持 34 实测全集**不加方案死项(`er`/`uai` 等词库未现),教学只触词库拆出单元;未来加词由 decompose 抛错驱动补目录(plan A 既定 gate)。spec §4.1「39 全量」落为「词库归口全集 + 拆解校验」,记录为 Ruling。
  3. **轻测题数**:spec §8「2 题」按词单元数伸缩(`units.slice(0,3)` 逐单元 1 题,1-3 题),短词约 2 题,长词不超 3 题防疲劳。
  4. **诊断触发竞态**:`basicsSnap.data ?? {}` 兜底未 ready;`showDiagnosis` 内存守卫避免重复置位。
