# 开发架构重构设计

**日期：** 2026-09-04  
**状态：** 已确认，待实施计划  
**依据：** `docs/ideas/2026-09-04-dev-architecture.md` 目标态提案与当前源码事实

## 1. 目标与边界

将前端重构为 `shared → features → app` 三层架构，通过类型安全的服务注册表和 Entry 组件隔离 feature，同时保持当前产品行为不变。

本次是纯架构重构，必须完整保留：

- Worker + D1 唯一数据事实源
- `ADMIN_TOKEN`、HttpOnly Cookie 和登录门
- 现有 `/api/*` 路径、请求与响应语义
- D1 schema 和 migrations
- 三类答题、技能开关、解锁与进度规则
- 连击、幸运奖励、成就、连续学习天数、称号、灵灵、夸奖、音效和撒花
- 当前结算、持久化与弹层顺序

本次不引入 IndexedDB、运行时 mock API、Redux、Zustand 或 React Query，也不调整产品 UI 和业务规则。

## 2. 总体架构

```text
src/
├─ app/       启动、调度、全局页面状态、跨 feature 组装
├─ features/  自包含业务模块
└─ shared/    服务契约、注册机制、通用类型和无业务工具

worker/       独立后端，保持仓库根目录
migrations/   D1 迁移，保持现状
```

依赖规则：

- `shared/` 不依赖 `features/` 或 `app/`。
- `features/` 只能依赖 `shared/` 和自身目录。
- feature 之间禁止任何编译期 import。
- `app/` 可以依赖 `shared/` 和各 feature 的公开入口。
- 服务实现通过构造函数接收依赖，不能自行查询注册表。
- `app/bootstrap.ts` 是唯一服务注册点。

## 3. App 层

`app/` 负责：

- 调用 `bootstrap()` 创建并注册服务
- 管理 `boot`、`login`、`home`、`lesson`、`settings` 页面状态
- 组合页面型 Entry 和跨 feature 浮层
- 提供错误边界和 app 级组装 hook

`app/` 不包含答题、结算、奖励、持久化或校验规则。`App.tsx` 只表达页面状态和组合关系。

目标文件：

```text
src/app/
├─ App.tsx
├─ ErrorBoundary.tsx
├─ bootstrap.ts
├─ useAppState.ts
└─ use*.ts             app 级组装 hook
```

`features/` 内只有页面型 feature 的 Entry 可以调用 `useService()`。`app/` 的专用组装 hook 也可以调用服务。纯 UI、业务逻辑和服务实现均不能调用 `useService()`。

## 4. Feature 划分

### 4.1 页面型 feature

- `auth`：身份探测、登录、退出和 LoginGate
- `archipelago`：群岛主页、词语入口和首页展示
- `lesson`：答题会话、技能步骤和整词结算
- `settings`：家长设置与重置操作

每个页面型 feature 通过 `<Name>Entry.tsx` 组装内部组件。纯 UI 子组件只接收 props 和回调。

### 4.2 服务型 feature

- `api`：同源 `/api/*` HTTP 客户端
- `vocabulary`：词库查询
- `question-engine`：出题逻辑
- `auth-state`：响应式认证状态
- `progress`：响应式进度状态与保存
- `settings-state`：响应式设置状态与保存
- `speech`：浏览器语音
- `audio`：设备声音偏好与音效播放
- `combo`：会话连击状态
- `celebrate`：撒花效果
- `toast`：通知状态
- `achievements`：成就规则与扫描
- `lucky-bonus`：幸运奖励判定

### 4.3 自包含 UI

- `lingling`：仅根据输入状态展示吉祥物
- 各 feature 自己的弹层和展示组件

feature 不能 import 其他 feature 的实现或公开入口。跨 feature 行为必须通过 `shared/services` 契约调用；跨 feature UI 由 `app/` 或所属页面 Entry 通过公共数据和回调组装。

## 5. 服务系统

`shared/services/` 每个文件定义一个服务接口。`keys.ts` 和 `map.ts` 建立服务 key 到接口的类型映射。

```text
src/shared/
├─ services/
│  ├─ keys.ts
│  ├─ map.ts
│  ├─ api.ts
│  ├─ auth.ts
│  ├─ progress.ts
│  ├─ settings.ts
│  └─ ...
├─ registry.ts
├─ useService.ts
├─ useServiceSnapshot.ts
├─ types.ts
└─ utils.ts
```

注册表仅负责服务实例的注册、查询和测试清理，不承担服务内部状态通知。

服务分为：

- 无状态服务：直接提供方法，如词库查询和撒花。
- 响应式服务：提供 `getSnapshot()`、`subscribe()` 以及异步 command。

共享加载状态采用判别联合：

```ts
type LoadState<T> =
  | { status: 'idle' | 'loading'; data: T }
  | { status: 'ready'; data: T }
  | { status: 'error'; data: T; error: string }
```

`useServiceSnapshot(service)` 通过 `useSyncExternalStore` 订阅具体服务。注册表的订阅能力不能代替业务服务自身的状态订阅。

`bootstrap.ts` 按依赖顺序注册：

1. `api`、`vocabulary`、`speech`、`audio`、`combo`、`celebrate`、`toast`
2. `question-engine`，依赖 `vocabulary`
3. `auth`、`progress`、`settings-state`，依赖 `api`
4. 需要多个服务的会话或协调服务

## 6. 数据与认证

Worker + D1 是进度和设置的唯一事实源。声音开关继续使用 localStorage，连击继续使用 sessionStorage；二者分别属于设备偏好和临时会话状态，不构成学习数据的离线副本。

