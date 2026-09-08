# 千字谷跑章漫画舞台化 · Plan 3/3:stage-ch1(ch1 舞台字段补编 + 冒烟 + 人工验收走查)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 ch1《太阳的求救》内容数据补上舞台元数据(`stage.cast` / `stage.atmosphere` / 个别台词 `mood`),使 Plan 1-2 的舞台系统在真实章节里呈现"编排好的同框阵容 + 氛围渐变";补一条自动化冒烟(开场同框 + 台词)验证数据与舞台接线;最后按 spec §13 做浏览器人工验收走查并就地打磨配色。

**Architecture:** 只改 `ch1.ts` 数据(加字段不改台本)+ 少量测试;引擎零改动(字段不被引擎读)。

**Tech Stack:** 纯数据 + vitest;无新依赖。

**Spec:** `docs/superpowers/specs/2026-09-09-qianzigu-manga-stage-design.md` §8(ch1 补编清单)+ §13 验收。**前置**:Plan 1(core)+ Plan 2(scenes)已合并。

## Global Constraints

- 台本(text)**一字不改**;只允许在 scene 对象上加 `stage`、在个别 line 对象上加 `mood`。
- `CHAPTER_1` 结构/场景顺序/id/`wordIds`/`restoreOrder` 不变;`engine.test`/`ch1.test` 零改动仍绿。
- `mood` 只标情绪显著句(sad/happy/scary),calm 一律不写(省噪音,UI 已回退 calm)。
- `stage.cast` 仅在多角色同框/提前站场有意义的幕标(开场/social/boss/ending);task 幕靠展示组首现序推导已够(灵灵 + 收尾词角色),不逐行手填。
- 走查配色微调只进 `src/index.css` `.stage-sky--*` 或 `stage.tsx` 类;结构性视觉问题记 spec §10 待办,不在此返工。

---

### Task 1: ch1 舞台字段补编(ch1.ts)

**Files:**
- Modify: `src/features/qianzigu/ch1.ts`
- Test: `src/features/qianzigu/stage-meta.test.ts`(补一条用 CHAPTER_1 的推导/预设合成断言)

**Interfaces:**
- Consumes: Plan 1 `castFor`;chapter `stage?`/`mood?`。
- Produces: ch1 各幕的编排字段(Plan 1-2 UI 消费)。

- [ ] **Step 1: 写失败测试(数据契约:开场同框编排生效)**

`stage-meta.test.ts` 追加:

```ts
import { CHAPTER_1 } from './ch1'
import { castFor } from './stage-meta'

it('CHAPTER_1: 开场幕 cast 预设 + 台词推导 → 灵灵+太阳同框(无旁白)', () => {
  const open = CHAPTER_1.scenes[0]
  expect(open.kind).toBe('dialogue')
  expect(open.stage?.atmosphere).toBe('dawn')
  expect(open.stage?.cast).toEqual(['lingling', 'sun'])
  expect(castFor(open.lines, open.stage?.cast)).toEqual(['lingling', 'sun'])
})

it('CHAPTER_1: 结局幕 atmosphere=day(全彩),阵容=居民+灵灵', () => {
  const ending = CHAPTER_1.scenes.find((s) => s.kind === 'ending')!
  expect(ending.stage?.atmosphere).toBe('day')
  expect(castFor(ending.lines, ending.stage?.cast)).toEqual(['villager', 'lingling'])
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/qianzigu/stage-meta.test.ts`
Expected: FAIL(`CHAPTER_1` 暂无 `stage` 字段)。

- [ ] **Step 3: 补编 ch1.ts(只加字段,不改台本)**

按 `scene.id` 逐条在对应对象上追加字段;`stage` 放该 scene 对象内(与 `kind` 等并列)。

