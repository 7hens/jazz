# 千字谷 ch1 · P5 UI 世界壳 + 千字谷章节 + App 组装实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 App 收口成**双世界壳**并让 ch1 可玩:登录后「世界壳」页选 千字谷(汉语·章节地图)或 字母林(英语·现词岛,原样保留);千字谷章节地图仅 ch1 可玩;ch1 用 P3 引擎逐 scene 跑通(对话/任务/断点/社交/BOSS/结局/结算),场景两态灰白→彩色,恢复写词技能进度并复用现有星尘结算。

**Architecture:** App 相位扩展为双世界壳(新 phase `world`,下辖 `qianzigu-map` / `chapter` / `letter-forest`;原 `home` 语义并入 world 壳首页)。`qianzigu` feature 增加页面型组件 `QianziguEntry`(入口)+ `ChapterMapView`(地图)+ `ChapterRunnerView`(逐 scene 运行器,内部按 Scene kind 分支渲染:台词对话框 / 复用现有 Choice/ListenChoice/MatchGame 出题 / 断点按钮 / 社交选项 / BOSS / 结算卡)。效果(restore→词技能写库、settle→现结算)在运行器内落到 `ProgressService`/`SettingsService`(经 bootstrap 注入,不跨 feature 引实现)。

**Tech Stack:** React 19 + TS + motion + 现有 shared/ui 组件(button/Choice/ListenChoice/MatchGame/badge)+ lucide。

**Spec:** `docs/superpowers/specs/2026-09-08-qianzigu-ch1-design.md` §3.4(双世界壳/章节地图/解锁)+ §3.3(场景两态)+ §4(ch1 内容 UI)+ §7 验收。executor 读 spec + P1-P4 plan + 本 plan。

## Global Constraints

- `useService` 仅在 `<Name>Entry.tsx`(架构铁律):`QianziguEntry.tsx` 取服务,其余组件全 props 注入。
- 页面型 feature 目录 `qianzigu/index.ts` 只导公共面;feature 间不互引(qianzigu 引 shared + shared/ui,经 app 组装传 props)。
- 字母林路径:`App` 的 letter-forest 分支**继续渲染现 `ArchipelagoView`/`HomeEntry`**,代码零改动(字母林词域 = `getAllWords()` 已滤 story,P1 保证)。
- 千字谷 ch1 章节学习目标 = 词 1/101/102/103/3 的 hanzi+pinyin 技能完成;写库走现有 `ProgressService.saveStep`/`settleWord` 幂等(不重复发星尘)。
- 场景两态:容器内元素 `filter: grayscale` 由 `restore` 效果点亮;不引新动效库,复用现有 motion + `cn`。
- BOSS 全对制(P3 Task4)与「3 次错败」由运行器实现,引擎已给信号。

---

### Task 1: App 世界壳导航(useAppState + App.tsx)

**Files:**
- Modify: `src/app/useAppState.ts`
- Modify: `src/app/App.tsx`
- Test: `src/app/` 现有 App 相关测试(如 useAppState 测试)仿范式追加

**Interfaces:**
- Consumes: `useAppState` 现 phase 机。
- Produces:
  - `AppPhase = 'boot'|'login'|'world'|'qianzigu-map'|'chapter'|'letter-forest'|'settings'`
  - `AppState` 增 `currentChapterId: number | null`;actions 增 `enterWorld() / enterQianziguMap() / enterLetterForest() / enterChapter(chapterId) / closeChapter()`。
  - 兼容:原 `home`→`world`(登录后首落 `world` 壳页);`exitToHome` 语义改为回 `world`。

- [ ] **Step 1: 写失败测试(useAppState)**

仿现有测试(查 `src/app/*.test.ts`);若无则新建 `src/app/useAppState.test.ts`:

```ts
it('enterQianziguMap 落到 qianzigu-map,enterChapter 带 chapterId,closeChapter 回 map')
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/app/useAppState.test.ts`
Expected: FAIL(无对应 action)。

- [ ] **Step 3: 改 useAppState.ts**

按上述 Interfaces 扩展 phase 联合与 state/actions(仿既有 useState 机,`currentChapterId` 存 chapter 运行 id)。

- [ ] **Step 4: 改 App.tsx 分支**

把登录后默认分支接到 `world` 壳页(新 `WorldShell` 视图,见 Task 2);`phase==='qianzigu-map'` → `QianziguEntry`;`phase==='chapter'` → `ChapterRunnerView`;`phase==='letter-forest'` → 现 `HomeEntry`(字母林原样)。Auth 登录/冷启动逻辑保持。

- [ ] **Step 5: 跑测试确认通过**

Run: `npx vitest run src/app/useAppState.test.ts && npm test`
Expected: 全绿(letter-forest 渲染回归不破)。

