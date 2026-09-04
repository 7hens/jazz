# 魔法语言岛 · 趣味性系统 设计文档

> **日期**:2026-09-04
> **范围**:在一期「词库学习岛」核心闭环上做**纯增量**趣味化:Toast / 撒花 / 随机夸奖 / 连击 / 连击特效(P0)+ 灵灵吉祥物 / 词间过渡文案 / 隐藏成就 / 幸运奖励(P1)。
> **原则**:不改一期核心逻辑与数据语义;每个机制独立可开关;worker 保持「只做行级读写、无业务逻辑」;星尘经济与一期一致(只升不降、无刷星)。
> **前置确认**(与负责人逐项拍板):追加星尘仅首通给星;引用绘画/复习的条目裁剪延后;完美主义=整词零错;settings 新字段并集放客户端。

## 1. 背景与动机

一期(E 词库 100 词 + 运行时出题 + 顺序解锁 + per-word 进度 + 称号)完成度很高,但**重复学习意愿/次日留存/中断率**缺少趣味机制支撑。目标:在不增加系统复杂度前提下,制造「想再玩一次」的瞬间。

对照一期实测代码修正了原始 Spec 的若干假设(详见 §2),避免把不可达/刷星/失真设计带进实现。

## 2. 原始 Spec 与仓库事实的差异(已裁定)

| # | Spec 假设 | 仓库事实 | 裁定 |
|---|---|---|---|
| 1 | `canvas-confetti` 已在一期依赖 | [package.json](../../../package.json) 无 | 新增依赖 `canvas-confetti` + `@types/canvas-confetti` |
| 2 | 词库在 `words.json`,加 `teaser` 字段 | 词库 = [words.ts](../../../src/data/words.ts) TS 数组;`WordUnit` 在 [types.ts](../../../src/types.ts) | `WordUnit` 加 `teaser?: string`,words.ts 逐词补句 |
| 3 | 改 `schema.sql` 加列 | `schema.sql` 已下线;结构变更 = 新增数字前缀迁移 | 新增 `0002_fun.sql`,**不改** 0001 基线 |
| 4 | 成就/幸运/连击星尘直接入 `stars_earned` | 无全局钱包;星尘 = 各 progress 行之和;服务端按词 `MAX` 合并(word_id 1..100);已完成词可重玩、一期重玩 0 星 | **仅首通给星**(详见 §6),避免重玩刷星 |
| 5 | `perfectSteps >= 4` | 启用技能步最多 3、每步 2 题 | **整词零错**判定(详见 §7.1) |
| 6 | 成就含 `painter_10`/`perfectReviewCount`;每日挑战含「复习/画」条目 | 绘画=二期、复习=backlog 明确不做,数据不可达 | 裁剪延后,留同类清单待对应模块落地再加回 |
| 7 | 成就列表服务端「合并取并集」 | 一期 worker 哑读写 | **客户端并集**整体 PUT,worker 保持无业务 |
| 8 | `getTodayKey()` 用 `toISOString()`(UTC) | 需按本地日切 | 学习日一律本地时 `YYYY-MM-DD` |
| 9 | WordLesson 只报「步 pass」 | 连击按题计 | WordLesson 增 `onAnswerCorrect/onAnswerWrong` 每题回调 |

## 3. 范围

### 3.1 本期(本 spec)

**P0(机制基建)**
- Toast 统一提示(`src/components/Toast.tsx`):Context + Provider,顶部居中、≤3 条排队、motion 滑入淡出、默认 3s。
- 撒花 `src/game/confetti.ts`:`celebrate(level)` 四档——step 30@50° / word 100@80° / achievement 200@120° / combo10 150@90°。
- 随机夸奖 `src/game/praise.ts`:`getRandomPraise()`(≥8 句),步过 toast 与 WordDone 文案用。
- 连击 `src/game/combo.ts`:sessionStorage 存取、`incrementCombo/resetCombo/getCombo`。
- 连击特效 `src/components/game/ComboDisplay.tsx`:阈值 1/2/3/5/8/10,弹入 1s 消失。

