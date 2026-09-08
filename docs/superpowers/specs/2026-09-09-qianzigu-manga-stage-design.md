# 千字谷·跑章漫画舞台化:全窗舞台 · 同框多人 · 角色旁动态气泡

> 日期:2026-09-09 · 影响面:能力(千字谷跑章视觉/交互形态重构),兼容新增 → **minor**(feature 轨下一个 minor,0.3.0 之后排队)
> 来源:用户愿景(2026-09-09 头脑风暴,经 `/superpowers:brainstorming` 逐节确认)+ 现存 `qianzigu` ch1 纵切片。
> 决策记录(逐项已由用户拍板):作用面=**千字谷跑章先漫画化**(地图/字母林/settings 本轮不动)· 对话结构=**同框多角色正式化** · 美术来源=**emoji 先行 + 视觉源位图接缝** · 画幅=**全窗即舞台**(随窗自适应,不滚屏)· 推进节奏=**点按推进(可控)** · 实现路线=**数据驱动舞台**(scene 数据加可选舞台元数据,引擎零改动)。
> 关联:CLAUDE.md 架构铁律 · 千字谷 ch1 spec `docs/superpowers/specs/2026-09-08-qianzigu-ch1-design.md`(跑章现状与验收 §7)· `src/features/qianzigu/*` 现有实现 · PLAN 想法池「千字谷 场景两态升级」行(本轮部分消费,见 §7.2)。

## 1. 背景与目标

千字谷 ch1《太阳的求救》纵切片已落地:章节引擎(顺序推进/断点续玩/失败保留)、角色分音色语音 `speakRole`、场景两态(灰白→彩色 由 `SkyStrip` 顶部 emoji 点灯表示)、社交/BOSS/结局/结算,进度与星尘复用现有 per-word 账。

但**视觉呈现仍是「窄栏移动网页 + 卡片流」**:`min-h-screen` + `mx-auto max-w-xl` 居中 + 玻璃吸顶 header + 页面滚动(`ChapterRunnerView.tsx:346-365`);对话是逐条聊天气泡 + 底部整宽「继续」按钮(`scene-ui.tsx` LineScene/LineBubble);同幕角色不齐,只有当前说话者的 40px emoji 圆头像;无场景画面(唯一「场景」是 `SkyStrip` 的词 emoji 点亮刻度,非真正的天空/布景)。

**本次目标**:把千字谷跑章升级为「**全窗即舞台**的漫画剧场」——满视口不滚屏;场景氛围铺底随 restore 灰白→彩色点亮;同幕角色按编排 **`cast` 站入画面**(emoji 放大形象);谁说话谁动、**角色旁漫画泡**锚点弹出(带指向尾);点画面/主按钮推进;任务/BOSS/社交以**漫画浮层**叠在舞台上。引擎、进度/星尘、语音基建、断点续玩**全部不动**。

**同框多角色正式化(B+)**:不只"逐句换头像",而是"这一幕谁在场由数据声明、谁说话由台词驱动"——多个角色真实同框轮说、重点角色可跨组常驻,为将来"更稠密的剧场会话"提供数据模型。

## 2. 现状事实(改动前快照)

- 跑章布局:`src/features/qianzigu/ChapterRunnerView.tsx`。`Shell` = `min-h-screen` + sticky `glass-strong` header(返回/标题/退出)+ `main.mx-auto.max-w-xl` 滚动列。顶部 `SkyStrip`(`:104-133`)按 `restoreOrder` 对词 emoji 做 `grayscale/opacity` 点亮刻度。
- 角色表:`scene-ui.tsx:12-19` `ROLE_META: Record<SpeechRole,{name,emoji}>`(lingling🦊/sun☀️/moon🌙/jingmo🖤/narrator📖/villager🐰)。角色=emoji 圆头像;无立绘/位图/姿态。`SpeechRole` 类型与角色语音契约在 `src/shared/services/speech.ts`;`speakRole(text,role)` 每句自动朗读。
- 对话 UI:`LineScene`(`scene-ui.tsx:46-100`)逐句 + `LineBubble`(`:25-40`,左圆头像+右白泡),底部 `Button`「继续」/末句改 doneLabel 推进;motion 逐句上滑淡入。`ChapterRunnerView.test.tsx` 以 `getByRole('button',{name:'继续'|'下一题'|'回地图'...})` 驱动整章流程(7 例)。
- scene 数据模型:`src/features/qianzigu/chapter.ts`。台词 `ChapterLine = {role,text}`。各 kind:task(intro/task/onDone)、social(lines/options/loop/onGood)、boss(intro/maxWrong/questionCount/win/lose)、dialogue/ending(lines)、break、settle(summary)。**无任何"在场角色/氛围/情绪"维度**。
- 引擎 `engine.ts`:只按 `scene.kind` + 数值字段(task.minCorrect / boss.maxWrong·questionCount / goodOptionId)+ action 推进,生成 `restore/mark-boss-failed/settle` 效果;**完全不读台词/角色/视觉内容** → 加装饰字段引擎零改动、现有引擎测试零回归。
- 视觉资产:全仓无位图/音频文件;token 在 `src/index.css`(canvas 天空、surface 白卡、ink、accent 橙、pinyin=amber/hanzi=red/english=blue);动画=motion/react + 少量 `ll-*` keyframes(灵灵 emoji)。`ch1.ts` 台本为原文(逐条照录 idea 文档),text 语义为既成品,本轮不改。