| scene.id | 追加 `stage` | 额外 `mood` |
|---|---|---|
| `open` | `stage: { cast: ['lingling','sun'], atmosphere: 'dawn' }` | sun 求救句(`救...救救我...`)→ `scary`;灵灵求助末尾 `你的形状也被墨迹涂花了` 保持 calm(不写) |
| `t1-sound` | `stage: { atmosphere: 'dawn' }` | — |
| `t1-shape` | `stage: { atmosphere: 'dawn' }` | villager `有光了...!` → `happy` |
| `br1` | `stage: { atmosphere: 'night' }` | — |
| `t2-sound` | `stage: { atmosphere: 'dawn' }` | — |
| `t2-shape` | `stage: { atmosphere: 'day' }`(升起后转亮) | lingling `太阳升起来了!天空变亮了!` → `happy` |
| `br2` | `stage: { atmosphere: 'night' }` | — |
| `social-moon` | `stage: { cast: ['lingling','moon'], atmosphere: 'night' }` | moon `大家都喜欢太阳...没有人喜欢我...` 与 `好孤单...` → `sad`;onGood `真的吗?谢谢你!` → `happy` |
| `br3` | `stage: { atmosphere: 'night' }` | — |
| `t3-sound` | `stage: { atmosphere: 'dawn' }` | — |
| `t3-shape` | `stage: { atmosphere: 'day' }` | — |
| `t4-sound` | `stage: { atmosphere: 'day' }`(早晨) | — |
| `t4-shape` | `stage: { atmosphere: 'day' }` | sun `早上好!` / villager `早上好!` → `happy` |
| `t5-sound` | `stage: { atmosphere: 'night' }`(夜空找星星) | — |
| `t5-shape` | `stage: { atmosphere: 'night' }` | lingling `星星也回来了!` → `happy` |
| `boss` | `stage: { cast: ['jingmo','lingling'], atmosphere: 'dark' }` | jingmo intro 三句 → `scary`;win `不可能...!我还会回来的!` → `scary` |
| `ending` | `stage: { atmosphere: 'day' }`(cast 不必填,推导=居民+灵灵) | villager 欢呼两句 → `happy` |
| `settle` | `stage: { atmosphere: 'day' }`(cast 无:结算卡承载) | — |

> 编辑要点:给 line 加 mood 是把单个元素 `{ role: 'sun', text: '救...救救我...' }` 扩为 `{ role: 'sun', text: '…', mood: 'scary' }`。`stage` 字面量类型由 `StageMeta` 提供;`cast` 数组用角色名字面量(TS 按 `SpeechRole` 校验)。

- [ ] **Step 4: 跑测试确认通过 + 全量回归**

Run: `npx vitest run src/features/qianzigu/stage-meta.test.ts && npx tsc -b && npm test`
Expected: 全绿(引擎/进度/ch1 逻辑零回归——数据字段引擎不读)。

- [ ] **Step 5: Commit**

```bash
git add src/features/qianzigu/ch1.ts src/features/qianzigu/stage-meta.test.ts
git commit -m "feat(qianzigu): ch1 舞台字段补编(cast/atmosphere/mood;台本不改)"
```

---

### Task 2: ch1 冒烟 + 接线回归(open 幕舞台渲染)

**Files:**
- Test: `src/features/qianzigu/ChapterRunnerView.test.tsx`(追加 CHAPTER_1 冒烟)

**Interfaces:**
- Consumes: `CHAPTER_1`、`renderRunner`(现 helper;makeFakes vocabulary 仅含 word1,不影响 dialogue 首屏)。

- [ ] **Step 1: 写测试(CHAPTER_1 开场幕渲染为同框舞台)**

`ChapterRunnerView.test.tsx` 追加:

```tsx
it('CHAPTER_1: 开场 dialogue 渲染为同框舞台(灵灵+太阳名字牌 + 首句泡)', async () => {
  renderRunner(CHAPTER_1)
  expect(await screen.findByText('千字谷到了！但是...好暗啊...')).toBeInTheDocument()
  expect(screen.getByText('灵灵')).toBeInTheDocument()
  expect(screen.getByText('太阳')).toBeInTheDocument()
})
```

- [ ] **Step 2: 跑测试确认通过**

Run: `npx vitest run src/features/qianzigu/ChapterRunnerView.test.tsx`
Expected: 本用例 PASS(证明:ch1 数据 `stage.cast` 使 open 幕 `castFor` = 灵灵+太阳,舞台屏同框渲染;氛围 dawn 背景 class 出现)。若因 makeFakes 的 `speech.speakRole` mock 不抛错、`celebrate` 等未触即过;首屏不触发 settle。