**P1(情感化 + 收集)**
- 灵灵吉祥物 `src/components/game/LingLing.tsx`:按完成词数分档 5 态 + CSS keyframes,主页标题下。
- 词间过渡:WordDone 底部灵灵气泡显示 `word.teaser`(引导下一词)。
- 隐藏成就 `src/game/achievements.ts`(纯逻辑,可单测):成就集 + 触发扫描。
- 幸运奖励:首通词整词完成时 10% 概率 +50。
- 成就/幸运展示:非阻塞弹层(`AchievementPopup`/`LuckyBonus`)。

**DB / Worker**
- 迁移 `0002_fun.sql`:user_settings 增 `earned_achievements TEXT NOT NULL DEFAULT '[]'`、`consecutive_days INTEGER NOT NULL DEFAULT 0`、`last_active_date TEXT NOT NULL DEFAULT ''`(本地日 `YYYY-MM-DD`)。`daily_state` 不预留(P2 每日挑战时再 0003)。
- [settings.ts](../../../worker/settings.ts) GET 回显三新列、PUT 整体 upsert(含 fun 字段);worker 只做回显与整行写入,**不解析业务**。
- [types.ts](../../../src/types.ts) `UserSettings` 增 `earnedAchievements: string[]`、`consecutiveDays: number`、`lastActiveDate: string`(序列化后行为字符串 + 数字,客户端解析)。

### 3.2 延后(不在本 spec)

- 每日挑战(P2,依赖本次 `last_active_date`/`consecutive_days` 基建,含「画/复习」条目待对应模块)。
- 画册画廊(P2,依赖二期绘画模块)。
- 主题换肤(P3)。

### 3.3 明确不做(本 spec)

- 修改一期出题引擎、步骤/解锁/称号阈值、progress 结算(30/20/MAX)。
- 把 fun 星尘改为独立钱包或改动总星尘计算(总星尘仍 = Σ progress.stars_earned)。
- 服务端成就并集、多端强一致(单机自托管可接受覆盖)。

## 4. 数据模型变更

```sql
-- 0002_fun.sql
ALTER TABLE user_settings ADD COLUMN earned_achievements TEXT NOT NULL DEFAULT '[]';
ALTER TABLE user_settings ADD COLUMN consecutive_days    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN last_active_date     TEXT NOT NULL DEFAULT '';
```

- `earned_achievements` = JSON 字符串数组(成就 id),客户端并集后整体写回。
- `consecutive_days` / `last_active_date`:仅客户端在「词完成」结算点计算并随 settings PUT 落库(见 §6.5)。
- 迁移幂等:apply 记录进 `d1_migrations`;新库 = 0001 + 0002 顺序执行。上线仅发布时执行(见 [CLAUDE.md](../../../CLAUDE.md) 迁移顺序)。

## 5. 前端架构

### 5.1 新增纯逻辑层 `src/game/fun.ts`(可单测,无 React)

- 连击会话态(sessionStorage 封装于 [combo.ts](../../../src/game/combo.ts),fun.ts 消费):`incrementCombo`/`resetCombo`,`maxCombo` 会话内追踪。
- **加成池**:eligible 词(进入时未 fullComplete)会话内逐答对累计 `Σ min(combo×5,50)`,上限即每答 50;重学词不累计(见 §6)。
- **perfect 词判定**:本词当时启用技能的全部题目首答即对、无二次作答、无整步重做 → 计 1。
- **成就扫描** `checkAchievements(state, earned) -> Achievement[]`:入参为会话态 + 持久 earned 集,返回新达成(不发重复)。

`src/game/achievements.ts`:纯数据(成就定义 + `AchievementState` 类型)。引擎可注入 rng/时钟保证测试确定性(沿用一期 engine 注入惯例)。

### 5.2 新增/改动组件

| 文件 | 改动 |
|---|---|
| `src/components/Toast.tsx` | 新:全局 Toast(Provider + `useToast`) |
| `src/game/confetti.ts` / `praise.ts` / `combo.ts` | 新:纯工具 |
| `src/components/game/ComboDisplay.tsx` | 新:阈值特效文字 |
| `src/components/game/LingLing.tsx` | 新:吉祥物(分档态) |
| `src/components/game/AchievementPopup.tsx` / `LuckyBonus.tsx` | 新:结算后非阻塞弹层 |
| `src/components/game/WordLesson.tsx` | 加 `onAnswerCorrect/onAnswerWrong` 每题回调 + ComboDisplay 挂载 |
| `src/components/game/WordDone.tsx` | 文案换随机夸奖;加成块并入(连击加成/幸运);底部灵灵 + teaser 气泡 |
| `src/components/game/WordMapView.tsx` | 主页标题下挂 LingLing |
| `src/App.tsx` | Toast Provider;fun 会话态;词结算编排(见 §6.4) |
| `src/data/words.ts` / `src/types.ts` | `teaser?: string` + 100 句文案 |
| `worker/settings.ts` | 新列回显 + upsert |
| `migrations/0002_fun.sql` | 新迁移 |

