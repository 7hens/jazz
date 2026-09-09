# 千字谷跑章 · 舞台布景实景化 + 太阳复原(spec §15 补充批)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `StageSky` 从「氛围渐变 + 顶部词 emoji 点灯条」升级为**千字谷实景布景 + 太阳本体进度尺**:全窗竖分布景(云/太阳位/山壁/村庄/河流/月星),太阳以「烧焦的鸡蛋→☀️」4 档随 restore 复原(删词条),布景随进度灰暗→回春上彩;`StageMeta` 增可选 `sky?` 让 sun 当幕可作天空体就地说话。引擎/进度/语音/speech 契约零改动。

**Architecture:** 纯 `qianzigu` 呈现层。数据/氛围裁决仍走 `stage-meta`(纯函数)+ `stage-visuals`(视觉映射接缝);`StageSky`(stage.tsx)就地改造成布景层;`DialoguePresenter`/`ChapterRunnerView` 只改接线(算 `fraction`、弃 `skyWords`、天空体泡泡锚布景太阳)。`chapter.ts` 加一个全可选字段。

**Tech Stack:** 同前(React + motion + Tailwind + emoji/CSS;无新依赖、无位图)。

**Spec:** `docs/superpowers/specs/2026-09-09-qianzigu-manga-stage-design.md` **§15**(补充批全节)+ §7.2 交叉注。前置:core+scenes 已合(StageFrame/StageSky/StageCast/DialoguePresenter/stage-meta/stage-visuals 均在)。

## Global Constraints

- `engine.ts` 零改动;纯逻辑测试(engine.test/ch1.test)不改仍绿。
- 不新增用户数据/不落库;无 worker/DB/migration 改动。
- 位图接缝纪律:舞台 UI 不内联 emoji/样式,一律经 `stage-visuals.ts` / 样式 token(`src/index.css`);将来换位图只改映射。
- `StageMeta` 新字段**全可选**,缺省 = 现状(全员地面、词条→不再点灯但布景常驻、氛围兜底不变),旧 chapter 数据不崩。
- 每 task 后:`npx vitest run src/features/qianzigu` 绿 + `npm test` 全量绿 + `tsc -b` 无类型错。

---

### Task 1: 数据 + 纯逻辑(chapter `sky?` + stage-meta 太阳档/回春/月星/天空体分列)

**Files:**
- Modify: `src/features/qianzigu/chapter.ts`(`StageMeta` 加 `sky?`)
- Modify: `src/features/qianzigu/stage-meta.ts`(`SunStage` 类型 + `sunStage`/`progressFraction`/`showMoonStars`/`skySplit`)
- Test: `src/features/qianzigu/stage-meta.test.ts`
- Modify: `src/features/qianzigu/stage-visuals.ts`(太阳 4 档视觉映射 `SUN_STAGE_EMOJI` + 世界灰档 `worldDesatClass`;见 Task 2 消费)

**Interfaces:**
- Consumes: `StageMeta`(chapter.ts)、`AtmosphereKey`/`SpeechRole`。
- Produces(供 Task 2/3/4):
  - `type SunStage = 'burnt' | 'crack' | 'glow' | 'full'`
  - `progressFraction(restoredLen: number, totalLayers: number): number`(夹 [0,1];totalLayers = 章 task 层数)
  - `sunStage(fraction: number): SunStage` — 档阈值 **burnt < 0.2 ≤ crack < 0.5 ≤ glow < 0.8 ≤ full**(ch1:词 1 双技能→脱焦、t3 亮→强光,与叙事对齐)
  - `showMoonStars(fraction: number, atmosphere: AtmosphereKey): boolean` — 规则见 Step 1 注释
  - `skySplit(cast: readonly SpeechRole[], sky: readonly SpeechRole[] | undefined): { ground: SpeechRole[]; sky: SpeechRole[] }`(sky 保留入列且**只保留出现在 cast 的**;narrator 永不 sky)
  - `stage-visuals`: `SUN_STAGE_EMOJI: Record<SunStage, { emoji: string; className?: string }>`(burnt = 🍳 + 焦糊滤镜占位、crack/glow 过渡、full = ☀️ 光晕;className 指向 index.css token)+ `worldDesatClass(fraction): string`(`0 → 满灰`/`≥0.8 → 无色差`,按档给 token)

- [ ] **Step 1: 写失败测试**

`stage-meta.test.ts` 追加:

```ts
describe('太阳档 / 回春 / 月星 / 天空体', () => {
  it('sunStage 按进度分档', () => {
    expect(sunStage(0)).toBe('burnt')
    expect(sunStage(0.1)).toBe('burnt')
    expect(sunStage(0.2)).toBe('crack')
    expect(sunStage(0.5)).toBe('glow')
    expect(sunStage(0.79)).toBe('glow')
    expect(sunStage(0.8)).toBe('full')
    expect(sunStage(1)).toBe('full')
  })
  it('showMoonStars:真夜(dark/night)恒显;失光(dawn 低进度)显;day 复原高进度隐', () => {
    expect(showMoonStars(0, 'night')).toBe(true)
    expect(showMoonStars(1, 'night')).toBe(true)   // 真夜不管进度
    expect(showMoonStars(0, 'dawn')).toBe(true)     // 失光才见星月
    expect(showMoonStars(0.5, 'dawn')).toBe(true)
    expect(showMoonStars(0.9, 'dawn')).toBe(false)
    expect(showMoonStars(1, 'day')).toBe(false)
  })
  it('skySplit:只保留出现在 cast 的天空体;narrator 不进 sky', () => {
    const cast = ['lingling', 'sun', 'moon'] as const
    expect(skySplit([...cast], ['sun', 'narrator'])).toEqual({ ground: ['lingling', 'moon'], sky: ['sun'] })
    expect(skySplit([...cast], undefined)).toEqual({ ground: ['lingling', 'sun', 'moon'], sky: [] })
  })
  it('progressFraction 夹 [0,1]', () => {
    expect(progressFraction(0, 10)).toBe(0)
    expect(progressFraction(5, 10)).toBe(0.5)
    expect(progressFraction(10, 10)).toBe(1)
    expect(progressFraction(12, 10)).toBe(1)
  })
})
```

> `showMoonStars` 规则(与 §15.2 一致):`atmosphere ∈ {night, dark}` → 恒 true(真夜,无视进度);`dusk` → true;否则(`dawn`/`day`)→ `fraction < 0.8` 才 true(失光期可见,复原即隐)。Step 3 实现按此。

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/qianzigu/stage-meta.test.ts`
Expected: FAIL(`sunStage`/`showMoonStars`/`skySplit`/`progressFraction` 未定义)。

- [ ] **Step 3: chapter.ts + stage-meta.ts + stage-visuals.ts 实现**

chapter.ts `StageMeta` 追加(保留现有 cast/atmosphere):

```ts
export type StageMeta = Readonly<{
  cast?: readonly SpeechRole[]
  atmosphere?: AtmosphereKey
  /** 当幕作「天空体」的角色(缺省 = 全员地面):不入 StageCast 地面行,其台词就地由布景对应天体出泡。 */
  sky?: readonly SpeechRole[]
}>
```

stage-meta.ts 新增:

```ts
export type SunStage = 'burnt' | 'crack' | 'glow' | 'full'

export function progressFraction(restoredLen: number, totalLayers: number): number {
  if (totalLayers <= 0) return 0
  return Math.min(1, Math.max(0, restoredLen / totalLayers))
}

export function sunStage(fraction: number): SunStage {
  if (fraction < 0.2) return 'burnt'
  if (fraction < 0.5) return 'crack'
  if (fraction < 0.8) return 'glow'
  return 'full'
}

export function showMoonStars(fraction: number, atmosphere: AtmosphereKey): boolean {
  if (atmosphere === 'night' || atmosphere === 'dark' || atmosphere === 'dusk') return true
  return fraction < 0.8
}

export function skySplit(
  cast: readonly SpeechRole[],
  sky: readonly SpeechRole[] | undefined,
): { ground: SpeechRole[]; sky: SpeechRole[] } {
  const skySet = new Set<SpeechRole>(sky ?? [])
  skySet.delete('narrator')
  const ground: SpeechRole[] = []
  const skyOut: SpeechRole[] = []
  for (const role of cast) {
    if (skySet.has(role)) skyOut.push(role)
    else ground.push(role)
  }
  return { ground, sky: skyOut }
}
```

stage-visuals.ts 新增(位置图接缝;样式 token 在 index.css,Task 2 加):

```ts
import type { SunStage } from './stage-meta'

