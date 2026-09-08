# 千字谷跑章漫画舞台化 · Plan 2/3:stage-scenes(统一舞台壳 + task/social/boss/break/settle 舞台化)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把千字谷运行器从"旧 Shell 滚动卡片"彻底收敛为**全窗舞台**的两种屏——(a) 整屏对话演出 `DialoguePresenter`(Plan 1 提供)承载所有台词展示(task intro / social lines·onGood / boss intro·win·lose / 收尾 overlay / dialogue·ending);(b) `StageFrame + StageSky + 浮层 ScenePanel` 承载任务作答 / 社交选择 / BOSS 题 / 断点 / 结算。删旧 `Shell`/`SkyStrip`;场景氛围与词点亮全屏化。

**Architecture:** 呈现责任上移收口在 `ChapterRunnerView`("该 scene 现在该放哪类屏"),scene 交互组件瘦身为"只出内容"的浮层主体(intro 管理移走);`stage.tsx` 增通用浮层容器 `ScenePanel`;引擎零改动。

**Tech Stack:** 同 Plan 1。复用 `motion`、`Button`、现有作答组件;无新依赖。

**Spec:** `docs/superpowers/specs/2026-09-09-qianzigu-manga-stage-design.md` §6.2(scene 适配矩阵)、§7.1(两态点亮)、§11(scene-ui/runner/index.css)、§13 验收。**前置**:Plan 1(core)已合并,提供 `stage.tsx`(`StageFrame/StageSky/StageCast`)、`DialoguePresenter`、`stage-meta`、`stage-visuals`、chapter 舞台字段。

## Global Constraints

- 引擎 `engine.ts` 零改动;纯逻辑测试(ch1.test/engine.test)零改动。
- runner 服务的 props 注入纪律不变;新状态只放 runner 组件内(useState/ref),不入引擎。
- **两种屏的裁决只在 runner**:`DialoguePresenter` 自带全窗 frame,不再被任何外层 frame 包裹;其余屏一律 `StageFrame` 包裹一次。
- narrator 不走站队、intro/收尾台词里的旁白经 DialoguePresenter 自动处理。
- 移除的旧物:`ChapterRunnerView` 内 `Shell`、`SkyStrip`、`ROLE_META` 的直接依赖(如有)—— `Shell`/`SkyStrip` 删定义;`ROLE_META` 仍留在 scene-ui(其余引用方沿用)。
- 视觉浮层 `ScenePanel` 内长内容可纵向滚动;舞台帧本身 `overflow-hidden` 不滚。
- 每个 task 后:目标 vitest 绿 + `npm test` 全量绿;`tsc -b` 无类型错。

---

### Task 1: 统一舞台壳(StageFrame + ScenePanel + 氛围点亮;删 Shell/SkyStrip)

**Files:**
- Modify: `src/features/qianzigu/stage.tsx`(加 `ScenePanel`)
- Test: `src/features/qianzigu/stage.test.tsx`(补 ScenePanel 用例)
- Modify: `src/features/qianzigu/ChapterRunnerView.tsx`(渲染收敛)
- Test: `src/features/qianzigu/ChapterRunnerView.test.tsx`(适配)

**Interfaces:**
- Consumes: Plan 1 `StageFrame/StageSky/DialoguePresenter`、`defaultAtmosphere`、chapter `stage?`。
- Produces:
  - `ScenePanel({ children, className? }: { children: ReactNode; className?: string })`:舞台上的居中浮层面板(不透明浅底、圆角、内可滚动),用于承载任务/选项/结算等非对白内容。
  - runner 内部收敛为:`renderDialogue(lines, opts)` 与 `stageChrome(children, atmosphere)` 两助手,见下。

- [ ] **Step 1: 写失败测试(ScenePanel + 点亮氛围)**

`stage.test.tsx` 追加:

```tsx
import { ScenePanel, StageFrame, StageSky } from './stage'

it('ScenePanel: 渲染内容于可滚动浮层', () => {
  const { container } = render(
    <StageFrame>
      <ScenePanel>
        <span>答题卡内容</span>
      </ScenePanel>
    </StageFrame>,
  )
  expect(screen.getByText('答题卡内容')).toBeInTheDocument()
  expect(container.querySelector('button')).toBeNull()
})
```

