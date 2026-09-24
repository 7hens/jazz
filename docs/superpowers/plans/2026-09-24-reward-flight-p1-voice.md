# 奖励层归属动作 · 期 1(一档一音 + 幸运自己的撒花档)实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让奖励层的每一档**既撒花也出声** —— 把「声音」与「撒花」绑进同一个调用里,从结构上消灭「声明了没人接」这一类静默失效;并给幸运补上它自己的撒花档。

**Architecture:** 三层骨架不动。`shared/` 把两个 union 从**手写类型**改成**由运行期数组派生**(`AUDIO_CUES` / `CELEBRATE_LEVELS`),并新增一张 `CELEBRATE_CUE: Record<CelebrateLevel, AudioCue>` 映射表;`features/audio` 的分派从 `if / else` 链改成 `Record<AudioCue, …>`,**取消无条件 `else` 兜底**;`features/celebrate` 的实现多收一个 `playCue` 回调,**一个 `play(level)` = 撒花 + 声音**;`app/bootstrap.ts` 把 audio 实例的 `play` 注进去。调用点(`LevelEntry` / `AchievementPopup`)**零改** —— 它们本来就只调 `celebrate.play(tier)`。

**Tech Stack:** React 19 + TS + Vite + Tailwind 4 + motion;canvas-confetti;Web Audio(裸 `AudioContext`,无新依赖);vitest(jsdom)+ @testing-library/react;oxlint。

**Spec:** `docs/superpowers/specs/2026-09-24-reward-flight-design.md`(§3.1 / §3.6 / §10 期 1)

**基点:** 本支 `feat/reward-flight` 叠在 `feat/effects-textless` 尖端上 —— 动手前确认 `git rev-parse HEAD` = `88d2410`(或其后继)。

## Global Constraints

- **不变量(spec §2)**:本计划**一个字不加**到孩子面。新增的全部是**声音**与**一份撒花档** —— 没有新文案、没有新图标、没有新布局。**跑完必须复跑 2026-09-23 支留下的两条零文本守卫**(地图 / 两个弹层的零汉字扫描 + 关卡页「直接文本含汉字的元素恰好一个」),不许假定「我没加字」。
- **红线**:`wrangler` 命令一律显式 `--config wrangler.toml`;禁止 `[env.production]`;禁截图 / 读图检查 UI;不 push / 不 merge / 不 tag / 不 deploy / 不 `npm version`。本计划**不含**任何数据库或 worker 改动(零迁移、零新列)。
- **开工前先装依赖**:本工作树是新 worktree,**没有 `node_modules`** —— 第一件事是 `npm install`。装完先跑一次三闸把**基线**跑出来,再动手。
- **不写死计数**:本计划**不写**「一共多少条测试」这类数(本仓已具名:写死的计数会静默变假)。`npm test` 的**基线以你当场跑出来的为准**;`npm run lint` 的基线是**恰好 2 条** warning,位置 `src/shared/ui/import-alias.test.ts:5:51` 与 `src/shared/ui/button.tsx:46:18`,**多一条少一条都要报告**。
- **还原注入**:任何变异验证必须用 `/tmp` 快照 → `cp` 回 → `md5sum -c`。**禁止 `git checkout -- <file>` / `git restore`** 任何有未提交改动的文件(本仓已有实现者据此回滚掉自己未提交改动的先例)。
- **每条新断言都要能被一次具名注入弄红**,且**注入配方先跑、后印** —— 印出来的结果必须与你真跑的一致。**恒真的判据不算判据**。
- **改用户可见行为 ⇒ 同一个提交里更新 `docs/walkthrough.md`**:本计划动了「响不响」「撒不撒」两件事 ⇒ Task 4 与它同批。**新增的走查行必须一条只判一件事**(该文件 §A 第 4 条)—— 既有的 `W-L4` 已经是超载行(3 件,见 `docs/PLAN.md` 想法池),**不许再往它上面加**。
- **本计划里的行号是写计划那一刻的快照** —— 一律**以引用的原文 / 符号名**定位;原文找不到就报告,不要按行号硬改。
- **边界纪律**:`features/<f>/` 之间禁编译期互引;`useService()` 只在 `features/<f>/<Name>Entry.tsx` 与 `app/`;注册只在 `app/bootstrap.ts`。测试文件不受该边界管辖。
- **提交信息**:结尾带 `Co-Authored-By: Claude Code <noreply@anthropic.com>`。

---

### Task 1: `AudioCue` 改为运行期清单 + 分派改成穷举(取消 `else` 兜底)

**Files:**
- Modify: `src/shared/services/audio.ts`
- Modify: `src/shared/services/index.ts`
- Modify: `src/features/audio/audio.ts`
- Modify: `src/features/audio/audio.test.ts`

**Interfaces:**
- Produces: `AUDIO_CUES: readonly AudioCue[]`(`@/shared/services`)—— Task 2 的 `CELEBRATE_CUE` 与 Task 1 自己的守卫都用它。
- Produces: `AudioCue = 'correct' | 'wrong' | 'streak' | 'victory' | 'tap' | 'achievement' | 'lucky'`(由 `AUDIO_CUES` 派生,值集不变的部分**逐字保持**)。

