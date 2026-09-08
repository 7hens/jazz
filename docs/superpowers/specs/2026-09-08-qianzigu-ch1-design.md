# 千字谷·第1章《太阳的求救》:重构现游戏为章节叙事(子项1 · 可玩纵切片)

> 日期:2026-09-08 · 影响面:能力(新叙事章节子系统 + 词库数据升维),兼容新增 → **minor**(随下一条 feature 轨发)
> 来源:`docs/ideas/260908-01-001.md`(第1章完整设计规范)+ `docs/ideas/260908-game-01.md`(家庭版)+ `docs/ideas/260908-game-design.md`(星语群岛 v12)。
> 决策记录(本 spec 已由用户确认):完整照文档实现 · 重构现游戏为千字谷 · 双世界壳(千字谷=汉语章节,字母林=英语保留)· 放行「拍照抠图贴图」(不做内容语义识别)· 放行「汉字部件拼装」(不做笔画顺序书写)· 首份 spec = 第1章可玩纵切片 · 章节完成度**复用现有 per-word 技能进度 + 星尘**。
> 关联:CLAUDE.md 架构铁律 · `docs/dev-reference.md` 数据模型事实 · PLAN「星语群岛 v10 方向」观察块(本 spec 立项时解禁/改写冲突行)。

## 1. 背景与目标

现产品是「魔法语言岛·词库岛」:100 词(纯名词,5 主题)按 id 线性解锁,每词按家长启用的领域(汉语=拼音+汉字捆绑 / 英语)跑 2 步 ×2 题技能课,per-word × per-skill 进度,星尘结算。**没有**场景/章节/剧情/角色语音/场景两态概念;导航/解锁/结算全部假定「线性 wordId、单『词』= 最小可玩单元」。

`docs/ideas/260908-01-001.md` 描述的是**千字谷第1章**:一个 10-12 分钟的叙事章节 —— 灰白场景开场 → 灵灵语音引入 → 5 个任务(每任务=一词:听音引子→核心互动→情境应用)→ 社交事件(安慰月亮,后果式选择)→ BOSS 战(静默,交错复习)→ 结局场景恢复彩色 → 结算卡 + 下章悬念;全程角色分音色语音、自然断点可随时退出续玩。

**本次目标(子项1)**:以「第1章可玩纵切片」为第一步,把现游戏**重构为千字谷形态**,并让 ch1 能从头到尾玩通:
- 词库数据升维:加 `partOfSpeech` + 章节归属,补 ch1 5 词(太阳/升起/亮/早上好/星星)中不在册的 3 词(升起/亮/早上好)。
- 双世界壳:千字谷(汉语=章节叙事)+ 字母林(英语=现词库流保留,本轮不加叙事)。
- 章节运行框架 + 场景两态(灰白→彩色)+ 自然断点。
- 角色语音层(speakRole 分音色/自动朗读/逐选项播)。
- ch1 内容全数据化,任务由**现有 3 题型参数化**承载 → 纵向跑通。

**后续子项(明确不在本 spec,仅记待办)**:绘画拍照抠图(D 新交互,对应 P1 绘画题型提前立项)· 汉字部件拖拽拼装 · 真实 TPR/情感匹配等新交互模板 · 字母林叙事壳 · ch2+ 内容 · 间隔重复复习队列 · 音效资产库/家长录音。

**非目标(防蔓延)**:多世界(万色谷/百数塔/七音森)、家长端/报告、家长录音、个人词库、多角色美术立绘资产(以 emoji + 场景元素代替)。

## 2. 现状事实(改动前快照)