/** 太阳星体 4 档视觉(emoji + 指向 index.css token 的样式类)。burnt = 烧焦蛋,缺省无单枚 emoji,走滤镜合成。 */
export const SUN_STAGE_EMOJI: Record<SunStage, { emoji: string; className?: string }> = {
  burnt: { emoji: '🍳', className: 'stage-sun--burnt' },
  crack: { emoji: '🌓', className: 'stage-sun--crack' },
  glow: { emoji: '🌤️', className: 'stage-sun--glow' },
  full: { emoji: '☀️', className: 'stage-sun--full' },
}

/** 世界「回春」:低进度满灰(失血),高进度无色差。给布景叠滤镜层用(样式 token 见 index.css)。 */
export function worldDesatClass(fraction: number): string {
  return fraction >= 0.8 ? '' : fraction >= 0.5 ? 'stage-world--half' : fraction >= 0.2 ? 'stage-world--light' : 'stage-world--dim'
}
```

> 注:`sunStage` 的档视觉允许 implementer 微调(如 crack 用 🌥️),以最终观感为准 —— token 收敛在 index.css,位图接缝不破。`worldDesatClass` 与氛围渐变如何叠加在 Task 2 定,本步只给数值→档映射。

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/features/qianzigu/stage-meta.test.ts`
Expected: PASS。

- [ ] **Step 5: 全量回归**

Run: `npx tsc -b && npm test && npm run lint`
Expected: 全绿(chapter.ts 加可选字段、stage-meta/stage-visuals 纯增 → 无既有断言破坏)。

- [ ] **Step 6: Commit**

```bash
git add src/features/qianzigu/chapter.ts src/features/qianzigu/stage-meta.ts src/features/qianzigu/stage-meta.test.ts src/features/qianzigu/stage-visuals.ts
git commit -m "feat(qianzigu): 舞台布景数据与纯逻辑(StageMeta.sky? + 太阳档/回春/月星/天空体分列)"
```

---

### Task 2: StageSky → 实景布景层(stage.tsx + index.css token;词条退役)

**Files:**
- Modify: `src/features/qianzigu/stage.tsx`(`StageSky` 改造成布景层;`StageCast` 支持 sky 分流渲染)
- Modify: `src/features/qianzigu/stage-visuals.ts`(布景元素映射,若需;或内联 token 于 index.css)
- Modify: `src/index.css`(布景 token:`.stage-sun--*`、世界灰档、山/村/河/云层 token)
- Test: `src/features/qianzigu/stage.test.tsx`

**Interfaces:**
- Consumes: Task 1 `sunStage`/`showMoonStars`/`skySplit`/`progressFraction`、`SUN_STAGE_EMOJI`/`worldDesatClass`。
- Produces:
  - `StageSky` 新签名(替换旧 words/restored 词条):`{ atmosphere; fraction; stage?: SunStage; cast?: ... }` —— 见 Step 3 定稿。
  - 布景层结构:天顶云 + 月星(showMoonStars 显)→ 太阳位(4 档,见 §15.1/§15.2)→ 山壁层 → 村庄层 → 河流横贯;世界灰档由 `worldDesatClass(fraction)` 叠加。
  - `StageCast` 增 sky 渲染:sky 角色不出现在地面行;speaker 为 sky 角色时其 talk/名字牌移到对应天体位(本批先接 sun;moon 走通用 sky 落位)。为最小侵入,新导出 `StageSkyCast`(天空体专用位)或在 StageCast 内按 sky 分流。

- [ ] **Step 1: 写失败测试**

`stage.test.tsx` 追加(先锚定「词点灯条退役 + 布景存在」):

```tsx
describe('StageSky 实景布景', () => {
  it('烧焦蛋档渲染 .stage-sun--burnt;词点灯条不再存在', () => {
    const { container } = render(
      <StageSky atmosphere="dawn" fraction={0} />,
    )
    expect(container.querySelector('.stage-sun--burnt')).not.toBeNull()
    expect(container.querySelector('.stage-word')).toBeNull()
  })
  it('月星在 showMoonStars true 时出现、false 时消失', () => {
    const yes = render(<StageSky atmosphere="dawn" fraction={0} />)
    expect(yes.container.querySelector('[data-sky-bodies]')).not.toBeNull()
    const no = render(<StageSky atmosphere="day" fraction={1} />)
    expect(no.container.querySelector('[data-sky-bodies]')).toBeNull()
  })
})
```

