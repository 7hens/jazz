# 基础引导自适应教学层(foundation-learning)设计

> 日期:2026-09-05 · 状态:设计定稿,待实现 · 所属:feature 轨(新能力,兼容 → minor,0.3.0 目标)
>
> 关联:`docs/PLAN.md` 想法池 P1 行;涉及现代码见 `src/features/lesson/*`、`src/features/question-engine/*`、`src/shared/services/*`、`worker/*`、`migrations/0001_init.sql`。

## 1. 背景与问题

当前游戏 100 词、每词按家长启用的技能跑「拼音/汉字/英语」步(每步 2 题、每题 2 次机会)。词库拼音为带声调的全音节文本(如 `píng guǒ`),英语为整词。**零基础儿童**面临两道门槛:

- 完全不懂拼音:题干/选项是拼音音节,声母、韵母、声调概念全无,只能瞎点;
- 完全不懂英语:字母都不认识,整词更无从读起。

现有规则没有承载「声母/韵母/声调」「英文字母/发音」这层基础知识的教学,也没有衡量儿童基础水平的机制。

## 2. 目标与非目标

### 目标

- **现有游戏规则零改动**:词岛逐词解锁、技能步序、2 题 +30 / 整词首通 +20、称号、连击/成就/幸运/夸奖等 fun 系统,全部保持原语义。
- **无感嵌入**:基础教学以「词前小灶」形式滑进现有词课的技能步之前,不打断节奏、不加顶层学院入口。
- **内置基础评估,自适应出课**:被动推断为主,持续估计每个基础单元熟度;零进度新儿童首次做一段冷启动短测定基线。
- **高阶自动跳过**:已熟单元永不弹教学;诊断全对者整轨不再出现。
- **系统性**:单元目录全量、规范(23 声母 / 39 韵母 / 4 声调+轻声 / 26 字母),只是**交付**按词按需,不是内容缺斤短两。
- **有趣不枯燥**:短教内部走「演示 → 点读 → 轻测」三步,玩中学。

### 非目标(本迭代不做)

- 完整英语自然拼读解码(moon 的 `oo`、flower 的 `ow` 等复杂拼读规则):MVP 只教「逐字母 + 听整词」,真正读出整词交给整词 TTS。
- 语音识别跟读评分(沿用「坚决不做」)。
- 汉字笔顺/部首拆解(沿用「坚决不做」);hanzi 轨本身即认字练习,不拆。
- 独立顶层学院线 / 新解锁维度 / 新星尘来源(由「现有规则零改动」推出)。

## 3. 决策摘要

逐条问询后与需求方确认的定稿:

1. 集成路线:**A「词前小灶」独立编排层** —— 新建 `features/foundation` 域,在词课技能步进正题前询问是否需插短教;不做「基础单元当虚拟词」进群岛(撞「不改规则」红线)。
2. 评估方式:**被动推断为主 + 冷启动短测**。零进度新儿童首次跑 5-8 题梯度短测;平时由短教轻测/软提示跟测喂估计器,不扩 lesson 逐题埋点。
3. 教学出现方式:**首次强制 + 后续软提示** —— 弱单元且从未教过 → 该词该技能步前**先学后答**;教过仍在 learning → 软提示可跳;known → 不出现。
4. 本轮范围:**拼音 + 英语两轨同做**,一套机制/数据模型,实施拆两个 plan 分步(见 §13)。
5. 短教内部:**演示 → 点读 → 轻测**三步;轻测只考刚拆出的目标单元,答错复演示可重试。
6. 轻测出题:**foundation 自建微出题纯函数**,不改 `question-engine/engine.ts`(现引擎围绕 WordUnit 词池,单元级语义不同)。
7. quiz 三组件(`Choice`/`ListenChoice`/`MatchGame` + `speech.ts`)**迁 `shared/ui/quiz/`**,lesson 与 foundation 共用(现为纯展示组件,依赖均共享,迁移合规)。

## 4. 领域内容模型

### 4.1 单元目录(`features/foundation/catalogs.ts`,静态纯数据)

**拼音轨**,每个单元带儿童锚点(示例音节 + 汉字 + emoji),锚点同时作轻测选项与演示卡面:

- 声母 23:`b p m f d t n l g k h j q x zh ch sh r z c s y w`(如 `b` → `bà` 爸 👨)。
- 韵母:按《汉语拼音方案》韵母表(39 项,含单韵母、复/鼻韵母及 i/u/ü 介音组合韵母,如 `ing`、`uo`、`iang`)。具体表项不在此穷举,由 `catalogs.ts` 数据文件承载;完整性与词库拆解归口一致性由单测断言(§11)。儿童锚点如 `ing` → `jīng` 精 ✨。
- 声调:1-4 + 轻声,示例带同调音节(如调 2 → `píng` 瓶)。

> **拆解口径说明**(避免教学歧义):带介音音节(如 `guǒ`)存在「两拼 g+uo」与「三拼 g-u-ǒ」两种教法。本设计取**两拼口径** —— 拆解查完整音节表归口到「声母 + 完整韵母(含介音) + 声调」,`guǒ` → `g + uo + 调3`。儿童教学只需认出整体韵母块,不必引入介音概念,降低认知负荷;单测锁死全 100 词归口。

**英语轨**:26 字母,每字母两件:

- 字母名(name):TTS 直读字母名(en-US),稳定可靠。
- 字母音(sound):**不靠 TTS 发孤立字母音**(单音素合成不可靠),改为**示例词首音**锚点,如 `A` → /æ/ 由 `apple 🍎` 点读示范。字母卡 = 字母大写/小写 + 首音示例词 emoji。

### 4.2 100 词拆解(`features/foundation/decompose.ts`,算法派生 + 手写 override)

- **拼音**:按空格拆音节,每音节查 声母 + 韵母 + 声调(声调号→调值映射;y/w、ü 等卷边走规则表,个别例外进手写 override map)。产出形如 `píng guǒ` → `[{ text:'píng', initial:'p', final:'ing', tone:2 }, { text:'guǒ', initial:'g', final:'uo', tone:3 }]`。
- **英语**:整词 → 字母序列(纯切分,如 `apple` → `a p p l e`)。

**质量闸门**:单测对全 100 词做全量断言,任一词拆解失败/残留/产出不合法即红;异常词经 override map 手写兜底(预期极少)。拆解数据是 foundation 内私有静态数据,不经服务契约外流。

## 5. 熟度模型与估计器

### 5.1 每 user × 每单元状态

| 字段 | 说明 |
| :-- | :-- |
| `unitKey` | `'pinyin:b'` / `'pinyin:ing'` / `'english:A'` 等 |
| `state` | `learning` / `known`(`unassessed` 不落库,行缺失即未评估) |
| `correctStreak` | 连续答对次数 |
| `taughtCount` | 已教学次数(决定强制 vs 软提示) |
| `updatedAt` | 时间戳 |

状态机:**单向向上 + 答错降级**。

- 答对 → `correctStreak` +1;`streak >= 2` 或诊断全对 → `known`。
- 答错 → 回落 `learning`(若曾 `known` 也降),`correctStreak` 清零,`taughtCount` 保留(教过仍会再软提示)。

### 5.2 触发判定 `needsTeach(word, skill) → 'mandatory' | 'soft' | 'none'`

按词拆解出该轨目标单元后:

- 任一单元 `learning` 且 `taughtCount === 0` → `mandatory`(首次强制)。
- 单元 `learning` 且 `taughtCount >= 1` → `soft`(软提示)。
- 全 `known` / 词拆不出单元 → `none`。

### 5.3 估计器输入(MVP 不扩 lesson 埋点)

- 冷启动短测逐题结果;
- 短教轻测逐题结果;
- 软提示内跟测逐题结果。

词课正题对错**不**逐题回喂:现 lesson 只存步级 0/1,拿不到逐题对错,且正题干扰项可能碰巧答对,信号噪声大。MVP 估计器以上三项已够,后续如需更强信号再议是否给 lesson 加埋点。

## 6. 持久化与 worker API

### 6.1 新迁移 `migrations/0003_basics.sql`(additive,不动 0001、不改现有表)

```sql
CREATE TABLE basics_progress (
  user_id        INTEGER NOT NULL,
  unit_key       TEXT    NOT NULL,   -- 'pinyin:b' / 'pinyin:ing' / 'english:A' …
  state          TEXT    NOT NULL,   -- 'learning' | 'known'
  correct_streak INTEGER NOT NULL DEFAULT 0,
  taught_count   INTEGER NOT NULL DEFAULT 0,
  updated_at     TEXT    NOT NULL,
  PRIMARY KEY (user_id, unit_key)
);
```