**为什么要动类型**:今天的 `AudioCue` 是手写 union,而 `audio.ts` 的 `play` 末支是**无条件 `else`**:

```
} else {
  tone(440, 0, 0.08, 'triangle', 0.18)   // ← = 'tap' 的音
}
```

⇒ 往 union 加一个值、忘了实现它,**编译器不报错、lint 不报错、运行静默播成「嗒」**。这与 2026-09-23 支记的「四档撒花声明了没人调」是同一族静默失效。本任务新增两个 cue,故先把这个洞堵上。

- [ ] **Step 1: 把 `AudioCue` 改成由运行期数组派生**

`src/shared/services/audio.ts` 的**第一行 import 之后**,把那行手写 union 换成:

```ts
/**
 * 音效清单。**运行期数组是唯一事实源**,`AudioCue` 由它派生。
 *
 * 为什么不是纯类型:`features/audio/audio.ts` 的分派表是 `Record<AudioCue, …>`,
 * 数组派生让「有哪些 cue」与「每个 cue 怎么响」两件事能在一处对账(见该文件的键集守卫)。
 * 原先是手写 union + 分派链末支无条件 `else`(`= 'tap'`)⇒ 加一个值而忘了实现它
 * **编译期无人报错、运行静默播成「嗒」** —— 本仓具名的静默失效族。
 */
export const AUDIO_CUES = ['correct', 'wrong', 'streak', 'victory', 'tap', 'achievement', 'lucky'] as const

export type AudioCue = (typeof AUDIO_CUES)[number]
```

**顺序要求**:数组里前五项**逐字保持**为 `'correct', 'wrong', 'streak', 'victory', 'tap'`(旧 union 的原文顺序),两个新值追加在末尾 —— 这样这份改动的 diff 是**纯追加**。

同一提交里,`src/shared/services/index.ts` 在 `export type { AudioCue } from './audio'` 那一行**下面**加一行 value 导出(它是 value,不是 type,不能并进上面那行):

```ts
export { AUDIO_CUES } from './audio'
```

`src/features/audio/audio.test.ts` 的 import 也要加(现有那行是 `import { createAudioService, SOUND_KEY } from './audio'`):

```ts
import { AUDIO_CUES } from '@/shared/services'
```

- [ ] **Step 2: 跑一次确认没红**

```bash
npx tsc -b && npx vitest run src/features/audio src/features/celebrate
```

Expected: **`npx tsc -b` 会红(TS6133)**,`npx vitest` 那一半全过 —— 两半**预期不同**。红的是 Step 1 加的 `import { AUDIO_CUES }` 还没有消费点,`noUnusedLocals` 判它未使用。消费它的守卫在 Step 4,一到即消。
vitest 那半全过是对的:此时 `AudioCue` 多了两个值,但 `play` 还没实现它们 —— **这一条现在不该红**,因为分派链有 `else` 兜底。这正是要修的洞,Step 3 立它。

> **实施时更正(2026-09-24,收盘时):** 原文此处的 Expected 写的是「全过」,**那是假的** —— `tsc` 那一半在这个时点必红(实施者实测确认)。**做法不变**(这半红是中间态、Step 4 一到即消),只把预期输出改准:假话留在 plan 上,下一个人会照着它判断「我是不是做错了」。

- [ ] **Step 3: 分派改成 `Record<AudioCue, () => void>`,删掉 `else`**

`src/features/audio/audio.ts` 里,把 `function play(cue: AudioCue) { … }` 整段(那条 `if / else if / … / else` 链)**替换**为:在 `function play` **之前**加一张表,`play` 只查表。

```ts
  // 一音一表:每个 cue 一格,没有兜底分支。加 cue 而漏了这里 = `Record<AudioCue, …>`
  // 在编译期就报错 —— 这是把「静默播成 'tap'」那个洞从类型层堵死的那一半。
  const TONES: Record<AudioCue, () => void> = {
    correct: () => {
      tone(523, 0, 0.15)
      tone(659, 0.08, 0.18)
    },
    streak: () => {
      tone(523, 0, 0.1)
      tone(659, 0.07, 0.1)
      tone(784, 0.14, 0.2)
    },
    wrong: () => {
      tone(330, 0, 0.3, 'square', 0.22)
    },
    victory: () => {
      tone(523, 0, 0.15, 'sine', 0.3)
      tone(659, 0.12, 0.15, 'sine', 0.3)
      tone(784, 0.24, 0.15, 'sine', 0.3)
      tone(1046, 0.36, 0.4, 'sine', 0.3)
    },
    tap: () => {
      tone(440, 0, 0.08, 'triangle', 0.18)
    },
    // 成就:四音上行收在高位,比 victory 短、比 correct 亮 ——
    // 「又收了一枚」,不是「赢了」。
    achievement: () => {
      tone(659, 0, 0.12)
      tone(784, 0.1, 0.12)
      tone(988, 0.2, 0.12)
      tone(1319, 0.3, 0.3)
    },
    // 幸运:两声三角波,纯五度跳进(A5 → E6)。与成就那串正弦琶音在**音色**上就分得开。
    lucky: () => {
      tone(880, 0, 0.12, 'triangle', 0.26)
      tone(1320, 0.12, 0.28, 'triangle', 0.26)
    },
  }

  function play(cue: AudioCue) {
    if (!soundOn) return
    TONES[cue]()
  }
```