## 3. 非目标(本轮划界,防蔓延)

- 地图(章节地图)、字母林、settings 的漫画化/全屏改造。
- 引入真实位图美术(本轮角色/场景全部 emoji + CSS;视觉源做成映射接缝,位图留待后续只改映射表)。
- 分镜转场动画 / 拟声字 / 网点速度线等**全套漫画语言**(作为后续升级子项,见 §10)。
- 自动连播/字幕机(self-advance);本轮维持点按推进。
- 修改 ch1 台本文案语义(文本保持原文;只补舞台字段)。
- 改进度/星尘/断点数据模型、speech 契约、worker/DB/迁移(不存任何新用户数据)。

## 4. 架构总览

改动全部落在**前端呈现层**,集中于 `src/features/qianzigu/`(自包含,`architecture.test.ts` 边界照守:不向 shared 加 feature 依赖、feature 间不互引)。新增舞台组件仅依赖 `shared/ui` 基础件与 `shared/services` 类型(现有 qianzigu 依赖面不变)。

```
┌────────────── StageShell(100dvh · overflow:hidden · 全窗即舞台)──────────────┐
│ L1 StageSky    氛围背景(atmosphere key → 渐变+emoji 元素层)                   │
│    ↑ restore 逐词点亮:灰白→彩色(承接两态;取代 SkyStrip 顶部点灯条)          │
│ L2 StageCast   角色站位层:cast 从画面下沿站出,emoji 放大形象;说者 talk 动画   │
│    ↑ 谁说话谁亮/轻晃+名字牌;其余 idle;台词角色不在 cast → 临场滑入(兜底)     │
│ L3 Foreground  scene 主体(按 kind 分发):                                    │
│    dialogue/ending → DialoguePresenter(角色旁漫画泡,点屏/主钮推进)           │
│    task/social/boss → 漫画浮层面板(复用现有作答组件)                        │
│    break → 夜景浮层 · settle → 结算卡(叠彩化天空)                            │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **响应式**:整窗即舞台,角色随窗口比例缩放/分站,文本与触控区横向贯通,窄/宽窗均不溢出、不引入滚动。
- 顶层退出仍提供(保留 header 语义:返回地图/退出,视觉并入舞台角落图标,不占居中窄栏)。

## 5. 数据扩展(chapter.ts · 全可选 · 引擎零读)

```ts
// SpeechRole 沿用 shared/services/speech.ts(lingling|sun|moon|jingmo|narrator|villager)
export type AtmosphereKey = 'dawn' | 'day' | 'dusk' | 'night' | 'dark'   // 可再扩
export type SpeechMood = 'calm' | 'sad' | 'happy' | 'scary'              // 缺省 calm,可再扩

// ChapterLine 增可选字段:
//   mood?: SpeechMood        // 影响气泡样式/角色动效;缺省 calm