- [ ] **Step 6: Commit**

```bash
git add src/app/useAppState.ts src/app/App.tsx
git commit -m "feat(app): 双世界壳导航(qianzigu-map/chapter/letter-forest)"
```

---

### Task 2: WorldShell 壳页 + QianziguEntry(千字谷章节地图)

**Files:**
- Create: `src/features/qianzigu/WorldShell.tsx`(壳选择页,可放 app 侧——见注)
- Create: `src/features/qianzigu/ChapterMapView.tsx`
- Create: `src/features/qianzigu/QianziguEntry.tsx`(唯一 useService 点)
- Create: `src/features/qianzigu/index.ts`(导出)
- Test: `src/features/qianzigu/QianziguEntry.test.tsx` / `ChapterMapView.test.tsx`

> 架构注:WorldShell(登录后第一屏,含千字谷/字母林两入口)属**导航壳**,放 `src/app/`(app 组装层)更贴切;qianzigu 只管「千字谷内部」页面。实现时若放 app 侧,则 `WorldShell` 不引 feature,只收两个回调按钮 + 少量标题。

**Interfaces:**
- Consumes: `Chapter`/`CHAPTER_1`(P3)、`ChapterService`(P4)、`ProgressService`/`SettingsService`(经 bootstrap 注入,仅 Entry 取)。
- Produces:
  - `WorldShell({ onQianzigu, onLetterForest })`:两入口卡(千字谷🌅 / 字母林🐱)。
  - `ChapterMapView({ chapters, onPlay, doneByWordId })`:20 章占位、ch1 高亮可进、ch2+ 锁定;标题「千字谷 · 第1章 太阳的求救」。
  - `QianziguEntry({ onBack, onPlayChapter, progressSnap, chapterService })`:取服务、组装 ChapterMapView。

- [ ] **Step 1: 写失败测试**

`QianziguEntry.test.tsx`:渲染 ch1 词名「太阳/升起/亮/早上好/星星」与「第1章」;锁定章不可点。注册 fake ChapterService/ProgressService(仿既有 feature 测试 `registry.register(fake)`)。

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/qianzigu/QianziguEntry.test.tsx`
Expected: FAIL(组件不存在)。

- [ ] **Step 3: 实现三个组件**

- `WorldShell.tsx`:max-w-xl 居中两张大卡(千字谷:副标题「汉语 · 章节冒险」;字母林:副标题「英语 · 单词岛」),`onClick` 回调。
- `ChapterMapView.tsx`:读 `chapters`(本纵切只 `CHAPTER_1`),渲染第1章卡(完成态=章内 5 词 hanzi+pinyin 全过 → 翡翠✓;否则 accent 呼吸「开始」);ch2-20 灰置锁定。卡面副标题 `subtitle`。
- `QianziguEntry.tsx`:`useService` 取 `ChapterService`/`ProgressService`/`SettingsService`/`VocabularyService`,组装传 props;`onPlayChapter` 触发 `onEnterChapter(1)`。

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/features/qianzigu/QianziguEntry.test.tsx`
Expected: PASS。

- [ ] **Step 5: 全量回归**

Run: `npm test`
Expected: 全绿。

- [ ] **Step 6: Commit**

```bash
git add src/app/WorldShell.tsx src/features/qianzigu/ChapterMapView.tsx src/features/qianzigu/QianziguEntry.tsx src/features/qianzigu/index.ts
git commit -m "feat(qianzigu): WorldShell + 千字谷章节地图(QianziguEntry)"
```

---

### Task 3: ChapterRunnerView 逐 scene 运行器(核心 UI)

**Files:**
- Create: `src/features/qianzigu/ChapterRunnerView.tsx`
- Create: `src/features/qianzigu/scene-ui.tsx`(分 kind 渲染小块:台词块 / 任务出题 / 断点按钮 / 社交选项 / BOSS 题 / 结算卡)
- Test: `src/features/qianzigu/ChapterRunnerView.test.tsx`

**Interfaces:**
- Consumes: P3 `createChapterRunner`/`CHAPTER_1`/类型;`ProgressService`/`SpeechService`(`speak`+`speakRole`)/`AudioService`/`QuestionEngineService`/`SettingsService`(运行器 props 注入,不经 useService);P2 `speakRole`;P4 `ChapterService`。
- Produces:
  - `ChapterRunnerView(props)`:props 含 `chapter`, `restoreInitial: RunnerState`(断点续玩),`onExit`, `services:{ progress, chapter, speech, audio, questionEngine, settings, celebrate }`,`onSettled`.
  - 内部:创建 runner;按 `state.sceneIndex` 取 scene;分 kind 渲染;把引擎 action 映射到按钮;处理 effect(restore→写词 hanzi/pinyin 完成;BOSS 全对/失败;settle→现结算卡);场景两态容器(灰白随 restored 点亮)。