**不许留 `else`、不许留 `?? TONES.tap`** —— 留任何一个,这个任务就白做了。

- [ ] **Step 4: 把测试里的音色表提出来,并加两条守卫**

`src/features/audio/audio.test.ts`:把 `it.each([...])` 里那份内联表格**提成模块级常量**(内容不动,只加两行),然后让 `it.each` 用它:

```ts
// 每个 cue 的**精确**频率 / 波形 / 起止时刻。逐值写死,因为「听起来对不对」是本文件
// 唯一能自动判的那部分;剩余(音量、音色好不好听)归人耳。
const TONE_CASES = [
  ['correct', [[523, 'sine', 10, 10.2], [659, 'sine', 10.08, 10.31]]],
  ['streak', [[523, 'sine', 10, 10.15], [659, 'sine', 10.07, 10.22], [784, 'sine', 10.14, 10.39]]],
  ['wrong', [[330, 'square', 10, 10.35]]],
  ['victory', [[523, 'sine', 10, 10.2], [659, 'sine', 10.12, 10.32], [784, 'sine', 10.24, 10.44], [1046, 'sine', 10.36, 10.81]]],
  ['tap', [[440, 'triangle', 10, 10.13]]],
  ['achievement', [[659, 'sine', 10, 10.17], [784, 'sine', 10.1, 10.27], [988, 'sine', 10.2, 10.37], [1319, 'sine', 10.3, 10.65]]],
  ['lucky', [[880, 'triangle', 10, 10.17], [1320, 'triangle', 10.12, 10.45]]],
] as const
```

(桩的 `currentTime` 是 `10`;`stop` 的算法是 `start + duration + 0.05`,`stop` 的既有四行**一个数都不要动** —— 改它们说明你把实现改坏了。)

在原 `it.each` 用例**之后**追加两条:

```ts
  // 这两条合起来才拦得住「加了一个 cue 而它响的是别的东西」:
  // 上面那张表是**手写的**,把 achievement 的期望值抄成 tap 的、实现也抄成 tap 的,
  // 逐个用例照样全绿 —— 所以还要断「每一格都各自不同」。
  it('音色表的覆盖面 === AUDIO_CUES(加 cue 必须同时给期望值)', () => {
    expect(TONE_CASES.map(([cue]) => cue)).toEqual([...AUDIO_CUES])
  })

  it('每一档响的都是自己那串音,没有两档共用同一串', () => {
    const { context, tones } = runningContext()
    const service = createAudioService({
      storage: storage(),
      createContext: () => context as unknown as AudioContext,
      eventTarget: null,
    })

    const shapes = AUDIO_CUES.map((cue) => {
      tones.length = 0
      service.play(cue)
      return `${cue}:${tones.map(t => t.frequency.value).join(',')}`
    })

    const frequencies = shapes.map(shape => shape.split(':')[1])
    expect(new Set(frequencies).size, '有两个 cue 响的是同一串音 —— 孩子分不出它们是两件事').toBe(AUDIO_CUES.length)
  })
```

- [ ] **Step 5: 跑测试**

```bash
npx vitest run src/features/audio
```

Expected: 全过。**若「音色表覆盖面」这条红了**,那是 `TONE_CASES` 少了一行;若「每一档各自不同」红了,那是 `TONES` 里有抄错的一格。

- [ ] **Step 6: 逐条做反例注入(每条都要真弄红,再逐字节还原)**

```bash
cp src/features/audio/audio.ts /tmp/audio.ts.bak && md5sum src/features/audio/audio.ts
```

1. **删掉 `TONES` 里的 `achievement` 那一格** → `npx tsc -b` **必须报错**(缺 `Record<AudioCue, …>` 的一格)。这是「编译期那一半」的证明。
2. 还原后,**把 `achievement` 那格的内容整段换成 `tap` 那格的内容** → 「每一档各自不同」那条**必须红**(而逐个用例那条仍绿 —— 这正是它存在的理由)。
3. 还原后,**删掉 `TONE_CASES` 里 `lucky` 那一行** → 「音色表覆盖面」那条**必须红**。

每条之后:

```bash
cp /tmp/audio.ts.bak src/features/audio/audio.ts && md5sum -c <(md5sum src/features/audio/audio.ts)
```

(或直接 `md5sum` 两边比 —— 判据是**字节一致**,不是「看着像回来了」。)

- [ ] **Step 7: 提交**

