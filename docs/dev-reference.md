# 开发参考细则(Dev Reference · 按需读)

> 按需加载的开发细则库。根 `CLAUDE.md` 只留核心铁律与指针;本文档存各主题的**完整细节**。CLAUDE.md 的指针在涉及对应主题时应触发先读本文档;其它活标准见 `docs/frontend-dev-standard.md`(前端操作细则)与 `docs/PLAN.md`(需求收口),立项详设在 `docs/superpowers/specs/`。
>
> 本文件与源码事实同步;发布行为改动时,本文件与 `/release` skill(可执行)两处同步。

## 何时读什么(触发表)

| 涉及主题 | 先读 |
|---|---|
| 部署 / 版本 / tag / 回滚 | 本文件「部署与版本发布」+ `/release`(执行流水线) |
| 数据库迁移 | 本文件「数据库迁移流程」 |
| 数据模型 / 表结构 / 前端数据类 | 本文件「数据模型」 |
| 改关卡 / 发音 | 本文件「发音与关卡数据约定」 |
| 后端 handler / 路由 | 本文件「后端(Workers)」 |
| 前端模块清单 / 组件组装 | 本文件「前端 3 层明细」+ `docs/frontend-dev-standard.md` |
| 需求 / 任务 / 优先级 / 拒绝记录 | `docs/PLAN.md`(单一事实源) |

---

## 部署与版本发布(事实细则)

**执行流水线走 `/release`(项目 skill,含闸门/回滚分支/坑)。本文件只留事实与铁律,不重复步骤。**

- **环境映射**:生产 = 顶层默认 env(worker `jazz-life-tracker`);预览 = `[env.preview]`(独立 D1 `jazz-life-tracker-preview`)。**禁止新增 `[env.production]`**(wrangler env 派生独立 worker → 脱域名/数据)。
- **命令**:`npm run deploy`(生产)/ `npm run deploy:preview`(预览)/ `npm run db:local`(本地迁移)。wrangler 一律显式 `--config wrangler.toml`,否则构建产物 `dist/jazz_life_tracker/wrangler.json` 劫持配置 → env 失效、DB 落生产库。
- **版本语义**:bug=patch / 新能力=minor / 破坏性=1.0.0 起 major(`0.1.0` 起步)。判破坏性:删/重命名字段·表·API 路由、改字段类型不可自动转换 = major;新增表、新字段(带 `DEFAULT` 或可 `NULL`)、新增 API 路由 = 向下兼容 → minor。
- **tag 铁律**:tag 仅在「部署成功 + 浏览器冒烟通过」后打:`npm version <level> -m "chore(release): v%s"` → `git push origin main --tags`。部署/冒烟失败**绝不 `npm version`**(孤儿 tag)。
- **回滚**:代码/前端错 → `wrangler rollback --config wrangler.toml`(<10s,前后端同切);env/绑定错 → 随 config 或 `--var` deploy 固化,禁 Dashboard 手改(rollback 不恢复变量);D1 数据坏 → 绝不回滚迁移文件,hotfix 改代码或 SQL 修复。
- **认证令牌**:prod `ADMIN_TOKEN` 已是 secret,**勿覆盖**(同名覆盖 = 已存 cookie 全失效);preview 需独立 secret(`wrangler secret put ADMIN_TOKEN --config wrangler.toml --env preview`,随机值);本地 dev **零配置**:`expectedToken` 在 `import.meta.env.DEV` 下回落 `DEV_DEFAULT_TOKEN='jazz'`(未配 `.dev.vars` 也能登录);`.dev.vars`(gitignore,**不随 worktree 复制**)只在要覆盖令牌时才需要 —— 容器不入库,因里面可能装真 token;构建产物 `DEV=false` → **无兜底**,prod/preview 缺 secret 即全部 401。模板入库、容器不入库 —— 容器里可能装真 token,且历史上曾随 vite-plugin 产物被当静态资源上传致泄露。`wrangler.toml` 持 worker 入口、D1 binding、assets、database_id 与 preview env。

---

## 数据库迁移流程(规范模型)