- 词库 `src/features/vocabulary/words.ts`:`WordUnit { id, emoji, pinyin, hanzi, english, category, teaser }`,恰好 100 词,id==下标+1,5 主题(shape/food/animal/nature/object 各≥8),hanzi/english 各 100 全局唯一(测试锁死)。
- **词性**:无 `partOfSpeech`;100 词实质全名词。ch1 需 升起(动)/亮(形)/早上好(交际) → **不在册**;太阳(id1)/星星(id3)在册但归 `shape` 主题。
- 题型仅 3 种:`QuestionKind = choice|listen-choice|match`;每词技能步 `stepsFor(settings)`,每步 2 题、选项恒 4。
- 进度:每 user×word 一行 `WordProgress{ wordId, completed:{pinyin,hanzi,english}, starsEarned, updatedAt }`;`fullComplete` 域内全技能过=词完成;技能首过 +30、整词首通 +20(MAX 幂等,只升不降)。
- 解锁:`firstTargetId` = 第一个未全完成的词;`locked = w.id > target`(纯线性)。导航 `App` 相位 `boot/login/home/lesson/settings`,home 挂 `ArchipelagoView`(5 主题词块网格)。
- foundation 短教体系:声母/韵母/声调/字母目录 + `decompose.ts` 拆音节 + `estimator` learning/known + `FoundationStepGate`/`TeachOverlay` mandatory 短教 + `ColdStartWizard`。
- speech(`features/speech/`):浏览器 SpeechSynthesis,按 BCP47 选 voice,`speak(text, lang?)`,无角色/音色参数;音效 5 种 AudioCue。
- teaser:100 词各带 ≤40 字谜语式引导语、首尾衔接成链(隐性叙事种子)。
- D1:`migrations/` 0001 基线(progress 表 + settings 三技能列)→ 0002_fun → 0003_basics → 0004_chinese_domain → **下一个迁移号 = `0005`**。worker 手写路由 + `getAuthenticatedUser`;后端只做行级读写、不解析词义。

## 3. 架构设计

### 3.0 子项边界(纵切片取舍)

本 spec 交付「ch1 可玩纵切片」:章节容器 + 场景两态 + 语音层 + 复用进度 + ch1 内容数据化;任务承载 = 现有 3 题型参数化出题。绘画/拼装/T 感知类**不在本 spec**,但章节数据模型预留「任务类型可替换」接缝,使后续新交互以插件式插入、不返工。

### 3.1 词库数据升维(vocabulary)

```ts
export type PartOfSpeech = 'noun' | 'verb' | 'adjective' | 'social'
// WordUnit 增加(可空,老词默认 'noun'):
//   partOfSpeech?: PartOfSpeech
//   chapterId?: number            // 归属千字谷章节;非章节词缺省
```

- words.ts 追加 3 词:`升起`(verb,`⬆️`,pinyin `shēng qǐ`,english `rise`)、`亮`(adjective,`✨`,pinyin `liàng`,english `bright`)、`早上好`(social,`🌅`,pinyin `zǎo shang hǎo`,english `good morning`)。补词需给全字段含 emoji/pinyin/english/hanzi/teaser;`partOfSpeech` 如上;`chapterId=1`。emoji 取自文档 §4.10 结算卡图示,不与既有词 emoji 冲突(emoji 无唯一性约束,但选词避开 ☀️/⭐)。
- **`category` 枚举扩一档 `'story'`**:现 5 主题(shape/food/animal/nature/object)语义是「具体名词的主题可视化」,动词/形/交际词无处可归 → ch1 补词统一 `category:'story'`。词库完整性测试相应改:总词数 100→103、`'story'` 类仅含 ch1 三补词(不参与「每类 ≥8」断言,该断言只约束原 5 主题)、hanzi/english 唯一性照旧。`getVisual`/场景 emoji 由 `word.emoji` 承担,不依赖主题分类。
- **不重排既有 id**(词序=解锁序的既有语义由章节层接管,见 3.4)。

### 3.2 章节数据模型(qianzigu 内,语义属主)

新增 `src/features/qianzigu/`(千字谷世界壳 + 章节运行引擎),含数据与纯逻辑:

```ts
export interface ChapterScene {            // 一节剧情单元
  id: string                               // 如 'open' | 't1-listen' | 't1-core' | 't1-apply' | 'break' ...
  kind: 'dialogue' | 'task' | 'social' | 'break' | 'boss' | 'ending' | 'settle'
  role?: SpeechRole                        // 谁说话(灵灵/太阳/月亮/静默/旁白/居民);类型定义见 shared/services/speech.ts,见 3.6
  lines?: ChapterLine[]                    // 自动朗读台词
  taskRef?: { wordId: number; restore: ('sound'|'shape')[]; q: QuestionSpec[] }
  next: SceneFlow                          // 顺序 / 条件跳转(社交事件后果式、失败保留)
}
```

- 场景元素(`scene-elements`):太阳/月亮/星星/村庄等,由既有 `word.emoji` + 章节态驱动两态点亮;`restoreState` 推进=对应词 `completed` 落库。

### 3.3 章节运行引擎 + 场景两态

