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
| 改词库 / 出题 / 发音 | 本文件「题型与发音约定」 |
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
- **认证令牌**:prod `ADMIN_TOKEN` 已是 secret,**勿覆盖**(同名覆盖 = 已存 cookie 全失效);preview 需独立 secret(`wrangler secret put ADMIN_TOKEN --config wrangler.toml --env preview`,随机值);本地 dev 读 `.dev.vars`(gitignore,默认 `jazz-local-dev-token`,未配则登录 401)。`wrangler.toml` 持 worker 入口、D1 binding、assets、database_id 与 preview env。

---

## 数据库迁移流程(规范模型)

- 真源 = `migrations/` 数字前缀迁移,统一经 `wrangler d1 migrations apply` 执行并记录 `d1_migrations`(apply 幂等,已记录文件不重跑)。`schema.sql` 已下线。
- `0001_init.sql` = **基线快照**(users + progress + user_settings 全量 `CREATE IF NOT EXISTS`,无 DROP):新环境一条命令建齐,旧库幂等对齐。此后表结构变更一律新增 `0002_xxx.sql` …,**不改 0001**;新字段须带 `DEFAULT`/可 `NULL`,保证万一回滚旧代码不崩。
- **顺序(不可逆,先升库后升代码)**:本地 `npm run db:local`;线上 preview → 生产 apply 仅在发布时做,命令与闸门见 `/release`。
- `migrations/archive/` = 旧 date 前缀迁移历史(game_state 建/拆、生活记录)已下线,不参与 apply,勿再加回。

---

## 数据模型

### 表(migrations/0001_init.sql + 0002_fun.sql + 0004_chinese_domain.sql)

表 `users` + `progress` + `user_settings`(`game_state`/`records` 已随关卡制下线):

- `users`:认证不校验密码/邮箱(列保留以免迁移),仅存默认用户单行作外键;登录时按需 `INSERT`(取现有单行,无则建默认)
- `progress`:每 user × 每词一行,`word_id` 1..100。列:`pinyin_completed`/`hanzi_completed`/`english_completed`(0/1)、`stars_earned`(只增不减,由 `MAX` 合并)、`updated_at`。主键 `(user_id, word_id)`,`idx_progress_user` 索引
- `user_settings`:每 user 一行,启用领域列 `enable_chinese`/`enable_english`(默认 1;旧 `enable_pinyin`/`enable_hanzi` 停用保留 —— `0004_chinese_domain.sql` 增 `enable_chinese` 并回填「任一侧旧汉语技能开 → 域开」)+ `0002_fun.sql` 增列 `earned_achievements`/`consecutive_days`/`last_active_date`、`updated_at`

### 前端类型归属(每个数据类随其管理服务契约文件归属)

统一经 `@/shared/services` barrel 流出,无集中 `types.ts`:

- `WordUnit`(`{ id, emoji, pinyin, hanzi, english, category }`,`id` 1..100)与 `CategoryKey`(`shape/food/animal/nature/object`)归 `services/vocabulary.ts`(分类中文名 `CATEGORY_LABELS` 同在;词库常量 `WORDS`/`wordById` 100 词在 `features/vocabulary/words.ts`)
- `WordProgress`(`{ wordId, completed: Record<SkillKey, boolean>, starsEarned, updatedAt }`)与 `SkillKey`(`'pinyin' | 'hanzi' | 'english'`,原 KingdomKey 已并入)归 `services/progress.ts`
- `UserSettings`(`enableChinese/enableEnglish` + 趣味字段 `earnedAchievements/consecutiveDays/lastActiveDate`、`updatedAt`)与 `DomainKey`(`'chinese' | 'english'`)/`DOMAIN_ORDER` 归 `services/settings.ts`
- `Question` 判别联合(`listen-choice` / `choice` / `match` + `BaseOption`/`QuestionKind`)归 `services/question-engine.ts`
- `ApiError`(HTTP 错误类)与 `User`/`ApiWordProgress`/`ApiUserSettings` 归 `services/api.ts`

服务契约在 `src/shared/services/*`:接口与其注册/取用 token **同名一体**,`services/index.ts` 统一出口,无 keys/map 集中映射。服务端 GET 返回的 progress/settings 行不含 `updatedAt`(worker 序列化时省略),前端以 `isValidWordProgress` 校验 progress 行。

---

## 后端(Workers + 手写路由,`worker/` 目录)

`worker/index.ts` 是唯一 Worker 入口(`wrangler.toml` 的 `main`),`fetch` 内按 pathname + method 分发到 handler:

- `worker/index.ts` — entry + 路由表(`/api/auth/login` POST/GET、`/api/auth/logout` POST、`/api/me` GET、`/api/progress` GET/PUT/DELETE、`/api/settings` GET/PUT;未匹配的 `/api/*` 一律 JSON 404,其余非 API 请求走 `env.ASSETS.fetch`)
- `worker/auth.ts` — `handleLogin`(POST,constant-time 比对 `env.ADMIN_TOKEN`,通过后设 `jazz_token` cookie,返回唯一用户)、`handleLogout`(清 cookie)、`handleMe`
- `worker/progress.ts` — `handleGetProgress`(GET,读该 user 全部 progress 行)、`handlePutProgress`(PUT,body `{ progress: [...] }` 批量行级 upsert,`ON CONFLICT` 用 `MAX(...)` 只升不降;word_id 越界/单批 > 200 → 400)、`handleDeleteProgress`(DELETE,清空该 user 全部行)
- `worker/settings.ts` — `handleGetSettings`(GET,读该 user 单行启领域列;无行返回默认双开)、`handlePutSettings`(PUT,upsert `enable_chinese`/`enable_english`;双领域全关 → 400「至少保留一个学习领域」)
- `worker/_lib/auth.ts` — 共享认证工具:`getAuthenticatedUser()`、cookie 读写、constant-time 比较 `safeEqual`、唯一用户读取/建行;`worker/_lib/http.ts` — `jsonResponse` 辅助

**约定**:每个 handler 先调 `getAuthenticatedUser(request, env)`,未授权返回 401。所有查询按 `user_id` 绑定,实现用户隔离。worker 只做行级读写(progress 每词一行、settings 每 user 一行),**不解析**词库业务语义;星尘只升不降、加成只在首次由 worker 的 `MAX` 合并保证(幂等)。路由无第三方库(无 itty-router 等),保持简约。

**dev 运行模型**:`@cloudflare/vite-plugin` 读 `wrangler.toml`(main/D1/assets),把 worker 跑在 Vite dev server 内的 workerd 环境。dev 下 `/api/*` 进 worker,其余请求由 Vite 接管(HMR)。D1 本地持久化与 `wrangler d1 --local` 共享 `.wrangler/state`。**没有 localStorage 回退模拟**,前后端始终同一套代码。

**生产运行模型**:`wrangler deploy --config wrangler.toml` 读 `wrangler.toml`——`main: ./worker/index.ts`(wrangler 现场打包源码)+ `assets: ./dist/client`(前端),非 `/api` 请求由 worker 内 `env.ASSETS.fetch` 提供静态资源。⚠️ 两条红线:① 不要用 vite-plugin 生成的 `dist/jazz_life_tracker/` 做部署目录:它对相对 assets 路径解析会回退到该目录自身,把 `.dev.vars` 等 worker 产物当静态资源上传(曾致本地 token 泄露);② 部署/迁移命令**必须显式 `--config wrangler.toml`**,否则 wrangler 会重定向到构建产物 `dist/jazz_life_tracker/wrangler.json`(陈旧、无 `[env.preview]`),导致 env 失效、DB 绑定回落到生产库。

---

## 题型与发音约定(引擎生成)

`src/features/question-engine/engine.ts` + `src/shared/ui/quiz/`(题型组件 `Choice`/`ListenChoice`/`MatchGame` + `TypeBadge` + `speech.ts`):

- 每技能步 2 题:**首题恒 `choice`**(题干大图 = 该词 emoji,由 UI 层 `promptEmoji` 传入,选项不放图);次题按技能概率生成变体——拼音 50% `listen-choice`/50% `choice`,汉字 50% `match`/50% `choice`,英语 33/33/33 `listen-choice`/`match`/`choice`。题/选项 id 按 `{wordId}-{步序号}-{题型标记}-{技能}-{i}` 生成,一步内全局唯一。
- 干扰项 `distractorsFor`:同 category 优先,不足跨类兜底,并排除与目标词任何一门文本(拼音/汉字/英文)重复的词。选项数 **恒 4**(0.2.0 起统一:选一选/听一听/短教判分题均 4 项;`optionCountFor` 返回常量 4,不再按 id 分段)。`match` 左卡文字、右卡 emoji,配对经词引用对齐。
- **朗读真相 = 卡面对应词的汉字或英文**:`speakOf(word, skill)` 返回英文词(english)或汉字(其余技能)——拼音选项卡面显示拼音文本但**朗读其对应汉字**(zh-CN 直读汉字稳定),汉字题卡面与朗读均为汉字,英语题朗读英文词(en-US)。speech.ts 按此定语言:english → en-US,其余 → zh-CN。选项**点卡即念**(先念 `o.speak ?? o.text` 再选中/判合),无选项卡内喇叭;`listen-choice` 进题自动朗读 `promptSpeak` 一次,标题行右喇叭(Volume2)可重听;**每题卡左上角题型徽章**(`TypeBadge`:choice=「选一选」/listen-choice=「听一听」/match=「连连看」);纯 choice 的 `promptSpeak` 由题干整块可点重听(无喇叭图标);match 朗读只在「纯选择」时刻(配对判定不读)。
- **发音文本由引擎按上节约定自动推导,无需在词条上存 `speak` 字段**。
- **speech 首响治理(0.2.0 发音延时/无声)**:`features/speech` 创建即 `getVoices()` 预取 + `voiceschanged` 刷新缓存(空轮询不覆盖好缓存);语音未就绪时保留**最新一条**朗读、就绪即补播(不静默丢);空闲冷启动**不 cancel** 立即播,仅引擎忙才 `cancel` 且隔 ~30ms 再播(防 Chrome 同 tick 吞句头);有 voices 但无匹配 voice 时降级引擎默认音(utterance 只带 BCP47 `lang`);**冷启动唤醒**:Chrome 懒初始化 TTS 且需真实有声样本才起音频管线(空句会被引擎跳过、不唤醒)→ voices 一就绪即自动播一条 `volume=0` 的极短真音节(无声)暖机,首指针/键盘 capture 监听兜底(iOS / 加载晚于交互)。`speak` 仅「无引擎 / 无语音源且永等不到 voices」时返 `false`(静默),入队与降级均返 `true`。