- 真源 = `migrations/` 数字前缀迁移,统一经 `wrangler d1 migrations apply` 执行并记录 `d1_migrations`(apply 幂等,已记录文件不重跑)。`schema.sql` 已下线。
- `0001_init.sql` = **基线快照**(users + progress + user_settings 全量 `CREATE IF NOT EXISTS`,无 DROP;其中 `progress` 表已停用,见「数据模型」):新环境一条命令建齐,旧库幂等对齐。此后表结构变更一律新增 `0002_xxx.sql` …,**不改 0001**;新字段须带 `DEFAULT`/可 `NULL`,保证万一回滚旧代码不崩。
- **顺序(不可逆,先升库后升代码)**:本地 `npm run db:local`;线上 preview → 生产 apply 仅在发布时做,命令与闸门见 `/release`。
- `migrations/archive/` = 旧 date 前缀迁移历史(game_state 建/拆、生活记录)已下线,不参与 apply,勿再加回。

---

## 数据模型

### 表(migrations/0001_init.sql … 0008_pinyin_progress.sql)

**活着**的表有三张:两张**老基线表** —— `users`(单行默认用户,认证用)与 `user_settings`(每 user 一行,**新代码仍在读写**其中的成就 / 连续天数列,故**不是废弃表**),外加 `pinyin_progress`(0.2.0 新增,每 user 一行,玩法进度)。其余是旧世界的遗物 —— **已停用,保留仅为「迁移不可回滚」**(红线:绝不删列改表、绝不回滚迁移文件):

| 迁移 | 对象 | 状态 |
|---|---|---|
| `0001_init.sql` | `users` | **活** — 认证不校验密码/邮箱(列保留以免迁移),仅存默认用户单行作外键;登录时按需 `INSERT` |
| `0001_init.sql` | `progress` 表 | **停用** — 词课「每词一行」的进度表,词库/词课已删,无代码读写(索引 `idx_progress_user` 一并停用) |
| `0001_init.sql` | `user_settings` | **活**(仅趣味列)— 每 user 一行 |
| `0002_fun.sql` | `user_settings.earned_achievements` / `consecutive_days` / `last_active_date` | **活** — 成就集(幂等去重) + 连续学习天数,结算时整行 upsert |
| `0003_basics.sql` | `basics_progress` 表 | **停用** — 基础引导(声母/韵母熟度)已删 |
| `0004_chinese_domain.sql` | `user_settings.enable_chinese`(及更早的 `enable_pinyin`/`enable_hanzi`/`enable_english`) | **停用** — 领域开关已随词课删除;worker 的 settings handler **不读不写**这些列(列都有 `DEFAULT`,INSERT 去列即安全) |
| `0005_qianzigu_chapter.sql` | `qianzigu_progress` 表 | **停用** — 千字谷断点续玩已删 |
| `0006_sentence_step.sql` | `progress.sentence_level` | **停用** — 附属于 `progress` |
| `0007_bonus_granted.sql` | `progress.bonus_granted` | **停用** — 附属于 `progress` |
| `0008_pinyin_progress.sql` | `pinyin_progress` 表 | **活** — 每 user **一行**:`stars`(关卡 id → 1/2/3 的 JSON,未通关的关不出现)、`total_stars`(星尘累计)、`updated_at`;主键 `user_id` |

- 停用表/列**不参与任何新功能**,也不再写迁移去清它们(清表 = 破坏性,且破坏「迁移不可回滚」这条红线)。
- `0008` 的 `stars` 用**对象**而非定长串:以后加关卡不用动 worker 里的「总关数」常量;代价是没法在 SQL 里逐 key 取 `MAX` → 只能读-改-写(见下节)。

### 前端类型归属(每个数据类随其管理服务契约文件归属)

统一经 `@/shared/services` barrel 流出,无集中 `types.ts`:

- `PinyinProgressData`(`{ stars: LevelStars; totalStars }`)、`LevelStars`(关卡 id → 星数)、`LevelClear`(一次通关的产出)归 `services/pinyin-progress.ts`
- `UserSettings`(`earnedAchievements` / `consecutiveDays` / `lastActiveDate` / `updatedAt`)+ `SettingsSnapshot` 归 `services/settings.ts`
- `Achievement` / `AchievementState`(成就目录与扫描入参)归 `services/achievements.ts`(目录常量 `ACHIEVEMENTS` 与 `checkAchievements` 在 `features/achievements/achievements.ts`)
- `ComboSnapshot` / `AnswerKind` 归 `services/combo.ts`;`Rng` 归 `services/lucky-bonus.ts`
- `ApiError`(HTTP 错误类)、`User`、`ApiUserSettings` 归 `services/api.ts`
- `AudioCue` 归 `services/audio.ts`;`SpeechRole` / `SpeakRoleOptions` 归 `services/speech.ts`;`ToastData` / `ToastType` 归 `services/toast.ts`;`LoadState` 归 `services/core.ts`

