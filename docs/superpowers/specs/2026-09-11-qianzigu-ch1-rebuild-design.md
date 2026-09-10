# 千字谷 ch1 重构设计(高潮 + 笑点 + 句型步 + 干扰项场景化)

> 日期:2026-09-11 · 状态:**待评审** · 轨:`0.3.0 feature`(PLAN `P0` 行)
> 流程:走 `game-pipeline` **阶段 0 重锚 → 阶段 1 叙事 → 阶段 1b 结构 → 阶段 2 交互**;本 spec 覆盖阶段 0–2 的产出,视觉/听觉域不动。
> 上游依赖:`docs/design/game-story-bible.md`(§4 章节契约)、`docs/design/game-direction.md`(逐幕演出表)。

## 0 一页定位(阶段 0 产出)

| 项 | 内容 |
| --- | --- |
| 变更类型 | ① **改玩法类型**(每词加第 3 步「句」)② **叙事重写**(重排情绪曲线:高潮/笑点)③ **出题引擎改**(干扰项来源) |
| 触发 | 2026-09-11 产品口径:「重构第一章,要有高潮和笑点」「候选词要跟场景相关或是复习词」「每个词可以有多个句子,由简单到困难」 |
| 平台/风格锚 | 不变(全屏漫画式 / 儿童向 / 零位图 emoji / 运行时 TTS) |
| 范围 | 千字谷 **ch1 五词**(13/7/14/8/19)纵向打通三步;全量 100 词留想法池 `P1` |
| 关键事实 | `git tag` 仅 `v0.1.0`;**ch1(0.3.0)从未上线,无真实玩家存档** → 不承担存档兼容义务,`DEFAULT 0` 即可 |

### 重锚影响矩阵(已识别,实施时逐项落)

| 变更 | 必重跑 | 本项目落点 |
| --- | --- | --- |
| 加句型步 | 阶段 0 → 2 → 5 → 6 | `chapter.ts` 类型 · `ch1.ts` 数据 · `question-engine` · 幕数契约(bible §4) |
| 叙事重写 | 阶段 1 → 分镜 → 伏笔台账 | `ch1.ts` 台词 · `game-direction.md` · `game-story-bible.md` §4/§6 |
| 干扰项来源 | 阶段 2 → 5 → 6 | `question-engine.ts`(**全库共用**,字母林主线一并变) |

## 1 已定口径(决策记录)

| # | 决策 | 取舍理由 |
| --- | --- | --- |
| 1 | 范围 = 剧情重写 **+ 句型步(五词)** | 保留五词与骨架,增量可控 |
| 2 | 句型 **3 句/词,同幕三题** | 阶梯完整;幕数 18 → 23 |
| 3 | 干扰项取 **本章词 + 已学复习词** | 引擎自动算,数据零维护 |
| 4 | 进度存 **A2**:`WordLayer` 加 `'sentence'` + `WordProgress.sentenceLevel: 0..3` | **不扩 `SkillKey`** → 家长面板仍是 2 域开关(守住约束);天然支持由易到难 |
| 5 | 题型 **B2 选对句** | 真考「词怎么用」,最贴「帮孩子说话」;错句荒谬 = 天然笑点 |
| 6 | 高潮 **C1 重排情绪曲线** | 结构位/断点不动,只重排内容张力 |
| 7 | 句步 **+30 星尘/词**(与拼音/汉字同权) | 它是汉语域内固定步,不是可选加练 |
| 8 | 整词 **+20 含句步** | 汉语域三步全过才算整词完成 |
| 9 | 称号阈值**本轮不动** | 5 词 +150 星,不构成档位漂移;全量句步行(100 词)落地时重算 |

## 2 非目标