```bash
git add src/shared/services/audio.ts src/shared/services/index.ts src/features/audio/audio.ts src/features/audio/audio.test.ts
git commit -m "feat(audio): AudioCue 改运行期清单 + 分派改穷举,堵掉『未知 cue 静默播 tap』" -m "
新增 'achievement' / 'lucky' 两个 cue;分派从 if/else 链改成 Record<AudioCue,…>,
取消无条件 else 兜底 —— 加 cue 而漏实现现在在 tsc 就红。
两条新守卫互补:音色表覆盖面(手写表必须覆盖全量)+ 每档各自不同(拦住抄别档的音)。

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: `CelebrateLevel` 加 `'lucky'` + 档→音映射表 + 声音下沉进 celebrate 实现

**Files:**
- Modify: `src/shared/services/celebrate.ts`
- Modify: `src/shared/services/index.ts`
- Modify: `src/features/celebrate/celebrate.ts`
- Modify: `src/features/celebrate/celebrate.test.ts`

**Interfaces:**
- Consumes: `AudioCue` / `AUDIO_CUES`(Task 1)。
- Produces: `CELEBRATE_LEVELS: readonly CelebrateLevel[]`、`CELEBRATE_CUE: Record<CelebrateLevel, AudioCue>`(`@/shared/services`)。
- Produces: `createCelebrateService(playConfetti?: Confetti | null, playCue?: ((cue: AudioCue) => void) | null)` —— Task 3 的 bootstrap 用第二参。

**为什么放在 `shared/`**:`LevelEntry` 在 `features/pinyin-blocks`,要是从 `features/combo` 引这张表就是**跨 feature 编译期互引**(`architecture.test.ts` 守的边界)。`shared/services/celebrate.ts` 已经在放 `celebrationFor` 这个纯函数,是它该在的地方。

- [ ] **Step 1: `shared/services/celebrate.ts` 加清单与映射表**

在现有 `import type { ServiceToken } from './core'` 之后加一行 `import type { AudioCue } from './audio'`,并把 `export type CelebrateLevel = 'combo5' | 'word' | 'combo10' | 'achievement'` 换成:

```ts
export const CELEBRATE_LEVELS = ['combo5', 'word', 'combo10', 'achievement', 'lucky'] as const

export type CelebrateLevel = (typeof CELEBRATE_LEVELS)[number]

/**
 * 档 → 声音。**一档一音,同一件事的两个量级共用一串音**:
 * `combo5` / `combo10` 都是 `streak` —— 差别在撒花规模(30 vs 150 粒),
 * 不在音高。再开第三个连击 cue 对孩子只是噪声(同 2026-09-23 spec §3.3「不设第三连击档」)。
 *
 * `word` 那一格用 `'correct'`:`'correct'` 的语义是「对了」,从单块升到整关是一次
 * **语义扩张**,不是新造一个词 —— 换掉的是它「生产零调用点」那个登记面
 * (登记见 `docs/dev-reference.md`)。**这是一次有意的取舍,不是巧合**:
 * 再开一个 `settle` 之类的 cue 会让音效表继续长大,而 4–8 岁要分辨的音越少越好。
 */
export const CELEBRATE_CUE: Record<CelebrateLevel, AudioCue> = {
  combo5: 'streak',
  combo10: 'streak',
  word: 'correct',
  achievement: 'achievement',
  lucky: 'lucky',
}
```

`celebrationFor` **一个字不动**。注意它的注释里那句「三个连击档对孩子只是噪声」仍然为真(现在有 5 档,但连击仍只有 2 档)—— 别顺手改它。

同时 `shared/services/index.ts` 的这两行:

```ts
export type { CelebrateLevel } from './celebrate'
export { CelebrateService, celebrationFor } from './celebrate'
```

改成:

```ts
export type { CelebrateLevel } from './celebrate'
export { CELEBRATE_CUE, CELEBRATE_LEVELS, CelebrateService, celebrationFor } from './celebrate'
```

(`export { AUDIO_CUES }` 那一行已在 Task 1 加过,**本步不重复加**。)

- [ ] **Step 2: `features/celebrate/celebrate.ts` 加第二参、加 `lucky` 档**

```ts
import confetti from 'canvas-confetti'
import { CELEBRATE_CUE, type AudioCue, type CelebrateLevel, type CelebrateService } from '@/shared/services'

type Confetti = (options: confetti.Options) => unknown
type Cue = (cue: AudioCue) => void

// 档位即撒花规模。`combo5` 这一档是「放对一块就撒花」的替代 ——
// 一关要落好几块,每块都撒孩子很快就不看了;单块放对**已有**反馈:槽位填色 +
// **落块音效**那一档(`'tap'`,出处 `PinyinBlocksGame.tsx` 的 `placeBlock`)。
// 不写死块数:落块次数 = 该关槽位数、托盘块数另算,任何写死的乘积都会随关卡增删变假。
// `lucky` 夹在 `combo5` 与 `word` 之间:幸运是白捡的,规模不该压过关卡本身。
const CONFIGS: Record<CelebrateLevel, confetti.Options> = {
  combo5: { particleCount: 30, spread: 50 },
  word: { particleCount: 100, spread: 80, origin: { y: 0.6 } },
  combo10: { particleCount: 150, spread: 90 },
  achievement: { particleCount: 200, spread: 120 },
  lucky: { particleCount: 60, spread: 70 },
}