服务契约在 `src/shared/services/*`:接口与其注册/取用 token **同名一体**,`services/index.ts` 统一出口,无 keys/map 集中映射。服务端 GET 返回的 settings / progress 行不含 `updatedAt`(worker 序列化时省略),前端补齐为本地时间。

关卡数据本身(`UNITS` / `Level` / `Syllable` / `Block`)不属服务契约 —— 它是 `features/pinyin-blocks` 的**领域数据**,经该 feature 的 `index.ts` 流出。

---

## 后端(Workers + 手写路由,`worker/` 目录)

`worker/index.ts` 是唯一 Worker 入口(`wrangler.toml` 的 `main`),`fetch` 内按 pathname + method 分发到 handler:

- `worker/index.ts` — entry + 路由表(`/api/auth/login` POST/GET、`/api/auth/logout` POST、`/api/me` GET、`/api/settings` GET/PUT、`/api/pinyin-progress` GET/PUT/DELETE;未匹配的 `/api/*` 一律 JSON 404,其余非 API 请求走 `env.ASSETS.fetch`)
- `worker/auth.ts` — `handleLogin`(POST,constant-time 比对 `expectedToken(env)` —— `env.ADMIN_TOKEN`,dev 缺省回落 `jazz`,通过后设 `jazz_token` cookie,返回唯一用户)、`handleLogout`(清 cookie)、`handleMe`
- `worker/pinyin-progress.ts` — `handleGetPinyinProgress`(GET,读该 user 单行;无行返回空表 `{ stars: {}, totalStars: 0 }`)、`handlePutPinyinProgress`(PUT,body `{ stars, totalStars }`:星级表逐 key 校验 `^u\d+-\d+$` 且值 ∈ {1,2,3},星尘须为 0..1000000 的整数,**任一不合法即 400,不静默降级**;写入 = 读旧行 → `mergeStars` 逐 key 取 `MAX` → upsert,`total_stars` 由 SQL 层 `MAX(pinyin_progress.total_stars, excluded.total_stars)` 只升不降)、`handleDeletePinyinProgress`(DELETE,清空该 user 行)
- `worker/settings.ts` — `handleGetSettings`(GET,读该 user 的 `earned_achievements` / `consecutive_days` / `last_active_date`;无行返回空默认)、`handlePutSettings`(PUT,body 缺 `settings` → 400「设置不合法」,三列各自按类型归一后 upsert;`enable_*` 四列**不读不写**)
- `worker/_lib/auth.ts` — 共享认证工具:`getAuthenticatedUser()`、cookie 读写、constant-time 比较 `safeEqual`、唯一用户读取/建行;`worker/_lib/http.ts` — `jsonResponse` 辅助

**约定**:每个 handler 先调 `getAuthenticatedUser(request, env)`,未授权返回 401。所有查询按 `user_id` 绑定,实现用户隔离。worker 只做行级读写(pinyin_progress 每 user 一行、settings 每 user 一行),**不解析**拼音业务语义;星级与星尘只升不降由 worker 侧的合并保证(幂等)。路由无第三方库(无 itty-router 等),保持简约。

**dev 运行模型**:`@cloudflare/vite-plugin` 读 `wrangler.toml`(main/D1/assets),把 worker 跑在 Vite dev server 内的 workerd 环境。dev 下 `/api/*` 进 worker,其余请求由 Vite 接管(HMR)。D1 本地持久化与 `wrangler d1 --local` 共享 `.wrangler/state`。**没有 localStorage 回退模拟**,前后端始终同一套代码。

**生产运行模型**:`wrangler deploy --config wrangler.toml` 读 `wrangler.toml`——`main: ./worker/index.ts`(wrangler 现场打包源码)+ `assets: ./dist/client`(前端),非 `/api` 请求由 worker 内 `env.ASSETS.fetch` 提供静态资源。⚠️ 两条红线:① 不要用 vite-plugin 生成的 `dist/jazz_life_tracker/` 做部署目录:它对相对 assets 路径解析会回退到该目录自身,把 `.dev.vars` 等 worker 产物当静态资源上传(曾致本地 token 泄露);② 部署/迁移命令**必须显式 `--config wrangler.toml`**,否则 wrangler 会重定向到构建产物 `dist/jazz_life_tracker/wrangler.json`(陈旧、无 `[env.preview]`),导致 env 失效、DB 绑定回落到生产库。

