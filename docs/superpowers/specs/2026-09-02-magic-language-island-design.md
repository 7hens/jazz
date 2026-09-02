# 魔法语言岛(MVP)— 设计文档

> 日期:2026-09-02 · 项目:jazz · 路径:architectural(MVP 闭环,单次迭代)

## 一、背景与目标

将现有「隐私生活记录仪」(体重/财务/运动 三 tab + token 登录 + D1)整个替换为面向儿童的拼音/汉字/英语闯关游戏「魔法语言岛」。孩子扮演「语言小魔法师」,线性闯过新手村 10 关,通过收集「星尘」、提升魔法师等级获得持续正反馈。

**已确认的产品决策**(brainstorming 阶段用户拍板):

1. 游戏替换整个界面;保留现有后端栈(D1 + `ADMIN_TOKEN` cookie 认证 + Cloudflare Workers 手写路由)。
2. 进度按单档案存服务端:一个家庭 token 对应一份孩子进度,复用现有单用户模型。
3. 交付 **MVP 闭环**:新手村 10 关可完整通关 + 计分/星级/星尘/exp/等级 + 进度落 D1。
4. 发音用浏览器 **SpeechSynthesis**(zh-CN / en-US),无中文语音时静音降级。
5. 题目与关卡定义静态写死在**前端** `src/data/*`;进度存 D1 **单行 JSON**。

**MVP 明确不做**(后续迭代):商店/徽章/宠物/每日挑战、语音识别、汉字书写与笔顺动画、BOSS 关、30/70 关扩展、多孩子档案、家长看板、社交/PWA/个性化推荐。

## 二、架构总览

```
┌─ 前端(React 19 + TS + Vite :3000)────────────────┐
│  boot → login → map → level-play → level-result   │
│  题库/关卡定义: src/data/* 静态 TS                 │
│  玩法引擎:答题 → 计分 → 星级 → 结算                 │
│  发音:SpeechSynthesis;音效:Web Audio 合成          │
└───────────────┬─────────────────────────────────────┘
                │ fetch('/api/…', {credentials:'include'})
┌───────────────▼─────────────────────────────────────┐
│  Worker(workerd): /api/auth/* /api/me /api/game     │
│  D1: users(保留) + game_state(新增)                 │
└──────────────────────────────────────────────────────┘
```

- 登录后首拉 `GET /api/game` 得到整份进度;此后本地答题,在**关末结算时**与**必要时(如刷新守卫)**整份 `PUT /api/game` 上报。
- worker 只存取 game_state 整行 JSON,不解析内容(校验仅限 body 大小上限)。

## 三、数据模型与迁移

迁移文件:`migrations/2026-09-02-game-state.sql`

```sql
-- 生活记录 UI 与 API 已移除,records 不再使用 → drop
DROP TABLE IF EXISTS records;

-- 单档案游戏进度:每 user 一行,state 为整份 GameState JSON
CREATE TABLE IF NOT EXISTS game_state (
  user_id   TEXT PRIMARY KEY,
  state     TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

`users` 表保留不动(仍作外键 + 认证单用户)。

### GameState(前端 `src/types.ts`)

```ts
type KingdomKey = 'pinyin' | 'hanzi' | 'english'

type LevelRecord = { stars: 0 | 1 | 2 | 3; bestScore: number }