不创建 `shared/db.ts`，不读取 `VITE_USE_MOCK_API`，生产运行代码不包含 mock 数据分支。测试通过构造函数注入内存 fake service。

`ApiService` 覆盖现有端点：

```ts
me()
login(token)
logout()
getProgress()
putProgress(progress)
deleteProgress()
getSettings()
putSettings(settings)
```

所有请求使用同源 `/api/*` 与 `credentials: 'include'`。访问令牌只存在于登录表单的瞬时组件状态；登录成功后由 Worker 写入 HttpOnly Cookie，前端不持久化令牌。

`AuthService` 管理以下状态：

```text
checking → authenticated
         → anonymous
         → error
```

启动流程：

```text
main
  → bootstrap
  → App
  → auth.me()
  → anonymous: AuthEntry
  → authenticated: 并行加载 progress 与 settings
  → 加载完成: HomeEntry
```

## 7. 学习与结算流程

`LessonEntry` 接收 `wordId` 和导航回调，读取词库、设置与进度服务，并把题目、状态和行为回调传给纯 UI 的 `WordLesson`。

答题过程保持当前语义：

- 首次答对、重试和答错使用现有连击规则。
- 每个技能完成后保存进度。
- 音效、语音、Toast 和撒花触发时机保持不变。
- 随机逻辑继续允许注入 RNG。

整词结算协调器按现有固定顺序执行：

1. 计算基础星星和连击奖励。
2. 判定幸运奖励。
3. 更新整词进度。
4. 更新连续学习天数。
5. 扫描新成就。
6. 合并并持久化进度与设置。
7. 依次展示结算页、成就弹层和幸运奖励效果。
8. 返回主页或进入下一词。

协调器只依赖 shared 服务接口。成就和幸运奖励的规则分别由对应 feature 实现，通过服务接口暴露。

## 8. 错误处理

- `401`：AuthService 切换为 anonymous，App 显示登录页。
- `400`：向用户展示 Worker 返回的业务错误。
- 网络错误或 `5xx`：保留现有数据，进入可重试状态。
- 非法响应：由 ApiService 转换为统一客户端错误。
- 保存失败：响应式服务恢复乐观更新前的快照，并通知 Toast。
- 音效、语音和撒花失败：静默降级，不中断学习流程。
- 顶层未捕获渲染错误：由 `ErrorBoundary` 显示恢复界面。

## 9. Worker 边界

Worker 保持在仓库根目录，以维持 `wrangler.toml`、Cloudflare Vite 插件和生产部署语义：

```text
worker/
├─ index.ts
├─ auth.ts
├─ progress.ts
├─ settings.ts
└─ _lib/
   ├─ auth.ts
   └─ http.ts
```

本次不修改 API 路径、Cookie 语义、D1 schema 或 migrations。只允许不改变外部行为的内部整理和类型对齐。

## 10. 开发与测试基础设施

新增 `@/` 路径别名，并在 TypeScript、Vite 和 Vitest 中保持一致。

新增 `dev:init`：

```json
"dev:init": "npm run db:local && npm run dev"
```

保留：

- `npm run dev`：只启动开发服务器
- `npm run db:local`：只应用本地 D1 migrations
- `npm run dev:init`：应用 migrations 后启动开发服务器

测试基础设施增加 jsdom、React Testing Library 和统一 setup，并让 Vitest 同时识别 `*.test.ts` 与 `*.test.tsx`。

测试范围：

- 保留现有纯逻辑测试。
- 每个页面型 Entry 有组装测试。
- 关键交互组件有用户可见行为测试。
- 响应式服务覆盖加载、成功、失败、重试和乐观回滚。
- 覆盖登录、退出、认证恢复和数据接口 `401`。
- 覆盖答题、技能解锁、结算、连击、幸运奖励、成就和连续天数。
- 不为纯展示组件批量增加快照测试。

新增自动化架构测试：

- 禁止 `features/a` import `features/b`。
- 禁止 feature import `app`。
- 禁止非 Entry feature 文件调用 `useService`。
- 禁止 `bootstrap.ts` 之外调用 `registry.register`，测试 setup 除外。
- feature 的 `index.ts` 只导出公共 API。

## 11. 渐进迁移顺序

1. 配置路径别名、服务基础设施、组件测试环境和 `dev:init`。
2. 提取 ApiService、AuthService 和 auth feature。
3. 提取 ProgressService 与 SettingsService。
4. 迁移 vocabulary、question-engine 和 lesson。
5. 迁移 speech、audio、combo、celebrate 与 toast。
6. 迁移 achievements、lucky-bonus 和 lingling。
7. 建立 HomeEntry、SettingsEntry 和精简 App 调度层。
8. 增加依赖边界检查，删除完成迁移的旧目录和适配层。

每一步都保持应用可构建、可测试，不以长期不可运行的一次性搬迁完成重构。

## 12. 验收标准

- UI、交互、业务规则、API、Cookie、D1 schema 和部署行为无产品级变化。
- `src/` 符合三层依赖方向。
- feature 间无编译期 import。
- `bootstrap.ts` 是唯一生产服务注册点。
- 页面型 feature 通过 Entry 组装，纯 UI 只依赖 props。
- 异步服务有明确加载、错误与重试状态。
- 本地开发继续使用 Worker + D1，`npm run dev:init` 可完成初始化后启动。
- `npm test`、`npm run lint`、`npm run build` 和 `npm run db:local` 通过。

