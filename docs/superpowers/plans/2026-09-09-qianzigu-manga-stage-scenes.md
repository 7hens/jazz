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

### Task 1: 统一舞台壳(StageFrame + ScenePanel + 氛围点亮;删 Shell/SkyStrip;BOSS 失败整屏化)

**Files:**
- Modify: `src/features/qianzigu/stage.tsx`(加 `ScenePanel`)
- Test: `src/features/qianzigu/stage.test.tsx`(补 ScenePanel 用例)
- Modify: `src/features/qianzigu/ChapterRunnerView.tsx`(渲染收敛;删 Shell/SkyStrip + 两个渲染助手)
- Test: `src/features/qianzigu/ChapterRunnerView.test.tsx`(适配 + 新增)
- Modify: `src/features/qianzigu/scene-ui.tsx`(给 `BreakScene` 外层包一张 surface 卡,便于在夜景天空上阅读;仅此一处)

**Interfaces:**
- Consumes: Plan 1 `StageFrame/StageSky/DialoguePresenter`、`defaultAtmosphere`、chapter `stage?`。
- Produces:
  - `ScenePanel({ children, className? }: { children: ReactNode; className?: string })`:舞台上的居中浮层面板(不透明浅底、圆角、内可滚动),用于承载任务/选项/结算等非对白内容。
  - runner 内两个渲染助手 `renderDialogue(lines, opts)` 与 `renderStage(body, kind)`,见 Step 4。Task 2-5 复用。

> **对账(core 落地后的事实,替代原草稿)**:`skyWordsOf()` 组件内已存在(复用,不新建);dialogue/ending 已整屏走 DialoguePresenter(抽进 renderDialogue);`pendingLines` 现走旧 `<LineScene>`(本 task 切 renderDialogue);`Shell`/`SkyStrip`/`LineScene`/`ROLE_META`/`ArrowLeft`/`cn` 在 runner 内的用途全部随之消失(一并删 import);**BOSS 失败分支仍返回旧 `Shell` 卡,必须在删 Shell 的同一 task 整屏化**,否则编译失败(原草稿把它留给 Task 4 是自相矛盾)。

- [ ] **Step 1: 写失败测试(ScenePanel + task 屏氛围点亮)**

`stage.test.tsx` 追加(ScenePanel 渲染内容于浮层)。现文件顶部是 `import { render, screen } from '@testing-library/react'` 与 `import { StageCast, StageSky } from './stage'` —— 只需把 `ScenePanel` 并入该 import,勿重复 import 行。

```tsx
describe('ScenePanel', () => {
  it('渲染内容于可滚动浮层(自身无按钮)', () => {
    const { container } = render(
      <StageFrame>
        <ScenePanel><span>答题卡内容</span></ScenePanel>
      </StageFrame>,
    )
    expect(screen.getByText('答题卡内容')).toBeInTheDocument()
    expect(container.querySelector('button')).toBeNull()
  })
})
```

`ChapterRunnerView.test.tsx` 追加(task 屏整屏舞台化:氛围=scene.stage.atmosphere;作答后 sky 词随恢复档点亮):