type GameState = {
  stars: number                       // 星尘(货币),只由首通星级发放
  exp: number                         // 经验
  unlocked: number                    // 已解锁的最大关卡号(1..10;通关本关才解锁下一关)
  levels: Record<number, LevelRecord> // 每关最佳成绩,key = 关卡号
  kingdom: Record<KingdomKey, number> // 各王国累计已得星(地图进度用)
  updatedAt: string
}
```

- `levels` 存**历史最优**(首通后复玩只提升星级/分数,不覆盖为差成绩)。
- `kingdom` 汇总:拼音 = L1–L4 得星和,汉字 = L5–L7,英语 = L8–L9;L10 综合不归属任何王国。
- `unlocked` 初值 1;仅当第 N 关首通(≥1★)后推进到 N+1。
- 等级由 exp 阈值推出(**不落库**):每 300 exp 升 1 级,`level = floor(exp / 300) + 1`。

## 四、Worker API 契约

认证复用 `worker/_lib/auth.ts` 的 `getAuthenticatedUser`(cookie `jazz_token` ↔ `ADMIN_TOKEN`),未授权一律 401 `{ message: '未授权' }`。

| 方法 | 路径 | 成功响应 | 说明 |
|---|---|---|---|
| POST | `/api/auth/login` | `{ ok, user }` | 沿用现有 |
| POST | `/api/auth/logout` | `{ ok }` | 沿用现有 |
| GET | `/api/me` | `{ user }` | 沿用现有 |
| GET | `/api/game` | `{ state: GameState \| null }` | 无行返回 `null`,前端落地默认空态并首次 PUT |
| PUT | `/api/game` | `{ ok }` | body `{ state }`,整份覆盖 upsert |

- `PUT /api/game`:body JSON 解析;`state` 非对象或序列化后 > 64KB → 400 `{ message: '进度数据过大' }`。用 `INSERT … ON CONFLICT(user_id) DO UPDATE`。
- **移除**:`records` 路由(`worker/records.ts` 删除,`worker/index.ts` 删 case),前端 `LifeRecord` types 与相关组件一并删除。

## 五、关卡内容与题库(MVP 10 关)

线性顺序,按号解锁。UI 文案中文。每关 6 题(第 10 关 8 题)。

**发音实现约束(TTS)**:SpeechSynthesis 对中文语音的拼音串(如 `bā`)发音不可靠,因此**每张带读音的卡带一个 `speak` 字段,用同音汉字让 zh-CN 朗读**(卡面仍显示拼音/字母/词);英语用 en-US 直接朗读词/字母;汉字用 zh-CN 直读。无对应语音时静音、题仍可凭文字作答。

### 素材清单(实现 `src/data/levels.ts` 直接采用)

| # | 王国 | 标题 | 内容 / 素材(speak 用字) | 题型 |
|---|---|---|---|---|
| 1 | 拼音 | 韵母小镇 | 单韵母卡:a/o/e/i/u/ü(⚠️ 显示拼音,`speak` 用同音字:啊/喔/鹅/衣/乌/迂)。「看字选韵母」——🔊 播 a 声,6 卡选一 | 听音选卡 |
| 2 | 拼音 | 声母城堡 | 声母卡:b/p/m/f/d/t/n/l(⚠️ 显示拼音,`speak` 用近似音节:玻/坡/摸/佛/得/特/讷/勒)。🔊 播一声母,8 卡选一 | 听音选卡 |
| 3 | 拼音 | 声调小山 | 四组同音四字(听汉字选声调):妈/麻/马/骂 = mā/má/mǎ/mà;八/拔/把/爸 = bā/bá/bǎ/bà;衣/姨/椅/亿 = yī/yí/yǐ/yì。🔊 读汉字(zh),卡片显示 4 个带调拼音,点正确声调 | 听音选卡(选带调拼音) |
| 4 | 拼音 | 拼读魔法阵 | 两拼代表词(显示完整拼音,🔊 读汉字):妈 mā / 爸 bà / 大 dà / 米 mǐ / 地 dì / 兔 tù / 泥 ní / 马 mǎ。🔊 念词,4 个拼音候选选一 | 听音选卡 |
| 5 | 汉字 | 象形字林 | 字 ↔ 图(emoji)配对:日☀️ 月🌙 山⛰️ 水💧 火🔥 木🌳 田🌾 目👁。点左字、点右图成对 | 两列配对 |
| 6 | 汉字 | 笔画山谷 | 数字数笔画(卡面大字显示字):一(1) 二(2) 三(3) 十(2) 口(3) 人(2) 大(3) 天(4) 上(3) 下(3)。点正确数字 | 点选(数字 1–5) |
| 7 | 汉字 | 认字花园 | 常用字识认(🔊 直读汉字 → 4 候选字中选):人 八 入 大 天 上 下 我 好 山 | 听音选字 |
| 8 | 英语 | 字母乐园 | 大写 ↔ 小写配对:Aa Bb Cc Dd Ee Ff;并含 🔊 读字母名(en-US)选大写 | 两列配对 + 听音选 |
| 9 | 英语 | 单词农场 | emoji → 英文词:cat🐱 dog🐶 sun☀️ apple🍎 egg🥚 fish🐟。🔊 读英文词(en-US),4 词选一;含 1 题反向(见词选图) | 听音选词 |
| 10 | 综合 | 新手魔法师考核 | 混合 8 题,覆盖 L1–L9 各类型(韵母 1 / 声母 1 / 声调 1 / 拼读 1 / 象形 1 / 笔画 1 / 字母 1 / 单词 1),从已有素材抽样 | 混合 |

> 配对题型第 8 关素材含「大写字母 → 点对应小写」的听音变体;具体单题构成在实现计划的数据文件里逐条铺开,素材与题型不超出上表。

### 题型引擎(3 种)

1. **听音选卡 `listen-choice`**:卡含 `promptSpeak`,🔊 自动播 1 次 + 手动重播按钮;N 个候选卡(1 正确)。
2. **点选 `choice`**:读题干文字点正确卡;可为看图选字 / 数笔画选数字 / 认字选字。
3. **两列配对 `match`**:左列 / 右列各 N 项乱序,点左点右成对,错配抖动提示并复原。

统一抽象为 `Level` = `{ id, kingdom, title, questions: Question[] }`,`Question` 为判别联合(见 `src/types.ts`)。题库在 `src/data/*` 静态导出。

## 六、计分、星级与奖励

### 单题计分
- 每题最多试 2 次:**首次答对** +10 分,若连击(前一题也对)≥2 时每次额外 +2 分;第二次答对 +5 分(无连击);两次均错 +0 并亮出正确答案(不扣已得分)。
- 连击计数 = 连续首次答对的次数;答错后重置。
- 🔊 重播、秒答均无额外计分;**不做倒计时**(儿童友好,MVP 不引入速度分)。

### 关末星级(以当关得分率)
- **当关满分 = 题数 × 10**(首次全对的基准,不含连击加成);**得分率 = min(100%, 得分 / 满分)**,封顶 100%——连击加成是超越满分的 bonus,奖励「全对」玩家手感但星级只看封顶后的得分率。
- ≥90% → 3★,≥70% → 2★,≥50% → 1★,<50% → 0★(未通关)。
- **通关 = 得 ≥1★**。

### 进度推进
- 首通某关(≥1★)且该关号 == `unlocked` → `unlocked = 关卡号 + 1`(上限 11)。
- 未达到 1★ 的关可无限重玩,直到通过;复玩冲星只提升该关最优星级/得分。

### 奖励发放(只发一次)
- **星尘**:按该关历史最优星级发放,`3★=60, 2★=40, 1★=20`;仅当本次结算星级 > 历史最优时才补发差值,已按更优星发放过的不重复发。
- **exp**:首通该关 +80(每关限一次)。等级由 exp 阈值实时推导。

### 结算屏展示
- 本关星级、得分、星尘收入、exp 收入、连击最高纪录、是否解锁新关;通关时魔法风庆祝动效(保留 motion)。

## 七、前端结构与视图流

无路由库、无状态管理库(维持项目简约风格),`App` 内状态机切屏:

```
boot(loading /api/me + /api/game) → login(未登录) 
  → map(主界面) → level-play(玩法) → level-result(结算) → map
```

### 目录结构(新增/改动)
```
src/
  App.tsx                 # 重写:状态机 + 认证 + 进度拉取/保存
  types.ts                # 重写:GameState/Level/Question/UserProfile 等
  data/levels.ts          # 新增:10 关定义与全部题目
  game/
    scoring.ts            # 新增:计分/星级/星尘/exp/解锁/合并最优 纯函数
    engine.tsx            # 新增:题目渲染(3 题型)+ 作答状态机
    tts.ts                # 新增:SpeechSynthesis 封装(选 voice/朗读/静音降级)
    sfx.ts                # 新增:Web Audio 合成短音(对/错/胜利/点击)
    soundToggle.ts        # (并入 App 顶部?)发音总开关
  components/ui/*         # 保留基础组件,按儿童主题换样式
  lib/utils.ts            # 保留(cn)
  index.css               # 重写主题 token(见第八节)
```
删除:`components/tabs/*`、`components/dashboard/*`、`components/auth/LoginCard.tsx`(以 `components/login/` 儿童版替代)、`data/exercises.ts`、`lib/date.ts`、`types` 中 LifeRecord。

> 计分逻辑全部抽成 `game/scoring.ts` **纯函数**(`scoreQuestion`/`finalizeLevel`/`mergeState`),便于单测化——即便仓库无测试框架,也保持可独立验证的纯度。

## 八、UI / 主题 / 交互

- **主题**:`index.css` token 全换为天空糖果色系——天空渐变背景(浅蓝 `#bfe3ff`→`#eaf6ff`)+ 漂浮云朵装饰(CSS/emoji,非图片资源);卡片大圆角(≥`1.5rem`)、粗软阴影、高饱和糖果强调色(王国专属色:拼音=橙、汉字=红/朱、英语=蓝);主文字深蓝灰;暗色模式保留(儿童场景以亮色为主)。
- **地图(map)**:顶部状态条(`⭐ 星尘` / `Lv.N` / 三王国迷你进度条);主体为新手村 10 节点线性路径(横向滚动或上下蜿蜒,移动端优先);节点态 = 未解锁(🔒)/ 可玩(高亮呼吸)/ 已通关(显示 ⭐×N,可重玩)。地图角上放家长入口(🔧):「重置进度」(二次确认)与「退出登录」。
- **关卡玩法屏**:顶部回退(回地图,未结算不丢已通关记录,因结算才上报)+ 关卡标题 + 当前得星预估;中部题目卡;底部进度点(6/8 点)。正确/错误有动效与音效;🔊 显眼可点。
- **结算屏**:星级弹出动画 + 数字滚动(星尘/exp),「再玩一次 / 回地图 / 下一关」按钮(下一关未解锁则隐藏)。
- 保留 `motion`(react)做转场、卡翻转、庆祝动效;尊重 `prefers-reduced-motion`。
- 字号整体上调(适配儿童与触控);按钮最小高度 ≥48px。

## 九、发音与音效

- `game/tts.ts`:`speak(text, lang)` 封装;优先 zh-CN / en-US 匹配系统 voice;speechSynthesis 无匹配语音 → 返回 false,界面静音但不阻断作答。
- 自动朗读:听音题进题自动播 `promptSpeak` 1 次;任何含 speak 的卡可点击 🔊 重播。
- `game/sfx.ts`:Web Audio 合成——正确(上行双音)、错误(低短鸣)、连击提升(音高随连击升)、通关(琶音);统一音量低、可被发音总开关一起关掉。
- 顶部提供全局「声音开关」(🔊/🔇),存浏览器 localStorage,仅控制前端音频,不影响答题。

## 十、命令与迁移

```bash
npm run db:migrate        # 应用 migrations/2026-09-02-game-state.sql(本地)
# 远程: npx wrangler d1 execute jazz-life-tracker --remote --file=./migrations/2026-09-02-game-state.sql
npm run dev               # 全栈本地验证
npm run build && npm run lint
```

## 十一、验收标准(MVP done 定义)

1. `npm run dev` 起;未登录见魔法岛登录入口,错误 token 有中文错误提示;正确 token 直进地图。
2. 地图 10 节点正确态;L1 可玩,后续关解锁规则正确(首通前锁定)。
3. 三题型都能正常作答,答错允许二答,两次错亮正确答案。
4. 关末结算星级/星尘/exp 与计分规则一致;星尘/exp 只按首通/最优发一次;`unlocked` 正确推进。
5. 刷新页面后进度完整保留(从 D1 拉回);多设备同 token 拉同一份。
6. 🔊 发音可用(有语音环境)或静音降级(无);对错音效正常,总开关可关。
7. 家长入口可重置进度(确认后回空态)与退出登录。
8. 旧生活记录残留清除:界面无体重/财务/运动、无 `/api/records` 调用,`GET /api/records` 返回 404。
9. `tsc -b`、`vite build`、`oxlint` 全绿。
10. schema:records 已 drop;game_state 存在。