`ChapterRunnerView.test.tsx` 追加(接入 task 屏后天空点亮 + 浮层氛围):

```tsx
it('task 屏整屏舞台化:氛围=scene.stage.atmosphere;答对后 sky 词点亮', async () => {
  const chapter = {
    ...flowChapter(),
    scenes: [
      {
        id: 't1', kind: 'task', title: '拯救声音', intro: [],
        task: { wordId: 1, layer: 'sound', minCorrect: 2 }, onDone: [],
        stage: { atmosphere: 'night' as const, cast: ['lingling'] },
      },
      { id: 'settle', kind: 'settle', summary: [] },
    ],
  }
  renderRunner(chapter)
  const sky = document.querySelector('.stage-sky--night')
  expect(sky).not.toBeNull()
  answer('太阳') // 现有 helper:点选项 → 确定
  answer('太阳')
  // 词 1 恢复 2 次 → sky 词全亮
  const word = document.querySelectorAll('.stage-word')[0] as HTMLElement
  expect(word.className).toContain('opacity-100')
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/qianzigu/ChapterRunnerView.test.tsx src/features/qianzigu/stage.test.tsx`
Expected: FAIL(ScenePanel 不存在;task 屏仍是旧 Shell,无 `.stage-sky--night`)。

- [ ] **Step 3: stage.tsx 加 ScenePanel**

```tsx
/** 舞台浮层面板:内容叠在天空上,可纵向滚动(舞台帧本身不滚)。 */
export function ScenePanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('pointer-events-auto absolute inset-x-0 bottom-0 top-auto z-20 flex justify-center', className)}>
      <div className="mx-auto max-h-[76dvh] w-full max-w-xl overflow-y-auto px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
        {children}
      </div>
    </div>
  )
}
```
> ScenePanel 内部内容沿用现有卡片视觉(白底圆角)不必改观感;只把"放哪"改成舞台浮层。

- [ ] **Step 4: 收敛 ChapterRunnerView 渲染(删 Shell/SkyStrip)**

重构目标(替换文件尾部的 `Shell`/`SkyStrip`/`content` 渲染区):

1. 删 `SkyStrip` 定义(其点亮语义已迁 StageSky)。词元素装配复用 helper:

```tsx
function skyWords(chapter: Chapter): { id: number; emoji: string }[] {
  return chapter.wordIds
    .map((id) => services.vocabulary.wordById(id))
    .filter((w): w is WordUnit => w !== undefined)
    .map((w) => ({ id: w.id, emoji: w.emoji }))
}
```
(置于组件内,闭包拿 `services`;类型 `WordUnit` 已 import。)

2. 定义两个渲染助手(组件内):

```tsx
/** 整屏对话演出(自带 StageFrame):用在 dialogue/ending/intro/收尾 overlay。 */
function renderDialogue(lines: readonly ChapterLine[], opts: { onDone: () => void; doneLabel?: string; onExit?: () => void } ) {
  const scene = chapter.scenes[Math.min(runState.sceneIndex, chapter.scenes.length - 1)]
  return (
    <DialoguePresenter
      lines={lines}
      atmosphere={scene.stage?.atmosphere ?? defaultAtmosphere(scene.kind)}
      restored={runState.restored}
      skyWords={skyWords(chapter)}
      cast={scene.stage?.cast}
      speakRole={speakRole}
      onDone={opts.onDone}
      onExit={opts.onExit}
      doneLabel={opts.doneLabel}
    />
  )
}

/** 非对白屏的统一舞台壳:背景氛围 + 词点亮 + 退出钮 + 浮层面板。 */
function renderStage(body: ReactNode, kind: SceneKind) {
  const scene = chapter.scenes[Math.min(runState.sceneIndex, chapter.scenes.length - 1)]
  return (
    <StageFrame>
      <StageSky
        atmosphere={scene.stage?.atmosphere ?? defaultAtmosphere(kind)}
        words={skyWords(chapter)}
        restored={runState.restored}
      />
      <Button variant="ghost" size="icon" aria-label="返回地图" onClick={handleExit} className="absolute right-3 top-3 z-30">
        <X className="h-5 w-5" />
      </Button>
      <ScenePanel>{body}</ScenePanel>
    </StageFrame>
  )
}
```
`X` 从 lucide import(现文件已 import `X`,`ArrowLeft`)。`SceneKind`/`ChapterLine` 从 `./chapter` import(现文件已 import 部分;补足)。