- [ ] **Step 1: 写失败测试(核心 UI 流转)**

`ChapterRunnerView.test.tsx`:注入 fake services + fake `chapter`(最小 3 scene:dialogue→task→settle),断言:
  - dialogue 屏显示台词,点「继续」进 task;
  - task 屏渲染出题(用 fake QuestionEngine 返固定 choice),答对 2 次后触发 `progress.saveStep` 写 hanzi/pinyin(校验 wordId/layer);
  - settle 屏出现「学会 5 词」类文案。

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/qianzigu/ChapterRunnerView.test.tsx`
Expected: FAIL(组件不存在)。

- [ ] **Step 3: 实现 scene-ui.tsx 分块渲染**

按 kind:
- `dialogue`/`ending`:台词列表(role→`speakRole(text, role)` 自动逐条播,缺 speech 则静音大字)+「继续」按钮 → `advance`。
- `break`:「继续拯救」→ `advance`(续玩逻辑见 Task 4);「明天再来」→ `onExit`(先存 chapter 态)。
- `task`:标题 + intro 台词 + 由 `questionEngine.makeStepQuestions(word, layer==='sound'?'pinyin':'hanzi')` 出题,复用现 Choice/ListenChoice/MatchGame(参照 `WordLesson.tsx` 的判分/attempt/reveal 逻辑简化版:对=发 `task-correct`,连续 2 错 reveal 后重出同层题);对满 `minCorrect` 发 restore。
- `social`:lines + options 逐个按钮(点按 `speakRole(option.text,'lingling')`),选 → `social-choose`;非 good 由 UI 播 `option.response` 后停留;good → 播 onGood 台词。
- `boss`:intro + 5 题交错(questionEngine 出 5 题,每对发 `boss-correct`,错发 `boss-wrong`);引擎 `bossWon`/`finished` 时播 win/lose 台词。
- `settle`:结算卡(见 Task 5)。

场景两态:外容器按 `state.restored` 集合给各场景元素 `className`(`grayscale`/`opacity`);恢复一词把对应 emoji 元素点亮(transition 1.2s)。

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/features/qianzigu/ChapterRunnerView.test.tsx`
Expected: PASS。

- [ ] **Step 5: 全量回归**

Run: `npm test`
Expected: 全绿(现有 quiz 组件行为不变)。

- [ ] **Step 6: Commit**

```bash
git add src/features/qianzigu/ChapterRunnerView.tsx src/features/qianzigu/scene-ui.tsx src/features/qianzigu/ChapterRunnerView.test.tsx
git commit -m "feat(qianzigu): ChapterRunnerView 逐 scene 运行器 + 场景两态"
```

---

### Task 4: 断点续玩 + effect 落库接线 + BOSS/社交收尾

**Files:**
- Modify: `src/features/qianzigu/ChapterRunnerView.tsx`

**Interfaces:**
- Consumes: P4 `ChapterService.save`、P3 runner state/effect。
- Produces(运行器内部接线):
  - 每个 `restore` effect → 把该词对应技能写 completed(用现有 `settleWord`/`ProgressService.saveStep` 幂等,`saveStep` 行含 wordId+completed;不重算星尘的重复判定由 settleWord/fullComplete 幂等保证)。
  - 每次 scene 切换(尤其 break/退出)把 `{ chapterId:1, resumeSceneId: currentScene.id, restoreState: JSON.stringify(state.restored) }` 经 `ChapterService.save` 落库。
  - `restoreInitial`:mount 时若有存 `restoreState`,跳过已恢复 scene(引擎 `start()` 后快进:对已在 restored 的词的 task 直接标记,直至首个未恢复词)。
  - BOSS 失败(`state.finished && !bossWon`):保留前面任务(已完成词 completed 已在库),弹「已救回大部分,下次再战」+ 勇气安慰文案(文案照 idea §4.8 失败分支),`onExit` 回地图。
  - 结算 `settle` effect → Task 5 结算卡 + `onSettled`。

- [ ] **Step 1: 写失败测试**

在 `ChapterRunnerView.test.tsx` 追加:给初始 chapter 态含「词1 sound 已 restored」→ 渲染直接跳过该词首层到下一屏;模拟 break 退出 → 断言 `chapterService.save` 收到含 `resumeSceneId` 的行;BOSS 错满 → 断言未写后续词且出现勇气文案。

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/qianzigu/ChapterRunnerView.test.tsx`
Expected: FAIL(未实现)。

- [ ] **Step 3: 实现接线**

按上述 4 点补进 `ChapterRunnerView.tsx`。restore 落库注意:一层一次 `saveStep`,同词第二层(shape)若 `fullComplete` 已 true 则词奖励 +20 只在词课首通发,此处为避免双入口重复发,沿用 `settleWord` 计算新完成增量 → 仅当该次推进确实产生新技能完成才 `saveStep`(幂等已保)。

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/features/qianzigu/ChapterRunnerView.test.tsx`
Expected: PASS。