```tsx
it('task 屏整屏舞台化:氛围=scene.stage.atmosphere;答对后 sky 词随恢复档点亮', async () => {
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
  // 场景 0 = task → 已走统一舞台壳,天空氛围 class 出现(非旧 Shell)
  expect(document.querySelector('.stage-sky--night')).not.toBeNull()
  answer('太阳') // 现有 helper:点选项 → 确定
  answer('太阳')
  // 引擎仅记一层恢复(每层一条 restore entry)→ restoreCount=1 → 半亮档 opacity-70
  const word = document.querySelectorAll('.stage-word')[0] as HTMLElement
  expect(word.className).toContain('opacity-70')
})
```
> 为什么不是 opacity-100:引擎 task 答对满 minCorrect 时只往 `restored` push **一条** `{wordId, layer}`(见 engine.ts task case);单层任务完成 → `restoreCount=1` → `StageSky` 给 `opacity-70 grayscale-[.55]`(半亮)。全亮(opacity-100)需同一词 sound+shape 两层都恢复(两条 entry),属 StageSky 单元测试已覆盖(见 stage.test.tsx),runner 集成测试只证「task 屏挂上了舞台壳 + 词随档点亮」。

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/qianzigu/ChapterRunnerView.test.tsx src/features/qianzigu/stage.test.tsx`
Expected: FAIL(`ScenePanel` 不存在;task 屏仍是旧 Shell,无 `.stage-sky--night`/`.stage-word`)。

- [ ] **Step 3: stage.tsx 加 ScenePanel + scene-ui BreakScene 补表面卡**

stage.tsx 尾部新增:

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

scene-ui.tsx `BreakScene` 返回外层包表面卡(旧 <main> 白底不再,夜景天空需不透明底才可读;保持内部内容/按钮不变):

```tsx
return (
  <div className="rounded-[1.75rem] border border-hairline bg-surface p-5 text-center shadow-card">
    {/* 原 flex flex-col items-center px-2 py-8 text-center 内容照搬至此内层 */}
  </div>
)
```

- [ ] **Step 4: 收敛 ChapterRunnerView 渲染(删 Shell/SkyStrip;两助手;BOSS 失败整屏化)**

当前结构(core 后):顶部模块级 `SkyStrip`(词点亮旧实现,语义已迁 StageSky)、文件尾 `Shell`(header+main 卡)、组件内已有 `skyWordsOf()` 与顶部 `scene` 变量、`pendingLines` 走 `<LineScene>`、BOSS 失败分支返回 `Shell` 卡。

1. **删**模块级 `SkyStrip` 与文件尾 `Shell` 两个函数定义。
2. **复用**组件内 `skyWordsOf()`(已存在,闭包拿 services),不新建词装配 helper。
3. 组件内新增两个助手(闭包拿顶部 `scene`/`runState`/`services`;`scene` = `chapter.scenes[Math.min(runState.sceneIndex, chapter.scenes.length - 1)]`):

```tsx
/** 整屏对话演出(自带 StageFrame):dialogue/ending/pendingLines/各 scene intro/收尾 overlay 共用。 */
function renderDialogue(lines: readonly ChapterLine[], opts: { onDone: () => void; doneLabel?: string; onExit?: () => void }) {
  return (
    <DialoguePresenter
      lines={lines}
      atmosphere={scene.stage?.atmosphere ?? defaultAtmosphere(scene.kind)}
      restored={runState.restored}
      skyWords={skyWordsOf()}
      cast={scene.stage?.cast}
      speakRole={speakRole}
      onDone={opts.onDone}
      onExit={opts.onExit}
      doneLabel={opts.doneLabel}
    />
  )
}

