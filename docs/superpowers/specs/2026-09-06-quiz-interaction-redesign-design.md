# 答题卡交互重构 + 短教学习化设计

> 日期:2026-09-06 · 状态:设计已确认(待计划) · 所属:feature 轨(0.2.0 未发,修订 foundation-learning 与答题体验)
>
> 关联:`docs/PLAN.md` feature 轨新行「答题交互重构(点听·确认制)+ 短教结口」;spec `2026-09-05-foundation-learning-design.md` §8 为短教原始交互依据;现代码 `src/shared/ui/quiz/{Choice,ListenChoice,MatchGame}.tsx`、`src/features/lesson/WordLesson.tsx`、`src/features/foundation/{TeachOverlay,ColdStartWizard,teach-questions}.tsx`。

## 1. 背景与问题

浏览器人工验收「英语短教」暴露三层问题:

1. **短教没有出口**:TeachOverlay 是 `fixed inset-0 z-50` 全屏,盖住底下 WordLesson 门态的「返回地图」箭头;overlay 内只有右上的「直接答题」(语义 = 前进进题)与结课的「开始答题」,全程无法离词回群岛。
2. **短教被当成考试**:短教轻测卡直接复用 Choice/ListenChoice,样式与主词课答题卡逐像素同款(白卡 border-hairline + 进度点 + 喇叭),孩子分不清「教学」与「做题」。
3. **选项卡拥挤 + 误触即跳**:每选项卡右上挂小喇叭(`SpeakChip`),题干又挂喇叭;点选 = 立即判分 + 自动跳下题,小孩误触无反悔,combo/节奏被点选速度绑架。

## 2. 决策(与需求方确认)

- **教学 = 学习,不 = 考试**:短教轻测卡改「目标 + 干扰全部选项点听一遍」后才可确认作答,把应试变成对比听辨;作答仍判分(错 → 现「复演示 + 再试」),保住熟度 `known` 信号(答对 streak ≥ 2 升 known),`needFor` 语义不变,旧词不再无限软提示。
- **全 app 答题卡交互统一**:**点选项 = 选中 + 自动朗读**(`o.speak` 缺省读文本),不再即时判;**去选项卡小喇叭**;题干重听 = **题干区整块可点**(去题干/中央喇叭图标);新**「确定」主按钮**提交才判分。
- **主词课判对后自动推进保留**(绿闪 650ms 进下一题/步,同现在),不引入额外「下一题」钮;节奏只把「提交点」变明确。
- **MatchGame(汉字连线)同去喇叭、点卡即念**;配对判定逻辑不变(整配对完成 = 该题一次通过,天然无单答,不套「确定」)。
- **范围边界**:Choice/ListenChoice 为 主词课(WordLesson)+ 短教(TeachOverlay)+ 冷启动(ColdStartWizard)共用 → 三处同受交互新制;短教额外开 `requireVisitAll`(听齐才可确认),主词课/冷启动不开。
- **短教结口补全**(并行收进本轮):overlay 增「返回地图」出口(标题栏 + praise 结课各一);教学期(演示/点读/轻测)换 accent 讲台视觉壳,白卡 + border-hairline 样式**只留给真答题**,拉开「教学/做题」观感。

## 3. 交互模型

### 3.1 Choice(视觉选择题,拼音声韵/声调、英语 listen 之外)

- 状态:idle(未选) → selected(已选并已念) → 提交判 → feedback(correct/wrong/reveal)。
- 选项卡点击:先 `speakCard(o.speak ?? o.text)` 自动朗读,再置选中并高亮;点另一卡 = 改选(旧卡取消高亮);重复点已选卡 = 重念 + 保持选中。
- 题干区:存在 `promptSpeak` 时,题干文字 + emoji 整块为可点区(`aria-label="再听一遍"`),点击重读 `promptSpeak`;无喇叭图标。
- 「确定」按钮(卡下方):未选中禁用。提交回调携带当前选中 option id → 走调用方判分(与旧 `onAnswer` 同签名,仅触发时机从「点卡」变「点确定」)。
- `requireVisitAll`(短教专用 prop):追加要求 —— 全部选项均已点听过一次(visited 集 == options 全集)才放开「确定」;未听齐时提示「把每个都点一点听一听」。

### 3.2 ListenChoice(听音选择,英语字母/单词 + 进题自动读)

- 进题自动朗读 `promptSpeak` 一次(现逻辑保留,ref 去重防 StrictMode 重放)。
- 顶部中央喇叭钮改为**整块可点重听区**(无喇叭图标,可选极轻 pulse 动效提可发现性),点击重读 `promptSpeak`。
- 下部选项卡行为同 3.1 Choice(点卡即念 + 选中;去小喇叭;确定提交)。listen 题干文本本身不得展示答案文字,故题干重听区不放文字,只作可点空区。
- `requireVisitAll` 语义同 3.1(短教英语卡开)。

### 3.3 MatchGame(汉字连线)

- 去每卡喇叭;点卡 = `speakCard(o.speak)` + 既有选择/配对逻辑。朗读只发生在「纯选择」时刻(点某侧卡当时另一侧无待配对选中):点左卡读左卡、点右卡读右卡,不改变配对即时判定。

### 3.4 主词课 WordLesson