3. 顶部渲染收敛(替换现 `content` + `return <Shell…>` 段):保留 BOSS 失败特殊分支(改走舞台化,见 Task 4)之外的通用:

```tsx
const scene = chapter.scenes[Math.min(runState.sceneIndex, chapter.scenes.length - 1)]

// 对话类整屏(含收尾 overlay lines):先于浮层判断
if (pendingLines) {
  return renderDialogue(pendingLines, { onDone: () => setPendingLines(null) })
}

switch (scene.kind) {
  case 'dialogue':
  case 'ending':
    return renderDialogue(scene.lines, { onDone: () => step({ type: 'advance' }), onExit: handleExit })
  default:
    return null // 具体在 sceneBody 里按 kind 返回(见后续 Task);此处由 sceneBody 决定 body
}
```
而 `sceneBody` 改由 Task 2-5 逐 kind 收敛(本 task 先让 **break/settle** 两种走 `renderStage`):

```tsx
function sceneBody(current: Scene): ReactNode {
  switch (current.kind) {
    case 'break':
      return renderStage(<BreakScene onContinue={() => step({ type: 'advance' })} onExit={handleExit} />, current.kind)
    case 'settle': {
      // …settle 现逻辑(5 词/星尘/结算卡)取 words/total/gained 不变…
      return renderStage(
        <SettleCard emoji={chapter.emoji} heading={`第${chapter.id}章完成!`} subtitle={`${chapter.title} · ${chapter.subtitle}`}
          words={words} gainedStars={...} totalStars={...} summary={current.summary} speakRole={speakRole} onBack={handleSettled} />,
        current.kind,
      )
    }
    // task/social/boss 由 Task 2-4 接入;本 task 若中途提交,可先保留旧卡片返回(不改语义),最后统一。
  }
}
```

> 过渡注:task/social/boss 若仍返回旧 `Shell`-样式卡片会导致运行器闪回旧壳;稳妥做法是本 task 先把 dialogue/ending/break/settle + pendingLines 切到新屏,**task/social/boss 暂时也并入 `renderStage`(body 用现有 TaskScene/SocialScene/BossScene 原样卡片,先不做 intro 拆移)**,使其视觉至少统一全屏化;intro 台词舞台化在 Task 2-4 再拆。据此本 task 的 `sceneBody` default 分支保持对 task/social/boss 原样调用 TaskScene/SocialScene/BossScene 并包 `renderStage`。删除 `Shell` 定义与 import 中不再用的 `glass-strong` 依赖(若有)。

- [ ] **Step 5: 跑测试确认通过 + 适配既有断言**

Run: `npx vitest run src/features/qianzigu/ChapterRunnerView.test.tsx`
Expected: 新用例 PASS。既有 7 例若因结构断言失败(SkyStrip/header 删除)逐条修复——断言多为文本/按钮,应多数自动通过;个别若引用 header 标题(第1章…)迁移到 sky 词或浮层面板内(如有则把期望改成该文本仍出现于 ScenePanel)。

Run: `npx vitest run src/features/qianzigu/stage.test.tsx && npm test`
Expected: 全绿。

- [ ] **Step 6: Commit**

```bash
git add src/features/qianzigu/stage.tsx src/features/qianzigu/stage.test.tsx src/features/qianzigu/ChapterRunnerView.tsx src/features/qianzigu/ChapterRunnerView.test.tsx
git commit -m "feat(qianzigu): runner 统一舞台壳(StageFrame+ScenePanel+氛围点亮,删 Shell/SkyStrip)"
```

---

### Task 2: task 屏首幕台词舞台化(runner 拆 intro → DialoguePresenter)

