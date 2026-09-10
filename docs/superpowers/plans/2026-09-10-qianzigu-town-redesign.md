# 千字谷镇重设 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把千字谷的角色体系换成全拟人班底(苏灵灵/徐万年/皮小闹/吴铭),**零通用群众位**,ch1 内容全量重写为《徐爷爷忘掉的名字》,零位图、18 幕结构不动。

**Architecture:** 分三段推进 —— ①**扩容**(新增三角色 + 社交应答解耦 + 布景瘦身,旧角色暂留,全程绿灯);②**换内容**(ch1.ts 全量重写,用新角色);③**退役**(删 `sun`/`moon`/`jingmo` + 全部测试夹具同步)。之所以不先删,是因为 `SpeechRole` 是编译期联合类型 —— 删角色 ⟹ `ch1.ts` 当场编译不过,顺序只能是「先加后删」。

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind 4;vitest(jsdom);`SpeechSynthesis` 运行时合成(不落音频资产)。

**Spec:** `docs/superpowers/specs/2026-09-10-qianzigu-town-redesign-design.md`

## Global Constraints

- **引擎 / 进度 / 判分逻辑零动** —— 不新增场景类型、不改出题引擎、不改结算规则。唯一例外 = Task 6 的存档校验(spec §8.4)。
- **台词硬线**:单句去标点后推荐 ≤18 汉字、**硬线 ≤20**;超 20 必按意群拆。由 `ch1-script.test.ts` 守卫。
- **角色 emoji 不得与 `src/features/vocabulary/words.ts` 任一条目重复** —— 否则孩子分不清「角色」与「今天要学的词」。词库动物段 41–60 是主要排除源。
- **不设通用群众位**:终态 `SpeechRole` 恰 5 值(`lingling` / `xuwannian` / `pixiaonao` / `changmo` / `narrator`),`villager` 删除。**每个出声的角色都有姓名与一页卡**(spec D12/D13)。
- **禁止**重建 kingdom / game_state 类旧结构;表结构不动,**不加迁移**,不改 `0001` 基线。
- 涉 wrangler 的命令一律显式 `--config wrangler.toml`(本计划不涉及部署)。
- 每个 Task 结束**必须 commit**(仓库 commit 风格:`type(scope): 中文描述`)。
- 单文件测试命令:`npx vitest run <path>`;全量:`npm test`;静态:`npx tsc -b`。

---

### Task 1: `SpeechRole` 扩容 —— 新增徐万年 / 皮小闹 / 吴铭

**Files:**
- Modify: `src/shared/services/speech.ts:4`
- Modify: `src/shared/services/speech.contract.test.ts`
- Modify: `src/features/speech/speech.ts:8-15`
- Modify: `src/features/qianzigu/scene-ui.tsx:12-19`
- Test: `src/shared/services/speech.contract.test.ts`

**Interfaces:**
- Consumes: 无(起点)
- Produces: `SpeechRole` 联合类型扩为 9 值,新增字面量 `'xuwannian' | 'pixiaonao' | 'changmo'`。后续所有 Task 都以这三个字面量引用新角色。

> **终态是 5 值**:`'lingling' | 'xuwannian' | 'pixiaonao' | 'changmo' | 'narrator'`。`sun` / `moon` / `jingmo` / **`villager`** 四者由 Task 5 一并删除(spec D12:不设通用群众位)。本 Task **只增不减**,保证全程绿灯。

- [ ] **Step 1: 写失败测试**

把 `src/shared/services/speech.contract.test.ts` 整体替换为:

```ts
import { describe, expect, it } from 'vitest'
import type { SpeechRole } from './speech'

describe('speech 契约', () => {
  it('SpeechRole 含九角色字面量(新三角色已接入)', () => {
    const roles: SpeechRole[] = [
      'lingling', 'sun', 'moon', 'jingmo', 'narrator', 'villager',
      'xuwannian', 'pixiaonao', 'changmo',
    ]
    expect(roles).toHaveLength(9)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/shared/services/speech.contract.test.ts`
Expected: FAIL —— TS 报 `'xuwannian'` 不能赋给 `SpeechRole`

- [ ] **Step 3: 扩 union**

`src/shared/services/speech.ts:4`:

```ts
/** 千字谷台词角色(各角色有独立语速/音高配置)。 */
export type SpeechRole =
  | 'lingling' | 'sun' | 'moon' | 'jingmo' | 'narrator' | 'villager'
  | 'xuwannian' | 'pixiaonao' | 'changmo'
```

- [ ] **Step 4: 补嗓音表**

`src/features/speech/speech.ts`,在 `SPEECH_ROLE_VOICE` 里追加三行(`jingmo` 现为 0.6/0.5,吴铭沿用该档;徐万年慢=0.6、皮小闹快=1.0):

```ts
const SPEECH_ROLE_VOICE: Record<SpeechRole, { rate: number; pitch: number }> = {
  lingling: { rate: 0.75, pitch: 1.2 },
  sun: { rate: 0.65, pitch: 0.8 },
  moon: { rate: 0.7, pitch: 1 },
  jingmo: { rate: 0.6, pitch: 0.5 },
  narrator: { rate: 0.8, pitch: 1 },
  villager: { rate: 0.8, pitch: 1 },
  xuwannian: { rate: 0.6, pitch: 0.85 },
  pixiaonao: { rate: 1, pitch: 1.15 },
  changmo: { rate: 0.6, pitch: 0.5 },
}
```

- [ ] **Step 5: 补 `ROLE_META`**

`src/features/qianzigu/scene-ui.tsx:12-19`:

```tsx
export const ROLE_META: Record<SpeechRole, { name: string; emoji: string }> = {
  lingling: { name: '灵灵', emoji: '🦊' },
  sun: { name: '太阳', emoji: '☀️' },
  moon: { name: '月亮', emoji: '🌙' },
  jingmo: { name: '静默', emoji: '🖤' },
  narrator: { name: '旁白', emoji: '📖' },
  villager: { name: '居民', emoji: '🐰' },
  xuwannian: { name: '徐万年', emoji: '🦥' },
  pixiaonao: { name: '皮小闹', emoji: '🦝' },
  changmo: { name: '吴铭', emoji: '🦇' },
}
```

> `sun` / `moon` / `jingmo` / `villager` 四行本 Task **暂留原样**(Task 5 一并删)。中间态不上线,不为 `villager` 多做一次 emoji 让位 —— 反正整行要没。
> ⚠ `lingling` 的 `name` **本 Task 保持 `'灵灵'` 不动**:权威写法是「苏灵灵」(spec §4.1),但改名会打破 7 处既有断言(`stage.test.tsx` / `DialoguePresenter.test.tsx` / `ChapterRunnerView.test.tsx`),全在本 Task 范围外。**改名连同断言更新一并归 Task 5。**

- [ ] **Step 6: 跑测试确认通过**

Run: `npx vitest run src/shared/services/speech.contract.test.ts src/features/speech/speech.test.ts`
Expected: PASS

- [ ] **Step 7: 全量回归 + 静态检查**

Run: `npx tsc -b && npm test`
Expected: 全绿(**旧角色仍在,ch1 未动,不应有任何失败**)

- [ ] **Step 8: Commit**

```bash
git add src/shared/services/speech.ts src/shared/services/speech.contract.test.ts \
        src/features/speech/speech.ts src/features/qianzigu/scene-ui.tsx
git commit -m "feat(qianzigu): SpeechRole 扩容三新角色(徐万年/皮小闹/吴铭)"
```

---

### Task 2: 社交应答解耦 —— `SceneOption.responder`

**Files:**
- Modify: `src/features/qianzigu/chapter.ts:18-24`
- Modify: `src/features/qianzigu/scene-ui.tsx:302`
- Test: `src/features/qianzigu/ChapterRunnerView.test.tsx`(既有 social 用例须仍绿)

**Interfaces:**
- Consumes: Task 1 的 `SpeechRole`
- Produces: `SceneOption` 新增可选字段 `responder?: SpeechRole`;缺省回退 `'narrator'`(旁白)。

**为什么**:`scene-ui.tsx:302` 现写死 `{ role: 'moon', text: option.response }` —— 社交选项的后果台词永远由月亮说。月亮即将退役,且新 ch1 的 social 由**皮小闹**应答,必须能指定说话者。
**回退到 `narrator`**:本设计不设通用群众位(spec D12),旁白是**叙述位、不是角色** —— 缺省时由它陈述结果,不会凭空冒出一个无名角色。