/**
 * `playCue` 是本设计(2026-09-24)加的第二个面。
 *
 * **一个 `play(level)` = 撒花 + 声音**,是刻意的:2026-09-23 那支的「四档声明了没人调」
 * 与 2026-09-24 盘点出的「四档全静音」是同一个成因 —— 两个面分处两地、靠人记得都接。
 * 沉进这里之后,调用点只调一次,结构上不可能只做一半。
 */
export function createCelebrateService(
  playConfetti: Confetti | null = confetti,
  playCue: Cue | null = null,
): CelebrateService {
  return {
    play(level) {
      if (typeof playCue === 'function') playCue(CELEBRATE_CUE[level])
      if (typeof playConfetti !== 'function') return
      void playConfetti(CONFIGS[level])
    },
  }
}
```

> **`celebrate.ts` 原注释里那句「`AudioCue` 里虽有 `'correct'`,但它今天**生产零调用点**」必须一并删掉** —— 本次改动**当场把它变成假话**。这是本仓最贵的复发位(修复即新面),不许留给下一个人发现。
>
> **同一段里另外两处也删掉,而且这是有意的、要写进提交信息的**:该注释末段原有一句「(原注释写的「一关 15 块 × 30 粒 = 撒 15 次」与「correct 音效」两处都是假的:实测落块最多 **8** 次、最大托盘 **12** 块)」。那两个数属**本仓明令不写的那一类**(依赖关卡 / 托盘数据、随增删静默变假,且手里没有一条能重跑出它们的命令);它们在这里的全部作用只是为**一个早已被删掉的旧数字**作证。**这是本计划对已交付文字的第三处改动(前两处是 C5 / C6),不是顺手清理 —— 若你认为该留,唯一正当的留法是把它降级成指针(指向 `levels.ts`),而不是留两个会静默变假的数。**

- [ ] **Step 3: 改 `celebrate.test.ts`(加 `lucky` + 两条新守卫)**

第一条用例里的四次 `service.play(...)` 改为**遍历清单**,并补一条 cue 守卫:

```ts
import { describe, expect, it, vi } from 'vitest'
import { CELEBRATE_CUE, CELEBRATE_LEVELS, celebrationFor } from '@/shared/services'
import { createCelebrateService } from './celebrate'

describe('CelebrateService', () => {
  it('每一档都有撒花配置,数值逐个钉住', () => {
    const confetti = vi.fn()
    const service = createCelebrateService(confetti)

    CELEBRATE_LEVELS.forEach(level => service.play(level))

    expect(confetti.mock.calls.map(([options]) => options)).toEqual([
      { particleCount: 30, spread: 50 },
      { particleCount: 100, spread: 80, origin: { y: 0.6 } },
      { particleCount: 150, spread: 90 },
      { particleCount: 200, spread: 120 },
      { particleCount: 60, spread: 70 },
    ])
    expect(confetti.mock.calls).toHaveLength(CELEBRATE_LEVELS.length)
  })

  it('每一档都发出它那一档的声音(档→音表覆盖全量)', () => {
    const cue = vi.fn()
    const service = createCelebrateService(null, cue)

    CELEBRATE_LEVELS.forEach(level => service.play(level))

    expect(cue.mock.calls.map(([c]) => c)).toEqual(CELEBRATE_LEVELS.map(level => CELEBRATE_CUE[level]))
  })

  it('没有撒花 / 没有声音回调时各自静默,互不牵连', () => {
    expect(() => createCelebrateService(null, null).play('word')).not.toThrow()
    const confetti = vi.fn()
    expect(() => createCelebrateService(confetti, null).play('lucky')).not.toThrow()
    expect(confetti).toHaveBeenCalledOnce()
  })
})
```

第二条 `describe`(`celebrationFor`)与 `silently falls back` 那条**内容不动**。

> 旧的 `confetti.mock.calls` 期望数组是**手写四行**;改成 `forEach(CELEBRATE_LEVELS)` 之后,「加一档忘了加配置」会让 `toHaveLength` 当场红 —— 而手写四行那种写法**不会**。

- [ ] **Step 4: 跑测试**

```bash
npx tsc -b && npx vitest run src/features/celebrate src/features/audio
```

Expected: 全过。

- [ ] **Step 5: 反例注入(每条真弄红 + 逐字节还原)**

```bash
cp src/features/celebrate/celebrate.ts /tmp/celebrate.ts.bak
cp src/shared/services/celebrate.ts /tmp/sc.ts.bak
```

1. 从 `CONFIGS` 删掉 `lucky` 那一行 → `npx tsc -b` **必须报错**(`Record<CelebrateLevel, …>` 缺格)。
2. 还原后,把 `play` 里 `playCue(...)` 那一行**注释掉** → 「每一档都发出它那一档的声音」**必须红**。
3. 还原后,把 `CELEBRATE_CUE` 的 `lucky` 改成 `'tap'` → 同上那条**必须红**(`cue.mock.calls` 与表不符)。
4. 还原后,在 `play` 里**先 return 再** `playCue` → 同上那条**必须红**。

每条之后 `cp /tmp/celebrate.ts.bak src/features/celebrate/celebrate.ts`,并 `md5sum` 两边比。

- [ ] **Step 6: 提交**

```bash
git add src/shared/services/celebrate.ts src/shared/services/index.ts src/features/celebrate/celebrate.ts src/features/celebrate/celebrate.test.ts
git commit -m "feat(celebrate): 加 lucky 档 + 档→音映射,声音下沉进实现(一个 play = 撒花 + 响)" -m "
一个 play(level) 同时发撒花与声音,调用点零改 —— 从结构上消灭『声明了没人接』。
CELEBRATE_LEVELS 由运行期数组派生,CONFIGS 缺格在 tsc 就红。
celebrate.ts 注释里『correct 生产零调用点』那句已当场删掉(本次改动使它变假)。

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: 组装层接线 + 幸运弹层自己的档