> `data-sky-bodies` = 月/星容器钩子(比 emoji 文本断言稳)。太阳位用 `.stage-sun` 容器 + `SUN_STAGE_EMOJI` 的 className 档。

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/qianzigu/stage.test.tsx`
Expected: FAIL(StageSky 仍是词条签名;无 `.stage-sun--*`)。

- [ ] **Step 3: 改造 StageSky(布景)与 StageCast(sky 分流)**

`stage.tsx` 重写 `StageSky`(示意骨架;样式细节依 index.css token 收敛):

```tsx
export function StageSky({
  atmosphere,
  fraction,
  sun = sunStage(fraction),
  moonStars = showMoonStars(fraction, atmosphere),
}: {
  atmosphere: AtmosphereKey
  fraction: number
  sun?: SunStage
  moonStars?: boolean
}) {
  const { emoji, className } = SUN_STAGE_EMOJI[sun]
  return (
    <div aria-hidden className={cn('absolute inset-0', atmosphereToClass(atmosphere), worldDesatClass(fraction))}>
      {/* 天顶云层 */}
      <div className="stage-clouds">☁️ ☁️ ☁️</div>
      {/* 月/星(showMoonStars) */}
      {moonStars ? <div data-sky-bodies className="stage-sky-bodies">🌙 <span className="stage-stars">⭐ ✨</span></div> : null}
      {/* 天幕太阳位(4 档) */}
      <div data-sun className={cn('stage-sun', className)}>{emoji}</div>
      {/* 远景山壁 / 村庄 / 河流 */}
      <div className="stage-mountains">⛰️ ⛰️ ⛰️</div>
      <div className="stage-village">🏠 🏘️ 🌳</div>
      <div className="stage-river">🏞️ ~~~~</div>
    </div>
  )
}
```

(元素排版样式类 `.stage-clouds/.stage-sun/.stage-sky-bodies/.stage-stars/.stage-mountains/.stage-village/.stage-river` 及 `.stage-sun--*`/`.stage-world--*` 均落 index.css;绝对定位 + 渐变 + 滤镜,遵守 reduced-motion。)另删除旧顶部词条(不再读 `words`/`restored`)—— **签名弃 `words/restored`**(旧调用方 Task 3 改)。

`StageCast` 收 `sky` 分流:导入 `skySplit`,地面行只放 ground,天空体移到专门天空槽(本批 `StageCast` 仍只收 ground + 新增可选 `skyFigures`;或新增 `StageCast` 内联天空渲染)。以「不改 DialoguePresenter 调用形状太多」为度,implementer 可把天空体渲染做成 `StageCast` 的一个 prop `sky?: SpeechRole[]` —— 天空体不占地面 flex,说话时其名字牌/动效/泡泡定位交给 Task 3(DialoguePresenter)或先在 StageCast 顶栏简单呈现。

- [ ] **Step 4: 适配既有测试(词条断言 → 太阳/布景断言)**

既有 `stage.test.tsx`(StageSky 词点亮用例)+ 可能 `ChapterRunnerView.test.tsx`(Task 1 场景里的 `.stage-word` 词条断言,如 `opacity-70` 两处)→ 需迁到新语义:词条退役,太阳档随 fraction 变。搜索并改:
- `.stage-word`/`opacity-70` 断言 → 改断 `.stage-sun--*`(按 restoreCount 期望 fraction 后落档)。
- `stage.tsx` `words`/`restored` props 相关渲染删除。

Run: `npx vitest run src/features/qianzigu/stage.test.tsx src/features/qianzigu/ChapterRunnerView.test.tsx`
Expected: 全绿(Task 3 前 runner 侧若传旧 props 会红 —— 见下步说明,必要时先给 runner 传 fraction=0 占位,Task 3 补真接线)。

- [ ] **Step 5: 全量回归**

Run: `npx tsc -b && npm test && npm run lint`
Expected: 全绿。若 `ChapterRunnerView.test.tsx` 因 StageSky 签名变而红,允许本步先把 runner 的 `StageSky` 调用换成 `fraction={restored.length/总层}` 的占位接线(真接线 Task 3),保证 Step 4 绿。

- [ ] **Step 6: Commit**

```bash
git add src/features/qianzigu/stage.tsx src/features/qianzigu/stage.test.tsx src/features/qianzigu/stage-visuals.ts src/index.css src/features/qianzigu/ChapterRunnerView.tsx
git commit -m "feat(qianzigu): StageSky 实景布景层(云/山/村/河/太阳4档/月星;词点灯条退役)+ 世界回春滤镜"
```

---

### Task 3: 接线(DialoguePresenter 天空体出泡 + runner 喂 fraction;弃 skyWords)

**Files:**
- Modify: `src/features/qianzigu/DialoguePresenter.tsx`(弃 `skyWords`;接 `fraction`/`sky`;sun 天空体说话泡泡锚布景太阳)
- Modify: `src/features/qianzigu/ChapterRunnerView.tsx`(`renderDialogue`/`renderStage` 弃 `skyWords`、算 `fraction` 传 `StageSky`;`scene.stage.sky` 透传 DialoguePresenter)
- Test: `src/features/qianzigu/DialoguePresenter.test.tsx` / `ChapterRunnerView.test.tsx`

**Interfaces:**
- Consumes: Task 2 `StageSky` 新签名、`skySplit`、`progressFraction`;chapter 词层数。
- Produces:
  - `DialoguePresenter` props:删 `skyWords`;加 `fraction: number`、可选 `sky?: SpeechRole[]`;内部 `stage.sky` 角色说话 → 泡泡锚天空(先 sun 布景位)。
  - runner:`totalLayers(chapter)` = task scene 数;`fraction = progressFraction(restored.length, totalLayers)`;传布景。
  - `renderStage`/`renderDialogue` 同步弃 `skyWordsOf()`(函数一并删)。

- [ ] **Step 1: 写失败测试**

`ChapterRunnerView.test.tsx` 追加(开场 sun 天空体 + 布景太阳):

```tsx
it('open 屏:太阳作天空体从布景出泡(sun 不进地面行)', async () => {
  const chapter = {
    ...flowChapter(),
    scenes: [
      { id: 'open', kind: 'dialogue',
        lines: [{ role: 'sun', text: '救救我!' }, { role: 'lingling', text: '来啦!' }],
        stage: { sky: ['sun'] as const } },
      { id: 'settle', kind: 'settle', summary: [] },
    ],
  }
  renderRunner(chapter)
  expect(await screen.findByText('救救我!')).toBeInTheDocument()
  // sun 天空体:地面行(StageCast ground)只出现灵灵;太阳台词泡挂布景太阳位(数据断言见 DOM)
  expect(screen.getByText('灵灵')).toBeInTheDocument()
  expect(document.querySelector('[data-stage-bubble]')).not.toBeNull()
})
```

(具体天空体断言以实现为准 —— 目标是「sun 说话不占地面行 + 泡泡仍在」;implementer 可补 `.stage-sun` 旁泡泡断言。)

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/qianzigu/ChapterRunnerView.test.tsx`
Expected: FAIL(现有 open/词条路径或 sun 仍占地面行)。

