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
- [ ] `P0` `[feature]` 砍词课步前 soft「想先学一下?」软浮条 — soft(教过仍 learning)不再打断、放行直接答题,仅未教 mandatory 强制短教;改 `FoundationStepGate` 放行 + App judge 收敛 `mandatory`(开发完成,与下行同批待并入,随 0.2.0 发)
- [ ] `P0` `[feature]` 答题卡交互收口(短教纯判分 + 全题型 4 选项 + 题型徽章 + 听一听喇叭重听)— 家长口径「别听完才答、直接选对错判分」:短教 TeachOverlay 删 demo/tap 演示步与听齐(requireVisitAll)门,对每个未教单元直接出 **4 选项纯判分题**(错答复演示、答对进阶,全过 praise 结课;保留直接答题 + 返回地图出口);Choice/ListenChoice 删 requireVisitAll/visited 听齐提示;所有题(选一选/听一听/短教/连连看)选项**恒 4**(engine `optionCountFor` 定 4、teach-questions 干扰 3);题卡左上角题型徽章(`TypeBadge` 选一选/听一听/连连看);ListenChoice 标题行恢复喇叭图标(Volume2)点重听(替虚线圆重听区);删孤立 `demo-blocks.*`(演示产物已随 demo/tap 退役)。开发完成待提交并入 main,随 0.2.0 发 — [quiz-interaction spec](superpowers/specs/2026-09-06-quiz-interaction-redesign-design.md) / [foundation spec](superpowers/specs/2026-09-05-foundation-learning-design.md)
- [ ] `P0` `[feature]` 远程 D1 迁移 — 0.2.0 发布前 apply `migrations/0002_fun.sql`(settings 新列),preview → 生产;本地已 `npm run db:local`
- [x] `P0` `[feature]` 发音首响优化(预热·防掐头·静默暖机)— 0.2.0 人工验收:发音有延时、偶发前半段无声。speech 服务:创建即预取 voice 表 + `voiceschanged` 刷新缓存(空轮询不覆盖好缓存);语音未就绪时最新一条朗读入队、就绪补播(不静默丢);空闲不 cancel 立即播、仅引擎忙才 cancel 且隔 ~30ms 再播(防 Chrome 吞句头);无匹配 voice 且引擎有 voices 时降级默认音;引擎冷启动需真实有声样本唤醒 —— voices 一就绪即自动播一条 **volume=0 极短真音节**(无声)暖机,首指针/键盘 capture 监听兜底(空句不唤醒,已弃)。测试 speech 4→9、`npm test` 264 绿 — 并入 main,随 0.2.0 发
- [ ] `P0` `[feature]` 声调锚统一 qi 四调 + 删轻声 — 拼音短教声调单元锚改同一音节 qi:ton1 七 `qī` `7️⃣` / ton2 旗 `qí` `🚩` / ton3 企 `qǐ` `🐧` / ton4 气 `qì` `🎈`;轻声 ton0 整体退役(本无出题、decompose 只顺带产键记过)→ `PINYIN_TONES` 4 项、轻声音节不再产声调单元键,帽子/月亮等 ~21 轻声音不再为幽灵单元强制补教。随 0.2.0 发

### feature 轨 — 目标 `0.3.0`(未发;新能力,兼容 → minor)

- [ ] `P0` `[feature]` 汉语领域并轨 S1 — 启用模型 3 技能开关 → 2 领域开关(汉语=拼音+汉字 捆绑 / 英语),内部 `SkillKey`/进度三键/步序/出题/结算不变;面板与冷启动按域;迁移 `0004_chinese_domain.sql` 加 `enable_chinese`(回填任一侧旧汉语技能开即域开)。随 0.2.0 发布后下一条 feature 轨发 — [spec](superpowers/specs/2026-09-08-chinese-domain-merge-design.md)

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
- [ ] `P2` mergeProgress 死导出 — [src/game/progress.ts](../src/game/progress.ts) 导出未接线;接入加载合并或删除(连同测试)

### 星语群岛 v10 方向(角色差异化叙事,会话贴入) — 观察项

> 大方向:5 角色 5 世界,拼音+汉字并轨为「汉语」(千字谷 双层恢复:声音=拼音/形状=汉字),新增 绘画·万色谷 / 数学·百数塔 / 音乐·七音森 三世界,各世界独立叙事线 + 反派弧光。与现「魔法语言岛」单岛线性结构(每词跑 拼音/汉字/英语 三技能步,进度每词一行)差异大 → 多数先入池观察;**「汉语并轨」已立项走 S1(启用模型 3 技能开关→2 领域),见 当前迭代 feature 轨**。

- [ ] `P2` 新增 绘画/数学/音乐 三世界 + 角色(悠悠/跳跳/音音)— 全新领域引擎 + 词条维度数据,现词库仅 拼音/汉字/英语 三字段
- [ ] `P2` 五角色独立世界叙事线 / 反派弧光 / 任务语法 — 叙事数据模型 + 内容生产,待世界骨架成形再做
- [ ] `P2` 英语 5 层教学结构(音素→拼读→高频词→句型→对话)— 现英语=逐词单词,改分层路径影响出题引擎与词库
- [ ] `P2` 词库分级 + 每词多维度字段(核心100全量/扩展/补充;hanziDetail radical·family、phonics、drawSteps、melody 等)— words.ts 模型扩展 + 大规模数据生产
- [ ] `P2` 星语群岛 命名壳(顶栏/地图文案改 群岛·万象树·五世界)— 现顶部「魔法语言岛·词库王国」与称号文案待方向确认再动
- [ ] `P2` 屏幕时间守卫 — 家长可配单次/每日时长,到点结算并鼓励休息;需 settings 新列 + 迁移 + 运行计时与打断 UI
- [ ] `P2` 分角色分技能学习报告 — ⚠️ 与坚决不做「家长看板」冲突;需先解禁该条
- [ ] `P2` 反派有弧光 + 跨世界同词关联文案 — 依赖多世界数据齐备;现单岛 teaser 已做口吻层

> ⚠️ 冲突注(立项前须解除):设计中 汉字任务含部件拼装/笔顺/字族(撞坚决不做「汉字书写笔顺」)、家长学习报告(撞「家长看板」)、绘画作品检测仅检测不做但新增绘画世界/绘画题型(词库无画类字段);任一立项先解禁对应「坚决不做」行并开 spec。

## 坚决不做

> 非目标,留痕防反复。设计已划界,避免待办蔓延。原 `CLAUDE.md`「真不做」+ `README`「明确不做」并集。

- 语音识别
- 汉字书写笔顺
- 绘画作品检测(对作品照片做内容识别)
- 多孩子档案
- 家长看板
- 商店 / 徽章 / 宠物 / 每日挑战
- PWA
- 多人在线 / 社交
- 用户 ID 展示