- 引擎 = 有序 scene 推进机(纯逻辑,可注入 rng 测):读 ch1 script 数据 → 播放台词/出题/判分/写进度 → 依 `restore` 推进场景点亮 → 遇 `break` 自然断点(「继续/明天再来」)→ BOSS/结局/结算。
- 场景两态:容器内视觉元素 `filter: grayscale(100%) brightness(.7)` → 随该词「形状/声音」恢复逐步点亮;最终白闪过渡彩色(复用现有 celebrate/彩带)。
- 任务题承载 = 现有 `question-engine` 参数化(choice/listen/match),干扰项/选项数(恒 4)/朗读规则沿用引擎既有能力;技能步语义映射:任务「声音恢复」≈ pinyin 层、「形状恢复」≈ hanzi 层 → 判分/attempt2 重试/reveal 语义与现 `WordLesson` 逐题一致,章节引擎只管**驱动与写进度**,不重实现判分;答对/答错音效走现有 AudioCue。
- 每任务「听音引子→核心→应用」三段中的核心题组即由引擎按词出:复用 `makeStepQuestions`/短教产物,章节只在外围包一层叙事 scene;干扰项仍同 category 优先(ch1 全在 shape 主题的邻近词内取)。

### 3.4 导航/世界壳(App 重组)

- `App` 相位扩展:home(世界壳)→ `world: qianzigu|letter-forest`。千字谷下为「章节地图(20 章占位,仅 ch1 可玩)」;字母林 = 现 `ArchipelagoView` 单词流原样挂入。
- 解锁:千字谷内部 ch1 unlocked 常真(首章);后续章由章内词完成驱动。**既有 per-word 线性解锁在千字谷路径下让位于章节地图**,但字母林路径维持原 `firstTargetId` 逻辑不动 → 两张入口共享同一 per-word 进度账,不裂。
- **story 类词边界**:`category:'story'` 的 ch1 补词只由千字谷汉语章节承接 —— 字母林/现单词流(id 驱动的 `ArchipelagoView`、`firstTargetId`、英语域技能步)**一律过滤 story 类**(其 english 字段仅备用,字母林不做分解教学)。两种入口各自遍历的词域明确区分:字母林 = 现 5 主题词,千字谷 = 章节归属词(含 ch1 复用词 + story 补词)。
- 新 feature `qianzigu/` 遵守 3 层边界:`useService` 仅其 `<Name>Entry.tsx`,跨 feature 依赖走 bootstrap 注入 / props;`app/bootstrap.ts` 注册新 token 并加入 `ALL_SERVICE_TOKENS`。

### 3.5 进度/星尘复用映射(核心幂等规则)

- ch1 任务完成一词的「声音+形状恢复」= 写该词 `completed.pinyin=true / completed.hanzi=true` → 走现有 `settleWord`(+30×2 / 整词首通 +20)。结算卡展示**真实 settle 累计**的本次新增星尘;文档 §4.10 的「+140」是估算示例,**非硬编码目标值**,以引擎实际结算为准(展示连击/成就仍照文档)。
- **幂等**:同一词被 词课/字母林 与 千字谷 双入口触发时不重复发技能星尘(现有 settle MAX 只升不降天然满足;首通 +20 由 `fullComplete` 首次跃迁判定,天然只发一次)。
- 断点/chapter 进度落盘:倾向新迁移 `0005`(见 §5),per-user 存「当前章节 + 已过 scene id / restore 进度」,续玩续走,失败保留(已完成任务不退)。

### 3.6 语音层(扩 shared 契约 + features/speech)

角色音色 = 影响外部可见的说话语义,类型与**契约**落 `shared/services/speech.ts`(供 qianzigu 数据/引擎引用,不跨 feature 引用):

```ts
export type SpeechRole = 'lingling'|'sun'|'moon'|'jingmo'|'narrator'|'villager'
export type SpeakOptions = { rate?: number; pitch?: number }
export const speakRole: (text: string, role: SpeechRole, opts?: SpeakOptions) => void   // 契约签名(token 见服务注册)
```

- 角色 → {rate,pitch} 映射与实现放 `features/speech/`(现 `speak(text, lang?)` 之上加 role 维度,复用既有队列/防掐头/暖机;默认 role 参数可省)。台词自动朗读、选项「逐个弹出+自动朗读」由 qianzigu 引擎驱动调用;静音降级走现有 speech 降级(无 voices → 静默 + UI 加大字/emoji)。
- 全部走 SpeechSynthesis,**不引入 TTS 音频资产**(非目标)。