- [ ] **Step 3: DialoguePresenter 接线**

- props 删 `skyWords`,加 `fraction`(默认计算可省)与 `sky`。
- 顶部阵容由 `castFor(lines, cast)` 得 displayCast 后经 `skySplit(displayCast, sky)` 分 ground/sky;`StageCast` 地面只收 ground;speaker 为 sky 角色时,泡泡与 talk 交给布景对应天体位(sun 位由 `.stage-sun` 容器定位;先实现 sun 天空体专用出泡,`moon` 等其它 sky 角色缺省仍落地面兜底并在 §15.6 记账)。
- narrator 维持居中叙述框不动。

- [ ] **Step 4: runner 接线 + 删 skyWordsOf**

- `ChapterRunnerView`:`totalLayers = chapter.scenes.filter(s => s.kind==='task').length`;`fraction = progressFraction(runState.restored.length, totalLayers)`;`renderDialogue`/`renderStage` 的 `StageSky` 传 `atmosphere` + `fraction`(不再传 words/restored);`DialoguePresenter` 传 `sky={scene.stage?.sky}`。
- 删 `skyWordsOf()` 与模块内残留词条引用;`renderStage`/`renderDialogue` 内 `StageSky` 用新签名。

- [ ] **Step 5: 全量回归 + 既有断言适配**

Run: `npx vitest run src/features/qianzigu && npx tsc -b && npm test && npm run lint`
Expected: 全绿。适配点:凡断言旧词点灯条/`.stage-word` 或天空词 emoji 的用例 → 改断太阳档/布景钩子(以可测意图为准,不删保护性断言)。

- [ ] **Step 6: Commit**

```bash
git add src/features/qianzigu/DialoguePresenter.tsx src/features/qianzigu/ChapterRunnerView.tsx src/features/qianzigu/DialoguePresenter.test.tsx src/features/qianzigu/ChapterRunnerView.test.tsx
git commit -m "feat(qianzigu): 接线实景布景(弃 skyWords;sun 天空体出泡;runner 喂 fraction)"
```

