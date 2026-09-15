# 题面舞台化设计(答题卡壳 → 游戏演出壳)

> 日期:2026-09-15 · 状态:**待评审** · 轨:`0.3.0 feature`(PLAN `P0` 行)
> 流程:走 `game-visual-design`(视觉方法 + 无障碍闸门);本 spec 只覆盖**视觉壳**,不触叙事/听觉/数据域。
> 上游:无(纯壳重构)。下游:PLAN 想法池新增行 + `docs/design/game-visual.md` 接缝表补齐。

## 0 一页定位

| 项 | 内容 |
| --- | --- |
| 变更类型 | **前端视觉壳重构**(`src/shared/ui/quiz/` 内部换渲染 + 4 个消费点去外卡) |
| 触发 | 2026-09-15 产品口径:「题目的 UI 需要重新设计,要求更像是游戏,而不是选择题」 |
| 深度档位 | **皮肤层(A 档)** —— 交互仍是「点选 + 确认」;不引入拖拽、不重出题型 |
| 范围 | 4 个消费点全改:词课 / 千字谷跑章 / 短教 / 冷启动向导 |
| 素材 | **零新增** —— 全 emoji + `index.css` 现有 token |
| 关键事实 | **题型组件契约不变** → 4 处调用代码基本不动,视觉统一发生在 `shared/ui/quiz/` 内部 |
| 零动红线 | `question-engine` / `progress` / 判分语义 / `speech` / 数据模型 / `AudioCue` **全部不动** |

## 1 已定口径(决策记录,2026-09-15)

| # | 决策 | 结论 | 理由 |
| --- | --- | --- | --- |
| D1 | 改的深度 | 皮肤层(点选交互保留) | 操作层/玩法层撞引擎红线或 L 级工作量,另立项 |
| D2 | 范围 | 4 个消费点全改 | 避免「两张皮」;统一发生在 shared 层,边际成本低 |
| D3 | 素材 | emoji + 现有 token,零新增 | 契合仓库「克制简约」;位图化归 PLAN 既有 `P2`「角色立绘位图化」行 |
| D4 | 提交钮措辞 | **「就它了!」** | 去掉「交卷」signifier;两语境(孩子答题 / 家长教学)都读得通。**仅 `Choice`/`ListenChoice` 有提交钮**;`MatchGame` 配对即判、无此钮,不受 D4 影响 |
| D5 | 外层卡片壳 | **全去** | 白卡 + 圆角边框 = 「试卷纸」感主因;可读性改由气泡白底与词石底色承载 |
| D6 | 教学期区分 | **虚线边框 + 卷轴头「演示」标签** | 兑现 `docs/PLAN.md:34`「教学期视觉壳与真答题区分」既有承诺 |
| D7 | 重试钮文案 | 不动(`再练一次` / `再试一次`),只换造型 | 4 个测试文件断言该文案;文案无「答题卡」语义,改它纯亏 |

## 2 非目标

- **不做拖拽 / 落位 / 场景物件点击类交互** —— 留想法池,需重写作答交互契约
- **不改 `Question` 数据形状与出题引擎** —— `makeQuestions` / `optionCountFor` / 干扰项策略零动
- **不上位图素材** —— 角色立绘位图化有独立 `P2` 行,「须先立项再动」
- **不新增 `AudioCue`**、不动 `speech` 服务
- **不改判分语义** —— 2 次作答 / reveal / `minCorrect` 全部照旧

## 3 「像选择题」的三个 signifier 与对策

读码定位(非猜测):观感由三处叠加而成,单改一处翻不过来。

| # | Signifier | 现状落点 | 对策 |
| --- | --- | --- | --- |
| 1 | 题干居中大标题 | `Choice.tsx:100-104` `text-center text-lg font-bold` | 换**气泡说话框**(尾指向出题者),带「谁在问」的署名感 |
| 2 | 2×2 等距网格 + 统一卡形 | `Choice.tsx:106` `grid grid-cols-2 gap-3`;`MatchGame.tsx` 同 | 换**词石**:错落排布、单体形不规则、选中发光 |
| 3 | 「确定」按钮 = 交卷 | `Choice.tsx:138-149` | 换**施法钮**「就它了!」 |

外层白卡(`rounded-[1.75rem] border bg-surface shadow-card`)是第 4 个放大器 —— 它把题装订成「一张卷子」。D5 全去。

## 4 架构

### 4.1 分层切法

**内容层(状态机不动,只换渲染)** —— 保留全部判分/选中/朗读/a11y 逻辑:

- `Choice.tsx`:`selected` / `confirm` / `cardCls` 四态 → 保留状态机,`cardCls` 改为词石四态
- `ListenChoice.tsx`:自动朗读 + 重听喇叭逻辑原样,标题行换造型
- `MatchGame.tsx`:配对状态机 `selL/selR/matched/mismatch/done` **整块不动**,只换卡造型(现已有 ✓ 角标,是色彩冗余的既有正例,保留并推广)

