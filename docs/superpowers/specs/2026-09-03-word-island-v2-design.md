# 魔法语言岛 v2 · 词库学习岛 设计文档

> **日期**:2026-09-03
> **范围**:基于《魔法语言岛 · 设计文档(修订版 v1.1)》重构现有关卡制 MVP,采用「词库学习单元」范式。本 spec 覆盖 **一期(玩法内核)**,绘画/离线/复习/填空题型列入二期 backlog。
> **前置决策**:登录门 + 单档案保留(不引入匿名设备 UUID);进度存储从「单 JSON 整档」改为「DB 行级」;学习范式从「10 关线性关卡」替换为「100 词词库 + 顺序解锁」。

## 1. 背景与动机

现有代码(commit `262b561`)是「新手村 10 关」关卡制 MVP:`GameState`(stars/exp/unlocked/levels/kingdom)整份 JSON 存 D1 `game_state` 单行,静态题库 [levels.ts](../../../src/data/levels.ts) 每关 5-9 题手写,线性解锁。

v1.1 设计文档提出完全不同的产品范式:**一词一画,三语共学**——每个学习单元围绕一个实词,「画一画 → 拼音 → 汉字 → 英语」步进,词库 100 词,题型运行时生成,分类地图,复习挑战。两份文档同名但内核不同,属**范式级替换**,非增量兼容。

已与项目负责人逐项确认:
- **认证保留**:ADMIN_TOKEN 登录门 + cookie + 单档案(`users` 单行)不变。
- **存储改行级**:v1.1 每词每技能独立行;且一期后绘画 `drawing_data`(~10KB/词)若塞进现有 64KB 单 JSON 必然爆表 → 改 `progress` 每词一行 + `user_settings`。
- **玩法换词库**:关卡通吃词库,删关卡概念。
- **两期拆分**:一期只做玩法内核,绘画/离线/复习/填空二期。

## 2. 范围

### 2.1 一期(本 spec)
- 100 词词库 `words.ts`(数据 + 校验,沿用 v1.1 §12,修正明显笔误)。
- 学习单元:**一词 × 至多 3 技能步**(拼音/汉字/英语,步序可被设置裁剪),每步 2 题,题型运行时从引擎生成(choice / listen-choice / match;填空下期)。
- 顺序解锁:**完成第 N 词(启用技能全完成)→ 解锁 N+1**;可重学任意已解锁词(复习不发重复星尘)。
- 出题引擎(纯逻辑):同 category 干扰项优先,不足跨类兜底。
- 结算与奖励:技能步完成 +30 星尘(仅首过);词全技能完成 +20 加成(仅首过);称号按总星尘阈值(§11.2)。删除 exp / Lv / 关卡星级。
- 地图即主页:分类词库网格 + 顶部星尘/称号/家长菜单。
- 设置(家长菜单内弹层):拼音/汉字/英语模块开关(至少一项为真),落 `user_settings`。
- DB:新增 `progress` + `user_settings` 两表;迁移脚本 DROP 旧 `game_state`。
- worker:行级 `GET/PUT /api/progress`、`GET/PUT /api/settings`;`/api/me` 认证不变。

### 2.2 二期(backlog,不在本 spec)
- 绘画模块(拍照 → 缩略 → 亮度抠图 → 自动裁剪 → 确认),`progress.drawing_*` 列后续迁移加入。
- 离线优先(IndexedDB + Service Worker + syncQueue + 字段级合并)。
- 复习挑战(每 5 新词,弱技能优先出题)。
- 填空题型(fillBlank:汉字补缺字 / 英语补字母)。
- 词库数据人工校对与分类语义重整(见 §6 风险)。

### 2.3 明确不做(本 spec)
用户 ID 展示/多档案、语音识别、画作检测、社交、动画花活。

## 3. 与现状差异一览

