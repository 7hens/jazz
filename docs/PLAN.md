# PLAN 需求与任务管理

> 全仓需求/任务**唯一入口**,取代 `docs/IDEAS.md`(想法池)+ `docs/TODO.md`(看板)。规则:
>
> - 任何新需求先进「想法池」**一行,带 `P0`/`P1`/`P2` 前缀**;重复即弃旧;**禁止直接开工**。
> - 排进本轮开工 → 升「当前迭代」;确认不做 → 移「坚决不做」留痕(防反复)。
> - 状态细节在 spec / plan / sdd,此处只记**行级事实 + 优先级**,不逐条抄进度。
> - 关键准则(准入 / 估算收尾 / 复盘三问 / 分支模型):见 `CLAUDE.md`「需求与版本管理」。

## P 优先级(需求 = 影响面,P = 何时做)

| 级 | 含义 | 闸门 |
| :-- | :-- | :-- |
| `P0` | 最高:本轮在跑 / 阻塞发版 | 立即做,做完发 |
| `P1` | 确认要做,待排期(原「二期 backlog」) | 立项 → 排期 → 开工 |
| `P2` | 想法观察,未承诺 | 先入池冷静;重复即弃 |

## 当前迭代

> 双轨制,可并行(轨 = 变更类型/发布线,版本号由影响面定,见 CLAUDE「版本语义」):
>
> - **feature 轨** — 新能力/需求线,可**聚合多个需求**并行开发;集齐、双闸门过才发,不逐需求发。版本:兼容新增 → minor;破坏 → major(1.0.0 起,0.x 阶段破坏仍落 minor)。
> - **hotfix 轨** — bug 修复线,基于**已发布 tag** 出,不夹带未发 feature 代码;就绪即发独立 patch。
>
> 行格式:`- [ ] P<n> [轨] 标题 — <状态> · <链接>`;详设 `superpowers/specs/`、执行 `superpowers/plans/` + `.superpowers/sdd/`,轨内可多 plan。发版后清空对应轨换新、版本前推。

### feature 轨 — 目标 `0.2.0`(未发;新能力,兼容 → minor)