- [ ] **Step 5: 全量回归**

Run: `npm test`
Expected: 全绿。

- [ ] **Step 6: Commit**

```bash
git add src/features/qianzigu/ChapterRunnerView.tsx
git commit -m "feat(qianzigu): 断点续玩/restore 落库/BOSS 失败保留接线"
```

---

### Task 5: 结算卡 + 悬念预告 + 端到端验收脚本

**Files:**
- Modify: `src/features/qianzigu/scene-ui.tsx`(settle 卡实现)
- Modify: `src/app/App.tsx`(chapter→结算→回 map 的 onSettled)
- Test: `src/features/qianzigu/ChapterRunnerView.test.tsx`(补 settle 断言)

**Interfaces:**
- Consumes: P3 runner state、结算所需 progress/settings(运行器 props)、`CHAPTER_1`。
- Produces:
  - settle 屏:「✨ 第1章完成!」标题;5 词列表(emoji+hanzi+pinyin,来自 chapter 词序 + vocabulary service);本次新增星尘(用「结算前后 totalStars 差」或现有 `WordDone` 同款展示真实累计);连击/成就文案(占位中性句,真实成就系统接线见注);下章悬念台词(「大山那边有什么呢?下一章:大地的秘密!」照 idea §4.10)+ 按钮「回地图」→ onExit、禁用「下一章」(ch2 未建)。

> 成就/连击注:ch1 全 5 词完成如走词课内逐词 settle,连击/成就已由词课结算链覆盖;章节结算卡以「5 词技能完成 + 星尘累计」为主展示,不重复扫描成就(避免双入口重复发成就)。若产品要章节级专属成就(如「完美主义」0 错误),列入后续子项 spec,不在本 plan 重复造轮子。

- [ ] **Step 1: 写失败测试**

`ChapterRunnerView.test.tsx`:fake chapter 走到 settle → 断言标题「第1章完成」与「回地图」按钮;`onSettled` 回调触发一次。

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/qianzigu/ChapterRunnerView.test.tsx`
Expected: FAIL(settle 未实现)。

- [ ] **Step 3: 实现结算卡 + App 接线**

按 Interfaces 实现 settle 卡渲染;App 在 `phase==='chapter'` 渲染 `ChapterRunnerView`,`onSettled`/`onExit` 收敛回 `qianzigu-map`(并 `void chapterService.load()` 刷新地图态)。

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/features/qianzigu/ChapterRunnerView.test.tsx`
Expected: PASS。

- [ ] **Step 5: 全量回归 + 手动验收**

Run: `npm test`(全绿)+ 浏览器按 spec §7 验收清单逐条走(登录→千字谷→ch1 灰白→5 任务→社交→BOSS→彩色→结算;中途退出刷新可续;BOSS 故意错满 3 次→保留);补字母林入口冒烟(现词流不受影响)。

- [ ] **Step 6: Commit**

```bash
git add src/features/qianzigu/scene-ui.tsx src/app/App.tsx
git commit -m "feat(qianzigu): ch1 结算卡 + App 章节闭环"
```

---

## Self-Review

**Spec 覆盖:** §3.4(世界壳/双入口/章节地图/锁定/letter-forest 保留)→ Task1/2;§3.3(场景两态/自然断点/引擎驱动)→ Task3/4;§7 验收(灰白→彩色、全程语音、断点续玩、BOSS 失败保留、结算卡)→ Task3/4/5;复用 per-word 进度+星尘(§3.5)→ Task4 restore→settleWord/saveStep 幂等。词课/字母林零破坏:App letter-forest 分支原样复用 `HomeEntry`,P1 `getAllWords()` 滤 story 保证 100 词语义。

**占位扫描:** 结算卡的连击/成就展示以「真实累计展示、章节专属成就延后」定案(写入注),无 TBD;BOSS 全对/失败阈值与文案引用 idea §4.8;悬念台词引用 idea §4.10 原文。

**类型一致性:** `RunnerState.restored`/`sceneIndex`/effects(P3)、`ChapterService.save(row)`(P4)、`SpeechService.speakRole`(P2)、`makeStepQuestions`(现引擎)在 Task3/4/5 一致引用;`AppPhase` 扩展与 useAppState actions 在 Task1 统一定义。