- [ ] **Step 1: 扩类型**

`src/features/qianzigu/chapter.ts`,`SceneOption` 改为:

```ts
export type SceneOption = Readonly<{
  id: string
  text: string                       // 选项文案(朗读文本即 text)
  emoji?: string
  consequence: 'good' | 'bad' | 'neutral'
  response: string                   // 选择后角色回应台词
  responder?: SpeechRole             // 谁说 response(缺省 narrator)
}>
```

- [ ] **Step 2: 改消费点**

`src/features/qianzigu/scene-ui.tsx:302`,把

```tsx
const linesToShow: ChapterLine[] = [{ role: 'moon', text: option.response }]
```

改为

```tsx
const linesToShow: ChapterLine[] = [{ role: option.responder ?? 'narrator', text: option.response }]
```

- [ ] **Step 3: 跑测试**

Run: `npx tsc -b && npx vitest run src/features/qianzigu/`
Expected: PASS(既有 social 用例的 `response` 现在由 `narrator` 说 —— 若某用例断言了 `'moon'`,把它改成 `option.responder` 指定的角色或 `'narrator'`)

- [ ] **Step 4: Commit**

```bash
git add src/features/qianzigu/chapter.ts src/features/qianzigu/scene-ui.tsx
git commit -m "feat(qianzigu): SceneOption 加 responder,社交应答不再写死月亮"
```

---

### Task 3: 布景瘦身 —— 作废太阳 4 档与月星裁决

**Files:**
- Modify: `src/features/qianzigu/stage-meta.ts:44-61`
- Modify: `src/features/qianzigu/stage-visuals.ts:16-22,30-38`
- Modify: `src/features/qianzigu/stage.tsx:7,15-63`
- Modify: `src/features/qianzigu/stage-meta.test.ts`
- Modify: `src/features/qianzigu/stage-visuals.test.ts`(若其中确无 4 档/月星断言,则本 Task 不动它 —— 实施时以实际为准)
- Modify: `src/features/qianzigu/stage.test.tsx`
- Modify: `src/features/qianzigu/ChapterRunnerView.test.tsx`(**preflight 漏列**:集成用例断言 `.stage-sun--burnt` / `.stage-sun--full`)
- Modify: `src/features/qianzigu/DialoguePresenter.test.tsx`(同上)
- Modify: `src/index.css:174-176,211-212,214-229`(太阳 4 档死 CSS + 月星死 CSS + 引用已删符号 `SUN_STAGE_EMOJI` 的陈旧注释)

**Interfaces:**
- Consumes: 无(独立于角色改造)
- Produces: `StageSky` 收窄为 `{ atmosphere: AtmosphereKey; fraction: number }`(去掉 `sun` / `moonStars` 两个 prop)。**保留** `worldDesatClass(fraction)`(灰白→彩色,与新故事无冲突)。

**为什么**:新 ch1 没有「太阳被涂花脸 → 复原」这条线,4 档(🍳→🌓→🌤️→☀️)与「失光才见月星」的裁决都成了死代码(spec §8.1、§9)。

- [ ] **Step 1: 删 `stage-meta.ts` 的三个导出**

删掉 `SunStage` 类型、`sunStage()`、`showMoonStars()` 及其上方注释(原 44-61 行)。**保留** `castFor` / `restoreCount` / `defaultAtmosphere` / `progressFraction` / `skySplit` / `isNarrator`。

- [ ] **Step 2: 删 `stage-visuals.ts` 的 4 档表 + 月星素材**

- 删 `SUN_STAGE_EMOJI` 及其 `SunStage` import(原 3、16-22 行)。
- `STAGE_BODIES` 删除 `moon` / `stars` 两行,**新增** `sun: '☀️'`:

```ts
export const STAGE_BODIES = {
  sun: '☀️',
  clouds: '☁️  ☁️  ☁️  ☁️',
  mountains: '⛰️ ⛰️ ⛰️',
  village: '🏠 🏘️ 🌳',
  river: '🏞️',
  waves: '💧 🌊 💧',
} as const
```

- `roleScale` **本 Task 不动**(它的 `'jingmo'` 在 Task 5 改)。

- [ ] **Step 3: 改 `stage.tsx`**

- 第 7 行 import 收窄为:`import { skySplit } from './stage-meta'`
- 第 8 行 import 去掉 `SUN_STAGE_EMOJI`:`import { atmosphereToClass, roleScale, STAGE_BODIES, worldDesatClass } from './stage-visuals'`
- 删 `HIDES_SUN`(第 15-16 行)—— 改为内联在组件里
- `StageSky` 整体换成:

```tsx
/** 真夜幕(break/social/boss 用的 night/dark)太阳不现身。 */
const HIDES_SUN = (atmosphere: AtmosphereKey): boolean => atmosphere === 'night' || atmosphere === 'dark'

/**
 * 千字谷实景布景层:氛围渐变底 + 世界回春灰档,上层叠 天顶云 → 太阳位 → 山壁 → 村庄 → 河流。
 */
export function StageSky({
  atmosphere,
  fraction,
}: {
  atmosphere: AtmosphereKey
  fraction: number
}) {
  return (
    <div aria-hidden className={cn('absolute inset-0', atmosphereToClass(atmosphere))}>
      {/* 世界回春:灰档叠在布景层(山/村/河)上,随进度撤灰上彩 */}
      <div className={cn('absolute inset-0', worldDesatClass(fraction))}>
        <div className="stage-mountains">{STAGE_BODIES.mountains}</div>
        <div className="stage-village">{STAGE_BODIES.village}</div>
        <div className="stage-river">
          <span className="stage-river-emblem">{STAGE_BODIES.river}</span>
          <span className="stage-river-waves">{STAGE_BODIES.waves}</span>
        </div>
      </div>
      <div className="stage-clouds">{STAGE_BODIES.clouds}</div>
      {!HIDES_SUN(atmosphere) ? (
        <div data-sun className="stage-sun">{STAGE_BODIES.sun}</div>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 4: 同步测试**

- `stage-meta.test.ts`:删 `sunStage` / `showMoonStars` 的 `it(...)` 两段与对应 import。
- `stage-visuals.test.ts`:删 `SUN_STAGE_EMOJI` 相关断言;若有 `STAGE_BODIES.moon` / `STAGE_BODIES.stars` 断言,一并删(若它断言 `roleScale('jingmo')`,**保留**到 Task 5 再改)。
- `stage.test.tsx`:删「月星在 showMoonStars true 时出现」用例;`sun` 相关断言改为「天幕恒有 `[data-sun]`,night/dark 下无」。
- `ChapterRunnerView.test.tsx` / `DialoguePresenter.test.tsx`(**preflight 漏列**):把 `.stage-sun--burnt` / `.stage-sun--full` 之类的 class 断言改为 `[data-sun]`;原先「太阳随进度复原」的断言改指向**仍在的**回春灰档(`worldDesatClass`),保持断言意图不变。

- [ ] **Step 4b: 清 `src/index.css` 太阳/月星死 CSS**

删除已无任何渲染点的样式与**引用已删符号的陈旧注释**:

- 第 174-176 行注释里的「月星」与 `SUN_STAGE_EMOJI` 提法(该符号本 Task 已删,注释现在是错的,会误导后来者)。
- `.stage-moon`(211)与 `.stage-stars`(212)。
- 第 214 行注释 + `.stage-sun--burnt` / `--crack` / `--glow` / `--full` 四档滤镜(226-229)。
- **保留** `.stage-sun` 本体(215-225)—— 天幕仍渲染 `[data-sun]`。

> 判据:`stage.tsx` 改为固定太阳后,上述 class **零渲染点**。删前先 `grep -rn "stage-sun--\|stage-moon\|stage-stars" src/` 确认只剩 CSS 自身。

- [ ] **Step 5: 跑测试**

Run: `npx tsc -b && npx vitest run src/features/qianzigu/`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/features/qianzigu/stage-meta.ts src/features/qianzigu/stage-visuals.ts \
        src/features/qianzigu/stage.tsx src/features/qianzigu/stage-meta.test.ts \
        src/features/qianzigu/stage-visuals.test.ts src/features/qianzigu/stage.test.tsx
git commit -m "refactor(qianzigu): 作废太阳 4 档与月星裁决,天幕简化为固定太阳 + 灰白回春"
```

---

### Task 4: ch1 内容全量重写 ——《徐爷爷忘掉的名字》