---

## 前端 3 层明细(模块清单与组装)

**事实源**:3 层架构设计定稿 + 操作细则 = `docs/superpowers/specs/2026-09-04-dev-architecture-refactor-design.md` + `docs/frontend-dev-standard.md`(specs 中服务 key 的 keys/map 原案已由同名 token 取代,以标准与源码为准)。

- `src/shared/` — 无上层依赖的契约、纯逻辑与中性基础件:`services/*`(契约 + 数据类随契约归属;`core.ts` 服务访问机制核心:`ServiceToken`·`registry`·`useService`·`useServiceSnapshot` + 快照态 `LoadState`;`api-error`/`load-state`/`types` 已并入 services 后删除)、`ui/`(button/card/input/label/badge/select/chart-tooltip 中性视觉基础件 + `quiz/` 三题型 `Choice`/`ListenChoice`/`MatchGame` + `TypeBadge`(题型徽章)+ `speech.ts`(`speakCard`/`langFor`)+ `utils.ts`(`cn` 类名合并,同源 `tailwind-merge`,features 可引))
- `src/features/<f>/` — 自包含模块,公共面 = 该目录 `index.ts`;feature 间**禁止编译期互引**。业务分区:`auth`(登录门)、`archipelago`(群岛主页 `HomeEntry`/`ArchipelagoView`)、`lesson`(答题/结算/称号:`LessonEntry` + `WordLesson`/`WordDone`/`ComboDisplay` + `progress-rules.ts`(`SKILL_ORDER`/`DOMAIN_SKILLS`/`enabledSkillsFor`+`enabledSkills` 域推导,`fullComplete`/`firstTargetId`/`titleForStars`,语义属主,经 `ProgressRulesService` 透传)、`lesson.ts`/`progress.ts`/`settlement.ts`/`praise.ts`)、`settings`(学习设置面板,`SettingsPanel` 纯 UI 收 `domainOrder` prop)、`question-engine`(运行时出题)、`vocabulary`(100 词词库 `words.ts` + 服务工厂)、`foundation`(基础引导自适应:词前短教 `TeachOverlay`(纯判分 4 选项)+ `FoundationStepGate`/`ColdStartWizard` + `teach-questions` 微出题 + `estimator`/`decompose`/`catalogs`/`basics-service`)、`progress`/`settings-state`/`api`/`audio`/`speech`/`combo`/`toast`/`celebrate`/`achievements`/`lucky-bonus`/`lingling`(服务工厂 + 必要组件)
- `src/app/` — composition root:`bootstrap.ts`(**唯一生产 `registry.register` 点**)、`App.tsx`(登录态驱动 + 页面状态路由 + 跨 feature 组装;答题/结算/奖励/持久化规则不落 app)、`useAppState.ts`(phase 状态机)、`useCompletedWords.ts`、`ErrorBoundary.tsx`。`src/main.tsx` = HTML 入口(`bootstrap()` + `ToastProvider` + `<App/>`)

**取用纪律**:`useService()` 仅允许在 page feature 的 `<Name>Entry.tsx` 与 `app/` 组装 hooks 内调用;接口与注册/取用 key **同名一体**(接口占 type 空间,`export const XService = Symbol(...) as ServiceToken<XService>` 同名 const 占 value 空间;`ServiceToken` 与 `registry`/`useService`/`useServiceSnapshot` 收 `services/core.ts` 一文件),`registry.register(ProgressService, impl)` 只在 bootstrap、`useService(ProgressService)` 取、`useServiceSnapshot(service)` 订阅(`getSnapshot` 须返稳定引用)。领域词库/规则按语义属主落 feature(vocabulary/lesson),跨 feature 消费经 shared 契约服务(`VocabularyService`/`ProgressRulesService`)与 `CATEGORY_LABELS` 这类 shared 常量;跨 feature 的组件在 app 组装传 props。数据流:`fetch('/api/...', { credentials: 'include' })`,封装在各 feature service。