## 6. 星尘经济规则(核心)

### 6.1 不变的一期语义
总星尘 = Σ `progress.stars_earned`;技能步首过 +30、整词首通 +20,均**仅首过/首通**;服务端按词 `MAX` 单调合并;重学已完成词一期结算为 0。

### 6.2 追加星尘来源
连击加成池、幸运奖励、成就奖励。三者都不改变 30/20 档位,而是作为「词会话追加」一并写入词行。

### 6.3 eligible 判定
**eligible 词** = `startWord(id)` 时刻该词 `fullComplete == false`(依据当前 settings)。重学已完成词 = **非 eligible**。

| 场景 | 连击计数 | 加成池累计 | 幸运 | 成就扫描 | 星尘入行 |
|---|---|---|---|---|---|
| eligible 词完成 | ✓ | ✓ | ✓ 10% | ✓ | ✓(连击池+幸运+成就) |
| 非 eligible 词完成(重学) | ✓(显示) | ✗ 丢弃 | ✗ | ✓ | 仅一次性成就奖励(见下),连击池/幸运不发 |

- 连击跨词持续(sessionStorage,刷新保持、关浏览器归零),答错即 `resetCombo`,与词属性无关。
- 重学词:夸奖/特效照给(正反馈);连击池与幸运**不产生新星尘**;一次性成就若达成则即时入行。
- **成就扫描即发(R5 裁定,无挂起池)**:成就一次性(earned 持久集,不重发)→ 非刷星源,可安全即时发奖。成就扫描在每次词 done 点执行(含重学,此时可能新达成 early_bird/perfect 等无需首通的成就);**任何**词完成(含非 eligible 重学)扫到的新成就,奖励即时并入当前词行统一补 PUT(单调,worker MAX 幂等;弹层照常展示)。连击池与幸运仅 eligible 首通词计入。

### 6.4 结算编排(改动 [App.tsx](../../../src/App.tsx) `handleLessonComplete`)
一期为逐技能步即时 PUT。追加奖励统一在**词 done 前一次结算**:
1. WordLesson 逐步 `onStepPass` → 逐 PUT(一期原样,保证中途退出不丢)。
2. 步进过程中逐答对累计连击加成池(eligible 词才累计)。
3. `handleLessonComplete`(同步完成全部技能步后)→ 计算:perfect 判定 → 扫成就(新达成即发)→ 掷幸运。
4. 若追加池 > 0:对该词行做**一次补 PUT**(单调更高值,服务端 MAX 幂等),同时 `syncProgress` 更新本地。
5. 再 `setDoneInfo` + `setScreen('done')` → WordDone 拿到含追加的最终数字(避免渲染快照过期)。

> 追加 PUT 与逐步 PUT 都只调现有 `/api/progress` MAX 合并,worker 零改动。

### 6.5 学习日与连续天数
- **学习日** = 当天(本地时)完成过任意词(含重学——鼓励每天回来,非刷星)。
- 词完成结算点计算 `last_active_date`/`consecutive_days`(昨日 == 昨日日期 → +1;今日重复 → 不变;断档 → 重置 1),随 settings 整体 PUT 落库。
- **时区铁律**:一律本地时 `YYYY-MM-DD`,不用 `toISOString().slice(0,10)`(UTC 近午夜跨日错)。

## 7. 成就

### 7.1 判定口径
- **perfect 词**:本词当时启用的全部技能步题目全部**首答即对**,无二次作答、无整步重做;随引擎注入 rng。
- 会话级字段:`maxCombo`(本会话最大连击)、`firstCompleteToday`(本会话首通词数,代码字段名)。
- 持久字段(settings):`earnedAchievements`;`consecutiveDays`/`lastActiveDate` 仅「坚持者」用。

### 7.2 成就集(本期可实现,均不依赖绘画/复习)