**Files:**
- Modify: `src/features/qianzigu/ch1.ts`(整体替换)
- Modify: `src/features/qianzigu/ch1.test.ts:27-29,44-45`
- Modify: `src/app/App.test.tsx:144-147`(mock 词表)+ `:358-360`(首幕断言)
- Modify: `src/features/qianzigu/debug-jump.test.ts:12-14,18-24,29,45`(**preflight 漏列**:旧 scene 注释 / `ALL_TASK_KEYS` / 前置 task 断言)
- Modify: `src/features/qianzigu/QianziguEntry.test.tsx:74,75,101`(**preflight 漏列**:旧标题 / 旧词名 / 旧 wordIds 完成态夹具)
- Modify: `src/features/qianzigu/ChapterRunnerView.test.tsx:242`(**preflight 漏列**:旧 boss 台词)

> **测试夹具同步判据**:凡写死 ch1 数据(标题/词名/wordIds/scene id/boss 台词)的断言,ch1 换代后必红 —— 换等价新值,不放宽。

**Interfaces:**
- Consumes: Task 1 的 `xuwannian` / `pixiaonao`;Task 2 的 `SceneOption.responder`
- Produces: `CHAPTER_1.wordIds = [13, 7, 14, 8, 19]`;全章**只用** `lingling` / `xuwannian` / `pixiaonao` / `narrator` 四个角色 —— **不引用** `sun` / `moon` / `jingmo` / `villager`(Task 5 才删它们,本 Task 先让 ch1 不再使用)。

- [ ] **Step 1: 整体替换 `src/features/qianzigu/ch1.ts`**

```ts
import type { Chapter } from './chapter'

/**
 * 千字谷 · 第 1 章《徐爷爷忘掉的名字》内容数据。
 * 主角 = 苏灵灵(玩家 = 无名搭档,无背景设定)。
 * 驱动机制:徐万年爷爷爱忘事 —— 说不出名字的东西就找不着、办不成(人物喜剧,非世界观规则)。
 * 角色映射:🦊→lingling(苏灵灵) / 🦥→xuwannian(徐万年) / 🦝→pixiaonao(皮小闹) / 📖→narrator(旁白)。
 * 无通用群众位 —— 每个出声者都有姓名(spec §4.1)。
 * 台词句长规则:单句去标点推荐 ≤18 汉字、硬线 ≤20;超 20 必按意群拆(ch1-script.test.ts 守卫)。
 * 场景结构遵循既有契约:每词两个连续 task scene(先 sound 后 shape),minCorrect 均 2;
 *  断点恰 3 个(词1 后 / 词2 后 / social 后);social 1 场;boss 1 场;ending + settle 各 1。
 * 因果链:房子(13)→ 门(7)→ 钥匙(14)→ 窗户(8)→ 台灯(19)。
 * 轻线:章末徐爷爷一句「这个我天天都记得的呀」= 唯一痕迹,不解释(见 spec §8.2)。
 */
export const CHAPTER_1: Chapter = {
  id: 1,
  title: '徐爷爷忘掉的名字',
  subtitle: '千字谷镇·第一天',
  emoji: '🏠',
  wordIds: [13, 7, 14, 8, 19],
  restoreOrder: [13, 13, 7, 7, 14, 14, 8, 8, 19, 19],
  scenes: [
    // 开场:旁白冷开场(第三人称)→ 苏灵灵自我介绍 → 撞见徐爷爷卡壳,立起「爱忘事」的人设。
    {
      id: 'open',
      kind: 'dialogue',
      lines: [
        { role: 'narrator', text: '早上的千字谷镇，风里飘着好听的拼音。' },
        { role: 'lingling', text: '早上好呀！我是苏灵灵——锵锵锵！' },
        { role: 'lingling', text: '今天我要去办一件大事，你跟我一起吧！' },
        { role: 'lingling', text: '诶？那不是徐爷爷吗？' },
        { role: 'lingling', text: '徐爷爷！你怎么站在路中间呀？' },
        { role: 'xuwannian', text: '我……我要去……去那个……' },
        { role: 'xuwannian', text: '……那个叫啥来着？' },
        { role: 'lingling', text: '诶？你连自己要干什么都忘啦？' },
        { role: 'xuwannian', text: '我忘了……我要去哪儿，要干啥。' },
        { role: 'lingling', text: '徐爷爷记性不太好，可我头一回见他忘成这样。' },
        { role: 'lingling', text: '没关系！咱们一个一个想起来！' },
      ],
    },

    // 词 1 房子(13)
    {
      id: 't1-sound',
      kind: 'task',
      title: '叫出「房子」· 声音',
      intro: [
        { role: 'lingling', text: '徐爷爷，你家在哪儿呀？' },
        { role: 'xuwannian', text: '我家……就是那个，住人的那个……' },
        { role: 'lingling', text: '哦！你是说「房子」！' },
        { role: 'lingling', text: 'fáng zi！房子！' },
        { role: 'lingling', text: '来，一起叫出它的名字！' },
      ],
      task: { wordId: 13, layer: 'sound', minCorrect: 2 },
      onDone: [],
    },
    {
      id: 't1-shape',
      kind: 'task',
      title: '认出「房子」· 字形',
      intro: [
        { role: 'lingling', text: '名字叫对了，你还认得出它的样子吗？' },
        { role: 'xuwannian', text: '认得出！快给我看看！' },
      ],
      task: { wordId: 13, layer: 'shape', minCorrect: 2 },
      onDone: [
        { role: 'xuwannian', text: '房子！对，房子！我家就是那一栋！' },
        { role: 'lingling', text: '想起来啦！走，我们回家！' },
        // 自然断点前的休息提示(BreakScene 无台词槽,并入上一幕收尾)
        { role: 'lingling', text: '想继续吗？还是休息一下？' },
      ],
    },
    { id: 'br1', kind: 'break' },

    // 词 2 门(7)
    {
      id: 't2-sound',
      kind: 'task',
      title: '叫出「门」· 声音',
      intro: [
        { role: 'lingling', text: '到啦！这就是你家！' },
        { role: 'xuwannian', text: '太好了……可这门怎么一动不动呀？' },
        { role: 'lingling', text: '徐爷爷，你又忘了它叫什么吧？' },
        { role: 'xuwannian', text: '它……它叫什么来着？' },
        { role: 'lingling', text: '这个叫「门」！mén！' },
      ],
      task: { wordId: 7, layer: 'sound', minCorrect: 2 },
      onDone: [],
    },
    {
      id: 't2-shape',
      kind: 'task',
      title: '认出「门」· 字形',
      intro: [{ role: 'lingling', text: '再看看它长什么样！' }],
      task: { wordId: 7, layer: 'shape', minCorrect: 2 },
      onDone: [
        { role: 'xuwannian', text: '门！对，是门！该往里推才对！' },
        { role: 'lingling', text: '哈哈，你刚才一直在往外拉呢！' },
      ],
    },
    { id: 'br2', kind: 'break' },

    // 社交事件:皮小闹冒失撞人 —— 灵灵怎么回应(后果式 3 选项)。
    {
      id: 'social-pixiaonao',
      kind: 'social',
      stage: { cast: ['lingling', 'pixiaonao'] },
      lines: [
        { role: 'lingling', text: '咦？皮小闹？你跑这么快干嘛——' },
        { role: 'pixiaonao', text: '让让让让让让——！' },
        { role: 'narrator', text: '咚！皮小闹一头撞在徐爷爷身上。', mood: 'scary' },
        { role: 'pixiaonao', text: '对、对不起！我不是故意的！' },
        { role: 'lingling', text: '哎呀，这可怎么办？' },
      ],
      options: [
        {
          id: 'a', text: '你怎么这么冒失！', emoji: '😠', consequence: 'bad',
          responder: 'pixiaonao', response: '我……我这就走开！',
        },
        {
          id: 'b', text: '没事没事，你没摔着吧？', emoji: '💕', consequence: 'good',
          responder: 'pixiaonao', response: '我没事！我帮你扶徐爷爷！',
        },
        {
          id: 'c', text: '（先去看看徐爷爷）', emoji: '🚶', consequence: 'neutral',
          responder: 'pixiaonao', response: '……那我先走了。',
        },
      ],
      goodOptionId: 'b',
      loop: [
        { role: 'lingling', text: '皮小闹更难过了……我们换句话说说？' },
        { role: 'lingling', text: '他还低着头呢，再试一次好不好？' },
      ],
      onGood: [
        { role: 'pixiaonao', text: '谢谢你！我帮你一起扶徐爷爷！', mood: 'happy' },
        { role: 'lingling', text: '你学会照顾别人的心情啦！' },
      ],
    },
    { id: 'br3', kind: 'break' },

    // 词 3 钥匙(14)
    {
      id: 't3-sound',
      kind: 'task',
      title: '叫出「钥匙」· 声音',
      intro: [
        { role: 'lingling', text: '门是认出来了，可它锁着呢。' },
        { role: 'xuwannian', text: '钥匙……钥匙就在我口袋里！' },
        { role: 'lingling', text: '那你快拿出来呀？' },
        { role: 'xuwannian', text: '可我说不出它叫啥，就摸不着它！' },
        { role: 'lingling', text: '它叫「钥匙」！yào shi！' },
      ],
      task: { wordId: 14, layer: 'sound', minCorrect: 2 },
      onDone: [],
    },
    {
      id: 't3-shape',
      kind: 'task',
      title: '认出「钥匙」· 字形',
      intro: [{ role: 'lingling', text: '再认认它的样子！' }],
      task: { wordId: 14, layer: 'shape', minCorrect: 2 },
      onDone: [
        { role: 'xuwannian', text: '摸着了！钥匙！我这就开门！' },
        { role: 'narrator', text: '门开了。' },
      ],
    },

    // 词 4 窗户(8)
    {
      id: 't4-sound',
      kind: 'task',
      title: '叫出「窗户」· 声音',
      intro: [
        { role: 'lingling', text: '进屋啦！屋里怎么闷闷的？' },
        { role: 'xuwannian', text: '得透透气……那个透气的口子叫啥？' },
        { role: 'lingling', text: '叫「窗户」！chuāng hu！' },
      ],
      task: { wordId: 8, layer: 'sound', minCorrect: 2 },
      onDone: [],
    },
    {
      id: 't4-shape',
      kind: 'task',
      title: '认出「窗户」· 字形',
      intro: [{ role: 'lingling', text: '认认它！' }],
      task: { wordId: 8, layer: 'shape', minCorrect: 2 },
      onDone: [
        { role: 'xuwannian', text: '窗户！开了！风进来啦！' },
        { role: 'pixiaonao', text: '哇！屋里一下子亮堂了！' },
      ],
    },

    // 词 5 台灯(19)—— 天黑了,全场唯一真夜戏
    {
      id: 't5-sound',
      kind: 'task',
      stage: { atmosphere: 'night' },
      title: '叫出「台灯」· 声音',
      intro: [
        { role: 'narrator', text: '天黑了，屋子里慢慢暗下来。' },
        { role: 'xuwannian', text: '我得点个亮……那个发光的叫啥？' },
        { role: 'lingling', text: '叫「台灯」！tái dēng！' },
      ],
      task: { wordId: 19, layer: 'sound', minCorrect: 2 },
      onDone: [],
    },
    {
      id: 't5-shape',
      kind: 'task',
      stage: { atmosphere: 'night' },
      title: '认出「台灯」· 字形',
      intro: [{ role: 'lingling', text: '最后再认一次！' }],
      task: { wordId: 19, layer: 'shape', minCorrect: 2 },
      onDone: [
        { role: 'xuwannian', text: '台灯！亮了！' },
        { role: 'narrator', text: '小小的屋子，一下子暖了起来。' },
      ],
    },

    // BOSS:闹剧 —— 徐爷爷的记忆搅成一团,把 5 个名字一个个叫回来。
    {
      id: 'boss',
      kind: 'boss',
      intro: [
        { role: 'xuwannian', text: '哎哟……我今天忘得也太多了。' },
        { role: 'xuwannian', text: '门、钥匙、窗户……我全搅成一团了！' },
        { role: 'lingling', text: '别慌！咱们一个一个叫回来！' },
      ],
      maxWrong: 3,
      questionCount: 5,
      win: [
        { role: 'xuwannian', text: '都想起来了！房子、门、钥匙、窗户、台灯！', mood: 'happy' },
        { role: 'lingling', text: '一个都没落下！' },
      ],
      lose: [
        { role: 'lingling', text: '已经很棒啦！徐爷爷的记性得慢慢来。' },
        { role: 'lingling', text: '我们先歇歇，明天再来帮他！' },
      ],
    },

    // 结局:灯亮着,皮小闹咋呼,灵灵总括。
    {
      id: 'ending',
      kind: 'ending',
      lines: [
        { role: 'narrator', text: '徐爷爷家的窗户，亮起一盏暖黄的灯。' },
        { role: 'pixiaonao', text: '徐爷爷家的灯亮啦！' },
        { role: 'pixiaonao', text: '我明天还来帮忙！' },
        { role: 'lingling', text: '今天可真够忙的！' },
      ],
    },

    // 结算 + 轻线痕迹:徐爷爷忘了他「从没忘过」的东西。不解释。
    {
      id: 'settle',
      kind: 'settle',
      summary: [
        { role: 'lingling', text: '今天帮徐爷爷找回了五个名字！' },
        { role: 'lingling', text: '他高兴得直转圈呢。' },
        { role: 'xuwannian', text: '不对……这个我天天都记得的呀。' },
        { role: 'lingling', text: '徐爷爷？你说什么？' },
        { role: 'narrator', text: '徐爷爷没有回答。' },
      ],
    },
  ],
}
```