**Files:**
- Modify: `src/features/qianzigu/scene-ui.tsx`(`TaskScene` 移除自身 intro 相,只留答题)
- Modify: `src/features/qianzigu/ChapterRunnerView.tsx`(task case 管理 intro 状态)
- Test: `src/features/qianzigu/ChapterRunnerView.test.tsx`(补 intro 用例)
- Test: 若 `ChapterRunnerView.test` 有 task intro 相关旧断言则适配

**Interfaces:**
- Consumes: `DialoguePresenter`、`defaultAtmosphere`、`SceneKind/ChapterLine`。
- Produces: runner 每 task scene 的"首幕已放行"本地记录(key=scene.id),答题相只出内容(交 `renderStage`)。

- [ ] **Step 1: 写失败测试**

`ChapterRunnerView.test.tsx` 追加:

```tsx
it('task 屏:先整屏台词演出 intro,点继续才出题', async () => {
  const chapter = {
    ...flowChapter(),
    scenes: [
      {
        id: 't1', kind: 'task', title: '拯救声音',
        intro: [{ role: 'lingling', text: '听!这是太阳的声音…' }],
        task: { wordId: 1, layer: 'sound', minCorrect: 2 }, onDone: [],
      },
      { id: 'settle', kind: 'settle', summary: [] },
    ],
  }
  renderRunner(chapter)
  expect(screen.getByText('听!这是太阳的声音…')).toBeInTheDocument()
  expect(screen.queryByText('选出太阳的拼音')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '继续' }))
  expect(await screen.findByText('选出太阳的拼音')).toBeInTheDocument()
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/qianzigu/ChapterRunnerView.test.tsx`
Expected: FAIL(现 intro 走 TaskScene 内旧卡片对白,仍在答题前出现——但当前是旧卡片样式,尚无"先台词不出题"断言之外的问题;关键在于让新用例通过需要 runner 接管 intro)。

- [ ] **Step 3: scene-ui.tsx 瘦身 TaskScene**

在 `TaskScene` 内删除"intro 相":去掉 `introDone` state、`if (!introDone) return <卡片+LineScene/>` 分支、`scene.intro` 读取;`title` 仍显示于答题标题行(保留)。`TaskScene` 签名去掉对 intro 的承载(保留原 props 其余不变),成为"纯答题交互卡"。

- [ ] **Step 4: runner task case 接管 intro**

在 `ChapterRunnerView` 加一个本地 `const [introPassed, setIntroPassed] = useState<Record<string, boolean>>({})`。`sceneBody` 的 task case 改为:

```tsx
case 'task': {
  const word = services.vocabulary.wordById(current.task.wordId)
  if (!word) return null
  if (!introPassed[current.id]) {
    return renderDialogue(current.intro, {
      onDone: () => setIntroPassed((m) => ({ ...m, [current.id]: true })),
      onExit: handleExit,
    })
  }
  const skill = layerToSkill(current.task.layer)
  return renderStage(
    <TaskScene
      scene={current}
      word={word}
      skill={skill}
      makeQuestions={() => services.questionEngine.makeStepQuestions(word, skill, Math.random)}
      speak={speak}
      speakRole={speakRole}
      playSound={playSound}
      onCorrect={handleTaskCorrect}
    />,
    current.kind,
  )
}
```
> 引擎语义不变:TaskScene 仍以 `onCorrect` 对满 `minCorrect` 才 advance;intro 纯 UI 前置,不影响 `restore`/进度。

- [ ] **Step 5: 跑测试确认通过 + 全量回归**

Run: `npx vitest run src/features/qianzigu/ChapterRunnerView.test.tsx && npm test`
Expected: 全绿(现有 task intro 多句的 ch1 数据要等 Plan 3 才进入 stage?不,ch1.ts 数据已是现内容,intro 数组即走 DialoguePresenter —— 本地 dev 可看;自动化 fixture 已覆盖)。

- [ ] **Step 6: Commit**

```bash
git add src/features/qianzigu/scene-ui.tsx src/features/qianzigu/ChapterRunnerView.tsx src/features/qianzigu/ChapterRunnerView.test.tsx
git commit -m "feat(qianzigu): task 屏 intro 台词舞台化(runner 接管,TaskScene 瘦身为答题卡)"
```

---

### Task 3: social 屏舞台化(首幕 + 选项 + 收尾 onGood)