> 接缝注:`speakRole` 作为新的 speech 契约方法注册,不新建独立服务 token;若实现需区分「无角色朗读」兼容现调用,则以可选 `role` 参数形式扩展,旧调用不破坏。

## 4. ch1 内容数据(ch1 词表)

| 词 | partOfSpeech | 在册? | 处理 |
|---|---|---|---|
| 太阳 | noun | id1(shape) | 章节归属 ch1,不重复建档 |
| 升起 | verb | 否 | words.ts 追加 |
| 亮 | adjective | 否 | words.ts 追加 |
| 早上好 | social | 否 | words.ts 追加 |
| 星星 | noun | id3(shape) | 章节归属 ch1 |

- script 数据含 开场/5 任务(听音引子·核心互动·情境应用)/社交事件(后果式 3 选项循环)/BOSS(交错 5 题,失败≤3 保留)/结局/结算+悬念,台本文案直接采用 `docs/ideas/260908-01-001.md` §4 原文(版权归作者,仓库内做内容源)。
- 任务「画太阳」「部件拼装」「TPR 模仿」beats 本 spec **只留占位与接缝**,真实交互由后续子项插入(§3.0)。

## 5. 数据与迁移

- 新迁移 `0005_qianzigu_chapter.sql`(additive,带 DEFAULT):`user_qianzigu_progress(user_id TEXT NOT NULL PRIMARY KEY, chapter_id INTEGER NOT NULL DEFAULT 1, resume_scene_id TEXT, restore_state TEXT NOT NULL DEFAULT '{}', updated_at TEXT NOT NULL DEFAULT (datetime('now')))`。`restore_state` = 已恢复词/元素集合的 JSON(章节地图 + 续玩定位用),`resume_scene_id` = 自然断点后从哪个 scene 续。单行/单活动章节即可承载 ch1;不扩 settings 列(settings 是开关账,章节态独立表更干净)。遵循「顺序先升库后升代码、本地 db:local → preview → prod」。
- **不改 0001 基线**;`worker/` 加只行级读写的 chapter handler(`GET`/`PUT` upsert 单行),`getAuthenticatedUser` 后按 user 隔离。词库补词:新增词 id 接 101+ 追加(现白名单按 1..100 放行,需扩到含新 id),后端**不解析** restore_state JSON 语义,仅做行级读写。

## 6. 测试

- `architecture.test.ts` 4+1 铁律对新 feature 照守;新 token 进 `ALL_SERVICE_TOKENS`。
- 词库完整性测试改口径:103 词、唯一性、partOfSpeech 合法、ch1 章节归属 5 词齐全。
- 纯逻辑测试:章节引擎顺序推进/断点续玩/失败保留/BOSS 交错题;进度映射幂等(双入口同词只发一次星尘);speech `speakRole` 配置与降级。
- 冷启动/首响回归保持绿(改动语音层不动既有探测)。

## 7. 验收(可玩纵切片)

```
□ 千字谷首页=章节地图,ch1 可选、ch2+ 锁定占位;字母林入口保留现单词流
□ ch1 灰白开场 → 5 任务(听音/核心/应用)用现有题型跑通 → 社交事件 → BOSS → 结局彩色 → 结算卡
□ 全程角色分音色自动朗读、选项逐个弹出朗读;无 Web Speech 时降级不卡死
□ 任务完成一词 = 该词 pinyin/hanzi completed 落库,星尘按现有规则结算;重复进不重复发
□ 自然断点「继续/明天再来」+ 刷新可续玩;BOSS 失败≤3 → 已完成任务保留、待挑战
□ 结算卡:学会 5 词(本次真实新增星尘)/ 连击 / 成就 / 悬念预告;场景从灰白到彩色逐段点亮
```

## 8. 后续子项待办(另开 spec/plan,不在本 spec)

- 绘画拍照抠图(P1 绘画题型提前立项,红线改写为「不做内容语义识别」)
- 汉字部件拼装(D 新题型 + 部件数据;红线改写为「不做笔画顺序书写」)
- 真实 TPR/情感匹配等词类互动模板
- 字母林叙事壳、ch2+ 内容、间隔重复复习队列、音效资产/家长录音