- [ ] **Step 2: 同步 `ch1.test.ts`**

- 第 27-29 行,词序断言改为:

```ts
  it('5 词有序(搬家语义场:房子→门→钥匙→窗户→台灯)', () => {
    expect(CHAPTER_1.wordIds).toEqual([13, 7, 14, 8, 19])
  })
```

- 第 45 行,允许角色集改为(此时 union 仍是 9 值,该集只列 ch1 用到的四个 —— **`villager` 已不在其中**):

```ts
    const allowed = new Set(['lingling', 'xuwannian', 'pixiaonao', 'narrator'])
```

- 第 44 行,`it` 标题「限 SpeechRole 六值」措辞已过时,改为「限本章用到的角色」。

- [ ] **Step 2b: 同步 `src/app/App.test.tsx`**

`src/app/App.test.tsx:360`(**preflight 发现,原 plan 漏列**):该处断言旧 ch1 首行,新 ch1 首行已变。整行改为:

```tsx
    expect(await screen.findByText(/早上的千字谷镇/)).toBeInTheDocument()
```

> 上方注释同步改掉「旁白冷开场」表述 → `// 首幕标记:open 以旁白起头(ch1.ts),故断言首行。`

- [ ] **Step 3: 跑测试**

Run: `npx tsc -b && npx vitest run src/features/qianzigu/ch1.test.ts src/features/qianzigu/ch1-script.test.ts src/app/App.test.tsx`
Expected: PASS。若 `ch1-script.test.ts` 报某句超 20 字,**按意群拆句**(不要调高阈值)。

- [ ] **Step 4: 跑全量回归**

Run: `npm test`
Expected: 全绿(此时旧角色仍在 union 里但已无人使用 —— 这是有意的中间态)

- [ ] **Step 5: Commit**

```bash
git add src/features/qianzigu/ch1.ts src/features/qianzigu/ch1.test.ts src/app/App.test.tsx
git commit -m "feat(qianzigu): ch1 重写为《徐爷爷忘掉的名字》(房子→门→钥匙→窗户→台灯)"
```

---

### Task 5: 旧角色退役 —— 删 `sun` / `moon` / `jingmo` / `villager`

**Files:**
- Modify: `src/shared/services/speech.ts:4`
- Modify: `src/shared/services/speech.contract.test.ts`
- Modify: `src/features/speech/speech.ts`(`SPEECH_ROLE_VOICE` 表)
- Modify: `src/features/speech/speech.test.ts`
- Modify: `src/features/qianzigu/scene-ui.tsx`(`ROLE_META`)
- Modify: `src/features/qianzigu/stage-visuals.ts`
- Modify: `src/features/qianzigu/stage-visuals.test.ts`
- Modify: `src/features/qianzigu/stage-meta.test.ts`
- Modify: `src/features/qianzigu/stage.test.tsx`
- Modify: `src/features/qianzigu/DialoguePresenter.test.tsx`
- Modify: `src/features/qianzigu/ChapterRunnerView.test.tsx`