**Files:**
- Modify: `src/features/qianzigu/scene-ui.tsx`(`SocialScene` 改为只出"选项+两段确认+非 good 反馈"浮层体,删其内 intro/goodOverlay 全屏管理)
- Modify: `src/features/qianzigu/ChapterRunnerView.tsx`(social case 管 intro 与 onGood 两段)
- Test: `src/features/qianzigu/ChapterRunnerView.test.tsx`(social 用例适配/新增)

**Interfaces:**
- Consumes: 同上。
- Produces: runner 对 social scene 的三相裁决:`lines` 首幕(整屏对白)→ 选项浮层 → 选 good 后 `onGood` 收尾(整屏对白)→ 引擎 `social-choose(good)` advance。

- [ ] **Step 1: 写失败测试**

`ChapterRunnerView.test.tsx` 新增(基于现 `socialChapter` fixture):

```tsx
it('social:哭诉首幕整屏对白 → 点继续出选项 → 两段确认 good → 播 onGood 收尾 → advance', async () => {
  renderRunner(socialChapter())
  expect(await screen.findByText('好孤单...')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '继续' }))
  expect(await screen.findByText('你想怎么做?')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '我也喜欢你!' })) // 首点=朗读/待确认
  fireEvent.click(screen.getByRole('button', { name: '我也喜欢你!' })) // 再点=确认 good
  expect(await screen.findByText('真的吗?谢谢你!')).toBeInTheDocument() // onGood 收尾
  fireEvent.click(screen.getByRole('button', { name: '继续' }))
  expect(await screen.findByText('继续前进!')).toBeInTheDocument() // 下一 dialogue
})
```
(若现两段式标签文案是「再点一下选它」提示而非重复点同名按钮,以现有 `handleOptionTap` 语义为准——现实现:首点进入 pending、再点同一项确认。上文两击同名按钮即此语义。)

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/qianzigu/ChapterRunnerView.test.tsx`
Expected: FAIL(现 SocialScene 内 intro 是卡片对白、goodOverlay 也是卡片内对白,非整屏对白;断言以新形态为准)。

- [ ] **Step 3: 拆 SocialScene**

`SocialScene` 删:自身 `introDone`/`goodOverlay` 的**整屏管理**(`if (!introDone)` 分支返回卡片对白、`goodOverlay` 分支返回卡片收尾),保留:
- 选项列表(两段式 pending 确认)、非 good 的 feedback(后果 + loop 引导,停留)。
组件签名去掉对 `lines`/`onGood` 的整屏承载,新增 props:
```tsx
export type SocialSceneProps = {
  options: readonly SceneOption[]
  goodOptionId: string
  loop: readonly ChapterLine[]
  speakRole: SpeakRoleFn
  playSound(cue: AudioCue): void
  onChooseGood(): void       // 确认 good 后由 runner 进入 onGood 收尾
}
```
内部:保留 feedback(非 good)、pending 两段式;确认 good → 直接调 `onChooseGood`(runner 改播 onGood),不再内播 goodOverlay。

- [ ] **Step 4: runner social case 三相裁决**

在 runner 加本地状态 `const [socialGood, setSocialGood] = useState(false)`(或并入 map,按 scene.id 防同场景重玩残留)。`sceneBody` 的 social case:

```tsx
case 'social': {
  if (!introPassed[current.id]) {
    return renderDialogue(current.lines, {
      onDone: () => setIntroPassed((m) => ({ ...m, [current.id]: true })),
      onExit: handleExit,
    })
  }
  if (socialGood) {
    return renderDialogue(current.onGood, {
      onDone: () => step({ type: 'social-choose', optionId: current.goodOptionId }),
      onExit: handleExit,
    })
  }
  return renderStage(
    <SocialScene
      options={current.options}
      goodOptionId={current.goodOptionId}
      loop={current.loop}
      speakRole={speakRole}
      playSound={playSound}
      onChooseGood={() => setSocialGood(true)}
    />,
    current.kind,
  )
}
```

- [ ] **Step 5: 跑测试确认通过 + 全量回归**

Run: `npx vitest run src/features/qianzigu/ChapterRunnerView.test.tsx && npm test`
Expected: 全绿(旧 social 断言:现测试在 social 两段 bad→仍停留、good→推进 已覆盖,适配点差=按钮/文案断言对照上面语义微调)。

- [ ] **Step 6: Commit**

```bash
git add src/features/qianzigu/scene-ui.tsx src/features/qianzigu/ChapterRunnerView.tsx src/features/qianzigu/ChapterRunnerView.test.tsx
git commit -m "feat(qianzigu): social 屏舞台化(首幕/选项/onGood 三相;SocialScene 瘦身)"
```

---

### Task 4: boss 屏舞台化(静默登台 + intro/win/lose 对白化)

**Files:**
- Modify: `src/features/qianzigu/scene-ui.tsx`(`BossScene` 删 intro 相;留纯 BOSS 题卡)
- Modify: `src/features/qianzigu/ChapterRunnerView.tsx`(boss case + win/lose overlay + BOSS 失败分支舞台化)
- Test: `src/features/qianzigu/ChapterRunnerView.test.tsx`

**Interfaces:**
- Consumes: `renderDialogue/renderStage`、`runState.bossWon/finished`。
- Produces: boss 屏裁决——`intro` 首幕对白 → BOSS 题浮层 → 全对触发引擎 `bossWon` 后播 `win` overlay → 前进;错满 `maxWrong` 引擎 `finished&&!bossWon` → 播 `lose` 整屏 + 「回地图」。

- [ ] **Step 1: 写失败测试**

沿用现 `bossChapter`(intro 空)。追加:

```tsx
it('boss:win 收尾台词整屏对白,点继续后进入下一屏', async () => {
  const chapter = {
    ...bossChapter(),
    scenes: [
      { id: 'boss', kind: 'boss', intro: [{ role: 'jingmo', text: '我是静默!' }], maxWrong: 2, questionCount: 1,
        win: [{ role: 'jingmo', text: '不可能...!' }], lose: [{ role: 'lingling', text: '下次再来!' }] },
      { id: 'end', kind: 'dialogue', lines: [{ role: 'lingling', text: '继续前进!' }] },
    ],
  }
  renderRunner(chapter)
  expect(await screen.findByText('我是静默!')).toBeInTheDocument() // intro 整屏
  fireEvent.click(screen.getByRole('button', { name: '继续' }))
  expect(await screen.findByText('BOSS · 静默')).toBeInTheDocument() // 题卡徽章
  answer('太阳')
  expect(await screen.findByText('不可能...!')).toBeInTheDocument() // win overlay
  fireEvent.click(screen.getByRole('button', { name: '继续' }))
  expect(await screen.findByText('继续前进!')).toBeInTheDocument()
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/qianzigu/ChapterRunnerView.test.tsx`
Expected: FAIL(现 intro 是卡片对白;BossScene 内含 intro 相)。

- [ ] **Step 3: 拆 BossScene**

删 `BossScene` 的 `introDone` 与 `if (!introDone) return <卡片+LineScene>` 分支,保留纯 BOSS 题卡(BOSS 徽章「BOSS · 静默」+ `QuestionCard`)。签名去掉 intro 承载(其余不变)。

- [ ] **Step 4: runner boss case + win/lose**

1. 现 runner 处理 BOSS win 是 `pendingLines = beforeScene.win`,那套已并入本 Task 的整屏对白渲染(`pendingLines` → `renderDialogue`),无需改,但确认 `setPendingLines(beforeScene.win)` 保留。
2. boss case:

```tsx
case 'boss': {
  if (!introPassed[current.id]) {
    return renderDialogue(current.intro, {
      onDone: () => setIntroPassed((m) => ({ ...m, [current.id]: true })),
      onExit: handleExit,
    })
  }
  const pool = chapter.wordIds.map((id) => services.vocabulary.wordById(id)).filter((w): w is WordUnit => w !== undefined)
  return renderStage(
    <BossScene
      wordPool={pool}
      makeQuestion={(word, skill) => services.questionEngine.makeStepQuestions(word, skill, Math.random)[0]}
      speak={speak}
      speakRole={speakRole}
      playSound={playSound}
      onBossCorrect={handleBossCorrect}
      onBossWrong={handleBossWrong}
    />,
    current.kind,
  )
}
```

3. BOSS 失败分支(现文件顶部 `if (runState.finished && !runState.bossWon && scene.kind==='boss')` 返回 Shell 卡)改为整屏对白 + 回地图:

```tsx
if (runState.finished && !runState.bossWon && scene.kind === 'boss') {
  const lose = scene.lose.length > 0 ? scene.lose : [{ role: 'lingling', text: '已经很棒了!先回去休息,下次再来挑战!' }]
  return renderDialogue(lose, { doneLabel: '回地图', onDone: handleExit, onExit: handleExit })
}
```

> 保持"失败保留进度、播勇气台词后回地图"语义(引擎 finished 已真,`restore` 保留)。

- [ ] **Step 5: 跑测试确认通过 + 全量回归**

Run: `npx vitest run src/features/qianzigu/ChapterRunnerView.test.tsx && npm test`
Expected: 全绿(boss 流程既有断言适配;`questionCount:1` fixture 下 answer 一次即 win)。

- [ ] **Step 6: Commit**

```bash
git add src/features/qianzigu/scene-ui.tsx src/features/qianzigu/ChapterRunnerView.tsx src/features/qianzigu/ChapterRunnerView.test.tsx
git commit -m "feat(qianzigu): boss 屏舞台化(静默 intro/win/lose 对白 + 失败保留回地图)"
```

---

### Task 5: onDone/收尾 overlay 统一 + 断点/结算舞台壳收口

**Files:**
- Modify: `src/features/qianzigu/ChapterRunnerView.tsx`(pendingLines → renderDialogue;清理残留)
- Modify: `src/features/qianzigu/scene-ui.tsx`(若 `ROLE_META` 仅余旧引用则保留;不做删除)
- Test: `src/features/qianzigu/ChapterRunnerView.test.tsx`(断言收尾/断点/结算)

**Interfaces:**
- Consumes: 前 4 task。
- Produces: `pendingLines`(task onDone、boss win)统一整屏对白;break 走夜景浮层;settle 走彩化天空结算;无旧 Shell 残留。

- [ ] **Step 1: 写失败测试(收尾 overlay 整屏 + 结算仍在)**

现有测试已含 onDone/结算流程断言(`「大山那边有什么呢」`、`「第1章完成!」`)。本 task 补一条确保 task onDone 台词整屏出现后才进下一屏:

```tsx
it('task onDone 台词整屏对白,点继续进结算', async () => {
  const chapter = {
    ...flowChapter(),
    scenes: [
      { id: 't1', kind: 'task', title: '拯救声音', intro: [], task: { wordId: 1, layer: 'sound', minCorrect: 2 },
        onDone: [{ role: 'lingling', text: '太棒了!' }] },
      { id: 'settle', kind: 'settle', summary: [] },
    ],
  }
  renderRunner(chapter)
  answer('太阳')
  answer('太阳')
  expect(await screen.findByText('太棒了!')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '继续' }))
  expect(await screen.findByText('第1章完成!')).toBeInTheDocument()
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/qianzigu/ChapterRunnerView.test.tsx`
Expected: 现状 pendingLines 走旧 `LineScene`(非整屏)——用例在 onDone 渲染语义上应能过(文本出现),若已过则此用例作**回归保护**;关键新意是把它切换成 `renderDialogue` 后仍绿。若首跑即绿可跳到 Step 3,用 Step 1 当防回归用例。

- [ ] **Step 3: pendingLines 改走 renderDialogue**

把渲染区 `content = pendingLines ? <LineScene …/> : sceneBody(scene)` 改为统一在上层:

```tsx
const scene = chapter.scenes[Math.min(runState.sceneIndex, chapter.scenes.length - 1)]
if (pendingLines) return renderDialogue(pendingLines, { onDone: () => setPendingLines(null) })
```
并确认 dialogue/ending/task-intro/social-onGood/boss-intro 各处优先于此裁决(Task 2-4 已各自在 sceneBody 内,顺序:先 pendingLines,再按 scene.kind 分派)。删除对 `LineScene` 的引用(整仓 qianzigu 内不再用旧 LineScene 时,可一并删 scene-ui 的 LineScene/LineBubble 定义;若尚有 TaskScene 等残留引用先清理)。

- [ ] **Step 4: break/settle 外壳确认**

`break` → `renderStage(<BreakScene …/>, 'break')` 已是 Task 1;断点语义(继续 → advance;明天再来 → 落库回地图 `handleExit`)不动。`settle` 同理。跑全量确认无旧 `Shell` 引用(TypeScript 报错即删净)。

- [ ] **Step 5: 全量回归 + tsc**

Run: `npx tsc -b && npm test`
Expected: 全绿;无未用 import 告警残留(oxlint 会查,`npm run lint` 过)。

- [ ] **Step 6: Commit**

```bash
git add src/features/qianzigu/ChapterRunnerView.tsx src/features/qianzigu/scene-ui.tsx src/features/qianzigu/ChapterRunnerView.test.tsx
git commit -m "feat(qianzigu): pendingLines/onDone 统一整屏对白 + 断点结算舞台壳收口"
```

---

### Task 6: 全场景跑章手动走查 + 视觉打磨锚点

**Files:**
- 不改代码为主;若人工走查发现配色/间距问题,改 `src/index.css`(`.stage-sky--*`、ScenePanel 间距)与少量 `stage.tsx` 类。

**Interfaces:**
- Consumes: 前 5 task 产物。

- [ ] **Step 1: 启动与全流程走查**

Run: `npm run dev`
按 spec §13 前六条人工走查(该阶段无 ch1 数据补编仍可走:CHAPTER_1 原数据已带 intro/onDone 台词,dialogue/ending/social/boss/break/settle 全部会经新屏呈现;cast 因 ch1 未标 stage 走默认推导;氛围走 defaultAtmosphere):
```
□ 满视口不滚屏(对话屏/浮层屏)
□ 开场 dialogue:灵灵同框 + 台词泡 + 点画面/按钮推进
□ task intro 整屏对白 → 答题浮层在天空上;答对 sky 词点亮
□ social 首幕/onGood 对白;两段式选项
□ boss intro 对白 → 题浮层;win/lose 对白
□ break 夜景浮层;settle 卡叠彩化天空
□ 宽/窄窗口角色与浮层不溢出
```
- [ ] **Step 2: 走查问题记入待办或就地修**

配色/间距就地改 `src/index.css`/`stage.tsx`;结构性视觉问题(非 bug)记入 spec §10 后续子项,不进本 plan。

- [ ] **Step 3: 回归**

Run: `npm test && npm run lint`
Expected: 全绿。

- [ ] **Step 4: Commit(如有就地调整)**

```bash
git add -A
git commit -m "style(qianzigu): 舞台走查配色/间距打磨"
```

---

## Self-Review

**Spec 覆盖(scenes 部分):** §6.2 适配矩阵 dialogue/ending(Plan1 Task6)→ task intro 浮层(Task2)→ social 三相(Task3)→ boss 登台(Task4)→ break/settle(Task5/Task1)→ pendingLines 收尾(Task5);§7.1 两态点亮全屏化 + 氛围 key(Task1);§6.3 推进按钮语义保留(Task5 统一)。

**未覆盖(Plan 3):** ch1 数据舞台字段补编(cast/atmosphere/mood)、验收清单 §13 全量(含 mood 观感)、配色精修。

**占位扫描:** 各 step 给接口/修改点/代码片段;整文件替换以结构描述 + 锚点给出(UI 文件较大,避免整份 dump 造成漂移);无 TBD。

**类型一致性:** `renderDialogue(lines, {onDone,doneLabel?,onExit?})`/`renderStage(body, kind)` 在 Task1 定义、Task2-5 调用;`introPassed/socialGood` 均为 runner 内 state(不入引擎)。`BossScene/SocialScene/TaskScene` 瘦身后的新签名在 Task2-4 各自定义并被 runner 消费;`answer()`/fixtures 复用现有测试 helper。

**风险注:** Task1 是大收敛,既有流程测试可能需少量适配——Step 5 已给策略;此为本 plan 最高风险点,子代理执行时若遇整批 DOM 断言失效,优先保文本/按钮断言、再补 class 级断言,勿图省事删保护性用例。