- Choice/ListenChoice 交互变化自动带入;`handleAnswer` 签名不变,仅在「确定」提交时触发。attempt 1/2、wrong→reveal→再练一次、correct→feedback→自动推进、combo 结算时机全部随提交点平移,判定逻辑零改。
- Match 分支不动(判对即整配对完成,无喇叭可去之外零改)。

### 3.5 短教 TeachOverlay

- 轻测卡:共享 Choice/ListenChoice + `requireVisitAll`;判分/复演示/再试逻辑保留(`handleQuizAnswer` 内 last 题全对即时 `markTaught` 时序不变,确定提交后同样成立)。
- **出口**:props 增 `onExit`;标题栏左上加返回(与右侧「直接答题」并存),praise 结课加「返回地图」ghost 钮。退出 = 回群岛(`actions.exitToHome`),与主词课中途一致;退出不丢教学记录(教学记录在答对/结课已幂等落库)。
- **视觉壳**:教学期页面用 accent-tint 满幅底 + 教学态标识(如步骤引导语),答题组件外框不再复用主词课白卡 shadow-card 观感;轻测自检卡若保留共享组件外框,则换 distinct 底色/圆角区分。
- 教学期 demo/tap 的「朗读整词 / 组 chip 喇叭」保留(非选项卡,属教学点读,不删)。

### 3.6 冷启动 ColdStartWizard

- 交互随共享 Choice/ListenChoice 变确认制;0 星诊断判分语义不变,逐题判对/错后 650ms 自动推进照旧(点在「确定」提交后计时)。

## 4. 文件改动

| 文件 | 改动 |
| :-- | :-- |
| `src/shared/ui/quiz/Choice.tsx` | 增选中态 + visited 集 + 「确定」钮;增 props `requireVisitAll?`;点卡先念后选;删 `SpeakChip` 与题干喇叭;题干区可点重播 |
| `src/shared/ui/quiz/ListenChoice.tsx` | 顶部喇叭钮 → 整块可点重听区;透传 Choice 新交互 |
| `src/shared/ui/quiz/MatchGame.tsx` | 删每卡喇叭;点卡即念(纯选择时刻) |
| `src/features/lesson/WordLesson.tsx` | 判定入口语义不变;适配 Choice 提交时机;若共享组件默认即确认制则近乎零改 |
| `src/features/foundation/TeachOverlay.tsx` | 轻测卡传 `requireVisitAll`;props 增 `onExit` + 标题/praise 出口;教学视觉壳;demo/tap 保留 |
| `src/features/foundation/FoundationStepGate.tsx` | 透传 `onExit`(自 gate ctx) |
| `src/features/foundation/ColdStartWizard.tsx` | 随共享组件;核对计时/推进 |
| `src/features/lesson/WordLesson.tsx` props `stepGate.render` ctx | ctx 增 `exit()`(App 组装处接 `actions.exitToHome`) |
| `src/app/App.tsx` | stepGate.render ctx 传 `exit`;FoundationStepGate 接 `onExit` |
| 测试 | Choice/WordLesson/TeachOverlay/ColdStart/App 组件测试随动;App.test 等按新交互改写 |

## 5. 语义不变量与安全

- `applyCorrect/applyWrong` 仅于「确定」提交触发;短教 last 题全对 `markTaught` 幂等时序不变。
- 熟度 `known` / `needFor`(mandatory/soft/none)判定零改 —— 判分保留是硬前提。
- 纯前端行为 + 视觉,无 db/API/存储改动;回滚 = 代码回切(点卡即跳旧观感),不崩。旧 `basics_progress`/progress 数据不受影响。
- TTS 选中即读依赖语音;`speak` 返回 false(无可用语音)时静默,不抛错不阻塞确定(与现静音降级约定一致)。

## 6. 测试策略

- **Choice**:未选中确定禁用;点卡先调 speak 再选中;点齐全部(`requireVisitAll`)才放开确定;重复点已选保持;提交回调 = 选中 id。
- **WordLesson**:点卡不推进;确定 wrong → attempt 2;确定 correct → 650ms 后自动下一步;reveal(两错)仍手动再练。
- **TeachOverlay**:听齐才可确认;错 → 复演示 + 再试;标题返回钮与 praise 返回地图各调一次 `onExit`;判分/`markTaught` 时序回归。
- **ColdStart**:确认制下诊断判分回归,推进计时不变。
- **回归**:`npm test` 全绿;question-engine / estimator / demo-blocks / decompose 纯逻辑不动;architecture 边界(shared 组件改造仍在 shared,features 消费契约)不破。

## 7. 兼容与回滚

- `stepGate.render` ctx 增 `exit` 为可选成员(缺省无操作),旧测试/未接线方不崩。
- Choice 默认行为切确认制属本迭代内同发(主词课/短教/冷启动三处同 commit),无中间态需兼容;若需局部回退,共享组件改回即时判即可,消费方无需变。

## 8. 风险与开放项

- **主词课节奏放慢**:提交制多一次点击,连击/撒花节奏变化;真机验收,若明显拖沓再评估「判对自动推进」是否缩时。
- **ListenChoice 无图标重听区可发现性**:儿童是否自觉去点待验收;必要时加极轻 pulse 或短促引导语,不回归喇叭。
- **match 点卡即念与配对判定的次序**:朗读只在纯选择时刻,配对仍即时;逐卡核对点左/点右次序不误触。
- **退出短教的家长语境**:退出回群岛后词课未完成,进度保持半程;属预期(与主词课中途退出一致),无需二次确认(0 星教学无损失)。