> **行号以 Step 2 的 `tsc -b` 输出为准**。原计划写的精确行号已被 Task 3/4 的改动顶偏(实测 `DialoguePresenter.test.tsx` 偏 1 行、`ChapterRunnerView.test.tsx` 偏 3 行),照旧行号会改错位置 —— 故此处只列文件,精确位置由编译器列出。
> **不在此清单但必然被编译器点名的夹具**(Task 3/4 之前未预见,已实测):`stage.test.tsx` 的 `<StageCast cast={['lingling','sun']}>` 用例、`stage-meta.test.ts` 的 `skySplit` 用例(含 `'moon'`)、`ChapterRunnerView.test.tsx` 的 `sky: ['sun']` / `onDone`/`boss.intro` 用例、`DialoguePresenter.test.tsx` 尾部的 `toHaveBeenLastCalledWith('第二句','sun')` —— 全在上述文件内,按 Step 5 的映射换名即可。

**Interfaces:**
- Consumes: Task 1–4 的全部产出(此时 `ch1.ts` 已不再引用旧角色)
- Produces: `SpeechRole` 收窄为 **5 值**:`'lingling' | 'xuwannian' | 'pixiaonao' | 'changmo' | 'narrator'` —— **无通用群众位**(spec D12)。

- [ ] **Step 1: 收窄 union**

`src/shared/services/speech.ts:4`:

```ts
/** 千字谷台词角色(各角色有独立语速/音高配置)。 */
export type SpeechRole = 'lingling' | 'xuwannian' | 'pixiaonao' | 'changmo' | 'narrator'
```

- [ ] **Step 2: 跑 tsc,让编译器列出所有残留引用**

Run: `npx tsc -b`
Expected: FAIL,逐条列出仍在引用 `'sun'` / `'moon'` / `'jingmo'` / `'villager'` 的文件与行号。**这份清单就是 Step 3–6 的作业单。**

- [ ] **Step 3: 清 `speech` 域**

- `src/features/speech/speech.ts`:`SPEECH_ROLE_VOICE` 删 `sun` / `moon` / `jingmo` / `villager` **四行**,保留 `lingling` / `narrator` / `xuwannian` / `pixiaonao` / `changmo` **五行**。
- `src/features/speech/speech.test.ts`:三处旧角色字面量换成新角色(语义等价即可):
  - 第 169 行 `'jingmo'` → `'changmo'`
  - 第 192 行 `'sun'` → `'xuwannian'`
  - 第 225 行 `'moon'` → `'pixiaonao'`

- [ ] **Step 4: 清 `qianzigu` 生产代码**

- `scene-ui.tsx`:`ROLE_META` 删 `sun` / `moon` / `jingmo` / `villager` **四行**(此时它应是恰好 **5 项**:`lingling` 🦊 / `xuwannian` 🦥 / `pixiaonao` 🦝 / `changmo` 🦇 / `narrator` 📖)。
- `scene-ui.tsx` 同一处:`lingling` 的 `name` 由 `'灵灵'` 改为 **`'苏灵灵'`**(spec §4.1 权威写法)。Task 1 有意把它押后到此(改名会破 7 处断言,须与断言更新同批做)。
- `stage-visuals.ts:7`:

```ts
export const roleScale = (role: SpeechRole): number => (role === 'changmo' ? 1.5 : 1)
```

- [ ] **Step 5: 清 `qianzigu` 测试夹具**

- `stage-visuals.test.ts:6-8`:`roleScale('jingmo')` → `roleScale('changmo')`;`roleScale('sun')` → `roleScale('lingling')`。
- `stage-meta.test.ts:14-20,64-66`:把 `'sun'` / `'moon'` / **`'villager'`** 整体换成 `'xuwannian'` / `'pixiaonao'`(这些用例只在测 `castFor` / `skySplit` 的**排序与去重语义**,换名不影响断言结构 —— 注意第 19-20 行的 `L('villager')` 与期望数组里的 `'villager'` 必须一起换,否则去重语义会变)。
- `stage.test.tsx:65,80,89`:同理换名。
- `DialoguePresenter.test.tsx`:`{ role: 'sun', text: '救救我…' }` 之类的夹具 → `{ role: 'xuwannian', ... }`;第 101 行 `toHaveBeenLastCalledWith('第二句', 'sun')` → `'xuwannian'`。
- `ChapterRunnerView.test.tsx`:`'jingmo'` → `'changmo'`,`'moon'` → `'pixiaonao'`,`'sun'` → `'xuwannian'`。
- `ChapterRunnerView.test.tsx` 的 boss 快进用例(约 :243):保留的负向断言 `expect(screen.queryByText(/欢迎来到千字谷/)).not.toBeInTheDocument()` 已成**空洞断言** —— 该串在重写后的 `ch1.ts` 里根本不存在,永不失败,既不守「不回头卡在开场」也不再随内容演进。改为断言 **open 幕标记** `expect(screen.queryByText(/早上的千字谷镇/)).not.toBeInTheDocument()`(open 幕首行,与 App.test 用同一标记)。
- **「灵灵」→「苏灵灵」改名连带**(与前一条同批):`stage.test.tsx:68,73,95` / `DialoguePresenter.test.tsx:41,47,60,81` / `ChapterRunnerView.test.tsx:251` 里 `'灵灵'` 的字符串断言/查询一并改为 `'苏灵灵'`。这些断言测的是**名字牌渲染**,与剧情无关,换名不动结构。

> ⚠ 只换**角色名**,不动任何断言结构 —— 这些测试测的是**引擎与渲染机制**,与剧情无关。

- [ ] **Step 6: 再跑 tsc,应收敛为零错误**

Run: `npx tsc -b`
Expected: PASS(无输出)

- [ ] **Step 7: 全量回归**

Run: `npm test`
Expected: 全绿

- [ ] **Step 8: 命名残留复核(spec §11 验收 3、4)**

**权威判据 = `tsc -b` 归零**(上一步)。`SpeechRole` 是编译期联合类型,任何残留的旧角色字面量都必然报错 —— 编译器比 grep 更完备。以下两条 grep 只作**补充**,各自都有已知的合法命中:

```bash
# ① 生产代码(排测试)应无输出;words.ts / catalogs.ts 的 english/anchorWord 是普通字段值,非 SpeechRole 语境
grep -rn "'sun'\|'moon'\|'jingmo'\|'villager'" src/ --include=*.ts --include=*.tsx \
  | grep -v "\.test\." | grep -v "words.ts" | grep -v "catalogs.ts"
# ② 旧中文角色名应无输出
grep -rn "静默\|墨迹" src/features/qianzigu/
```

**不作为判据**:「居民」二字 —— 删掉 villager 后,故事文案里正常叙述「镇上的居民」仍可出现(spec D12 禁的是**匿名群众角色位**,不是这个词)。

**已知合法命中**(出现即正常,不算残留;`catalogs.ts` 的 `anchorWord: 'moon'` / `'sun'` 是英语字母表锚词,与千字谷角色无关):
`src/features/foundation/catalogs.ts:110,116`、`src/features/vocabulary/words.ts`(`english` 字段)、各测试里的 `english: 'sun'` 词夹具(`ChapterRunnerView.test.tsx:29`、`App.test.tsx:64`、`LessonEntry.test.tsx:26`、`settlement.test.ts:10`)、`LessonEntry.test.tsx:34`(发音目标 id)。

- [ ] **Step 8b: 清旧叙事残留(preflight 漏列,执行中发现)**

Step 8 的 grep ② 命中的「静默」有两类,**只清角色名那一类**:
- **角色名(清)**:`jingmo` 的旧中文名。
- **普通中文词,义为「无声」(留)**:`src/features/foundation/coldstart.test.ts:12`、`src/features/achievements/AchievementPopup.tsx:8`、`src/shared/ui/quiz/speech.ts:11`。

**A. 用户可见文案**
- `src/features/qianzigu/scene-ui.tsx:398`:BOSS 题卡徽章 `BOSS · 静默` → **`BOSS · 一团乱`**(spec §195:BOSS 叙事降级为「一团乱」,不再是挑战者;且 `scene-ui` 是通用组件,**不得硬编码角色名** —— 本 ch1 的 boss 是徐爷爷,后续章节会换人)。连带断言 `ChapterRunnerView.test.tsx:483,517,520`。
- `src/app/WorldShell.tsx:45`:`跟着灵灵拯救太阳、安慰月亮…收集汉字!` → **`跟着苏灵灵，帮千字谷镇的伙伴找回名字…收集汉字!`**(旧世界观 + 旧角色名;`苏灵灵` 按 spec §4.1)。无测试断言。