| 维度 | 现状 | 一期目标 |
|---|---|---|
| 学习单位 | 10 关关卡,静态题 | 100 词词库,一词一单元 |
| 题型数据 | levels.ts 手写每题 | words.ts + 运行时 questionEngine 生成 |
| 解锁 | 关卡星级过关解锁 | 词全技能完成解锁下一词 |
| 进度存储 | `game_state` 单行整 JSON | `progress` 每词一行 + `user_settings` |
| 状态字段 | stars/exp/unlocked/levels/kingdom | 总星尘(Σ words.stars_earned)+ 每词技能完成 |
| 等级 | exp→Lv(300/级) | 星尘阈值 → 称号(§11.2) |
| 答题壳 | LevelPlay(2 次机会/反馈/亮答案) | 复用同一壳,单元 = 步序列 |
| 页面 | boot→login→map→play→result | boot→login→map(主页)→lesson→(word 完成卡) |
| 设置 | 家长菜单:重置/登出/声音 | 上述 + 三技能模块开关(弹层) |

## 4. 架构总览

```
src/
├── data/words.ts          # 新增:100 词词库 + WORDS 导出 + CATEGORY 分区常量
├── types.ts               # 改:WordUnit/WordProgress/UserSettings/Word/Question;删 Level/GameState 关卡版
├── game/
│   ├── engine.ts          # 新增(纯):技能题生成(choice/listen/match)、干扰项抽取与跨类兜底
│   ├── lesson.ts          # 新增(纯):settings→步序、单步 2 题编排、词完成判定、解锁推进
│   ├── state.ts           # 改:progress 前端态默认/校验/字段级合并、称号阈值;删关卡 utils
│   ├── scoring.ts         # 改:scoreAttempt 保留;步结果结算(2 题全过即步成);删 runLevel/starsForRate
│   ├── words.test.ts      # 新:词库数据完整性
│   ├── engine.test.ts     # 新:出题正确性/干扰互异/兜底
│   └── lesson.test.ts     # 新:步编排/完成判定/解锁
├── components/
│   ├── game/MapView.tsx   # 改:分类词库网格(地图即主页)
│   ├── game/LessonPlay.tsx# 改:由 LevelPlay 泛化 → 步序列答题
│   ├── game/WordDone.tsx  # 新:词完成卡(+30×n/+20/称号/下一词)
│   ├── game/quiz/*        # 保留不动(Choice/ListenChoice/MatchGame/speech)
│   └── game/SettingsPanel.tsx # 新:模块开关弹层
├── App.tsx                # 改:状态机 boot→login→map→lesson→done;数据接线
worker/
├── index.ts               # 改:路由 progress/settings(替换 /api/game)
├── game.ts                # 删:单 JSON 整档 handler
├── progress.ts            # 新增:行级 GET/PUT 合并逻辑 + 列映射
├── settings.ts            # 新增:user_settings GET/PUT
└── _lib/*                 # 保留(auth/http)
```

quiz 三组件、ui 组件、audio/sfx/tts/speech、LoginGate、天空糖果主题 token、auth 全保留。题目组件 props(`kingdom`→读作用「当前技能的语言域」,speak 文本随选项)复用语义不变。

## 5. 数据模型

### 5.1 D1(schema.sql 幂等来源,全新环境)
```sql
CREATE TABLE IF NOT EXISTS progress (
  user_id   TEXT NOT NULL,
  word_id   INTEGER NOT NULL,
  pinyin_completed  INTEGER NOT NULL DEFAULT 0,
  hanzi_completed   INTEGER NOT NULL DEFAULT 0,
  english_completed INTEGER NOT NULL DEFAULT 0,
  stars_earned      INTEGER NOT NULL DEFAULT 0,
  updated_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, word_id)
);
CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id        TEXT PRIMARY KEY,
  enable_pinyin  INTEGER NOT NULL DEFAULT 1,
  enable_hanzi   INTEGER NOT NULL DEFAULT 1,
  enable_english INTEGER NOT NULL DEFAULT 1,
  updated_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```
`users` 表与认证逻辑不变。**schema.sql 需同步移除 `game_state` 表定义**(含其 FK 与旧外键引用),使全新环境只建 users + progress + user_settings;旧库由迁移脚本负责 DROP `game_state`。`drawing_*` 列**本 spec 不加**(二期迁移)。

### 5.2 迁移脚本(migrations/2026-09-03-word-progress.sql,幂等可重跑)
```sql
DROP TABLE IF EXISTS game_state;        -- 旧整档表作废
DROP TABLE IF EXISTS records;           -- 防御性,历史遗留(可无)
CREATE TABLE IF NOT EXISTS progress (…如 §5.1…);
CREATE INDEX IF NOT EXISTS idx_progress_user …;
CREATE TABLE IF NOT EXISTS user_settings (…如 §5.1…);
```
执行:新环境 `npm run db:apply`;既有库 `npm run db:apply` + `npm run db:migrate`。远程同 `d1 execute --remote --file=`。