- [x] `P0` `[feature]` 趣味性系统(fun-system)— 开发完成并入 main,随 0.2.0 一起发 — [plan](superpowers/plans/2026-09-04-fun-system.md) / [spec](superpowers/specs/2026-09-04-fun-system-design.md)
- [x] `P0` `[feature]` 前端架构重构 — 开发完成并入 main,随 0.2.0 一起发 — [plan](superpowers/plans/2026-09-04-dev-architecture-refactor.md) / [spec](superpowers/specs/2026-09-04-dev-architecture-refactor-design.md)
- [x] `P0` `[feature]` 基础引导自适应教学层(foundation-learning)— 开发完成并入 main,随 0.2.0 一起发 — [spec](superpowers/specs/2026-09-05-foundation-learning-design.md) / [plan·core](superpowers/plans/2026-09-05-foundation-learning-core.md) / [plan·embed](superpowers/plans/2026-09-05-foundation-learning-embed.md)
- [x] `P0` `[feature]` 浏览器端人工验收 — 0.2.0 发布前置:登录 → 词 1 三技能(含故意答错)→ 结算 +110 → 解锁词 2 → 关拼音后词 2 只 2 步 → 刷新持久 → 重置归零;补 fun 抽查(连击 / 成就 / 幸运 / 夸奖 / 撒花)
- [x] `P0` `[feature]` 拼音短教单元锚点重构 — 人工验收发现:合体 chip 读整词(缺音节↔汉字对齐)、j/i 等 9 对声母/韵母共享同锚(emoji/读音不独立)。修:decompose 产音节汉字、catalogs 每单元独立单音锚点、demo/quiz 消费对齐 — [design](superpowers/specs/2026-09-06-pinyin-anchor-redesign-design.md)
- [x] `P0` `[feature]` 答题卡交互重构(点听·确认制)+ 短教结口 — 人工验收:短教全屏无返回出口、教学与做题同款难辨、选项卡喇叭拥挤且点选即跳误触无确认。改:Choice/ListenChoice/Match 去喇叭、点卡即念、题干整块可点重播、「确定」提交才判;短教卡听齐(requireVisitAll)才可确认作答但仍判分保熟度、补「返回地图」出口、教学期视觉壳与真答题区分;主词课判对后自动推进保留(注:短教「听齐」中间态已被下批「答题卡交互收口」改为纯判分 4 选项,见下行) — 开发完成并入 main,随 0.2.0 一起发 — [design](superpowers/specs/2026-09-06-quiz-interaction-redesign-design.md) / [plan](superpowers/plans/2026-09-06-quiz-interaction-redesign.md)
- [x] `P0` `[feature]` 砍词课步前 soft「想先学一下?」软浮条 — soft(教过仍 learning)不再打断、放行直接答题,仅未教 mandatory 强制短教;改 `FoundationStepGate` 放行 + App judge 收敛 `mandatory` — 已并入 main(commit e04260e),随 0.2.0 发
- [x] `P0` `[feature]` 答题卡交互收口(短教纯判分 + 全题型 4 选项 + 题型徽章 + 听一听喇叭重听)— 家长口径「别听完才答、直接选对错判分」:短教 TeachOverlay 删 demo/tap 演示步与听齐(requireVisitAll)门,对每个未教单元直接出 **4 选项纯判分题**(错答复演示、答对进阶,全过 praise 结课;保留直接答题 + 返回地图出口);Choice/ListenChoice 删 requireVisitAll/visited 听齐提示;所有题(选一选/听一听/短教/连连看)选项**恒 4**(engine `optionCountFor` 定 4、teach-questions 干扰 3);题卡左上角题型徽章(`TypeBadge` 选一选/听一听/连连看);ListenChoice 标题行恢复喇叭图标(Volume2)点重听(替虚线圆重听区);删孤立 `demo-blocks.*`(演示产物已随 demo/tap 退役)。已并入 main(commit e04260e),随 0.2.0 发 — [quiz-interaction spec](superpowers/specs/2026-09-06-quiz-interaction-redesign-design.md) / [foundation spec](superpowers/specs/2026-09-05-foundation-learning-design.md)
- [ ] `P0` `[feature]` 远程 D1 迁移 — 0.2.0 发布前 apply `migrations/0002_fun.sql`(settings 新列),preview → 生产;本地已 `npm run db:local`
- [x] `P0` `[feature]` 发音首响优化(预热·防掐头·静默暖机)— 0.2.0 人工验收:发音有延时、偶发前半段无声。speech 服务:创建即预取 voice 表 + `voiceschanged` 刷新缓存(空轮询不覆盖好缓存);语音未就绪时最新一条朗读入队、就绪补播(不静默丢);空闲不 cancel 立即播、仅引擎忙才 cancel 且隔 ~30ms 再播(防 Chrome 吞句头);无匹配 voice 且引擎有 voices 时降级默认音;**不做引擎暖机**(取舍 2026-09-09:曾播 volume=0 真音节想无声唤醒懒 TTS,Firefox/Chrome 不遵守 volume=0 → 会话首次交互真实响 `'a'`(进千字谷地图 bug),已整体删除;voice 预取/入队/防掐头保留)。测试 speech 4→9、`npm test` 264 绿 — 并入 main,随 0.2.0 发
- [x] `P0` `[feature]` 声调锚统一 qi 四调 + 删轻声 — 拼音短教声调单元锚改同一音节 qi:ton1 七 `qī` `7️⃣` / ton2 旗 `qí` `🚩` / ton3 企 `qǐ` `🐧` / ton4 气 `qì` `🎈`;轻声 ton0 整体退役(本无出题、decompose 只顺带产键记过)→ `PINYIN_TONES` 4 项、轻声音节不再产声调单元键,帽子/月亮等 ~21 轻声音不再为幽灵单元强制补教 — 已并入 main(commit 008bfa8),随 0.2.0 发

### feature 轨 — 目标 `0.3.0`(未发;新能力,兼容 → minor)