**壳层(新增共享片段)** —— 放在 `src/shared/ui/quiz/` 内:

| 新文件 | 职责 | 不做什么 |
| --- | --- | --- |
| `QuestionBubble.tsx` | 题面气泡框:造型 + 三角尾 + 可选署名行 | 不含判分/朗读逻辑 |
| `stone.ts` | 词石四态样式函数(默认/选中/对/错)+ ✓✗ 冗余角标判定 | 纯函数,可单测 |
| `CastButton.tsx` | 施法钮(造型 + 措辞),薄封装 `Button` | 不自管 disabled 语义(透传) |

> 三个片段都是**中性 UI**,落 `shared/ui/` 不违 `architecture.test.ts` 边界。

### 4.2 边界纪律

- **`shared/` 禁引 `features/`**:气泡造型**照抄参数** `DialoguePresenter.tsx` 的 `Bubble`(`rounded-2xl rounded-tl-sm border-2 bg-surface` + 三角尾 + `moodBorder`),但**不复用其组件**。视觉一致、代码解耦。
- `moodBorder` 现居 `features/qianzigu/stage-visuals.ts`(feature 内)→ 壳层**不引**它;情绪边框仍只服务对白气泡。题面气泡用固定 `border-hairline`。

## 5 视觉语言(元素级)

| 元素 | 现状 | 改为 | token |
| --- | --- | --- | --- |
| 题干 | 居中大标题 | **气泡框**:左上小圆角 + 三角尾;上方小字署名「📜 魔法书」 | `bg-surface` / `border-hairline` / `shadow-card` |
| 题干配图 | `text-7xl` emoji 居中 | 保留大字 emoji,移入气泡内左上(或气泡左侧浮出) | — |
| 选项 | 2×2 等距网格卡 | **词石**:列布局仍 `grid-cols-2`(触控面积不牺牲),但**视觉错落** —— 交替纵向偏移 + 两列圆角半径不同,破掉「等距方阵」感 | `border-2` 四态见下 |
| 选项-默认 | `border-hairline bg-surface` | 石底:浅浮雕(内阴影 + `bg-surface`) | `shadow-card` |
| 选项-选中 | `border-accent bg-accent-tint` | 石**发光**:`ring-2 ring-accent/40` + 轻微上浮 | `accent` / `accent-tint` |
| 选项-答对 | 绿框(纯色表达) | 绿 + **✓ 角标**(形冗余,推广 `MatchGame` 既有做法) | `emerald` |
| 选项-答错 | 红框 + 抖动 | 红 + **✗ 角标** + 保留抖动 | `red` / `red-tint` |
| 提交钮 | 「确定」 | **「就它了!」** + ✨ | `accent` |
| 答对反馈 | 仅边框变绿 | 词石**上浮 + emoji 迸发粒子**(3–5 个,emoji 字形非位图) | — |
| 答错反馈 | 红框 + 抖动 | 词石**熄灭**(去饱和 + 仅轻微透明度,见 §7 对比下限) | — |
| 题型徽章 | 灰底胶囊 | **卷轴标签**(左右两端小三角凹口) | `surface-2` / `hairline` |