### 5.3 前端类型(src/types.ts)
```ts
export type KingdomKey = 'pinyin' | 'hanzi' | 'english'   // 复用:兼作「技能/语言域」

export type SkillKey = KingdomKey                          // 别名语义化

export type WordUnit = {
  id: number            // 1..100,与解锁顺序一致
  emoji: string         // '🍎'
  pinyin: string        // 'bǐng gān' —— 卡片显示文本
  hanzi: string         // '苹果'
  english: string       // 'apple'
  category: CategoryKey // 分区 + 干扰项主依据
}

export type CategoryKey = 'shape' | 'food' | 'animal' | 'nature' | 'object'

export type WordProgress = {
  wordId: number
  completed: { pinyin: boolean; hanzi: boolean; english: boolean }  // 技能完成,只升不降
  starsEarned: number   // 该词累计已发星尘
  updatedAt: string
}

export type UserSettings = {
  enablePinyin: boolean
  enableHanzi: boolean
  enableEnglish: boolean
  updatedAt: string
}

// Question 类型保留(quiz 组件接口);skill 字段=KingdomKey 不新增字段。
```
`GameState` 关卡版(levels/exp/unlocked/kingdom)删除;前端内存态用 `{ words: Record<number, WordProgress>, totalStars: number }` 派生(见 §7.3)。

## 6. 词库(words.ts)

数据照 v1.1 §12(100 词顺序即解锁顺序),`words.test.ts` 拦截以下完整性约束:
- 恰好 100 条,id === 数组下标 + 1。
- id/emoji/hanzi/english/pinyin 非空且全局唯一(英文存在复合词 `ice cream` 除外按整串比较)。
- category ∈ 五类;每类 ≥ 8 词(保证同类别干扰项基数,兜底仍需见引擎)。
- 拼音含声调记号(轻声 `zi/le` 用无调字母的轻声字除外——v1.1 个别 `yue liang`/`xīng xing` 数据不一,统一规则:拼音串与 v1.1 §12 原样,仅修明确笔误)。

已知数据修正(沿 v1.1 表,发现即改):
- id 35「饼干」拼音文档写 `qǔ qí bǐng gān` → 修正为 `bǐng gān`。
- 分类语义混排(shape 组含书/门/礼物等非形状物;nature 组含蜜蜂/蝴蝶等动物)是 v1.1 数据瑕疵,一期**沿用文档分类**,干扰项靠同分类优先 + 跨类兜底;分区标题照 v1.1 地图文案(基础形状/食物/动物/自然界/交通与物品)。分类重整列入二期校对。

发音约定(复用现有约定):
- 拼音/汉字技能:读**汉字**(词卡/promptSpeak 存 hanzi);拼音串仅作**显示**,不作朗读。
- 英语技能:读词文本 en-US。
- 题目组件 `kingdom` = 当前技能,`speak` 文本规则见 §7.2。

## 7. 出题引擎与学习单元

### 7.1 步序(lesson.ts,纯逻辑)
```ts
function stepsFor(settings: UserSettings): SkillKey[]
// [pinyin, hanzi, english] 过滤 disabled;若空结果强制 ['english'](与文档 §4.2 一致,防全关)。

// 词 N 的「全完成」:= stepsFor(settings) 每步 completed 皆 true。
// 注意:全完成按「当前启用技能集」判定;若中途关闭某技能,已关闭技能不参与后续词完成判定。
```

### 7.2 每步出题(engine.ts)
输入:`word: WordUnit`、`skill: SkillKey`、`optionsPool: WordUnit[]`(全词库减去 word)。
每题图形用 `word.emoji`(绘画二期接替,`getVisual(word) = word.emoji` 本期唯一来源)。

每题 2 道,题型随机组合,与 v1.1 §5.4 对齐但砍 fillBlank:

| skill | 候选题型(随机抽 2,可重复组合) |
|---|---|
| pinyin | choice(看 emoji 选拼音) / listen-choice(听汉字音选拼音) |
| hanzi | choice(看 emoji 选汉字) / match(汉字 ↔ emoji 图) |
| english | choice(看 emoji 选词) / listen-choice(听词选词) / match(词 ↔ emoji 图) |

选项数:word.id ≤ 20 → 3 项(1 正 + 2 扰),其余 4 项(3 扰)。(与文档 §5.5 一致)
干扰项抽取:同 category → shuffle 取;不足则从全词库(剔除 word、剔除已选、剔除 hanzi/english 与 word 相同者)补齐,直至项数够。

文本/speak 映射(quiz 组件 BaseOption):
```ts
// skill === 'english'  → 卡面 text = word.english, speak = word.english(en-US)
// skill === 'pinyin'   → 卡面 text = word.pinyin, speak = word.hanzi(zh-CN,同音汉字朗读)
// skill === 'hanzi'    → 卡面 text = word.hanzi, speak = word.hanzi(zh-CN)
// listen-choice 的 promptSpeak: pinyin/english → 该技能朗读文本(见上)
```
选项 BaseOption id 全局唯一,前缀 `${wordId}-${题号}-${index}`。

### 7.3 答题与结算(复用壳)
- **答题壳**:LevelPlay 泛化 → `LessonPlay`,一次呈现**一步的 2 题**串行;单题内沿用 2 次机会/反馈/亮答案(scoring.scoreAttempt 不变)。
- **步判定**:步内 2 题都在其作答次数内答对 → **步完成**(pinyin/hanzi/english 对应 completed=true);任一题两次均错亮答案 → 该步**失败**,重出该步 2 题重做(新随机题,防背答案),不扣星尘。
- **单题奖励**:延续现有即时分(对 +10、连击 +2、二次对 +5)仅作卡内反馈,**不累加星尘**。
- **星尘**:步首完成 +30(第 2 次机会答对也算首过,只要该步首次通过);词「全完成」首达 +20。重学已领词不发重复星尘。
- **词卡(WordDone)**:词内各步完成后汇总展示:各技能 +30、全完成 +20 提示、称号(若晋级)、[下一词] / [回地图]。

`state.ts` 提供:空态、`isValidWordProgress`、字段级合并 `mergeProgress(local, server)`(completed 取 OR、starsEarned 取 max)、称号 `titleForStars(total): {level, name}`(阈值 0/300/1000/2500/5000/8000/12000,表 §11.2)。

**总星尘与解锁的派生**(纯函数,勿双写):
```
totalStars   = Σ words[*].starsEarned
unlockedId   = 从 1 起第一个未「全完成」的词 id(前面词必须已全完成才解锁后词);
              === max(已全完成词 id) + 1(当 1..n 连续完成时);更稳妥:自 1 线性扫描,首个 !fullyComplete 即当前解锁目标。
              若全部完成 → 100 后无解锁(全通)。
可重学范围 = 已解锁词(id ≤ unlockedId)均可点击进入;已完成词重学不重复发星。
```
等级称号仅展示用;不做「魔法师等级 = exp」,删除 exp 概念。

## 8. 后端(worker)

### 8.1 路由(worker/index.ts)
- `GET/POST /api/auth/login、GET /api/me、POST /api/auth/logout` 保留。
- `GET /api/progress` → 认证后读该 user 全行 → `{ progress: WordProgress[] }`。
- `PUT /api/progress` → 认证后 body `{ progress: WordProgress[] }`;逐词行级 upsert,`completed` 只升不降、`stars_earned` 取 MAX(见 §7.3 `mergeProgress` 合并语义);batch 大小上限 200、单行 word_id 1..100 外校验、body 非法返回 400。
- `DELETE /api/progress` → 认证后清空该 user 全部 progress 行(家长「重置进度」用;settings 保留)。
- `GET/PUT /api/settings` → user_settings 单行 upsert;默认三开。
- `/api/game`(旧整档)删除。

行级 SQL 直接操作固定列,不再整体 JSON;worker 增加 `worker/progress.ts`、`worker/settings.ts` 的列↔对象映射(小助手),延续「每 handler 先 `getAuthenticatedUser`」。