**Files:**
- Modify: `src/app/bootstrap.ts`
- Modify: `src/features/lucky-bonus/LuckyBonus.tsx`
- Modify: `src/features/lucky-bonus/LuckyBonus.test.tsx`
- Modify: `src/app/App.tsx`

**Interfaces:**
- Consumes: `createCelebrateService(playConfetti, playCue)`(Task 2)。
- Produces: `LuckyBonus` 的 `celebrate?: (level: CelebrateLevel) => void` prop(与 `AchievementPopup` 同形)。

**为什么到这里才改调用点**:`LevelEntry`(`celebrate.play(tier)` / `celebrate.play('word')`)与 `AchievementPopup`(`celebrate` 钩子由 `App.tsx:95` 传的是 `celebrateService.play`)**已经只调 `celebrate.play`** ⇒ 它们**零改**就拿到了声音。这正是 Task 2 把声音沉下去换来的东西 —— 别去它们那里再补 `audio.play`,那会把刚堵上的洞重新打开。

- [ ] **Step 1: `bootstrap.ts` 把 audio 的 `play` 注进 celebrate**

把这两行:

```ts
  registry.register(AudioService, createAudioService())
  registry.register(CelebrateService, createCelebrateService())
```

改成:

```ts
  const audio = createAudioService()
  registry.register(AudioService, audio)
  // 声音与撒花在同一个 play 里发出 —— 撒花档的响与不响不再取决于「谁记得接」。
  registry.register(CelebrateService, createCelebrateService(undefined, audio.play))
```

(`undefined` 是走第一个参数的默认值 `confetti`;`audio.play` 是闭包函数、不依赖 `this`,取出即安全。)

- [ ] **Step 2: `LuckyBonus` 加 `celebrate` 钩子**

按 `AchievementPopup.tsx` 的同一形状改:

```tsx
import { useEffect } from 'react'
import { motion } from 'motion/react'
import type { CelebrateLevel } from '@/shared/services'
import { REWARD_CARD } from '@/shared/ui/reward-card'
import { cn } from '@/shared/ui/utils'

export function LuckyBonus({
  amount,
  onDone,
  // 由组合层注入(同 AchievementPopup);不传则静默(测试 / 纯预览)。
  celebrate,
}: {
  amount: number
  onDone: () => void
  celebrate?: (level: CelebrateLevel) => void
}) {
  useEffect(() => {
    if (typeof celebrate === 'function') celebrate('lucky')
    const t = window.setTimeout(onDone, 2600)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
```

其余 JSX **一字不动**(`🍀` + `+N ⭐` + `aria-label="幸运奖励"`)。

- [ ] **Step 3: `App.tsx` 把钩子传下去**

把:

```tsx
<LuckyBonus amount={celebration.luckyReward} onDone={() => setCelebration(null)} />
```

改成:

```tsx
<LuckyBonus amount={celebration.luckyReward} celebrate={celebrateService.play} onDone={() => setCelebration(null)} />
```

- [ ] **Step 4: 补 `LuckyBonus.test.tsx` 的守卫**

在现有两条用例之后追加:

```tsx
  it('挂上 celebrate 时发的是 lucky 那一档', () => {
    const celebrate = vi.fn()
    render(<LuckyBonus amount={30} onDone={vi.fn()} celebrate={celebrate} />)
    expect(celebrate.mock.calls.map(([level]) => level)).toEqual(['lucky'])
  })

  it('不挂 celebrate 时静默,不抛', () => {
    expect(() => render(<LuckyBonus amount={30} onDone={vi.fn()} />)).not.toThrow()
  })
```

现有两条(零汉字 / 数字走 `amount`)**内容不动** —— 本计划不加任何文字,它们必须继续绿。

- [ ] **Step 5: 跑三闸**

```bash
npx tsc -b && npm test && npm run lint
```

Expected:`tsc -b` exit 0;`npm test` **全绿**(条数以你跑出来的为准);`lint` 恰好 2 条基线 warning(多一条少一条都报告)。**新用例数不写死在计划里** —— 报告里给出你跑出的数即可。

- [ ] **Step 6: 反例注入**

1. 把 `bootstrap.ts` 的 `createCelebrateService(undefined, audio.play)` 改回 `createCelebrateService()` → 跑 `npx vitest run src/features/celebrate`(**仍会全绿** —— 这条注入**不会**被单元测试发现,因为服务测试自己注入回调)。**所以这一条必须由 Task 4 的走查 + 本步的人工断言兜**:真跑 `npm run dev`,故意放错一块清连击、再连放 5 块,听有没有那一串上行三音。**没听见 = 这一行接错了。**
2. 把 `App.tsx` 的 `celebrate={celebrateService.play}` 从 `LuckyBonus` 上删掉 → 「挂上 celebrate 时发的是 lucky 那一档」**必须红**。