**B. 陈旧注释 / 测试标题**
- `stage-visuals.ts:4` 注释「静默大反派」→「反派放大」;`stage-visuals.test.ts:5` it 标题同理。
- `ChapterRunnerView.tsx:378` 注释「静默登台」→「反派登台」。
- `stage.test.tsx:63` it 标题「静默天空体零多余 DOM」→「另一天空体零多余 DOM」;`:76` 注释「(太阳)」「静默月亮」→ 该夹具实际的新角色名。

**C. 自足夹具旧数据**
- `ChapterRunnerView.test.tsx` 的「静默」→ spec §4.1 的真名「常默」(`:90` 台词 / `:497` it 标题 / `:503,515` `'我是常默!'` / `:514` 注释)。
- `ChapterRunnerView.test.tsx:58,74,100,126` 的 `title: '太阳的求救'` → `'徐爷爷忘掉的名字'`。
- `chapter.ts:36` 注释举例「如 拯救太阳」→「如 徐爷爷忘掉的名字」。

**不做**:`docs/design/game-direction.md` 归 Task 7 全量同步。只换字符串值,不动断言结构。

- [ ] **Step 9: Commit**

先确认 `src/` 下只有本 Task 的改动(工作区另有不属于本 plan 的 `.claude/`、`docs/`、`CLAUDE.md` 改动,不在 `src/`):

```bash
git status --short src/
```

应只列出本 Task 触碰的文件;确认后:

```bash
git add -A src/
git commit -m "refactor(qianzigu): 退役 sun/moon/jingmo/villager,SpeechRole 收敛为五值"
```

---

### Task 6: 存档作废 —— 旧 ch1 进度不得残留

**Files:**
- Modify: `src/features/qianzigu/chapter-progress.ts`
- Test: `src/features/qianzigu/chapter-progress.test.ts`

**Interfaces:**
- Consumes: `CHAPTER_1.wordIds`(`src/features/qianzigu/ch1.ts`)
- Produces: `load()` 返回的 row,其 `restoreState` 反序列化后若含**不在当前章节 `wordIds` 内**的词 id,一律视为无进度(`row: null`)。

**为什么**:服务端行存的是 `resumeSceneId` + `restoreState`,而新 ch1 **复用同一批场景 id** —— 旧进度会照常载入并停在语义已变的幕上(spec §8.4)。

- [ ] **Step 1: 写失败测试**

在 `src/features/qianzigu/chapter-progress.test.ts` 追加:

```ts
import { CHAPTER_1 } from './ch1'

describe('chapter-progress 存档作废', () => {
  it('restoreState 含本章之外的词 id → 视为无进度', async () => {
    const api = {
      // 旧 ch1 的进度:词 1(太阳)已恢复两层
      getChapterProgress: async () => ({
        chapterId: 1,
        resumeSceneId: 't2-sound',
        restoreState: JSON.stringify([{ wordId: 1 }, { wordId: 1 }]),
      }),
      putChapterProgress: async () => {},
    }
    const service = createChapterService(api as never, { onUnauthorized() {}, onError() {} })
    await service.load()
    expect(service.getSnapshot().data.row).toBeNull()
  })

  it('restoreState 全在本章词表内 → 正常保留', async () => {
    const api = {
      getChapterProgress: async () => ({
        chapterId: 1,
        resumeSceneId: 't2-sound',
        restoreState: JSON.stringify([{ wordId: CHAPTER_1.wordIds[0] }]),
      }),
      putChapterProgress: async () => {},
    }
    const service = createChapterService(api as never, { onUnauthorized() {}, onError() {} })
    await service.load()
    expect(service.getSnapshot().data.row?.resumeSceneId).toBe('t2-sound')
  })
})
```

> 若该测试文件尚无 `createChapterService` 的 import,按现有同文件写法补齐。

补一条**空集边界**用例(注意:`every` 对空数组返回 `true`,这是**正确**行为 —— 服务端新章行就是 `EMPTY_RESTORE = '[]'`,必须被保留。但该性质未被任何测试锁定,将来若有人改成 `parsed.length > 0 && ...` 会静默破坏「新章开局正常载入」):

```ts
  it('restoreState 为空数组(新章开局)→ 保留,不作废', async () => {
    const api = {
      getChapterProgress: async () => ({ chapterId: 1, resumeSceneId: null, restoreState: '[]' }),
      putChapterProgress: async () => {},
    }
    const service = createChapterService(api as never, { onUnauthorized() {}, onError() {} })
    await service.load()
    expect(service.getSnapshot().data.row).not.toBeNull()
  })
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/qianzigu/chapter-progress.test.ts`
Expected: FAIL —— 第一个用例拿到 `row` 不为 `null`

- [ ] **Step 3: 实现校验**

`src/features/qianzigu/chapter-progress.ts`:

1. 顶部加 import:

```ts
import { CHAPTER_1 } from './ch1'
```

2. 在 `createChapterService` 上方加一个纯函数:

```ts
/** 存档作废门:restoreState 里出现本章词表之外的 id,说明是旧版本章节留下的,一律丢弃。 */
function belongsToChapter(restoreState: string, wordIds: readonly number[]): boolean {
  let parsed: unknown
  try {
    parsed = JSON.parse(restoreState)
  } catch {
    return false
  }
  if (!Array.isArray(parsed)) return false
  const known = new Set(wordIds)
  return parsed.every(
    entry => typeof entry === 'object' && entry !== null
      && known.has((entry as { wordId?: number }).wordId ?? NaN),
  )
}
```

3. `load()` 里,把

```ts
        const row = remote ? { ...remote, updatedAt: new Date().toISOString() } : null
```

改为

```ts
        const valid = remote !== null && belongsToChapter(remote.restoreState, CHAPTER_1.wordIds)
        const row = valid ? { ...remote, updatedAt: new Date().toISOString() } : null
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/features/qianzigu/chapter-progress.test.ts`
Expected: PASS

- [ ] **Step 5: 全量回归**

Run: `npx tsc -b && npm test`
Expected: 全绿

- [ ] **Step 6: Commit**

```bash
git add src/features/qianzigu/chapter-progress.ts src/features/qianzigu/chapter-progress.test.ts
git commit -m "fix(qianzigu): 存档载入校验词 id 归属,旧版本 ch1 进度作废不残留"
```

---

### Task 7: 设计文档同步 —— 三份旧角色体系文档重写

**Files:**
- Modify: `docs/design/game-story-bible.md`
- Modify: `docs/design/game-direction.md`
- Modify: `docs/design/game-assets.md`
- Modify: `docs/design/game-visual.md`(**plan 原稿漏列** —— 视觉接缝权威文档,密集描述旧角色与已删概念,见 Step 3b)
- Modify: `docs/PLAN.md`(0.3.0 轨那一行)

**Interfaces:**
- Consumes: 本计划全部前序产出(文档是对已落地事实的**描述**,必须在代码落地之后写)
- Produces: 三份文档与新 canon 一致,不再描述旧角色。

**为什么**:这三份文档整篇都在描述旧体系(太阳/月亮当角色、静默黑影、旧台词),落地后不改 = canon 漂移(spec 附录已标)。

- [ ] **Step 1: `game-story-bible.md` 重写**

- §0 命名权威:角色行改为 `苏灵灵🦊 · 徐万年🦥 · 皮小闹🦝 · 吴铭🦇(绰号,谐音「无名」;小名 小明;真名 常默) · 旁白📖` —— **无群众位**(spec D12);反派行改为「吴铭(藏名字)」。
- §1 主题命题改为「**叫得出名字,就有人记得你**」;logline 改为苏灵灵视角。
- **§3 角色台账 = 本 Step 的核心**:写入下方 Step 1b 的 4 张 **11 栏一页卡**。这是全季角色 canon 的**唯一权威位置**;spec §4.5 只放指针。姓名写法对 spec §4.1,外貌锚**只此一份**(视觉侧引用不复制)。
- **同节末尾加「新增角色规程」**:把 spec §4.6 的 6 处同步点 + 命名纪律抄入(后续章节加新居民时,执行者看的是 bible,不是这份 spec)。