// 各带台词组/交互的 scene 增可选字段(见 §6.2 挂载点):
//   stage?: Readonly<{ cast?: readonly SpeechRole[]; atmosphere?: AtmosphereKey }>
```

- `stage.cast`:**整幕"常驻/提前站场"角色清单**,顺序即站位偏好;缺省推导见下。不排精细 slot——站位由布局规则按人数自动分(1 人 center / 2 人 left·right / 3 人 left·center·right),`narrator` 永不站队(走旁白叙述框)。
- **cast 缺省推导规则**(旧 chapter 数据不带 `stage` 也不崩):当前**展示组**台词里出现过角色的**首现序**。展示组定义 = 一次连续展示的台词数组(dialogue/ending 的 `lines`;task 的 `intro`、`onDone` 各自成组;social 的 `lines`/`loop`/`onGood`;boss 的 `intro`/`win`/`lose`;settle 的 `summary`)。
- **cast 与展示组阵容合成**:展示时阵容 = `stage.cast`(若有,常驻在场)+ 当前展示组台词中新出现的角色(临场滑入,组内可退)。ch1 数据通过 `cast` 保证开场/social/boss/ending 等关键角色**提前同框**,其余靠推导,免逐组手填。
- `stage.atmosphere`:整幕背景氛围 key;缺省按亮度兜底(灰白压抑幕 → `dawn`,夜/月亮 → `night`,紧张 BOSS → `dark`,恢复完成/结局 → `day`)。`dawn` 灰白 = 灰度滤镜层实现「两态」起点,随 `restored` 推进渐次撤灰/点亮 → 全彩(见 §7.1)。
- **引擎兼容性**:`engine.ts` 对以上字段零感知(它只 switch kind + 读数值)。`chapter.test`/`ch1.test` 等纯逻辑测试**不改仍绿**。

## 6. 舞台组件设计与 scene 适配

### 6.1 视觉源接缝(stage-visuals.ts)

qianzigu 内新增唯一"长什么样"映射,所有舞台 UI 只消费接口、不内联 emoji/样式:

- `roleVisual(role): { emoji: string; ring?: string; scale?: number }`(先基于 `ROLE_META` 扩展 `jingmo` 等尺寸;narrator 例外走旁白框)。
- `atmosphereStyle(key): { gradient: CSS; filter?: CSS }`(背景渐变 + 灰白滤层起点)。
- 点亮映射 `litStyle(count): CSS`(word 元素由 restore 次数驱动灰→彩,复用现 `SkyStrip` 的类同规则)。
- **位图接缝**:UI 一律经 `roleVisual`/`atmosphereStyle` 取视觉 → 将来换位图只改这两处(emoji → img / gradient → 背景图),组件与数据不动。

### 6.2 scene 适配

| kind | 舞台演出 | stage 元数据挂载点 |
|---|---|---|
| dialogue / ending | `DialoguePresenter`:阵容站队 → 当前说者 talk + 角色旁气泡(限宽、尾指向)→ 点画面或主钮进句,末句=advance | scene 级 `stage`;台词各行可选 `mood` |
| task | intro 台词走演出;进入「任务模式」后背景+关键角色(目标词元素)保留,前景**漫画浮层题面板**(贴纸任务徽条「任务 · 标题」+ 作答区),作答组件**复用现有 Choice/ListenChoice/MatchGame**(判分/2 次作答/重试语义不动);onDone 台词走演出 | scene 级 `stage`(做题画面阵容缺省常驻 cast;onDone 新角色临场);intro/onDone 各行 `mood` |
| social | lines(哭诉)走演出 → 选项以**对话框选项泡**呈现,保留**两段式(先听/点选朗读 → 再点确认)** 交互与后果式停留;onGood 走演出 | scene 级 `stage` |
| boss | 静默 🖤 大形象登台(scale 放大 + dark 氛围 + 轻微屏幕震),题浮层面板带 BOSS 徽章;win/lose 走演出 | scene 级 `stage` |
| break | 夜景 + 月亮浮层,「继续拯救 / 明天再来」 | —(无台词,stage 可省) |
| settle | 现 `SettleCard` 保留,叠在 **restore 全亮后的彩色天空**上 | — |

- **旁白 narrator**:台词不进站队,以画面**居中叙述框**(旁白盒,细框小字)展示并朗读,读毕/点按进下一句——不占角色槽、不"站"在舞台上。
- **临场登场兜底**:台词角色既不在 `cast` 也非 narrator → 从画面侧缘滑入加入阵容;组内不再说话时保持站场(静默 idle)或淡出(以不跳动为原则,具体进出场最小化动画)。

### 6.3 DialoguePresenter(对话演出核心,重构 `LineScene`)

- 阵容由 §5 规则求值;每句渲染前按当前 `role` 高亮说话者(`talk`:轻晃/上跳 + 亮牌名字),其余 idle(轻微呼吸,弱化),保证「谁在说」一眼可读。
- **角色旁气泡**:气泡在当前说话角色站位旁展开,带小指向尾,一次只显当前句;限宽(不横越到遮挡同幕他人),分行;文本/触控大字可读。
- **推进**:整屏为可点热区 + 舞台角落保留**主推进按钮**(AVG 惯例),两者同一触发——保留语义 `role=button` 供测试与键盘;末句触发引擎 `advance`。**不改自动朗读时序**:进入新句即 `speakRole(line.text, role)`(沿用现状,契约不动)。
- 结尾/高潮句可借 `mood` 加气泡样式与轻微角色/屏幕动效(见 §9,不加新音效)。

## 7. 两态点亮与氛围(ch1 现状消费)

### 7.1 StageSky 点亮叙事

- `restored`(已恢复 `{wordId,layer}` 对)经 `restoreOrder` 语义决定**场景元素点亮状态**:元素 = 该幕关键 emoji(太阳/星星等),由 `restored` 命中次数(现 SkyStrip 同款 0/1/2 档)驱动 `grayscale→彩色 + 亮度`,最终白闪过渡(复用现有 celebrate)。
- 开局 `dawn` 氛围自带灰白滤层 → 随 restore 撤灰;全部恢复 + BOSS 胜 → 全彩。

### 7.2 与 PLAN「场景两态升级」行的关系

- 本轮用**氛围层 + 关键 emoji 元素**实现灰白→彩色点亮,是该行"全场景灰度→点亮 + 白闪"的**核心子集落地**。
- 逐元素精确编排(村庄/月亮/天空各自现身)、`ending` 白闪、接线 `celebrate`(现死)/消费 `restoreOrder` 中尚未消费的部分:仍留待该行后续(若后续要细分,在本轮接缝 `atmosphereStyle`/`roleVisual` 之上扩展,不返工)。

## 8. ch1 内容数据补编(只加字段,台本不改)

| scene(段) | 展示组 | stage.cast | atmosphere | mood 标点(个别) |
|---|---|---|---|---|
| open(dialogue) | 开场台词 | [lingling, sun] 提前同框 | dawn | sun 求救句 scary;lingling 求助句 calm |
| t1~t5 task(intro/onDone) | 各词引子/收尾 | 常驻 lingling;onDone 词相关角色(太阳/居民)靠临场 | 随 restore 逐段转亮(dawn→day) | 月亮哭诉 sad;villager 欢呼 happy |
| social-moon | 哭诉 lines / onGood | [lingling, moon] | night | 哭诉 sad;onGood happy |
| br1~br3 break | — | — | night(月夜) | — |
| boss | intro/win/lose | [jingmo, lingling] | dark | 恐吓 scary;逃跑(win)scary→lingling calm |
| ending | 恢复台词 | [villager, lingling] | day(全彩) | villager 欢呼 happy |
| settle | summary | —(结算卡 UI 承载;summary 沿用现 `SettleCard` 灵灵摘要框,无站队需要) | day | 悬念句 calm |

- 具体 mood 落点实现时以不喧宾夺主为度:仅 哭诉/恐吓/欢呼/求救 类**情绪显著**句标注,其余缺省 calm,避免逐句标注噪音。

## 9. 视觉/动效规范(克制,契合既有简约风格)

- 背景渐变:在现有 canvas 天空系上扩展 `dawn/dusk/night/dark` 4 组(`day` ≈ 现默认),`dark` 供 BOSS。**不引入位图**。
- 角色动效:说者 talk(现有灵灵同款 CSS/motion,如轻晃/跳 + 亮牌)、idle 呼吸、临场滑入/淡出;尊重 `prefers-reduced-motion`(沿用现有兜底)。
- 气泡:白/浅底圆角 + 细边 + 指向尾;`mood` 影响**气泡边色/角色表情动效**维度;旁白=居中细框叙述盒。
- 浮层面板:task/social/boss 作答区用半透明漫画面板(保留现有组件可读性),任务徽条贴纸化。
- 音效:不新增 AudioCue;沿用现有 correct/wrong/连击等。

## 10. 后续子项待办(另开 spec/plan,不在本 spec)

- 分镜转场 / 拟声字 / 网点速度线等**全套漫画语言**(「全漫画帧」路线,本轮刻意不做)。
- 位图美术升级(只改 `stage-visuals.ts` 映射表即可;含真实立绘需解「多角色美术立绘资产」非目标,届时再议)。
- 自动连播字幕机(需扩 speech 契约暴露朗读完成回调)。
- PLAN「千字谷 场景两态升级」行细化(逐元素精确编排 / ending 白闪 / 接线 celebrate)。

## 11. 文件影响

| 文件 | 动作 |
|---|---|
| `src/features/qianzigu/stage.tsx`(新) | StageShell(全窗帧)+ StageSky(氛围/点亮)+ StageCast(站位/动效/登场) |
| `src/features/qianzigu/stage-visuals.ts`(新) | 视觉源映射 + 氛围 + 点亮规则(§6.1,位图接缝) |
| `src/features/qianzigu/stage-meta.ts`(新,纯逻辑) | cast 推导 / 阵容合成 / atmosphere 兜底 / 旁白特判 / 点亮序(可单测) |
| `src/features/qianzigu/scene-ui.tsx` | 大改:LineScene→DialoguePresenter、LineBubble→角色旁泡、Task/Social/Boss/Break/Settle 视觉壳漫画化(作答组件复用不动) |
| `src/features/qianzigu/ChapterRunnerView.tsx` | Shell→StageShell、删 SkyStrip、分发接线舞台/氛围 |
| `src/features/qianzigu/chapter.ts` | 类型加 `mood?`/`stage?`(可选) |
| `src/features/qianzigu/ch1.ts` | 补舞台字段(§8),台本不改 |
| `src/index.css` | 舞台 token、atmosphere 渐变、talk/idle/登场/点亮 keyframes |
| 对应 `.test.tsx` | 适配(推进钮沿用)→ 详见 §12 |

无 worker / DB / 迁移 / settings / speech 契约 / question-engine 改动。

## 12. 测试

- **新增纯逻辑单测**(stage-meta):cast 缺省推导(首现序)、cast+展示组阵容合成、narrator 不站队、atmosphere 缺省兜底、restore 点亮档(0/1/2 → 灰→彩)、临场登场判定。
- **适配组件测试**:`ChapterRunnerView.test.tsx` 7 例流程沿用——推进按钮保留(`getByRole` name=继续/下一题/回地图…),需适配的是舞台 DOM 树变化与部分文本断言;新增对话同框/角色旁泡/两态氛围的断言。`engine.test`/`ch1.test` 等纯逻辑**不改仍绿**。
- `architecture.test.ts` 边界照守(qianzigu 自包含;stage-visuals/stage-meta 只依赖 shared 既有类型与 ui 基础件)。
- 全量 `npm test` 须绿(现 264 例基线)。

## 13. 验收(浏览器人工走查,接 ch1 spec §7 之后)

```
□ 千字谷 ch1 全流程:开场灰白同框对话 → 5 任务(浮层题卡)→ 社交(月夜)→ BOSS → 结局全彩 → 结算
□ 全窗即舞台:满视口不滚屏;宽/窄窗角色站位自适应、无溢出无滚动;退出/返回仍可达
□ 同框多人:灵灵+太阳(开场)、灵灵+月亮(社交)真实同框轮说;说者 talk 动效 + 名字牌,其余 idle
□ 角色旁漫画泡:气泡锚定说话者、带指向尾、限宽不遮挡;点画面任意处与主钮均可推进;自动朗读随句
□ 旁白(narrator)以居中叙述框呈现,不占站队
□ 场景两态:开局灰白 → restore 逐元素点亮 → 全彩;结算叠彩化天空(白闪复用 celebrate)
□ task/social/boss 浮层面板可读、作答交互与判分行为与现状一致(2 次作答/重试/两段式选择不回归)
□ mood 情绪句气泡/动效到位且不喧宾夺主;reduced-motion 下不卡顿
□ 断点续玩 / 星尘结算 / 角色语音降级 无回归
```

## 14. 发布轨与子项拆分

- 新能力、兼容新增 → **feature 轨下一个 minor**(0.2.0 / 0.3.0 排期后);先于 PLAN 想法池以 `P1` 落行锚定(随本 spec 一并登记)。
- 工作量预估 **L(≥3 天)**,落地按仓库纪律拆 2~3 个 plan 走 SDD:
  1. `qianzigu-manga-stage-core` — 数据字段 + stage-meta 纯逻辑 + StageShell/Sky/Cast + DialoguePresenter + 测试;
  2. `qianzigu-manga-stage-scenes` — task/social/boss/break/settle 浮层化 + 氛围点亮接线 + 测试适配;
  3. `qianzigu-manga-stage-ch1` — ch1 舞台字段补编 + 全流程测试 + 浏览器人工验收走查。