---

## 发音与关卡数据约定

发音唯一出口 = `features/speech`(契约 `shared/services/speech.ts`);关卡数据 = `features/pinyin-blocks/levels.ts`。

- **关卡数据**:`UNITS` = **7 单元 / 37 关**(单韵母 / 二拼 / 复韵母 / 鼻韵母 / 三拼介母 / 焊接音 / 双音节词),单元顺序即难度阶梯。`Unit.badge`(地图格里的名片块)与 `Level.syl`(槽位来源)都**显式写死,不由拼音串反推** —— 数据即答案,反推逻辑藏在解析器里出错更难查。
- **`Level.id` 形如 `u2-3` 是存档键,与显示顺序解耦**:挪关、插关都不改已有 id(序号只在建关时取一次)。改 id = 已存的星跟错关。
- **朗读真相 = 同音汉字**:`Level.read` 必须是同音汉字(如 `pinyin: 'bà'` 配 `read: '爸'`),由 `LevelEntry` 以 `speech.speak(text, 'zh-CN')` 播出。系统 TTS 拿到 `bà` 这种拉丁串会逐字母念(或按英文规则念),所以**拼音串只上屏、不进 TTS**;关卡数据里没有 `speak` 字段,也没有从拼音反推读音的解析器。音效(对/错/通关)另走 `AudioService`(Web Audio 合成),与语音是两条路。
- **speech 首响治理(0.2.0 发音延时/无声)**:`features/speech` 创建即 `getVoices()` 预取 + `voiceschanged` 刷新缓存(空轮询不覆盖好缓存);语音未就绪时保留**最新一条**朗读、就绪即补播(不静默丢);空闲冷启动**不 cancel** 立即播,仅引擎忙才 `cancel` 且隔 ~30ms 再播(防 Chrome 同 tick 吞句头);有 voices 但无匹配 voice 时降级引擎默认音(utterance 只带 BCP47 `lang`);**不做引擎暖机**(取舍 2026-09-09):曾用 `volume=0` 真音节想「无声唤醒」懒初始化 TTS(Chrome 需真实样本才起音频管线、空句不唤醒),但 Firefox/Chrome 语音后端不遵守 `utterance.volume=0`,暖机句会在会话首次交互真实响一声 → 暖机整体删除。`speak` 仅「无引擎 / 无语音源且永等不到 voices」时返 `false`(静默),入队与降级均返 `true`。
- **存留但生产零调用的语音面(登记,勿当死代码误删)**:`SpeechService.speakRole` / `SpeechRole` / `SpeakRoleOptions`(角色语速/音高表 `SPEECH_ROLE_VOICE`)是千字谷台词角色的遗留 —— **生产调用点为零**;按「引用 `speakRole` 这个名字的文件」算共四处,各自的性质不同:实现 `features/speech/speech.ts`、契约声明 `shared/services/speech.ts`、`features/speech/speech.test.ts`(**真调它**,断行为与降级)、`src/app/App.test.tsx`(**按 `SpeechService` 形状整份 stub**,那一行是接口要求的成员而非调用 —— 删掉契约成员会让 `npm run build` 的 tsc 在 App.test.tsx 报 excess property);`SpeechRole` 这个**类型**另被 `shared/services/speech.contract.test.ts` 引用(那条用例只断字面量表,不碰 `speakRole`)。删它要动的文件**不止测试**:除上面四处外还有**桶文件 `shared/services/index.ts`**(`export type { SpeakRoleOptions, SpeechRole } from './speech'`)—— 删类型时 `tsc` 会在这里报 `TS2305`(`npm run build` 红,而 `npm test` 仍绿:类型只在编译期存在);故留给人决定;`AudioCue` 里的 `'streak'` 同理(**生产无触发点** —— 除 `features/audio/audio.ts` 的实现分支与 `shared/services/audio.ts` 的联合类型外,它今天只出现在 `audio.test.ts`,生产代码里没有任何调用点传它)。**(更正 2026-09-24,期 1:「生产无触发点」已不成立 —— 它已接线:`combo5` / `combo10` 两档经 `CELEBRATE_CUE` 发声,出处 spec `2026-09-24-reward-flight-design.md` §3.1。按本段体例逐面给 natures:实现分支 `features/audio/audio.ts`(`TONES` 表,真播)、契约数组 `shared/services/audio.ts` 的 `AUDIO_CUES`(声明)、映射表 `shared/services/celebrate.ts` 的 `CELEBRATE_CUE`(`combo5` 与 `combo10` 两格的值,真调它的生产路径)、测试 `features/audio/audio.test.ts`(断行为)。原文保留不追改。**)**`AudioCue` 里的 `'correct'` 同样生产零触发点**(2026-09-23 补登,终审扫出登记缺口):它的出现面 = 实现分支 `features/audio/audio.ts`、契约联合 `shared/services/audio.ts`、`features/pinyin-blocks/PinyinBlocksGame.tsx` 的 `playSound` prop 联合(**那是类型声明,不是调用点**)、`features/celebrate/celebrate.ts` 的注释(**注释里的提及,不是调用点** —— 同一段注释里出现两处:一处是「生产零调用点」的登记指针,一处是引述被删旧注释里的「correct 音效」)、`audio.test.ts` 的两条用例(**唯一真调它的地方**);**槽位放对播的是 `'tap'`**(`PinyinBlocksGame.tsx` 的 `placeBlock`)。`'correct'` 在 `main` 上同样为零 ⇒ **非本支引入**。**(更正 2026-09-24,期 1:本段登记的「**生产零触发点**」已不成立 —— `'correct'` 已接线:`word` 档(一关拼成)发声,出处 spec `2026-09-24-reward-flight-design.md` §3.1。同样逐面给 natures:实现分支 `features/audio/audio.ts`(`TONES` 表,真播)、契约数组 `shared/services/audio.ts` 的 `AUDIO_CUES`(声明)、映射表 `shared/services/celebrate.ts` 的 `CELEBRATE_CUE`(`word` 一格的值,真调它的生产路径)、`features/pinyin-blocks/PinyinBlocksGame.tsx` 的 `playSound` prop 联合(**那仍只是类型声明,不是调用点**)、测试 `features/audio/audio.test.ts`。本段原列的出现面里「`features/celebrate/celebrate.ts` 的注释」这一条已随 2026-09-24 期 1 删除 —— 那句「`'correct'` 生产零调用点」被本次改动当场弄成假话,已同批删掉(该段注记的「已同批更正」指的是 2026-09-23 那次,见 `docs/superpowers/specs/2026-09-23-effects-textless-design.md` §3.4 勘误块)。槽位放对仍播 `'tap'`,不变。原文保留不追改。**)这三处(`speakRole` / `'streak'` / `'correct'`)**不是**本轮清理对象。**(2026-09-24 期 1 更正:三者要分开看,别当一件事处理 —— `speakRole`(含 `SpeechRole` / `SpeakRoleOptions`)仍成立:今天确实生产零调用,上面的四处引用面与删除代价一字不变;`'streak'` / `'correct'` 两档已不再是「零调用」(见上面两处更正,它们经 `CELEBRATE_CUE` 有线)。删 `speakRole` 要动的文件与这两档无关。)**