**§3 结构裁定(避免双份 canon)**:现 §3 是**按字段切面**的六节(3.1 总表 / 3.2 声纹卡 / 3.3 外貌锚 / 3.4 显影计划 / 3.5 关系图 / 3.6 跨章状态机 / 3.7 现状缺口),全部描述旧角色。一页卡是**按角色聚合**,11 栏已完整覆盖 3.1/3.2/3.3/3.4/3.6 的全部字段 —— **这些切面表由一页卡取代并删除**,否则同一条设定存两处 = 漂移源(spec 最忌)。
**但下列「跨角色规则」不属于任何单个角色的一页卡,必须原样保留并随新体系改写**(它们是机制约定,不是角色字段):
- **人称即分工**:旁白 = 第三人称叙述 / 过场 / 结果陈述;角色泡 = 指令 / 提问 / 情绪 / 交际。
- **旁白框视觉最弱**(顶部虚线小字 `text-sm text-ink-2`)→ 指令与高潮时刻必须留在角色泡里。
- **遮名测试判据**(遮住角色名仍能辨出说话者)+ **教学句豁免**(教学场面单说话者、读音须干净,故按设计用中性指令腔)。
- **功能位角色不该有弧光**的守则(主角的成长不可被抢)。
- 3.5 关系图 → 换成 Step 1b 的新图。
- 3.7 现状缺口 → 更新:旧欠账随旧体系作废;新欠账 = 吴铭的伤口/弧光待全篇框架定。
- **旧「墨迹」(反派二)随旧体系作废** —— 新 canon 只有 `changmo` 一人三名(吴铭/小明/常默)。**旧「太阳 4 档 / `SUN_STAGE_EMOJI`」外貌锚随 Task 3 的代码删除一并作废。**

**Step 1 补齐范围 —— 下列三节同样全是旧 ch1,plan 原稿漏列(Step 1b 末尾已覆盖 §4/§6,不重复),本次一并改**(文档是对已落地事实的描述,故以 Task 4 落地的 `ch1.ts` 与 spec 为准):
- **§5 分镜与演出锚点**:整表按新 ch1 重写(舞台 `stage` 数据 / `mood` 落点 / 视觉音效钩子);表下「`mood` 现 0 处」这条**事实**须对 `ch1.ts` 重新核实后再写。
- **§7 现状 vs 规划**:删旧台词分布统计(灵灵 52 / 太阳 9 / …);把已被本次推翻的「**角色集与 `SpeechRole` 未动**」改写为本次重设事实。
- **§8 指针**:核对 `docs/ideas/260908-*` 是否仍存在、是否仍为权威 —— 若已过时,改指本 spec 与三份 `docs/design/*`。

- [ ] **Step 1b: 4 张角色一页卡(逐字写入 §3 角色台账)**

```text
姓名 / 年龄 / 身份: 苏灵灵 / 约 9 岁 / 千字谷镇的小狐狸,镇上跑得最快的人
欲望 want(外部目标,推情节): 谁有麻烦就第一个到,把每件事都办顺
需求 need(内在缺失,定结局品质): 明白「不帮忙也值得被记住」—— 她现在把「帮上忙」当成「被需要」的证明
伤口(何时发生了什么): 一年前集市,她走散了一整天;回到家,没人发现她不见过
谎言(因此相信了哪句错话): 「只要我一直帮得上忙,就不会被忘掉。」
弧光三态 · 起点信念 → 破防点 → 终点: 帮忙=被记住 → 撞见一个「没人帮也照样被记得」的人(吴铭的反面) → 为一个名字付出代价,学会不居功
声纹(句长 / 口头禅 / 禁用语 + 例句): 短句快节奏,爱用感叹;「我来！」「这个我会！」;禁说「我不行」
  例句:「我来！徐爷爷你站着别动,我去看看。」
外貌锚(主色 / 形态 / 剪影记忆点 / 状态变体): 主色 #E8703A 橙红 / 小狐狸,大尾巴 / 剪影=尖耳朵+蓬尾 / 变体:普通·跑动·失望垂耳
显影计划(哪一场演出这条设定): ch1 全程 —— 拦下卡壳的徐爷爷、不居功地把事办完(want 显形);settle 里没听懂那句怪话,却记住了
跨章状态(本章末 → 下章入口条件): ch1 末 = 隐约觉得徐爷爷忘的「不对劲」,但没追问
与主角的关系(压力 or 镜像): 主角
```

```text
姓名 / 年龄 / 身份: 徐万年 / 70 上下 / 千字谷镇的老住户,修东西的人
欲望 want: 把手上没修完的东西修完
需求 need: 承认自己记性不行了,肯让人帮
伤口: 年轻时是镇上记性最好的人 —— 全镇人的名字他都背得出来,现在开始忘
谎言: 「东西还在,只是我没找到。」(不肯承认是忘了)
弧光三态: 我还能自己来 → 当众卡壳 → 接受被帮,并说出第一句「我忘了」
声纹: 慢、拖长音、爱重复;「哎哟……」「那个,那个啥来着?」
  例句:「那个……那个会发光的,叫啥来着?」
外貌锚: 主色 #9C8C7A 灰褐 / 树懒,慢 / 剪影=圆背+长胳膊 / 变体:笑·困惑·打盹
显影计划: ch1 全程 —— 忘房子/门/钥匙/窗户/台灯;settle 那句「这个我天天都记得的呀」= 轻线第一痕
跨章状态: ch1 末 = 灯亮了,却忽然对一件「天天记得的事」失忆,没答话
与主角的关系: 施压者(他的麻烦是章节发动机);轻线接口
```

```text
姓名 / 年龄 / 身份: 皮小闹 / 约 7 岁 / 浣熊,比灵灵小
欲望 want: 什么都想看看、试试
需求 need: 学会「先问再做」
伤口: 闯祸总被骂「你就是捣乱」—— 后来干脆认下这个名
谎言: 「反正大家都觉得我会搞砸。」
弧光三态: 手比脑子快 → 真闯了大祸 → 第一次先问再做
声纹: 快、插话、爱反问;「我就看一眼！」「不是我干的啊！」
  例句:「我就看一眼！……哎,它怎么散了?」
外貌锚: 主色 #6E7379 灰 + 黑眼罩纹 / 浣熊 / 剪影=黑眼圈+条纹尾 / 变体:兴奋·心虚·得意
显影计划: ch1 social 场景 —— 冒冒失失撞了徐爷爷;3 选项测灵灵怎么对他
跨章状态: ch1 末 = 被灵灵护过一次,开始黏她
与主角的关系: 被照顾者;隐性镜像(同为「想被看见」)
```

```text
姓名 / 年龄 / 身份: 吴铭(本名 常默) / 不详 / 千字谷镇屋檐下的蝙蝠,独来独往
欲望 want: 让所有人都尝尝被叫不出名字的滋味
需求 need: 被叫对一次名字
伤口: 他是镇上最早被忘掉的人 —— 何时、为何,[待全篇框架定]
谎言: 「名字本来就不重要。」
弧光三态: 名字不重要 → 被叫对 → [待全篇框架定]
声纹: 极短,少到反常;「……没什么。」(声纹本身就是「话少」)
  例句:「……没什么。」
外貌锚: 主色 #3A2E4A 深紫黑 / 蝙蝠 / 剪影=展翅斗篷形+圆耳 / 变体:倒挂·侧目·展开
显影计划: ch1 —— 不出场;只在 settle 钩子里被指向
跨章状态: ch1 末 = 尚未现身,已动了手
与主角的关系: 镜像(主题反面 —— 灵灵怕被忘,他已被忘)
```

**同节加关系图**:

```text
              徐万年(施压者 · 轻线接口)
             ╱                          ╲
     苏灵灵 ──── 互为镜像 ────→ 吴铭
             ╲                          ╱
              皮小闹(被照顾者)   ← 缺席却在场:常默的真名
```

- **影子字段纪律**:每栏必须有演出落点;写不出落点的栏 = 删栏或补戏。吴铭的「伤口 / 弧光终点」**明标待定**,不编 —— 但它同时是**欠账**,写全篇框架时必须还。
- **外貌锚 hex 是建议值**:视觉侧可调,调则改此卡(唯一事实源),不在 `game-assets.md` 另行复制。
- §4 章节结构契约:场景序改为 `open → t1-sound → t1-shape → br1 → t2-sound → t2-shape → br2 → social-pixiaonao → br3 → t3-sound → t3-shape → t4-sound → t4-shape → t5-sound → t5-shape → boss → ending → settle`。
- §6 伏笔台账:保留「轻线 = 吴铭藏名字」;ch1 已埋项 = settle 的「这个我天天都记得的呀」。
- ⚠ 台词一律**不放**进本文(唯一事实源 = `ch1.ts`)。

- [ ] **Step 2: `game-direction.md` 重写**