幂等语义与 `progress` 一致:`ON CONFLICT (user_id, unit_key) DO UPDATE` latest-wins。单机单档案冲突少,不做字段级 MAX 合并;`state`/`streak` 语义由前端估计器先算好再整行 upsert。回滚:旧代码无视新表,安全。

### 6.2 worker 新 handler `worker/basics.ts`

- `GET /api/basics-progress` → 该 user 全部行(无行返空数组)。
- `PUT /api/basics-progress`,body `{ rows: [{ unitKey, state, correctStreak, taughtCount }] }` 批量行级 upsert;空/超量(单批 > 200)400。
- 注册进 `worker/index.ts` 路由表;每 handler 先 `getAuthenticatedUser(request, env)` 401;按 `user_id` 绑定隔离。worker 只做行级读写,不解析教学业务(与 progress 同款纪律)。

## 7. 编排流

### 7.1 冷启动短测

- **触发**:该 user 无任何 `progress` 行(新档案)且无 `basics_progress` 行 → 登录后、进群岛前,弹「魔法入门小测」向导。
- **内容**:5-8 题梯度,复用现有题型视觉。先字母/声母锚点认识题(「👨 是哪个声母?b/p/m」),递进到拼音音节、整英文词。pinyin + english 两轨各抽一段。
- **基线写入**:全对 → 该轨整轨标 `known`(高阶自动全跳);部分对 → 只把答对的单元标 `known`,其余留 `learning`;乱答 → 整轨 `learning`(零基础从第一词开始强制短教)。
- **家长关技能轨** → 诊断不抽该轨段。
- **中途退出** → 不写任何行,下次零进度再触发。诊断本身 0 星,不碰星尘;老用户有进度行不触发,靠后续被动推断。

### 7.2 词课插入(核心嵌入点)

现有 `WordLesson` 每技能步进正题**前**停一帧,`LessonEntry` 问 foundation:

- `none` → 直接进原 2 题(老用户/高阶儿童全程零感知);
- `mandatory` → 弹短教 overlay(§8),过完回**原步原题**,题/步/星序不变;
- `soft` → 步前小浮条「这拼音里有没学过的声母 p,想先学一下?」→ 进可短教,跳可答题。

**计分隔离**:短教内轻测 0 星(纯辅导);正题 +30 原样。短教结束只给声效 + 夸奖,**不触发**连击/成就/幸运/撒花,避免污染现有 fun 系统。

### 7.3 边界

- 家长中途关 `enable_pinyin` → pinyin 轨不再插入/不再诊断该段;重开已教单元状态保留。
- 老用户/已有进度者不豁免:`needsTeach` 仍按被动推断,learning 单元首次碰上也会强制教一次(补基础)。
- 词拆解缺失 → `needsTeach` 返 `none`,该词永不卡。
- 短教强制步中途退出地图 → 不写熟度、不罚星、`taughtCount` 不变 → 下次仍强制。软提示自由跳。

## 8. 短教三步交互(`features/foundation/TeachOverlay`)

以当前词为语境,「词前小灶」overlay:

1. **演示拆合**:自动演一遍该词该技能拆解。拼音 `píng` → 两块砖「p」「íng(声调 2 帽子)」合体拼回 `píng` + emoji 大图;英语 `apple` → 字母块 `a·p·p·l·e` 逐颗亮起拼成 `apple`。可回放。动画用 `motion`(foundation 自绘)。
2. **点读跟读**:每块可点。拼音块点读其**汉字锚点**(沿用「朗读真相 = 汉字」约定,zh-CN 稳);英语字母块点读字母名,外加整词 en-US。发音走现 `SpeechService`,音效走 `AudioService`。儿童开口跟,TTS 不识别只鼓励。
3. **轻跟测**:2 题,只考刚拆出的目标单元(如声母 `p` 认 `bà`),全过放行进正题;答错当场给正确反馈 + 复演示该块,不罚、可重试。逐题结果喂估计器(§5.3)。

**轻测出题**:foundation 自建微出题纯函数(`teach-questions.ts`),不改 `engine.ts`。把单元映射成 `BaseOption { text, speak, emoji }`:选项文本 = 单元符号,`emoji` = 锚点图(如声母题「爸爸 👨 是哪个声母?」选项 `b/p/m` 各带自家 emoji 例)。干扰单元:同发音部位/形近声母、近音字母/形近字母优先,不足跨类,排除文本重复。题/选项 id 仿现引擎 seed 纪律本地唯一。渲染复用迁到 shared 的 quiz 三组件。