- [ ] `P0` `[feature]` 汉语领域并轨 S1 — 启用模型 3 技能开关 → 2 领域开关(汉语=拼音+汉字 捆绑 / 英语),内部 `SkillKey`/进度三键/步序/出题/结算不变;面板与冷启动按域;迁移 `0004_chinese_domain.sql` 加 `enable_chinese`(回填任一侧旧汉语技能开即域开)。随 0.2.0 发布后下一条 feature 轨发 — [spec](superpowers/specs/2026-09-08-chinese-domain-merge-design.md) / [plan](superpowers/plans/2026-09-08-chinese-domain-merge.md)
- [ ] `P0` `[feature]` 千字谷镇重设(全拟人角色 + 轻线悬念,ch1 内容重写)— 全游戏收敛为汉语世界;班底 苏灵灵🦊 / 徐万年🦥 / 皮小闹🦝 / 吴铭🦇(绰号谐音「无名」,小名小明,真名常默=末章一剧情词);**无通用群众位** —— 每个出声角色都有姓名与一页卡,后续新角色按 spec §4.6 规程逐个立项;18 幕结构保留、引擎/进度零动、零位图(emoji);`SpeechRole` 终态 5 值(旧天体角色 / 黑影反派 / 群众位一律退役;语音域红线,已随 spec 报批);旧 ch1 进度作废。**文档已同步**:`game-story-bible.md` / `game-direction.md` / `game-assets.md` / `game-visual.md` 已按落地重写(含 4 张角色一页卡),`docs/design/` 命名残留复核 0 命中(PLAN `[x]` 历史条目保留原样);发布前闸门 = 浏览器走查 18 幕 — [design](superpowers/specs/2026-09-10-qianzigu-town-redesign-design.md)
- [x] `P0` `[feature]` 千字谷 ch1 纵切片(已落地,发轨待 0.3.0)— 重构现游戏为千字谷:双世界壳(千字谷·章节地图 / 字母林保留零改动);ch1《太阳的求救》可玩纵切片(词 1/101/102/103/3,story 补词 升起/亮/早上好;内容已由 2026-09-10 镇重设整体替换,见上行),P3 引擎跑 dialogue/task(听音·辨形双层恢复,minCorrect 2)/社交(两段式先听后选)/BOSS/结局/结算,恢复写词进度 + 复用星尘结算(幂等),断点续玩落迁移 0005。5-plan 经 SDD 全绿(324 tests,0 Critical);架构红线(useService 单点/feature 不互引/worker 行级)全守。**发布前闸门**:spec §7 浏览器人工走查(灰白→彩色 / 全程角色语音 / 刷新续玩 / BOSS 失败保留 / 社交听选)——无 headless 工具未自动。绘画/部件拼装子项未含(见想法池)。已解禁边界见「坚决不做」。— [spec](superpowers/specs/2026-09-08-qianzigu-ch1-design.md) / [plans](superpowers/plans/2026-09-08-qianzigu-ch1-vocab.md)(+speech-role/+ch1-engine/+ch1-persistence/+ch1-ui)

### hotfix 轨 — 目标 `0.1.1`(基于 `v0.1.0` 已发 tag)

- (空 — `0.2.0` 发布前只修 `v0.1.0` 上线 bug → `0.1.1`;`0.2.0` 发布后 base 前移,下一 hotfix 为 `0.2.1`。浏览器验收 / 生产冒烟发现 bug 即在此加行 `[hotfix]`,独立快速发)

## 想法池

> 一行一需求,`P1` = 确认要做待排期,`P2` = 想法观察不承诺。行格式:`- [ ] P<n> 标题 — <一句上下文>`。重复即弃旧。