### 8.2 认证
`worker/_lib/auth.ts` 的 `getAuthenticatedUser`、cookie、`getSingleUser`、`safeEqual` 原样复用。`ADMIN_TOKEN` 配置/登出语义不变。

## 9. 页面与交互

### 9.1 状态机(App.tsx)
`boot → login → map(主页) → lesson → done`,另 `settings` 为 map 上的弹层(非独立屏)。

### 9.2 MapView(地图即主页)
- 顶部玻璃头:🏰 魔法语言岛 + ⭐{totalStars} + 🎖{称号名} + 声音开关 + 家长菜单(重置进度 / 学习设置 / 退出登录)。
- 主区:按五分类分区渲染词网格;每词格 = emoji + 完成徽标(✅全完成 / 🔄部分 / 🔒未解锁 / 当前目标词高亮脉冲)。
- 分区小标题沿用 v1.1 地图文案。点击已解锁词 → lesson。底部:总进度(已全完成词 / 100)。
- 目标词(首个未全完成)放显眼位置/顶部「继续学习」引导。

### 9.3 家长菜单 / 设置弹层
重置进度(confirm)→ 整批清空;声音开关;「学习设置」弹层:三个 Switch(拼音/汉字/英语),即时 `PUT /api/settings`,防全关(最后一个禁用);与 LoginGate 分离保留儿童可见性边界。

## 10. 删除清单(现有文件)
- `src/data/levels.ts`(10 关题库) → 删,由 words.ts 顶替。
- `src/game/state.ts` 关卡部分(emptyGameState/LEVELS_PER_KINGDOM/kingdomForLevel/applyResult/levelOfExp)、`src/game/scoring.ts` runLevel/starsForRate/LevelOutcome → 重写为词库语义。
- `src/components/game/LevelResult.tsx` → 重构为 WordDone。
- `worker/game.ts`(整档) → 由 progress/settings 顶替。
- `src/game/levels.test.ts` → 由 words/engine/lesson 测试顶替。
- CLAUDE.md 架构/数据/命令描述同步更新(见 §12)。

## 11. 测试
| 文件 | 断言 |
|---|---|
| words.test.ts | 100 词、id 连续、字段非空唯一、每类 ≥8、拼音笔误已修 |
| engine.test.ts | 每种技能生成的 2 题类型合法、选项含正确答案、干扰互异、干扰与 word 文本不重复、选项数(id≤20=3 / 其余=4)、同 category 优先 + 跨类兜底可达 |
| lesson.test.ts | stepsFor 过滤/强制英语;步全过→completed;任一题错 2 次→步失败;词全完成→解锁下一词;已领词重学不发重复星尘;totalStars/称号边界(0/299/300/…/12000) |

`npm test` 仍 `vitest run src/game/*.test.ts`(node 环境,纯逻辑)。

## 12. 文档同步(CLAUDE.md)
架构/数据/命令段落全部随之更新:数据模型两表、GameState 字段、路由、文件清单、发音约定、跑测范围;删除关卡/records/整档 JSON 描述;绘画/离线列入「二期(未做)」而非「明确不做」。

## 13. 风险与缓解
| 风险 | 缓解 |
|---|---|
| v1.1 100 词拼音/汉字有更多笔误 | 一期按表录入 + words.test 拦截;人工校对列二期 |
| 分类语义混 → 同分类干扰项主题混杂(如 shape 组含书门) | 跨类兜底保项数;二期重整分类 |
| 全开步数多(每词 6 题)拉长 | 词间自洽即可,步短(每步 2 题);模块可关 |
| listen 拼音朗读依赖 zh-CN 读汉字 | 沿用同音汉字约定(读 hanzi),Firefox 语音码修复已就位 |
| 旧库 game_state 数据作废 | 迁移 DROP 前不做数据抢救;登录后自动空进度 |
| settings 中途开启模块的语义缺口 | fullComplete/firstTargetId 相对「当前启用技能」判定:学习时某技能关闭、家长后续开启,先前已学词在新配置下重达完整 → 再触发词完成 +20,且 firstTargetId 回跳至更早词(重锁已学词)。默认 settings 恒定流程下正确,一期接受(仅家长渐进开启模块时出现)。二期修复:词表加 per-word 永久 bonus_granted 列(schema + worker + settleWord gate),解锁按 ever-enabled 技能判定 |