- [ ] **Step 3: 全量回归 + lint**

Run: `npx tsc -b && npm test && npm run lint`
Expected: 全绿。

- [ ] **Step 4: Commit**

```bash
git add src/features/qianzigu/ChapterRunnerView.test.tsx
git commit -m "test(qianzigu): CHAPTER_1 开场舞台同框冒烟"
```

---

### Task 3: 浏览器人工验收走查(spec §13 全量)

**Files:**
- 条件性修改:`src/index.css`(`.stage-sky--*` 配色/明暗)、`src/features/qianzigu/stage.tsx`(间距/字号),若走查发现问题。

- [ ] **Step 1: 本地全流程走查**

Run: `npm run dev`
按 spec §13 清单逐条(含 Plan 2 已查项)重点核对舞台化后的最终观感:

```
□ ch1 全流程:开场灰白同框对话 → 5 任务(浮层题卡)→ 社交(月夜同框)→ BOSS(静默登台)→ 结局全彩 → 结算
□ 全窗即舞台:宽/窄窗角色站位与浮层不溢出、不滚屏;返回地图按钮可达
□ 同框多人:开场 灵灵+太阳、社交 灵灵+月亮 轮说(说者动、其余 idle);cast 编排生效
□ 角色旁漫画泡锚定说者、带尾、不遮挡;点画面与按钮皆可推进;自动朗读随句
□ narrator/无站队旁白:若有旁白行居中叙述框(当前 ch1 无 narrator 台词——仅确认不崩)
□ 场景两态:dawn 灰 → 词点亮 → day/night 分幕氛围;结算叠彩化天空
□ task/social/boss 浮层可读;判分/两段式/重试不回归
□ mood 情绪句:哭诉 sad / 恐吓 scary / 欢呼 happy 气泡边框与动效到位且不喧宾
□ 断点续玩 / 星尘结算 / 语音降级 无回归
```

- [ ] **Step 2: 记录或就地修**

配色/明暗/间距问题就地改 `src/index.css`/`stage.tsx`;结构性不足(如想逐元素场景精细编排/白闪转场)记 spec §10 待办,不入本 plan。

- [ ] **Step 3: 回归 + Commit**

Run: `npm test && npm run lint`
Expected: 全绿。

```bash
git add -A
git commit -m "style(qianzigu): ch1 舞台走查配色/间距打磨"
```

- [ ] **Step 4: 更新 PLAN 进度(可选)**

若用户要求把「跑章漫画舞台化」P1 行标到当前迭代/排期,在 `docs/PLAN.md` 操作并附本三 plan 链接(依仓库纪律,由用户在发版口径下决定是否上 feature 轨)。

---

## Self-Review

**Spec 覆盖(ch1/验收部分):** §8 补编表 → Task 1;§13 验收 → Task 2(冒烟子集)+ Task 3(人工全量)。Plan 1-2 遗留的 task/social/boss 判分回归由 Task 3 浏览器 + Plan2 全量测试兜底。

**占位扫描:** 无 TBD;表内每 scene 给出可照抄的 `stage` 字面量与 mood 落点。颜色不做像素承诺,以"就地打磨"为验收动作(非占位——指明确文件)。

**类型一致性:** `CHAPTER_1` 场景类型随 chapter `stage?`(Plan1 Task2)演进;`castFor` 用法与 Plan 1 一致;mood 值 `scary/sad/happy` 均在 `SpeechMood` 并集内(calm 不写)。

**风险注:** Task 1 需逐 scene 手编(约 18 处),编辑量大但机械;提交前务必 `npx tsc -b` 校验 `cast` 字面量与 `SpeechRole` 对齐,避免误把角色名写错(如 `villager`)。Task 2 若 makeFakes 对 ch1 开场后续 scene 抛错(不会:首屏即 dialogue,不触其他 scene),可在冒烟前加 `row` 快进,但当前无需。