| id | 名称 | 达成条件 | 奖励 |
|---|---|---|---|
| `perfect_word` | 完美主义 | 完成 ≥1 个 perfect 词 | 50 |
| `combo_15` | 连击王者 | 本会话 `maxCombo >= 15` | 50 |
| `marathon` | 马拉松 | 本会话首通 ≥5 词 | 100 |
| `early_bird` | 早起鸟 | 本地时 < 10 点完成词 | 20 |
| `night_owl` | 夜猫子 | 本地时 ≥ 21 点完成词 | 20 |
| `collector` | 收集者 | 任一分类 20 词全完成 | 200 |
| `dedicated` | 坚持者 | `consecutiveDays >= 7` | 300 |
| `grand_master` | 大法师 | 100 词全完成 | 1000 |

- **扫描时机**:词 done 结算点(所有成就都在该点判一次,`earned` 集含已达成则不重发)。
- **奖励发放**:扫描出的新成就奖励并入本次结算词行(含非 eligible 重学词——即时并入该词行,成就一次性、无刷星);连击池 bonusPool 与幸运仅 eligible 首通词并入;`grand_master` 等只在第 100 词首通时达成,天然落在末词行。
- **计数在扫描前累加**:本词 perfect(含重学完美)先计入 `perfectWords`,本词 eligible 首通先计入 `firstCompleteToday`,再扫(首个 perfect 词/马拉松当次即触发)。
- 展示:结算后顺序弹 `AchievementPopup`(emoji + 名 + 描述 + `+奖励`),每个 200 粒子撒花;与幸运弹层排队,不重叠于 WordDone 操作按钮。
- 展示:结算后顺序弹 `AchievementPopup`(emoji + 名 + 描述 + `+奖励`),每个 200 粒子撒花;与幸运弹层排队,不重叠于 WordDone 操作按钮。

## 8. 词间过渡文案(teaser)

- `src/data/words.ts` 100 词各补 `teaser?: string`:`WordUnit` 可选字段;词完成后 WordDone 底部灵灵气泡展示。
- **语义**:暗示**下一词**(id+1,顺序 1→100);文案风格对齐现有例句——灵灵发现当前词后的好奇引导,不点名下一词。
- **生成与校验**:实现期成段生成后人工校对;`words.test.ts` 增:teaser 存在且非空、长度上限、相邻词文案不雷同(允许程序性弱校验 + 抽检)。
- words.test 保持一期「文本不重复」校验不受 teaser 影响。

## 9. 测试清单

### 9.1 单测(新增 `src/game/fun.test.ts`;引擎沿用一期注入惯例)
1. 连击:对 +1、错归零、跨词持续、刷新保持 / 关浏览器归零(以 sessionStorage 语义单测)。
2. 加成池:eligible 词内逐答累计 `min(combo×5,50)`;非 eligible 词不累计、不落行。
3. perfect 判定:全对 = 1;任一次二次作答 = 0;重做整步 = 0;受启用技能数影响。
4. 成就扫描:新达成就发出、已达成不重发、无 painter/review 依赖;`consecutive_days` 断档重置。
5. 学习日:本地时日期跨日;断档 → 1;同日重复不变。
6. 结算编排(纯逻辑层抽函数测):首通入行 + 追加并入;重学 0 追加。

### 9.2 既有测试回归
`words.test`(teaser 完整性新增)、`progress.test`、`lesson.test`、`engine.test` 全绿;`npm run lint` + `npm run build` 过。

### 9.3 冒烟(dev :3000)
连击计数与特效阈值、首通加星无重复、重学无星、幸运 10%(可临时提概率验)、成就触发弹层 + 撒花、刷新成就/连击保持、家长重置清 fun 态、Toast 排队。

## 10. 风险与决策留痕

- **重学词无星 vs 趣味**:保留夸奖/特效/连击显示,去掉星尘与幸运 → 无刷星但正反馈不空。若后续产品要「复习给少量星」,属一期经济变更,另行决策。
- **多端同时写 settings**:客户端并集下同刻双写可能覆盖成就;自托管单机接受。若要更强,需 worker 解析 JSON 并集(违哑读写),延后按需。
- **grand_master +1000 落末词行**:词行星尘偏离均值,但总星尘口径不受影响(Σ 行)。展示按需可选「趣味」徽标,不影响一期结算展示逻辑。
- 歌词/teaser 文案为软性内容,须人校;不纳入功能验收红线(缺失/空句由 words.test 拦)。