逐幕表按新 18 幕更新(`social-moon` → `social-pixiaonao`,删 `sun` 天空体相关行,`mood` 落点按新 `ch1.ts` 实况,**不得**保留 `sky:['sun']` 描述)。§0 全局规则表里「天空体」一行相应改写。
**同文档另需改的小节(plan 原稿漏列)**:
- §1 逐幕各小节的**标题**仍挂旧角色/旧词名(`1.2 词 1「太阳」(1)` / `1.3 词 2「升起」(101)` / `1.4 社交事件:安慰月亮` / `1.5 词 3「亮」(102)…` / `1.6 BOSS:静默的挑战`)→ 按新词序(房子/门/钥匙/窗户/台灯)与新剧情(徐爷爷的记忆闹剧、皮小闹冒失)重写。
- **§3 节奏表**与 **§4 现状 vs 规划**:核对是否含旧角色/旧事实,按落地情况更新(§3 自带「未实测,勿当事实」声明,保留该声明)。

- [ ] **Step 3: `game-assets.md` 重写**

角色锚点块替换为新班底(苏灵灵🦊 / 徐万年🦥 / 皮小闹🦝 / 吴铭🦇)**+ 旁白📖(无立绘,明写「不产素材」)**;删除旧太阳/月亮立绘 prompt 与太阳 4 档描述;**无群众位**。**同时补** `game-visual-design` 技能要求的**3/4 侧视图 + 表情集(6–9 格)+ 道具 + 配色板(hex)**字段(该文档现缺这两项 —— `docs/PLAN.md` 想法池已有对应行)。

> ⚠ **外貌锚不在此复制**:从 `game-story-bible.md` 的角色一页卡**引用**(主色 hex / 形态 / 剪影记忆点)。两处各存一份 = 漂移源。

- [ ] **Step 3b: `docs/design/game-visual.md` 接缝表同步(preflight 漏列)**

该文档是**视觉接缝的权威指针**(仓库 `CLAUDE.md` 的「按需参考」表直接指向它),但它整篇按旧体系写,且**多处已与落地代码矛盾** —— 留着会让后来者按错的 `SpeechRole` 写代码:

- 约 `:30` 「**`SpeechRole` 六字面量** = lingling 灵灵🦊 / sun 太阳☀️ / moon 月亮🌙 / jingmo 静默🖤 / narrator 旁白📖 / villager 居民🐰」→ 改写为**终态五值**:`lingling` 苏灵灵🦊 / `xuwannian` 徐万年🦥 / `pixiaonao` 皮小闹🦝 / `changmo` 吴铭🦇 / `narrator` 旁白📖(无群众位)。这是本 Step 最高优先项。
- 提 `SUN_STAGE_EMOJI` / 「太阳 4 档」/ 「太阳档素材」/ 「月星」的各行(约 `:19,22,33,37,43`)→ 按 Task 3 的落地事实改写:太阳位**固定单态**(无分档)、`SUN_STAGE_EMOJI` 与月星已删、`stage-visuals.ts` 的导出清单同步。
- 约 `:43` 「真夜幕(night/dark)隐太阳留月星」→ 「真夜幕隐太阳」(月星已删)。
- **保留**:该文档的接缝纪律(「勿组件内联绕过」「位图升级先 PLAN」)与 token / 组件名映射 —— 只改与旧角色、已删符号相关的部分。

- [ ] **Step 4: 更新 `docs/PLAN.md`**

两处:

1. 0.3.0 轨那一行:把「**上游待办**:三份旧角色体系文档需同步重写」改为「文档已同步」;行首 `[ ]` 视落地情况保留(发布前闸门 = 浏览器走查)。
2. **想法池「星语群岛 v10 方向(角色差异化叙事)」整节** —— 该节的「5 角色 5 世界 / 新增 绘画·万色谷 / 数学·百数塔 / 音乐·七音森 三世界」与 **D1「全游戏收敛为汉语世界」直接冲突**。整节删除,并在原地留一行留痕:

```markdown
> **已废弃(2026-09-10)**:「星语群岛五世界」方向被 D1「全游戏收敛为汉语世界」取代,详见
> [千字谷镇重设 spec](superpowers/specs/2026-09-10-qianzigu-town-redesign-design.md)。原节内容见 git 历史。
```

> 同节内「汉语并轨」条目**不受影响** —— 它已立项走在 0.3.0 轨,保留。

- [ ] **Step 5: 复核无旧名残留**

```bash
grep -rn "静默\|太阳的求救\|成长守护者\|星语群岛\|万象树\|墨迹" docs/design/ docs/PLAN.md
grep -rn "🐾\|villager\|居民" docs/design/ docs/PLAN.md
grep -rn "灵灵" docs/design/ docs/PLAN.md | grep -v "苏灵灵"
grep -rn "月亮🌙\|太阳☀️\|静默🖤\|居民🐰" docs/design/ docs/PLAN.md
```

Expected: **四条都应无输出**。
- 第 3 条把 `苏灵灵` 排除后应彻底为空 —— 裸「灵灵」= 违反 spec §4.1 命名权威。
- 第 4 条专抓**带 emoji 的旧角色写法**;不带 emoji 的「太阳」**不作判据** —— 因为**布景太阳**是合法保留物(天幕太阳位 / 「太阳天空体」/ `[data-sun]`,spec 设计明确保留),「月亮」同理需区分:作为**夜景/月色布景描述**合法,作为**角色**非法。
- 第 2 条里 `居民` 作**普通名词**(「镇上的居民」)出现属正常;但**不得**作为**角色名/角色位**出现(`🐾`、`villager` 应无输出)。
**不在本次范围**(时间点记录,不回改):`docs/ideas/*`(历史构想)、`docs/superpowers/specs/2026-09-08-*` 与 `2026-09-09-*`(已定稿的旧 spec)、`docs/.tmp/*`(本地不入库)、`CHANGELOG.md`(只追加),以及 **`docs/PLAN.md` 里 `[x]` 已完成条目**。

> ⚠ **`[x]` 条目是时间点交付记录,只加注不改写**(裁定 2026-09-10,Task 7 fix round 1):判据四条只约束 `docs/design/*` 与 PLAN.md 的**在办/方向性文字**(`[ ]` 条目、想法池、轨标题)。`[x]` 条目内的历史名 —— 0.2.0 发音首响优化行的普通词「静默暖机 / 不静默丢」(「静默」在此是普通汉语词,非旧角色名;`docs/dev-reference.md` 同词在用)、旧 ch1 纵切片行的旧章名《太阳的求救》 —— **保留原样**,需要时只追加「已由 2026-09-10 镇重设替换」这类指针。为让 grep 变空而改写已交付历史 = 篡改记录,比残留更坏。

> 同理:Step 4 的「星语群岛 v10 方向」整节删除**只删与世界方向绑定的条目**;该节中**与五世界无关**的独立想法(英语 5 层教学结构 / 词库分级 + 每词多维度字段 / 屏幕时间守卫 / 分角色分技能学习报告)必须**逐条搬回想法池**,不得随节一起消失 —— PLAN 是需求唯一事实源,想法沉进 git 历史 = 静默丢弃。留痕文字不必写出「星语群岛」全名(那会撞判据 1),「五世界方向已废弃」即可。

- [ ] **Step 6: Commit**

```bash
git add docs/design/ docs/PLAN.md
git commit -m "docs(qianzigu): 三份设计文档同步千字谷镇新角色体系与 ch1"
```

---

## 收尾验收(spec §11)

- [ ] `npm test` 全绿(含 `ch1-script.test` / `speech.contract.test` / `architecture.test`)
- [ ] `npx tsc -b` 无输出
- [ ] `npm run lint` 通过
- [ ] **浏览器人工走查 18 幕**(无 headless 工具 → 必须真人在浏览器点完):开场 → 5 词双层 → 3 断点 → social(3 选项各点一次)→ BOSS(含故意答错 3 次看 lose)→ ending → settle
- [ ] **存档作废行为实测**:带旧 ch1 存档的账号进入,应从头开始,不停在半通状态
- [ ] 命名残留 grep 复核(Task 5 Step 8 / Task 7 Step 5)
- [ ] 角色 emoji 撞库复核:无 `ROLE_META` 的 emoji 出现在 `words.ts`
- [ ] **无通用群众位复核**:`SpeechRole` 恰 **5** 值;`ROLE_META` 恰 **5** 项;`SPEECH_ROLE_VOICE` 恰 **5** 项;全仓无 `villager`(spec D12)
- [ ] **角色一页卡已落地**:`docs/design/game-story-bible.md` §3 角色台账含 4 张 11 栏卡(含外貌锚 hex),吴铭的待定栏已明标「待全篇框架定」