---

## 前端 3 层明细(模块清单与组装)

**事实源**:3 层架构设计定稿 + 操作细则 = `docs/frontend-dev-standard.md`(早年 spec `docs/superpowers/specs/2026-09-04-dev-architecture-refactor-design.md` 中服务 key 的 keys/map 原案已由同名 token 取代,以标准与源码为准)。

- `src/shared/` — 无上层依赖的契约、纯逻辑与中性基础件:`services/*`(契约 + 数据类随契约归属,经 `services/index.ts` barrel 流出;`core.ts` = 服务访问机制核心 `ServiceToken`·`registry`·`useService`·`useServiceSnapshot` + 快照态 `LoadState`)、`ui/`(五个中性视觉基础件 button / card / input / label / `reward-card.ts` 的 `REWARD_CARD`(成就与幸运两个奖励弹层共用的卡片几何,2026-09-23 加) + `utils.ts` 的 `cn`(同源 `tailwind-merge`,features 可引);`quiz/` 整棵与 badge / select / chart-tooltip 已随旧玩法删除)、`testing/`(`han-text.ts` 的 `HAN_TEXT` = 零文本扫描用的唯一一份正则,**仅测试引用** —— 定义在本文件,引用它的全是 `*.test.*`,不进生产依赖图;2026-09-23 从 `features/pinyin-blocks/UnitMap.test.tsx` 里那份内联正则抽出)
- `src/features/<f>/` — 自包含模块,公共面 = 该目录 `index.ts`;feature 间**禁止编译期互引**。现存两组:
  - **玩法**:`pinyin-blocks` —— `MapEntry` / `UnitMap`(单元地图,零文本名片用真积木渲染)、`LevelEntry`(关卡入口:取服务 + 组装 + 落库)、`PinyinBlocksGame` / `BlockChip`(玩法与积木渲染)、`levels.ts`(7 单元 / 37 关课程数据)、`blocks.ts`(块池 + 提示档 `HINT_BY_UNIT` / `hintFor`)、`rules.ts`(槽位 / 干扰块 / 星级,可注入 `rng`)、`settle.ts`(一次通关的结算)、`progress-stats.ts`(解锁 / 通关数 / 完美单元数)
  - **服务型**(11 个):`api`(唯一 fetch 封装)、`auth`(`AuthEntry` 登录门 + `LoginGate`)、`pinyin-progress`(进度:乐观保存队列 + 只升不降合并)、`settings-state`(成就集 / 连续天数)、`achievements`(目录 + 扫描 + `AchievementPopup`)、`combo`(连击加成)、`lucky-bonus`(首次通关掷幸运)、`celebrate`(彩带)、`audio`(音效)、`speech`(TTS)、`toast`