- 全量 100 词句库(想法池 `P1`「汉语句型步全量」)
- 整句乱序拼装(数据 ×3,留二期)
- 字母林侧句步(本轮只打千字谷)
- 称号阈值重算(见 §1 #9)
- **`chapter-progress.ts` 硬编码 `CHAPTER_1.wordIds` 的修复** —— 独立 PLAN `P1` 行,与本 spec 无耦合(`belongsToChapter` 只查 `wordId`),留在想法池
- 视觉/听觉域改动(素材、音效、气泡造型——本 spec 不触及)

## 3 数据模型(A2)

### 3.1 类型

```ts
// src/features/qianzigu/chapter.ts
export type WordLayer = 'sound' | 'shape' | 'sentence'

// src/shared/services/progress.ts
export type WordProgress = {
  wordId: number
  completed: Record<SkillKey, boolean>   // 不变,仍 3 技能
  sentenceLevel: number                  // 新增:0..3 = 已通过的句档数
  starsEarned: number
  updatedAt: string
}
```

`SkillKey` / `UserSettings` / `DOMAIN_SKILLS` **一律不动**。

### 3.2 迁移 `0006_sentence_step.sql`

```sql
-- 汉语句型步:每词多句、由易到难;加列记录已通过档数(0..3)。
-- additive,不改 0001 基线;ch1(0.3.0)从未上线,无存量存档需回填。
ALTER TABLE progress ADD COLUMN sentence_level INTEGER NOT NULL DEFAULT 0;
```

顺序遵循铁律:**先升库后升代码**(本地 `db:local` → preview → prod)。

### 3.3 worker(`worker/progress.ts`)

- SELECT 加 `sentence_level`;行 → API 对象时 `sentenceLevel: r.sentence_level`
- 入参校验:`Number.isFinite` 且 `>= 0` 的整数,上限 `<= 3`,否则取 0
- UPSERT:`sentence_level = MAX(progress.sentence_level, excluded.sentence_level)`(与星尘同「只升不降」幂等纪律)

### 3.4 前端进度服务

- `emptyWordProgress` 加 `sentenceLevel: 0`
- `mergeProgress` / `isValidWordProgress`(lesson/progress.ts):新字段 **取 max**、非法值降级 0
- `ApiWordProgress` 自动携带(它是 `Omit<WordProgress,'updatedAt'>`)

### 3.5 千字谷侧

- `layerToSkill('sentence') → 'hanzi'`:句子按**汉字文本通道**渲染与朗读(句步没有独立技能键)
- `parseRestoreState` / `serializeRestoreState`:`layer` 合法值集合加 `'sentence'`
- `chapter-progress.ts` 的 `belongsToChapter` 只查 `wordId`、不查 `layer` → **本 spec 无需改动**;硬编码 `CHAPTER_1.wordIds` 的问题(PLAN `P1` 独立行)**不在本轮范围**(见 §2)

## 4 句型题(B2:选对句)

### 4.1 数据(`src/features/vocabulary/sentences.ts`)

新建独立文件,**不塞 `words.ts`**(词库是纯词表,句子是教学文本)。

```ts
export type SentenceTier = 1 | 2 | 3
export type SentenceItem = Readonly<{
  correct: string
  wrong: readonly [string, string, string]
}>
export type SentenceSet = Readonly<{
  wordId: number
  tiers: readonly [SentenceItem, SentenceItem, SentenceItem]   // 档 1..3
}>

export const SENTENCES: readonly SentenceSet[]
export function sentenceSetFor(wordId: number): SentenceSet | undefined
```

ch1 切片数据量:5 词 × 3 档 × 4 句 = **60 句手写**。

### 4.2 三档难度规则(**写作规则,由测试守卫**)

| 档 | 正确句长度 | 错句造法 | 例(钥匙) |
| --- | --- | --- | --- |
| 1 易 | ≤ 6 字 | **动词完全不搭**(一眼荒谬) | ✅ 我用钥匙开门。 ❌ 我用钥匙吃饭。/ 我用钥匙穿鞋。/ 我用钥匙扫地。 |
| 2 中 | ≤ 10 字 | 目标词位置**换成别的库内名词** | ✅ 爷爷掏出钥匙开门。 ❌ 爷爷掏出帽子开门。/ …杯子… / …鞋子… |
| 3 难 | ≤ 14 字 | **成分错位 / 语序颠倒**(目标词与句中其他成分对调) | ✅ 钥匙在爷爷的口袋里,一摸就摸到了。 ❌ 爷爷在钥匙的口袋里,一摸就摸到了。 |

> **2026-09-11 修订**:原「档 2 = 同类词替换 / 档 3 = 搭配接近但语义不通」在 ch1 五词上**不能一致落地** —— 场所 / 事物类词(房子 / 窗户 / 台灯)找不到「同类但用错」的名词(换「城堡」句子仍成立,换「帽子」退回档 1);档 3 的搭配精细度也**超出 5 岁儿童的判读能力**,实际会退化成档 1,三档塌成两档。现轴:难度来自 **①荒谬度 → ②名词替换 → ③句长 + 语序**,三档各自可判、可统一、可测试。

**干扰词约束(2026-09-11 产品口径)**:错句中**替换目标词位置的那个名词**(如档 2 的「筷子」)必须**取自词库 `WORDS`**;句子其余成分(动词、修饰语、虚词)不受此限。词库不足时**允许扩充**,机制见 §4.6。

**硬线**:任一句去标点后 ≤ **20 汉字**(项目既有加严线,`ch1-script.test.ts` 同规则);**错句必须明显错**,不得造成「学错」风险。
**禁**:谐音梗、双关(孩子词汇量接不住 —— 与 PLAN「章节叙事闸门」同行判据)。

### 4.3 引擎(`question-engine`)

新增方法,复用现有 `ChoiceQuestion` 形状(**零 UI 改动**):

```ts
makeSentenceQuestions(word: WordUnit, set: SentenceSet, rng?: Rng): ChoiceQuestion[]
```

- 每题:`prompt = '哪句话说对了?'`,`options` = shuffle(1 正确 + 3 错句) → `BaseOption { text: 句子, speak: 句子 }`
- `answerId` = 正确句的 option id;option id seed = `{wordId}-{tier}-s-sentence`(与既有 `c/l/m` 标记并列)
- 返回**恒 3 题**,顺序即档 1 → 档 2 → 档 3

渲染路径:`TaskScene` → `QuestionCard` → `Choice`(`promptEmoji = word.emoji`,即题干大字 = 目标词图)。

### 4.4 判分

- `TaskSpec.minCorrect` 句步 = **3**(三档全过)
- 每题仍沿用既有 **2 次作答**:第 1 次错标记错项,第 2 次错揭示答案
- 三档**按序推进**(档 1 过才到档 2),与「由易到难」一致
- ⚠ **重出错题必须原地**:现有 `TaskScene.handleRetry` 会重置整套题并回到第 1 题 —— 在句步上意味着**档 3 答错两次就被打回档 1**,对儿童过于严苛。句步(`layer === 'sentence'`)改为**只重出当前档、保留 `qIndex`**;`sound` / `shape` 层维持现状不动。

### 4.5 无障碍

- 句子选项**一律可点读**(TTS 读整句)→ 满足「指令、题干、选项可朗读」硬线;不识字的孩子靠听完成
- **不要求孩子开口**、不判音准(守住「坚决不做:语音识别」红线)

### 4.6 词库扩充:新增 `proxy` 分类(**就位待启用;本轮词条集为空**)

> **现状(2026-09-11 复核)**:档 2 放宽为「换成别的库内名词」后,ch1 五词的替换名词**全部能在现有 103 词内找到**(钥匙→帽子 / 杯子 / 鞋子,房子→雨伞 / 台灯…),**本轮不需要扩任何词**。
> 因此 `proxy` 分类**本轮不建** —— `words.test.ts` 有「每类 ≥ 8 词」断言,一个 0 词的分类反而要给它加特例,是负收益(YAGNI)。
> **首次写作中发现库内无合适替换名词时**,按本节机制扩库(机制已设计完毕,可直接启用)。

为满足「干扰词限定在词库内」,允许往 `WORDS` 补词;补进来的词**只做句子干扰项,不成为可学课程词**。

- 新增 `CategoryKey: 'proxy'` + `CATEGORY_LABELS.proxy = '干扰用词'`
- proxy 词**追加在 `words.ts` 末尾**(id 顺延,保持「id = 下标 + 1」不变式)
- 进 `WORDS` → 可被朗读、可被 `wordById` 查到、可被 `distractorsFor` 取用
- **排除点只需改一处**:`createVocabularyService().getAllWords()`(`vocabulary.ts:6`,现为 `category !== 'story'` → 改为同时排 `proxy`)。该函数是**唯一收口** —— 主题网格 / 学习路径 `firstTargetId` / 出题引擎 `distractorsFor` / 短教 / `useCompletedWords` 全部经它取词

| 消费点 | 取值路径 | 是否随 `getAllWords()` 自动排除 |
| --- | --- | --- |
| 主题网格 + 学习路径 | `HomeEntry` → `getAllWords()` | ✅ |
| 出题引擎干扰项 | `distractorsFor` → `getAllWords()` | ✅ |
| 短教单元 | `foundation/service.ts` → `getAllWords()` | ✅ |
| 完成词统计 | `useCompletedWords.ts` → `getAllWords()` | ✅ |
| `words.test.ts` 的 CATS(`每类 ≥ 8`) | 直接读 `WORDS` | ❌ **需单独排** |
| `words.test.ts` teaser 断言 | 直接读 `WORDS` | ❌ **需单独排** |
| worker `MAX_WORD_ID` | 硬编码 `103` | ❌ **随 id 上限更新**(否则 proxy 词进度写不进去) |

**测试守卫(唯一强保证)**:
- `sentences.ts` 内所有替换名词必须能在 `WORDS` 中查到(逐句断言)→ 这条是「干扰词限定词库内」的**机器判据**,不靠人工自觉
- `words.test.ts` 硬计数改为「**非 proxy 词恰 103**」;proxy 数量另有专属断言
- `wordById` 越界断言随 id 上限更新

> proxy 词自成 category → 不会随机混入普通词课的干扰项(跨类兜底才可能命中),符合预期。

## 5 干扰项场景池

### 5.1 契约

```ts
// src/shared/services/question-engine.ts
export type QuestionContext = Readonly<{
  sceneWordIds?: readonly number[]     // 本章场景词(ch1 = chapter.wordIds)
  learnedWordIds?: readonly number[]   // 已学复习词(progress 中已完成的词)
}>
```

`makeStepQuestions` / `makeChoice` / `makeListen` / `makeMatch` / `distractorsFor` 加**可选末位** `context?: QuestionContext`(可选 → 编译期不破既有调用点)。

### 5.2 优先级

`distractorsFor` 池序改为:

```text
① 场景词(sceneWordIds,排除目标词与文本撞车)
② 已学复习词(learnedWordIds)
③ 同 category(现有行为)
④ 跨类补齐(现有行为)
```

各段内部**独立 shuffle**,再按序拼接取前 `count` 个;段内不足自动落下一段。排除规则(`clash`:汉字/拼音/英文任一相同)不变。

### 5.3 接线

| 调用点 | sceneWordIds | learnedWordIds |
| --- | --- | --- |
| `ChapterRunnerView`(ch1 task + boss) | `chapter.wordIds` | `localProgressRef` 中已完成的词 |
| `LessonEntry`(字母林) | —(不传) | 已学复习词 |

> **字母林侧本轮同时受益**:只注入 `learnedWordIds`(复习词优先),`sceneWordIds` 留空 → 行为 = 复习词 → 同 category → 跨类。

## 6 叙事重写(C1:重排情绪曲线)

**结构位不动**:`social` / `boss` / `ending` / `settle` 位次不变;断点仍**恰 3 个**。

### 6.1 情绪曲线

| 段 | 幕 | 情绪 | 事件 / 钩子 |
| --- | --- | --- | --- |
| 起 | `open` | 轻快 + 悬念 | 苏灵灵自我介绍;**笑点 1** = 徐万年站路中卡壳「我要去……那个叫啥来着」 |
| 承 1 | 词 1 三幕 + `br1` | 轻快 | 想起「房子」 |
| 承 2 | 词 2 三幕 + `br2` | 轻快 + **笑点 2** | 想起「门」;**推门拉反** |
| 转 | `social` + `br3` | 暖 + **笑点 3** | 皮小闹冒失撞人(夸张);玩家做有代价的选择 |
| **落** | 词 3 三幕 | **挫败低谷** | 门锁着;钥匙就在口袋,叫不出名字就摸不着 —— **刚想起的东西又滑走** |
| 落 | 词 4 三幕 | 缓慢回升 | 窗户,风进来,屋里亮堂 |
| 落 | 词 5 三幕 | 暖 + 夜 | 台灯亮,屋子暖起来 |
| **合** | `boss` | **高潮峰值** | 五个名字搅成一团 → 一个个叫回 |
| 收 | `ending` + `settle` | 暖 + 轻线 | 灯亮着;徐爷爷忘了「天天都记得的事」,不解释 |

### 6.2 高潮位(章节契约新增栏)

**`boss` win**。要求两条同时成立:

1. **情绪峰值**:BOSS 前是全局最低点(名字全搅乱),win 是反转。
2. **不可逆的场面改变**:win 台词升级 —— 徐万年在叫回五个名字之后,**叫出了苏灵灵的名字**(他此前只记得自己的事)。这是他第 1 幕做不到的事(弧光落点)。

现 `win` 台词「都想起来了!房子、门、钥匙、窗户、台灯!」**需重写**以承载该弧光。

### 6.3 笑点位(章节契约新增栏)

登记 **3 处**,判据 = **禁谐音梗与双关**,机制限「误会 / 重复 / 落差」:

| # | 幕 | 机制 |
| --- | --- | --- |
| 1 | `open` | 重复:徐万年卡壳说半句又卡住 |
| 2 | `t2-shape` `onDone` | 落差:先认出「门」,再被点破刚才一直在往外拉 |
| 3 | `social` | 夸张:皮小闹「让让让让让让——」一头撞上 |

**加分项(不占名额)**:句型错句天生荒谬(「我用钥匙吃饭」)→ 每题自带微型笑点。

## 7 幕数契约(18 → 23)

```text
open
 → t1-sound → t1-shape → t1-sentence → br1
 → t2-sound → t2-shape → t2-sentence → br2
 → social-pixiaonao → br3
 → t3-sound → t3-shape → t3-sentence
 → t4-sound → t4-shape → t4-sentence
 → t5-sound → t5-shape → t5-sentence
 → boss → ending → settle
```

- 23 幕 = 1 `open` + 15 `task`(5 词 × 3 层)+ 3 `break` + 1 `social` + 1 `boss` + 1 `ending` + 1 `settle`
- **断点仍 3 个**:`br1`(词 1 后)/ `br2`(词 2 后)/ `br3`(social 后)—— 句型幕插在**词内部**,不动断点
- `restoreOrder` 扩为 15 项(每词三层)
- `game-story-bible.md` §4 与 `game-direction.md` §1 逐幕表**同步重写**

## 8 星尘与结算

- 句步**首过 +30**(每词仅一次),判定 = `sentenceLevel` 由 `< 3` 变为 `= 3`
- 整词 **+20** 判定:千字谷侧改为 `rules.fullComplete(next, settings) && next.sentenceLevel >= 3`
- 每词满额:80 → **110**;ch1 五词满额 400 → 550
- **已知后果(接受)**:字母林路径不产 `sentenceLevel`,`+20` 判定与千字谷在汉语词上**分叉**。一致性收敛留待全量句步行评估(记入想法池 P1 行)。

## 9 测试域影响

| 测试 | 变更 |
| --- | --- |
| `qianzigu/ch1.test.ts` | 每词覆盖 `sound`/`shape`/**`sentence`** 三层;幕数 = 23 断言 |
| `qianzigu/ch1-script.test.ts` | 句长守卫**扩展到 `sentences.ts`**(≤20 硬线);按档加严(6/10/14) |
| `question-engine/engine.test.ts` | 场景池优先级(场景词 → 复习词 → 同 category);`makeSentenceQuestions` 恒 3 题 / 答案正确 / 选项无重复 |
| `qianzigu/chapter-progress.test.ts` | `parseRestoreState` 接受 `'sentence'`;按 `chapterId` 解析词表 |
| `qianzigu/engine.test.ts` | `taskHits` 三键独立(`13:sound` / `13:shape` / `13:sentence`) |
| `lesson/progress.test.ts` | `sentenceLevel` 校验与合并(取 max、非法降级 0) |
| `vocabulary/sentences.test.ts`(新) | 每词 3 档 × 每档 4 句;无重复文本;**句长上限 6 / 10 / 14**;档 2 替换名词**必须能在 `WORDS` 查到** —— 这是「干扰词限定词库内」的**机器判据** |
| `vocabulary/words.test.ts` | **本轮不动**(零扩库) |
| `architecture.test.ts` | 须保持绿(新增文件不得越过 3 层边界) |

## 10 文档同步清单

- `docs/design/game-story-bible.md` §4 章节契约:23 幕 + **高潮位 / 笑点位**两栏(消费 PLAN `P1`「章节叙事闸门」行)
- `docs/design/game-direction.md`:§1 逐幕分镜表 18 → 23 幕;§2 交互流;§4 现状表
- `docs/dev-reference.md`:模块清单加 `vocabulary/sentences.ts`
- `docs/PLAN.md`:本行状态推进;句型步全量行补「称号阈值重算」前置

## 11 风险与未决

| 风险 | 缓解 |
| --- | --- |
| **错句教错**:孩子记住荒谬句 | 错句须**明显错**且荒谬度可见;答后揭示正确句;写作规则由测试守卫 |
| 4 句全读 = 单题听觉负荷大(4×14 字) | 首屏**不自动全读**;选项可点读,题干喇叭重听整组 |
| 60 句手写质量参差 | 逐档写作规则 + 测试守卫 + 人工过一遍 |
| 干扰项场景池抽空(词库不足) | 段内不足自动落下一段,末段仍有 `pool.length < count` 抛错兜底 |
| `QuestionContext` 改签名波及 lesson | 可选末位参数,编译期不破既有调用 |

## 12 验收闸门(阶段 6 / 阶段 7)

- `npm test` 全绿(含新增句型与场景池用例)
- `npm run lint` 干净
- 浏览器人工走查 23 幕:三步连排 / 断点 3 个 / 句型三档可过 / 干扰项确为本章词 / BOSS win 新台词 / 刷新续玩
- 章节契约两栏(高潮位 / 笑点位)填出且过判据
- 发布:`0006` 迁移**先升库后升代码**(本地 → preview → prod);冒烟通过**之后**才打 tag