**克制约束**(`game-visual-design` 坑 #5):不引入全屏网点/纹理;粒子 ≤5 个、存活 ≤600ms;`text-` 字号一律 rem。

## 6 四个消费点的接线

| 消费点 | 外卡落点 | 处置 |
| --- | --- | --- |
| 千字谷 `scene-ui.tsx` | `QuestionCard` 外壳 `:152` | **去掉**白卡 → 题直接浮在 `StageFrame` 上;BOSS 徽章 `BOSS · 一团乱` 保留 |
| 主线词课 `WordLesson.tsx` | `:305` `rounded-[1.75rem] … shadow-card` | **去掉**;题浮在页面底色上 |
| 短教 `TeachOverlay.tsx` | `:228` `border-2 border-accent/30 bg-accent/10` | **保留壳但改型**:`border-dashed` + 卷轴头「演示」标签(D6);另 `:187` 结课卡不动 |
| 冷启动 `ColdStartWizard.tsx` | `:191` / `:201` 两处 | **去掉**;面板本身已是全屏浮层(`:114`),题浮在浮层上即可 |

### 6.1 教学期区分细则(D6)

现区分靠 `border-2 border-accent/30 bg-accent/10`(实心橙底)。换壳后气味会与真答题趋同,故改为**双通道冗余**:

1. **边框虚实**:教学 = `border-dashed`;真答题 = 实线
2. **卷轴头标签**:教学 = 「📖 演示」;真答题不挂

两条同时成立才算通过 —— 单靠颜色区分不可(违反 §7 色彩冗余)。

## 7 无障碍闸门(设计稿阶段即过,不留到测试)

| 项 | 要求 | 本轮落点 |
| --- | --- | --- |
| **色彩冗余** | 对错**永不只靠红绿** | 答对 → ✓ 角标;答错 → ✗ 角标。**现状缺口**:`Choice` 的 reveal/wrong 是纯色,本 spec 一并补 |
| 减动效 | `prefers-reduced-motion` 兜底 | **已具备**:`App.tsx:249` `MotionConfig reducedMotion="user"` + `index.css:145` media query + `stage.tsx:109` `useReducedMotion`。新动效一律走 motion transform → 自动继承,**不得**写裸 CSS `animation` |
| 闪光 | 频闪默认关 | 本轮无闪光;粒子为渐隐,非频闪 |
| 文字缩放 | 支持 2× | 气泡/词石尺寸用 rem + `p-*`/`gap-*` token,禁 `px` 尺寸;不设 `overflow: hidden` 截字 |
| 朗读 | 题干/选项可朗读 | **已具备**:`speakCard` 点卡即念 + `ListenChoice` 自动朗读 promptSpeak,逻辑不动 |
| 对比 | ≥ 4.5:1 | 气泡文字 `text-ink on bg-surface` ✓;accent-tint 上文字用 `accent-ink` ✓;**新增检查**:词石熄灭态的对比不得低于 4.5:1(用透明度降过多会破线 → 用灰度 `grayscale` 而非 `opacity < 0.6`) |

## 8 测试域影响

### 8.1 破测清单(D4 措辞变更的直接后果)

`「确定」` 作为 accessible name 被断言于 **9 个测试文件**,全需改:

`shared/ui/quiz/Choice.test.tsx` · `shared/ui/quiz/ListenChoice.test.tsx` · `lesson/WordLesson.test.tsx` · `foundation/TeachOverlay.test.tsx` · `foundation/ColdStartWizard.test.tsx` · `foundation/FoundationStepGate.test.tsx` · `qianzigu/scene-ui.test.tsx` · `qianzigu/ChapterRunnerView.test.tsx` · `app/App.test.tsx`

> 其中 `ChapterRunnerView.test.tsx:234` / `ColdStartWizard.test.tsx:56` / `WordLesson.test.tsx:24` 等处有**注释**同步描述「点『确定』」,一并勘误。

**不破**的部分:D7 保留重试钮文案 → `再练一次` / `再试一次` 的断言(4 文件)零震。

### 8.2 新断言点

壳是纯 className 为主 → **不断言样式字符串**。断言锚:

- `stone.ts` 四态函数:纯函数单测(默认/选中/对/错 的类名与角标标记)
- ✓/✗ 角标:以 `role="img"` + `aria-label` 暴露,测试断言「答对后存在 ✓ 语义节点」(色彩冗余的可测化)
- 「就它了!」的 disabled→enabled 状态机:沿用 `Choice.test.tsx` 既有两条断言,仅改名字
- 教学期区分:断言 `TeachOverlay` 渲染「📖 演示」标签(可测的结构,非颜色)

### 8.3 全绿闸门

改完 `npm test` 须绿(现基线 **65 文件 / 416 测试**);`npm run lint` 0 error。

## 9 文档同步清单

| 文档 | 动作 |
| --- | --- |
| `docs/PLAN.md` | 想法池 → 当前迭代 `0.3.0 feature` 轨新增 `P0` 行 |
| `docs/design/game-visual.md` | §现状接缝表「前景交互层」行补:题面气泡 / 词石为**已建**,勿重建 |
| `CHANGELOG.md` | 发布时按版本规范追加(本 spec 不动) |

## 10 未决与风险

| # | 项 | 状态 |
| --- | --- | --- |
| R1 | 词石「错落」在 375px 窄屏 + 长文本选项下是否溢出 | 实施时按最坏用例(4 个 3 字词)验证;破线则退回等距网格(保留其余改动) |
| R2 | 千字谷去白卡后,题浮在亮色 `StageSky` 上对比是否够 | 气泡与词石自带 `bg-surface`,预期够;实施时目视 `dawn` 氛围档 |
| R3 | 冷启动向导是**家长**语境,施法钮措辞是否突兀 | D4 已按「两语境都通」选词;若家长侧反馈怪,退路 = `ColdStartWizard` 传 `confirmLabel` prop(契约加可选字段,不破其余 3 处) |
| R4 | 粒子用 emoji 字形在各平台字形差异(如 🎉 在部分安卓为黑白) | 降级安全:粒子仅作装饰,`aria-hidden`,缺失不影响可玩性 |

## 11 实施顺序(供 writing-plans 展开)

1. 壳层片段(`QuestionBubble` / `stone.ts` / `CastButton`)+ 单测 —— A 层,独立可回滚
2. `Choice` / `ListenChoice` / `MatchGame` 换渲染 + 9 文件断言改名 —— A 层收口
3. 四消费点去外卡 + 短教虚线区分 —— B 层,观感翻盘
4. `npm test` + `npm run lint` + 浏览器走查(千字谷 23 幕抽 3 幕 + 词课 + 短教 + 冷启动)