- [ ] `P1` 绘画题型 — 一词一画:拍照 → 缩略 → 亮度抠图 → 自动裁剪 → 确认;`progress.drawing_*` 列后续迁移加入(一期视觉来源 = `word.emoji`,`getVisual(word)` 已留接缝)。spec §2.2 有述
- [ ] `P1` 填空题型 — fillBlank:汉字补缺字 / 英语补字母(引擎候选题型 §7.2 已预列,编码未做)
- [ ] `P1` 复习挑战 / 错词重练排程 — 每 5 新词、弱技能优先出题
- [ ] `P1` 离线可用 — IndexedDB + Service Worker + syncQueue + 字段级合并
- [ ] `P1` settings 中途开启模块的语义缺口 — 家长学习时关技能、之后重开 → 已学词重达「全完成」再触发 +20、目标词回跳;以 per-word 永久 `bonus_granted` 列 + ever-enabled 解锁修复。spec §13 有述
- [ ] `P1` 词库 emoji / 分类语义人工校对 — shape 组含书 / 门 / 礼物等非形状物、nature 组含蜜蜂 / 蝴蝶等动物(源自 v1.1 数据瑕疵),需真人图文重整
- [ ] `P1` 汉语句型步(每词 1 句 · 拼装)— 原则「不止认字,还要帮孩子说话」:汉语域每词加第 3 步「声 → 形 → 句」,题型 = 句子模板挖空 + 4 选项点选成句(复用 `question-engine` 与可注入 `rng`);**不出声、不判音准** —— 守住「坚决不做:语音识别」红线。100 词各 1 句**手写**(词库无词类,无法自动生成)+ 同 `category` 干扰词集,句子存 `src/features/vocabulary/sentences.ts`(`wordId → sentence`,不塞 `words.ts`);word progress 加 `sentence` 键 + 迁移;ch1 **18 → 23 幕**、断点重算、章节时长约 +30%。⚠ **须与 0.3.0「汉语领域并轨 S1」的 `0004_chinese_domain.sql` 合并设计**(句型归汉语域内固定步,不新增第 3 开关),勿两条迁移并行。不做整句乱序拼装(数据 ×3,留二期)。工作量 L → 强制拆 spec。2026-09-11 入池,未立项
- [ ] `P1` 章节叙事闸门(章章有高潮 + 章章有笑点)— 原则「每章要有跌宕起伏的高潮」「最好有一点孩子都能明白的笑点」:章节契约新增两栏必填 —— **高潮位**(哪一幕 / 情绪峰值 / 场面不可逆改变)与 **笑点位**(哪一幕 / 机制 = 误会·重复·落差)。**判据**:笑点禁谐音梗与双关(孩子词汇量接不住);填不出任一栏 = 不交稿。落点:`game-story-bible.md` §4 章节契约 + `game-story-design` 技能质检闸门 + 章节 spec 必填同两栏。ch1 追溯登记:高潮 = `t1-shape` 第一个小高潮 + `boss` win;笑点 = 徐万年推门拉反 + 皮小闹冒失撞人(现散在 `game-direction.md`,收进契约)。2026-09-11 入池,未立项
- [ ] `P2` mergeProgress 死导出 — [src/game/progress.ts](../src/game/progress.ts) 导出未接线;接入加载合并或删除(连同测试)
- [ ] `P1` 发音引擎替换为 kokoro 本地 TTS(替浏览器 SpeechSynthesis)— 目的:跨设备一致 zh/en 真声 + 千字谷五角色独立嗓音(现仅 rate/pitch 硬调);接缝单点 = `src/features/speech` 内 `SpeechService` 换实现,`AudioService`(音效)不动。未定:推理跑哪(端侧 WASM kokoro-js / 出包预生成音频资产 / 本机 sidecar——生产为 Cloudflare 托管 → sidecar 基本不可行);词库+ch1 台词文本固定宜缓存/预生成,但 ch1 台词仍打磨中 → 预生成时机未到。2026-09-09 入池,未立项
- [ ] `P1` 千字谷 场景两态升级 — 待 ch 数据带 scene-elements(村庄/月亮/天空元素)后按 spec §3.3 全场景灰度→点亮 + ending 白闪,并接线 `celebrate`(现死)/消费 `restoreOrder`;当前 = 顶部 SkyStrip 逐词点亮(纵切片最小实现);★ 灰白→彩色点亮核心子集已随「跑章漫画舞台化」P1 行(下)推进,逐元素精确编排等仍留本行后续 — [spec](superpowers/specs/2026-09-09-qianzigu-manga-stage-design.md)
- [ ] `P1` 千字谷 绘画/部件拼装子项 — 拍照→亮度抠图→贴图进场景(P1 绘画题型同源)+ 汉字部件拖拽拼装;ch1 竖切按 spec §3.0 跳过,接缝已标 R4a 留缝
- [ ] `P1` 千字谷 跑章漫画舞台化 — 千字谷跑章视觉重构:全窗即舞台 + 同框多人(数据驱动 `cast`)+ 角色旁动态气泡对话 + 氛围灰白→彩色点亮;引擎/进度/语音零动,`stage-visuals.ts` 留位图接缝;本轮部分消费「场景两态升级」行(见其注)— [spec](superpowers/specs/2026-09-09-qianzigu-manga-stage-design.md)
- [ ] `P2` 千字谷 漫画视觉语言增强 — (跑章舞台化后的后续子集)借鉴漫画风格设计蓝图:对白气泡**情绪造型**+按文本自适应(呐喊锯齿/思考云泡/字号)、**拟声词艺术字**即时弹出(BOOM!/咚咚,重击/答对爆点)、**镜头语言**(motion 特写/推拉/抖振做情绪与词点亮强调)、角色**站位朝向阵营感/三分法**编排;待 Plan2/3(stage-scenes + ch1 数据)合入后评估 —— React 2D 落地 = CSS + motion,DialoguePresenter/StageFrame 上扩展,引擎零动;台词泡/同框/氛围点亮已有(勿重建)。来源:漫画风格游戏设计蓝图会话贴入 2026-09-09
- [ ] `P2` 千字谷 章节 done 标记 / 结局回放 — settle 现即 `chapter.clear` 清行重玩,完成度由 per-word 承载;「已通关重看结局」需 done 列
- [ ] `P2` 千字谷 双语 wordBonus 口径 — 默认 enableEnglish 下 `fullComplete` 含英语域,ch1 只写汉语域 → 整词 +20 恒不发(故事词 101-103 字母林永不涉足);「千字谷仅汉语域」的 +20 判定待产品对齐(full-review N1)
- [ ] `P2` 千字谷 UX 打磨 — neutral 社交选项误播 wrong 音(N2)/ BOSS 题形恒 choice(N3,题序词池×[pinyin,hanzi] 轮转)/ 地图「继续」标签(有断点仍显「开始」)/ 重登落点定夺(回上次世界 vs 每次回世界壳,现 lastMapRef 保留)
- [ ] `P2` 千字谷 世界侧代价(灰度)— 每未恢复/答错一词让山谷灰度加深一档,替代「玩家惩罚」(儿童向);纯世界侧张力,【未定】需 scene `stage` 新字段 + 引擎读取 → 撞「引擎零动」红线,**须先立项再动**。来源:故事评审 2026-09-10(草稿 `docs/.tmp/story-review.md`,本地不入库)
- [ ] `P2` 千字谷 社交选项独立演出 — `social-pixiaonao` 的 bad/neutral 现仅回 `loop` 重弹(有意设计 = 教育性重试);候选升级 = 各给一次性独特演出后仍引导回正轨(不阻塞、保持单解可通);触及社交场景数据与 UI 取舍逻辑,【未定】须先立项。来源:故事评审 2026-09-10(草稿 `docs/.tmp/story-review.md`,本地不入库)
- [ ] `P2` 千字谷 角色立绘位图化 — 现全角色 = `ROLE_META` 单 emoji;素材 prompt 已**设计前置定稿**(`docs/design/game-assets.md`:4 张角色立绘 prompt(角色集 5 值,旁白不产素材)+ 布景元素 + 氛围 5 档 + 情绪符号 + 三无质检);回填须动 `ROLE_META`/CastFigure 渲染层(spec §10 位图升级),撞「语音零动」边缘,**须先立项再动**。来源:角色重设 2026-09-10
- [ ] `P2` 千字谷 演出账补齐 — `mood` 现 **3 处**(social 惊吓 / social 收尾 happy / boss 胜利 happy,原「全章 0 处」随 ch1 换写作废);余下待办 = 节奏实测回填(现仅 2s/5s 起步值,未测);分镜/交互现状与待办清单见 `docs/design/game-direction.md` §4。来源:角色重设 2026-09-10