/** 非对白屏统一舞台壳:天空氛围 + 词点亮 + 右上退出 + 浮层面板。 */
function renderStage(body: ReactNode, kind: SceneKind) {
  return (
    <StageFrame>
      <StageSky
        atmosphere={scene.stage?.atmosphere ?? defaultAtmosphere(kind)}
        words={skyWordsOf()}
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

4. 顶部渲染收敛:把现「BOSS 失败分支(317-339)→ dialogue/ending 整屏(341-358)→ `content = pendingLines ? <LineScene> : sceneBody` + `return <Shell>…`(360-370)」整段替换为:

```tsx
// BOSS 失败:保留已恢复进度,播勇气台词后回地图(整屏;doneLabel 即「回地图」)。
if (runState.finished && !runState.bossWon && scene.kind === 'boss') {
  const lose = scene.lose.length > 0
    ? scene.lose
    : [{ role: 'lingling' as const, text: '已经很棒了!我们先回去休息,下次再来挑战!' }]
  return renderDialogue(lose, { doneLabel: '回地图', onDone: handleExit, onExit: handleExit })
}

// 收尾/叙事台词(pendingLines = task.onDone / boss.win)整屏优先于当前 scene —— 它们属上一幕叙事。
if (pendingLines) {
  return renderDialogue(pendingLines, { onDone: () => setPendingLines(null) })
}

switch (scene.kind) {
  case 'dialogue':
  case 'ending':
    return renderDialogue(scene.lines, { onDone: () => step({ type: 'advance' }), onExit: handleExit })
  // task/social/boss/break/settle:统一舞台壳;body 由 sceneBody 给裸内容(不加 frame)。
  default:
    return renderStage(sceneBody(scene), scene.kind)
}
```

5. `sceneBody`(逐 kind 返回裸内容)保持不动即可被 default 分支包裹;**不要**在 sceneBody 内再加 frame/ScenePanel(避免双层)。
6. **import 收敛**:scene-ui import 删 `LineScene`、`ROLE_META`(旧 BOSS 卡才用),留 `BossScene/BreakScene/SettleCard/SocialScene/TaskScene` 与类型 `SpeakFn/SpeakRoleFn`;lucide 删 `ArrowLeft`(仅 Shell 用)留 `X`;删 `cn`(仅 SkyStrip 用);`useRef` 仍用于 engineRef/currentStateRef/localProgressRef(保留)。

> 过渡注(task/social/boss 的 intro 相):TaskScene/SocialScene/BossScene 现仍自带 intro 卡片(introDone state)——本 task **不拆**,它们被 renderStage 包成浮层卡片即先统一全屏视觉;intro 台词整屏舞台化在 Task 2-4 拆。本 task 只把 `pendingLines`(task onDone/boss win)与 BOSS 失败切整屏。

- [ ] **Step 5: 跑测试确认通过 + 适配既有断言**

Run: `npx vitest run src/features/qianzigu/ChapterRunnerView.test.tsx src/features/qianzigu/stage.test.tsx`
Expected: 新用例 PASS。既有用例多为文本/按钮断言,应自动通过;仅注意「dialogue 屏…旧 Shell 标题不再包裹」负断言(`queryByText(/千字谷 · 第1章/)` not in document)在删 Shell 后仍成立;BOSS 失败用例断言 `已经很棒了` + 按钮 `回地图` —— 新 renderDialogue 的 doneLabel=`回地图`,成立。

Run: `npx tsc -b && npm test && npm run lint`
Expected: 全绿、无未用 import/类型报错。

- [ ] **Step 6: Commit**

```bash
git add src/features/qianzigu/stage.tsx src/features/qianzigu/stage.test.tsx src/features/qianzigu/ChapterRunnerView.tsx src/features/qianzigu/ChapterRunnerView.test.tsx src/features/qianzigu/scene-ui.tsx
git commit -m "feat(qianzigu): runner 统一舞台壳(StageFrame+ScenePanel+氛围点亮;删 Shell/SkyStrip;BOSS 失败整屏化)"
```

---
### Task 2: task 屏首幕台词舞台化(runner 顶部开关拆 intro → DialoguePresenter)

**Files:**
- Modify: `src/features/qianzigu/scene-ui.tsx`(`TaskScene` 移除自身 intro 相,只留答题)
- Modify: `src/features/qianzigu/ChapterRunnerView.tsx`(顶部 switch 加 `case 'task':` intro 门;`sceneBody` task case 保留为答题体)
- Test: `src/features/qianzigu/ChapterRunnerView.test.tsx`(补 intro 用例)

**Interfaces:**
- Consumes: Task 1 `renderDialogue/renderStage`(闭包)、顶部 `scene`/`runState` 变量、`sceneBody`。
- Produces: runner 顶部开关 `case 'task'`:intro 空 → 直接 `renderStage(sceneBody(scene))`;非空且首幕未放行 → `renderDialogue(scene.intro)`。放行记录 = 组件内 `introPassed` state(`Record<sceneId, true>`)。

- [ ] **Step 1: 写失败测试**

`ChapterRunnerView.test.tsx` 追加。关键断言 `灵灵` 名字牌:整屏 `DialoguePresenter` 才有 cast 站队(卡片 intro 无名字牌),故能区分「真·整屏」与「TaskScene 卡片内 intro」:

```tsx
it('task 屏:先整屏台词演出 intro(cast 名字牌),点继续才出题', async () => {
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
  expect(screen.getByText('灵灵')).toBeInTheDocument() // 整屏 cast 名字牌(card intro 无)→ 真·舞台化
  fireEvent.click(screen.getByRole('button', { name: '继续' }))
  expect(await screen.findByText('选出太阳的拼音')).toBeInTheDocument()
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/qianzigu/ChapterRunnerView.test.tsx`
Expected: FAIL 于 `getByText('灵灵')`(Task 1 后 intro 仍是 TaskScene 内卡片,无 cast 名字牌)。文本与「未出题」断言单独看会过(卡片 intro 也先显示台词、后出题)——**名字牌是决定性断言**。

- [ ] **Step 3: scene-ui.tsx 瘦身 TaskScene**

删除 `TaskScene` 内 intro 相:去掉 `introDone` state、`if (!introDone) return <卡片+LineScene/>` 分支、对 `scene.intro` 的读取。保留 `title` 答题标题行、round/qIndex/questions/`QuestionCard` 逻辑。`TaskSceneProps` 不变(仍收 `scene`,答题仍读 `scene.task`;intro 字段不再被读,但数据里留着无妨)。

- [ ] **Step 4: runner 顶部开关接管 intro(门在 switch,不入 sceneBody)**

在 `ChapterRunnerView` 组件内 `pendingLines` state 旁新增:
```tsx
const [introPassed, setIntroPassed] = useState<Record<string, boolean>>({})
```
在顶部渲染 `switch (scene.kind)` 内、`default` 之前**新增 `case 'task':`**:

```tsx
case 'task': {
  // intro 空 → 直接出题;非空且首幕未放行 → 整屏对白;否则答题浮层。
  if (scene.intro.length > 0 && !introPassed[scene.id]) {
    return renderDialogue(scene.intro, {
      onDone: () => setIntroPassed((m) => ({ ...m, [scene.id]: true })),
      onExit: handleExit,
    })
  }
  return renderStage(sceneBody(scene), scene.kind)
}
```
> `sceneBody` 的 task case **保留不动**(它已构建答题体 `TaskScene`,只删其内部 intro 相);`length > 0 &&` 空 intro 守卫**必须**:否则空 intro 的 task 会先落入 DialoguePresenter 空态(单颗推进钮),破坏现流程测试「进 task 即出题」。引擎语义不变:intro 纯 UI 前置,不影响 restore/进度。

- [ ] **Step 5: 跑测试确认通过 + 全量回归**

Run: `npx vitest run src/features/qianzigu/ChapterRunnerView.test.tsx && npx tsc -b && npm test`
Expected: 全绿(现 ch1 数据 intro 即走 DialoguePresenter;流程 fixture intro 空 → 守卫跳过直出题,旧断言不破)。

- [ ] **Step 6: Commit**

```bash
git add src/features/qianzigu/scene-ui.tsx src/features/qianzigu/ChapterRunnerView.tsx src/features/qianzigu/ChapterRunnerView.test.tsx
git commit -m "feat(qianzigu): task 屏 intro 整屏对白化(runner 顶部开关接管,TaskScene 瘦身为答题卡)"
```

---
### Task 3: social 屏舞台化(首幕 + 选项 + 收尾 onGood)

**Files:**
- Modify: `src/features/qianzigu/scene-ui.tsx`(`SocialScene` 改为只出「选项+两段确认+非 good 反馈」;删 intro/goodOverlay 相;props 去 `lines`/`onGood`)
- Modify: `src/features/qianzigu/ChapterRunnerView.tsx`(顶部 switch 加 `case 'social':`;`sceneBody` social case 更新到新 props)
- Test: `src/features/qianzigu/ChapterRunnerView.test.tsx`(social 用例适配/新增)

**Interfaces:**
- Consumes: `renderDialogue/renderStage`、`introPassed`(Task 2 已建)、`sceneBody`。
- Produces: runner 对 social scene 三相裁决——`lines` 首幕整屏对白 → `SocialScene` 选项浮层 → 确认 good 后 `onGood` 整屏收尾 → `step({type:'social-choose'})` advance。放行记录:good 确认用组件内 `socialGoodAt`(`string|null`,值=scene.id)。

- [ ] **Step 1: 写失败测试**

`ChapterRunnerView.test.tsx` 新增(基于现 `socialChapter` fixture;`灵灵`/`月亮` 名字牌断言证「整屏舞台」):

```tsx
it('social:哭诉首幕整屏对白 → 点继续出选项 → 两段确认 good → onGood 整屏收尾 → advance', async () => {
  renderRunner(socialChapter())
  expect(await screen.findByText('好孤单...')).toBeInTheDocument()
  expect(screen.getByText('月亮')).toBeInTheDocument() // 首幕整屏 cast 名字牌
  fireEvent.click(screen.getByRole('button', { name: '继续' }))
  expect(await screen.findByText('你想怎么做?')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '我也喜欢你!' })) // 首点=朗读/待确认
  fireEvent.click(screen.getByRole('button', { name: '我也喜欢你!' })) // 再点=确认 good
  expect(await screen.findByText('真的吗?谢谢你!')).toBeInTheDocument() // onGood 整屏收尾
  expect(screen.getByText('月亮')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '继续' }))
  expect(await screen.findByText('继续前进!')).toBeInTheDocument() // 下一 dialogue
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/qianzigu/ChapterRunnerView.test.tsx`
Expected: FAIL 于首幕 `getByText('月亮')`(Task 2 后 social intro 仍为 SocialScene 内卡片,无 cast 名字牌)。既有 social 两例仍绿(Task 2 未动 social 渲染路径)。

- [ ] **Step 3: 拆 SocialScene(scene-ui.tsx)**

`SocialScene` 删 intro 相与 goodOverlay 相:
- 删 `introDone` state、`if (!introDone) return <卡片+LineScene/>` 分支;
- 删 `goodOverlay` state 与其 `<卡片+LineScene onDone={onChooseGood}>` 分支;
- 保留:选项列表(两段式 pendingId 确认)、非 good feedback(后果台词 + loop 引导,停留重弹)。确认 good → `playSound('correct')` 后**直接 `onChooseGood()`**(不再内播收尾、不再 speak response)。

签名改为(去掉 `lines`/`onGood` 承载):
```tsx
export type SocialSceneProps = {
  options: readonly SceneOption[]
  goodOptionId: string
  loop: readonly ChapterLine[]
  speakRole: SpeakRoleFn
  playSound(cue: AudioCue): void
  onChooseGood(): void       // 确认 good 后由 runner 进入 onGood 整屏收尾
}
```

- [ ] **Step 4: runner 三相裁决(顶部 case 'social')**

`ChapterRunnerView` 顶部 state 旁新增 `const [socialGoodAt, setSocialGoodAt] = useState<string | null>(null)`。顶部 `switch (scene.kind)` 内、`default` 前**新增 `case 'social':`**:

```tsx
case 'social': {
  // 首幕哭诉整屏 → 选项浮层 → 确认 good 后 onGood 整屏收尾(advance 由 onDone 触发)。
  if (scene.lines.length > 0 && !introPassed[scene.id]) {
    return renderDialogue(scene.lines, {
      onDone: () => setIntroPassed((m) => ({ ...m, [scene.id]: true })),
      onExit: handleExit,
    })
  }
  if (socialGoodAt === scene.id) {
    return renderDialogue(scene.onGood, {
      onDone: () => step({ type: 'social-choose', optionId: scene.goodOptionId }),
      onExit: handleExit,
    })
  }
  return renderStage(sceneBody(scene), scene.kind)
}
```

`sceneBody` 的 social case 同步更新到新 props(去 `lines`/`onGood`,`onChooseGood` 置 `socialGoodAt`):

```tsx
case 'social':
  return (
    <SocialScene
      options={current.options}
      goodOptionId={current.goodOptionId}
      loop={current.loop}
      speakRole={speakRole}
      playSound={playSound}
      onChooseGood={() => setSocialGoodAt(current.id)}
    />
  )
```
> 非 good 语义不变:引擎停在 social scene(`social-choose` 非 good 被引擎忽略),feedback 停留重弹。两段式首点仅朗读、再点确认的行为保留在 SocialScene 内。

- [ ] **Step 5: 跑测试确认通过 + 全量回归**

Run: `npx vitest run src/features/qianzigu/ChapterRunnerView.test.tsx && npx tsc -b && npm test`
Expected: 全绿(social 旧两例断言适配点:确认 good 后不再是卡片 overlay 而是整屏——它们断言文本与按钮名,不受影响;新增用例证整屏)。

- [ ] **Step 6: Commit**

```bash
git add src/features/qianzigu/scene-ui.tsx src/features/qianzigu/ChapterRunnerView.tsx src/features/qianzigu/ChapterRunnerView.test.tsx
git commit -m "feat(qianzigu): social 屏舞台化(首幕/选项/onGood 三相整屏,SocialScene 瘦身)"
```

---
### Task 4: boss 屏舞台化(静默登台 + intro/win/lose 对白化)

**Files:**
- Modify: `src/features/qianzigu/scene-ui.tsx`(`BossScene` 删 intro 相与 `intro` prop;留纯 BOSS 题卡)
- Modify: `src/features/qianzigu/ChapterRunnerView.tsx`(顶部 switch 加 `case 'boss':`;`sceneBody` boss case 去掉 `intro` prop)
- Test: `src/features/qianzigu/ChapterRunnerView.test.tsx`

**Interfaces:**
- Consumes: `renderDialogue/renderStage`、`introPassed`、`runState.bossWon/finished`、`sceneBody`。
- Produces: boss 屏裁决——`intro` 首幕整屏对白 → BOSS 题浮层 → 全对引擎 `bossWon` 后播 `win`(Task 1 已把 win overlay 走 `pendingLines` → renderDialogue,本 task 不动)→ 前进;错满 `maxWrong` 引擎 `finished && !bossWon` → `lose` 整屏 + 「回地图」(Task 1 已整屏化,本 task 不动)。

> **对账**:BOSS win/lose 两个 overlay 都已在 Task 1 走 `renderDialogue`(win = `setPendingLines(beforeScene.win)`、lose = 顶部 finished 分支 `doneLabel:'回地图'`)。本 task 只补:BossScene 去 intro、runner 顶部 `case 'boss'` 管 intro 门。

- [ ] **Step 1: 写失败测试**

沿用现 `bossChapter`(intro 空)。追加(有 intro 的 fixture 走整屏登台):

```tsx
it('boss:intro 整屏对白 → 点继续出题 → 答对触发 win 整屏 → 点继续进下一屏', async () => {
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
  expect(screen.getByText('静默')).toBeInTheDocument() // cast 名字牌(jingmo → 静默)
  fireEvent.click(screen.getByRole('button', { name: '继续' }))
  expect(await screen.findByText('BOSS · 静默')).toBeInTheDocument() // 题卡徽章
  answer('太阳')
  expect(await screen.findByText('不可能...!')).toBeInTheDocument() // win 整屏(静默落败台词)
  fireEvent.click(screen.getByRole('button', { name: '继续' }))
  expect(await screen.findByText('继续前进!')).toBeInTheDocument()
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/qianzigu/ChapterRunnerView.test.tsx`
Expected: FAIL 于首幕 `getByText('静默')`(Task 3 后 boss intro 仍为 BossScene 内卡片,无 cast 名字牌)。既有「BOSS 错满」用例仍绿(Task 1 已把失败分支整屏化)。

- [ ] **Step 3: 拆 BossScene(scene-ui.tsx)**

删 `BossScene` 的 `introDone` state、`if (!introDone) return <卡片+LineScene doneLabel="开始挑战">` 分支、以及 `intro` prop(**签名去 `intro`,其余不变**)。保留纯 BOSS 题卡:`BOSS · 静默` 徽章 + `QuestionCard`(retryLabel `下一题`、pick/session 轮换)。

- [ ] **Step 4: runner 顶部 case 'boss' + sceneBody 更新**

顶部 `switch (scene.kind)` 内、`default` 前**新增 `case 'boss':`**:

```tsx
case 'boss': {
  if (scene.intro.length > 0 && !introPassed[scene.id]) {
    return renderDialogue(scene.intro, {
      onDone: () => setIntroPassed((m) => ({ ...m, [scene.id]: true })),
      onExit: handleExit,
    })
  }
  return renderStage(sceneBody(scene), scene.kind)
}
```

`sceneBody` 的 boss case 去掉 `intro={current.intro}`(BossScene 已无该 prop;body 其余不变):

```tsx
case 'boss': {
  const pool = chapter.wordIds
    .map((id) => services.vocabulary.wordById(id))
    .filter((w): w is WordUnit => w !== undefined)
  return (
    <BossScene
      wordPool={pool}
      makeQuestion={(word, skill) => services.questionEngine.makeStepQuestions(word, skill, Math.random)[0]}
      speak={speak}
      speakRole={speakRole}
      playSound={playSound}
      onBossCorrect={handleBossCorrect}
      onBossWrong={handleBossWrong}
    />
  )
}
```

> BOSS win/lose overlay 已由 Task 1 承载,勿重复处理。保持"失败保留进度、播勇气台词后回地图"语义(引擎 finished 已真,restore 保留)。

- [ ] **Step 5: 跑测试确认通过 + 全量回归**

Run: `npx vitest run src/features/qianzigu/ChapterRunnerView.test.tsx && npx tsc -b && npm test`
Expected: 全绿(boss 流程既有断言适配;`questionCount:1` fixture 下 answer 一次即 win)。

- [ ] **Step 6: Commit**

```bash
git add src/features/qianzigu/scene-ui.tsx src/features/qianzigu/ChapterRunnerView.tsx src/features/qianzigu/ChapterRunnerView.test.tsx
git commit -m "feat(qianzigu): boss 屏舞台化(静默 intro/win/lose 整屏对白;BossScene 去 intro)"
```

---
### Task 5: 收尾回归守卫 + 死代码清理(LineScene 退役确认;断点/结算壳复查)

**Files:**
- Modify: `src/features/qianzigu/scene-ui.tsx`(Task 2-4 后 `LineScene`/`LineBubble` 已无引用 → 删定义;`ROLE_META` 保留,scene-ui feedback 与 stage.tsx StageCast 仍在用)
- Test: `src/features/qianzigu/ChapterRunnerView.test.tsx`(补 task onDone 整屏 + 结算回归守卫)
- Modify: `src/features/qianzigu/ChapterRunnerView.tsx`(若 scene-ui 删除后仍有 import 残留则清)

**Interfaces:**
- Consumes: Task 1-4 产物(renderDialogue/renderStage、顶部开关各 case、sceneBody 各 case)。
- Produces: 收口——task onDone overlay 走整屏(防回归)、break 夜景浮层 + settle 彩化天空仍在、qianzigu 内无旧 `LineScene`/`Shell`/`SkyStrip` 残留。

> **对账**:`pendingLines` → `renderDialogue`、break/settle 进 `renderStage` 都已在 Task 1 完成;本 task 不重做,只加回归守卫并清残留。

- [ ] **Step 1: 写回归守卫(task onDone 整屏后进结算)**

`ChapterRunnerView.test.tsx` 追加(task.onDone 非空时,答满后先整屏 onDone 台词,点继续才到结算):

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
  expect(await screen.findByText('太棒了!')).toBeInTheDocument() // onDone 整屏(renderDialogue)
  expect(screen.getByText('灵灵')).toBeInTheDocument() // 整屏 cast 名字牌(非旧 LineScene)
  fireEvent.click(screen.getByRole('button', { name: '继续' }))
  expect(await screen.findByRole('heading', { name: '第1章完成!' })).toBeInTheDocument() // 结算仍在
})
```

- [ ] **Step 2: 跑测试确认通过(守卫本应已绿)**

Run: `npx vitest run src/features/qianzigu/ChapterRunnerView.test.tsx`
Expected: 本用例 **PASS**(Task 1 已把 pendingLines 切 renderDialogue——此用例是防回归守卫,不要求先红)。若红 → 说明 Task 1 的 pendingLines 整屏化未生效,先查 runner 顶部 `pendingLines` 分支。

- [ ] **Step 3: 清理 scene-ui 死代码**

Task 2-4 已把 TaskScene/SocialScene/BossScene 的 intro/goodOverlay 相都改为整屏(或移除),qianzigu 内 `LineScene` 与 `LineBubble`(scene-ui 顶部的逐句台词卡 + 其角色泡)应已无引用。确认:

```bash
grep -rn "LineScene" src/features/qianzigu/ || echo "no LineScene refs"
```

无引用则删 `scene-ui.tsx` 中 `LineScene` 与 `LineBubble` 定义(连同 `LineBubble` 顶部的 import 若只剩它用)。**`ROLE_META` 勿删**(SocialScene feedback 与 stage.tsx StageCast 仍用)。若 grep 仍有引用 → 停,查引用方(不该有,若有则是某 task 漏拆,先处理再删)。

- [ ] **Step 4: 复查 break/settle 外壳 + import 收敛**

确认 runner 顶部:break/settle 由 `default: renderStage(sceneBody(scene), scene.kind)` 承载,断点语义(继续 → advance;明天再来 → 落库回地图 `handleExit`)与 settle(彩化天空 + 结算卡 + onBack `handleSettled`)未回归;runner import 无 `LineScene`/`Shell`/`SkyStrip`/`ROLE_META` 残留(TypeScript 报错即删净)。

- [ ] **Step 5: 全量回归 + tsc + lint**

Run: `npx tsc -b && npm test && npm run lint`
Expected: 全绿;无未用 import/死代码告警。

- [ ] **Step 6: Commit**

```bash
git add src/features/qianzigu/ChapterRunnerView.test.tsx src/features/qianzigu/scene-ui.tsx src/features/qianzigu/ChapterRunnerView.tsx
git commit -m "refactor(qianzigu): onDone 整屏回归守卫 + 退役旧 LineScene/LineBubble"
```

---
### Task 6: 全场景跑章手动走查 + 视觉打磨锚点

> ⚠️ **执行次序(2026-09-09)**:spec §15 补充批(舞台布景实景化 + 太阳复原)将替换本批 StageSky 词点灯条视觉。**本走查延后到 backdrop plan(`2026-09-09-qianzigu-manga-stage-backdrop.md`)落地后一并做**,避免给将被替换的旧视觉走查两遍(见 spec §15.6)。延后期间本 Task 维持 pending。

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