---

### Task 4: ch1 最小数据补编(open sun 天空体 + 幕目标氛围) + 走查收口

**Files:**
- Modify: `src/features/qianzigu/ch1.ts`(仅 stage 字段,台本零改)
- Test: `src/features/qianzigu/ch1-script.test.ts` / `ch1.test.ts`(不破坏,可选补断言)

**Interfaces:**
- Consumes: Task 1-3(chapter `StageMeta.sky?` 已可消费)。
- Produces:ch1 各幕按 spec §15.4 目标态打标 —— 至少 `open` 加 `stage:{sky:['sun']}`(太阳天空体),并按需给 break/social/boss/ending 标 `atmosphere`(用既有 `defaultAtmosphere` 无需标者跳过);台本文案**一个字不改**。

- [ ] **Step 1: 读 ch1.ts 现状 + 记目标**

Run: `npx vitest run src/features/qianzigu/ch1.test.ts src/features/qianzigu/ch1-script.test.ts`(先确认基线绿)。
对照 spec §15.4 表:`open`(dialogue)→ 需 `sky:['sun']`(就地说);`break br1/br2/br3` → 默认即 night,可不标;`social-moon` → 目标 night,需在 scene stage 标 `atmosphere:'night'`(月亮哭诉夜戏)与 cast `['lingling','moon']`(如要同框);`boss` → 目标 dark(默认即 dark,静默 1.5× 由 roleScale 已含);`ending` → day(默认即 day);`settle` → day。

- [ ] **Step 2: 补 stage 字段(最小)**

`ch1.ts` 对应 scene 补 `stage`(按需,台本不动):

```ts
// open(dialogue):太阳天空体,开场就地说(§15.4)
stage: { sky: ['sun'] },
// social-moon(social):夜戏,月亮+灵灵同框(§15.4)
stage: { atmosphere: 'night', cast: ['lingling', 'moon'] },
```

(若该 scene 已带 stage 则合并;其余靠 defaultAtmosphere 的场景**不标**,保持最小。)

- [ ] **Step 3: 跑测试 + 视觉冒烟**

Run: `npx vitest run src/features/qianzigu && npx tsc -b && npm test`
Expected: 全绿。`ch1-script.test`/`ch1.test` 若锁 stage 字段则适配(新增字段对纯逻辑透明)。

浏览器冒烟(有环境时;或用 `?s=1.1.1` debug URL 直跳 open):确认开场烧焦蛋太阳高挂 + 月星同框、太阳台词从天空出泡、灵灵地面;答完词 1 → 太阳裂纹/变亮。

- [ ] **Step 4: Commit**

```bash
git add src/features/qianzigu/ch1.ts src/features/qianzigu/ch1.test.ts src/features/qianzigu/ch1-script.test.ts
git commit -m "feat(qianzigu): ch1 布景数据补编(open sun 天空体;social 夜戏)+ 全量回归"
```

---

## Self-Review

**Spec 覆盖(§15):** §15.3 数据(`sky?`)→ Task 1;§15.1/§15.2 布景构图 + 太阳 4 档 + 月星显隐 + 世界回春 → Task 1/2;§15.2 太阳本体进度尺(删词条)→ Task 2/3;§15.2 天空体就地出泡 → Task 3;§15.4 ch1 幕 × 天空 → Task 4;§15.5 文件影响全列于各 Task Files。§15.6 的 T6 走查延后 → scenes plan T6 延后到本批后执行(见 scenes plan Task 6 顶部注)。

**占位扫描:** 各 Step 给接口/测试/实现锚;布景具体 emoji 排版与 CSS token 允许 implementer 依 §15.1 收敛(index.css token 集中),不整份 dump;无 TBD。

**类型一致性:** `SunStage` 在 Task 1 定义、Task 2/3 消费;`StageSky` 新签名 Task 2 定、Task 3 消费;`progressFraction` 取 `runState.restored.length / task 层数`;`sky` 字段 chapter 定义、stage-meta/runner 消费。`StageCast`/`DialoguePresenter` 签名变化同批内对齐。

**风险注:** Task 2 换签名是最大破坏点(StageSky 所有调用方同批改);测试断言从「词条」迁「太阳档/布景」是本批高频改动 —— 保意图、勿删保护用例。真夜(break/social/boss)布景太阳隐、月星显由 `showMoonStars`(atmosphere 恒 true)保证,不回春冲突。