> **已废弃(2026-09-10)**:「五世界」方向被 D1「全游戏收敛为汉语世界」取代,详见
> [千字谷镇重设 spec](superpowers/specs/2026-09-10-qianzigu-town-redesign-design.md)。原节内容见 git 历史。

### 独立想法(原五世界节内,与方向无关)

- [ ] `P2` 英语 5 层教学结构(音素→拼读→高频词→句型→对话)— 现英语=逐词单词,改分层路径影响出题引擎与词库
- [ ] `P2` 词库分级 + 每词多维度字段(核心100全量/扩展/补充;hanziDetail radical·family、phonics、drawSteps、melody 等)— words.ts 模型扩展 + 大规模数据生产
- [ ] `P2` 屏幕时间守卫 — 家长可配单次/每日时长,到点结算并鼓励休息;需 settings 新列 + 迁移 + 运行计时与打断 UI
- [ ] `P2` 分角色分技能学习报告 — ⚠️ 与坚决不做「家长看板」冲突;需先解禁该条

## 坚决不做

> 非目标,留痕防反复。设计已划界,避免待办蔓延。原 `CLAUDE.md`「真不做」+ `README`「明确不做」并集。

- 语音识别
- 汉字书写笔顺(**边界 2026-09-08**:不做笔画顺序书写教学;汉字**部件拖拽拼装**放行,千字谷 ch1 用)
- 绘画作品检测(**边界 2026-09-08**:不做绘画内容的语义识别/理解;拍照→亮度抠图→贴图放行,千字谷 ch1 用)
- 多孩子档案
- 家长看板
- 商店 / 徽章 / 宠物 / 每日挑战
- PWA
- 多人在线 / 社交
- 用户 ID 展示