## 9. quiz 组件迁移 `shared/ui/quiz/`

现 `features/lesson/quiz/` 的 `Choice.tsx` / `ListenChoice.tsx` / `MatchGame.tsx` + `speech.ts`(`speakCard`/`langFor`)为**纯展示组件**:依赖仅 `motion`、`lucide-react`、`@/shared/ui/utils`、`@/shared/services`(类型)与本地 `speech.ts`,无 lesson 内部状态耦合。

- 迁移目标:`src/shared/ui/quiz/`,lesson 从共享处 import(内容不动,仍收 `skill: SkillKey`)。
- foundation 以 `skill='pinyin' | 'english'` 复用渲染轻测卡。
- 原 lesson quiz 测试随迁;`architecture.test.ts` 同步认知 shared 新增中性 quiz 组件(不变更 3 层边界与注册纪律,features 本可共引 shared)。
- `speech.ts` 是中性朗读工具,随迁无属主冲突。

> 若不迁移,foundation 跨 feature 引 lesson 组件违规(禁编译期互引)。迁移是方案 (i),需求方已确认。

## 10. 错误处理与降级

- worker 存熟度失败 → 静默(`ignoredFailure` 同款),下一词重估,儿童无感。
- 目录/拆解数据损坏 → `needsTeach` 返 `none`,词课照旧,短教永不阻塞正题。
- 强制步退出不罚星、`taughtCount` 不变。
- 整层可用开关关闭:foundation 挂掉只 disable 辅导,游戏回到今日原样 —— 独立编排层的核心回滚价值。

## 11. 测试策略

- foundation 纯逻辑单测:目录完整性(声母 23 / 韵母表项无重复且与 100 词拆解归口一致 / 字母 26,无重复文本)、**100 词拆解全量断言**(逐词拆分合法声母韵母声调 / 字母序列,失败即红)、估计器状态机(升 known / 答错降级清零 / taughtCount 语义)、`needsTeach` 判定矩阵(未教→强制 / 已教→软 / known→无 / 拆解缺→无)。
- 轻测出题函数:target 必在、干扰不含重复、id 唯一。
- quiz 迁 shared 后原测试随迁 + shared 中性约束检查。
- worker `basics.ts` handlers 测(401 / 越界 / 批量 upsert);`0003` 本地 `npm run db:local` 验。
- `npm test` 收口;`architecture.test.ts` 保持绿(foundation 属 features 层、quiz 入 shared、lesson 改从 shared 引)。

## 12. 向后兼容与回滚

- 现有表/路由/前端语义零改动;新表 additive,旧 worker/前端忽略。
- 新 worker 路由仅在带新代码时存在;`wrangler rollback` 可整体回前端 + worker,新表残留无害(字段带 DEFAULT)。
- foundation 层可独立 disable。

## 13. 范围切分建议(实施时)

本 spec 为同一设计,体量 L(≥3d),执行拆两个 plan(同轨可多 plan):

1. **plan A —— 数据与骨架**:catalogs 初稿 + decompose + override + 估计器 + `0003` + worker handlers + `basics-progress` 服务 + 冷启动诊断入口 + `needsTeach` 插入词课(先只做 hardcode 短教占位)。跑通架构与边界测试。
2. **plan B —— 内容与体验**:100 词拆解全量校验收尾、TeachOverlay 三步 UI、teach-questions 微引擎、软提示浮条、quiz 组件迁 shared/ui/quiz、诊断 5-8 题内容、全量单测。

> 若 writing-plans 阶段判定需拆独立 spec,按上两 plan 各立 spec 亦可;设计决策集不变。

## 14. 风险与开放项

- **拼音自动拆解的卷边**(y/w 改韵母、ü 规则、`er`/`n` 特殊):以全量 100 词断言 + override 兜底,风险可控;若个别词拆解成本过高,教学可退化为整音节展示(仍是教学,不阻塞)。
- **TTS 发孤立音不准**:已用「示例词首音」锚点规避;点读跟读效果待真机听感验收。
- **冷启动诊断时长/儿童耐心**:控制在 5-8 题,中途可退,0 星。
- **「首次强制」对老用户的打扰**:已有进度者 learning 单元首次碰上会教一次,属有意补基础;若实测烦躁,可加「该 user 曾完成词数 > 阈值即降级为软提示」的调节,延后到实测评估。