每条之后逐字节还原。

- [ ] **Step 7: 提交**

```bash
git add src/app/bootstrap.ts src/app/App.tsx src/features/lucky-bonus/LuckyBonus.tsx src/features/lucky-bonus/LuckyBonus.test.tsx
git commit -m "feat(app): bootstrap 注入音效 + 幸运弹层补上自己的撒花档" -m "
LuckyBonus 加 celebrate 钩子(与 AchievementPopup 同形),App 传 celebrateService.play。
LevelEntry 与 AchievementPopup 零改 —— 它们本来就只调 celebrate.play。

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: 走查条目 + 三条「被本次改动弄成假」的登记面

**Files:**
- Modify: `docs/walkthrough.md`
- Modify: `docs/dev-reference.md`(§「发音与关卡数据约定」里那段零调用点登记)
- Modify: `docs/superpowers/specs/2026-09-23-effects-textless-design.md`(§3.4 触发点表)
- Modify: `docs/PLAN.md`(新行的状态)

**这一节的意义**:本次改动让仓库里**三处今天为真的句子变成假话**,而它们**都不在代码里** —— `npm test` 与 `lint` 一个都不会红。

- [ ] **Step 1: `docs/walkthrough.md` —— 改两处「已变成假话」的期望**

按该文件现况**逐字**定位(不要按行号硬改):

1. **`W-L6`** 的期望列末尾有一句「**弹的是幸运弹层,这一关的通关撒花就被让掉、当场不出**(连击档不受影响,照出)」。加了自己的档之后,**这一场不再一记不出** ⇒ 把那句改成「弹的是幸运弹层,**该关的通关档(`word`)被让掉,但幸运**自己有撒花档**、照样出**」,并在前提列补一句「要触发幸运弹层就再多首通几关」已在,不动。
2. **该文件 §C 的「尚未纳入」节**里那条记录「成就 / 连击 / 幸运奖励的可见反馈」的**已纳入清单**,核对它列到的 id 是否仍然完备(它列了 `W-C9` / `W-L4` / `W-L5` / `W-L6` / `W-S3` / `W-V5` / `W-P4` / `W-P5`);**本次新增的行要加进去**。

- [ ] **Step 2: `docs/walkthrough.md` —— 加四条新条目(一条只判一件事)**

加在对应分区(`### 关卡与积木盘` / `### 结算与奖励`),id 沿用该文件现况的下一个空号(现占用到 `W-L6` / `W-S3`,故从 `W-L7` / `W-S4` 起;**动手前自己 grep 一遍确认没被别处占用**):

| # | 前提 | 操作 | 期望 |
|---|---|---|---|
| **W-L7** | 任意设备,进任一关。**先把声音打开**(家长面板里「声音」开着才算 —— 关着的话本行记「未验」) | **先故意放错一块**把连击归零(放错是唯一的重置路径),此后一块不错地连放;盯住**第 5 块**落位那一刻 | 第 5 块落位时**多响一声**(上行三音),与落块那一声「嗒」**明显不同**;第 4 块、第 6 块**没有**这一声 |
| **W-L8** | 同上,声音开着 | 拼齐最后一关的积木(含声调块),**等成功动画走完** | 通关那记撒花出现的同时**响一声**;这一声与拼对瞬间那串四音(**不同时刻**、**不同音**) |
| **W-S4** | 同上,声音开着。**全成就已得的账号 ⇒ 做不到,记「未验」**(§D 第 4 条),不许记「通过」 | 触发一次成就弹层 | 弹层出现的同时**响一声**(比通关那串短、音更高) |
| **W-S5** | 同上,声音开着。**幸运弹层是随机的**(只在首通时掷,常量 `LUCKY_RATE`,出处 `src/features/lucky-bonus/lucky-bonus.ts` —— 要核对具体数值去那里看,本行不抄死它)。**一次没出弹层不等于缺陷** | 触发一次幸运弹层 | 弹层出现时**响一声**(两声铃,与成就那串分辨得开),**并且出一记撒花**(规模小于通关那记);旧行为「这一关一记都不出」作废 |

**判据写法守该文件 §A 四条**:期望里不写「好看 / 好听」这类没有判定式的词;每条只判一件事;做不到有「未验」出口。

- [ ] **Step 3: `docs/dev-reference.md` —— 更正两处「零调用点」登记**

在 §「发音与关卡数据约定」那段登记(现文写着 `'streak'`「**生产无触发点**」、`'correct'`「**同样生产零触发点**」)上,**就地加更正**,原文保留:

- `'streak'`:由「生产无触发点」更正为「**已接线**:`combo5` / `combo10` 两档经 `CELEBRATE_CUE` 发声(2026-09-24,spec `2026-09-24-reward-flight-design.md` §3.1)」。
- `'correct'`:由「生产零触发点」更正为「**已接线**:`word` 档(一关拼成)发声;它同时也出现在 `PinyinBlocksGame.tsx` 的 `playSound` prop **类型声明**里 —— 那仍不是调用点」。
- 同段那句「这三处(`speakRole` / `'streak'` / `'correct'`)**不是**本轮清理对象」 —— `speakRole` 仍成立,`'streak'` / `'correct'` 已不再是「零调用」,**两者要分开写,别把 `speakRole` 一起改掉**(它今天确实仍零调用)。

> **该段落自己的体例要求「按引用 `speakRole` 这个名字的文件逐个给 natures」** —— 更正时守同一体例,别写成一句笼统的话。

- [ ] **Step 4: `2026-09-23-effects-textless-design.md` §3.4 的触发点表**

那张表今天只有三行(`combo5` / `combo10` / `word` / `achievement` 中的对应项)。**在行尾追加**(整行其余字节不动):

```
 (**已过时:2026-09-24 加第五档 `lucky` —— 见 [reward-flight spec](2026-09-24-reward-flight-design.md) §3.6**)
```

**原文保留、不追改** —— 这是该支已立的先例(实施后据实况更正、原文不追改,只在原处点回指针)。该 spec 的 §3.4 勘误块**已经存在**,本次是**再加一条指针**,不是新写勘误块。

- [ ] **Step 5: `docs/PLAN.md` 收口**

新行(`0.2.0` feature 轨「奖励层『归属动作』重做」)末尾的 `— spec 已出,**待评审**(未开工)` 改成反映**实际状态**的话:期 1 已实施(`plan docs/superpowers/plans/2026-09-24-reward-flight-p1-voice.md`)、剩下的期次仍待做。**按实际做完的事写,不预告**。

- [ ] **Step 6: 提交**

```bash
git add docs/walkthrough.md docs/dev-reference.md docs/superpowers/specs/2026-09-23-effects-textless-design.md docs/PLAN.md
git commit -m "docs: 期 1 的走查条目 + 三处『被本次改动弄成假』的登记面" -m "
walkthrough:W-L6 的『幸运让位后一记都不出』已作废,改期望;新增 W-L7/L8/S4/S5 四条单件条目。
dev-reference:'streak'/'correct' 两处『零调用点』登记就地更正(speakRole 仍零调用,不动)。
2026-09-23 spec §3.4 触发点表加指针,原文保留不追改。

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: 收尾(控制器执行,不在任何 Task 内)

- [ ] 跑三闸并把**实际数字**写进 SDD 报告:`npm test`(文件数 / 用例数自己跑)、`npm run lint`(必须恰好 2 条基线 warning)、`npx tsc -b`(exit 0)。
- [ ] **真机冒烟**(唯一能判「响不响」的口):`npm run dev`,在浏览器里走一遍 `W-L7` / `W-L8` / `W-S4` / `W-S5` 四条。**听不见 = 接线错** —— 单元测试注入的是自己的 mock,**证明不了 registry 里那根线连着**。
- [ ] **复跑零文本守卫**:2026-09-23 支留下的三条(地图 / 两个弹层的零汉字扫描 + 关卡页「直接文本含汉字的元素恰好一个」)必须仍全绿 —— 本计划不该碰它们,但「不该」不是判据。
- [ ] 确认改动面:**当场跑 `git diff --name-only <基点>..HEAD`,把改动的文件全列出来**,逐个核对是否属于本计划的 Files 清单;**并确认不含** `worker/`、`migrations/`、`src/app/ParentPanel.tsx`。**不写死文件张数。**

> **实施时更正(2026-09-24,收盘时):** 原文写的是「应**只有** `src/` 的六个文件 + `docs/` 的四个文件」。那个**正数是错的** —— 按各任务 Files 清单去重后 `src/` 是 **11** 个唯一文件(`shared/services/index.ts` 被 Task 1 / Task 2 共用),`docs/` 因 F7 增为 **5** 个。而且它**违反了本计划自己的 Global Constraint「不写死计数」**:写死的计数会静默变假,今天就已经变假了一次。**正数删掉,只留否定形式** —— 否定形式不会过期。

---

## 不在本计划内(期 2 / 期 3)

- **期 2**:关卡页星级揭示 + 关卡页常驻星尘计数器 + 一笔星尘飞进计数器 + 首次慢放(spec §3.2 / §3.3 / §3.5)。
- **期 3**:徽章未得态改同 emoji 淡影 + `UnitMap.test.tsx` 那条形态断言的替换(spec §3.4 / §8 C1 / §8 C2)。
- **不做的**见 spec §9(配色布局重做 / 「继续」按钮 / 连击加成金额可见 / 跨页飞行 / 新增位图素材 / 家长面板)。

## 依赖本计划的开放问题

spec 尚未获产品逐条评审。**本计划的范围(期 1)没有待决项** —— 它就是产品在 mockup 里看过并选中的方案 A(`celebrate` 声音补齐 + 幸运算花档)。若产品对 spec §7 的裁定或 §9 的不做清单有异议,**期 2 / 期 3 的计划要重写,本计划不受影响**。