- `src/app/` — composition root:`bootstrap.ts`(**唯一生产 `registry.register` 点**,按依赖顺序注册 11 个服务 + 幂等守卫数组)、`App.tsx`(登录态驱动 + 页面状态路由 + 庆祝队列组装;玩法 / 结算 / 奖励 / 持久化规则不落 app)、`useAppState.ts`(相位状态机 `boot`/`login`/`map`/`level`/`parent`)、`ParentPanel.tsx`(家长面板:登出 / 重置进度 / **成就目录** —— 目录全量与「已得 / 未得」两态的唯一可见出口;孩子面已零文本,故这一页是成就名与说明在**可见文字**层面的唯一出口)、`ErrorBoundary.tsx`。`src/main.tsx` = HTML 入口(`bootstrap()` + `ToastProvider` + `<App/>`)

**取用纪律**:`useService()` 仅允许在 page feature 的 `<Name>Entry.tsx` 与 `app/` 组装 hooks 内调用;接口与注册/取用 key **同名一体**(接口占 type 空间,`export const XService = Symbol(...) as ServiceToken<XService>` 同名 const 占 value 空间;`ServiceToken` 与 `registry`/`useService`/`useServiceSnapshot` 收 `services/core.ts` 一文件),`registry.register(PinyinProgressService, impl)` 只在 bootstrap、`useService(PinyinProgressService)` 取、`useServiceSnapshot(service)` 订阅(`getSnapshot` 须返稳定引用)。领域数据/规则按语义属主落 feature(关卡与积木规则 → `pinyin-blocks`),跨 feature 消费经 shared 契约服务;跨 feature 的组件在 app 组装传 props。数据流:`fetch('/api/...', { credentials: 'include' })`,封装在 `features/api`。

**四处 `aria-label` 是「可能无效的声明」(登记,勿当成已生效)**:`UnitMap.tsx` 徽章格的 `span`(`成就 <名字>(已得 / 未得)`)、`LevelEntry.tsx` 连击圆点的 `span`(`连击 N`)、`AchievementPopup.tsx` 与 `LuckyBonus.tsx` 卡片承载的那个 `motion.div`(成就名 / `幸运奖励`)—— 四者都挂在**无 role 的元素**上(`span` / `div` 都是 generic)。ARIA 1.2 对 generic 角色**禁止命名**,主流 AT 的实现不一致 ⇒ 这些名字**可能根本不进无障碍树**,读屏用户听到的可能只是「+50 ⭐」或什么都听不到。**已裁定不加 `role="status"`**(那会让每次连击都播报,是取向决定,不是遗漏)⇒ 这四处只能算**声明**,别当成读屏一定读得到;孩子侧的可靠出口仍是零文本的视觉本身(`W-C9` / `W-V4` / `W-P5`)。为什么在该处挂而不是另加可见文字:孩子面零文本是硬不变量(见 `docs/superpowers/specs/2026-09-23-effects-textless-design.md` §2),`aria-label` 是不进视觉的例外②。
